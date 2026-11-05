@echo off
setlocal
set "ROOT=%~dp0"

if not exist "%ROOT%backend\.env" (
  echo Missing backend\.env. Copy backend\.env.example to backend\.env and configure it first.
  pause
  exit /b 1
)

start "Everyday Market API" /D "%ROOT%backend" cmd /k "npm run dev"
start "Everyday Market Frontend" /D "%ROOT%frontend" cmd /k "npm run dev -- --host 127.0.0.1"

set /a attempts=0

:wait_for_frontend
curl.exe --silent --fail --output NUL --max-time 2 http://127.0.0.1:5173/
if not errorlevel 1 goto wait_for_backend
set /a attempts+=1
if %attempts% geq 30 goto startup_failed
timeout /t 1 /nobreak >nul
goto wait_for_frontend

:wait_for_backend
curl.exe --silent --fail --output NUL --max-time 2 http://127.0.0.1:5000/api/health
if not errorlevel 1 goto open_store
set /a attempts+=1
if %attempts% geq 60 goto startup_failed
timeout /t 1 /nobreak >nul
goto wait_for_backend

:open_store
start "" "http://localhost:5173/"
exit /b 0

:startup_failed
echo Could not start the store services. Check the API and Frontend terminal windows above for errors.
echo Make sure Node.js is installed and MongoDB is running.
pause
exit /b 1
