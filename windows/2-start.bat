@echo off
REM Starts the site. Keep this window open (minimise it). Closing it stops the site.
cd /d "%~dp0\.."
title Coastline Prints (running - do not close)
:loop
call npm start
echo Site stopped. Restarting in 5 seconds (close this window to stop for good)...
timeout /t 5 /nobreak >nul
goto loop
