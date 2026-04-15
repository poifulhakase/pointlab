@echo off
cd /d "%~dp0.."
start "sync-and-push" cmd /k "call batch\sync-and-push.bat /y & echo. & echo Done. Type exit to close."
