# Changelog

## 2026-04-09
- **认证UI**：完成登录/注册认证界面重构，采用共享布局 + 多路由结构。
  - 新增 `AuthLayout` 共享认证布局组件，统一深色科幻终端风格背景、Logo 区与返回导航。
  - 重写 `Login.jsx` 为登录专用页，新增密码可见性切换、忘记密码入口、Google 登录禁用预留按钮（标注"即将支持"）。
  - 新增 `Register.jsx` 注册页，注册关闭时自动重定向到登录页，不暴露无效流程。
  - 新增 `ForgotPassword.jsx`、`VerifyEmail.jsx` 占位页，含状态说明与返回路径。
  - 更新 `App.jsx` 路由，新增 `/register`、`/forgot-password`、`/verify-email`，`AuthPage` 守卫泛化为多页面复用。
  - 后端 API 契约保持不变，无后端改动。

## 2026-04-08
- **UI/UX**：前端界面字体与侧边栏优化。
  - 侧边栏新增折叠伸缩功能，通过切换展开状态释放主工作区宽度。
  - 批量放大全局及核心页面（如项目分析与结果页）中过小的字体，并优化行高与间距提升阅读体验。
- **前端**：完成 GitHub 项目分析官 Phase 1 前端导入向导重构。
  - 新增 `githubConnection.js` API 层，覆盖连接状态、OAuth 发起、断连、仓库列表、分支列表、范围候选共 6 个接口。
  - 新增 `createProjectAnalysisV2`，使用 `repo_snapshot + selected_scope_snapshot` 新契约创建分析任务。
  - 重写 `ProjectAnalysis.jsx`，主入口切换为"连接 GitHub → 选已授权仓库 → 选分支 → 目录/文件范围 → 创建分析"五步流程，支持目录展开到文件级补充选择，消费 OAuth callback query 参数，保留结果页与训练闭环。
  - 补齐 `ProjectAnalysisResult.jsx` 的仓库快照与用户确认范围展示，确保结果页和新契约一致。
- **流程**：整理 Trellis 活跃任务，收口已完成但未归档的历史项。
  - 归档 `03-30-fix-watchfiles-reload-tmp-dir`，将已完成的临时目录修复任务移出活跃区。
  - 清理 `00-bootstrap-guidelines` 的占位子项与 backend 指南索引状态，并完成归档准备。
  - 保留 `03-29` 父任务与 6 个 `03-31` 子任务，作为后续 GitHub 项目分析官 Phase 1 的正式开发任务树。
- **功能**：完成 GitHub 项目分析官 Phase 1 第一阶段后端主干。
  - 新增 GitHub 连接能力：授权发起、回调落库、状态查询、断连，以及用户 access token 刷新能力。
  - 新增已授权公开仓库列表、分支查询、目录优先+文件补充的范围候选接口。
  - 升级项目分析存储与编排，支持 `repo_snapshot + selected_scope_snapshot` 新输入契约，修复 callback 失败跳转的 query 编码问题，并补齐 Windows 路径归一化回归测试。
  - 贯通 GitHub 用户 token 到分析创建与后台下载链路，已绑定 GitHub 的仓库分析不再退回匿名 GitHub API 请求。

## 2026-03-31
- **规划**: 重构 GitHub 项目分析官 Phase 1 的 Trellis 任务树，切换到 GitHub 绑定公开仓库版路线。
  - 重写父任务 PRD 与子任务拆分，将主入口从公开仓库 URL 导入升级为 GitHub 绑定、仓库选择、分支选择与混合范围确认。
  - 归档 5 个已偏航的 03-30 子任务，保留已实现代码的审计链并明确其被新路线替代。
  - 新建 6 个 03-31 子任务，覆盖 GitHub 连接、公开仓库发现、范围推荐、分析编排 V2、结果闭环与导入链路稳定性修复。

## 2026-03-30
- **工具链**: 新增项目本地 skill，用于固化功能交付总流程。
  - 新建 `.agents/skills/feature-delivery-flow/`，把 `office-hours -> autoplan -> Trellis -> 并行 subagent -> review -> break-loop -> record-session` 串成一条可复用流程。
  - 补充 `agents/openai.yaml`，方便后续以统一入口触发这套流程。
- **修复**: 项目分析后台任务在开发模式下触发 uvicorn --reload 导致服务重启
  - 将临时文件目录从项目根目录 `.tmp-project-analysis/` 迁移至系统 `tempfile.mkdtemp()`
  - 更新后端 quality-guidelines 和 cross-layer-thinking-guide，固化临时文件策略
- **规划**: 将 GitHub 项目分析官 Phase 1 拆分为可执行的 Trellis 子任务。
  - 新建 5 个 Phase 1 子任务，覆盖数据模型、GitHub 源接入、后端任务编排、前端导入流、结果与训练闭环。
  - 为每个子任务补充 `task.json` 描述、`prd.md` 边界与 Trellis 上下文文件，形成可继续推进的任务树。
  - 更新父任务元数据，记录 autoplan 后的执行顺序与子任务结构。
- **修复**: 收口 GitHub 项目分析官 Phase 1 的跨层整合问题。
  - 统一项目分析后端正式契约、存储与编排逻辑，补齐 `status / result / cancel / practice` 相关链路。
  - 接通导入向导到结果工作区、结果工作区到项目答题训练的前后端路径。
  - 更新 `.trellis/spec/` 相关规范并同步到 `src/templates/markdown/spec/`，固化本次跨层契约教训。

## 2026-03-27
- **UI/UX**: 优化面试(Interview)页面的布局及字体大小。
  - 将主内容区最大宽度约束从 `max-w-[720px]`/`max-w-4xl` 扩大为 `max-w-[900px]`/`max-w-5xl`。
  - 调大了顶部状态栏、问题展示区、输入区、操作按钮及对话气泡(ChatBubble)中的字体和间距，增强了高压面试场景下的可读性。
  - 任务详情已归档至 `.trellis/changes/archive/002-interview-page-optimization.md`。

## 2026-03-26
- **UI/UX**: 优化全局核心页面（战力画像、主控台、战斗日志、知识库、录音复盘）的布局及字体大小。
  - 将主体内容区最大宽度约束扩大（如 `max-w-5xl` -> `max-w-7xl`，`max-w-4xl` -> `max-w-6xl`），充分利用大屏空间。
  - 全局提升各级标题和正文字体大小 1~2 个等级（如 `text-[10px]` 提升为 `text-xs`，`text-xs` 提升为 `text-sm`，以此类推），显著增强信息呈现的清晰度和可读性。
  - 更新了 `AGENTS.md` 记录本次架构与设计规范演进。
  - 任务详情已归档至 `.trellis/changes/archive/001-recording-page-optimization.md`。
