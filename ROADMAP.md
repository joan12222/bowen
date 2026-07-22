# ROADMAP

> 项目真实进度源。README 写介绍与用法,本文件写会变化的进度。
> 最近更新:2026-07-22 · 当前版本 **1.4.1**(`CACHE_VERSION` v8)

## 当前阶段

实词 300 模块重构完成并本地验证,**尚未部署**。核心练习/错题闭环已重设计。

## 已完成(实现 + 验证)

本轮验证方式:`npm run build` 零错误 + Playwright 对 `out/` 产物端到端跑通。

- **实词练习覆盖式重设计**:进入某词覆盖其全部例句,选项 = 该词全部义项,答错重新入队直到全对;删除「随机练习」,仅从详情页「练习此词」进入(251.徐 义项<2 禁用)。
- **错题精确到例句级**:`referenceId = senseId#exampleIndex`,复习页显示答错时的那一句(彻底解决旧「只能显示首句」)。
- **错题本重做**:按词归类展示,每个词组一个「练习」入口只练该词;答对**弹窗询问**是否移除(确认才移除,取消保留),答错保留计数。
- **统一数据模型**:彻底删除遗留 `poem_cards`(表 + 死代码 + 备份映射 + seed 轨道),实词数据收敛为 `shici_words`/`shici_senses` 一套;老用户 DB 的孤儿表在 worker init 时 `DROP`。
- **修复**:练习卡换词不刷新(`key`);详情页上一/下一去除 `id<300` 硬编码,改按实际相邻 id。
- **版本**:`package.json` 1.3.1→1.4.1、`CACHE_VERSION` v6→v8;版本经 `NEXT_PUBLIC_APP_VERSION` 注入设置页显示。
- **wrangler 部署配置**(2026-07-22):新建 `wrangler.toml`(项目名 `bowen`、产物目录 `out`),`package.json` 加 `deploy` 脚本,wrangler `^4.112.0` 进 devDependencies。配置已就绪并确认 `wrangler --version` 可运行;**部署本身未执行**,端到端上线路径待验证。

## 待办

- **部署**(两条路径,**均属公开发布红线,需明确授权**):
  - Git 触发:`git push` 到 GitHub 即触发 Cloudflare Pages 云端构建上线,可按 commit 回滚。
  - wrangler 直传(本轮新增):`npm run deploy`(= `next build` + `wrangler pages deploy`),本地构建后直传,首次需 `npx wrangler login`。项目名默认 `bowen`,若 Cloudflare 已有站点用别名需改 `wrangler.toml`。
  - 用户端重开应用即自动获取(前提:发版清单已改 `CACHE_VERSION`/种子版本)。
- **提交**:实词重构轮已 commit + push(远端 HEAD `fdaf9a5`);wrangler 部署配置本轮提交。根目录 `AGENTS.md` 未跟踪,待确认处理。

## 明确不做(已与用户确认)

- 实词「掌握进度」持久化 / 全局覆盖进度:练习为单词级内存态,成果体现为错题本;换设备靠备份迁移。
- **注释/默写错题的分组与重做**:维持现状,仅实词可重做。
- **SRS 间隔调度**:`mistakes.next_review_at`/`review_count` 字段保留但不接,复习不按到期排序。
- **版本**:维持 1.4.1,不再升。

## 已清理

- 删除废弃历史文件:`scripts/export-builtin-data.mjs`(连已下线 Supabase 的一次性导出脚本)、`supabase/schema.sql`(旧 Postgres 后端 schema)及空的 `supabase/` 目录;同步清理源码里指向它们的悬空注释。

## 阻塞

- 无。

## 最近验证(2026-07-20)

Playwright(headless Chromium 对 `out/` 产物)全部通过:覆盖式练习全对完成、选项=全义项、答错入错题本、按词归类分组、按词练 confirm 接受→移除/取消→保留、备份导出恢复往返、无 `poem_cards`/SQL 运行时错误。
