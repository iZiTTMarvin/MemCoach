# Logging Guidelines

> How logging is done in this project.

---

## Overview

本项目使用 **Python 标准库 logging**，通过 uvicorn 的 logger 实例输出。无结构化日志框架（无 structlog、无 loguru）。每个模块在文件顶层获取同一个 logger：

```python
import logging
logger = logging.getLogger("uvicorn")
```

日志输出到控制台（uvicorn 默认行为），不写文件，不发送到外部日志服务。

---

## Log Levels

| 级别 | 使用场景 | 示例 |
|------|----------|------|
| `logger.info()` | 服务启动事件、模型加载完成、表初始化 | `"Pre-loading bge-m3 embedding model..."` |
| `logger.warning()` | 可恢复的异常、数据解析失败 | `"Failed to parse inline eval: ..."` |
| `logger.error()` | LLM 调用失败、外部服务不可用 | `"LLM call failed: {e}"` |
| `logger.debug()` | 目前项目中**基本不使用** | — |

---

## Structured Logging

本项目使用**非结构化纯文本日志**，格式为自由字符串：

```python
# backend/main.py startup
logger.info("Pre-loading bge-m3 embedding model...")
logger.info("Embedding model ready.")
logger.info("Database tables initialized.")

# backend/graphs/resume_interview.py
logger.warning(f"Failed to parse inline eval: {m.group(1)[:100]}")
```

**推荐格式**（保持与现有代码一致）：
- Info：动词短语描述事件，`"[模块] 动作完成/开始"`
- Warning/Error：包含失败原因和关键变量值，用 f-string

---

## What to Log

**应该记录：**
- 服务启动阶段的关键步骤（模型加载、表初始化）
- LLM/外部 API 调用失败（含错误信息摘要）
- JSON 解析失败（含原始内容前100字符）
- 数据库表迁移操作（ALTER TABLE 等不可逆操作）
- 长耗时后台任务的开始/完成

---

## What NOT to Log

**禁止记录：**
- 用户密码（明文或哈希）
- JWT 令牌内容
- `settings.jwt_secret`、`settings.api_key`、`settings.dashscope_api_key` 等密钥
- 用户的完整对话内容（transcript）——太大且含隐私
- 用户 email（注意 PII）
- SQLite 查询参数中的用户数据

---

## Anti-patterns

- **不要** `print()` 调试——用 `logger.info()` 或 `logger.debug()`
- **不要**在每个函数入口/出口都加日志——只记录有意义的事件
- **不要**用 `logging.getLogger(__name__)`——项目统一用 `logging.getLogger("uvicorn")`
