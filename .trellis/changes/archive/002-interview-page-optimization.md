# 任务：优化面试/专项强化界面布局及字体

## 背景
接续上一个全局布局优化任务，发现 `Interview.jsx`（面试及专项强化界面）同样存在主内容区过窄、字体偏小的问题。

## 目标
1. 扩大 `Interview.jsx` 的主内容约束容器，使其在宽屏下能更好地利用空间。
2. 调大顶部状态栏、问题展示区、输入区、操作按钮等的字体，提升可读性。
3. 确保符合深空科幻主题的设计规范。

## 计划
1. 读取并分析 `frontend/src/pages/Interview.jsx`。
2. 修改其中的布局宽度（如 `max-w-4xl` 修改为 `max-w-6xl`）。
3. 全局替换并放大文本相关的 Tailwind 类名（如 `text-[10px]` -> `text-xs`, `text-xs` -> `text-sm`, `text-sm` -> `text-base` 等）。
4. 验证修改。
5. 更新 `CHANGELOG.md` 及 `AGENTS.md`。
6. 归档此任务文件。
