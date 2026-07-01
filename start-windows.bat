@echo off
title Sjosund Nautholsvik - v15 stable
cd /d "%~dp0"
echo.
echo ===============================================
echo  Raesi Sjosund Nautholsvik v15 stable
echo ===============================================
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo VILLA: Node.js fannst ekki a tolvunni.
  echo Settu upp Node.js LTS af https://nodejs.org
  pause
  exit /b
)
start "" "http://localhost:3050"
node server.js
pause
