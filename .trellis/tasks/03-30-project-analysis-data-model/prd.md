# 子任务 PRD：项目分析数据模型与持久化

## 目标

为 GitHub 项目分析官 Phase 1 建立独立的数据模型、状态枚举与持久化模块，确保项目分析结果不污染现有 `sessions` 语义。

## 范围

- 新增 `project_analyses` 相关存储模块
- 定义分析状态、错误字段、结果 schema、evidence schema
- 定义用户级持久化目录与轻量分析包存放约定
- 启动时初始化所需表结构

## 不在范围内

- GitHub URL 解析与 archive 下载
- LLM 产物生成逻辑
- 前端页面与结果展示
- 项目答题训练入口

## 建议文件

- 新增 `backend/storage/project_analyses.py`
- 新增 `backend/project_analysis/contracts.py`
- 修改 `backend/main.py`
- 参考 `backend/storage/sessions.py`
- 参考 `backend/config.py`

## 依赖

- 上游设计：`../03-29-github-project-interview-analyzer/prd.md`
- 下游依赖本任务的子任务：
  - `03-30-github-repo-ingestion`
  - `03-30-project-analysis-orchestration-api`
  - `03-30-project-analysis-results-practice`

## 完成标准

- 可以创建、更新、查询一个项目分析任务
- 状态至少覆盖 `queued / fetching / filtering / analyzing / completed / failed / cancelled`
- 结果 schema 明确支持 questions、breakdown、resume_draft、evidence
- 不复用 `sessions` 表存储项目分析结果

