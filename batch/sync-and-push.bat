@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
for %%A in ("%~dp0..") do set "SOURCE=%%~sA"
set "DEST=C:\PointLabSync"
set "REPO=https://github.com/poifulhakase/pointlab.git"

echo === GitHub sync and push ===
echo From: %SOURCE%
echo To:   %DEST%
echo.
findstr /C:"runWhenReady" "%SOURCE%\poinavi\script.js" >nul 2>&1 && echo [OK] script.js has fixes || echo [!!] script.js may be old version
echo.

echo Copying images...
call "%SOURCE%\batch\copy-images.bat" --silent
cd /d "%SOURCE%"
echo Favicon...
if not exist "%SOURCE%\node_modules\sharp" (echo Installing sharp... & cd /d "%SOURCE%" && npm install --no-audit --no-fund 2>nul)
cd /d "%SOURCE%" && node scripts\generate-apple-touch-icon-sharp.js 2>nul
if exist "%SOURCE%\favicon-32x32.png" (echo favicon: OK) else (echo Run generate-favicons.bat first)
echo Updating cache versions...
cd /d "%SOURCE%" && node scripts\update-image-versions.js 2>nul

echo.
if not exist "%DEST%\.git" (
  echo Cloning repo to %DEST%...
  if not exist "%DEST%" mkdir "%DEST%"
  git clone "%REPO%" "%DEST%"
  if errorlevel 1 (
    echo Clone failed.
    pause
    exit /b 1
  )
  echo.
)

echo Copying files...
robocopy "%SOURCE%" "%DEST%" /E /XD .git node_modules .vercel /NFL /NDL /NJH /NJS /NC /NS
if %ERRORLEVEL% GEQ 8 (
  echo Copy error.
  pause
  exit /b 1
)

if exist "%DEST%\poinavi\map.html" (
  cd /d "%DEST%"
  node scripts\update-poinavi-version.js
  cd /d "%~dp0.."
)

cd /d "%DEST%"
set GIT_PAGER=cat
git status
git add -A
set HAS_CHANGES=0
git diff --cached --quiet || set HAS_CHANGES=1
if %HAS_CHANGES%==0 (
  echo.
  echo No changes. GitHub is up to date.
  pause
  exit /b 0
)

echo.
echo Committing and pushing...
git --no-pager diff --cached --stat
echo.
if /i "%1"=="/y" goto :dopush
if /i "%1"=="/push" goto :dopush
set /p confirm="Push? (y/n): "
if /i not "%confirm%"=="y" (
  echo Cancelled. Use sync-and-push.bat /y for auto-push.
  pause
  exit /b 0
)
:dopush

git commit -m "Update: favicon and poinavi"
if errorlevel 1 (
  echo Commit failed.
  pause
  exit /b 1
)

git push origin main
if errorlevel 1 (
  echo Push failed.
  pause
  exit /b 1
)

echo.
echo === Done ===
echo Pushed to GitHub. Vercel will auto-deploy.
echo https://pointlab.vercel.app
pause
