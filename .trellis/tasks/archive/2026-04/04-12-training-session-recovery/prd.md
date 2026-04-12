# brainstorm: 训练会话可恢复与跨端续练

## Goal

把 MemCoach 的训练会话从“页面内临时状态”升级为“可持久恢复的正式产品状态”。
本次优先补可靠性底座，解决刷新、退出、进程重启、跨设备切换后训练上下文丢失的问题，让用户敢在平台内完成完整训练，而不是担心中途断线后前功尽弃。

## What I already know

* 用户明确希望训练会话支持：可恢复、可续练、可跨端。
* 用户希望“任何未完成训练都应在首页出现继续训练”，离开后回来还能接着答。
* 用户给出的工程方向已经明确：
  * 把进行中的 `resume / drill` 会话状态持久化到 SQLite。
  * 补会话恢复接口。
  * 前端进入训练页时先拉取会话，而不是依赖路由 `state`。
* 当前前端首页启动训练后直接 `navigate(`/interview/${data.session_id}`, { state: data })`，训练页强依赖 `location.state` 初始化。
* 当前 [frontend/src/pages/Interview.jsx](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/frontend/src/pages/Interview.jsx) 中：
  * `resume` 模式靠 `location.state.message` 初始化首条 AI 消息。
  * `topic_drill` 模式靠 `location.state.questions` 初始化题目列表。
  * drill 的 `answers/currentIndex` 只在页面本地状态里维护，结束前不会落库。
* 当前 [backend/main.py](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/backend/main.py) 中：
  * `resume` 模式进行中状态保存在进程内 `_graphs`。
  * `topic_drill` 模式进行中状态保存在进程内 `_drill_sessions`。
  * 这两类状态在服务重启后都会丢失。
* 当前 [backend/storage/sessions.py](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/backend/storage/sessions.py) 的 `sessions` 表只存：
  * `mode/topic/questions/transcript/scores/weak_points/overall/review/user_id`
  * 没有会话生命周期字段，也没有“进行中进度快照”字段。
* 当前历史列表与首页统计都只读取 `review IS NOT NULL` 的已完成会话，未完成会话对用户不可见。
* 当前 `resume` 模式的 LangGraph 使用 `MemorySaver()`，官方文档支持用持久化 checkpointer + `thread_id` 恢复状态，但项目当前环境里尚未安装 `langgraph.checkpoint.sqlite`。

## Assumptions (temporary)

* 本次 MVP 至少覆盖两类训练：`resume`、`topic_drill`。
* “可恢复”默认指恢复到最近一次**已提交**的训练状态，而不是默认恢复输入框中尚未提交的草稿。
* “可跨端”默认指同一账号在不同浏览器/设备上可以继续同一个进行中会话，不涉及多人协作。
* 录音复盘 `recording` 不在本次首批范围内。
* `project-analysis practice` 如果底层复用 `topic_drill` 契约，后续可自然接入，但不作为本次独立范围。

## Open Questions

* （当前无阻塞问题）

## Requirements (evolving)

* 未完成的 `resume` / `topic_drill` 会话必须持久化到 SQLite，而不是只存内存。
* MVP 采用“每种模式最多一个进行中会话”的策略：
  * 最多一个 `resume` 进行中会话；
  * 最多一个 `topic_drill` 进行中会话。
* 当同一模式已存在进行中会话时，用户再次点击“开始训练”应直接进入旧会话继续训练，而不是创建新会话。
* 首页必须能发现未完成会话，并提供明确的“继续训练”入口。
* 首页必须为每个进行中模式提供显式的“放弃当前训练并重新开始”入口，避免用户被旧会话锁死。
* 训练页必须以“按 `session_id` 向后端取恢复数据”为主路径，不再依赖路由 `state`。
* 用户主动放弃的未完成会话应保留为 `abandoned` 状态，用于审计与排障，但不进入常规历史列表，也不再显示为“继续训练”。
* MVP 只恢复“已提交到后端”的训练内容，不负责恢复用户尚未发送/尚未提交的输入草稿。
* 同一账号在两台设备上同时打开同一个进行中会话时，MVP 允许同时继续，按最后一次提交写入为准。
* `resume` 模式在刷新、重新进入页面、服务进程重启后，仍能继续对话。
* `topic_drill` 模式在刷新、重新进入页面后，仍能恢复题目列表、当前进度、已提交答案。
* 已完成会话结束后，不应再显示为“继续训练”，而应继续走现有 review/history 体系。
* 恢复能力必须按 `user_id` 隔离，不能读取到其他用户的进行中会话。
* 恢复接口返回的数据结构必须稳定，前端不再靠猜测字段或多套 fallback 字段工作。

## Acceptance Criteria (evolving)

* [ ] 用户启动 `resume` 训练后，刷新页面仍能回到同一个进行中会话并继续发送消息。
* [ ] 用户启动 `topic_drill` 训练并完成部分题目后，退出再进入仍能看到相同题单、已答题目与当前进度。
* [ ] 后端重启后，进行中的 `resume` 会话仍可通过同一 `session_id` 恢复。
* [ ] 首页在存在未完成训练时展示“继续训练”入口，且点击后进入正确会话。
* [ ] 系统不会在同一模式下同时存在两个进行中的会话。
* [ ] 当同一模式已存在进行中会话时，再次点击“开始训练”会直接回到该旧会话。
* [ ] 首页可显式放弃当前进行中训练，并在放弃后允许重新开始新的训练会话。
* [ ] 已完成训练不会出现在“继续训练”入口中。
* [ ] 被放弃的会话不会再显示为“继续训练”，也不会污染用户常规历史列表。
* [ ] 恢复后至少能看到所有已提交的消息/答案；未提交输入框内容不作为本次恢复范围。
* [ ] 同一账号在另一台设备登录后，可以继续同一个进行中会话。
* [ ] 同一账号双端同时续练时，系统行为稳定，不因并发续练导致会话不可恢复；以最后一次提交结果为准。
* [ ] 未登录或错误用户访问他人会话时返回清晰的 401/403/404，而不是脏数据。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 本次不做录音复盘 `recording` 的中途恢复。
* 本次不做输入框“逐字草稿自动保存”，除非明确纳入范围。
* 本次不做多人同时编辑同一训练会话的协作能力。
* 本次不重构训练评估逻辑本身，只补进行中会话的可靠性与恢复链路。

## Research Notes

### Current data flow and failure points

**Resume 模式**

* `Home -> POST /api/interview/start -> navigate(state) -> Interview -> POST /api/interview/chat -> POST /api/interview/end`
* 进行中真实状态在：
  * SQLite：只落了 transcript 的一部分结果
  * 进程内：`_graphs[session_id]`
* 失败点：
  * 浏览器刷新丢 `location.state`
  * 后端重启丢 `_graphs`
  * `POST /api/interview/chat` 直接 404: `Session not found. It may have expired (in-memory only).`

**Topic Drill 模式**

* `Home -> POST /api/interview/start -> navigate(state) -> Interview(questions in route state)`
* 进行中真实状态在：
  * SQLite：只保存题单 `questions`
  * 页面内：`answers/currentIndex`
  * 进程内：`_drill_sessions[session_id]`
* 失败点：
  * 刷新丢 `questions/currentIndex/answers`
  * 后端重启丢 `_drill_sessions`
  * 未结束前首页完全感知不到进行中训练

### Constraints from our repo/project

* 后端使用原生 `sqlite3`，短连接模式，允许 inline migration。
* API 错误统一走 `HTTPException`，前端依赖稳定状态码而不是猜错误文本。
* 当前前后端已经以 `session_id` 为训练会话唯一标识，这非常适合继续作为持久恢复主键。
* 这是明显的跨层功能，必须先明确唯一契约源、状态枚举、恢复接口与前端消费方式。
* 当前依赖里有 `langgraph` 和 `aiosqlite`，但当前运行环境里不存在 `langgraph.checkpoint.sqlite` 模块，若采用官方持久化方案，需要补充依赖与部署验证。

### What similar tools / official LangGraph support

* LangGraph 官方支持用持久化 checkpointer 保存状态，并通过 `configurable.thread_id` 恢复同一线程。
* 官方推荐做法是 `graph.compile(checkpointer=...)`，随后所有 `invoke/get_state` 都使用相同的 `thread_id`。
* 这意味着本项目可以直接把 `session_id` 作为 LangGraph 的 `thread_id`，把 resume 会话恢复做成真正的 durable execution，而不是伪恢复。

### Feasible approaches here

**Approach A: SQLite 作为进行中会话主存储，Resume 用 LangGraph SQLite Checkpointer**（Recommended）

* How it works:
  * 扩展 `sessions` 表，加入进行中状态字段，例如 `status/progress_payload/last_activity_at/completed_at`。
  * Resume 模式切换到持久化 LangGraph checkpointer，`session_id == thread_id`。
  * Drill 模式把 `current_index/answers/questions/topic` 等进度快照写入 SQLite。
  * 新增恢复接口，前端进入训练页先 `GET session payload`，首页再读 `active sessions`。
* Pros:
  * 真正满足刷新、退出、跨端、服务重启后的恢复。
  * 后端成为唯一真实来源，前端状态更简单。
  * 与当前 `session_id` 设计一致，扩展性最好。
* Cons:
  * 需要补依赖、做 schema 迁移、改动前后端和训练主链路。

**Approach B: 只把前端可见状态落 SQLite，Resume 根据 transcript 近似重建**

* How it works:
  * 不接 LangGraph 持久化，仅保存 transcript 和阶段信息，再在恢复时重新构图。
* Pros:
  * 少一个新依赖。
* Cons:
  * Resume 模式很容易出现恢复后状态偏移，尤其 phase/eval_history/interrupt 位置不一致。
  * 这不是“可靠性底座”，只是成本更低的近似恢复。

**Approach C: 主要靠前端 localStorage/sessionStorage 恢复**

* How it works:
  * 浏览器本地保存 route state、题单、输入与消息。
* Pros:
  * 实现快。
* Cons:
  * 无法跨端。
  * 清缓存/换设备/登出后即失效。
  * 与用户目标直接冲突，不适合作为本次方案。

## Decision (ADR-lite)

**Context**: 进行中会话需要被首页发现、被训练页恢复，同时不能把首页入口和冲突处理做得过重。

**Decision**: MVP 采用“每种模式最多一个进行中会话”的策略，而不是支持任意多个并行进行中的训练。

**Consequences**:

* 首页信息架构更简单，用户能快速看到 `resume` / `topic_drill` 的继续训练入口。
* 后端需要提供“按模式查当前 active session”的能力，并在新建会话时处理同模式冲突。
* 后续如果要扩展为多 active session 列表，需要再演进数据模型和首页展示。

## Decision Update

**Context**: 在“每种模式最多一个进行中会话”的前提下，用户再次点击开始按钮时，系统必须决定是创建新会话还是回到旧会话。

**Decision**: 同一模式已存在进行中会话时，再次点击“开始训练”直接继续旧会话，不创建新的进行中会话。

**Consequences**:

* 用户不会因为误触或刷新而产生上下文分叉，符合“可靠性优先”的产品目标。
* 首页和启动接口都可以复用“查 active session -> 返回 existing session_id”的逻辑。
* 如果后续需要“重新开始”，应通过显式放弃/废弃动作单独建模，而不是隐式覆盖旧会话。

## Decision Update 2

**Context**: 既然同模式默认继续旧会话，就必须给用户一个明确的重开出口，否则“每种模式最多一个进行中会话”会变成产品锁死。

**Decision**: MVP 在首页的进行中会话入口旁提供“放弃当前训练并重新开始”的显式操作。

**Consequences**:

* 状态机需要显式支持 `abandoned` 或等价终态，而不是只区分 `active/completed`。
* 首页需要同时承载“继续训练”和“重新开始”两类操作。
* 训练页不必额外承担重开入口，首页成为进行中会话治理的主入口。

## Decision Update 3

**Context**: 用户主动放弃进行中训练后，系统既要避免历史界面被未完成记录污染，也不能失去必要的审计与问题排查信息。

**Decision**: 被主动放弃的会话保留为 `abandoned` 状态，但不进入常规历史列表。

**Consequences**:

* 后端 `sessions` 生命周期至少需要支持 `active / completed / abandoned`。
* 首页和恢复接口应只把 `active` 视为“继续训练”候选。
* 历史列表默认只展示 `completed`，避免用户感知到半成品训练噪音。
* 数据层仍保留 `abandoned` 记录，便于未来做故障分析、留存分析或后台排查。

## Decision Update 4

**Context**: “会话恢复”与“输入草稿自动保存”是两个复杂度差异很大的问题。当前任务核心是防止训练上下文丢失，而不是实现实时草稿同步。

**Decision**: MVP 只恢复已经提交到后端的消息与答案，不保存未提交草稿。

**Consequences**:

* 数据模型可以聚焦于持久化会话状态，而不引入高频草稿写入。
* 恢复行为更稳定、可验证，前后端实现复杂度显著下降。
* 用户未发送的临时输入在刷新后会丢失，但这被视为后续可迭代问题，不阻塞本次可靠性底座建设。

## Decision Update 5

**Context**: “可跨端续练”天然会遇到同一账号双端同时打开同一会话的问题。MVP 需要一个简单、可实现、不会阻塞用户的并发策略。

**Decision**: 同一账号双端同时续练时允许继续，按最后一次提交写入为准，不做会话抢占或硬阻断。

**Consequences**:

* 不需要引入会话锁、抢占广播或复杂冲突提示，MVP 可控。
* 后端写入逻辑必须幂等并保持会话可恢复，避免因双端交替提交而把状态写坏。
* 极少数场景下两个设备会互相覆盖“最新进度”，但不会破坏“可继续训练”的基本承诺。

## Technical Approach

### Canonical source

* 后端 SQLite `sessions` 表作为进行中训练的唯一持久化真相源。
* `session_id` 继续作为全链路唯一会话标识。
* 前端训练页一律按 `session_id` 从后端拉恢复 payload 初始化。

### Session lifecycle

建议引入明确生命周期：

* `active`：进行中，可继续训练
* `completed`：已完成，可出现在 review/history
* `abandoned`：已放弃，不可继续，不进入常规历史

### Resume mode

* 将 LangGraph 从 `MemorySaver()` 切换为 SQLite 持久化 checkpointer。
* `session_id` 直接作为 `thread_id`。
* 训练恢复时重新编译 graph，但通过相同 `thread_id` 取回已持久化状态。
* 会话详情接口返回 transcript、phase、progress、latest message 等恢复所需字段。

### Topic drill mode

* 在 SQLite 中持久化：
  * `questions`
  * 已提交 `answers`
  * `current_index`
  * `topic`
  * 必要的 progress payload
* 每次提交答案或跳题时立即更新进度快照。

### API surface

建议新增/调整以下契约：

* `POST /api/interview/start`
  * 若同模式已有 `active` 会话，直接返回该会话的恢复信息，而不是新建
* `GET /api/interview/active`
  * 返回当前用户按模式聚合的进行中会话摘要，供首页展示“继续训练”
* `GET /api/interview/session/{session_id}`
  * 返回训练恢复 payload，供训练页初始化
* `POST /api/interview/session/{session_id}/abandon`
  * 将 active 会话标记为 `abandoned`

### Frontend flow

* 首页：
  * 启动前先感知 active sessions
  * 有 active 时展示“继续训练”与“放弃并重新开始”
* 训练页：
  * 进入后先调用恢复接口
  * 不再依赖 `location.state`
  * 若接口返回 completed/abandoned，前端按状态跳转或提示

### Testing focus

至少补以下回归验证：

* `resume` 会话启动后可恢复
* `topic_drill` 已答部分题目后可恢复
* `abandon` 后不会再出现在 active 列表
* history 默认不包含 `active/abandoned`
* 同模式重复 start 会返回旧 active session

## Preliminary Direction

建议选择 **Approach A**，否则“跨端 + 服务重启后继续 + 首页继续训练”三件事无法同时成立。

工程上可以拆成三层：

1. **后端状态模型**
   * 为 `sessions` 引入进行中生命周期与恢复载荷。
2. **恢复接口**
   * 提供“列出进行中会话”和“按 session_id 获取恢复 payload”。
3. **前端消费方式**
   * 首页展示继续训练。
   * 训练页用后端 payload 初始化，不再依赖 `location.state`。

## Technical Notes

* 已检查文件：
  * [backend/main.py](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/backend/main.py)
  * [backend/storage/sessions.py](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/backend/storage/sessions.py)
  * [backend/graphs/resume_interview.py](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/backend/graphs/resume_interview.py)
  * [backend/models.py](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/backend/models.py)
  * [frontend/src/pages/Home.jsx](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/frontend/src/pages/Home.jsx)
  * [frontend/src/pages/Interview.jsx](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/frontend/src/pages/Interview.jsx)
  * [frontend/src/api/interview.js](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/frontend/src/api/interview.js)
* 相关规范：
  * [database-guidelines.md](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/.trellis/spec/backend/database-guidelines.md)
  * [error-handling.md](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/.trellis/spec/backend/error-handling.md)
  * [quality-guidelines.md](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/.trellis/spec/backend/quality-guidelines.md)
  * [cross-layer-thinking-guide.md](D:/visual_ProgrammingSoftware/毕设and简历Projects/MemCoach/.trellis/spec/guides/cross-layer-thinking-guide.md)
* 风险点：
  * Resume 模式如果不切到持久化 checkpointer，恢复只能做到“像恢复”，做不到“真恢复”。
  * 如果首页与训练页读取的不是同一套恢复契约，很容易再次出现 route state 和后端存储双真相。
