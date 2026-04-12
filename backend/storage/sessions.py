"""面试记录持久化 (SQLite)."""
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from backend.config import settings

DB_PATH = settings.db_path


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            mode TEXT NOT NULL,
            topic TEXT,
            questions TEXT DEFAULT '[]',
            transcript TEXT DEFAULT '[]',
            scores TEXT DEFAULT '[]',
            weak_points TEXT DEFAULT '[]',
            overall TEXT DEFAULT '{}',
            review TEXT,
            user_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # 增量列迁移：检测列是否存在，不存在则 ALTER TABLE
    _migrate_columns = [
        ("questions", "'[]'"),
        ("overall", "'{}'"),
        ("user_id", "NULL"),
        ("status", "'active'"),
        ("progress_payload", "NULL"),
        ("completed_at", "NULL"),
        ("last_activity_at", "NULL"),
    ]
    for col, default in _migrate_columns:
        try:
            conn.execute(f"SELECT {col} FROM sessions LIMIT 1")
        except sqlite3.OperationalError:
            conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} TEXT DEFAULT {default}")
    conn.commit()
    return conn


def create_session(session_id: str, mode: str, topic: str | None = None,
                   questions: list | None = None, *, user_id: str):
    """创建新会话，默认状态为 active"""
    now = datetime.now().isoformat()
    conn = _get_conn()
    conn.execute(
        "INSERT INTO sessions (session_id, mode, topic, questions, user_id, status, last_activity_at) "
        "VALUES (?, ?, ?, ?, ?, 'active', ?)",
        (session_id, mode, topic, json.dumps(questions or [], ensure_ascii=False), user_id, now),
    )
    conn.commit()
    conn.close()


def append_message(session_id: str, role: str, content: str, *, user_id: str):
    conn = _get_conn()
    row = conn.execute(
        "SELECT transcript FROM sessions WHERE session_id = ? AND user_id = ?",
        (session_id, user_id),
    ).fetchone()
    if not row:
        conn.close()
        return
    transcript = json.loads(row["transcript"])
    transcript.append({"role": role, "content": content, "time": datetime.now().isoformat()})
    conn.execute(
        "UPDATE sessions SET transcript = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ?",
        (json.dumps(transcript, ensure_ascii=False), session_id, user_id),
    )
    conn.commit()
    conn.close()


def save_drill_answers(session_id: str, answers: list[dict], *, user_id: str):
    """将专项训练答案保存为 Q&A 对到 transcript"""
    conn = _get_conn()
    row = conn.execute(
        "SELECT questions FROM sessions WHERE session_id = ? AND user_id = ?",
        (session_id, user_id),
    ).fetchone()
    if not row:
        conn.close()
        return
    questions = json.loads(row["questions"])
    answer_map = {a["question_id"]: a["answer"] for a in answers}

    transcript = []
    for q in questions:
        transcript.append({"role": "assistant", "content": q["question"], "time": datetime.now().isoformat()})
        answer = answer_map.get(q["id"], "")
        if answer:
            transcript.append({"role": "user", "content": answer, "time": datetime.now().isoformat()})

    conn.execute(
        "UPDATE sessions SET transcript = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id = ?",
        (json.dumps(transcript, ensure_ascii=False), session_id, user_id),
    )
    conn.commit()
    conn.close()


def save_review(session_id: str, review: str, scores: list = None,
                weak_points: list = None, overall: dict = None, *, user_id: str):
    conn = _get_conn()
    conn.execute(
        "UPDATE sessions SET review = ?, scores = ?, weak_points = ?, overall = ?, updated_at = CURRENT_TIMESTAMP "
        "WHERE session_id = ? AND user_id = ?",
        (review, json.dumps(scores or [], ensure_ascii=False),
         json.dumps(weak_points or [], ensure_ascii=False),
         json.dumps(overall or {}, ensure_ascii=False),
         session_id, user_id),
    )
    conn.commit()
    conn.close()


def get_session(session_id: str, *, user_id: str) -> dict | None:
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM sessions WHERE session_id = ? AND user_id = ?",
        (session_id, user_id),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return _row_to_dict(row)


def list_sessions_by_topic(topic: str, *, user_id: str, limit: int = 50) -> list[dict]:
    """获取话题的所有已完成会话（含评估和分数）"""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT session_id, mode, topic, review, scores, created_at FROM sessions "
        "WHERE topic = ? AND user_id = ? AND review IS NOT NULL "
        "AND (status = 'completed' OR status IS NULL) ORDER BY created_at ASC LIMIT ?",
        (topic, user_id, limit),
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        results.append({
            "session_id": r["session_id"],
            "review": r["review"],
            "scores": json.loads(r["scores"]) if r["scores"] else [],
            "created_at": r["created_at"],
        })
    return results


def list_sessions(
    *, user_id: str,
    limit: int = 20,
    offset: int = 0,
    mode: str | None = None,
    topic: str | None = None,
) -> dict:
    """列出已完成的会话（history），不含 active/abandoned"""
    conn = _get_conn()

    where = ["review IS NOT NULL", "user_id = ?", "(status = 'completed' OR status IS NULL)"]
    params: list = [user_id]
    if mode:
        where.append("mode = ?")
        params.append(mode)
    if topic:
        where.append("topic = ?")
        params.append(topic)
    where_sql = " AND ".join(where)

    total = conn.execute(
        f"SELECT COUNT(*) FROM sessions WHERE {where_sql}", params,
    ).fetchone()[0]

    rows = conn.execute(
        f"SELECT session_id, mode, topic, created_at, overall FROM sessions "
        f"WHERE {where_sql} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    conn.close()

    items = []
    for r in rows:
        overall = json.loads(r["overall"] or "{}")
        items.append({
            "session_id": r["session_id"],
            "mode": r["mode"],
            "topic": r["topic"],
            "created_at": r["created_at"],
            "avg_score": overall.get("avg_score"),
        })
    return {"items": items, "total": total}


def delete_session(session_id: str, *, user_id: str) -> bool:
    conn = _get_conn()
    cursor = conn.execute(
        "DELETE FROM sessions WHERE session_id = ? AND user_id = ?",
        (session_id, user_id),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def list_distinct_topics(*, user_id: str) -> list[str]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT DISTINCT topic FROM sessions "
        "WHERE topic IS NOT NULL AND review IS NOT NULL AND user_id = ? "
        "AND (status = 'completed' OR status IS NULL) ORDER BY topic",
        (user_id,),
    ).fetchall()
    conn.close()
    return [r["topic"] for r in rows]


# ── 会话生命周期管理 ──

def get_active_session_by_mode(mode: str, *, user_id: str) -> dict | None:
    """获取指定模式下的进行中会话（每种模式最多 1 个）"""
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM sessions WHERE mode = ? AND user_id = ? AND status = 'active' "
        "ORDER BY created_at DESC LIMIT 1",
        (mode, user_id),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return _row_to_dict(row)


def list_active_sessions(*, user_id: str) -> list[dict]:
    """获取当前用户所有进行中会话（供首页展示）"""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT session_id, mode, topic, status, created_at, last_activity_at, progress_payload "
        "FROM sessions WHERE user_id = ? AND status = 'active' ORDER BY last_activity_at DESC",
        (user_id,),
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        item = dict(r)
        item["progress_payload"] = json.loads(item.get("progress_payload") or "{}")
        results.append(item)
    return results


def abandon_session(session_id: str, *, user_id: str) -> bool:
    """将进行中会话标记为 abandoned"""
    now = datetime.now().isoformat()
    conn = _get_conn()
    cursor = conn.execute(
        "UPDATE sessions SET status = 'abandoned', completed_at = ?, updated_at = CURRENT_TIMESTAMP "
        "WHERE session_id = ? AND user_id = ? AND status = 'active'",
        (now, session_id, user_id),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def complete_session(session_id: str, *, user_id: str) -> bool:
    """将进行中会话标记为 completed"""
    now = datetime.now().isoformat()
    conn = _get_conn()
    cursor = conn.execute(
        "UPDATE sessions SET status = 'completed', completed_at = ?, updated_at = CURRENT_TIMESTAMP "
        "WHERE session_id = ? AND user_id = ?",
        (now, session_id, user_id),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def update_progress(session_id: str, payload: dict, *, user_id: str):
    """更新进行中会话的进度快照（topic_drill 模式每次答题后调用）"""
    now = datetime.now().isoformat()
    conn = _get_conn()
    conn.execute(
        "UPDATE sessions SET progress_payload = ?, last_activity_at = ?, updated_at = CURRENT_TIMESTAMP "
        "WHERE session_id = ? AND user_id = ? AND status = 'active'",
        (json.dumps(payload, ensure_ascii=False), now, session_id, user_id),
    )
    conn.commit()
    conn.close()


def touch_activity(session_id: str, *, user_id: str):
    """更新会话最后活跃时间（resume 模式每次 chat 后调用）"""
    now = datetime.now().isoformat()
    conn = _get_conn()
    conn.execute(
        "UPDATE sessions SET last_activity_at = ?, updated_at = CURRENT_TIMESTAMP "
        "WHERE session_id = ? AND user_id = ?",
        (now, session_id, user_id),
    )
    conn.commit()
    conn.close()


def _row_to_dict(row) -> dict:
    """将 sqlite3.Row 转为 dict 并反序列化 JSON 列"""
    result = dict(row)
    for col in ("transcript", "questions", "scores", "weak_points"):
        if col in result:
            result[col] = json.loads(result.get(col) or "[]")
    for col in ("overall", "progress_payload"):
        if col in result:
            result[col] = json.loads(result.get(col) or "{}")
    return result
