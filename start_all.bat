@echo off
title TGMember Launcher

echo ==============================
echo Starting TGMember services...
echo ==============================

:: === tdlib-service ===
start "tdlib-service" cmd /k ^
cd /d D:\SynologyDrive\TGMember\services\tdlib-service ^&^& ^
venv\Scripts\activate ^&^& ^
uvicorn app.main:app --host 0.0.0.0 --port 8000

:: === backend-api ===
start "backend-api" cmd /k ^
cd /d D:\SynologyDrive\TGMember\services\backend-api ^&^& ^
venv\Scripts\activate ^&^& ^
uvicorn main:app --host 0.0.0.0 --port 8001

:: === frontend ===
start "frontend" cmd /k ^
cd /d D:\SynologyDrive\TGMember\apps\admin-ui ^&^& ^
python -m http.server 5500

echo ==============================
echo All services started!
echo ==============================

start http://127.0.0.1:5500/login.html

pause