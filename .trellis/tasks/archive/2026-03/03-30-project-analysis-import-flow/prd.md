# 子任务 PRD：项目分析导入向导与进度流

## 目标

实现用户可直接操作的导入向导，把“仓库 URL、分支、负责范围、分析状态”组织成明确、低摩擦、可恢复的前端流程。

## 范围

- 新增项目分析入口页
- 仓库 URL 输入与校验
- 默认分支预选与手动切换
- 负责范围声明表单
- 创建分析任务
- 轮询并展示分析进度
- 完整覆盖 empty / validating / queued / running / failed / cancelled / completed 状态

## 不在范围内

- 结果工作区内容展示
- 项目经历草稿编辑体验
- 项目答题训练结果页入口

## 建议文件

- 修改 `frontend/src/App.jsx`
- 修改 `frontend/src/components/Sidebar.jsx`
- 新增 `frontend/src/pages/ProjectAnalysis.jsx`
- 修改 `frontend/src/api/interview.js` 或新增独立 API 模块

## 依赖

- 上游设计：`../03-29-github-project-interview-analyzer/prd.md`
- 强依赖：`03-30-project-analysis-orchestration-api`

## 完成标准

- 用户可以从侧边栏或首页进入项目分析入口
- 默认分支已预选，但允许切换
- 未填写负责范围时不能开始分析
- 状态流清晰，不出现长时间无反馈
- 失败态有明确错误文案和重试入口

