[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [Management.Automation.PSCredential]$Credential,
    [string]$CredentialFile = "$env:LOCALAPPDATA\Resonance\backup-ssh.credential.xml",
    [string]$TaskName = "Resonance PostgreSQL Offsite Backup",
    [int]$IntervalHours = 6
)

$ErrorActionPreference = "Stop"
$directory = Split-Path -Parent $CredentialFile
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$Credential | Export-Clixml -LiteralPath $CredentialFile

$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $CredentialFile /inheritance:r /grant:r "${identity}:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to restrict credential ACL."
}

$syncScript = Join-Path $PSScriptRoot "Sync-ResonancePostgresBackup.ps1"
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$syncScript`""
$trigger = New-ScheduledTaskTrigger -Once -At ([DateTime]::Now.AddMinutes(1)) `
    -RepetitionInterval (New-TimeSpan -Hours $IntervalHours)
$principal = New-ScheduledTaskPrincipal `
    -UserId $identity `
    -LogonType S4U `
    -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

$mode = "S4U"
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Force `
        -ErrorAction Stop | Out-Null
} catch [Microsoft.Management.Infrastructure.CimException] {
    # Non-administrator accounts cannot replace some existing tasks with an
    # S4U principal. Keep automation working in the signed-in user session
    # instead of silently leaving a broken task.
    $mode = "INTERACTIVE_FALLBACK"
    $taskCommand = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$syncScript`""
    & schtasks.exe /Create /F /TN $TaskName /SC HOURLY /MO $IntervalHours /TR $taskCommand | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to register scheduled task $TaskName"
    }
}

Write-Output "INITIALIZED credential=$CredentialFile task=$TaskName mode=$mode"
