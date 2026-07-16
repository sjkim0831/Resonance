[CmdletBinding()]
param(
    [switch]$RefreshStaticInventory,
    [string]$Python = "C:\Users\jwchoo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$generated = Join-Path $root "docs\architecture\executable-webapp\generated"
$viewer = Join-Path $root "projects\carbonet-assets\static\react-shell\executable-spec"

if (-not (Test-Path -LiteralPath $Python)) {
    $Python = "python"
}

function Invoke-Generator([string]$Script, [string[]]$Arguments = @()) {
    $path = Join-Path $PSScriptRoot $Script
    & $Python $path @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Script failed with exit code $LASTEXITCODE"
    }
}

Push-Location $root
try {
    if ($RefreshStaticInventory) {
        Invoke-Generator "audit-current-system.py"
    }
    Invoke-Generator "build-implemented-evidence-graph.py"
    Invoke-Generator "derive-implemented-process-model.py"
    Invoke-Generator "build-canonical-process-model.py"
    Invoke-Generator "generate-executable-webapp-spec.py" @("--viewer-out", $viewer)

    $canonical = Get-Content -LiteralPath (Join-Path $generated "canonical-process-summary.json") -Raw | ConvertFrom-Json
    if ($canonical.validation.status -ne "PASSED") {
        throw "Canonical validation failed: $($canonical.validation | ConvertTo-Json -Compress)"
    }
    if ($canonical.validation.missingImplementedCapabilityCodes.Count -ne 0) {
        throw "Implemented capability preservation gate failed: $($canonical.validation.missingImplementedCapabilityCodes -join ',')"
    }
    [pscustomobject]@{
        status = "PASSED"
        precedencePolicy = $canonical.precedencePolicy
        processes = $canonical.stats.canonicalProcesses
        steps = $canonical.stats.canonicalSteps
        scenarios = $canonical.stats.canonicalScenarios
        preservedImplementedCapabilities = $canonical.stats.preservedImplementedCapabilities
        screenEvidence = $canonical.stats.implementedStepsWithScreenEvidence
        apiEvidence = $canonical.stats.implementedStepsWithApiEvidence
        databaseEvidence = $canonical.stats.implementedStepsWithDatabaseEvidence
        authorityEvidence = $canonical.stats.implementedStepsWithAuthorityEvidence
        testEvidence = $canonical.stats.implementedStepsWithTestEvidence
    } | ConvertTo-Json -Depth 4
}
finally {
    Pop-Location
}
