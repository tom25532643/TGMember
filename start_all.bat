@echo off
title TGMember Launcher

set "ROOT=D:\SynologyDrive\TGMember"
set "TDLIB_DIR=%ROOT%\services\tdlib-service"
set "BACKEND_DIR=%ROOT%\services\backend-api"
set "ADMIN_UI_DIR=%ROOT%\apps\admin-ui"
set "MOBILE_DIR=%ROOT%\tgmember-mobile"

echo ==============================
echo Starting TGMember services...
echo ==============================

:: === TDLib Service ===
start "TGMember TDLib Service :8000" cmd /k ^
cd /d "%TDLIB_DIR%" ^&^& ^
venv\Scripts\activate ^&^& ^
uvicorn app.main:app --host 0.0.0.0 --port 8000

:: === CRM / Backend API ===
start "TGMember CRM Service :8001" cmd /k ^
cd /d "%BACKEND_DIR%" ^&^& ^
venv\Scripts\activate ^&^& ^
uvicorn main:app --host 0.0.0.0 --port 8001

:: === Old test UI ===
start "TGMember Old Admin UI :5500" cmd /k ^
cd /d "%ADMIN_UI_DIR%" ^&^& ^
python -m http.server 5500

:: === Mobile web UI ===
start "TGMember Mobile Web" cmd /k ^
cd /d "%MOBILE_DIR%" ^&^& ^
npm run web

echo ==============================
echo All TGMember services started!
echo ==============================
echo.
echo TDLib Service: http://127.0.0.1:8000
echo CRM Service:   http://127.0.0.1:8001
echo Old admin-ui:  http://127.0.0.1:5500/login.html
echo Mobile Web:    Check the Expo window for the web URL.
echo.
echo For phone or NAS PWA testing, use this PC's LAN IP, not 127.0.0.1.
echo.

start http://127.0.0.1:5500/login.html

pause
