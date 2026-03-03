@echo off
chcp 65001 >nul
cd /d "%~dp0.."

call "%~dp0copy-images.bat" --silent 2>nul

echo.
echo 完了。 npx serve pointlab -l 3000 でローカル確認できます。
start "" cmd /c "cd /d %~dp0.. && npx serve . -l 3000"
echo http://localhost:3000 をブラウザで開いてください。
pause
