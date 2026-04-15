@echo off
chcp 65001 >nul
cd /d "%~dp0.."
if not exist "images" mkdir images
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*file_a_tax_return*.png") do (
  copy /Y "%%F" "images\Sole_Proprietor_Shinkoku_thumbnail.png" && echo OK: 確定申告サムネをコピーしました
)
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*fcaec837*.png") do (
  copy /Y "%%F" "images\Sole_Proprietor_Shinkoku_thumbnail.png" && echo OK: 確定申告サムネをコピーしました
)
if exist "images\Sole_Proprietor_Shinkoku_thumbnail.png" (echo 完了) else (echo 画像が見つかりません。Cursorに貼った画像がassetsに保存されているか確認してください)
pause
