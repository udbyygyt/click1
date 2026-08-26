# Click+1 部署与运维方案

## 1. 推荐架构

```text
Seeker TWA/PWA
      │ HTTPS
      ▼
腾讯云新加坡轻量服务器
  Caddy（TLS/反向代理）
  Fastify + TypeScript（API + 前端静态资源）
      │
      ├── PostgreSQL（Docker 内网）
      └── Solana mainnet-beta RPC Provider
```

你已有腾讯云新加坡轻量服务器，因此首版不需要 Render、Neon 或 Supabase，也不需要单独 Redis。当前局唯一性、每日免费撤回、支付订单幂等和账户删除都可以通过 PostgreSQL 事务、唯一索引和行锁完成。

## 2. 环境

### Development

- 客户端：`devnet`
- 服务端：devnet RPC
- 数据库：开发项目
- 支付：只使用测试钱包和测试收款地址

开发环境可在同一台服务器使用独立 Docker Compose project、独立数据库和 devnet 配置，不能复用生产数据库。

### Production

- 客户端：固定 `mainnet-beta`
- 服务端：mainnet-beta RPC
- 数据库：生产项目
- 收款：生产 Undo Treasury Address
- 不允许用户在应用内切换到 devnet

生产服务使用独立域名和生产数据库；Caddy 自动申请和续期 HTTPS 证书。

## 3. 必要环境变量

```text
APP_ENV=production
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://...
UNDO_TREASURY_ADDRESS=...
UNDO_PRICE_LAMPORTS=10000000
DATABASE_URL=postgres://...
SIWS_DOMAIN=...
ALLOWED_ORIGINS=https://your-production-domain.example
CLICK1_DOMAIN=your-production-domain.example
POSTGRES_PASSWORD=use-a-long-random-password
```

`UNDO_TREASURY_ADDRESS` 与 Publisher Wallet 默认分离。所有变量只配置在服务器受限权限的 `.env` 文件或 Docker Secret 中；前端只接收公开的网络和收款展示信息，不能接收数据库凭据或会话密钥。

如果使用 Compose 内置 PostgreSQL，`DATABASE_URL` 中的密码必须与 `POSTGRES_PASSWORD` 完全一致；生产部署前请替换示例密码并同步修改连接串。若使用外部数据库，则不要使用 Compose 内置数据库的默认连接串。

## 4. 数据库要求

至少需要以下表：

- `wallet_sessions`
- `games`（对 `wallet_address` 的活动局建立唯一约束）
- `game_moves`
- `daily_undo_entitlements`（`wallet_address + utc_date` 唯一）
- `undo_orders`（`undo_order_id` 和 `transaction_signature` 唯一）
- `account_deletion_requests`

支付确认、免费次数扣减和撤回执行必须在服务端事务中完成，避免交易确认重试导致重复撤回。

## 5. 发布和运维

1. 代码推送到 Git 仓库。
2. 腾讯云服务器拉取固定版本代码，执行 Docker Compose 构建。
3. 前端由 Fastify 静态服务提供，Caddy 将公网 80/443 请求反向代理到 Fastify 容器。
4. 只开放 80/443 和受限 SSH；PostgreSQL 端口不开放公网。
5. 配置健康检查：`GET /health`。
6. 配置数据库迁移在发布前执行。
7. 每日执行 `pg_dump`，加密后上传腾讯云 COS 或其他异地存储，并定期做恢复演练。
8. 使用 Docker/系统日志排查错误，配置日志轮转，不记录私钥、助记词或完整 SIWS 消息。
9. 每周检查磁盘、内存、数据库容量、RPC 错误率、支付异常和应用审核反馈。

### 一键部署脚本

服务器项目目录中准备好 `.env` 后，可执行：

```bash
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh
```

脚本位置：`scripts/deploy-production.sh`。它会校验 Compose、拉取 PostgreSQL/Caddy 镜像、构建 API（同时构建前端静态资源）、启动数据库/API/Caddy 并输出容器状态。脚本不会创建或读取钱包私钥。

## 6. 何时增加 Redis

只有出现以下需求时再增加 Redis：

- 多实例下的高频限流。
- 大量并发订单状态缓存。
- 排行榜或实时活动。
- 队列、定时任务或 WebSocket 广播。

首版引入 Redis 会增加一个需要付费、监控和备份的故障点，不符合个人开发者的最小运维目标。

## 7. 腾讯云服务器上线前检查

- 建议实例至少有 2 vCPU、2 GB RAM、40 GB SSD；不足时升级或拆分数据库。
- 配置安全组：公网只开放 80/443；SSH 仅允许固定 IP 或使用密钥登录。
- 禁止 PostgreSQL 直接暴露公网。
- 配置域名 DNS 指向服务器公网 IP。
- 配置 Caddy HTTPS 和自动续期。
- 配置服务器时区为 UTC，业务日期计算仍在应用代码中明确使用 UTC+0。
- 配置每日异地备份并完成一次恢复测试。
- 主网 RPC URL、数据库连接串、SIWS 密钥和收款配置只放服务器 Secret。
- `CLICK1_DOMAIN` 配置为生产域名；Caddy 才能为真实域名申请 HTTPS 证书。`localhost` 只用于本机测试。
- 开发时 Vite 5173 通过 `vite.config.ts` 将 `/api/*` 和 `/health` 代理到 Fastify 3000；生产构建由同一个 Fastify/Caddy 域名提供前端和 API，不使用开发代理。
- 当前 MWA SDK 依赖链在 `npm audit --omit=dev` 中报告了来自 React Native/Metro 和 Solana web3.js 的传递依赖告警；静态服务依赖也可能引入传递告警。它们不是本轮功能阻塞，但正式上线前必须复核 SDK 版本、影响范围和可升级版本，不能把审计告警直接忽略。
