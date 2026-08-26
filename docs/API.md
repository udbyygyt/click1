# Click+1 API（当前实现）

## Authentication

### `POST /api/auth/nonce`

请求：

```json
{ "walletAddress": "SolanaBase58Address" }
```

返回待签名的 nonce message，有效期 10 分钟。

### `POST /api/auth/verify`

请求：

```json
{
  "walletAddress": "SolanaBase58Address",
  "nonce": "uuid",
  "signature": "base64DetachedSignature"
}
```

验证成功设置 30 天 `httpOnly`、`sameSite=lax` 会话 Cookie，并按 UTC+0 确保当天免费撤回权益存在。nonce 只能使用一次。Bearer token 仅保留给非浏览器 API 联调；前端生产路径不读取或持久化会话 token。

后续接口使用：

```text
Authorization: Bearer <token>
```

### `GET /api/auth/session`

使用 `click1_session` Cookie 检查浏览器会话，成功返回钱包公钥。浏览器刷新页面时用它恢复登录状态。

### `POST /api/auth/logout`

删除当前会话并清除 Cookie；不删除钱包的游戏数据。

## Current Game

### `POST /api/games/current`

- 没有当前局时创建一局。
- 已有当前局时直接恢复。
- 请求 `{ "replace": true }` 时归档旧局并创建新局。
- 同一钱包数据库层最多存在一局非 `abandoned` 游戏。

### `GET /api/games/current`

获取当前局；不存在时返回 404。

### `POST /api/games/current/moves`

```json
{ "row": 0, "col": 0, "clientMoveId": "uuid" }
```

服务端使用共享引擎执行点击、合并、下落、生成、计分和行动力变化，并原子保存操作快照。`clientMoveId` 用于网络重试幂等；同一个游戏中的同一 ID 只会执行一次。

## Undo

### `GET /api/account/daily-undo`

返回当前 UTC 日期及免费撤回是否可用。

### `POST /api/games/current/undo/free`

- 只撤回最近一步。
- 消耗当天免费权益。
- 撤回后 `canUndo=false`，必须有新点击才能再次撤回。
- 免费次数用尽后返回错误；客户端应改走付费报价接口。

### `POST /api/games/current/undo/paid/quote`

创建一笔绑定当前最后一步的 0.01 SOL 撤回订单。只有当天免费次数已用尽时才允许创建；订单包含唯一 Memo、收款地址和 `mainnet-beta` 网络。

### `POST /api/games/current/undo/paid/confirm`

```json
{ "orderId": "uuid", "transactionSignature": "base58Signature" }
```

服务端通过 Solana RPC 以 `finalized` 查询交易，并验证：付款人、收款人、10,000,000 lamports、System Transfer、唯一 Memo、交易无错误。验证成功后只撤回订单绑定的那一步；接口具备重复确认幂等性。RPC 不可用时返回 503，不改变游戏状态。

## Account

### `DELETE /api/account`

删除钱包关联的会话、nonce、当前局、操作快照、撤回订单和免费撤回权益。已发生的链上交易不会被删除或逆转；如需依法保留支付审计记录，应在部署时单独配置脱敏/保留策略。

## Health

- `GET /health`
- `GET /health/db`
- `GET /api/config`
