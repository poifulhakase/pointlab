# マツ活画像を Cursor assets から pointlab/images へコピー
# 使い方: batch フォルダで .\copy-matsukatsu-image.ps1 を実行

$root = (Get-Item $PSScriptRoot).Parent.FullName
$assetsDir = Join-Path $env:USERPROFILE ".cursor\projects\c-Users-owner-OneDrive-PointLab\assets"
$destFile = Join-Path $root "images\Poikatsu_3min_Recipe_Matsumotokiyoshi.png"
$imagesDir = Split-Path $destFile

if (-not (Test-Path $imagesDir)) {
  New-Item -ItemType Directory -Path $imagesDir -Force | Out-Null
}

$found = $false
Get-ChildItem -Path $assetsDir -Filter "*.png" -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.Name -match "a3cb9356|Matsumotokiyoshi") {
    Copy-Item $_.FullName $destFile -Force
    Write-Host "コピー完了: $($_.Name) -> Poikatsu_3min_Recipe_Matsumotokiyoshi.png"
    $found = $true
  }
}

if (-not $found) {
  Write-Host "マツ活画像が見つかりません。assets フォルダ: $assetsDir"
}
