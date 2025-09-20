@echo off
echo === RavBot Setup Script ===

REM Step 1: Install main dependencies
echo Installing main dependencies...
call npm install

REM Step 2: Install Plaid extras
echo Installing Plaid libraries...
call npm install plaid
call npm install react-plaid-link

REM Step 3: Run schema ensure script
echo Ensuring Supabase schema is correct...
call node scripts\ensureSchema.js

REM Step 4: Start Plaid quickstart in its own terminal
echo Starting Plaid quickstart...
start "Plaid Quickstart" cmd /k "cd /d C:\Users\guita\plaid_quickstart\node && npm start"

REM Step 5: Start RavBot frontend (vite) in its own terminal
echo Starting RavBot client (vite)...
start "RavBot Frontend" cmd /k "cd /d %~dp0 && npm run dev"

REM Step 6: Start RavBot backend (server.mjs) in its own terminal
echo Starting RavBot backend...
start "RavBot Backend" cmd /k "cd /d %~dp0 && node server.mjs"

REM Step 7: Rainbow countdown before closing this setup window
echo.
echo Launch complete! Closing in 3 seconds...
echo.
for %%A in ([31mR [33mA [32mI [36mN [34mB [35mO [91mW) do (
    <nul set /p=%%A
    ping -n 2 127.0.0.1 >nul
)
echo [0m

timeout /t 1 >nul
exit
