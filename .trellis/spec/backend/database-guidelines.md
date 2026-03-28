# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

本项目使用**原生 sqlite3**，**无 ORM**（无 SQLAlchemy、无 Tortoise-ORM）。所有 SQL 均手写。两个数据库用途：

1. `data/interviews.db` — 结构化数据（`users` 表 + `sessions` 表）
2. LlamaIndex 向量索引 — 存储在各用户的 `.index_cache/` 目录（不是 SQLite 直接管理）

---

## Connection Pattern

每个数据库操作函数自己获取连接，用完即关闭（**短连接模式，不复用连接对象**）：

```python
# backend/storage/sessions.py 和 backend/auth.py 均使用此模式
def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # 必须设置，允许按列名访问
    return conn

def some_operation(...):
    conn = _get_conn()
    # ... 操作 ...
    conn.commit()  # 写操作必须 commit
    conn.close()   # 必须关闭
```

**反模式**：不要在模块级保持一个全局连接对象。

---

## Query Patterns

**参数化查询（必须）**，防止 SQL 注入：

```python
# 正确：使用占位符 ?
conn.execute(
    "SELECT * FROM sessions WHERE session_id = ? AND user_id = ?",
    (session_id, user_id),
)

# 错误：字符串拼接
conn.execute(f"SELECT * FROM sessions WHERE session_id = '{session_id}'")  # 禁止！
```

**JSON 列**：sessions 表中多个列存储 JSON 字符串（transcript、scores、weak_points 等），读写时显式序列化：

```python
# 写入
conn.execute("INSERT INTO sessions (..., transcript) VALUES (..., ?)",
             (..., json.dumps(data, ensure_ascii=False)))

# 读取
transcript = json.loads(row["transcript"] or "[]")
```

**Row Factory 访问**：通过列名访问，不用数字索引：

```python
row = conn.execute("SELECT id, email FROM users WHERE email = ?", (email,)).fetchone()
user_id = row["id"]   # 正确
user_id = row[0]      # 避免
```

---

## Migrations

本项目使用**轻量级 inline 迁移**，不使用 Alembic 等迁移工具：

**表初始化**：`CREATE TABLE IF NOT EXISTS`，在服务启动时（`@app.on_event("startup")`）调用：

```python
# backend/storage/sessions.py
conn.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        ...
    )
""")
```

**增量列迁移**：检测列是否存在，不存在则 ALTER TABLE：

```python
# backend/storage/sessions.py _get_conn() 中
for col, default in [("questions", "'[]'"), ("overall", "'{}'"), ("user_id", "NULL")]:
    try:
        conn.execute(f"SELECT {col} FROM sessions LIMIT 1")
    except sqlite3.OperationalError:
        conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} TEXT DEFAULT {default}")
conn.commit()
```

**跨版本大迁移**：使用独立的 `backend/migrate.py` 脚本手动运行（`python -m backend.migrate`）。

---

## Naming Conventions

- **表名**：`snake_case` 复数（`users`、`sessions`、`memory_entries`）
- **列名**：`snake_case`（`session_id`、`created_at`、`user_id`）
- **主键**：TEXT 类型的 UUID 字符串（`str(uuid.uuid4())`），不用自增整数
- **时间列**：TEXT 类型存储 ISO 格式字符串（`DEFAULT CURRENT_TIMESTAMP` 或 Python `datetime.now().isoformat()`）
- **外键**：约定命名 `{table_singular}_id`（如