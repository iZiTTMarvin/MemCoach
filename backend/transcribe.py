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


def _build_public_file_url(base_domain: str, key: str) -> str:
    domain = (base_domain or "").strip()
    if not domain:
        raise RuntimeError("QINIU_DOMAIN not configured")
    if not domain.startswith(("http://", "https://")):
        # 七牛测试域名 (*.clouddn.com) 仅支持 HTTP，默认用 http
        domain = f"http://{domain}"
    return f"{domain.rstrip('/')}/{key.lstrip('/')}"


def _upload_to_qiniu(local_path: str, suffix: str) -> str:
    """上传文件到七牛云 OSS，返回公网 URL"""
    q = QiniuAuth(settings.qiniu_access_key, settings.qiniu_secret_key)
    key = f"audio/{uuid.uuid4().hex}{suffix}"
    token = q.upload_token(settings.qiniu_bucket, key, 3600)

    ret, info = put_file(token, key, local_path)
    if ret is None:
        raise RuntimeError(f"Qiniu upload failed: {info}")

    url = _build_public_file_url(settings.qiniu_domain, ret["key"])
    logger.info(f"Uploaded to Qiniu: {url}")
    return url


def transcribe_audio(audio_bytes: bytes, suffix: str = ".webm") -> str:
    """转写音频：上传到七牛云 → DashScope filetrans REST API"""
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
        logger.info(f"DashScope submit status={resp.status_code}, body={resp.text[:500]}")
        if resp.status_code != 200:
            raise RuntimeError(f"Transcription submit failed: {resp.text}")

        task_id = resp.json()["output"]["task_id"]
        logger.info(f"Transcription task: {task_id}")

        # Step 3: Poll until completion
        query_headers = {"Authorization": f"Bearer {settings.dashscope_api_key}"}
        for poll_idx in range(300):
            time.sleep(3)
            qr = requests.get(_DASHSCOPE_QUERY + task_id, headers=query_headers)
            output = qr.json().get("output", {})
            status = output.get("task_status", "").upper()
            logger.info(f"Poll #{poll_idx}: status={status}, output_keys={list(output.keys())}")

            if status == "SUCCEEDED":
                logger.info(f"DashScope output for _extract_text: {json.dumps(output, ensure_ascii=False)[:800]}")
                text = _extract_text(output)
                logger.info(f"Transcription done: {len(text)} chars")
                return text
            elif status in ("FAILED", "UNKNOWN"):
                logger.error(f"DashScope task {status}: {json.dumps(output, ensure_ascii=False)[:500]}")
                raise RuntimeError(f"Transcription {status}: {output.get('message', '')}")

        raise RuntimeError("Transcription timed out")
    finally:
        os.unlink(tmp_path)


def _extract_text(output: dict) -> str:
    """获取转写结果并提取文本"""
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
