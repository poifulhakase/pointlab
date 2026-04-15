# 株式データ自動取得スクリプト
# Windows タスクスケジューラから実行される

$projectDir = "C:\Project\PointLab\stock-calendar"
$logFile    = "$projectDir\scripts\auto-fetch.log"

function Write-Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
  Add-Content -Path $logFile -Value $line -Encoding UTF8
  Write-Host $line
}

Write-Log "=== データ取得開始 ==="

try {
  Set-Location $projectDir
  $result = & npm run fetch-data 2>&1
  $result | ForEach-Object { Write-Log $_ }
  Write-Log "=== 完了 ==="
} catch {
  Write-Log "エラー: $_"
}
