@echo off
REM Starts Caddy (HTTPS + forwarding to the site). Keep this window open too.
REM Needs caddy.exe in this folder: download "Windows amd64" from https://caddyserver.com/download
cd /d "%~dp0"
title Caddy for Coastline Prints (running - do not close)
if not exist caddy.exe (echo caddy.exe is missing from this folder. See WINDOWS.md. & pause & exit /b 1)
:loop
caddy.exe run --config Caddyfile
echo Caddy stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
