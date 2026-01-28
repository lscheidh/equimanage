@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules" (
  echo Abhängigkeiten installieren...
  call npm install
  echo.
)
echo EquiManage – Dev-Server starten...
echo Nach dem Start: http://localhost:3000 im Browser öffnen.
echo.
call npx vite
pause
