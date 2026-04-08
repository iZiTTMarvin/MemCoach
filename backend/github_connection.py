"""GitHub App 用户连接服务。"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from jose import JWTError, jwt

from backend.config import settings
from backend.storage.github_connections import (
    get_github_connection,
    upsert_github_connection,
)

logger = logging.getLogger("uvicorn")

GITHUB_LOGIN_BASE = "https://github.com"
GITHUB_API_BASE = "https://api.github.com"
STATE_ALGORITHM = "HS256"


class GitHubConnectionError(RuntimeError):
    """GitHub 连接流程基类异常。"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class GitHubConnectionConfigError(GitHubConnectionError):
    """GitHub 配置缺失。"""


def create_github_connect_session(user_id: str, redirect_path: str = "/project-analysis") -> dict[str, str]:
    """生成 GitHub App 授权跳转地址。"""
    _ensure_github_connection_configured()
    state = _encode_state(user_id=user_id, redirect_path=redirect_path)
    query = urlencode(
        {
            "client_id": settings.github_app_client_id,
            "redirect_uri": settings.github_oauth_callback_url(),
            "state": state,
        }
    )
    return {
        "state": state,
        "authorize_url": f"{GITHUB_LOGIN_BASE}/login/oauth/authorize?{query}",
    }


def handle_github_callback(
    *,
    code: str | None,
    state: str | None,
    installation_id: int | None,
    setup_action: str | None,
    error: str | None,
    error_description: str | None,
) -> dict[str, Any]:
    """处理 GitHub OAuth 回调并保存连接信息。"""
    state_payload = _decode_state(state or "")
    redirect_path = state_payload["redirect_path"]

    if error:
        return {
            "redirect_url": _build_frontend_redirect_url(
                redirect_path,
                github_connected="0",
                error_code=error,
                error_message=error_description or "GitHub 授权失败。",
            )
        }

    if not code:
        raise GitHubConnectionError("github_missing_code", "GitHub 回调缺少 code。")

    token_payload = exchange_code_for_user_token(code)
    access_token = str(token_payload.get("access_token") or "").strip()
    if not access_token:
        raise GitHubConnectionError("github_missing_access_token", "GitHub 未返回 access token。")

    user = fetch_authenticated_user(access_token)
    installations = list_user_installations(access_token)

    now = datetime.now(timezone.utc)
    access_token_expires_at = _expires_at(now, token_payload.get("expires_in"))
    refresh_token_expires_at = _expires_at(now, token_payload.get("refresh_token_expires_in"))

    normalized_installations = [_normalize_installation(item) for item in installations]
    resolved_installation_id = installation_id
    if resolved_installation_id is None and normalized_installations:
        resolved_installation_id = normalized_installations[0]["id"]

    upsert_github_connection(
        user_id=state_payload["user_id"],
        github_user_id=int(user.get("id") or 0),
        github_login=str(user.get("login") or ""),
        github_name=str(user.get("name") or ""),
        github_avatar_url=str(user.get("avatar_url") or ""),
        installation_id=resolved_installation_id,
        installations=normalized_installations,
        access_token=access_token,
        refresh_token=str(token_payload.get("refresh_token") or ""),
        access_token_expires_at=access_token_expires_at,
        refresh_token_expires_at=refresh_token_expires_at,
        token_type=str(token_payload.get("token_type") or "bearer"),
        scope=str(token_payload.get("scope") or ""),
    )
    return {
        "github_login": str(user.get("login") or ""),
        "redirect_url": _build_frontend_redirect_url(
            redirect_path,
            github_connected="1",
            github_login=str(user.get("login") or ""),
            setup_action=setup_action or "",
        ),
    }


def get_valid_github_access_token(user_id: str) -> str:
    """获取可用的 GitHub 用户 access token，必要时自动刷新。"""
    connection = get_github_connection(user_id)
    if not connection or connection.get("status") != "connected":
        raise GitHubConnectionError("github_not_connected", "当前用户尚未连接 GitHub。")

    access_token = str(connection.get("access_token") or "")
    refresh_token = str(connection.get("refresh_token") or "")
    if access_token and not _is_expired(connection.get("access_token_expires_at")):
        return access_token
    if not refresh_token:
        raise GitHubConnectionError("github_token_expired", "GitHub 连接已过期，请重新连接。")

    refreshed = refresh_user_access_token(refresh_token)
    now = datetime.now(timezone.utc)
    refreshed_access_token = str(refreshed.get("access_token") or "").strip()
    if not refreshed_access_token:
        raise GitHubConnectionError("github_missing_access_token", "刷新后未返回 access token。")

    upsert_github_connection(
        user_id=user_id,
        github_user_id=int(connection.get("github_user_id") or 0),
        github_login=str(connection.get("github_login") or ""),
        github_name=str(connection.get("github_name") or ""),
        github_avatar_url=str(connection.get("github_avatar_url") or ""),
        installation_id=connection.get("installation_id"),
        installations=connection.get("installations") or [],
        access_token=refreshed_access_token,
        refresh_token=str(refreshed.get("refresh_token") or refresh_token),
        access_token_expires_at=_expires_at(now, refreshed.get("expires_in")),
        refresh_token_expires_at=_expires_at(now, refreshed.get("refresh_token_expires_in")),
        token_type=str(refreshed.get("token_type") or connection.get("token_type") or "bearer"),
        scope=str(refreshed.get("scope") or connection.get("scope") or ""),
    )
    return refreshed_access_token


def exchange_code_for_user_token(code: str) -> dict[str, Any]:
    """将 GitHub OAuth code 交换成用户 access token。"""
    _ensure_github_connection_configured()
    payload = {
        "client_id": settings.github_app_client_id,
        "client_secret": settings.github_app_client_secret,
        "code": code,
        "redirect_uri": settings.github_oauth_callback_url(),
    }
    return _post_json(f"{GITHUB_LOGIN_BASE}/login/oauth/access_token", payload)


def refresh_user_access_token(refresh_token: str) -> dict[str, Any]:
    """刷新 GitHub 用户 access token。"""
    _ensure_github_connection_configured()
    payload = {
        "client_id": settings.github_app_client_id,
        "client_secret": settings.github_app_client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    return _post_json(f"{GITHUB_LOGIN_BASE}/login/oauth/access_token", payload)


def fetch_authenticated_user(access_token: str) -> dict[str, Any]:
    """获取当前 access token 对应的 GitHub 用户信息。"""
    payload = _get_json(f"{GITHUB_API_BASE}/user", access_token)
    if not isinstance(payload, dict):
        raise GitHubConnectionError("github_user_payload_invalid", "GitHub 用户信息响应格式非法。")
    return payload


def list_user_installations(access_token: str) -> list[dict[str, Any]]:
    """获取当前用户可访问的安装列表。"""
    payload = _get_json(f"{GITHUB_API_BASE}/user/installations", access_token)
    if not isinstance(payload, dict):
        raise GitHubConnectionError("github_installations_payload_invalid", "GitHub installations 响应格式非法。")
    rows = payload.get("installations") or []
    if not isinstance(rows, list):
        raise GitHubConnectionError("github_installations_payload_invalid", "GitHub installations 响应格式非法。")
    return [row for row in rows if isinstance(row, dict)]


def _normalize_installation(item: dict[str, Any]) -> dict[str, Any]:
    """压缩 installation 信息，避免把整份 GitHub payload 存入本地。"""
    account = item.get("account") or {}
    return {
        "id": int(item.get("id") or 0),
        "target_type": str(item.get("target_type") or ""),
        "account_login": str(account.get("login") or ""),
        "account_type": str(account.get("type") or ""),
    }


def _encode_state(*, user_id: str, redirect_path: str) -> str:
    """生成短期有效的 state token。"""
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "purpose": "github_connect",
            "redirect_path": redirect_path or "/project-analysis",
            "nonce": uuid.uuid4().hex,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=10)).timestamp()),
        },
        settings.github_state_secret,
        algorithm=STATE_ALGORITHM,
    )


def _decode_state(state: str) -> dict[str, str]:
    """校验并解析 state token。"""
    if not state:
        raise GitHubConnectionError("github_missing_state", "GitHub 回调缺少 state。")
    try:
        payload = jwt.decode(state, settings.github_state_secret, algorithms=[STATE_ALGORITHM])
    except JWTError as exc:
        raise GitHubConnectionError("github_invalid_state", "GitHub 授权状态已失效，请重新发起连接。") from exc

    if payload.get("purpose") != "github_connect":
        raise GitHubConnectionError("github_invalid_state", "GitHub 授权状态非法。")
    user_id = str(payload.get("sub") or "").strip()
    if not user_id:
        raise GitHubConnectionError("github_invalid_state", "GitHub 授权状态缺少用户信息。")

    redirect_path = str(payload.get("redirect_path") or "/project-analysis")
    if not redirect_path.startswith("/"):
        redirect_path = "/project-analysis"
    return {"user_id": user_id, "redirect_path": redirect_path}


def _ensure_github_connection_configured() -> None:
    """确保 GitHub App 关键配置已经存在。"""
    if (
        not settings.github_app_client_id.strip()
        or not settings.github_app_client_secret.strip()
        or not settings.backend_public_url.strip()
        or not settings.frontend_app_url.strip()
    ):
        raise GitHubConnectionConfigError(
            "github_not_configured",
            "GitHub 连接能力尚未配置完成。",
        )


def _expires_at(now: datetime, seconds: Any) -> str | None:
    """将 expires_in 秒数转换为 ISO 时间。"""
    try:
        expires_in = int(seconds)
    except (TypeError, ValueError):
        return None
    return (now + timedelta(seconds=expires_in)).isoformat()


def _is_expired(value: Any) -> bool:
    """判断 access token 是否已过期或即将过期。"""
    if not value:
        return False
    try:
        expires_at = datetime.fromisoformat(str(value))
    except ValueError:
        return False
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= now + timedelta(seconds=60)


def _build_frontend_redirect_url(path: str, **query: str) -> str:
    """构建回跳前端页面 URL。"""
    normalized_path = path if path.startswith("/") else "/project-analysis"
    clean_query = {k: v for k, v in query.items() if v}
    query_string = urlencode(clean_query)
    base = f"{settings.frontend_app_url.rstrip('/')}{normalized_path}"
    return f"{base}?{query_string}" if query_string else base


def _post_json(url: str, payload: dict[str, Any], timeout: int = 20) -> dict[str, Any]:
    """发送 form POST 并解析 JSON。"""
    data = urlencode(payload).encode("utf-8")
    req = Request(
        url,
        data=data,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "MemCoach-GitHub-Connection/1.0",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310 - 固定 GitHub 登录域
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        raise _map_http_error(exc) from exc
    except URLError as exc:
        raise GitHubConnectionError("github_network_error", f"GitHub 连接失败：{exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise GitHubConnectionError("github_invalid_json", "GitHub 响应不是合法 JSON。") from exc


def _get_json(url: str, access_token: str, timeout: int = 20) -> dict[str, Any] | list[Any]:
    """使用 GitHub 用户 access token 发起 GET 请求。"""
    req = Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {access_token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "MemCoach-GitHub-Connection/1.0",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310 - 固定 GitHub API 域
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        raise _map_http_error(exc) from exc
    except URLError as exc:
        raise GitHubConnectionError("github_network_error", f"GitHub 连接失败：{exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise GitHubConnectionError("github_invalid_json", "GitHub 响应不是合法 JSON。") from exc


def _map_http_error(exc: HTTPError) -> GitHubConnectionError:
    """将 GitHub HTTP 错误映射为稳定错误码。"""
    if exc.code == 401:
        return GitHubConnectionError("github_unauthorized", "GitHub 认证失败，请重新连接。")
    if exc.code == 403:
        return GitHubConnectionError("github_forbidden", "GitHub 拒绝访问当前请求。")
    if exc.code == 404:
        return GitHubConnectionError("github_not_found", "GitHub 资源不存在。")
    return GitHubConnectionError("github_http_error", f"GitHub 请求失败：HTTP {exc.code}")
