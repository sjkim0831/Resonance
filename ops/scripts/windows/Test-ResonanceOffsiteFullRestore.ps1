[CmdletBinding()]
param(
    [string]$BackupDirectory = "$env:USERPROFILE\Downloads\Resonance-Backups",
    [string]$Image = "postgres:16",
    [string]$KeyFile = "$env:LOCALAPPDATA\Resonance\backup-aes.key",
    [int]$KeepEvidence = 30
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$mutex = New-Object Threading.Mutex($false, "Local\ResonanceOffsiteRestoreDrill")
if (-not $mutex.WaitOne(0)) {
    throw "Another offsite restore drill is already running."
}

$resolvedRoot = [IO.Path]::GetFullPath($BackupDirectory)
$encrypted = Get-ChildItem -LiteralPath $resolvedRoot -File -Filter "*.dump.rsbk" |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
if (-not $encrypted) {
    throw "No encrypted offsite PostgreSQL backup is available."
}
if (-not $encrypted.FullName.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Encrypted backup is outside the safe backup root."
}

$runId = "{0}-{1}" -f [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ"), [guid]::NewGuid()
$stagingDirectory = Join-Path $resolvedRoot ".restore-drill"
$evidenceDirectory = Join-Path $resolvedRoot "evidence"
New-Item -ItemType Directory -Force -Path $stagingDirectory, $evidenceDirectory | Out-Null
$resolvedStaging = [IO.Path]::GetFullPath($stagingDirectory)
if (-not $resolvedStaging.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Restore staging directory is outside the safe backup root."
}
# A previous process termination must not leave decrypted backup material.
Get-ChildItem -LiteralPath $resolvedStaging -File -Filter "*.dump" `
    -ErrorAction SilentlyContinue | Remove-Item -Force
$plainDump = Join-Path $stagingDirectory "$runId.dump"
$containerName = "resonance-offsite-drill-$($runId.Substring(0,15).ToLowerInvariant())"
$volumeName = "resonance-offsite-drill-$([guid]::NewGuid().ToString('N'))"
$restoreScript = Join-Path $PSScriptRoot "Restore-ResonancePostgresBackup.ps1"
$startedAt = [DateTime]::UtcNow
$evidencePath = Join-Path $evidenceDirectory "offsite-restore-drill-$runId.json"

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker is required for the isolated restore drill."
    }
    docker image inspect $Image *> $null
    if ($LASTEXITCODE -ne 0) {
        docker pull $Image
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to pull restore image $Image"
        }
    }

    & $restoreScript `
        -EncryptedBackup $encrypted.FullName `
        -OutputPath $plainDump `
        -KeyFile $KeyFile | Out-Null
    if (-not (Test-Path -LiteralPath $plainDump)) {
        throw "Encrypted backup did not produce a verified plaintext dump."
    }

    docker volume create $volumeName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to create isolated restore volume."
    }

    $mount = "type=bind,source=$plainDump,target=/backup.dump,readonly"
    $startedContainer = docker run -d `
        --network none `
        --name $containerName `
        --cpus 4 `
        --memory 8g `
        --pids-limit 512 `
        -e POSTGRES_HOST_AUTH_METHOD=trust `
        -e POSTGRES_DB=restore_drill `
        --mount "type=volume,source=$volumeName,target=/var/lib/postgresql/data" `
        --mount $mount `
        $Image `
        -c max_connections=24 `
        -c shared_buffers=256MB `
        -c maintenance_work_mem=1GB `
        -c max_parallel_maintenance_workers=4 `
        -c fsync=off `
        -c synchronous_commit=off `
        -c full_page_writes=off
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to start isolated PostgreSQL restore container."
    }

    $ready = $false
    foreach ($attempt in 1..60) {
        docker exec $containerName pg_isready -U postgres -d restore_drill *> $null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        throw "Isolated PostgreSQL did not become ready."
    }

    docker exec $containerName pg_restore -U postgres -d restore_drill `
        --exit-on-error --no-owner --no-privileges --jobs=4 /backup.dump
    if ($LASTEXITCODE -ne 0) {
        throw "Full PostgreSQL restore failed."
    }

    function Get-RestoreScalar([string]$Sql) {
        $value = docker exec $containerName psql -U postgres -d restore_drill `
            -v ON_ERROR_STOP=1 -Atqc $Sql
        if ($LASTEXITCODE -ne 0 -or $null -eq $value) {
            throw "Restore verification query failed."
        }
        return [int64]$value
    }
    $schemaCount = Get-RestoreScalar "select count(*) from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema'"
    $tableCount = Get-RestoreScalar "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not like 'pg_%' and n.nspname <> 'information_schema'"
    $traceCount = Get-RestoreScalar "select case when to_regclass('public.trace_event') is null then -1 else (select count(*) from public.trace_event) end"
    $assetCount = Get-RestoreScalar "select case when to_regclass('public.framework_unified_asset') is null then -1 else (select count(*) from public.framework_unified_asset) end"
    if ($schemaCount -le 0 -or $tableCount -le 0 -or
        $traceCount -le 0 -or $assetCount -le 0) {
        throw "Restored database failed required data checks."
    }

    $finishedAt = [DateTime]::UtcNow
    $status = Get-Content -Raw -LiteralPath (
        $encrypted.FullName -replace "\.rsbk$", ".replication.json"
    ) | ConvertFrom-Json
    [ordered]@{
        status = "VERIFIED"
        isolation = "docker-network-none"
        runId = $runId
        encryptedBackup = $encrypted.Name
        sourceSha256 = $status.sourceSha256
        image = $Image
        startedAt = $startedAt.ToString("o")
        finishedAt = $finishedAt.ToString("o")
        durationSeconds = [int]($finishedAt - $startedAt).TotalSeconds
        checks = [ordered]@{
            schemaCount = $schemaCount
            tableCount = $tableCount
            traceEventCount = $traceCount
            unifiedAssetCount = $assetCount
        }
    } | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath $evidencePath

    Get-ChildItem -LiteralPath $evidenceDirectory -File `
        -Filter "offsite-restore-drill-*.json" |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -Skip ([Math]::Max(1, $KeepEvidence)) |
        Remove-Item -Force

    Get-Content -Raw -LiteralPath $evidencePath
} finally {
    try {
        Remove-Item -Force -ErrorAction SilentlyContinue -LiteralPath $plainDump
    } catch {}
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "SilentlyContinue"
        docker rm -f $containerName *> $null
        docker volume rm -f $volumeName *> $null
    } catch {
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
    try { $mutex.ReleaseMutex() } catch {}
    $mutex.Dispose()
}
