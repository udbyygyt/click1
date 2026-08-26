# Click+1 生产状态

## 当前线上地址

```text
https://click1.nfthubcity.xyz
```

## 已部署版本

- Git commit：`7a36237 fix: omit empty JSON content type`
- 部署目录：`/root/click1`
- 服务器：腾讯云新加坡轻量服务器
- 系统：OpenCloudOS 9.4
- API：Node.js 22 + Fastify
- 数据库：Click+1 独立 PostgreSQL 容器
- 前端入口：Mailu HTTPS 前端代理到 Click+1 API
- 生产网络：`mainnet-beta`

## 线上验证结果

- `/health`：200，`environment=production`
- `/api/config`：200，`cluster=mainnet-beta`
- `/`：200
- `/manifest.webmanifest`：200
- `/privacy`、`/terms`、`/support`：200
- `/.env`、`/.env.example`、未知路径：404
- ACME HTTP-01 testing：204
- Mailu front：healthy
- Click+1 PostgreSQL：healthy
- 当前 API 已包含离线点击队列：断网可继续点击，恢复网络后自动顺序同步；撤回始终要求联网。

## 支付验证

已用临时无资金钱包从外部完成：

1. SIWS 登录。
2. 创建当前游戏。
3. 执行一次点击。
4. 消费一次免费撤回。
5. 再次点击。
6. 创建付费撤回报价。
7. 验证金额为 10,000,000 lamports、网络为 `mainnet-beta`、收款地址匹配。
8. 删除临时账户数据。

这次验证没有签署或发送真实 SOL 转账，因此尚未证明用户钱包在 Seeker 上的真实 MWA 转账确认体验。

## 尚未完成

- 在 Seeker 真机上连接 Seed Vault Wallet 并完成 SIWS。
- 使用真实用户钱包签署一次 0.01 SOL 主网撤回交易。
- 生成独立 dApp Store 签名 APK。
- 生成并发布 Digital Asset Links 指纹。
- 完成 Solana dApp Store Publisher Portal 提交和审核。

## 运维注意

- 不要启动 `/root/click1` 的 standalone Caddy profile；80/443 由 Mailu 使用。
- 使用 `docker-compose.mailu.yml` 和 `scripts/deploy-mailu.sh` 更新 Click+1。
- `/root/click1/.env` 只存在服务器，不得提交到 Git。
- Mailu 配置备份位于 `/mailu/mailu.env.backup.20260826T110224Z` 和对应 override 备份目录。
- GitHub PAT 曾在聊天中暴露，必须撤销并改用新的安全凭据或 SSH deploy key。
