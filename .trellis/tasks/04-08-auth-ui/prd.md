# brainstorm: 完善登录注册界面

## Goal

为 MemCoach 增强登录/注册体验，使认证入口在视觉表现、信息架构、状态反馈与可用性上达到正式产品可用水平，同时与现有认证接口和整体品牌风格保持一致。

## What I already know

* 用户明确希望“为项目添加完善的登录注册界面”。
* 现有前端为 React 19 + Vite + React Router 7，样式以 Tailwind 风格原子类和全局 CSS 变量为主。
* 当前已有单页认证页 `frontend/src/pages/Login.jsx`，登录与注册通过同页切换实现。
* 后端已提供 `/api/auth/config`、`/api/auth/register`、`/api/auth/login`，注册能力受 `allow_registration` 控制。
* `allow_registration` 在配置中的默认值为 `False`，说明很多环境下实际主入口可能仍以登录为主。
* 当前认证成功后会写入 `localStorage` 中的 `token` 与 `user`，并跳转首页。
* 当前路由仅暴露 `/login`，未拆分独立的 `/register` 页面。
* 站点现有视觉语言是深色科幻终端风，主色为 emerald/teal，强调网格、扫描线、辉光与等宽字体。

## Assumptions (temporary)

* “完善”不仅是视觉美化，还包括更完整的交互与错误提示。
* 本次优先聚焦前端认证体验，不主动变更后端认证契约，除非调研后发现存在明确缺口。
* 现有品牌风格应延续登录页与落地页的深色宇宙感视觉，而不是重做整站设计语言。

## Open Questions

* （已关闭）当前无阻塞性开放问题。

## Requirements (evolving)

* 保持现有登录与注册能力可用。
* 新界面需与当前站点视觉风格一致，并明显优于现有简版表单。
* 认证状态、错误状态、禁用状态应有清晰反馈。
* 当注册关闭时，界面需要自然退化为登录优先，而不是展示无效流程。
* 本次实现不仅覆盖登录/注册主流程，还要为“忘记密码 / 第三方登录 / 邮箱验证”预留清晰入口或结构位置。
* 预留能力在本次可以不接入完整后端能力，但界面结构不能阻碍后续扩展。
* 认证页采用“共享布局 + 多路由页面”结构，至少保证 `/login` 与 `/register` 具备明确分离但共享同一视觉骨架。
* “忘记密码”与“邮箱验证”采用可进入的占位页，而不是只在主界面展示文案入口。
* 不引入 GitHub 登录入口；第三方登录预留仅保留 Google 方向。
* Google 登录在本次仅为前端结构占位，不接入真实 OAuth 后端流程。
* Google 登录预留采用主认证页直接展示禁用按钮的方式，并明确标注“即将支持”。

## Acceptance Criteria (evolving)

* [ ] 用户可以在登录/注册界面顺畅完成现有认证主流程。
* [ ] 注册开关关闭时，界面不会暴露无效注册入口。
* [ ] 认证失败时，界面能给出明确且可理解的错误提示。
* [ ] 页面在桌面端与移动端都具备可用布局。
* [ ] 界面中能看出后续“忘记密码 / 第三方登录 / 邮箱验证”的承载位置，且不显得像临时拼接。
* [ ] 认证页面路由结构具备后续扩展到更多身份页面的清晰演进路径。
* [ ] 至少“忘记密码”和“邮箱验证”具备可进入的占位页，并拥有明确的状态说明与返回路径。
* [ ] 若展示 Google 登录相关入口，其状态必须明确表达为“预留/即将支持”，不能让用户误认为当前可用。
* [ ] 登录页与注册页会直接展示 Google 登录预留按钮，但按钮状态、辅助文案与交互反馈均能明确说明当前不可用。

## Decision (ADR-lite)

**Context**: 现有项目只有 `/login` 单页认证入口，但本次需求要求在完善主流程的同时，为更多身份能力预留结构。

**Decision**: 采用“共享布局 + 多路由页面”方案，保留 `/login`，新增 `/register`，并为后续 `/forgot-password`、`/verify-email` 等页面留出自然扩展位；第三方登录只保留 Google 预留入口，并在主页面直接展示禁用按钮。

**Consequences**: 本次前端改造范围略大于单页切换方案，但后续扩展真实认证能力时会显著降低返工概率，也更符合语义化 URL 与可维护性要求；Google 入口会提前占位，但不会制造“已经接入 OAuth”的错误预期。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 暂不默认包含新的后端身份体系重构。
* 暂不默认完成短信登录、OAuth 社交登录、多因素认证的后端接入闭环。
* 暂不默认实现真实的找回密码和邮箱验证邮件发送链路。

## Technical Notes

* 已检查文件：
  * `frontend/src/pages/Login.jsx`
  * `frontend/src/contexts/AuthContext.jsx`
  * `frontend/src/App.jsx`
  * `frontend/src/pages/Landing.jsx`
  * `frontend/src/index.css`
  * `backend/auth.py`
  * `backend/main.py`
  * `backend/config.py`
  * `frontend/src/api/githubConnection.js`
* 现有认证接口能力较基础，前端当前主要缺口更像是体验层而不是协议层。
* 当前登录页已有的能力：登录/注册切换、密码最小长度校验、错误展示、注册开关探测。
* 当前登录页缺少的产品化体验包括：更强的信息层次、密码可见性切换、分场景文案、辅助说明、细化表单校验、加载/空态/禁用态打磨，以及更完整的移动端与品牌呈现。
* 当前项目的很多未登录跳转和入口都指向 `/login`，说明认证入口组织方式会影响多个页面，但现有改造成本仍可控。
* 仓库中不存在 Google 登录的前后端实现；若本次保留 Google 入口，只能作为结构占位或说明页，不应伪装成已可用功能。
* 用户已明确排除 GitHub 登录入口，因此认证页的第三方登录区域应避免与现有 GitHub 连接能力耦合。
* 仓库中的 `.trellis/spec/frontend/index.md` 缺失，若进入实现阶段需要结合现有代码模式做前端规范补齐式遵循。
