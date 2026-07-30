#!/usr/bin/env bash
set -euo pipefail

# Conservative cleanup: dry-run by default and never touches application data,
# backups, database storage, Docker volumes, or images used by running containers.
APPLY=0
CHECK_PATH="${CHECK_PATH:-/opt}"
HIGH_WATER_PERCENT="${HIGH_WATER_PERCENT:-78}"
LOW_WATER_PERCENT="${LOW_WATER_PERCENT:-74}"
STALE_DAYS="${STALE_DAYS:-7}"
REPO="${RESONANCE_REPO:-/opt/Resonance}"
RESONANCE_USER="${RESONANCE_USER:-$(stat -c %U "$REPO" 2>/dev/null || echo sjkim)}"

usage() {
  echo "Usage: $0 [--apply] [--check-path PATH] [--high-water-percent N] [--low-water-percent N] [--stale-days N]"
}
while (($#)); do
  case "$1" in
    --apply) APPLY=1 ;;
    --check-path) CHECK_PATH="$2"; shift ;;
    --high-water-percent) HIGH_WATER_PERCENT="$2"; shift ;;
    --low-water-percent) LOW_WATER_PERCENT="$2"; shift ;;
    --stale-days) STALE_DAYS="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
  shift
done
[[ -d "$CHECK_PATH" ]] || { echo "check path does not exist: $CHECK_PATH" >&2; exit 2; }
CHECK_PATH="$(readlink -f "$CHECK_PATH")"
[[ "$HIGH_WATER_PERCENT" =~ ^[0-9]+$ ]] || { echo "invalid high-water threshold" >&2; exit 2; }
[[ "$LOW_WATER_PERCENT" =~ ^[0-9]+$ ]] || { echo "invalid low-water threshold" >&2; exit 2; }
[[ "$STALE_DAYS" =~ ^[0-9]+$ ]] || { echo "invalid stale age" >&2; exit 2; }
((LOW_WATER_PERCENT < HIGH_WATER_PERCENT)) || {
  echo "low-water threshold must be lower than high-water threshold" >&2
  exit 2
}

disk_percent() { df -P "$CHECK_PATH" | awk 'NR==2 {gsub(/%/,"",$5); print $5}'; }
run() { if ((APPLY)); then "$@"; else printf 'DRY-RUN:'; printf ' %q' "$@"; printf '\n'; fi; }
run_as_user() {
  if ((APPLY)); then
    if [[ "$(id -un)" == "$RESONANCE_USER" ]]; then "$@"; else runuser -u "$RESONANCE_USER" -- "$@"; fi
  else
    printf 'DRY-RUN-AS %q:' "$RESONANCE_USER"; printf ' %q' "$@"; printf '\n'
  fi
}

before="$(disk_percent)"
echo "disk usage before: ${before}% path=$CHECK_PATH high=${HIGH_WATER_PERCENT}% low=${LOW_WATER_PERCENT}%"
if ((before < HIGH_WATER_PERCENT)); then
  echo "cleanup skipped: below high-water threshold"
  exit 0
fi
command -v journalctl >/dev/null && run journalctl --vacuum-size=300M
[[ -d /var/cache/apt/archives ]] && run find /var/cache/apt/archives -maxdepth 1 -type f -name '*.deb' -delete
run find /var/log -xdev -type f -name '*.gz' -mtime "+$STALE_DAYS" -delete
run find /var/tmp -xdev -maxdepth 1 -type f -name '*.tar' -mtime "+$STALE_DAYS" -delete

user_home="$(getent passwd "$RESONANCE_USER" | cut -d: -f6)"
[[ -x "$user_home/.local/bin/uv" ]] && run_as_user "$user_home/.local/bin/uv" cache prune
if command -v npm >/dev/null && [[ -d "$user_home/.npm/_cacache" ]]; then run_as_user npm cache clean --force; fi
if [[ -d "$user_home/.gradle/caches" ]]; then
  run find "$user_home/.gradle/caches" -type f -mtime +30 -delete
  run find "$user_home/.gradle/caches" -depth -type d -empty -delete
fi
if [[ -d "$user_home/.local/share/kilo/log" ]]; then
  run find "$user_home/.local/share/kilo/log" -type f -mtime "+$STALE_DAYS" -delete
  run find "$user_home/.local/share/kilo/log" -depth -type d -empty -delete
fi

command -v crictl >/dev/null && run crictl rmi --prune
if command -v docker >/dev/null; then
  run docker image prune -f
  run docker builder prune -f --filter "until=$((STALE_DAYS * 24))h"
fi

if [[ -d "$REPO/.git" ]]; then
  while IFS= read -r path; do
    [[ "$path" == /tmp/resonance-* && -d "$path" ]] || continue
    find "$path" -maxdepth 0 -mtime "+$STALE_DAYS" -print -quit | grep -q . || continue
    if command -v lsof >/dev/null && lsof +D "$path" >/dev/null 2>&1; then echo "skip active worktree: $path"; continue; fi
    run git -c "safe.directory=$REPO" -C "$REPO" worktree remove --force "$path"
  done < <(
    git -c "safe.directory=$REPO" -C "$REPO" worktree list --porcelain |
      sed -n 's/^worktree //p'
  )
  run git -c "safe.directory=$REPO" -C "$REPO" \
    worktree prune --expire="${STALE_DAYS}.days.ago"
fi

after="$(disk_percent)"
echo "disk usage after: ${after}% path=$CHECK_PATH"
if ((after > LOW_WATER_PERCENT)); then
  echo "disk usage remains above low-water threshold ${LOW_WATER_PERCENT}%" >&2
  exit 1
fi
