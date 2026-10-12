# Click+1：Solana dApp Store 首次上架操作手册

整理日期：2026-10-12。目标是完成正式签名 APK、应用资料、App NFT、Release NFT 和首次审核提交，最终在 Seeker 商店安装验证。

教程：[beeman 的上架视频](https://x.com/beeman_nl/status/2107974914955231687)，约 4 分 33 秒，2026-10-08 发布。已通过 VideoDB 转写语音，并核对注册、素材表单、应用保存和 release 页面关键帧。下文是操作归纳，不是逐字字幕；转写中的 “Depth Store”“unchained” 已分别按画面和上下文修正为 dApp Store、on-chain。

## 1. 视频每个步骤

| 时间 | 操作 | 本步骤完成的标志 |
| --- | --- | --- |
| 00:00 | 展示 Pocket Address 商店页；这是演示页，不是已公开上架的应用。 | 理解最终需要图标、横幅、说明、预览和安装入口。 |
| 00:16 | 准备可运行的 Android 应用；示例用 Expo + Mobile Wallet Adapter。 | 应用能连接钱包并执行自身功能；Click+1 保留现有网页游戏。 |
| 00:30 | 生成正式签名 release APK。 | 得到 APK 和签名验证结果；保存签名密钥，更新继续用同一密钥。 |
| 00:41 | 准备标题、描述、图标、横幅、截图与网站。 | 隐私政策、使用条款分别有独立公开 URL；网站与应用/开发者相关。 |
| 01:14 | 准备专用发布钱包并充值 SOL。 | 浏览器钱包可连接，足够支付上传和发布交易；保管好钱包访问权。 |
| 01:33 | 在 Publishing Portal 注册邮箱、姓名和密码，阅读协议，输入邮件验证码登录。 | 账号能登录。 |
| 01:47 | 创建 Publisher，选择个人或公司，填写名称和网站。 | 发布者资料真实，网站可公开访问。 |
| 02:09 | 个人完成 KYC，公司完成 KYB。 | 门户显示认证通过，能创建应用。 |
| 02:20 | 如认证卡住，到官方 Discord 的 dev-answers 创建 KYC/KYB 工单。 | 私人工单进入官方支持流程。 |
| 02:39 | 连接发布钱包，Add a dApp / New dApp，填写包名和全部应用资料。 | 表单校验通过，预览内容正确。 |
| 03:19 | 保存应用并签署创建 App NFT 的交易。 | 应用出现在门户列表，记录 App NFT 地址及交易结果。 |
| 03:29 | Releases / Home → New Version，上传 APK，填写 What's new，提交并签署发布请求。 | APK 上传完成，Release NFT 已创建，进入审核队列。 |
| 03:53 | 更新时用原签名密钥构建更高 versionCode 的 APK，再创建 New Version。 | 新 release 审核通过，商店显示新版本。 |
| 04:05 | 回顾准备、注册、应用资料、首发和更新。 | 后续 agent 自动发布不在本视频演示范围。 |

## 2. 实际执行顺序

先完成可安装 APK 与素材，同时注册和认证 Publisher；然后填写门户资料、创建 App NFT、上传正式 APK、提交 Release。进入审核只是提交成功；状态 Live 和 Seeker 商店安装成功才算上架跑通。

### 步骤 A：确认发布身份与联系方式

准备发布者名称、注册邮箱、公开客服邮箱和商店联系邮箱。个人选择 Individual 并使用个人真实身份认证；公司选择 Company 并按门户要求准备公司材料。客服邮箱可以与联系邮箱相同，但必须能收信。

不要使用视频中的 `example.com` 演示邮箱。Click+1 的 `/support` 当前仍有占位文案，需要换成实际邮箱和响应说明后发布。身份资料直接在官方认证页面填写，不保存到项目仓库。

### 步骤 B：正式签名 APK

应用包名固定为 `xyz.nfthubcity.click1.twa`；门户 Package Name 必须大小写一致。首次版本当前为 versionCode=1、versionName=1。Android 签名 keystore 与 Solana 发布钱包是两种不同材料。

首次发布专用密钥的生成命令示例：

也可双击根目录 `build-store-apk.cmd`：它检查工具、首次请求本人创建正式密钥、生成独立 WebView 工程、构建、验证签名并显示文件哈希；不会注册账号或提交钱包交易。密码在终端交互输入。以下命令是等价的分步操作。

```powershell
New-Item -ItemType Directory -Force E:\game1\keystores
& E:\Android\JDK17\bin\keytool.exe -genkeypair -v `
  -keystore E:\game1\keystores\click1-dapp-store.keystore `
  -alias click1-dapp-store -keyalg RSA -keysize 2048 -validity 10000
```

该命令由开发者在终端输入并保管密码与证书信息。如果指定文件已存在，先确认它是不是本应用的正式密钥，不另建或覆盖。备份 keystore、alias 和密码；不要复用 Google Play 签名密钥，也不要用 Android Debug 证书提交商店。

当前推荐采用官方 `solana-mobile webshell` 包装，独立目录保留现有 TWA 工程：

```powershell
cd E:\game1
$env:JAVA_HOME = 'E:\Android\JDK17'
$env:ANDROID_HOME = 'E:\Android\SDK'
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
npx solana-mobile@0.6.0 webshell init android/webshell `
  --manifest android/twa/twa-manifest.json `
  --app-name 'Click+1' --application-id xyz.nfthubcity.click1.twa `
  --version-code 1 --version-name 1 `
  --keystore-path E:/game1/keystores/click1-dapp-store.keystore `
  --keystore-alias click1-dapp-store
npx solana-mobile@0.6.0 webshell build android/webshell
```

执行前先创建并备份正式密钥；build 在终端请求密码。固定 CLI 版本以便复现，后续升级先核对官方变更。结果位于 `android/webshell/app/build/outputs/apk/release/app-release.apk`。

```powershell
& E:\Android\SDK\build-tools\36.0.0\apksigner.bat verify --print-certs `
  android/webshell/app/build/outputs/apk/release/app-release.apk
& E:\Android\SDK\build-tools\36.0.0\aapt.exe dump badging `
  android/webshell/app/build/outputs/apk/release/app-release.apk
Get-FileHash android/webshell/app/build/outputs/apk/release/app-release.apk -Algorithm SHA256
```

记录包名、versionCode、versionName、签名证书 SHA-256、APK SHA-256 和文件大小。签名验证必须成功，证书不能为 Android Debug。签名密钥丢失会影响后续更新。来源：[官方 APK 指南](https://docs.solanamobile.com/dapp-store/build-and-sign-an-apk)、[webshell 命令](https://docs.solanamobile.com/cli/webshell)。

### 步骤 C：Seeker 安装与功能验证

手机打开开发者选项与 USB 调试，连接电脑，确认手机上的授权提示。然后：

```powershell
& E:\Android\SDK\platform-tools\adb.exe devices
npx solana-mobile@0.6.0 device install android/webshell/app/build/outputs/apk/release/app-release.apk
```

验收：首次打开、游客试玩、连续点击和层层合成、下落补齐、计分/行动点、语言切换、返回键；Seed Vault Wallet 连接、消息签名登录、取消签名、刷新恢复；免费撤回、订单报价、断网和恢复；隐私、条款、支持链接。真实 0.01 SOL 支付由用户核对并签署，不能把“报价成功”当作“支付已验收”。

旧 TWA 和新 WebView 使用不同证书时不能直接覆盖安装。正式提交使用正确的发布证书，不通过降级签名来绕过安装失败；先决定测试应用数据是否需要保留。

### 步骤 D：准备商店资料和素材

可复制的 Click+1 文案见 [DAPP_STORE_LISTING.md](DAPP_STORE_LISTING.md)。视频 02:59 左右的门户显示：

| 字段 | 视频中的要求 / 本项目值 |
| --- | --- |
| App Name | Click+1；最终遵守门户字符校验。 |
| Package Name | `xyz.nfthubcity.click1.twa`，与 APK 完全一致。 |
| Subtitle | 50 字符上限；草稿为 `Tap, merge, and build bigger numbers`。 |
| Description | 准确描述现有功能及 0.01 SOL 付费撤回。 |
| Icon | 512×512px，必须有背景、无透明；已有 `android/twa/store_icon.png`，需确认画面与最终 APK 图标一致。 |
| Banner | 1200×600px，出现在商店详情顶部。 |
| Preview | 4–8 张；竖向 9:16 或横向；表单列出 JPG/PNG/GIF/WebP/MP4，图片最大 3MB，视频最大 30MB。实际以提交时门户为准。 |
| Language | 英文先完整验收；中文、日文按应用实际支持选择。 |
| Countries | 视频选全部国家，但本项目的发行范围需开发者决定，不照搬演示选择。 |
| Website | `https://click1.nfthubcity.xyz/`。 |
| Support Email / Contact Email | 待开发者提供真实可收信地址。 |
| Terms of Use | `https://click1.nfthubcity.xyz/terms`。 |
| Privacy Policy | `https://click1.nfthubcity.xyz/privacy`。 |

素材规格来自教程画面，不把截图中的示例值当作官方永久规则。截图必须反映提交版本，不伪造登录、支付或钱包确认成功的画面。

### 步骤 E：创建和认证发布者

打开 [Publisher Portal](https://publish.solanamobile.com/)，注册邮箱、姓名和密码；本人阅读并同意协议，验证邮件验证码。已有账号则直接登录。

选择 Individual / Company，填发布者名称与公开网站，完成 KYC / KYB。认证通过再创建应用。教程强调网站不可达、与发布者无关、条款/隐私链接失效是常见拒绝原因。遇到问题从官方文档顶部 Discord 入口进入，取得 Developer 角色后在 `#dev-answers` 选择 KYC/KYB Verification Issues 创建私人工单。

### 步骤 F：连接专用发布钱包与存储

在本人控制的浏览器扩展钱包创建/选择专用发布账号，保存好恢复方式；不向 agent 或网站提供助记词。它用于 App NFT、Release NFT 和后续版本，不等同于付费撤回的收款地址。

连接门户后核对钱包。当前官方文档建议约 0.2 SOL 的可用资金，实际费用受 APK/素材大小影响，以门户估算和钱包确认金额为准。推荐的 ArDrive 还有存储余额，必要时通过 Top Up Balance 充值；也可按门户支持配置自己的 S3。视频没有展示这一独立存储配置，所以这是当前文档补充。来源：[首次提交](https://docs.solanamobile.com/dapp-store/submit-new-app)。

### 步骤 G：创建应用与 App NFT

Add a dApp → New dApp，按步骤 D 填写并上传，检查右侧商店预览。核对包名、钱包、邮箱、发行地区和链接。Save 时本人核对并签署创建 App NFT 的链上请求，完成后记录应用 ID、App NFT mint、发布钱包公钥和交易签名；私钥不进入记录。

### 步骤 H：提交首次 Release

应用 Home / Releases → New Version；上传步骤 B 验证过的正式 APK；填写 What's new。核对应用和版本后 Submit，门户会触发存储上传和 Release NFT 等请求，逐个完成本人钱包确认。

记录 APK 文件哈希、版本、Release NFT、提交时间、portal 状态。上传中断/某个签名被取消时先检查 portal 状态再重试，避免把缺少资源的 release 当作提交成功。来源：[首次提交](https://docs.solanamobile.com/dapp-store/submit-new-app)。

### 步骤 I：审核与上架验收

官方目前说明通常 3–5 个工作日，结果发至开发者邮箱；这是常见处理窗口，不是保证。拒绝时按反馈修正并重新提交。超过 5 个工作日未收到结果，可通过 `#dev-answers` 的 App Review Inquiry 查询。

审核通过后检查状态 Live，并在 Seeker 商店搜索 Click+1、核对发布者与图标、安装、连接钱包、试玩。只有完成这些才记录为“已上架”。

### 步骤 J：后续版本更新

原 Publisher 账号、原发布钱包和原 Android 签名密钥继续使用；递增 versionCode，更新 versionName 与 What's new，再走 New Version。

如果只是修改商店资料，官方支持 use existing APK；资料仍需随 release 审核通过后反映到商店。WebView 加载线上网页，网页改动会随部署更新，但不能用这一机制绕过商店政策或宣称新 APK 已审核。来源：[提交更新](https://docs.solanamobile.com/dapp-store/submit-an-update)。

## 3. 2026-10-12 已实测状态

| 项目 | 实测结果 | 下一步 |
| --- | --- | --- |
| Publisher 账号 / KYC / 发布钱包 | 用户确认尚未准备。 | 本人注册、认证、准备专用钱包。 |
| JDK / Android SDK | JDK 17.0.16；SDK 在 `E:/Android/SDK`，Build Tools 36.0.0；doctor 检查可构建。 | 无需重新安装。 |
| 手机连接 | `adb devices` 没有设备。 | 连接 Seeker，完成真机验收。 |
| TWA release 构建 | `gradlew.bat assembleRelease` 成功；生成约 885KB 未签名 APK。 | 未签名文件不能提交。 |
| Android 发布密钥 | 项目没有正式 keystore；现有调试密钥只用于构建实验。 | 创建并备份正式密钥。 |
| WebView 包装 | `solana-mobile@0.6.0` 生成并构建成功；`output/dapp-store/webshell-proof/app/build/outputs/apk/release/app-release.apk`，2,091,395 字节。 | 这是调试证书签名的 release 验证包，不可上传商店；正式工程使用发布证书。 |
| 生产健康/配置 | `/health`、`/api/config` 均 200；mainnet-beta、撤回报价 10,000,000 lamports。 | 真机验证钱包与支付。 |
| 生产网页 | 主页、privacy、terms、support、manifest 均 200。 | 客服占位文案要补齐；响应 200 不代表内容符合审核。 |
| 前端线上版本 | JS 仍为 `/assets/index-BTBKHShU.js`，与历史线上包一致。 | 本轮动画修复仍在本地，提交前部署并验收。 |
| Digital Asset Links | 200，但指纹匹配现有 `Android Debug` 证书。 | 不能当作发布签名已经完成；若继续 TWA 要改为正式证书，新 webshell 不要求 DAL。 |
| 图标 | 已有 512×512 PNG。 | 配套横幅、正式截图、文案待最终确认。 |

构建验证细节：WebView APK 的包名为 `xyz.nfthubcity.click1.twa`，versionCode=1、versionName=1，minSdk=28、targetSdk=37。现有 TWA 则为 minSdk=21、targetSdk=36。官方 WebView 模板在本机成功编译；没有连接设备，因此安装和钱包测试仍未完成。

验证包 `apksigner verify --print-certs` 通过，但证书为 Android Debug；APK SHA-256 为 `C99EEB40D6B72BA13F35D452E7E406F4D0563F041C71FB8C0A7E9B34A4CD7F6E`。该包只验证构建通路，正式发布不能复用这张调试证书。

首次下载 Gradle 9.7.1 在 Java 中超时；已从官方发行地址下载 zip 并核对模板要求的 SHA-256 `acd53f1edaf02f1a8ff99879f8a34b302661a057d9b063ae9e35b552f804d20a`，仅在实验目录把 wrapper 指向校验后的本地 zip。最终构建耗时约 5 分 29 秒，有模板中的弃用/原生库符号处理警告；并非零警告构建。正式脚本仍使用模板官方 wrapper。

已生成 `output/dapp-store/assets/` 中的 1200×600 横幅和四张 450×800（9:16）网页预览；每个 PNG 小于 40KB。它们供审核文案/视觉草稿查看，发布前用最终 APK 真机截图替换网页截图。

## 4. 包装方案选择依据

项目旧文档使用 Bubblewrap/TWA。当前官方 Web App 指南改为 WebView shell，原生处理钱包 intent，不要求 Digital Asset Links，并提示 TWA 可能受 Local Network Access 限制。旧工程保留，先在独立验证目录检查新方案。

当前依赖树已有 `@solana-mobile/wallet-standard-mobile@0.6.0`，满足文档对版本的最低要求；但 `wallet.ts` 直接使用旧 adapter API，尚不能据此证明 shell 中实际消息签名与付费交易已通过。需要 Seeker 端到端验收后决定是否调整接入方式。

来源：[Web App 构建](https://docs.solanamobile.com/dapp-store/build-and-sign-an-apk)、[Local Network Access](https://docs.solanamobile.com/recipes/mobile-wallet-adapter/local-network-access)。

## 5. 下一次接续时的顺序

1. 确定发布者身份和真实邮箱，开始 Publisher 注册 / KYC。
2. 创建并备份正式 Android 签名密钥，跑正式 WebView APK 构建和签名验证。
3. 配置支持页面，部署当前修复，连接 Seeker 测试并拍最终截图。
4. 确认商店草稿和发行地区，准备发布钱包资金，填写应用表单。
5. 本人完成 App NFT / Release NFT 钱包签名，提交审核，保存证据。

本文没有宣称账号注册、KYC、真实支付、App NFT 或 Release NFT 已完成。钱包转账、链上发布签名、账号密码设置及协议接受由用户在自己的界面完成。
