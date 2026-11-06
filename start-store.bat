@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"

if not exist "%ROOT%backend" (
  echo Missing backend folder.
  pause
  exit /b 1
)

if not exist "%ROOT%frontend" (
  echo Missing frontend folder.
  pause
  exit /b 1
)

if not exist "%ROOT%backend\.env" (
  echo Missing backend\.env. Copy backend\.env.example to backend\.env and configure it first.
  pause
  exit /b 1
)

if not exist "%ROOT%backend\node_modules" (
  echo Installing backend dependencies...
  pushd "%ROOT%backend" >nul
  call npm install
  popd >nul
)

if not exist "%ROOT%frontend\node_modules" (
  echo Installing frontend dependencies...
  pushd "%ROOT%frontend" >nul
  call npm install
  popd >nul
)

start "Everyday Market API" /D "%ROOT%backend" cmd /k "npm run dev"
start "Everyday Market Frontend" /D "%ROOT%frontend" cmd /k "npm run dev -- --host 127.0.0.1"

set /a frontendAttempts=0

:wait_for_frontend
curl.exe --silent --fail --output NUL --max-time 2 http://127.0.0.1:5173/
if not errorlevel 1 goto wait_for_backend
set /a frontendAttempts+=1
if %frontendAttempts% geq 30 goto startup_failed
timeout /t 1 /nobreak >nul
goto wait_for_frontend

:wait_for_backend
set /a backendAttempts=0

:wait_for_backend_loop
curl.exe --silent --fail --output NUL --max-time 2 http://127.0.0.1:5000/api/health
if not errorlevel 1 goto open_store
set /a backendAttempts+=1
if %backendAttempts% geq 60 goto startup_failed
timeout /t 1 /nobreak >nul
goto wait_for_backend_loop

:open_store
start "" "http://localhost:5173/"
exit /b 0

:startup_failed
echo Could not start the store services. Check the API and Frontend terminal windows above for errors.
echo Make sure Node.js is installed and MongoDB is running.
pause
exit /b 1
