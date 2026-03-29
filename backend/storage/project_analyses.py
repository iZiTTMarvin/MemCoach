"""项目分析任务持久化 (SQLite)."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel

from backend.config import settings
from backend.project_analysis.contracts import AnalysisStatus, ProjectAnalysisResult


def _validate_status(status: str) -> str:
    """校验任务状态是否是合法枚举值。"""
    try:
        return AnalysisStatus(status).value
    except ValueError as exc:
        raise ValueError(f"Invalid analysis status: {status}") from exc


def _normalize_result_payload(result: Mapping[str, Any] | BaseModel) -> dict[str, Any]:
    """将分析结果规范化为统一 JSON 结构。"""
    if isinstance(result, BaseModel):
        payload = result.model_dump(mode="json")
    else:
        payload = dict(result)

    validated = ProjectAnalysisResult.model_validate(payload)
    return validated.model_dump(mode="json")


def _get_conn() -> sqlite3.Connection:
    """获取数据库连接并确保表结构存在。"""
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(settings.db_path))
    conn.row_factory = sqlite3.Row

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS project_analyses (
            analysis_id    TEXT PRIMARY KEY,
            user_id        TEXT NOT NULL,
            repo_url       TEXT NOT NULL,
            repo_name      TEXT NOT NULL,
            branch         TEXT NOT NULL,
            commit_sha     TEXT NOT NULL,
            role_summary   TEXT DEFAULT '',
            owned_scopes   TEXT DEFAULT '[]',
            status         TEXT NOT NULL DEFAULT 'queued',
            error_code     TEXT,
            error_message  TEXT,
            result_json    TEXT DEFAULT '{}',
            created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_project_analyses_user_status "
        "ON project_analyses (user_id, status)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_project_analyses_user_updated "
        "ON project_analyses (user_id, updated_at DESC)"
    )

    # 兼容老库：逐列补齐
    for col, ddl in [
        ("repo_name", "TEXT NOT NULL DEFAULT ''"),
        ("commit_sha", "TEXT NOT NULL DEFAULT ''"),
        ("role_summary", "TEXT DEFAULT ''"),
        ("owned_scopes", "TEXT DEFAULT '[]'"),
        ("status", "TEXT NOT NULL DEFAULT 'queued'"),
        ("error_code", "TEXT"),
        ("error_message", "TEXT"),
        ("result_json", "TEXT DEFAULT '{}'"),
        ("updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP"),
    ]:
        try:
            conn.execute(f"SELECT {col} FROM project_analyses LIMIT 1")
        except sqlite3.OperationalError:
            conn.execute(f"ALTER TABLE project_analyses ADD COLUMN {col} {ddl}")

    conn.commit()
    return conn


def create_project_analysis(
    analysis_id: str,
    repo_url: str,
    repo_name: str,
    branch: str,
    commit_sha: str,
    *,
    user_id: str,
    role_summary: str = "",
    owned_scopes: list[str] | None = None,
    status: str = AnalysisStatus.QUEUED.value,
) -> None:
    """创建项目分析任务。"""
    normalized_status = _validate_status(status)
    scopes = owned_scopes or []

    conn = _get_conn()
    conn.execute(
        """
        INSERT INTO project_analyses
        (analysis_id, user_id, repo_url, repo_name, branch, commit_sha, role_summary, owned_scopes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            analysis_id,
            user_id,
            repo_url,
            repo_name,
            branch,
            commit_sha,
            role_summary,
            json.dumps(scopes, ensure_ascii=False),
            normalized_status,
        ),
    )
    conn.commit()
    conn.close()


def update_project_analysis_status(
    analysis_id: str,
    status: str,
    *,
    user_id: str,
    error_code: str | None = None,
    error_message: str | None = None,
) -> bool:
    """更新项目分析任务状态。"""
    normalized_status = _validate_status(status)
    conn = _get_conn()
    cursor = conn.execute(
        """
        UPDATE project_analyses
        SET status = ?, error_code = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE analysis_id = ? AND user_id = ?
        """,
        (normalized_status, error_code, error_message, analysis_id, user_id),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def save_project_analysis_result(
    analysis_id: str,
    result: Mapping[str, Any] | BaseModel,
    *,
    user_id: str,
    status: str = AnalysisStatus.COMPLETED.value,
) -> bool:
    """保存项目分析结果，并更新任务状态。"""
    normalized_status = _validate_status(status)
    payload = _normalize_result_payload(result)

    conn = _get_conn()
    cursor = conn.execute(
        """
        UPDATE project_analyses
        SET result_json = ?, status = ?, error_code = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE analysis_id = ? AND user_id = ?
        """,
        (json.dumps(payload, ensure_ascii=False), normalized_status, analysis_id, user_id),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def get_project_analysis(analysis_id: str, *, user_id: str) -> dict[str, Any] | None:
    """读取单个项目分析任务。"""
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM project_analyses WHERE analysis_id = ? AND user_id = ?",
        (analysis_id, user_id),
    ).fetchone()
    conn.close()

    if not row:
        return None

    result = dict(row)
    result["owned_scopes"] = json.loads(result.get("owned_scopes") or "[]")
    result["result"] = json.loads(result.get("result_json") or "{}")
    return result


def list_project_analyses(
    *,
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    status: str | None = None,
) -> dict[str, Any]:
    """分页列出项目分析任务。"""
    where = ["user_id = ?"]
    params: list[Any] = [user_id]

    if status is not None:
        where.append("status = ?")
        params.append(_validate_status(status))

    where_sql = " AND ".join(where)

    conn = _get_conn()
    total = conn.execute(
        f"SELECT COUNT(*) FROM project_analyses WHERE {where_sql}", params
    ).fetchone()[0]
    rows = conn.execute(
        f"""
        SELECT analysis_id, repo_url, repo_name, branch, commit_sha, status, error_code, error_message, created_at, updated_at
        FROM project_analyses
        WHERE {where_sql}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset],
    ).fetchall()
    conn.close()

    return {"items": [dict(row) for row in rows], "total": total}


def delete_project_analysis(analysis_id: str, *, user_id: str) -> bool:
    """删除项目分析任务。"""
    conn = _get_conn()
    cursor = conn.execute(
        "DELETE FROM project_analyses WHERE analysis_id = ? AND user_id = ?",
        (analysis_id, user_id),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0

