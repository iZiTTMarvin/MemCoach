# Directory Structure

> How backend code is organized in this project.

---

## Overview

MemCoach 后端采用**扁平模块结构**，所有核心模块直接位于 `backend/` 目录下。无分层子目录（无 services/、routes/ 等子目录），每个模块职责单一。

- API 入口和路由：`main.py`
- LangGraph 状态机：`graphs/` 子目录
- 系统提示词：`prompts/` 子目录
- 持久化：`storage/` 子目录

---

## Directory Layout

```
backend/
├── main.py                 # FastAPI 入口 + 所有 API 路由（40+ 端点，router prefix=/api）
├── auth.py                 # JWT 认证、用户表管理、bcrypt 密码哈希、get_current_user 依赖
├── config.py               # pydantic_settings BaseSettings，从 .env 读取，全局 settings 单例
├── models.py               # LangGraph 状态 TypedDict + API 请求 Pydantic 模型
├── memory.py               # 用户画像系统（profile.json 文件存储 + LLM 提取/更新）
├── vector_memory.py        # 向量记忆（SQLite + bge-m3 embeddings）
├── indexer.py              # 知识库索引（LlamaIndex，按用户隔离）
├── llm_provider.py         # LLM/Embedding 提供者工厂函数
├── spaced_repetition.py    # SM-2 间隔重复算法
├── transcribe.py           # 音频转文字（DashScope ASR）
├── migrate.py              # 旧版数据库迁移脚本
├── graph.py                # 通用 LangGraph 构建入口
├── graphs/
│   ├── resume_interview.py # 简历模拟面试状态机（LangGraph）
│   ├── topic_drill.py      # 专项训练 + 评分
│   └── review.py           # 面试回顾生成
├── prompts/
│   └── interviewer.py      # 系统提示词常量（RESUME_INTERVIEWER_SYSTEM 等）
└── storage/
    └── sessions.py         # 面试记录 SQLite 持久化（CRUD）
```

数据存储结构：
```
data/
├── interviews.db           # SQLite：users 表 + sessions 表
└── users/{user_id}/        # 用户数据完全隔离
    ├── profile/profile.json
    ├── resume/
    ├── knowledge/
    ├── high_freq/
    ├── topics.json
    └── .index_cache/       # LlamaIndex 向量索引缓存
```

---

## Module Organization

**新功能模块放置规则：**

- **新 API 端点**：直接添加到 `main.py` 的 `router` 上，不创建独立路由文件
- **新 LangGraph 状态机**：在 `graphs/` 下新建独立文件
- **新提示词**：添加到 `prompts/` 目录
- **新持久化层**：在 `storage/` 下新建文件，不与 `sessions.py` 混用
- **新工具函数**：直接放 `backend/` 根目录，不创建 utils 子包

---

## Naming Conventions

- **文件名**：`snake_case.py`（如 `vector_memory.py`、`spaced_repetition.py`）
- **函数名**：`snake_case`，内部私有函数加 `_` 前缀（如 `_get_conn()`、`_hash_password()`）
- **类名**：`PascalCase`（如 `ResumeInterviewState`、`Settings`）
- **常量**：`UPPER_SNAKE_CASE`（如 `JWT_ALGORITHM`、`HARD_MAX_PER_PHASE`）
- **模块级 logger**：每个模块 `logger = logging.getLogger("uvicorn")`

---

## Examples

- API 路由模式：`backend/main.py` 中 `@router.post("/auth/login")`
- 模块级私有函数：`backend/storage/sessions.py` 中 `_get_conn()`
- LangGraph 节点工厂（闭包绑定 user_id）：`backend/graphs/resume_interview.py` 中 `_make_init_interview(user_id)`
