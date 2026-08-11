#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
gate="$ROOT_DIR/ops/scripts/resonance-full-screen-deploy-gate.sh"
guard="$ROOT_DIR/ops/scripts/resonance-frontend-overlay-guard.sh"

grep -Fq 'snapshot_format="hardlink-tree"' "$gate"
grep -Fq 'cp -al "$OVERLAY_DIR/." "$snapshot_dir/frontend-overlay/"' "$gate"
grep -Fq 'OVERLAY_DIR="${OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}"' "$gate"
grep -Fq 'verify-react-asset-closure.mjs" "$OVERLAY_DIR"' "$gate"
grep -Fq '"$snapshot_dir/frontend-overlay"' "$gate"
grep -Fq 'mktemp "$STATE_DIR/.active.env.XXXXXX"' "$gate"
grep -Fq 'mv -fT -- "$active_tmp" "$ACTIVE_FILE"' "$gate"
grep -Fq 'stat -c '\''%a'\'' "$ACTIVE_FILE"' "$gate"
grep -Fq '[[ -f "$ACTIVE_FILE" && ! -L "$ACTIVE_FILE" && -s "$ACTIVE_FILE" ]]' "$gate"
grep -Fq 'snapshot_format="plain-tar"' "$gate"
grep -Fq 'SNAPSHOT_FORMAT="${SNAPSHOT_FORMAT:-legacy-gzip}"' "$gate"
grep -Fq 'FULL_SCREEN_GATE_SNAPSHOT_RETENTION:-3' "$gate"
grep -Fq 'for snapshot in "${stale_snapshots[@]}"; do' "$gate"
if grep -Fq 'for snapshot in "${stale_snapshots[@]:-}"; do' "$gate"; then
  echo "empty snapshot arrays must not create an empty cleanup path" >&2
  exit 1
fi
grep -Fq 'sudo -n rm -rf -- "$snapshot"' "$gate"
grep -Fq 'stale snapshot cleanup deferred' "$gate"
grep -Fq 'os.replace(tmp, path)' "$guard"

if grep -Fq 'tar -C "$OVERLAY_DIR" -czf' "$gate"; then
  echo "capture path must not gzip the already compressed frontend assets" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/live" "$tmp/snapshot"
printf 'old\n' > "$tmp/live/index.html"
cp -al "$tmp/live/." "$tmp/snapshot/"
printf 'new\n' > "$tmp/live/.index.html.next"
mv -f "$tmp/live/.index.html.next" "$tmp/live/index.html"
[[ "$(cat "$tmp/live/index.html")" == "new" ]]
[[ "$(cat "$tmp/snapshot/index.html")" == "old" ]] || {
  echo "atomic overlay replacement mutated the hard-link rollback snapshot" >&2
  exit 1
}

capture_overlay="$tmp/capture-live"
capture_state="$tmp/state"
capture_report="$tmp/report"
mkdir -p "$capture_overlay/.vite" "$capture_overlay/assets" "$tmp/bin"
printf '<script type="module" src="/assets/app.js"></script>\n' > "$capture_overlay/index.html"
printf '{"src/main.tsx":{"file":"assets/app.js","css":["assets/app.css"]}}\n' \
  > "$capture_overlay/.vite/manifest.json"
printf 'console.log("capture");\n' > "$capture_overlay/assets/app.js"
printf 'body{}\n' > "$capture_overlay/assets/app.css"
cat > "$tmp/bin/kubectl" <<'SH'
#!/usr/bin/env bash
case "$*" in
  *"get deployment carbonet-runtime"*) printf 'registry.invalid/carbonet-runtime:baseline' ;;
  *"get deployment carbonet-web"*) printf 'registry.invalid/carbonet-web:baseline' ;;
  *"get configmap carbonet-web-nginx"*) printf 'server { listen 8080; }\n' ;;
  *) printf 'unexpected fake kubectl call: %s\n' "$*" >&2; exit 91 ;;
esac
SH
chmod 700 "$tmp/bin/kubectl"
cat > "$tmp/bin/cp" <<'SH'
#!/usr/bin/env bash
/usr/bin/cp "$@" || exit $?
if [[ "${CORRUPT_CAPTURE_COPY:-false}" == true && "${1:-}" == -al ]]; then
  destination="${!#}"
  rm -f -- "$destination/assets/app.js"
fi
SH
chmod 700 "$tmp/bin/cp"
cat > "$tmp/bin/mktemp" <<'SH'
#!/usr/bin/env bash
if [[ "${FAULT_ACTIVE_MKTEMP:-false}" == true && "$*" == *'/.active.env.XXXXXX'* ]]; then
  exit 97
fi
exec /usr/bin/mktemp "$@"
SH
chmod 700 "$tmp/bin/mktemp"
cat > "$tmp/bin/mv" <<'SH'
#!/usr/bin/env bash
last="${!#}"
if [[ "${FAULT_ACTIVE_MV:-false}" == true && "$last" == "${FAULT_ACTIVE_FILE:-}" ]]; then
  exit 96
fi
exec /usr/bin/mv "$@"
SH
chmod 700 "$tmp/bin/mv"

run_isolated_capture() {
  local state="${1:-$capture_state}" mktemp_fault="${2:-false}" mv_fault="${3:-false}"
  PATH="$tmp/bin:$PATH" \
  FAULT_ACTIVE_MKTEMP="$mktemp_fault" \
  FAULT_ACTIVE_MV="$mv_fault" \
  FAULT_ACTIVE_FILE="$state/active.env" \
  ROOT_DIR="$ROOT_DIR" \
  OVERLAY_DIR="$capture_overlay" \
  FULL_SCREEN_GATE_STATE_DIR="$state" \
  FULL_SCREEN_GATE_REPORT_DIR="$capture_report" \
  FULL_SCREEN_GATE_BASE_COMMIT=1111111111111111111111111111111111111111 \
    bash "$gate" capture
}

run_isolated_capture >"$tmp/capture-valid.log"
active_file="$capture_state/active.env"
[[ -s "$active_file" ]]
[[ "$(stat -c '%a' "$active_file")" == 600 ]]
snapshot_dir="$(sed -n "s/^SNAPSHOT_DIR='\(.*\)'$/\1/p" "$active_file")"
[[ -n "$snapshot_dir" && -s "$snapshot_dir/frontend-overlay/index.html" ]]
node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" \
  "$snapshot_dir/frontend-overlay" >/dev/null
active_hash_before="$(sha256sum "$active_file" | awk '{print $1}')"
snapshot_count_before="$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"

if CORRUPT_CAPTURE_COPY=true run_isolated_capture >"$tmp/capture-copy-invalid.log" 2>&1; then
  echo "incomplete copied overlay closure did not fail closed" >&2
  exit 1
fi
active_hash_after_copy_failure="$(sha256sum "$active_file" | awk '{print $1}')"
snapshot_count_after_copy_failure="$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
[[ "$active_hash_after_copy_failure" == "$active_hash_before" ]] || {
  echo "incomplete copied closure changed the current active rollback pointer" >&2
  exit 1
}
[[ "$snapshot_count_after_copy_failure" == "$snapshot_count_before" ]] || {
  echo "incomplete copied closure published a rollback snapshot" >&2
  exit 1
}
grep -Fq 'captured hard-link overlay closure is incomplete' "$tmp/capture-copy-invalid.log"

rm -f "$capture_overlay/assets/app.js"
if run_isolated_capture >"$tmp/capture-invalid.log" 2>&1; then
  echo "incomplete mounted overlay capture did not fail closed" >&2
  exit 1
fi
active_hash_after="$(sha256sum "$active_file" | awk '{print $1}')"
snapshot_count_after="$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
[[ "$active_hash_after" == "$active_hash_before" ]] || {
  echo "incomplete capture changed the current active rollback pointer" >&2
  exit 1
}
[[ "$snapshot_count_after" == "$snapshot_count_before" ]] || {
  echo "incomplete capture published a rollback snapshot" >&2
  exit 1
}
grep -Fq '[asset-closure] missing 1 manifest assets' "$tmp/capture-invalid.log"

printf 'console.log("capture");\n' > "$capture_overlay/assets/app.js"
if run_isolated_capture "$capture_state" true false >"$tmp/capture-mktemp-fault.log" 2>&1; then
  echo "active pointer mktemp fault unexpectedly succeeded" >&2
  exit 1
fi
[[ "$(sha256sum "$active_file" | awk '{print $1}')" == "$active_hash_before" ]]
[[ "$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" == "$snapshot_count_before" ]]
! find "$capture_state" -maxdepth 1 -type f -name '.active.env.*' | grep -q .
grep -Fq 'active rollback pointer temp allocation failed' "$tmp/capture-mktemp-fault.log"

if run_isolated_capture "$capture_state" false true >"$tmp/capture-mv-fault.log" 2>&1; then
  echo "active pointer publish-path fault unexpectedly succeeded" >&2
  exit 1
fi
[[ "$(sha256sum "$active_file" | awk '{print $1}')" == "$active_hash_before" ]]
[[ "$(find "$capture_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" == "$snapshot_count_before" ]]
! find "$capture_state" -maxdepth 1 -type f -name '.active.env.*' | grep -q .
grep -Fq 'active rollback pointer publish failed' "$tmp/capture-mv-fault.log"

directory_state="$tmp/directory-state"
mkdir -p "$directory_state/active.env"
touch "$directory_state/active.env/keep"
if run_isolated_capture "$directory_state" false false >"$tmp/capture-directory-target.log" 2>&1; then
  echo "active pointer directory target unexpectedly succeeded" >&2
  exit 1
fi
[[ -e "$directory_state/active.env/keep" ]]
[[ ! -d "$directory_state/snapshots" \
   || "$(find "$directory_state/snapshots" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" == 0 ]]
grep -Fq 'active rollback pointer target is unsafe' "$tmp/capture-directory-target.log"

symlink_state="$tmp/symlink-state"
symlink_executed="$tmp/symlink-active-was-sourced"
mkdir -p "$symlink_state"
printf 'touch %q\n' "$symlink_executed" > "$tmp/malicious-active.env"
ln -s "$tmp/malicious-active.env" "$symlink_state/active.env"
if ROOT_DIR="$ROOT_DIR" FULL_SCREEN_GATE_STATE_DIR="$symlink_state" \
    bash "$gate" finalize-success >"$tmp/load-symlink.log" 2>&1; then
  echo "symlinked active pointer unexpectedly loaded" >&2
  exit 1
fi
[[ ! -e "$symlink_executed" ]]
grep -Fq 'deployment snapshot is missing or unsafe' "$tmp/load-symlink.log"

echo "[fast-overlay-snapshot-test] PASS realOverlayDefault=true sourceClosure=verified copiedClosure=verified incompleteSource=rejected incompleteCopy=rejected markerMode=0600 markerTemp=same-dir markerPublish=atomic directoryTarget=rejected tempFault=preserved pathFault=preserved symlinkLoad=rejected"
