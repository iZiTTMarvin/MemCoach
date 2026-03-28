# Changelog

## 2026-03-27
- **UI/UX**: 优化面试(Interview)页面的布局及字体大小。
  - 将主内容区最大宽度约束从 `max-w-[720px]`/`max-w-4xl` 扩大为 `max-w-[900px]`/`max-w-5xl`。
  - 调大了顶部状态栏、问题展示区、输入区、操作按钮及对话气泡(ChatBubble)中的字体和间距，增强了高压面试场景下的可读性。
  - 任务详情已归档至 `.trellis/changes/archive/002-interview-page-optimization.md`。

## 2026-03-26
- **UI/UX**: 优化全局核心页面（战力画像、主控台、战斗日志、知识库、录音复盘）的布局及字体大小。
  - 将主体内容区最大宽度约束扩大（如 `max-w-5xl` -> `max-w-7xl`，`max-w-4xl` -> `max-w-6xl`），充分利用大屏空间。
  - 全局提升各级标题和正文字体大小 1~2 个等级（如 `text-[10px]` 提升为 `text-xs`，`text-xs` 提升为 `text-sm`，以此类推），显著增强信息呈现的清晰度和可读性。
  - 更新了 `AGENTS.md` 记录本次架构与设计规范演进。
  - 任务详情已归档至 `.trellis/changes/archive/001-recording-page-optimization.md`。
