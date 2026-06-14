@echo off
title Oyebill Print Agent
color 0A

echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║       Oyebill Print Agent Setup           ║
echo  ╚═══════════════════════════════════════════╝
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo ═══════════════════════════════════════════
echo Installation complete!
echo ═══════════════════════════════════════════
echo.
echo Starting Print Agent...
echo.
echo Open http://localhost:8181/health to verify
echo Press Ctrl+C to stop
echo.
echo.

:: Start the agent
npm start

pause