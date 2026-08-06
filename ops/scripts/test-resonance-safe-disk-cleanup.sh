#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cleanup="$script_dir/resonance-safe-disk-cleanup.sh"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
cat >"$tmp_dir/df" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' \
  'Filesystem 1024-blocks Used Available Capacity Mounted on' \
  '/dev/test 100 77 23 77% /opt'
EOF
chmod +x "$tmp_dir/df"

output="$(
  PATH="$tmp_dir:$PATH" \
  CHECK_PATH=/ \
  NATIVE_TEMP_ROOT="$tmp_dir" \
  OVERLAY_BACKUP_DIR="$tmp_dir" \
  HIGH_WATER_PERCENT=78 \
  LOW_WATER_PERCENT=74 \
  bash "$cleanup"
)"
grep -q "cleanup skipped: below high-water threshold" <<<"$output"
grep -q "OVERLAY_BACKUP_RETAIN_COUNT" "$cleanup"
grep -q "mapped_native" "$cleanup"
grep -q 'ai_root="/opt/util/ai"' "$cleanup"
grep -q "'\*.incomplete'" "$cleanup"

if CHECK_PATH=/ HIGH_WATER_PERCENT=74 LOW_WATER_PERCENT=78 bash "$cleanup" >/dev/null 2>&1; then
  echo "expected invalid hysteresis thresholds to fail" >&2
  exit 1
fi

echo "SAFE_DISK_CLEANUP_TEST_PASS"
