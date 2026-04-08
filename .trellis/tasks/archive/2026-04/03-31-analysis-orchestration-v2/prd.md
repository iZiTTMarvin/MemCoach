# 子任务 PRD：项目分析编排 V2 与任务输入契约升级

## 目标

在尽量复用现有 `project_analyses`、archive 下载、过滤与结果生成底座的前提下，将分析任务输入改成新的仓库选择模型，并确保任务状态、错误收敛与结果契约保持稳定。

## 范围

- 升级分析任务创建输入
- 保存仓库、分支、commit 与范围快照
- 保留并改造现有状态机
- 保持结果契约对结果页与训练入口可用
- 处理连接失效、分支失效、范围空集等错误

## 不在范围内

- GitHub 绑定
- 仓库列表页面
- 范围选择器本身
- 结果页视觉优化

## 建议文件

- 修改 `backend/main.py`
- 修改 `backend/project_analysis/pipeline.py`
- 修改 `backend/project_analysis/contracts.py`
- 修改 `backend/storage/project_analyses.py`

## 依赖

- 强依赖：`03-31-branch-scope-discovery`
- 被 `03-31-result-workspace-practice-bridge` 依赖
- 受 `03-31-import-pipeline-hardening` 影响

## 完成标准

- 创建分析任务时不再依赖手填 `owned_scopes`
- 分析任务记录完整保存 `repo / branch / commit / selected_scope_snapshot`
- 状态机仍支持 queued / fetching / filtering / analyzing / completed / failed / cancelled
- 结果页与训练桥接仍可消费新结果契约
