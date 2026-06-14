@echo off
setlocal enabledelayedexpansion

:: ============================================
:: Oyebill.com Print Relay for Windows
:: ============================================
:: This script runs on your local Windows PC
:: It polls the server for print jobs and 
:: forwards them to your local network printer
:: ============================================

:: Configuration - UPDATE THESE VALUES
set SERVER_URL=http://YOUR_OYEBILL_DOMAIN.com
set RESTAURANT_ID=YOUR_RESTAURANT_ID
set PRINTER_PATH=\\192.168.0.220\POS-80
set POLL_INTERVAL=5

:: Create temp directory if not exists
if not exist "%TEMP%\oyebill-print" mkdir "%TEMP%\oyebill-print"

echo ============================================
echo    Oyebill Print Relay
echo ============================================
echo Server: %SERVER_URL%
echo Restaurant: %RESTAURANT_ID%
echo Printer: %PRINTER_PATH%
echo Poll Interval: %POLL_INTERVAL% seconds
echo ============================================
echo.
echo Press Ctrl+C to stop...
echo.

:loop
REM Poll for print jobs
curl -s "%SERVER_URL%/api/print-relay/poll?restaurantId=%RESTAURANT_ID%" -o "%TEMP%\oyebill-print\jobs.json" 2>nul

REM Check if we got valid JSON
if exist "%TEMP%\oyebill-print\jobs.json" (
    REM Extract job count using findstr
    findstr /C:"jobId" "%TEMP%\oyebill-print\jobs.json" >nul
    if !errorlevel! equ 0 (
        REM Found jobs - parse and print each one
        powershell -NoProfile -ExecutionPolicy Bypass -Command ^
            "$json = Get-Content '%TEMP%\oyebill-print\jobs.json' -Raw | ConvertFrom-Json; " ^
            "if ($json.jobs) { " ^
            "  foreach ($job in $json.jobs) { " ^
            "    $content = $job.content; " ^
            "    $copies = if ($job.copies) { $job.copies } else { 1 }; " ^
            "    $jobId = $job.id; " ^
            "    $cut = [byte[]](29,86,0); " ^
            "    $data = [System.Text.Encoding]::ASCII.GetBytes($content + [char]29 + 'V' + [char]0); " ^
            "    for ($i = 0; $i -lt $copies; $i++) { " ^
            "      [System.IO.File]::WriteAllBytes('%TEMP%\oyebill-print\receipt.bin', $data); " ^
            "      Copy-Item '%TEMP%\oyebill-print\receipt.bin' '%PRINTER_PATH%' -ErrorAction SilentlyContinue; " ^
            "      Start-Sleep -Milliseconds 500; " ^
            "    }; " ^
            "    Write-Host \"Printed Job #$jobId\"; " ^
            "    curl -s -X POST '%SERVER_URL%/api/print-relay/complete' -H 'Content-Type: application/json' -d '{\"jobId\":'\"$jobId\"'}' 2>nul; " ^
            "  } " ^
            "} "
    )
)

REM Wait before polling again
timeout /t %POLL_INTERVAL% /nobreak >nul
goto loop