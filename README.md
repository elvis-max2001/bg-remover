# BG Remover 部署指南

## 目录结构
```
bg-remover/
├── worker/          # Cloudflare Worker（后端）
│   ├── index.js
│   └── wrangler.toml
└── frontend/        # Cloudflare Pages（前端）
    └── index.html
```

---

## 1. 部署 Worker（后端）

```bash
cd worker
npm install -g wrangler   # 没装过的话
wrangler login
wrangler deploy
```

部署成功后会输出 Worker URL，类似：
`https://bg-remover-worker.<your-subdomain>.workers.dev`

**设置 API Key（重要）：**
在 Cloudflare Dashboard → Workers → bg-remover-worker → Settings → Variables
添加加密变量：`REMOVE_BG_API_KEY` = 你的 remove.bg API Key

---

## 2. 修改前端 Worker URL

打开 `frontend/index.html`，找到这行：
```js
const WORKER_URL = 'https://bg-remover-worker.<your-subdomain>.workers.dev/remove-bg';
```
替换为你实际的 Worker URL。

---

## 3. 部署前端到 Cloudflare Pages

方式一（推荐，直接拖拽）：
1. 打开 https://pages.cloudflare.com
2. 新建项目 → 直接上传
3. 把 `frontend/` 文件夹拖进去
4. 完成，获得 `https://xxx.pages.dev` 域名

方式二（Git 自动部署）：
1. 把代码推到 GitHub
2. Pages → Connect to Git → 选仓库
3. 构建命令留空，输出目录填 `frontend`

---

## 获取 remove.bg API Key

1. 注册 https://www.remove.bg/
2. 进入 Account → API Keys
3. 免费额度：50次/月（够测试用）
# Force rebuild
