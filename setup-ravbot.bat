@echo off
echo === RavBot Setup Script ===

REM Step 1: Install main dependencies
echo Installing main dependencies...
call npm install

REM Step 2: Install Plaid extras
echo Installing Plaid libraries...
call npm install plaid
call npm install react-plaid-link

REM Step 3: Start Plaid quickstart in its own terminal
echo Starting Plaid quickstart...
start "Plaid Quickstart" cmd /k "cd /d C:\Users\guita\plaid_quickstart\node && npm start"

REM Step 4: Start RavBot frontend (vite) in its own terminal
echo Starting RavBot client (vite)...
start "RavBot Frontend" cmd /k "cd /d %~dp0 && npm run dev"

REM Step 5: Start RavBot backend (server.mjs) in its own terminal
echo Starting RavBot backend...
start "RavBot Backend" cmd /k "cd /d %~dp0 && node server.mjs"

echo === All tasks launched in separate windows! ===
pause
