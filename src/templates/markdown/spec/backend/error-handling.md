# Error Handling

> How errors are handled in this project.

---

## Overview

本项目使用 **FastAPI HTTPException** 作为唯一的错误响应机制。无自定义异常类层级，直接在业务逻辑中抛出 `HTTPException`。LangGraph/LLM 调用错误通过 try-except 捕获后记录日志，非必要不向前端暴露内部细节。

---

## Error Types

本项目**无自定义异常类**，统一使用 FastAPI 内置：

```python
from fastapi import HTTPException

# 401 - 认证失败（auth.py 中使用）
raise HTTPException(401, "Invalid or expired token")
raise HTTPException(401, "Invalid email or password")

# 404 - 资源不存在（main.py 中使用）
raise HTTPException(404, "Session not found")

# 400 - 请求无效
raise HTTPException(400, "Registration is disabled")

# 500 - 服务器内部错误（少数情况）
raise HTTPException(500, "Internal server error")
```

---

## Error Handling Patterns

**API 端点**：直接抛出 HTTPException，不捕获后再包装：

```python
# backend/main.py — 典型模式
@router.post("/auth/login")
def login(req: LoginRequest):
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(401, "Invalid email or password")
    token = create_token(user["id"])
    return {"token": token, "user": user}
```

**LLM/外部调用**：在后台任务或流式处理中 try-except，记录日志后让上层处理或静默失败：

```python
# backend/memory.py 中的模式
try:
    result = llm.invoke([...])
except Exception as e:
    logger.error(f"LLM call failed: {e}")
    return None  # 或 return default_value
```

**数据库操作**：不捕获 sqlite3 异常，让其自然向上传播到 FastAPI 全局异常处理器（返回 500）。仅在需要区分「列不存在」这类可预期错误时捕获：

```python
# backend/storage/sessions.py — 迁移检测
try:
    conn.execute(f"SELECT {col} FROM sessions LIMIT 1")
except sqlite3.OperationalError:
    conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} TEXT DEFAULT {default}")
```

**JWT 验证**：捕获 `JWTError` 转换为 401：

```python
# backend/auth.py
try:
    payload = jwt.decode(cred.credentials, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
except JWTError:
    raise HTTPException(401, "Invalid or expired token")
```

**长任务 / 异步分析任务**：必须返回稳定状态与错误码，而不是只返回自由文本：

```python
return {
    "analysis_id": analysis_id,
    "status": "failed",
    "error_code": "github_rate_limited",
    "error_message": "GitHub API 限流，请稍后重试。",
}
```

如果前端暴露了这些动作，后端也必须成对提供：
- `POST create`
- `GET status`
- `GET result`
- `POST cancel`

---

## API Error Responses

FastAPI 默认错误格式，无自定义包装：

```json
{"detail": "Invalid email or password"}
```

前端 `interview.js` 中通过 HTTP 状态码判断：
- `401` → 自动跳转 `/login`（`authFetch` 中处理）
- 其他非 2xx → `throw new Error(await res.text())`，由页面组件 `alert()` 展示

对于长任务类接口，推荐进一步约定：
- `404`：任务不存在
- `409`：任务未完成，不允许读取 result
- `400`：输入非法（如 repo_url / branch / owned_scopes）
- `status` 与 `error_code` 优先于自由文本作为前端状态机依据

---

## Common Mistakes

- **不要**在每个 SQLite 操作都加 try-except，让错误自然传播
- **不要**在错误消息中暴露内部路径、堆栈或数据库 schema 细节
- **不要**创建自定义异常类——项目规模不需要，直接用 HTTPException
- **不要**在 `get_current_user` 之外重复实现 JWT 验证逻辑
- **不要**让前端依赖“猜出来”的错误文本驱动长任务状态机
- **不要**把运行中状态和最终结果混到同一个语义不清的接口里
