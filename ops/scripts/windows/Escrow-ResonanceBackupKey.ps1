[CmdletBinding()]
param(
    [string]$KeyFile = "$env:LOCALAPPDATA\Resonance\backup-aes.key",
    [string]$Repository = "sjkim0831/Resonance",
    [string]$SecretName = "RESONANCE_BACKUP_MASTER_KEY_B64"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

if (-not (Test-Path -LiteralPath $KeyFile)) {
    throw "Backup key is missing: $KeyFile"
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI is required."
}

$raw = [Security.Cryptography.ProtectedData]::Unprotect(
    [IO.File]::ReadAllBytes($KeyFile),
    [Text.Encoding]::UTF8.GetBytes("ResonancePostgresBackup/v1"),
    [Security.Cryptography.DataProtectionScope]::CurrentUser
)
try {
    if ($raw.Length -ne 64) {
        throw "Backup key length is invalid."
    }
    $encoded = [Convert]::ToBase64String($raw)
    $encoded | gh secret set $SecretName --repo $Repository
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub secret escrow failed."
    }
    Write-Output "ESCROWED repository=$Repository secret=$SecretName"
} finally {
    $encoded = $null
    [Array]::Clear($raw, 0, $raw.Length)
}
