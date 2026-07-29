[CmdletBinding()]
param(
    [string]$TaskName = "Resonance PostgreSQL Offsite Restore Drill",
    [DayOfWeek]$DayOfWeek = [DayOfWeek]::Sunday,
    [TimeSpan]$At = ([TimeSpan]::FromHours(3))
)

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$drillScript = Join-Path $PSScriptRoot "Test-ResonanceOffsiteFullRestore.ps1"
if (-not (Test-Path -LiteralPath $drillScript)) {
    throw "Restore drill script is missing: $drillScript"
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$drillScript`""
$trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 1 `
    -DaysOfWeek $DayOfWeek -At ([DateTime]::Today.Add($At))
$principal = New-ScheduledTaskPrincipal `
    -UserId $identity `
    -LogonType Interactive `
    -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Write-Output "INITIALIZED task=$TaskName schedule=$DayOfWeek@$At mode=INTERACTIVE"
