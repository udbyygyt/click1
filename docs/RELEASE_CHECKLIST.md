# Click+1 发布检查清单

## 代码和测试

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `docker compose config --quiet`
- [ ] `npm audit --omit=dev` 已人工复核；不要未经评估执行 `npm audit fix --force`

## 腾讯云服务器

- [ ] Ubuntu/Debian 系统已更新安全补丁。
- [ ] Docker Engine 和 Compose 插件已安装并可执行。
- [ ] 安全组只开放 80、443 和受限 SSH。
- [ ] PostgreSQL 不开放公网端口。
- [ ] 生产域名 DNS 已解析到服务器。
- [ ] `CLICK1_DOMAIN` 与 `ALLOWED_ORIGINS` 已设置为生产域名。
- [ ] `APP_ENV=production`，`SOLANA_CLUSTER=mainnet-beta`。
- [ ] `DATABASE_URL` 指向生产 PostgreSQL。
- [ ] `SOLANA_RPC_URL` 使用可靠的主网 RPC。
- [ ] `UNDO_TREASURY_ADDRESS` 为确认过的生产收款地址。
- [ ] `.env` 权限仅允许部署用户读取，未提交到仓库。
- [ ] `.dockerignore` 已排除 `.env`、钱包/签名密钥、`node_modules` 和本地构建产物。
- [ ] Caddy 已成功申请 HTTPS 证书。
- [ ] 若使用现有 Mailu：`HOSTNAMES` 包含 `mail.nfthubcity.xyz,click1.nfthubcity.xyz`，且 click1 证书 SAN 已验证。
- [ ] 若使用现有 Mailu：先完成 `./scripts/deploy-mailu.sh` dry run，再明确确认后使用 `--apply`。
- [ ] `/health` 和 `/health/db` 返回 200。
- [ ] `pg_dump` 每日备份到异地存储，并完成恢复演练。

## 钱包和支付验收

- [ ] Seed Vault Wallet 在 Seeker 上能完成 MWA 连接。
- [ ] SIWS 登录成功后得到 Cookie 会话。
- [ ] 刷新页面可恢复当前局。
- [ ] 新钱包创建当前局；同钱包重复进入恢复同一局。
- [ ] 新游戏二次确认后归档旧局。
- [ ] 点击、合并、下落、生成和计分符合需求文档。
- [ ] 撤回后不能连续撤回；新点击后可再次撤回。
- [ ] UTC 00:00 后免费撤回重新可用且不累计。
- [ ] 没有免费次数时显示 0.01 SOL 价格和网络费提示。
- [ ] 付款交易包含唯一 Memo。
- [ ] 服务端只在 finalized 交易验证通过后执行撤回。
- [ ] 用户取消、错误金额、交易失败、RPC 暂时不可用和客户端断线均不错误改变棋盘。
- [ ] 重复确认同一订单不会重复撤回。

## dApp Store 提交

- [ ] 生成独立 dApp Store 签名 APK，不能复用 Google Play 签名密钥。
- [ ] APK 版本号可递增，后续更新继续使用同一 dApp Store 签名密钥。
- [ ] 应用图标、截图、英文描述和预览视频已准备。
- [ ] Privacy、Terms、Support 页面使用生产域名并可访问。
- [ ] 商店文案说明 0.01 SOL 是游戏功能费用，不是下注或投资。
- [ ] 正常链上支付不可逆/不退款文案经过法律和官方开发者支持渠道复核。
- [ ] Publisher Account、个人 KYC/KYB 和发布钱包已完成。
- [ ] 发布前向 Solana Mobile `#dev-answers` 提交付费撤回流程请求预审。
