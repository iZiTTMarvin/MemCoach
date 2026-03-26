# AGENTS.md — MemCoach 项目规范

> 本文件是项目的 **唯一权威文档**，所有开发决策、架构约束、技术栈选择均以此为准。
> 每次非平凡任务完成后必须更新本文件。

---

## 1. 项目概述

MemCoach 是一个基于 AI 的面试教练系统，核心能力是**持久化候选人画像**——每次训练后自动提取薄弱点、评估掌握度、记录思维模式，下次出题精准命中短板。

- **在线 Demo**: https://aari.top/
- **License**: MIT

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | FastAPI, Python 3.11+ |
| AI 引擎 | LangChain, LangGraph, LlamaIndex |
| 前端框架 | React 19, React Router v7, Vite |
| 样式方案 | Tailwind CSS v4 (含 @plugin / @theme 自定义语法) |
| 动画库 | Framer Motion |
| 图标库 | Lucide React |
| 存储 | SQLite, bge-m3 embeddings |
| 认证 | JWT, bcrypt |
| LLM | 任意 OpenAI 兼容 API |
| 容器化 | Docker Compose |

---

## 3. 前端架构

### 3.1 目录结构

```
frontend/src/
├── api/interview.js        # API 客户端 (authFetch 封装)
├── assets/                 # 静态资源
├── components/
│   ├── Sidebar.jsx         # 侧边栏导航 (深空科幻风格)
│   ├── ChatBubble.jsx      # 对话气泡 (终端风格)
│   └── TopicCard.jsx       # 领域卡片
├── contexts/
│   └── AuthContext.jsx     # JWT 认证上下文
├── hooks/
│   └── useVoiceInput.js    # 语音输入 Hook
├── pages/
│   ├── Landing.jsx         # 落地页 (全屏沉浸式英雄区)
│   ├── Login.jsx           # 登录/注册页
│   ├── Home.jsx            # 主控台 (训练矩阵)
│   ├── Interview.jsx       # 面试/专项训练 (终端交互界面)
│   ├── Review.jsx          # 任务报告 (评分+逐题分析)
│   ├── Profile.jsx         # 战力画像
│   ├── TopicDetail.jsx     # 领域详情
│   ├── Knowledge.jsx       # 知识库管理
│   ├── Graph.jsx           # 知识图谱可视化
│   ├── History.jsx         # 战斗日志
│   └── RecordingAnalysis.jsx # 录音复盘
├── utils/topicIcons.js     # 领域图标映射
├── App.jsx                 # 路由 + 认证守卫
├── App.css
├── index.css               # 全局样式 + CSS 变量 + 关键帧动画
└── main.jsx                # 入口
```

### 3.2 路由表

| 路径 | 组件 | 认证 | 说明 |
|------|------|------|------|
| `/landing` | Landing | 否 | 落地页 |
| `/login` | Login | 否 | 登录/注册 |
| `/` | Home | 是 | 主控台 |
| `/interview/:sessionId` | Interview | 是 | 面试/训练 |
| `/review/:sessionId` | Review | 是 | 评估报告 |
| `/profile` | Profile | 是 | 战力画像### 2026-03 全局页面布局及字体优化

- **问题**: 页面（包括战力画像、主控台、战斗日志、知识库等）中间主体内容区太窄，且各模块的字体整体偏小，可读性不佳。
- **修复**:
  1. `frontend/src/pages/{Profile,Home,History,Knowledge}.jsx`: 将主体内容的约束容器扩大（如 `max-w-5xl` -> `max-w-7xl`, `max-w-4xl` -> `max-w-6xl`），使内容向左右扩充，更好地利用大屏幕宽度。
  2. 全局将各级标题和正文字体提升 1~2 个等级（如 `text-[10px]` -> `text-xs`/`text-sm`，`text-xs` -> `text-sm`/`text-base` 等）。
  3. 将图表标题、状态数据、弱点分析、列表项、操作按钮等模块内的文字及图标大小进行对应放大，增强信息呈现的清晰度。
- **约束**:
  - 保持整体深空科幻(Deep Space Sci-Fi)的设计语言不变。
  - **布局**: 不对称网格 + 浮动终端组件 + 全屏沉浸式英雄区
  - **字体**: 等宽字体 (JetBrains Mono / Fira Code) 用于终端风格 UI，无衬线字体用于正文
  - **动画**: CSS shimmer、scanline、pulse、fade-in，Framer Motion spring 动画
  - **交互**: 微交互 (hover glow, border highlight, scanline sweep)
  - **文本**: **所有 UI 文本必须为中文**，仅装饰性标签保留英文（如 `MEMCOACH`、`NODE_1` 等）
| `/profile/:topic` | TopicDetail | 是 | 领域详情 |
| `/knowledge` | Knowledge | 是 | 知识库 |
| `/graph` | Graph | 是 | 知识图谱 |
| `/history` | History | 是 | 历史记录 |
| `/recording` | RecordingAnalysis | 是 | 录音复盘 |

---

## 4. UI 设计规范 — 深空科幻主题

### 4.1 设计理念

- **风格**: 深空科幻 (Deep Space Sci-Fi)，远离常见的 AI 紫色调 / 赛博朋克风格
- **布局**: 不对称网格 + 浮动终端组件 + 全屏沉浸式英雄区
- **字体**: 等宽字体 (JetBrains Mono / Fira Code) 用于终端风格 UI，无衬线字体用于正文
- **动画**: CSS shimmer、scanline、pulse、fade-in，Framer Motion spring 动画
- **交互**: 微交互 (hover glow, border highlight, scanline sweep)
- **文本**: **所有 UI 文本必须为中文**，仅装饰性标签保留英文（如 `MEMCOACH`、`NODE_1` 等）

### 4.2 配色方案

```css
/* 核心色板 */
--bg:           #040d12;    /* 深宇宙背景 */
--bg-subtle:    #0a1a1f;    /* 次级背景 */
--card:         #0d2026;    /* 卡片背景 */
--border:       #1a3a3a;    /* 边框 */
--text:         #f1f5f9;    /* 主文本 */
--text-dim:     #64748b;    /* 次要文本 */
--primary:      #10b981;    /* 翡翠绿 (主色) */
--accent:       #d9f99d;    /* 酸性黄 (强调色) */
--teal:         #2dd4bf;    /* 青绿 (辅助色) */
--red:          #ef4444;    /* 错误/危险 */
```

### 4.3 视觉元素

- **玻璃态效果**: `backdrop-blur-xl` + 半透明背景
- **角标装饰**: 四角 2px border 标记 (`.border-t-2.border-l-2`)
- **左侧指示条**: 激活/悬停时 `w-1 bg-primary` 竖线
- **扫描线动画**: `animate-[scanline_4s_linear_infinite]`
- **发光阴影**: `shadow-[0_0_15px_rgba(16,185,129,0.2)]`
- **渐变文字**: `bg-clip-text text-transparent bg-gradient-to-r from-text via-slate-300 to-dim`

### 4.4 字体层级

| 用途 | 样式 |
|------|------|
| 页面大标题 | `font-display font-black text-3xl md:text-5xl uppercase tracking-tight` |
| 区块标签 | `text-[10px] tracking-widest uppercase font-bold text-primary` |
| 正文 | `text-sm font-sans leading-relaxed` |
| 终端/代码 | `font-mono text-xs tracking-wider` |
| 数据标签 | `text-[10px] text-dim tracking-widest uppercase` |

---

## 5. 后端架构

### 5.1 目录结构

```
backend/
├── main.py                 # FastAPI 应用，40+ API 路由
├── auth.py                 # JWT 认证, 用户管理
├── config.py               # 环境变量配置
├── memory.py               # 画像引擎 (Mem0 风格)
├── vector_memory.py        # 向量记忆 (SQLite + bge-m3)
├── indexer.py              # 知识索引 (LlamaIndex)
├── spaced_repetition.py    # SM-2 间隔重复调度器
├── migrate.py              # 数据库迁移
├── graphs/
│   ├── resume_interview.py # 简历面试 (LangGraph 状态机)
│   ├── topic_drill.py      # 专项训练 & 评估
│   └── review.py           # 录音复盘
├── prompts/                # 系统提示词
│   ├── interviewer.py
│   └── recording.py
└── storage/
    ├── sessions.py         # 会话持久化 (SQLite)
    └── __init__.py
```

### 5.2 数据隔离

```
data/users/{user_id}/
├── profile/profile.json    # 用户画像
├── resume/                 # 简历文件
├── knowledge/              # 知识库文档
│   ├── core/              # 核心知识
│   └── high_freq/         # 高频题库
└── topics.json             # 领域配置
```

---

## 6. 关键决策记录

### 2025-03 UI 深空科幻主题重构

- **决策**: 完全重新设计前端 UI，从默认的简洁风格切换到深空科幻主题
- **动机**: 避免与市面上常见的 AI 产品（紫色调/赛博朋克）视觉雷同
- **配色**: 翡翠绿 (#10b981) + 青绿 (#2dd4bf) + 酸性黄 (#d9f99d) 三色体系
- **影响范围**: 所有前端页面、组件、CSS 变量、动画全部重写
- **约束**:
  - UI 文本全部使用中文，仅装饰性标签保留英文
  - 使用 Tailwind CSS v4 原生语法 (`@theme`, `@plugin`)
  - `index.css` 中的 `@plugin` / `@theme` 警告是 Tailwind v4 自定义语法，IDE 不识别但不影响功能
  - ESLint 对 `motion` 的 `no-unused-vars` 是误报（`motion.div` 在 JSX 中使用），需 eslint-disable

### AuthContext 架构

- `logout()` 函数必须在 `useEffect` 之前声明，避免 `react-hooks/immutability` 错误
- 使用 `setTimeout` 包裹同步 `setLoading(false)` 以规避 `react-hooks/set-state-in-effect` lint 规则
- `AuthContext` 和 `useAuth` 的导出需要 `eslint-disable react-refresh/only-export-components`

### 2025-03 后端中文注释完善

- **决策**: 为所有后端文件添加完善的中文注释
- **动机**: 提升代码可读性和可维护性，统一注释语言
- **影响范围**:
  - backend/auth.py
  - backend/config.py
  - backend/graph.py
  - backend/indexer.py
  - backend/llm_provider.py
  - backend/main.py
  - backend/memory.py
  - backend/migrate.py
  - backend/models.py
  - backend/spaced_repetition.py
  - backend/transcribe.py
  - backend/vector_memory.py
  - backend/graphs/resume_interview.py
  - backend/graphs/topic_drill.py
  - backend/graphs/review.py
  - backend/prompts/interviewer.py
  - backend/prompts/recording.py
  - backend/prompts/reviewer.py
  - backend/storage/sessions.py
- **约束**:
  - 所有英文注释翻译为精简中文
  - 每个函数添加核心注释
  - 不改动任何代码逻辑

---

## 7. 编码规范

### 通用

- 所有注释和文档使用中文
- 代码变量名使用英文
- 每个非平凡函数需注释说明用途、参数、返回值
- 错误需显式处理

### 前端

- 组件使用函数式组件 + Hooks
- 状态管理使用 React Context (AuthContext)
- API 调用统一通过 `api/interview.js` 中的 `authFetch` 封装
- 样式使用 Tailwind CSS utility classes，不写自定义 CSS（除全局变量和关键帧）
- 图标统一使用 Lucide React

### 后端

- 路由定义在 `main.py`
- 业务逻辑分层到各模块
- 每个用户数据完全隔离在 `data/users/{user_id}/` 下

### 2025-03 indexer.py 查询模式修复 (query_resume 401 错误)

- **问题**: 上传简历后启动面试报 `openai.AuthenticationError: 401`
- **根因**: `query_resume` 使用 `index.as_query_engine()` 触发了不必要的 LLM 响应合成调用；`OpenAILike` 在某些 llama-index 版本中不能正确将构造参数 `api_key` 传递给底层 OpenAI 客户端
- **修复**:
  1. `indexer.py`: `query_resume` 和 `query_topic` 从 `as_query_engine`（需 LLM）改为 `as_retriever`（纯向量检索），与 `retrieve_topic_context` 保持一致
  2. `llm_provider.py`: `get_llama_llm()` 创建 `OpenAILike` 前同步设置 `OPENAI_API_KEY` 环境变量作为兜底
- **设计原则**: 检索上下文场景应使用 retriever 而非 query engine，避免多余的 LLM 调用（省成本、降延迟、减少配置依赖）

### 2025-03 Interview 页面布局偏移修复

- **问题**: Interview 页面 header 被滚出视口顶部，底部出现 160px 空白
- **根因**: AppShell 外层容器使用 `overflow-hidden`，装饰 blob 的 `bottom: -20%` 扩展了可滚动区域。`overflow: hidden` 只隐藏滚动条但**不阻止程序化滚动**——浏览器自动聚焦 textarea 时触发了 shell 容器的 160px 滚动偏移
- **修复**:
  1. `App.jsx` AppShell: `overflow-hidden` → `overflow-clip`（`overflow: clip` 完全阻止任何滚动，包括程序化滚动）
  2. `App.jsx` AppShell `<main>`: 添加 `min-h-0` 防止 flex 子元素溢出
  3. `Interview.jsx`: 两种模式的外层容器从 `h-full` 改为 `min-h-0`（修复 flexbox min-height: auto 默认值问题）
- **教训**: 当容器内有使用负定位（如 `top: -20%`, `bottom: -20%`）的绝对定位装饰元素时，必须使用 `overflow-clip` 而非 `overflow-hidden`

### 2026-03 简历面试重复开场白修复（LangGraph 交互恢复）

- **问题**: 简历面试模式进入对话后，面试官始终重复系统提示词里的开场白，无法根据用户输入推进对话
- **根因**: 图编译时使用了静态断点 `interrupt_before=["wait"]`（暂停在节点边界），但后端 `/api/interview/chat` 仍按普通状态更新方式 `graph.invoke({"messages": [HumanMessage(...)]}, config)` 调用，未使用 `interrupt()` + `Command(resume=...)` 的恢复语义，导致执行总是停在等待点附近，状态机无法持续推进
- **修复**:
  1. `backend/graphs/resume_interview.py`: `wait_for_answer` 改为调用 `interrupt("等待候选人输入")` 并把恢复值写入 `messages`
  2. `backend/main.py`: `/interview/chat` 使用 `graph.invoke(Command(resume=req.message), config)` 恢复图执行
  3. `backend/graphs/resume_interview.py`: `init` 阶段将开场问题计入 `questions_asked` 与 `phase_question_count`，避免 greeting 阶段计数不一致引发阶段推进异常
- **约束**:
  - 需要保持 `thread_id` 稳定（同一 `session_id`），否则无法从 checkpointer 恢复中断点
  - `interrupt()` 所在节点在恢复时会从节点起点重跑，节点内副作用应保持幂等

### 2026-03 项目经历与面试复习材料补充

- **决策**: 新增项目经历沉淀文档 `项目经历复习.md`
- **动机**: 为简历撰写和面试表达提供统一口径，突出项目最核心的系统价值与架构亮点
- **提炼重点**:
  1. 项目核心不是普通 AI 问答，而是“持久化候选人画像”
  2. 重点强调“训练-评估-记忆-复习”闭环，而非功能堆砌
  3. 优先突出 LangGraph 状态机、Mem0 风格画像更新、RAG 检索、SM-2 复习调度、多用户隔离等架构能力
- **约束**:
  - 简历项目经历避免虚构业务指标
  - 优先使用可验证的实现事实，如 `40+ API 路由`、`10 道题批量评估`、`多用户隔离`
  - 面试表达需优先说明“为什么这样设计”，而不只是罗列技术名词

### 2026-03 简历项目经历压缩为 AI 双要点版

- **决策**: 将项目经历收敛为 2 条 AI 核心成果，并同步重写 `项目经历复习.md`
- **动机**: 简历阅读场景停留时间极短，需要优先突出 AI 相关系统价值，减少底层实现细节堆砌
- **调整原则**:
  1. 简历正文优先写“持久化候选人画像”与“RAG + 个性化训练闭环”
  2. 降低 BM25、SM-2、混合检索等细枝末节在简历正文中的比重
  3. 对缺少严格统计依据的数据表述保持克制，降低面试追问风险
