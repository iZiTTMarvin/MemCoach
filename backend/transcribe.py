"""语音转写模块：七牛云 OSS + DashScope ASR REST API。

流程：上传音频到七牛云 → 获取公网 URL → DashScope qwen3-asr-flash-filetrans 异步转写。
"""
import tempfile
import os
import uuid
import time
import json
import logging
import requests

from qiniu import Auth as QiniuAuth, put_file

from backend.config import settings

logger = logging.getLogger("uvicorn")

_DASHSCOPE_SUBMIT = "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription"
_DASHSCOPE_QUERY = "https://dashscope.aliyuncs.com/api/v1/tasks/"


def _upload_to_qiniu(local_path: str, suffix: str) -> str:
    """Upload file to Qiniu OSS, return public URL."""
    q = QiniuAuth(settings.qiniu_access_key, settings.qiniu_secret_key)
    key = f"audio/{uuid.uuid4().hex}{suffix}"
    token = q.upload_token(settings.qiniu_bucket, key, 3600)

    ret, info = put_file(token, key, local_path)
    if ret is None:
        raise RuntimeError(f"Qiniu upload failed: {info}")

    url = f"{settings.qiniu_domain}/{ret['key']}"
    logger.info(f"Uploaded to Qiniu: {url}")
    return url


def transcribe_audio(audio_bytes: bytes, suffix: str = ".webm") -> str:
    """Transcribe audio: upload to Qiniu → DashScope filetrans REST API."""
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    try:
        # Step 1: Upload to Qiniu
        file_url = _upload_to_qiniu(tmp_path, suffix)

        # Step 2: Submit DashScope transcription (REST API, file_url 单数)
        headers = {
            "Authorization": f"Bearer {settings.dashscope_api_key}",
            "Content-Type": "application/json",
            "X-DashScope-Async": "enable",
        }
        payload = {
            "model": "qwen3-asr-flash-filetrans",
            "input": {"file_url": file_url},
            "parameters": {"channel_id": [0]},
        }

        resp = requests.post(_DASHSCOPE_SUBMIT, headers=headers, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"Transcription submit failed: {resp.text}")

        task_id = resp.json()["output"]["task_id"]
        logger.info(f"Transcription task: {task_id}")

        # Step 3: Poll until completion
        query_headers = {"Authorization": f"Bearer {settings.dashscope_api_key}"}
        for _ in range(300):
            time.sleep(3)
            qr = requests.get(_DASHSCOPE_QUERY + task_id, headers=query_headers)
            output = qr.json().get("output", {})
            status = output.get("task_status", "").upper()

            if status == "SUCCEEDED":
                text = _extract_text(output)
                logger.info(f"Transcription done: {len(text)} chars")
                return text
            elif status in ("FAILED", "UNKNOWN"):
                raise RuntimeError(f"Transcription {status}: {output.get('message', '')}")

        raise RuntimeError("Transcription timed out")
    finally:
        os.unlink(tmp_path)


def _extract_text(output: dict) -> str:
    """Fetch transcription result and extract text."""
    # file_url 模式: result.transcription_url（单数）
    result = output.get("result", {})
    url = result.get("transcription_url")
    if not url:
        # file_urls 模式 fallback: results[].transcription_url
        for item in output.get("results", []):
            url = item.get("transcription_url")
            if url:
                break
    if not url:
        return ""

    resp = requests.get(url)
    if resp.status_code != 200:
        return ""

    data = resp.json()
    texts = []
    for transcript in data.get("transcripts", []):
        text = transcript.get("text", "")
        if text:
            texts.append(text)
    return "\n".join(texts)
