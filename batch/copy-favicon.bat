@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo faviconをコピー中...
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*0d1a022b*.png") do (
  copy /Y "%%F" "favicon-32x32.png" >nul
  copy /Y "%%F" "favicon-16x16.png" >nul
  echo OK: faviconをコピーしました
  goto :done
)
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*favicon*.png") do (
  copy /Y "%%F" "favicon-32x32.png" >nul
  copy /Y "%%F" "favicon-16x16.png" >nul
  echo OK: faviconをコピーしました
  goto :done
)
:done
if exist "favicon-32x32.png" (echo 完了. デプロイすると新しいfaviconが反映されます) else (echo Cursorに貼ったfavicon画像がassetsにありません)
pause
