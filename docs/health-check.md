# AI Orchestrator Health Check

## Overview

`agent-health` is a read-only health check script for the AI agent orchestrator system. It verifies the operational status of critical components without modifying any state (DB, git, or runtime).

## Usage

```bash
# Human-readable output (default)
agent-health

# JSON output for automation
agent-health --json

# Show help
agent-health --help
```

## Exit Codes

| Code | Status | Description |
|------|--------|-------------|
| 0 | PASS | All health checks passed |
| 1 | DEGRADED | Some checks failed or are degraded |
| 2 | FAIL | Critical checks failed |

## Checks Performed

### 1. supervisor-watcher
Verifies the agent-supervisor process is active and its log file is fresh (within 5 minutes).

**Failure conditions:**
- Supervisor binary not found
- Log file older than 5 minutes

### 2. slots
Checks worker slot allocation against configured slot count.

**Failure conditions:**
- No slot configuration found
- Over-allocated slots (active > configured)

### 3. log-freshness
Verifies all log files in the log directory are recent.

**Failure conditions:**
- No log files found
- Any log file older than 5 minutes

### 4. queue-json
Validates the task queue JSON file structure.

**Failure conditions:**
- Queue file not found
- Invalid JSON in queue file

### 5. required-files
Ensures all critical orchestrator files are present.

**Required files:**
- `bin/agent-supervisor`
- `bin/agent-worker`
- `bin/agent-task`
- `lib/queue.sh`
- `lib/approval.sh`
- `lib/status.sh`
- `lib/worktree.sh`
- `config/default.json`

### 6. keypool-state
Checks the key pool state without exposing sensitive key data.

**Status values:**
- `healthy`/`available`/`ready` → PASS
- `depleted`/`empty` → DEGRADED
- Other → DEGRADED

### 7. git-root
Verifies git repository state on protected branches.

**Failure conditions:**
- Not a git repository
- Dirty working tree on main/master branch

### 8. test-suite
Executes or summarizes the test suite results.

**Failure conditions:**
- Any test file fails

## Output Formats

### Human-Readable (Default)
```
AI Orchestrator Health Check
============================

[PASS] supervisor-watcher: log is fresh (30s old)
[PASS] slots: 2/4 slots active
[PASS] log-freshness: all 5 logs fresh
[PASS] queue-json: valid JSON with 3 tasks (1 pending/running)
[PASS] required-files: all required files present
[PASS] keypool-state: status=healthy size=5 available=3
[PASS] git-root: branch=main clean
[PASS] test-suite: 5/5 passed

Summary: 8 passed, 0 degraded, 0 failed
Overall: PASS
```

### JSON Output
```json
{
  "health": "PASS",
  "timestamp": "2026-07-11T23:45:00Z",
  "checks": {
    "supervisor-watcher": {
      "status": "PASS",
      "details": "log is fresh (30s old)"
    }
  },
  "summary": {
    "total": 8,
    "passed": 8,
    "degraded": 0,
    "failed": 0
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `QUEUE_DIR` | `/var/tmp/agent-queue` | Task queue directory |
| `WORKER_RUN_DIR` | `/var/tmp/agent-workers/runs` | Worker heartbeat directory |
| `KEYPOOL_DIR` | `/var/tmp/agent-keypool` | Key pool directory |
| `LOG_DIR` | `${ORCHESTRATOR_DIR}/logs` | Log directory |
| `GIT_ROOT` | `/opt/Resonance` | Git repository root |

## Safety Guarantees

- **Read-only**: Does not modify any files, DB, or git state
- **No side effects**: Only reads configuration and log files
- **Non-blocking**: Does not acquire locks or block operations
- **Safe defaults**: Fails gracefully with DEGRADED status if components are missing

## Testing

Run the test suite:

```bash
ops/ai-agent-orchestrator/tests/test-health.sh
```

## Integration

The health check can be integrated with monitoring systems using JSON output:

```bash
if agent-health --json | jq -e '.health == "PASS"' > /dev/null; then
    echo "Orchestrator healthy"
else
    echo "Orchestrator issues detected"
fi
```