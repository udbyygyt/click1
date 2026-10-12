# dApp Store APK 构建

> 2026-10-12 更新：本页是原 Bubblewrap/TWA 方案。当前官方网页应用指南推荐 `solana-mobile webshell`；首次上架步骤、签名命令和现状见 [DAPP_STORE_PUBLISHING.md](DAPP_STORE_PUBLISHING.md)。保留旧工程用于对照，不把现有 Debug 指纹当作正式发布证书。

Click+1 当前是 PWA/TWA 路线。线上 Web Manifest 已发布在：

```text
https://click1.nfthubcity.xyz/manifest.webmanifest
```

## 1. 初始化 Bubblewrap 工程

在具备 Node.js、JDK、Android SDK 和 Android Build Tools 的构建机上执行：

```bash
npm install -g @bubblewrap/cli
mkdir -p android/twa
bubblewrap init --manifest="https://click1.nfthubcity.xyz/manifest.webmanifest" --directory="android/twa"
```

初始化交互中确认：

- Host：`click1.nfthubcity.xyz`
- Start URL：`/`
- Package ID：`xyz.nfthubcity.click1.twa`
- Name：`Click+1`
- Launcher name：`Click+1`
- Orientation：`portrait`
- Display：`standalone`

Bubblewrap 的 `twa-manifest.json` 使用 host、startUrl、packageId、图标、版本号和签名密钥生成 Android TWA 工程。后续修改配置应使用 `bubblewrap update`，不要手工改生成的 Gradle 文件。

## 2. Digital Asset Links

TWA 要保持全屏，需要把 dApp Store APK 签名密钥的 SHA-256 指纹发布到：

```text
https://click1.nfthubcity.xyz/.well-known/assetlinks.json
```

签名密钥和指纹生成后再填写该文件；不要把 keystore、密码或私钥提交到 Git。

## 3. 构建签名 APK

```bash
cd android/twa
bubblewrap build
```

构建后使用 `apksigner verify --print-certs` 检查签名，并在 Seeker 上安装测试。dApp Store 提交的是 APK，不是 AAB；后续更新必须继续使用同一个 dApp Store 签名密钥并递增 `versionCode`。

## 4. 发布前检查

- APK 可安装并打开 `https://click1.nfthubcity.xyz/`。
- Digital Asset Links 指纹与 APK 签名一致。
- Seeker 上 MWA 可调用 Seed Vault Wallet。
- 生产 API 返回 `mainnet-beta`。
- 付费撤回收款地址已配置并完成小额主网测试。
- 商店截图、英文描述、隐私政策、条款和支持页面已准备。

Bubblewrap 命令与字段参考：[Bubblewrap CLI 文档](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md)。Solana dApp Store 的 APK 签名要求参考：[Build and Sign an APK](https://docs.solanamobile.com/dapp-store/build-and-sign-an-apk)。
