# 子任务 PRD：项目分析任务编排与 API

## 目标

把项目分析流程串成可轮询的后端长任务，并提供前端所需的最小 API：仓库解析、任务创建、状态轮询、结果获取。

## 范围

- 新增项目分析 resolve / create / status / result API
- 调用数据模型与 GitHub 源接入模块
- 实现最小可用的分析状态机
- 产出 questions、breakdown、resume_draft 的基础结果结构
- 在结果中保留 evidence 字段

## 不在范围内

- 导入向导 UI
- 结果工作区 UI
- 进入项目答题训练的最终前端交互

## 建议文件

- 修改 `backend/main.py`
- 新增 `backend/project_analysis/pipeline.py`
- 依赖 `backend/storage/project_analyses.py`
- 依赖 `backend/project_analysis/github_source.py`
- 依赖 `backend/project_analysis/contracts.py`

## 依赖

- 强依赖：
  - `03-30-project-analysis-data-model`
  - `03-30-github-repo-ingestion`

## 完成标准

- 前端可以创建一个分析任务并拿到 `analysis_id`
- 前端可以轮询状态直到 completed / failed / cancelled
- completed 结果至少包含 questions、breakdown、resume_draft、metadata、evidence
- 失败状态包含稳定错误码和可展示错误信息

