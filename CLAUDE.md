# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm run dev      # 开发服务器
npm run build    # 静态导出 → out/
npm run lint     # ESLint
```

无测试套件，改动后在浏览器手动验证。

## 架构概述

博文是一个**本地优先 PWA**，面向高中文言文备考。所有数据存储在浏览器 OPFS（源私有文件系统）中，通过 Web Worker 管理的 SQLite 实例读写。首次加载后完全离线可用。

### SQLite Worker 层（`lib/sqlite/`）

SQLite 连接由单一持久 Web Worker（`worker.ts`）独占持有。所有查询通过 `client.ts` 发送 RPC 消息，按数字 ID 关联响应。**组件中不要直接 import `worker.ts`**，始终使用 `client.ts` 导出或上层的 `lib/db.local.ts`。

- `client.ts` — 单例 RPC 客户端；任何查询前须调用 `ensureDatabaseReady()`
- `worker.ts` — 处理 `init`、`exec`、`query`、`transaction`、`seedShici` 消息
- `seed.ts` — 双轨种子：内置内容（立即执行）+ 实词300（懒加载，约 1.2 MB）

### 种子数据版本

两个版本号控制重新播种：
- `lib/sqlite/seed.ts` 中的 `BUILTIN_CONTENT_SEED_VERSION` — `public/seed/builtin-content.json` 有变化时 +1
- 实词种子有独立版本号，在同一文件中

播种使用 `INSERT OR IGNORE`，版本号触发重新执行但不会覆盖用户数据。

`public/seed/builtin-content.json` 是内置篇目/注释的**运行时数据源**。`lib/seed-data.ts` 仅作历史参考。

### Service Worker（`public/sw.js`）

Cache-first 策略。每次发布涉及任何被缓存资源（页面、组件、WASM、图标）时，**必须修改 `CACHE_VERSION`**（如 `"v3"` → `"v4"`）。不改则已安装用户永远看不到更新。

### 静态导出

`next.config.ts` 设置了 `output: "export"`，意味着：
- 无服务端渲染，无 API 路由
- 所有页面须可静态渲染
- `useSearchParams()` 必须包裹在 `<Suspense>` 内（构建时强制检查）

### 数据库 Schema（`lib/sqlite-schema.ts`）

Postgres→SQLite 类型映射：UUID→TEXT、BOOLEAN→INTEGER（0/1）、数组/JSONB→JSON TEXT。`db.local.ts` 中的行转换器负责类型转换。

核心表：`texts`、`annotations`、`sentences`、`recitation_questions`、`mistakes`、`shici_cards`、`shici_words/senses`、`meta`。

### 发版检查清单

1. 修改 `public/sw.js` 中的 `CACHE_VERSION`
2. 若种子数据有变动，同步修改对应版本号
3. `npm run build`，确认无报错
4. 将 `out/` 部署到托管平台
