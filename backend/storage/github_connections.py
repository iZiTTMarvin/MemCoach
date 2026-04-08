"""GitHub 连接持久化 (SQLite)."""

from __future__ import annotations

import json
import sqlite3
from typing import Any

from backend.config import settings


def _get_conn() -> sqlite3.Connection:
    """获取数据库连接并确保表结构存在。"""
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(settings.db_path))
    conn.row_factory = sqlite3.Row

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS github_connections (
            user_id                      TEXT PRIMARY KEY,
            github_user_id               INTEGER NOT NULL,
            github_login                 TEXT NOT NULL DEFAULT '',
            github_name                  TEXT DEFAULT '',
            github_avatar_url            TEXT DEFAULT '',
            installation_id              INTEGER,
            installations_json           TEXT DEFAULT '[]',
            access_token                 TEXT NOT NULL DEFAULT '',
            refresh_token                TEXT DEFAULT '',
            access_token_expires_at      TEXT,
            refresh_token_expires_at     TEXT,
            token_type                   TEXT NOT NULL DEFAULT 'bearer',
            scope                        TEXT DEFAULT '',
            status                       TEXT NOT NULL DEFAULT 'connected',
            disconnected_at              TEXT,
            created_at                   TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at                   TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    return conn


def init_github_connections_table() -> None:
    """初始化 GitHub 连接表。"""
    conn = _get_conn()
    conn.close()


def upsert_github_connection(
    *,
    user_id: str,
    github_user_id: int,
    github_login: str,
    github_name: str,
    github_avatar_url: str,
    installation_id: int | None,
    installations: list[dict[str, Any]],
    access_token: str,
    refresh_token: str,
    access_token_expires_at: str | None,
    refresh_token_expires_at: str | None,
    token_type: str,
    scope: str,
    status: str = "connected",
) -> None:
    """新增或更新用户的 GitHub 连接。"""
    conn = _get_conn()
    conn.execute(
        """
        INSERT INTO github_connections (
            user_id,
            github_user_id,
            github_login,
            github_name,
            github_avatar_url,
            installation_id,
            installations_json,
            access_token,
            refresh_token,
            access_token_expires_at,
            refresh_token_expires_at,
            token_type,
            scope,
            status,
            disconnected_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            github_user_id = excluded.github_user_id,
            github_login = excluded.github_login,
            github_name = excluded.github_name,
            github_avatar_url = excluded.github_avatar_url,
            installation_id = excluded.installation_id,
            installations_json = excluded.installations_json,
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            access_token_expires_at = excluded.access_token_expires_at,
            refresh_token_expires_at = excluded.refresh_token_expires_at,
            token_type = excluded.token_type,
            scope = excluded.scope,
            status = excluded.status,
            disconnected_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            user_id,
            github_user_id,
            github_login,
            github_name,
            github_avatar_url,
            installation_id,
            json.dumps(installations, ensure_ascii=False),
            access_token,
            refresh_token,
            access_token_expires_at,
            refresh_token_expires_at,
            token_type,
            scope,
            status,
        ),
    )
    conn.commit()
    conn.close()


def get_github_connection(user_id: str) -> dict[str, Any] | None:
    """读取用户的 GitHub 连接状态。"""
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM github_connections WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    conn.close()

    if not row:
        return None

    data = dict(row)
    data["installations"] = json.loads(data.pop("installations_json") or "[]")
    return data


def disconnect_github_connection(user_id: str) -> bool:
    """断开 GitHub 连接并清空敏感 token。"""
    conn = _get_conn()
    cursor = conn.execute(
        """
        UPDATE github_connections
        SET status = 'disconnected',
            access_token = '',
            refresh_token = '',
            access_token_expires_at = NULL,
            refresh_token_expires_at = NULL,
            disconnected_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
        """,
        (user_id,),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0
