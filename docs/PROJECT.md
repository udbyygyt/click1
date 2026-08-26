# Click+1 for Solana Seeker 项目文档

## 1. 项目概述

Click+1 是面向 Solana Seeker 用户的英文优先数字合成益智游戏。玩家必须连接 Solana 钱包后开始游戏；每次点击使一个方块数字加 1，三个或更多正交相邻的同数字方块会合并。游戏提供每日一次免费撤回；免费次数用尽后，每次撤回可支付 0.01 SOL。首版不包含游客模式、公共排行榜、代币经济或玩家间资金输赢。每个钱包只保留一局当前游戏；上线后默认 Solana mainnet-beta，devnet 仅用于开发测试。

目标是以个人开发者可维护的最小范围完成一个可审核、可发布、可稳定运行的 dApp Store APK。

## 2. 产品边界

### 首版包含

- 钱包连接与 SIWS 登录。
- 6×6 数字棋盘、点击加 1、合并、连锁、下落和顶部生成。
- 单步撤回：每次操作最多撤回一步，撤回后必须先有新点击。
- 每个钱包按 UTC+0 每日获得 1 次免费撤回。
- 免费次数用尽后，支付 0.01 SOL 撤回一步。
- 英文默认界面，支持 English、简体中文、日本語。
- 本地当前局状态、服务器云存档和交易恢复；每个钱包只保留一局当前游戏。
- Seeker/Android 适配、签名 APK 和 dApp Store 发布材料。

### 首版明确不包含

- 游客模式。
- 公共排行榜、赛季排名和排名奖励。
- 代币发行、收益承诺、质押或玩家之间的下注/转账。
- 每次点击上链。
- 复杂 NFT 经济系统。
- 多人对战。

## 3. 技术路线

### 推荐实现

- 客户端：React + TypeScript + Vite PWA。
- 游戏渲染：CSS Grid 起步；粒子效果使用 Canvas 或 Lottie。
- 状态管理：Zustand 或等价轻量方案。
- 钱包：Solana Wallet Adapter + Mobile Wallet Adapter（MWA）+ SIWS。
- 服务端：Node.js + TypeScript + Fastify 5；首版不使用 NestJS，保持个人项目的依赖和维护成本可控。
- 数据库：PostgreSQL。
- 幂等、每日权益、当前局唯一性和订单状态首版使用 PostgreSQL 唯一约束与事务完成；达到流量需求后再增加 Redis。
- Solana RPC：上线默认 mainnet-beta；devnet 仅在开发/测试环境启用，服务端使用独立 RPC 凭据。
- APK：使用 Bubblewrap 将 PWA 包装为 TWA，输出签名 APK。

MWA 是 Solana Mobile 推荐的移动钱包连接协议，可兼容 Seed Vault、Phantom、Solflare 等 MWA 钱包。PWA 可以通过 TWA 包装成 dApp Store 所需的 Android APK。

### 组件边界

```text
client
  game-engine       纯函数规则、随机数、快照和重放
  game-ui            棋盘、HUD、撤回和支付弹窗
  wallet             MWA、SIWS、会话恢复
  i18n               en / zh-CN / ja 语言包
  effects            动画、粒子、音效

server
  auth               SIWS nonce、签名校验、会话
  games              开局、操作、存档、快照
  daily-entitlement  UTC+0 免费撤回次数
  undo-payments      订单、交易验证、幂等和状态恢复
  policy             限流、日志、账户删除
```

客户端和服务端必须共享同一个 `game-engine` 包，避免合并、下落、随机生成和分数计算不一致。

## 3.1 托管与服务器策略

个人开发者不需要购买物理服务器。推荐使用托管部署：

```text
腾讯云新加坡轻量服务器  Docker Compose
  ├── Fastify API（Caddy 负责 HTTPS）
  ├── PostgreSQL（仅内网/容器网络访问）
  └── 定时备份任务
Solana RPC Provider       主网 RPC
腾讯云 COS（推荐）        异地数据库备份
Cloudflare（可选）        DNS、缓存和基础防护
```

你已有腾讯云新加坡轻量服务器，因此首版不需要 Render、Neon 或 Supabase。新加坡机房适合作为面向全球 Seeker 用户的 API 节点；实际体验仍取决于用户网络和所选 Solana RPC 的位置。服务器应使用 Docker Compose 统一运行 API、PostgreSQL、Caddy 和备份任务。

首版部署建议：

- Fastify API：至少 1 个生产容器，必须通过 Caddy 使用 HTTPS。
- PostgreSQL：与 API 同机运行但不暴露公网端口；每日备份到不同存储位置。
- Redis：首版不部署；使用 PostgreSQL `UNIQUE`、行锁和幂等键处理并发。
- 主网 RPC：服务端使用专用 RPC URL，不把管理密钥放进 APK。
- 所有密钥通过服务器受限权限的 `.env`/Docker Secret 管理，不提交到代码仓库。

建议轻量服务器最低配置为 2 vCPU、2 GB RAM、40 GB SSD；如果当前实例低于此配置，先升级内存或拆分数据库。

自管服务器意味着你需要负责系统升级、TLS、备份、监控和故障恢复；但由于你已经拥有腾讯云实例，这比再购买托管 API 更经济。建议先使用 Docker Compose，后续再根据流量拆分数据库。

## 4. 核心数据对象

### GameState

- `gameId`
- `walletAddress`
- `board[6][6]`
- `score`
- `energy`
- `maxTile`
- `rngState`
- `lastMoveId`
- `canUndo`
- `status: playing | won | game_over`

分数采用合并输入数字总和：`3+3+3→4` 得 9 分，`4+4+4+4→5` 得 16 分；没有合并的点击不加分，连锁各轮分别相加。

### 账户与当前局约束

- 一个钱包地址最多存在一局 `playing` 状态的游戏。
- 开始新局前必须二次确认；确认后旧局归档为 `abandoned`，不能恢复为当前局。
- 服务器以钱包地址为唯一当前局索引，客户端本地状态不能覆盖服务器状态。

### MoveSnapshot

每次点击前保存一份快照，内容包括完整棋盘、分数、行动力、随机数状态和状态标志。撤回只允许恢复最近一份尚未撤回的快照。

### UndoOrder

- `undoOrderId`
- `walletAddress`
- `gameId`
- `moveId`
- `amountLamports = 10000000`
- `recipient`
- `network`
- `transactionSignature`
- `status: created | pending | confirmed | failed | expired`
- `createdAt / confirmedAt`

## 5. 安全和支付原则

- 私钥、助记词永远不进入应用或服务器。
- 应用只请求钱包授权、消息签名和明确的 SOL 转账。
- 服务器验证付款人、收款人、金额、网络、交易成功状态和唯一订单 Memo。
- 交易确认接口必须幂等，同一笔签名不能完成两次撤回。
- 交易已上链但客户端断线时，用户重新进入应用可恢复订单状态。
- 付费撤回不是下注，不向玩家返还资产，也不产生收益承诺。
- Publisher Wallet 用于 Publisher Portal、App NFT/Release NFT 和发布交易；Undo Treasury Address 用于接收 0.01 SOL 撤回费用。官方公开提交流程要求绑定发布钱包，但未规定必须与应用收款地址相同，因此本项目默认分离两者。
- 付费撤回按链上转账设计，原则上不可由应用撤销。应用可以声明正常支付不退款，但不能排除适用法律下的强制性消费者权利；重复扣款、技术故障或错误付款保留人工核查与补偿流程。
- Solana Mobile 条款对 dApp Store/Application Fees 写明通常不可逆且 Solana Mobile 不承担退款义务；这不等同于对本应用自有收款转账的预批准，因此上线前仍需把支付流程和退款文案提交官方开发者支持渠道确认。
- 收款地址、网络和退款/异常处理规则必须出现在隐私政策、帮助页和支付确认框中。

## 6. 发布路线

1. 完成规则引擎与自动化测试。
2. 完成英文 UI 和钱包登录。
3. 完成撤回、每日 UTC+0 额度和付费交易验证。
4. 完成动画、音效、断网和异常交易恢复。
5. 生成独立 dApp Store 签名 APK。
6. 准备图标、截图、描述、隐私政策和客服信息。
7. 在 Publisher Portal 创建应用并提交审核。

个人开发者可以申请 Publisher Account，但需要完成发布者资料和 KYC/KYB，并通过应用审核。发布流程和政策以官方文档为准：

- [Submit a New App](https://docs.solanamobile.com/dapp-store/submit-new-app)
- [Publisher Policy](https://docs.solanamobile.com/dapp-store/publisher-policy)
- [Build and Sign an APK](https://docs.solanamobile.com/dapp-store/build-and-sign-an-apk)
- [Mobile Wallet Adapter](https://docs.solanamobile.com/solana-mobile-stack/mobile-wallet-adapter)

## 7. 里程碑

### M1：规则原型（约 1 周）

- 纯逻辑棋盘。
- 合并、连锁、下落、生成和游戏结束。
- 快照与单步撤回。
- 固定随机种子重放测试。

### M2：可玩 MVP（约 1～2 周）

- 英文游戏界面。
- 钱包连接、SIWS 和会话恢复。
- 当前局云存档。
- 每日免费撤回。

### M3：支付和异常处理（约 1～2 周）

- 0.01 SOL 订单。
- 链上确认、幂等和断线恢复。
- 错误提示、客服入口和支付帮助页。

### M4：体验与发布（约 1～2 周）

- 三语言资源。
- 动画、粒子、音效和震动。
- Android/TWA 测试。
- 商店素材、隐私政策和发布审核。

## 8. 质量门槛

- 游戏规则自动化测试通过。
- 客户端与服务端对同一操作序列得到相同结果。
- 撤回后不能连续撤回；新点击后恢复撤回能力。
- UTC 00:00 切日测试通过。
- 每个钱包只能保留一局当前游戏；新局会归档旧局。
- 生产环境只连接 mainnet-beta，开发环境才允许 devnet。
- 重复支付、交易失败、交易成功后断线均有可恢复结果。
- 英文默认，中文和日语无缺失 key。
- Seed Vault、Phantom、Solflare 至少各完成一次真机/模拟器测试。
- 不记录私钥或助记词。
- APK 使用长期保管的独立签名密钥。
