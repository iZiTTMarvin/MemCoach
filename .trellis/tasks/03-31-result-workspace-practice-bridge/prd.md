# 子任务 PRD：结果工作区与项目答题训练闭环

## 目标

确保 GitHub 绑定公开仓库版 Phase 1 仍然以结果工作区和项目答题训练闭环收口，而不是停在“仓库选择器”或静态报告。

## 范围

- 展示仓库、分支、commit、分析时间与用户确认范围
- 展示项目问题、证据、拆解报告与项目经历草稿
- 支持进入项目答题训练
- 处理失败态、低置信态、未完成态

## 不在范围内

- GitHub 绑定
- 仓库列表与范围选择器
- 分析 pipeline 核心实现

## 建议文件

- 修改 `frontend/src/pages/ProjectAnalysisResult.jsx`
- 修改 `frontend/src/api/projectAnalysis.js`
- 修改 `backend/main.py`
- 参考 `frontend/src/pages/Interview.jsx`

## 依赖

- 强依赖：`03-31-analysis-orchestration-v2`
- 受 `03-31-import-pipeline-hardening` 影响

## 完成标准

- 结果页能清晰展示新的仓库选择快照
- 每条问题仍然可展示证据
- 用户可以从结果页进入项目答题训练
- failed / weak-evidence / running 状态都有明确提示
