# 子任务 PRD：导入链路稳定性修复与迁移底座

## 目标

在新产品路线推进之前，修复现有项目分析底座中的稳定性问题，尤其是当前截图暴露的 Windows 路径归一化错误，并为旧 URL 导入链路向新 GitHub 绑定路线迁移提供兼容层。

## 范围

- 修复 Windows 临时目录长短路径与 `relative_to()` 问题
- 收口 archive 下载与过滤阶段的错误分类
- 完善失败信息与重试入口
- 为旧 URL 导入链路设计兼容策略
- 补齐相关回归测试

## 不在范围内

- GitHub 绑定
- 仓库列表
- 范围选择器 UI
- 结果页视觉优化

## 建议文件

- 修改 `backend/project_analysis/filtering.py`
- 修改 `backend/project_analysis/pipeline.py`
- 修改 `backend/project_analysis/github_source.py`
- 修改 `backend/main.py`
- 新增或修改对应后端测试

## 依赖

- 上游设计：`../03-29-github-project-interview-analyzer/prd.md`
- 可与 `03-31-branch-scope-discovery`、`03-31-analysis-orchestration-v2` 并行

## 完成标准

- 截图中的路径错误可稳定复现并被修复
- archive / filtering / pipeline 的错误码更稳定
- 旧 URL 导入链路在迁移期不会导致主流程失真
- 关键失败路径有回归测试覆盖
