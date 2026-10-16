@echo off
setlocal
title Click+1 Local Launcher
pushd "%~dp0"
if errorlevel 1 goto failed

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found. Install Node.js and try again.
    goto failed
)
where npm >nul 2>nul
if errorlevel 1 (
    echo npm was not found. Check your Node.js installation.
    goto failed
)

if not exist "node_modules\.bin\vite.cmd" goto install
if not exist "node_modules\.bin\tsx.cmd" goto install
goto launch

:install
echo Installing project dependencies...
call npm ci
if errorlevel 1 goto failed

:launch
echo Starting API and web development servers...
echo The browser will open when Vite is ready.
echo Default URL: http://127.0.0.1:5175/
echo If that port is busy, Vite will choose another and open its URL.
echo To stop: press Ctrl+C in BOTH server windows.
start "Click+1 API" /D "%~dp0" cmd /k "npm run dev:server"
start "Click+1 Web" /D "%~dp0" cmd /k "npm run dev:web -- --host 127.0.0.1 --port 5175 --open"
popd
exit /b 0

:failed
echo Local startup failed. See the message above.
pause
popd
exit /b 1
