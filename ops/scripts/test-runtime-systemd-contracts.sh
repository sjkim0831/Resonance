#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
nightly="$root/ops/systemd/resonance-full-screen-nightly.service"
recovery="$root/ops/systemd/resonance-recovery.service"
safe_recovery="$root/ops/systemd/carbonet-post-reboot-recovery.service"
legacy_up="$root/ops/scripts/resonance-up.sh"
command_index="$root/ops/scripts/resonance-command-index.sh"
route_heal="$root/ops/scripts/resonance-react-route-self-heal.sh"
route_heal_service="$root/ops/systemd/resonance-react-route-self-heal.service"
route_heal_timer="$root/ops/systemd/resonance-react-route-self-heal.timer"
selector="$root/ops/scripts/select-catalog-contract-tests.sh"
auto="$root/ops/scripts/auto-deploy-main.sh"
runner="$root/ops/scripts/run-nightly-frontend-contracts.sh"

grep -Fq 'WorkingDirectory=/opt/Resonance/var/deploy-worktrees/runtime-build' "$nightly"
grep -Fq 'EnvironmentFile=-/etc/resonance/secrets/admin-smoke.env' "$nightly"
grep -Fq 'Environment=FULL_SCREEN_SMOKE_RETRIES=0' "$nightly"
grep -Fq 'FULL_SCREEN_SMOKE_ADMIN_USER="${FULL_SCREEN_SMOKE_ADMIN_USER:-${ADMIN_SMOKE_USER:-}}"' "$runner"
grep -Fq 'FULL_SCREEN_SMOKE_ADMIN_PASSWORD="${FULL_SCREEN_SMOKE_ADMIN_PASSWORD:-${ADMIN_SMOKE_PASSWORD:-}}"' "$runner"
grep -Fq 'SHARED_GENERATED_SCREEN_DIR:-/opt/Resonance/projects/carbonet-frontend/source/src/generated/screen-generation' "$runner"
grep -Fq 'trap cleanup_generated_links EXIT' "$runner"
grep -Fq 'FULL_SCREEN_QUALITY_ARTIFACT_DIR:-/opt/resonance-data/quality/full-screen/latest' "$runner"
grep -Fq 'normalize-deploy-generated-assets.sh' "$runner"

for file in "$recovery" "$safe_recovery" "$legacy_up" "$command_index" "$route_heal" "$route_heal_service" "$route_heal_timer" "$selector" "$auto"; do
  [[ -s "$file" && ! -L "$file" ]] || { echo "missing/unsafe: $file" >&2; exit 1; }
done
bash -n "$legacy_up" "$command_index" "$route_heal"

grep -Fq 'Retired duplicate Resonance Kubernetes recovery entrypoint' "$recovery"
grep -Fq 'carbonet-post-reboot-recovery.service owns recovery (mutation=0)' "$recovery"
! grep -Fq 'resonance-up.sh' "$recovery"
! grep -Eq 'sleep 30|kubectl|rollout restart|set image|set env' "$recovery"
grep -Fq 'ExecStart=/usr/bin/bash /opt/resonance-data/control-plane/bin/reconcile-post-reboot-runtime.sh' "$safe_recovery"
grep -Fq 'ExecStart=/bin/bash /opt/Resonance/ops/scripts/resonance-react-route-self-heal.sh' "$route_heal_service"
grep -Fq 'OnUnitActiveSec=3min' "$route_heal_timer"
grep -Fq 'official durable auto-deploy pipeline (mutation=0)' "$route_heal"
grep -Fq 'exit 78' "$route_heal"
! grep -Eq 'verify-react-mount|screen-overlay-apply|kubectl|rsync|cp |mv ' "$route_heal"

python3 - "$legacy_up" "$recovery" "$command_index" "$selector" "$auto" <<'PY'
from pathlib import Path
import sys

up,unit,command,selector,auto=(Path(path).read_text(encoding="utf-8") for path in sys.argv[1:])

def assert_retired(up_source: str,unit_source: str) -> None:
    assert up_source.count('exit 78')==1
    assert 'carbonet-post-reboot-recovery.service (mutation=0)' in up_source
    for token in ('kubectl ','curl ','systemctl ','docker ','mvn ','npm ','rollout restart deployment','set image','set env'):
        assert token not in up_source
    assert 'resonance-up.sh' not in unit_source
    assert 'carbonet-post-reboot-recovery.service owns recovery (mutation=0)' in unit_source
    for token in ('sleep 30','kubectl','rollout restart','set image','set env'):
        assert token not in unit_source

assert_retired(up,unit)
for mutant_up,mutant_unit in (
    (up.replace('exit 78','exit 0',1),unit),
    (up.replace('exit 78','kubectl rollout restart deployment/carbonet-runtime\nexit 78',1),unit),
    (up,unit.replace('printf "%s\\n"',
       'exec /bin/bash /opt/Resonance/ops/scripts/resonance-up.sh #',1)),
):
    try:
        assert_retired(mutant_up,mutant_unit)
    except AssertionError:
        continue
    raise AssertionError('legacy boot recovery mutant survived')

assert 'exec /usr/bin/bash "$ROOT_DIR/ops/scripts/resonance-up.sh" "${@:2}"' in command
gate=auto[
    auto.index('run_runtime_template_identity_migration_contract_if_required() {'):
    auto.index('run_operational_usage_ledger_live_e2e_if_required() {')]
selector_end=gate.index('; then')
for path in ('ops/scripts/resonance-up.sh','ops/systemd/resonance-recovery.service',
             'ops/scripts/test-runtime-systemd-contracts.sh'):
    assert gate.index(path) < selector_end
    assert path in selector
parallel=gate.index('run_parallel_contract_tests',selector_end)
assert gate.index('ops/scripts/test-runtime-systemd-contracts.sh',parallel) > parallel
PY

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
: >"$tmp/calls"
for tool in kubectl curl systemctl docker mvn npm; do
  cat >"$tmp/bin/$tool" <<'SH'
#!/usr/bin/env bash
printf '%s %s\n' "$(basename "$0")" "$*" >>"$BOOT_MUTATION_CALLS"
exit 91
SH
  chmod +x "$tmp/bin/$tool"
done

status=0
PATH="$tmp/bin:$PATH" BOOT_MUTATION_CALLS="$tmp/calls" \
  bash "$legacy_up" >"$tmp/up.out" 2>&1 || status=$?
[[ "$status" == 78 && ! -s "$tmp/calls" ]]
grep -Fq 'mutation=0' "$tmp/up.out"

status=0
PATH="$tmp/bin:$PATH" BOOT_MUTATION_CALLS="$tmp/calls" \
  bash "$route_heal" >"$tmp/route-heal.out" 2>&1 || status=$?
[[ "$status" == 78 && ! -s "$tmp/calls" ]]
grep -Fq 'mutation=0' "$tmp/route-heal.out"

status=0
PATH="$tmp/bin:$PATH" BOOT_MUTATION_CALLS="$tmp/calls" ROOT_DIR="$root" \
  bash "$command_index" up >"$tmp/command.out" 2>&1 || status=$?
[[ "$status" == 78 && ! -s "$tmp/calls" ]]

for retired_v3_command in deploy deploy-safe v3-deploy; do
  status=0
  PATH="$tmp/bin:$PATH" BOOT_MUTATION_CALLS="$tmp/calls" ROOT_DIR="$root" \
    bash "$command_index" "$retired_v3_command" >"$tmp/$retired_v3_command.out" 2>&1 || status=$?
  [[ "$status" == 78 && ! -s "$tmp/calls" ]]
done

echo "PASS: runtime systemd recovery owner=carbonet-post-reboot legacyUp=retired78 routeHeal=retired78 caller=propagated v3Routes=retired78x3 mutation=0 mutants=4"
