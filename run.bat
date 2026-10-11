@echo off
title SerendibSuite Launcher
echo ===================================================
echo   Starting SerendibSuite Studio Workspace
echo ===================================================

echo [1/3] Starting Backend API Server (Port 8000)...
start "SerendibSuite Backend (Port 8000)" cmd /k "python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/3] Starting Frontend Server (Port 5500)...
start "SerendibSuite Frontend (Port 5500)" cmd /k "python -m http.server 5500 --directory frontend"

timeout /t 1 /nobreak >nul

echo [3/3] Launching Web Browser...
start http://127.0.0.1:5500

echo.
echo ===================================================
echo   SerendibSuite is running!
echo   - Frontend: http://127.0.0.1:5500
echo   - Backend:  http://127.0.0.1:8000
echo   - API Docs: http://127.0.0.1:8000/docs
echo ===================================================
