param(
    [string]$JdkPath = 'E:\Android\JDK17',
    [string]$SdkPath = 'E:\Android\SDK',
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$shellProject = Join-Path $projectRoot 'android\webshell'
$keyDirectory = Join-Path $projectRoot 'keystores'
$keyFile = Join-Path $keyDirectory 'click1-dapp-store.keystore'
$keyAlias = 'click1-dapp-store'
$javaBinary = Join-Path $JdkPath 'bin\java.exe'
$keytoolBinary = Join-Path $JdkPath 'bin\keytool.exe'
$apkSigner = Join-Path $SdkPath 'build-tools\36.0.0\apksigner.bat'
$apkInspector = Join-Path $SdkPath 'build-tools\36.0.0\aapt.exe'
foreach ($required in @($javaBinary, $keytoolBinary, $apkSigner, $apkInspector)) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Required tool not found: $required" }
}
$npmRunner = (Get-Command npx.cmd -ErrorAction Stop).Source
Write-Host 'Build tools are available. Release keys and wallet keys are separate.'
if ($CheckOnly) {
    Write-Host "Release keystore exists: $(Test-Path -LiteralPath $keyFile)"
    return
}

$previousJava = $env:JAVA_HOME
$previousSdk = $env:ANDROID_HOME
$previousPath = $env:PATH
Push-Location $projectRoot
try {
    $env:JAVA_HOME = $JdkPath
    $env:ANDROID_HOME = $SdkPath
    $env:PATH = "$JdkPath\bin;$SdkPath\platform-tools;$previousPath"
    if (-not (Test-Path -LiteralPath $keyFile)) {
        New-Item -ItemType Directory -Path $keyDirectory -Force | Out-Null
        Write-Host 'Create the release key below. Enter the password yourself and save a secure backup.'
        & $keytoolBinary -genkeypair -v -keystore $keyFile -alias $keyAlias -keyalg RSA -keysize 2048 -validity 10000
        if ($LASTEXITCODE -ne 0) { throw 'Release key creation failed.' }
    }
    if (-not (Test-Path -LiteralPath $shellProject)) {
        & $npmRunner --yes solana-mobile@0.6.0 webshell init $shellProject `
            --manifest 'android/twa/twa-manifest.json' --app-name 'Click+1' `
            --application-id 'xyz.nfthubcity.click1.twa' --version-code 1 --version-name 1 `
            --keystore-path $keyFile --keystore-alias $keyAlias
        if ($LASTEXITCODE -ne 0) { throw 'WebView project generation failed.' }
    }
    & $npmRunner --yes solana-mobile@0.6.0 webshell build $shellProject --keystore-path $keyFile --keystore-alias $keyAlias
    if ($LASTEXITCODE -ne 0) { throw 'APK build failed.' }
    $apk = Join-Path $shellProject 'app\build\outputs\apk\release\app-release.apk'
    & $apkSigner verify --print-certs $apk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    & $apkInspector dump badging $apk
    if ($LASTEXITCODE -ne 0) { throw 'APK inspection failed.' }
    Get-FileHash -LiteralPath $apk -Algorithm SHA256
    Write-Host "Signed APK: $apk"
    Write-Host 'Test this APK on Seeker before submitting it. Back up the release keystore and password.'
}
finally {
    $env:JAVA_HOME = $previousJava
    $env:ANDROID_HOME = $previousSdk
    $env:PATH = $previousPath
    Pop-Location
}
