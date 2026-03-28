# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

MemCoach 后端为**个人毕业设计项目**，质量标准聚焦于：可读性、安全性、与现有模式一致性。无正式 CI/CD，无单元测试要求，手动测试为主。

---

## Forbidden Patterns

**安全类（严格禁止）：**
- SQL 字符串拼接（必须用参数化查询 `?` 占位符）
- 在日志/响应中暴露 JWT secret、API key、用户密码
- 直接将未验证的用户输入拼接到文件路径（路径穿越风险）
- 跳过 `get_current_user` 依赖直接访问用户数据

**架构类（避免）：**
- 在模块级保持全局 SQLite 连接对象（用短连接模式）
- 在 `graphs/` 以外的地方实例化 LangGraph 状态机
- 在 `main.py` 以外定义 API 路由（保持路由集中）
- 为一次性操作创建抽象类/基类
- 在 `config.py` 之外硬编码配置值（路径、密钥、模型名）

**代码风格类（避免）：**
- `print()` 调试语句提交到代码库
- 超过 120 字符的单行代码
- 未使用的 import

---

## Required Patterns

**认证**：所有需要用户隔离的端点必须注入 `user_id`：

```python
# 正确：通过依赖注入获取 user_id
@router.get("/sessions")
def list_sessions_endpoint(user_id: str = Depends(get_current_user)):
    return list_sessions(user_id=user_id)

# 错误：硬编码或从请求体读取 user_id
@router.get("/sessions")
def list_sessions_endpoint(req: SomeRequest):
    return list_sessions(user_id=req.user_id)  # 禁止！
```

**配置访问**：统一从 `settings` 单例读取，不直接读 `os.environ`：

```python
from backend.config import settings
path = settings.user_data_dir(user_id)  # 正确
path = os.environ.get("DATA_DIR")       # 避免
```

**LangGraph 节点绑定 user_id**：用工厂函数闭包而非全局变量传递 user_id：

```python
# backend/graphs/resume_interview.py 模式
def _make_init_interview(user_id: str):
    def init_interview(state: ResumeInterviewState) -> dict:
        resume_ctx = query_resume("...", user_id)  # user_id 通过闭包传入
        ...
    return init_interview
```

**Pydantic 模型**：API 请求体用 Pydantic BaseModel，LangGraph 状态用 TypedDict，不混用：

```python
# API 请求体 — Pydantic (backend/models.py)
class ChatRequest(BaseModel):
    session_id: str
    message: str

# LangGraph 状态 — TypedDict (backend/models.py)
class ResumeInterviewState(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    phase: str
```

---

## Testing Requirements

本项目为个人项目，无自动化测试套件。质量保障方式：

- **手动测试**：修改 API 后用 curl 或前端页面验证
- **启动检查**：`uvicorn backend.main:app --reload` 无报错
- **关键路径**：每次修改后验证登录流程和面试流程可正常运行
- **无需**编写单元测试或集成测试（除非功能极其核心且易出错）

---

## Code Review Checklist

（自查清单，提交前过一遍）

- [ ] 所有 SQL 使用参数化查询（无字符串拼接）
- [ ] 新增端点有 `user_id: str = Depends(get_current_user)` 注入（如需隔离）
- [ ] 无硬编码路径/密钥，均从 `settings` 读取
- [ ] SQLite 连接在函数结束时 `conn.close()`
- [ ] JSON 列读写显式用 `json.dumps` / `json.loads`
- [ ] 无 `print()` 调试语句
- [ ] 新模块中 `logger = logging.getLogger("uvicorn")`
- [ ] LangGraph 节点通过闭包/工厂函数绑定 user_id，而非全局变量
