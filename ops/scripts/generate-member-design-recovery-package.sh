#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${ROOT_DIR:-/opt/Resonance}"
OUT_ROOT="${MEMBER_DESIGN_RECOVERY_OUT_ROOT:-/opt/resonance-data/backups/member-process-design-recovery-auto}"
latest_system="$(readlink -f "$ROOT/var/ai-runtime/system-design-generator/latest")"
test -f "$latest_system/system-design-snapshot.json"
mkdir -p "$OUT_ROOT"
exec 9>"$OUT_ROOT/generator.lock"; flock -n 9 || exit 75
signature="$(sha256sum "$latest_system/meta.json" "$ROOT/ops/scripts/generate-member-process-designs.py" "$ROOT/ops/scripts/build-selective-member-recovery.py" "$ROOT/ops/scripts/package-member-design-recovery.py" | sha256sum | cut -d' ' -f1)"
if [[ -L "$OUT_ROOT/latest" ]]; then
 prev="$(readlink -f "$OUT_ROOT/latest")"
 [[ "$(jq -r '.signature//empty' "$prev/meta.json" 2>/dev/null)" == "$signature" ]] && [[ -f "$prev/package.zip" ]] && unzip -t "$prev/package.zip" >/dev/null && { echo "REUSED output=$prev signature=$signature"; exit 0; }
fi
run_id="$(date -u +%Y%m%dT%H%M%SZ)"; run="$OUT_ROOT/$run_id"; mkdir -p "$run"
python3 "$ROOT/ops/scripts/generate-member-process-designs.py" "$latest_system/system-design-snapshot.json" "$run/process-designs"
SYSTEM_DESIGN_LATEST="$latest_system" MEMBER_SELECTIVE_OUT="$run/selective-recovery" python3 "$ROOT/ops/scripts/build-selective-member-recovery.py"
python3 "$ROOT/ops/scripts/package-member-design-recovery.py" "$run/process-designs" "$run/selective-recovery" "$run/package"
test -f "$run/package.zip"
unzip -t "$run/package.zip" >/dev/null
jq -n --arg runId "$run_id" --arg signature "$signature" --arg systemDesign "$latest_system" '{status:"READY",runId:$runId,signature:$signature,systemDesign:$systemDesign}' > "$run/meta.json"
ln -sfn "$run_id" "$OUT_ROOT/latest.next"; mv -Tf "$OUT_ROOT/latest.next" "$OUT_ROOT/latest"
echo "PASS output=$run package=$run/package.zip signature=$signature"
