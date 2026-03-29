# 子任务 PRD：GitHub 仓库解析与快照过滤

## 目标

把公开 GitHub 仓库安全地转换成可分析的文本输入，覆盖 URL 解析、分支元信息、commit 锁定、archive 下载、安全解压与文件过滤。

## 范围

- 解析公开 GitHub 仓库 URL
- 获取仓库基础信息、默认分支、分支列表
- 将选定分支锁定到具体 `commit_sha`
- 下载该 commit 的 archive
- 做安全解压、防路径穿越
- 过滤依赖目录、二进制文件、超大文件、生成产物

## 不在范围内

- 数据库任务状态持久化
- 前端导入向导
- 结果产物生成
- 项目答题训练入口

## 建议文件

- 新增 `backend/project_analysis/github_source.py`
- 新增 `backend/project_analysis/filtering.py`
- 参考 `backend/config.py`
- 参考 `backend/indexer.py`

## 依赖

- 上游设计：`../03-29-github-project-interview-analyzer/prd.md`
- 可以与 `03-30-project-analysis-data-model` 并行推进
- 被 `03-30-project-analysis-orchestration-api` 依赖

## 完成标准

- 输入公开 GitHub URL 后，能返回仓库元信息和分支列表
- 输入分支后，能稳定锁定 `commit_sha`
- archive 下载和解压具备安全校验
- 过滤输出只保留高价值文本文件集合，并明确超限失败原因

