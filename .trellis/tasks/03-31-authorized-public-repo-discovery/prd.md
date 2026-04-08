# 子任务 PRD：已授权公开仓库发现与选择

## 目标

让用户在完成 GitHub 绑定后，直接在 MemCoach 中看到自己已授权的公开仓库列表，并通过搜索、分页与选择进入后续分析流程。

## 范围

- 拉取当前用户已授权的公开仓库
- 支持仓库搜索与分页
- 支持展示仓库基础元信息
- 支持选择仓库进入下一步
- 支持空列表、授权失效、API 失败等状态

## 不在范围内

- GitHub 绑定本身
- 分支与范围选择器
- 分析任务创建
- 结果工作区

## 建议文件

- 修改 `backend/main.py`
- 修改 `frontend/src/pages/ProjectAnalysis.jsx`
- 修改 `frontend/src/api/projectAnalysis.js`

## 依赖

- 强依赖：`03-31-github-app-auth-connection`
- 被 `03-31-branch-scope-discovery` 依赖

## 完成标准

- 用户连接 GitHub 后无需输入 URL 即可看到公开仓库列表
- 用户可基于搜索与分页找到目标仓库
- 选择仓库后可继续进入分支与范围步骤
- 空列表、连接失效和 API 错误有明确可恢复提示
