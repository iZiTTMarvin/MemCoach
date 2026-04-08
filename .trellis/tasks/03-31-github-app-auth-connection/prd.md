# 子任务 PRD：GitHub 绑定、授权回调与连接状态

## 目标

为 MemCoach 引入 GitHub 连接能力，让用户能够通过授权流程把自己的 GitHub 账号接入系统，并在产品内看到稳定、可恢复的连接状态。

## 范围

- 发起 GitHub 授权
- 处理 GitHub 回调
- 保存当前用户的 GitHub 连接信息
- 查询当前连接状态
- 支持主动断连
- 处理授权失败、撤销和过期

## 不在范围内

- 拉取仓库列表
- 展示分支与范围选择器
- 创建项目分析任务
- 支持私有仓库实际分析

## 建议文件

- 修改 `backend/main.py`
- 修改 `backend/config.py`
- 参考 `backend/auth.py`
- 修改 `frontend/src/pages/ProjectAnalysis.jsx`
- 可新增 `frontend/src/api/githubConnection.js`

## 依赖

- 上游设计：`../03-29-github-project-interview-analyzer/prd.md`
- 被 `03-31-authorized-public-repo-discovery` 强依赖

## 完成标准

- 用户可以从项目分析入口发起 GitHub 绑定
- GitHub 回调成功后，系统能识别当前用户已连接 GitHub
- 前端能展示未连接、已连接、授权失败、已断连等状态
- 授权信息的存储模型可扩展到 Phase 2 私有仓库
