# GitHub Project Analysis Backend Spec

> GitHub 连接、已授权仓库发现、范围候选、分析编排 V2 的可执行后端契约。

---

## 场景 1：GitHub 连接与授权回调

### 1. Scope / Trigger

- 触发条件：用户要从 MemCoach 内直接选择自己已授权的 GitHub 公开仓库，而不是手填 URL。
- 涉及边界：
  - 前端页面发起授权跳转
  - GitHub 回调落到后端
  - 后端持久化用户连接与 token
  - 后续仓库列表、分支列表、范围候选都依赖这份连接状态

### 2. Signatures

#### API

- `POST /api/github/connection/start`
- `GET /api/github/connection/status`
- `DELETE /api/github/connection`
- `GET /api/github/connection/callback`

#### Storage

- 表：`github_connections`
- 主键：`user_id`

#### Service

- `create_github_connect_session(user_id, redirect_path="/project-analysis")`
- `handle_github_callback(code, state, installation_id, setup_action, error, error_description)`
- `get_valid_github_access_token(user_id)`

### 3. Contracts

#### `POST /api/github/connection/start`

请求：

```json
{
  "redirect_path": "/project-analysis"
}
```

响应：

```json
{
  "state": "<signed-state-token>",
  "authorize_url": "https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&state=..."
}
```

#### `GET /api/github/connection/status`

响应：

```json
{
  "configured": true,
  "connected": true,
  "status": "connected",
  "github_login": "octocat",
  "github_name": "The Octocat",
  "github_avatar_url": "https://...",
  "installation_id": 456,
  "installations": [
    {
      "id": 456,
      "target_type": "User",
      "account_login": "octocat",
      "account_type": "User"
    }
  ],
  "connected_at": "2026-04-08 12:00:00",
  "updated_at": "2026-04-08 12:00:00",
  "access_token_expires_at": "2026-04-08T20:00:00+00:00"
}
```

#### `DELETE /api/github/connection`

- 返回值结构与 `status` 相同
- 必须清空 `access_token` / `refresh_token`
- `status` 必须变为 `disconnected`

#### `GET /api/github/connection/callback`

- 这是浏览器跳转入口，不返回 JSON
- 成功后 302 跳回：

```text
{frontend_app_url}/project-analysis?github_connected=1&github_login=<login>&setup_action=<setup_action>
```

- 失败后 302 跳回：

```text
{frontend_app_url}/project-analysis?github_connected=0&error_code=<code>&error_message=<message>
```

- `error_code` 和 `error_message` 必须通过 `urlencode` 生成，不能手写拼接 query string。

### 4. Validation & Error Matrix

| 场景 | 行为 | HTTP / 跳回 |
|------|------|-------------|
| GitHub 配置缺失 | 不生成授权地址 | `503` |
| `state` 缺失/过期/伪造 | 拒绝连接 | callback 跳回 `github_connected=0&error_code=github_invalid_state` |
| callback 缺少 `code` | 拒绝连接 | callback 跳回 `github_connected=0&error_code=github_missing_code` |
| access token 过期且无法刷新 | 视为连接失效 | `401` |
| 用户未连接 GitHub 就查仓库 | 拒绝操作 | `409` |

### 5. Good / Base / Bad Cases

#### Good

- 已配置 GitHub App
- 用户点击“连接 GitHub”
- callback 成功
- `github_connections` 中保存了 `github_login`、`installation_id`、token 与过期时间

#### Base

- 用户已连接，但 `installations` 为空
- `status` 仍返回 `connected=true`
- 仓库列表接口返回空数组，不报 500

#### Bad

- 前端自行伪造 GitHub 已连接状态，不查 `/status`
- callback 直接返回 JSON 给浏览器，导致页面停在后端地址
- 断连时只改 `status`，不清掉 token

### 6. Tests Required

- `backend/tests/test_github_connection.py`
  - `test_create_connect_url_contains_required_query`
  - `test_handle_callback_persists_connection`
  - `test_get_valid_access_token_refreshes_expired_token`
  - `test_disconnect_clears_tokens`
  - `test_callback_error_redirect_preserves_full_error_message`

### 7. Wrong vs Correct

#### Wrong

```python
# 手写 query string，错误消息中的 & 会破坏 callback 参数
redirect_url = f"{frontend_url}/project-analysis?github_connected=0&error_code={code}&error_message={message}"
```

#### Correct

```python
redirect_url = (
    f"{frontend_url}/project-analysis?"
    f"{urlencode({'github_connected': '0', 'error_code': code, 'error_message': message})}"
)
```

---

## 场景 2：已授权公开仓库发现与范围候选

### 1. Scope / Trigger

- 触发条件：用户已经连接 GitHub，需要在产品内直接选择仓库、分支和负责范围。
- 目标：后端输出“公开仓库列表 / 默认分支与分支列表 / 目录优先+文件补充的范围候选”。

### 2. Signatures

- `GET /api/github/repositories?query=&page=&per_page=`
- `GET /api/github/repositories/{owner}/{repo}/branches`
- `GET /api/github/repositories/{owner}/{repo}/scope-candidates?branch=main`

### 3. Contracts

#### 仓库列表

响应：

```json
{
  "items": [
    {
      "id": 1,
      "name": "MemCoach",
      "full_name": "octocat/MemCoach",
      "description": "demo",
      "html_url": "https://github.com/octocat/MemCoach",
      "default_branch": "main",
      "updated_at": "2026-04-08T12:00:00Z",
      "installation_id": 456
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 20
}
```

规则：

- 只返回 `private=false` 的仓库
- 服务端统一做搜索与分页
- 默认按 `updated_at DESC` 排序

#### 分支列表

响应：

```json
{
  "repo": {
    "name": "MemCoach",
    "full_name": "octocat/MemCoach",
    "default_branch": "main",
    "html_url": "https://github.com/octocat/MemCoach",
    "description": "demo"
  },
  "default_branch": "main",
  "branches": [
    {
      "name": "main",
      "commit_sha": "abc1234",
      "is_default": true
    }
  ]
}
```

#### 范围候选

响应：

```json
{
  "repo": {
    "name": "MemCoach",
    "full_name": "octocat/MemCoach"
  },
  "branch": "main",
  "commit_sha": "abc1234",
  "recommended_directories": [
    {
      "path": "backend",
      "reason": "目录下包含 12 个可分析文件，适合作为负责范围主选择。",
      "file_count": 12
    }
  ],
  "important_files": [
    {
      "path": "README.md",
      "reason": "README 用于快速理解仓库目标与模块入口。",
      "snippet": "# MemCoach"
    }
  ],
  "tree": [
    {
      "path": "backend/main.py",
      "name": "main.py",
      "type": "blob",
      "parent_path": "backend",
      "depth": 2,
      "size": 1234
    }
  ],
  "tree_summary": {
    "files": 100,
    "directories": 20,
    "entries": 120
  }
}
```

### 4. Validation & Error Matrix

| 场景 | 行为 |
|------|------|
| 用户未连接 GitHub | `409` |
| GitHub token 过期且刷新失败 | `401` |
| 仓库/分支不存在 | `400` |
| 仓库树响应格式异常 | `400` |
| repo 列表中出现私有仓库 | 服务端必须过滤掉，不能下发给前端 |

### 5. Good / Base / Bad Cases

#### Good

- 一个安装下有多个公开仓库
- 搜索 `mem` 后只返回匹配项
- 默认分支可直接用于下一步范围发现

#### Base

- 没有任何公开仓库
- 返回空数组和 `total=0`

#### Bad

- 前端自己排序、自己过滤私有仓库
- 范围候选只返回推荐目录，不返回原始 `tree`
- 前端在没拿到 `commit_sha` 的情况下直接创建分析任务

### 6. Tests Required

- `backend/tests/test_github_repo_selection.py`
  - `test_list_authorized_public_repositories_filters_and_paginates`
  - `test_build_scope_candidates_returns_recommended_directories`

### 7. Wrong vs Correct

#### Wrong

```python
# 直接把 GitHub 原始 payload 整包返回前端
return github_payload
```

#### Correct

```python
return {
    "items": normalized_items,
    "total": len(normalized_items),
    "page": page,
    "per_page": per_page,
}
```

---

## 场景 3：项目分析编排 V2

### 1. Scope / Trigger

- 触发条件：分析任务不再由 `repo_url + 手填 owned_scopes` 驱动，而是由仓库快照和用户确认后的范围快照驱动。

### 2. Signatures

- `POST /api/project-analysis`
- `create_analysis_job(repo_url="", repo_snapshot=None, user_id, branch, role_summary, owned_scopes=None, selected_scope_snapshot=None)`
- 存储字段：
  - `repo_source_json`
  - `selected_scope_snapshot_json`

### 3. Contracts

创建请求兼容两种输入：

#### 旧输入（兼容迁移期）

```json
{
  "repo_url": "https://github.com/octocat/MemCoach",
  "branch": "main",
  "role_summary": "后端负责人",
  "owned_scopes": ["backend", "storage"]
}
```

#### 新输入（正式路径）

```json
{
  "repo_snapshot": {
    "provider": "github",
    "owner": "octocat",
    "repo": "MemCoach",
    "full_name": "octocat/MemCoach",
    "html_url": "https://github.com/octocat/MemCoach",
    "installation_id": 456
  },
  "branch": "main",
  "role_summary": "后端负责人",
  "selected_scope_snapshot": [
    { "path": "backend", "type": "directory" },
    { "path": "frontend/src/pages/ProjectAnalysis.jsx", "type": "file" }
  ]
}
```

返回任务公共视图时，必须带回：

```json
{
  "analysis_id": "abc123",
  "repo_source": {
    "provider": "github",
    "owner": "octocat",
    "repo": "MemCoach",
    "full_name": "octocat/MemCoach",
    "html_url": "https://github.com/octocat/MemCoach",
    "installation_id": 456
  },
  "selected_scope_snapshot": [
    { "path": "backend", "type": "directory" }
  ]
}
```

### 4. Validation & Error Matrix

| 场景 | 行为 |
|------|------|
| `repo_snapshot` 缺少 `owner/repo` | `AnalysisPipelineError("invalid_repo_snapshot")` |
| `selected_scope_snapshot` 为空，但旧 `owned_scopes` 存在 | 允许，用旧字段兜底 |
| `selected_scope_snapshot` 有重复 path | 服务端去重 |
| `selected_scope_snapshot.type` 非 `directory/file` | 归一化为 `directory` |
| 用户已绑定 GitHub 仓库 | `fetch_repo_info / resolve_branch_commit / download_commit_archive` 必须优先使用 `get_valid_github_access_token(user_id)` 返回的用户 token |
| 新主路径缺少可用 GitHub token | 直接报连接相关错误，不允许回退到匿名 GitHub API |

### 5. Good / Base / Bad Cases

#### Good

- 新输入包含 `repo_snapshot + selected_scope_snapshot`
- 存储层完整保留 repo 与 scope 快照
- `owned_scopes` 由快照路径派生，保证旧结果构建逻辑仍可运行
- 创建分析与后台下载阶段都复用用户 GitHub token，避免仓库已选成功但任务创建/下载阶段被匿名限流

#### Base

- 旧前端还在发 `repo_url + owned_scopes`
- 后端继续兼容

#### Bad

- 新旧输入契约并存时只改 route，不改 storage
- 结果页只看 `result.metadata`，却拿不到用户确认范围

### 6. Tests Required

- `backend/tests/test_project_analysis_storage.py`
  - `test_create_and_get_project_analysis`
- `backend/tests/test_project_analysis_pipeline.py`
  - `test_create_analysis_job_supports_repo_snapshot`
  - `test_create_and_run_analysis_job_reaches_completed_with_user_token`
  - `test_detect_repo_root_handles_resolved_path_mismatch`

### 7. Wrong vs Correct

#### Wrong

```python
# 已连接 GitHub，但分析创建和后台下载仍然走匿名 GitHub API
repo_info = fetch_repo_info(repo_ref)
commit_sha = resolve_branch_commit(repo_ref, branch)
archive_path = download_commit_archive(repo_ref, commit_sha, output_dir)
```

#### Correct

```python
token = get_valid_github_access_token(user_id)
repo_info = fetch_repo_info(repo_ref, token=token)
commit_sha = resolve_branch_commit(repo_ref, branch, token=token)
archive_path = download_commit_archive(repo_ref, commit_sha, output_dir, token=token)
```
