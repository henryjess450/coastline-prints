@echo off
REM Copies the database and uploaded files into the backups folder.
cd /d "%~dp0\.."
call npm run backup
pause
