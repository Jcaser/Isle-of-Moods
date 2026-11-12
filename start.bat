@echo off
chcp 65001 >nul
title 清绪之屿 · SereneIsle
set "URL=http://127.0.0.1:4173/"
cd /d "%~dp0"

netstat -ano | findstr "127.0.0.1:4173" | findstr "LISTENING" >nul
if not errorlevel 1 (
  start "" "%URL%"
  exit /b 0
)

echo.
echo   清绪之屿正在靠岸，请稍等几秒……
echo.

if not exist "dist\index.html" (
  echo   首次运行，正在构建前端资源……
  call npm run build
)

rem 后台静默启动预览服务（独立进程，关掉本窗口也不会停）
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npx vite preview --port 4173 --strictPort --host 127.0.0.1' -WorkingDirectory '.' -WindowStyle Hidden" >nul 2>&1
if errorlevel 1 start "" /min cmd /c "npx vite preview --port 4173 --strictPort --host 127.0.0.1"

set /a N=0
:wait
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr "127.0.0.1:4173" | findstr "LISTENING" >nul
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
