# ロボトレード をWindowsタスクスケジューラに登録する（SPEC 13）。
#
# 🔴 クラウド（GitHub Actions 等）では動かない。ロボトレード は手元の `.env` と
#    ローカルに clone したぽいロボのデータを読むため。定期実行はこのPCで持つ。
#
# 🔴 大引け(15:30)より前に走らせない。その日の四本値が確定していない。
#    Python 側も 15:30 前なら**前営業日**を対象にするが、時刻はここで余裕を見て決める。
#
# 🔵 休場日でも起動してよい。Python 側が休場を判定してトレードはスキップし、
#    お知らせフィード（note・ポイ活）だけを流す。
#
#   登録:   powershell -ExecutionPolicy Bypass -File scripts\register_task.ps1
#   確認:   powershell -ExecutionPolicy Bypass -File scripts\register_task.ps1 -Show
#   解除:   powershell -ExecutionPolicy Bypass -File scripts\register_task.ps1 -Remove
#   時刻変更: ... -Time "18:30"

param(
    [string]$Time = "17:00",
    [string]$TaskName = "robotrade-daily",
    [switch]$Remove,
    [switch]$Show
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $root "scripts\run_daily.ps1"

if ($Show) {
    try {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        $info = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Output "タスク: $TaskName"
        Write-Output ("  状態      : " + $task.State)
        Write-Output ("  トリガー  : " + ($task.Triggers | ForEach-Object { $_.StartBoundary }))
        Write-Output ("  前回実行  : " + $info.LastRunTime + " (結果 " + $info.LastTaskResult + ")")
        Write-Output ("  次回実行  : " + $info.NextRunTime)
    } catch {
        Write-Output "タスク $TaskName は登録されていない"
    }
    exit 0
}

if ($Remove) {
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Output "解除した: $TaskName"
    } catch {
        Write-Output "タスク $TaskName は登録されていない"
    }
    exit 0
}

if (-not (Test-Path $runner)) {
    Write-Error "run_daily.ps1 が無い: $runner"
    exit 2
}

# 🔴 15:30 より前には登録させない（その日の四本値が確定していないため）
$parsed = [datetime]::ParseExact($Time, "HH:mm", $null)
if ($parsed.TimeOfDay -lt ([timespan]"15:30")) {
    Write-Error "大引け(15:30)より前は指定できない。指定: $Time"
    exit 2
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"$runner`"") `
    -WorkingDirectory $root

# 平日だけ。休場の判定は Python 側（ぽいロボの marketCalendar.mjs が単一情報源）。
$trigger = New-ScheduledTaskTrigger -Weekly `
    -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $Time

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit ([timespan]::FromMinutes(30)) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "ロボトレード 日次実行（引け後）" -Force | Out-Null

Write-Output "登録した: $TaskName（平日 $Time）"
Write-Output "  実行するもの: $runner"
Write-Output ""
Write-Output "🔵 -StartWhenAvailable を付けてある＝PCが寝ていて実行できなかった日は、"
Write-Output "   次に起動したときに1回だけ走る。ただし翌営業日になっていれば"
Write-Output "   Python 側が前営業日を対象にするので、古い日を勝手に埋めには行かない。"
Write-Output ""
Write-Output "確認: powershell -ExecutionPolicy Bypass -File scripts\register_task.ps1 -Show"
