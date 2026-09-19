# 入場歓迎Bot を動かす（WELCOME_BOT.md）。
#
# 🔴 これは**常駐**。ロボトレードの日次バッチ（起動→実行→終了）とは別物で、
#    起動したまま参加イベントを待ち受ける。止めるのは Ctrl+C かタスクの終了。
#
# 🔴 PowerShell の落とし穴（ロボトレードで踏んだもの）は最初から避けてある:
#    - このファイルは **UTF-8 BOM 付き**で保存する（無いと 5.1 が ANSI として読む）
#    - native コマンドに **2>&1 を付けない**（stderr が ErrorRecord に包まれて exit 1 になる）
#    - **[Console]::OutputEncoding を UTF-8 に**（既定は cp932 でログが化ける）
#
# 手で動かすとき:
#   powershell -ExecutionPolicy Bypass -File scripts\run_bot.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\run_bot.ps1 -Args "--dry-run"

param(
    [string]$Args = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$logFile = Join-Path $root ("bot_" + (Get-Date -Format "yyyy-MM") + ".log")

function Write-Log($message) {
    $line = "[{0}] {1}" -f (Get-Date -Format "MM-dd HH:mm:ss"), $message
    Write-Output $line
    Add-Content -Path $logFile -Value $line -Encoding utf8
}

if (-not (Test-Path $python)) {
    Write-Log "🔴 venv が無い: $python"
    exit 2
}

Push-Location $root
try {
    $env:PYTHONIOENCODING = "utf-8"
    $argList = @("bot.py")
    if ($Args) { $argList += $Args.Split(" ") }

    Write-Log ("起動: python " + ($argList -join " "))
    & $python @argList | ForEach-Object { Write-Log $_ }
    $code = $LASTEXITCODE
} finally {
    Pop-Location
}

Write-Log ("終了コード: " + $code)
exit $code
