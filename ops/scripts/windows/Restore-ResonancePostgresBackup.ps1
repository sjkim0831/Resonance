[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$EncryptedBackup,
    [Parameter(Mandatory)]
    [string]$OutputPath,
    [string]$KeyFile = "$env:LOCALAPPDATA\Resonance\backup-aes.key",
    [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

function Unprotect-MasterKey {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Backup key is missing: $Path"
    }
    return [Security.Cryptography.ProtectedData]::Unprotect(
        [IO.File]::ReadAllBytes($Path),
        [Text.Encoding]::UTF8.GetBytes("ResonancePostgresBackup/v1"),
        [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
}

$source = [IO.Path]::GetFullPath($EncryptedBackup)
$output = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $output
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$masterKey = Unprotect-MasterKey $KeyFile
$aesKey = $masterKey[0..31]
$hmacKey = $masterKey[32..63]
$cipherTemp = "$output.cipher.partial"
$outputTemp = "$output.partial"
$magicExpected = [Text.Encoding]::ASCII.GetBytes("RSBK1")

try {
    $input = [IO.File]::OpenRead($source)
    try {
        if ($input.Length -le ($magicExpected.Length + 16 + 32)) {
            throw "Encrypted backup is truncated."
        }
        $magic = New-Object byte[] $magicExpected.Length
        $iv = New-Object byte[] 16
        [void]$input.Read($magic, 0, $magic.Length)
        [void]$input.Read($iv, 0, $iv.Length)
        if ([Text.Encoding]::ASCII.GetString($magic) -ne "RSBK1") {
            throw "Encrypted backup header is invalid."
        }

        $cipherLength = $input.Length - $magic.Length - $iv.Length - 32
        $cipherOutput = [IO.File]::Create($cipherTemp)
        $hmac = New-Object Security.Cryptography.HMACSHA256(, $hmacKey)
        try {
            [void]$hmac.TransformBlock($magic, 0, $magic.Length, $null, 0)
            [void]$hmac.TransformBlock($iv, 0, $iv.Length, $null, 0)
            $remaining = $cipherLength
            $buffer = New-Object byte[] (4MB)
            while ($remaining -gt 0) {
                $requested = [int][Math]::Min($buffer.Length, $remaining)
                $read = $input.Read($buffer, 0, $requested)
                if ($read -le 0) { throw "Encrypted backup ended before its authentication tag." }
                $cipherOutput.Write($buffer, 0, $read)
                [void]$hmac.TransformBlock($buffer, 0, $read, $null, 0)
                $remaining -= $read
            }
            [void]$hmac.TransformFinalBlock([byte[]]::new(0), 0, 0)
            $storedTag = New-Object byte[] 32
            if ($input.Read($storedTag, 0, $storedTag.Length) -ne $storedTag.Length) {
                throw "Encrypted backup authentication tag is missing."
            }
            $difference = 0
            for ($i = 0; $i -lt 32; $i++) {
                $difference = $difference -bor ($hmac.Hash[$i] -bxor $storedTag[$i])
            }
            if ($difference -ne 0) {
                throw "Encrypted backup authentication failed."
            }
        } finally {
            $hmac.Dispose()
            $cipherOutput.Dispose()
        }
    } finally {
        $input.Dispose()
    }

    $aes = [Security.Cryptography.Aes]::Create()
    $aes.KeySize = 256
    $aes.Mode = [Security.Cryptography.CipherMode]::CBC
    $aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
    $aes.Key = $aesKey
    $aes.IV = $iv
    try {
        $cipherInput = [IO.File]::OpenRead($cipherTemp)
        $decrypt = New-Object Security.Cryptography.CryptoStream(
            $cipherInput,
            $aes.CreateDecryptor(),
            [Security.Cryptography.CryptoStreamMode]::Read
        )
        $plainOutput = [IO.File]::Create($outputTemp)
        try {
            $decrypt.CopyTo($plainOutput, 4MB)
        } finally {
            $plainOutput.Dispose()
            $decrypt.Dispose()
            $cipherInput.Dispose()
        }
    } finally {
        $aes.Dispose()
    }

    $statusPath = $source -replace '\.rsbk$', '.replication.json'
    if (Test-Path -LiteralPath $statusPath) {
        $status = Get-Content -Raw -LiteralPath $statusPath | ConvertFrom-Json
        $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputTemp).Hash.ToLowerInvariant()
        if ($actualHash -ne ([string]$status.sourceSha256).ToLowerInvariant()) {
            throw "Restored backup SHA-256 does not match its verified source."
        }
    }

    if ($VerifyOnly) {
        Write-Output "RESTORE_VERIFIED $source"
    } else {
        Move-Item -Force -LiteralPath $outputTemp -Destination $output
        Write-Output "RESTORED $output"
    }
} finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $cipherTemp, $outputTemp
}
