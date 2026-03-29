# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary | Common Issues |
|----------|---------------|
| API ↔ Service | Type mismatches, missing fields |
| Service ↔ Database | Format conversions, null handling |
| Backend ↔ Frontend | Serialization, date formats |
| Component ↔ Component | Props shape changes |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

### Step 4: Name the Canonical Source

对每个跨层 feature，都必须先回答：

- 哪个模块是**唯一契约源**？
- 哪个地方定义接口路径？
- 哪个地方定义状态枚举？
- 哪个模型负责校验最终结果 schema？

如果这四个问题没有明确答案，就极容易出现：
- 后端正式存储一套字段
- pipeline fallback 又写一套字段
- 前端页面再猜一套字段名

最后每个子任务单独看似乎都“能跑”，整合后却全部错位。

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

### Mistake 4: Duplicate Truth

**Bad**:
- 正式 contract 已存在
- 业务编排层又自带 fallback schema
- 前端再自行兼容多套字段名

**Good**:
- 只有一个正式 contract
- 只有一个正式存储实现
- 前端通过统一 API 封装消费后端

### Mistake 5: Half-Wired Long Task Flow

**Bad**:
- 前端轮询 `/status`
- 后端只提供 `/resource/{id}`
- 结果页读取状态接口而不是结果接口
- CTA 调用不存在的 `/practice`

**Good**:
- 长任务最少显式定义 `create / status / result / cancel`
- 入口页、进度页、结果页、下一步动作页形成闭环
- running 态和 completed 态走不同但清晰的读取路径

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens
- [ ] 指定唯一契约源（模型 / 状态枚举 / API 封装）
- [ ] 对长任务显式列出 `create / status / result / cancel`
- [ ] 画出页面跳转链路（入口 → 进度 → 结果 → 下一步）

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip
- [ ] 核对前端调用路径与后端真实路由一一对应
- [ ] 确认没有 fallback store / fallback schema 与正式实现并存
- [ ] 确认测试不会遗留 `.tmp_*` 或 `data/*_test_*` 产物

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before
