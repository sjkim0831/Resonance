#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
gate="$ROOT_DIR/ops/scripts/resonance-full-screen-deploy-gate.sh"
guard="$ROOT_DIR/ops/scripts/resonance-frontend-overlay-guard.sh"

grep -Fq 'snapshot_format="hardlink-tree"' "$gate"
grep -Fq 'cp -al "$OVERLAY_DIR/." "$snapshot_dir/frontend-overlay/"' "$gate"
grep -Fq 'snapshot_format="plain-tar"' "$gate"
grep -Fq 'SNAPSHOT_FORMAT="${SNAPSHOT_FORMAT:-legacy-gzip}"' "$gate"
grep -Fq 'FULL_SCREEN_GATE_SNAPSHOT_RETENTION:-3' "$gate"
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

echo "[fast-overlay-snapshot-test] PASS"
