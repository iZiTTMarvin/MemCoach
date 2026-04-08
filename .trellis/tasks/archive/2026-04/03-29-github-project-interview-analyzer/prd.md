# GitHub 项目分析官 Phase 1（GitHub 绑定公开仓库版）

## 背景

当前仓库里已经实现了一条“公开 GitHub URL -> 选分支 -> 手填负责范围 -> 分析 -> 结果页”的旧链路，并且沉淀了 `project_analyses`、archive 下载、过滤、结果页、训练桥接等可复用底座。

但产品目标已经明确调整：Phase 1 的正确入口不是继续打磨 URL 导入器，而是让用户先绑定 GitHub，再从自己已授权的公开仓库列表中选择项目，最后通过目录优先、文件补充的方式确认负责范围。Trellis 任务树必须同步到这个新方向，否则后续实现、检查、归档都会建立在错误的产品前提上。

## 新的 Phase 1 目标

在不支持私有仓库的前提下，完成以下闭环：

1. 用户在 MemCoach 中绑定 GitHub。
2. 系统展示该用户已授权范围内的公开仓库列表。
3. 用户选择仓库与分支，系统基于仓库树和关键文件内容生成负责范围候选。
4. 用户以“目录为主、文件为补充”的混合方式确认自己负责的范围。
5. 系统锁定一次确定的 `commit_sha` 并执行异步分析。
6. 系统输出带证据的项目问题、拆解报告、项目经历草稿，并提供进入项目答题训练的入口。

## 核心产品决策

- Phase 1 只支持 GitHub 绑定后的公开仓库，不支持私有仓库。
- 授权架构按 GitHub App 优先方向设计，避免 Phase 2 支持私有仓库时推倒重来。
- 主入口改为“绑定 GitHub -> 选仓库”，公开 URL 导入降级为迁移期兼容能力，不再是主产品路径。
- 范围选择采用混合模式：
  - 首屏展示系统推荐目录。
  - 用户可以展开目录并补充到文件粒度。
  - 未确认任何范围时，不允许开始分析。
- 一次分析只对应单个 `repo + branch + commit_sha + selected_scope_snapshot`。
- 结果页必须展示 `仓库 / 分支 / commit / 用户确认范围 / 分析时间`。
- 结果页必须有进入“项目答题训练”的明确入口。

## 范围内

- GitHub 绑定、回调、连接状态、断连
- 已授权公开仓库列表获取、搜索和选择
- 默认分支预选与手动切换
- 仓库树扫描与关键文件抽样
- 目录推荐 + 文件补充的负责范围选择器
- 基于仓库选择快照创建分析任务
- 复用现有 archive 下载、过滤、分析与结果页底座
- 项目分析结果到专项训练的桥接
- 当前导入链路的可靠性修复与迁移

## 不在范围内

- 私有仓库与组织级复杂权限治理
- PR / Issue / commit 历史分析
- 项目分析官对话
- 多仓库聚合画像
- 自动选择“最佳分支”
- 长期保存完整源码副本

## 现有可复用资产

- 用户认证与 `user_id` 隔离：`backend/auth.py`、`backend/config.py`
- 项目分析存储：`backend/storage/project_analyses.py`
- archive 下载、过滤与结果结构：`backend/project_analysis/`
- 结果页与训练桥接：`frontend/src/pages/ProjectAnalysisResult.jsx`、`backend/main.py`
- 页面入口和侧边栏壳子：`frontend/src/pages/ProjectAnalysis.jsx`、`frontend/src/components/Sidebar.jsx`

这些资产应在新路线下复用或改造，不应被视为废弃实现。

## 任务拆分

### 1. GitHub 连接

- 绑定 GitHub、授权回调、连接态持久化、断连
- 设计可扩展到私有仓库的授权模型，但 Phase 1 只消费公开仓库

### 2. 公开仓库发现

- 获取用户已授权公开仓库
- 提供仓库列表、搜索、分页、最近访问能力

### 3. 分支与范围发现

- 获取分支列表并默认预选默认分支
- 读取仓库树与关键文件
- 输出目录推荐与文件补充候选

### 4. 分析编排 V2

- 创建任务时不再依赖 `repo_url + 手填 owned_scopes`
- 改为接收 `repo selection snapshot + selected scopes`
- 锁定 `commit_sha` 并复用现有分析底座

### 5. 结果闭环

- 结果页展示 repo、branch、commit、ownership、evidence
- 维持项目问题、拆解、草稿、进入训练入口的闭环

### 6. 导入链路稳定性

- 修复现有 Windows 路径归一化问题
- 收口 archive / filtering / pipeline 错误
- 设计 URL 导入旧链路的降级或隐藏策略

## 推荐执行顺序

1. `03-31-github-app-auth-connection`
2. `03-31-authorized-public-repo-discovery`
3. `03-31-branch-scope-discovery`
4. `03-31-analysis-orchestration-v2`
5. `03-31-result-workspace-practice-bridge`
6. `03-31-import-pipeline-hardening` 与 3-5 并行推进

## 依赖关系

```text
github-app-auth-connection
  -> authorized-public-repo-discovery
    -> branch-scope-discovery
      -> analysis-orchestration-v2
        -> result-workspace-practice-bridge

import-pipeline-hardening
  -> analysis-orchestration-v2
  -> result-workspace-practice-bridge
```

## 迁移策略

- 03-30 的 5 个旧子任务已归档到 `.trellis/tasks/archive/2026-03/`
- 归档含义不是“没有产出”，而是“任务边界和产品路线已被替代”
- 迁移期间允许保留旧 URL 导入实现作为内部 fallback，但：
  - 不再作为用户主入口
  - 不再继续围绕旧入口新增子任务
  - 新功能与验证一律围绕 GitHub 绑定公开仓库版定义展开

## 成功标准

- 用户可以完成 GitHub 绑定，并看到自己的公开仓库列表
- 用户无需手输 URL 即可开始一次项目分析
- 默认分支已预选，且用户可切换分支
- 用户可通过目录推荐与文件补充确认负责范围
- 分析任务保存完整的仓库、分支、commit 与范围快照
- 结果页可解释，并能进入项目答题训练
- 当前截图中的路径错误不再出现
- Phase 2 增加私有仓库时，无需重建整体任务模型
