# 子任务 PRD：分支选择与目录+文件混合范围发现

## 目标

把“负责范围确认”从手工 textarea 升级为目录优先、文件补充的混合选择流程，减少用户负担并提高结果可信度。

## 范围

- 获取仓库分支列表并默认预选默认分支
- 获取仓库树与关键文件内容
- 生成目录推荐候选
- 支持展开目录补充文件级选择
- 保存用户确认的范围快照
- 处理空树、超大树、推荐不足等异常状态

## 不在范围内

- GitHub 绑定
- 仓库列表拉取
- 真正创建分析任务
- 结果工作区

## 建议文件

- 修改 `backend/main.py`
- 修改 `backend/project_analysis/github_source.py`
- 可新增 `backend/project_analysis/scope_discovery.py`
- 修改 `frontend/src/pages/ProjectAnalysis.jsx`
- 修改 `frontend/src/api/projectAnalysis.js`

## 依赖

- 强依赖：`03-31-authorized-public-repo-discovery`
- 被 `03-31-analysis-orchestration-v2` 依赖

## 完成标准

- 默认分支已预选且可切换
- 页面首屏展示推荐目录
- 用户可展开并补充文件级选择
- 未选择任何范围时不能开始分析
- 范围选择结果可被后续分析任务直接消费
