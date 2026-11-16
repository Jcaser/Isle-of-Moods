@echo off
chcp 65001 >nul
title 清绪之屿 · SereneIsle
set "URL=http://127.0.0.1:8787/"
cd /d "%~dp0"

rem 已经在跑就直接开浏览器（页面、岛主 AI、语音合成都在这一个端口后面）
netstat -ano | findstr "127.0.0.1:8787" | findstr "LISTENING" >nul
if not errorlevel 1 (
  start "" "%URL%"
  exit /b 0
)

echo.
echo   清绪之屿正在靠岸，请稍等几秒……
echo.

if not exist "node_modules" (
  echo   首次运行，正在安装依赖……
  call npm install
)

if not exist "dist\index.html" (
  echo   正在构建前端资源……
  call npm run build
)

rem 后台静默启动本地代理：页面 + /api（岛主 AI）+ /api/tts（岛主之声）
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'node' -ArgumentList 'server/proxy.mjs' -WorkingDirectory '.' -WindowStyle Hidden" >nul 2>&1
if errorlevel 1 start "" /min cmd /c "node server/proxy.mjs"

set /a N=0
:wait
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr "127.0.0.1:8787" | findstr "LISTENING" >nul
if not errorlevel 1 goto open
set /a N+=1
if %N% lss 40 goto wait

echo.
echo   启动超时：请在项目目录手动执行  npm install  后重试。
echo   目录：%~dp0
echo.
pause
exit /b 1

:open
echo   已就绪 -^> %URL%
start "" "%URL%"
ping -n 3 127.0.0.1 >nul
exit /b 0
