# BG Remover - MVP 需求文档

**版本：** v0.1  
**日期：** 2026-03-19  
**作者：** 张程铭

---

## 一、产品概述

### 背景
图片背景去除是设计师、电商运营、内容创作者的高频需求。市场上已有 remove.bg 等成熟工具，但存在价格较高、无法定制化的问题。本产品以 remove.bg API 为底层引擎，提供简洁易用的 Web 界面，快速验证用户需求与商业可行性。

### 目标用户
- 电商卖家（商品主图抠图）
- 设计师 / 自媒体创作者
- 普通用户（证件照、头像处理）

### 核心价值
> 上传即得，一键去背景，无需注册，免费体验。

---

## 二、MVP 范围

### 包含功能（Must Have）
| # | 功能 | 说明 |
|---|------|------|
| 1 | 图片上传 | 支持点击选择 & 拖拽上传，格式：JPG / PNG / WebP，大小 ≤ 12MB |
| 2 | 背景去除 | 调用 remove.bg API，返回透明背景 PNG |
| 3 | 对比预览 | 左原图 / 右结果，棋盘格展示透明区域 |
| 4 | 下载结果 | 一键下载去背景后的 PNG 文件 |
| 5 | 错误提示 | 文件格式/大小不符、API 失败时给出明确提示 |

### 不包含（Out of Scope for MVP）
- 用户注册 / 登录
- 使用次数限制 / 付费订阅
- 批量处理
- 自定义替换背景
- 历史记录
- 移动端 App

---

## 三、技术架构

```
用户浏览器
    │  上传图片（multipart/form-data）
    ▼
Cloudflare Pages（前端）
    │  index.html（纯静态，无构建）
    │  POST /remove-bg
    ▼
Cloudflare Worker（后端）
    │  转发请求 + 注入 API Key
    ▼
remove.bg API
    │  返回 PNG 二进制
    ▼
Worker → Pages → 用户下载
```

**技术选型：**
- 前端：原生 HTML + CSS + JS（无框架，零依赖）
- 后端：Cloudflare Worker（Edge 运行时）
- 图像处理：remove.bg API（`/v1.0/removebg`）
- 存储：无（全程内存处理）
- 部署：Cloudflare Pages + Workers（免费套餐）

---

## 四、页面设计

### 唯一页面：首页（`/`）

**状态流转：**
```
[上传区] → [处理中] → [结果展示]
                ↓
            [错误提示]
```

**上传区：**
- 拖拽区域 + "选择图片"按钮
- 提示支持格式与大小限制

**处理中：**
- Loading 动画
- 文案："正在处理，请稍候..."

**结果展示：**
- 左右对比图（原图 vs 去背景）
- "下载 PNG" 主按钮
- "重新上传" 次按钮

---

## 五、接口设计

### POST `/remove-bg`（Cloudflare Worker）

**请求：**
```
Content-Type: multipart/form-data
Body: image = <文件二进制>
```

**响应（成功）：**
```
Status: 200
Content-Type: image/png
Body: <PNG 二进制>
```

**响应（失败）：**
```
Status: 4xx / 5xx
Content-Type: application/json
Body: { "error": "错误描述" }
```

---

## 六、非功能需求

| 项目 | 指标 |
|------|------|
| 处理时长 | ≤ 10s（取决于 remove.bg 响应速度） |
| 支持图片大小 | ≤ 12MB |
| 浏览器兼容 | Chrome / Safari / Firefox 最新版 |
| 移动端适配 | 响应式布局，可用即可 |
| 可用性 | 依赖 Cloudflare & remove.bg SLA |

---

## 七、成功指标（MVP 验证）

| 指标 | 目标 |
|------|------|
| 上线时间 | 1 天内完成部署 |
| 功能完整性 | 上传 → 处理 → 下载全流程跑通 |
| 用户反馈 | 收集 10 个真实用户试用反馈 |
| 后续决策 | 根据反馈决定是否加入付费 / 批量 / 登录功能 |

---

## 八、部署计划

| 步骤 | 操作 | 预计时间 |
|------|------|----------|
| 1 | 注册 remove.bg，获取 API Key | 5 min |
| 2 | `wrangler deploy` 部署 Worker | 10 min |
| 3 | Dashboard 配置 `REMOVE_BG_API_KEY` 环境变量 | 5 min |
| 4 | 修改前端 `WORKER_URL`，上传到 Cloudflare Pages | 10 min |
| 5 | 端到端测试 | 15 min |

**总计：约 45 分钟上线**
