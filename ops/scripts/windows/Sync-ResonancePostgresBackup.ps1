[CmdletBinding()]
param(
    [string]$RemoteHost = "172.16.1.232",
    [string]$RemoteUser = "sjkim",
    [string]$RemoteDirectory = "/opt/resonance-backups/postgresql/on-demand",
    [string]$DestinationDirectory = "$env:USERPROFILE\Downloads\Resonance-Backups",
    [string]$CredentialFile = "$env:LOCALAPPDATA\Resonance\backup-ssh.credential.xml",
    [string]$KeyFile = "$env:LOCALAPPDATA\Resonance\backup-aes.key",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Protect-BytesForCurrentUser {
    param([byte[]]$Bytes)
    Add-Type -AssemblyName System.Security
    return [Security.Cryptography.ProtectedData]::Protect(
        $Bytes,
        [Text.Encoding]::UTF8.GetBytes("ResonancePostgresBackup/v1"),
        [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
}

function Unprotect-BytesForCurrentUser {
    param([byte[]]$Bytes)
    Add-Type -AssemblyName System.Security
    return [Security.Cryptography.ProtectedData]::Unprotect(
        $Bytes,
        [Text.Encoding]::UTF8.GetBytes("ResonancePostgresBackup/v1"),
        [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
}

function Set-OwnerOnlyAcl {
    param([string]$Path)
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $acl = New-Object Security.AccessControl.FileSecurity
    $acl.SetOwner([Security.Principal.NTAccount]$identity)
    $acl.SetAccessRuleProtection($true, $false)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule(
        $identity,
        [Security.AccessControl.FileSystemRights]::FullControl,
        [Security.AccessControl.AccessControlType]::Allow
    )
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Get-OrCreateMasterKey {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        return Unprotect-BytesForCurrentUser ([IO.File]::ReadAllBytes($Path))
    }

    $parent = Split-Path -Parent $Path
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $key = New-Object byte[] 64
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($key)
    } finally {
        $rng.Dispose()
    }
    [IO.File]::WriteAllBytes($Path, (Protect-BytesForCurrentUser $key))
    Set-OwnerOnlyAcl $Path
    return $key
}

function Get-PlainPassword {
    param([Management.Automation.PSCredential]$Credential)
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Credential.Password)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Invoke-SshPass {
    param(
        [string]$Password,
        [string[]]$Arguments
    )
    $previous = $env:SSHPASS
    try {
        $env:SSHPASS = $Password
        & sshpass -e @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "sshpass command failed with exit code $LASTEXITCODE"
        }
    } finally {
        $env:SSHPASS = $previous
    }
}

function Encrypt-VerifiedBackup {
    param(
        [string]$SourcePath,
        [string]$DestinationPath,
        [byte[]]$MasterKey,
        [string]$ExpectedSha256
    )

    $aesKey = $MasterKey[0..31]
    $hmacKey = $MasterKey[32..63]
    $iv = New-Object byte[] 16
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($iv)
    } finally {
        $rng.Dispose()
    }
    $cipherPath = "$DestinationPath.cipher.partial"
    $finalPath = "$DestinationPath.partial"

    $aes = [Security.Cryptography.Aes]::Create()
    $aes.KeySize = 256
    $aes.Mode = [Security.Cryptography.CipherMode]::CBC
    $aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
    $aes.Key = $aesKey
    $aes.IV = $iv

    try {
        $input = [IO.File]::OpenRead($SourcePath)
        $cipher = [IO.File]::Create($cipherPath)
        $crypto = New-Object Security.Cryptography.CryptoStream(
            $cipher,
            $aes.CreateEncryptor(),
            [Security.Cryptography.CryptoStreamMode]::Write
        )
        try {
            $input.CopyTo($crypto, 4MB)
            $crypto.FlushFinalBlock()
        } finally {
            $crypto.Dispose()
            $input.Dispose()
        }

        # Prove that the ciphertext decrypts to the original SHA-256 before
        # deleting the plaintext staging copy.
        $cipherInput = [IO.File]::OpenRead($cipherPath)
        $decrypt = New-Object Security.Cryptography.CryptoStream(
            $cipherInput,
            $aes.CreateDecryptor(),
            [Security.Cryptography.CryptoStreamMode]::Read
        )
        $sha = [Security.Cryptography.SHA256]::Create()
        try {
            $actual = ([BitConverter]::ToString($sha.ComputeHash($decrypt)) -replace "-", "").ToLowerInvariant()
        } finally {
            $sha.Dispose()
            $decrypt.Dispose()
            $cipherInput.Dispose()
        }
        if ($actual -ne $ExpectedSha256.ToLowerInvariant()) {
            throw "Encrypted backup restore verification failed"
        }

        $magic = [Text.Encoding]::ASCII.GetBytes("RSBK1")
        $output = [IO.File]::Create($finalPath)
        $hmac = New-Object Security.Cryptography.HMACSHA256(, $hmacKey)
        try {
            $output.Write($magic, 0, $magic.Length)
            $output.Write($iv, 0, $iv.Length)
            [void]$hmac.TransformBlock($magic, 0, $magic.Length, $null, 0)
            [void]$hmac.TransformBlock($iv, 0, $iv.Length, $null, 0)

            $cipherInput = [IO.File]::OpenRead($cipherPath)
            try {
                $buffer = New-Object byte[] (4MB)
                while (($read = $cipherInput.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $output.Write($buffer, 0, $read)
                    [void]$hmac.TransformBlock($buffer, 0, $read, $null, 0)
                }
            } finally {
                $cipherInput.Dispose()
            }
            [void]$hmac.TransformFinalBlock([byte[]]::new(0), 0, 0)
            $output.Write($hmac.Hash, 0, $hmac.Hash.Length)
        } finally {
            $hmac.Dispose()
            $output.Dispose()
        }

        Move-Item -Force -LiteralPath $finalPath -Destination $DestinationPath
    } finally {
        $aes.Dispose()
        Remove-Item -Force -ErrorAction SilentlyContinue $cipherPath, $finalPath
    }
}

if (-not (Test-Path -LiteralPath $CredentialFile)) {
    throw "Credential file is missing. Run Initialize-ResonanceBackup.ps1 first."
}

New-Item -ItemType Directory -Force -Path $DestinationDirectory | Out-Null
$credential = Import-Clixml -LiteralPath $CredentialFile
$password = Get-PlainPassword $credential

$remote = "$RemoteUser@$RemoteHost"
$findCommand = "find '$RemoteDirectory' -maxdepth 1 -type f -name '*.dump' -printf '%T@ %f\n' | sort -nr | head -n1 | cut -d' ' -f2-"
$latest = (Invoke-SshPass $password @(
    "ssh", "-o", "StrictHostKeyChecking=no", $remote, $findCommand
) | Select-Object -Last 1).Trim()

if (-not $latest) {
    throw "No PostgreSQL backup was found on the server."
}

$encryptedPath = Join-Path $DestinationDirectory "$latest.rsbk"
$statusPath = Join-Path $DestinationDirectory "$latest.replication.json"
if ((Test-Path $encryptedPath) -and (Test-Path $statusPath) -and -not $Force) {
    # Remove a legacy plaintext copy only when the verified status record and
    # its source checksum both match. Normal syncs stage plaintext elsewhere.
    $legacyPlaintext = Join-Path $DestinationDirectory $latest
    if (Test-Path -LiteralPath $legacyPlaintext) {
        $verifiedStatus = Get-Content -Raw -LiteralPath $statusPath | ConvertFrom-Json
        $legacyHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $legacyPlaintext).Hash.ToLowerInvariant()
        if (($verifiedStatus.status -eq "VERIFIED") -and
            ($legacyHash -eq ([string]$verifiedStatus.sourceSha256).ToLowerInvariant())) {
            Remove-Item -Force -LiteralPath $legacyPlaintext
        }
    }
    Write-Output "UP_TO_DATE $encryptedPath"
    exit 0
}

$staging = Join-Path $DestinationDirectory ".staging"
New-Item -ItemType Directory -Force -Path $staging | Out-Null
$localDump = Join-Path $staging $latest
$localManifest = "$localDump.json"

try {
    Invoke-SshPass $password @(
        "scp", "-o", "StrictHostKeyChecking=no",
        "${remote}:${RemoteDirectory}/$latest",
        "${remote}:${RemoteDirectory}/$latest.json",
        "$staging\"
    ) | Out-Null

    $manifest = Get-Content -Raw -LiteralPath $localManifest | ConvertFrom-Json
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $localDump).Hash.ToLowerInvariant()
    if ($actualHash -ne ([string]$manifest.sha256).ToLowerInvariant()) {
        throw "Downloaded backup SHA-256 does not match its manifest."
    }

    $masterKey = Get-OrCreateMasterKey $KeyFile
    Encrypt-VerifiedBackup $localDump $encryptedPath $masterKey $actualHash

    [ordered]@{
        status = "VERIFIED"
        completedAt = [DateTime]::UtcNow.ToString("o")
        remoteSource = "$RemoteHost`:$RemoteDirectory/$latest"
        encryptedFile = $encryptedPath
        bytes = (Get-Item -LiteralPath $encryptedPath).Length
        sourceSha256 = $actualHash
        encryption = "AES-256-CBC+HMAC-SHA256"
        restoreVerified = $true
    } | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $statusPath

    Write-Output "VERIFIED $encryptedPath sha256=$actualHash"
} finally {
    $password = $null
    Remove-Item -Force -ErrorAction SilentlyContinue $localDump, $localManifest
}
