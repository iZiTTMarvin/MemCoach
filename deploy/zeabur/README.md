# Zeabur 部署说明

本项目已经补齐了 Zeabur 的前后端分离部署入口，同时保留了本地 Docker 部署链路。

## 部署拓扑

- `frontend`：公开服务，对外提供 SPA 页面，并通过 Nginx 反向代理 `/api` 到后端。
- `backend`：FastAPI 服务，负责业务 API、鉴权、GitHub OAuth 回调与数据读写。

为了让根目录下的 `Dockerfile.frontend` / `Dockerfile.backend` 与 `zbpack.frontend.json` / `zbpack.backend.json` 自动生效，**建议 Zeabur 中的两个服务名称固定为 `frontend` 与 `backend`**。

如果你坚持使用别的服务名，需要在 Zeabur 服务环境变量中显式设置：

- `ZBPACK_DOCKERFILE_NAME=frontend`
- `ZBPACK_DOCKERFILE_NAME=backend`

## 后端服务配置

后端服务使用根目录的 `Dockerfile.backend`。

项目中的 embeddings 默认使用 **硅基流动 SiliconFlow 的 `BAAI/bge-m3`**：

- Base URL: `https://api.siliconflow.cn/v1`
- Model ID: `BAAI/bge-m3`

SiliconFlow 官方文档：

- Chat Completions: `https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions`
- Embeddings: `https://docs.siliconflow.cn/cn/api-reference/embeddings/create-embeddings`

至少需要配置这些环境变量：

- `API_BASE`
- `API_KEY`
- `MODEL`
- `EMBEDDING_API_BASE` 或直接复用 `API_BASE`
- `EMBEDDING_API_KEY` 或直接复用 `API_KEY`
- `EMBEDDING_MODEL`
- `JWT_SECRET`
- `ALLOW_REGISTRATION`
- `REGISTRATION_ACCESS_CODE`

如需启用 GitHub OAuth / 项目分析，还需要：

- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_SLUG`
- `GITHUB_OAUTH_STATE_SECRET`
- `BACKEND_PUBLIC_URL`
- `FRONTEND_APP_URL`

如需启用录音转写，还需要：

- `DASHSCOPE_API_KEY`
- `QINIU_ACCESS_KEY`
- `QINIU_SECRET_KEY`
- `QINIU_BUCKET`
- `QINIU_DOMAIN`

## 前端服务配置

前端服务使用根目录的 `Dockerfile.frontend`。

前端容器在 Zeabur 上监听 `8080` 端口。

核心环境变量只有一个：

- `API_UPSTREAM`

它必须填写为 **Zeabur Networking 页面里 backend 服务显示的 Private Hostname + 端口**，例如：

```env
API_UPSTREAM=backend.zeabur.internal:8000
```

注意：这里的 `backend.zeabur.internal` 只是示例。请以 Zeabur 控制台 Networking 页面显示的实际主机名为准；端口也请以 backend 服务实际监听端口为准。当前这套部署配置里，backend 监听 `8000`，frontend 监听 `8080`。

## 数据持久化与现有账号保留

你的用户账号、密码哈希、面试记录、知识库索引都保存在 `/app/data` 下。

后端服务必须挂载 Volume 到：

```text
/app/data
```

如果你想保留当前本地数据库中已有的账号信息，例如 `xuhaochen0212@qq.com`，需要把本地这些内容导入到挂载后的 Volume：

- `data/interviews.db`
- `data/users/`

推荐步骤：

1. 在 Zeabur 为 `backend` 服务先挂载 Volume 到 `/app/data`
2. 挂载完成后，再把本地 `data/interviews.db` 与 `data/users/` 上传/导入到该 Volume
3. 最后再启动或重启后端服务

注意：Zeabur 在挂载 Volume 时会清空目标目录原有内容，所以一定要先备份，再导入数据。

## 为什么现在算“前后端分离”

现在的部署方式已经是两个独立服务：

- 前端单独构建和运行
- 后端单独构建和运行
- 浏览器始终访问前端域名
- 前端容器内部再通过 Zeabur 私网把 `/api` 转发给后端

这样做的好处：

- 前端代码不需要改成硬编码后端公网地址
- 浏览器仍然走同源 `/api`
- 本地 Docker 与 Zeabur 线上共用一套前端请求路径
- 后端可以只暴露给前端私网访问；如果需要 GitHub OAuth 回调，再额外给后端绑定公网域名

## 对应示例文件

- `deploy/zeabur/backend.env.example`
- `deploy/zeabur/frontend.env.example`
- `deploy/zeabur/AI_PROMPT.zh-CN.md`
