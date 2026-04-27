param(
    [ValidateSet("wsl", "ssh")]
    [string]$Transport = "wsl",
    [string]$WslDistro = "",
    [string]$SshTarget = "",
    [string]$Workdir = "/opt/Resonance",
    [string[]]$PriorityOrder = @("05", "06", "08", "09", "04", "10", "02", "07", "03", "01"),
    [int]$DispatchDelaySeconds = 3,
    [switch]$UseLoopScript,
    [int]$LoopIntervalSeconds = 60
)

$ErrorActionPreference = "Stop"

$laneNames = [ordered]@{
    "01" = "res-01-contract"
    "02" = "res-02-proposal"
    "03" = "res-03-theme"
    "04" = "res-04-builder"
    "05" = "res-05-frontend"
    "06" = "res-06-backend"
    "07" = "res-07-db"
    "08" = "res-08-deploy"
    "09" = "res-09-verify"
    "10" = "res-10-module"
}

function Quote-Bash {
    param([string]$Value)
    return "'" + $Value.Replace("'", "'\''") + "'"
}

function Invoke-LinuxCommand {
    param([string]$Command)

    if ($Transport -eq "wsl") {
        $args = @()
        if ($WslDistro) {
            $args += "-d"
            $args += $WslDistro
        }
        $args += "-e"
        $args += "bash"
        $args += "-lc"
        $args += $Command
        & wsl.exe @args
        return
    }

    if (-not $SshTarget) {
        throw "Transport=ssh requires -SshTarget."
    }

    & ssh $SshTarget "bash -lc $(Quote-Bash $Command)"
}

function Test-TmuxSession {
    param([string]$SessionName)

    try {
        Invoke-LinuxCommand "tmux has-session -t $(Quote-Bash $SessionName)"
        return $true
    } catch {
        return $false
    }
}

function Ensure-TmuxSession {
    param([string]$SessionName)

    if (-not (Test-TmuxSession -SessionName $SessionName)) {
        Invoke-LinuxCommand "tmux new-session -d -s $(Quote-Bash $SessionName) -c $(Quote-Bash $Workdir)"
    }
}

function Send-LanePrompt {
    param(
        [string]$LaneId,
        [string]$SessionName
    )

    if ($UseLoopScript) {
        $loopCommand = "cd $(Quote-Bash $Workdir) && nohup ./ops/scripts/resonance-session-loop.sh $LaneId $LoopIntervalSeconds >/tmp/${SessionName}.log 2>&1 &"
        Invoke-LinuxCommand $loopCommand
        return
    }

    $prompt = "docs/ai/80-skills/resonance-10-session-assignment.md $([int]$LaneId)번 붙어서 무한 반복 1분마다 재실행 혹은 이어서 해줘"
    $codexCommand = "cd $(Quote-Bash $Workdir) && codex exec --skip-git-repo-check -C $(Quote-Bash $Workdir) -- $(Quote-Bash $prompt)"
    $paneTarget = "${SessionName}:0"
    Invoke-LinuxCommand "tmux send-keys -t $(Quote-Bash $paneTarget) $(Quote-Bash $codexCommand) C-m"
}

$allLaneIds = @("01", "02", "03", "04", "05", "06", "07", "08", "09", "10")

Write-Host "Creating tmux sessions..."
foreach ($laneId in $allLaneIds) {
    Ensure-TmuxSession -SessionName $laneNames[$laneId]
}

Write-Host "Dispatching lanes in priority order: $($PriorityOrder -join ', ')"
foreach ($laneId in $PriorityOrder) {
    if (-not $laneNames.ContainsKey($laneId)) {
        throw "Unknown lane id: $laneId"
    }
    $sessionName = $laneNames[$laneId]
    Write-Host "Launching lane $laneId -> $sessionName"
    Send-LanePrompt -LaneId $laneId -SessionName $sessionName
    if ($DispatchDelaySeconds -gt 0) {
        Start-Sleep -Seconds $DispatchDelaySeconds
    }
}

Write-Host "Done."
Write-Host "Sessions:"
foreach ($laneId in $allLaneIds) {
    Write-Host "  $laneId -> $($laneNames[$laneId])"
}
