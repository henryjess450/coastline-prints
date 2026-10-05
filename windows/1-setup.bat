@echo off
REM First-time setup and after every update: installs packages, updates the
REM database and builds the site. Takes a few minutes.
cd /d "%~dp0\.."
title Coastline Prints setup
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org & pause & exit /b 1)
if not exist .env (echo Missing .env file. Copy it into this folder first. & pause & exit /b 1)
echo Installing packages...
call npm ci || goto :fail
echo Updating database...
call npx prisma migrate deploy || goto :fail
echo Building site...
call npx next build || goto :fail
echo.
echo Setup complete. Run 2-start.bat to start the site.
pause
exit /b 0
:fail
echo.
echo Setup FAILED. Scroll up to see the error.
pause
exit /b 1
