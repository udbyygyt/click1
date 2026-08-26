# Click+1

Solana Seeker 上的数字合成益智游戏。

## 当前状态

当前实现状态：

- Fastify + TypeScript API。
- `/health` 健康检查和 `/api/config` 配置接口。
- 共享游戏引擎的初始状态契约。
- Vitest 单元测试。
- Vite 网页入口。
- 腾讯云服务器 Docker Compose 与 PostgreSQL 基础配置。
- PostgreSQL schema migrations：`db/migrations/*.sql`。
- React/Vite 移动端界面：MWA 钱包连接与 SIWS 登录、英文默认、多语言切换、棋盘和撤回状态展示。
- 付费撤回订单、Solana finalized 转账验证和 MWA SOL 转账构建。
- Caddy + Fastify 静态资源服务和腾讯云 Docker Compose 生产入口。
- Cookie 会话、钱包登出、玩法说明、通关/结束状态和多语言法律页面。
- dApp Store TWA/APK 构建说明：`docs/APK.md`。

## 本地开发

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev:server
npm run dev:web
```

API 默认监听 `http://localhost:3000`。前端开发时设置 `VITE_SOLANA_CLUSTER=devnet`；生产构建会强制使用 `mainnet-beta`。
Vite 开发服务器会将 `/api/*` 和 `/health` 代理到 Fastify 3000 端口。

配置 `DATABASE_URL` 后，服务启动时会自动执行 `db/migrations/*.sql`；未配置数据库时仍可运行基础健康检查，`/health/db` 会返回未配置状态。

## 部署说明

复制 `.env.example` 为 `.env`，设置开发环境变量后运行：

```bash
docker compose --profile standalone up -d --build
```

独立服务器生产部署可使用 `scripts/deploy-production.sh`；本项目当前腾讯云服务器已有 Mailu 占用 80/443，应使用 `scripts/deploy-mailu.sh`。执行前必须完成生产 `.env`，不要把它提交到仓库。

生产环境使用 `mainnet-beta`，开发环境使用 `devnet`。不要把 `.env`、钱包私钥、助记词或生产密钥提交到代码仓库。

正式部署前请运行 `npm audit --omit=dev`，当前 MWA/Solana SDK 传递依赖存在需要复核的审计告警；不要在未评估影响的情况下使用 `npm audit fix --force`。
