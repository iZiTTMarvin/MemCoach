# 子任务 PRD：结果工作区与项目答题训练入口

## 目标

把项目分析结果组织成可消费的工作区，并把用户从“看结果”顺畅带回 MemCoach 的训练主线，完成 Phase 1 闭环。

## 范围

- 结果工作区页面
- Questions / Breakdown / Resume Draft 分区展示
- evidence 展示入口
- 结果页 metadata 展示（repo / branch / commit / analysis time）
- 进入项目答题训练入口
- 按测试计划完成 Phase 1 端到端验收

## 不在范围内

- GitHub OAuth
- 多仓库管理
- 项目分析官对话
- PR / Issue / commit 历史分析

## 建议文件

- 新增 `frontend/src/pages/ProjectAnalysisResult.jsx`
- 修改 `frontend/src/api/interview.js` 或对应 API 模块
- 修改 `frontend/src/pages/Interview.jsx` 或新增训练入口桥接逻辑
- 必要时修改 `backend/main.py`

## 依赖

- 强依赖：
  - `03-30-project-analysis-orchestration-api`
  - `03-30-project-analysis-import-flow`
- 参考测试计划：
  - `C:\\Users\\xuhaochen\\.gstack\\projects\\MemCoach\\xuhaochen-main-test-plan-20260330-003536.md`

## 完成标准

- 结果页可以稳定展示 questions、breakdown、resume_draft 和 evidence
- 用户能一眼看到本次分析基于哪个 repo / branch / commit
- 用户可以从结果页直接开始一次项目答题训练或等价练习
- Phase 1 的关键成功标准至少在手工验收层面跑通一遍
