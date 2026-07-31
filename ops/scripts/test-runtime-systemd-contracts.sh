#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
nightly="$root/ops/systemd/resonance-full-screen-nightly.service"
recovery="$root/ops/systemd/resonance-recovery.service"
runner="$root/ops/scripts/run-nightly-frontend-contracts.sh"

grep -Fq 'WorkingDirectory=/opt/Resonance/var/deploy-worktrees/runtime-build' "$nightly"
grep -Fq 'EnvironmentFile=-/etc/resonance/secrets/admin-smoke.env' "$nightly"
grep -Fq 'FULL_SCREEN_SMOKE_ADMIN_USER="${FULL_SCREEN_SMOKE_ADMIN_USER:-${ADMIN_SMOKE_USER:-}}"' "$runner"
grep -Fq 'FULL_SCREEN_SMOKE_ADMIN_PASSWORD="${FULL_SCREEN_SMOKE_ADMIN_PASSWORD:-${ADMIN_SMOKE_PASSWORD:-}}"' "$runner"
grep -Fq 'SHARED_GENERATED_SCREEN_DIR:-/opt/Resonance/projects/carbonet-frontend/source/src/generated/screen-generation' "$runner"
grep -Fq 'trap cleanup_generated_links EXIT' "$runner"

grep -Fq 'WorkingDirectory=/opt/Resonance/var/deploy-worktrees/runtime-build' "$recovery"
grep -Fq 'exec /bin/bash /opt/Resonance/var/deploy-worktrees/runtime-build/ops/scripts/resonance-up.sh' "$recovery"
grep -Fq 'local home_dir="${HOME:-}"' "$root/ops/scripts/resonance-up.sh"

echo "PASS: runtime-managed systemd units use the verified worktree and credential aliases"
