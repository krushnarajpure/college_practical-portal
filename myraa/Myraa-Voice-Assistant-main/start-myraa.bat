@echo off
chcp 65001 >nul
title MYRAA Launcher
color 0B

set "PYTHON_EXE="
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not defined PYTHON_EXE (
    for /f "delims=" %%P in ('where python 2^>nul') do ( if not defined PYTHON_EXE set "PYTHON_EXE=%%P" )
)
if not defined PYTHON_EXE set "PYTHON_EXE=python"
set "PROJECT_DIR=%~dp0"

echo ============================================================
echo                 MYRAA ALL-IN-ONE LAUNCHER
echo ============================================================
echo.

echo [1/4] Cleaning up any old instances...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo     Killing stale process on port 3000 ^(PID %%a^)
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
    echo     Killing stale process on port 8765 ^(PID %%a^)
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo     Done.
echo.

echo [2/4] Starting Desktop Control Agent ^(Python, port 8765^)...
start "MYRAA Desktop Agent" /MIN cmd /k "cd /d "%PROJECT_DIR%" && "%PYTHON_EXE%" -m uvicorn desktop_agent.main:app --host 127.0.0.1 --port 8765"
echo     Launching in background window...
echo.

echo [3/4] Waiting for agent to be ready...
set "READY=0"
for /l %%i in (1,1,15) do (
    timeout /t 1 /nobreak >nul
    powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8765/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set "READY=1"
        echo     Desktop Agent is ONLINE - 52 tools ready!
        goto :agent_ready
    )
    echo     ...waiting %%i/15
)
:agent_ready
if "%READY%"=="0" (
    echo     [WARNING] Desktop Agent did not respond in time.
    echo     MYRAA will still run, but desktop control may be unavailable.
)
echo.

echo [4/4] Starting MYRAA Server ^(Node, port 3000^)...
echo ============================================================
echo   Desktop Agent : http://127.0.0.1:8765
echo   MYRAA UI      : http://localhost:3000
echo ============================================================
echo.
echo   Close this window to stop MYRAA.
echo   ^(Desktop Agent runs in its own minimized window.\)
echo.

cd /d "%PROJECT_DIR%"
npm run dev

echo.
echo MYRAA has stopped. Cleaning up Desktop Agent...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
pause
