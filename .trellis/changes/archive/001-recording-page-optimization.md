# 任务：优化全局页面布局及字体

## 背景
用户反馈前端页面主体内容区过窄，且各模块的字体整体偏小，可读性不佳。已经完成了 `Profile.jsx`、`Home.jsx`、`History.jsx`、`Knowledge.jsx` 的优化。

## 当前需求
1. 对 `RecordingAnalysis.jsx` (复盘 RECORDING) 进行同样的布局扩宽和字体放大优化。
2. 严格遵循 `xspec` 技能的工作流：使用 Trellis 目录结构进行任务管理和记录，确保操作历史有迹可循。

## 执行计划
1. 初始化 Trellis 工作区（已完成 `tasks`, `spec`, `workspace` 目录的创建）。
2. 在 `.trellis/tasks/` 下记录当前正在执行的 `RecordingAnalysis` 优化任务。
3. 修改 `frontend/src/pages/RecordingAnalysis.jsx`：
   - 将约束容器扩大（例如 `max-w-4xl` 或 `max-w-5xl` 改为 `max-w-6xl` 或 `max-w-7xl`）。
   - 全局提升各级标题和正文字体 1~2 个等级。
   - 相应放大按钮、图标等元素的尺寸。
4. 验证修改。
5. 更新 `CHANGELOG.md` 并在 `.trellis/tasks/` 下将该任务标记为归档/完成。
