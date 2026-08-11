#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
frontend="$ROOT_DIR/projects/carbonet-frontend/source"
runner="$frontend/scripts/run-full-screen-smoke.sh"
spec="$frontend/e2e/full-screen-smoke.spec.ts"

node --check "$frontend/scripts/prepare-full-screen-auth-state.mjs"
grep -Fq 'storageState: process.env.FULL_SCREEN_SMOKE_STORAGE_STATE' "$frontend/playwright.config.ts"
grep -Fq 'FULL_SCREEN_SMOKE_PREAUTHENTICATED === "true"' "$spec"
grep -Fq 'prepare-full-screen-auth-state.mjs' "$runner"
grep -Fq 'trap cleanup_smoke_secrets EXIT' "$runner"
grep -Fq 'chmod(output, 0o600)' "$frontend/scripts/prepare-full-screen-auth-state.mjs"
grep -Fq 'using per-shard UI login' "$runner"
grep -Fq 'strict gate forbids per-shard login' "$runner"
grep -Fq '"${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate' "$runner"
grep -Fq 'FULL_SCREEN_SMOKE_REQUIRE_PREAUTH=true' "$ROOT_DIR/ops/scripts/run-nightly-frontend-contracts.sh"
grep -Fq 'FULL_SCREEN_SMOKE_SHARDS="${FULL_SCREEN_SMOKE_SHARDS:-1}"' \
  "$ROOT_DIR/ops/scripts/resonance-full-screen-deploy-gate.sh"

python3 - "$runner" "$spec" <<'PY'
from pathlib import Path
import sys

runner=Path(sys.argv[1]).read_text(encoding="utf-8")
spec=Path(sys.argv[2]).read_text(encoding="utf-8")

def contract(runner_text: str, spec_text: str) -> bool:
    ensure=spec_text[spec_text.index("async function ensureAdminSession"):spec_text.index("async function inspectRoute")]
    return all(token in runner_text for token in (
        'strict_preauth="${FULL_SCREEN_SMOKE_REQUIRE_PREAUTH:-false}"',
        '"${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate',
        'if [[ "$strict_preauth" == true ]]',
        'exit 75',
    )) and all(token in ensure for token in (
        'if (requireSharedPreauth) throw new Error("shared preauthenticated session became invalid',
        'if (requireSharedPreauth) throw new Error("shared preauthenticated session is required',
    )) and ensure.index("shared preauthenticated session is required") < ensure.rindex('/admin/login/loginView`')

assert contract(runner,spec)
assert not contract(runner.replace('exit 75','true',1),spec)
assert not contract(runner,spec.replace('if (requireSharedPreauth) throw new Error("shared preauthenticated session became invalid','if (false) throw new Error("shared preauthenticated session became invalid',1))
assert not contract(runner,spec.replace('if (requireSharedPreauth) throw new Error("shared preauthenticated session is required','if (false) throw new Error("shared preauthenticated session is required',1))
PY

echo "[shared-smoke-auth-state-test] PASS"
