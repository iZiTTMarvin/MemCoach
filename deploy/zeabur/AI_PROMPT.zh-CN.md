# Zeabur AI 部署提示词

把下面整段直接发给 Zeabur 内置 AI，用于部署当前仓库：

```text
请帮我把这个 GitHub 仓库部署为 2 个 Zeabur 服务，并严格按下面要求执行，不要省略任何环境变量，也不要尝试把项目部署成单服务。

项目要求：
1. 创建两个服务，服务名固定为：
   - backend
   - frontend
2. backend 使用仓库根目录的 Dockerfile.backend
3. frontend 使用仓库根目录的 Dockerfile.frontend
4. backend 必须挂载持久卷到 /app/data
5. frontend 通过 Nginx 反向代理 /api 到 backend 的 Zeabur Private Hostname:8000
6. 不要使用 docker-compose.yml 作为线上部署方案
7. 如果需要填写 dockerfile name，请使用：
   - backend 服务：backend
   - frontend 服务：frontend

backend 服务环境变量请完整设置为：
API_BASE=<请填我的主 LLM OpenAI 兼容地址>
API_KEY=<请填我的主 LLM API Key>
MODEL=<请填我的主模型名称>
TEMPERATURE=0.7
EMBEDDING_API_BASE=https://api.siliconflow.cn/v1
EMBEDDING_API_KEY=<请填我的 SiliconFlow API Key；如果与主 LLM Key 相同也请显式填写>
EMBEDDING_MODEL=BAAI/bge-m3
JWT_SECRET=<请生成一个足够长的随机强密钥，至少 32 字符>
DEFAULT_EMAIL=
DEFAULT_PASSWORD=
DEFAULT_NAME=
ALLOW_REGISTRATION=true
REGISTRATION_ACCESS_CODE=xuhaochen
BACKEND_PUBLIC_URL=<请绑定 backend 公网域名后填写，例如 https://backend-xxx.zeabur.app>
FRONTEND_APP_URL=<请绑定 frontend 公网域名后填写，例如 https://frontend-xxx.zeabur.app>
GITHUB_APP_CLIENT_ID=<请填我的 GitHub App Client ID，没有就留空>
GITHUB_APP_CLIENT_SECRET=<请填我的 GitHub App Client Secret，没有就留空>
GITHUB_APP_SLUG=<请填我的 GitHub App Slug，没有就留空>
GITHUB_OAUTH_STATE_SECRET=<请生成一个独立强随机字符串；如果留空会回退到 JWT_SECRET，但这里请显式填写>
DASHSCOPE_API_KEY=<请填我的 DashScope Key，没有就留空>
QINIU_ACCESS_KEY=<请填我的 Qiniu Access Key，没有就留空>
QINIU_SECRET_KEY=<请填我的 Qiniu Secret Key，没有就留空>
QINIU_BUCKET=<请填我的 Qiniu Bucket，没有就留空>
QINIU_DOMAIN=<请填我的 Qiniu Domain，没有就留空>
MAX_QUESTIONS_PER_PHASE=5
MAX_DRILL_QUESTIONS=15

frontend 服务环境变量请完整设置为：
API_UPSTREAM=<请填写 backend 服务 Networking 页面显示的 Private Hostname>:8000

验收要求：
1. frontend 可通过公网域名访问
2. frontend 访问 /api/* 时能成功反代到 backend
3. backend 可正常启动，且 /api/auth/config 返回 200
4. 登录页可显示“立即注册”，注册需要激活码 xuhaochen
5. 持久卷必须确实挂载到 /app/data

如果 Zeabur 需要我手动补充任何密钥，请把缺失项逐条列出来，不要省略。
```
