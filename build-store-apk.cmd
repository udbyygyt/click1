@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-store-apk.ps1"
if errorlevel 1 echo APK build failed. Review the messages above.
pause
