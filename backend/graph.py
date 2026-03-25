"""题目关联图谱 — 从历史 drill 题目构建语义相似度图。"""
import hashlib
import json
import sqlite3
from datetime import datetime

import numpy as np

from backend.config import settings
from backend.vector_memory import _embed, _serialize, _deserialize, _cosine_similarity

DB_PATH = settings.db_path
SIMILARITY_THRESHOLD = 0.65


def _get_conn() -> sqlite3.Connection:
    """获取数据库连接，确保目录存在"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init_question_embeddings_table(conn: sqlite3.Connection):
    """初始化题目向量表，包含 user_id 字段迁移"""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS question_embeddings (
            question_hash TEXT PRIMARY KEY,
            topic         TEXT,
            question_text TEXT,
            embedding     BLOB NOT NULL,
            user_id       TEXT,
            created_at    TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # 迁移：为旧表添加 user_id 列
    try:
        conn.execute("SELECT user_id FROM question_embeddings LIMIT 1")
    except sqlite3.OperationalError:
        conn.execute("ALTER TABLE question_embeddings ADD COLUMN user_id TEXT")
    conn.commit()


def _hash_question(text: str) -> str:
    """计算题目文本的 MD5 哈希"""
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def _extract_questions(conn: sqlite3.Connection, topic: str, user_id: str) -> list[dict]:
    """从已完成的历史 drill 会话中提取带分数的题目，按题目文本去重"""
    rows = conn.execute(
        "SELECT session_id, questions, scores, created_at FROM sessions "
        "WHERE topic = ? AND user_id = ? AND mode = 'topic_drill' AND review IS NOT NULL "
        "ORDER BY created_at ASC",
        (topic, user_id),
    ).fetchall()

    # question_text → 最新记录（去重，保留最后出现）
    seen: dict[str, dict] = {}
    for row in rows:
        questions = json.loads(row["questions"] or "[]")
        scores = json.loads(row["scores"] or "[]")
        score_map = {s["question_id"]: s for s in scores if "question_id" in s}

        for q in questions:
            text = q.get("question", "").strip()
            if not text:
                continue
            qid = q.get("id")
            sc = score_map.get(qid, {})
            score_val = sc.get("score")
            # 仅包含有实际分数的已答题目
            if not isinstance(score_val, (int, float)):
                continue

            seen[text] = {
                "question": text,
                "score": score_val,
                "focus_area": q.get("focus_area", ""),
                "difficulty": q.get("difficulty", 3),
                "date": row["created_at"][:10] if row["created_at"] else "",
                "session_id": row["session_id"],
            }

    return list(seen.values())


def _get_or_compute_embeddings(
    conn: sqlite3.Connection,
    questions: list[dict],
    topic: str,
) -> np.ndarray:
    """返回 (N, 1024) 向量矩阵，优先使用缓存，缺失则批量计算"""
    _init_question_embeddings_table(conn)

    hashes = [_hash_question(q["question"]) for q in questions]

    # 加载缓存
    cached: dict[str, np.ndarray] = {}
    if hashes:
        placeholders = ",".join("?" for _ in hashes)
        rows = conn.execute(
            f"SELECT question_hash, embedding FROM question_embeddings WHERE question_hash IN ({placeholders})",
            hashes,
        ).fetchall()
        for r in rows:
            cached[r["question_hash"]] = _deserialize(r["embedding"])

    # 查找缺失的向量
    to_embed = []
    to_embed_idx = []
    for i, (h, q) in enumerate(zip(hashes, questions)):
        if h not in cached:
            to_embed.append(q["question"])
            to_embed_idx.append(i)

    # 批量计算缺失向量
    if to_embed:
        from backend.llm_provider import get_embedding
        embed_model = get_embedding()
        vectors = embed_model.get_text_embedding_batch(to_embed)
        now = datetime.now().isoformat()
        for text, vec, idx in zip(to_embed, vectors, to_embed_idx):
            vec_np = np.array(vec, dtype=np.float32)
            h = hashes[idx]
            cached[h] = vec_np
            conn.execute(
                "INSERT OR REPLACE INTO question_embeddings (question_hash, topic, question_text, embedding, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (h, topic, text, _serialize(vec_np), now),
            )
        conn.commit()

    # 按顺序构建矩阵
    matrix = np.stack([cached[h] for h in hashes])
    return matrix


def build_graph(topic: str, user_id: str) -> dict:
    """构建题目关联图谱，返回 {nodes, links}

    - nodes: 题目节点（含 id、question、score、focus_area、difficulty、date）
    - links: 相似度超过阈值的题目对（source、target、similarity）
    """
    conn = _get_conn()
    questions = _extract_questions(conn, topic, user_id)

    if len(questions) < 2:
        conn.close()
        return {
            "nodes": [
                {"id": i, **q} for i, q in enumerate(questions)
            ],
            "links": [],
        }

    embeddings = _get_or_compute_embeddings(conn, questions, topic)
    conn.close()

    # Build nodes
    nodes = []
    for i, q in enumerate(questions):
        nodes.append({
            "id": i,
            "question": q["question"],
            "score": q["score"],
            "focus_area": q["focus_area"],
            "difficulty": q["difficulty"],
            "date": q["date"],
        })

    # Compute pairwise similarity → links
    links = []
    n = len(questions)
    for i in range(n):
        for j in range(i + 1, n):
            sim = float(_cosine_similarity(embeddings[i], embeddings[j].reshape(1, -1))[0])
            if sim >= SIMILARITY_THRESHOLD:
                links.append({
                    "source": i,
                    "target": j,
                    "similarity": round(sim, 3),
                })

    return {"nodes": nodes, "links": links}
