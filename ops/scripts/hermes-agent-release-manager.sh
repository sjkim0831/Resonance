#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${HERMES_AGENT_BASE_DIR:-/opt/util/ai}"
SOURCE_DIR="${HERMES_AGENT_SOURCE_DIR:-$BASE_DIR/hermes-agent-v20260516}"
RELEASES_DIR="${HERMES_AGENT_RELEASES_DIR:-$BASE_DIR/hermes-agent-releases}"
ACTIVE_LINK="${HERMES_AGENT_ACTIVE_LINK:-$BASE_DIR/hermes-agent-active}"
NEXT_LINK="${HERMES_AGENT_NEXT_LINK:-$BASE_DIR/hermes-agent-next}"
ROLLBACK_LINK="${HERMES_AGENT_ROLLBACK_LINK:-$BASE_DIR/hermes-agent-rollback}"
STATE_DIR="${HERMES_AGENT_STATE_DIR:-/opt/Resonance/var/ai-runtime/hermes-agent-release}"
LOCK_DIR="${HERMES_AGENT_LOCK_DIR:-/tmp/hermes-agent-release-lock}"
SMOKE_TIMEOUT_SECONDS="${HERMES_AGENT_SMOKE_TIMEOUT_SECONDS:-30}"

mkdir -p "$RELEASES_DIR" "$STATE_DIR" "$LOCK_DIR"

usage() {
  cat <<'EOF'
usage: hermes-agent-release-manager.sh <init|status|prepare-next|smoke|promote|rollback|active-bin|next-bin> [label]
EOF
}

readlink_or_echo() {
  local path="$1"
  if [ -L "$path" ]; then
    readlink -f "$path"
  else
    printf '%s\n' "$path"
  fi
}

active_dir() {
  if [ -e "$ACTIVE_LINK" ]; then
    readlink_or_echo "$ACTIVE_LINK"
  else
    printf '%s\n' "$SOURCE_DIR"
  fi
}

next_dir() {
  if [ -e "$NEXT_LINK" ]; then
    readlink_or_echo "$NEXT_LINK"
  else
    printf ''
  fi
}

hermes_bin_for() {
  local dir="$1"
  printf '%s/venv/bin/hermes\n' "$dir"
}

ensure_init() {
  if [ ! -d "$SOURCE_DIR" ]; then
    echo "Hermes source dir not found: $SOURCE_DIR" >&2
    exit 2
  fi
  if [ ! -e "$ACTIVE_LINK" ]; then
    ln -sfn "$SOURCE_DIR" "$ACTIVE_LINK"
  fi
  if [ ! -x "$(hermes_bin_for "$(active_dir)")" ]; then
    echo "Active Hermes binary is not executable: $(hermes_bin_for "$(active_dir)")" >&2
    exit 2
  fi
}

copy_release() {
  local source="$1"
  local target="$2"
  rm -rf "$target"
  mkdir -p "$(dirname "$target")"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude '__pycache__/' \
      --exclude '.pytest_cache/' \
      "$source"/ "$target"/
  else
    cp -a "$source" "$target"
  fi
}

write_state() {
  local name="$1"
  local value="$2"
  printf '%s\n' "$value" > "$STATE_DIR/$name"
}

case "${1:-}" in
  init)
    ensure_init
    write_state active "$(active_dir)"
    echo "active=$(active_dir)"
    ;;
  status)
    ensure_init
    echo "source=$SOURCE_DIR"
    echo "active=$(active_dir)"
    echo "next=$(next_dir)"
    if [ -e "$ROLLBACK_LINK" ]; then
      echo "rollback=$(readlink_or_echo "$ROLLBACK_LINK")"
    else
      echo "rollback="
    fi
    echo "activeBin=$(hermes_bin_for "$(active_dir)")"
    ;;
  active-bin)
    ensure_init
    hermes_bin_for "$(active_dir)"
    ;;
  next-bin)
    ensure_init
    candidate="$(next_dir)"
    if [ -z "$candidate" ]; then
      echo "next release is not prepared" >&2
      exit 2
    fi
    hermes_bin_for "$candidate"
    ;;
  prepare-next)
    ensure_init
    label="${2:-$(date +%Y%m%d-%H%M%S)}"
    safe_label="$(printf '%s' "$label" | tr -c '0-9A-Za-z_.-' '-')"
    target="$RELEASES_DIR/hermes-agent-$safe_label"
    (
      set -e
      flock 9
      copy_release "$(active_dir)" "$target"
      ln -sfn "$target" "$NEXT_LINK"
      write_state next "$target"
      echo "next=$target"
    ) 9>"$LOCK_DIR/lock"
    ;;
  smoke)
    ensure_init
    target_name="${2:-next}"
    if [ "$target_name" = "active" ]; then
      target="$(active_dir)"
    elif [ "$target_name" = "next" ]; then
      target="$(next_dir)"
    else
      target="$target_name"
    fi
    if [ -z "$target" ] || [ ! -x "$(hermes_bin_for "$target")" ]; then
      echo "Hermes candidate binary not executable: $(hermes_bin_for "$target")" >&2
      exit 2
    fi
    timeout "${SMOKE_TIMEOUT_SECONDS}s" "$(hermes_bin_for "$target")" --version >/dev/null
    timeout "${SMOKE_TIMEOUT_SECONDS}s" "$(hermes_bin_for "$target")" --help >/dev/null
    echo "smoke OK $target"
    ;;
  promote)
    ensure_init
    candidate="${2:-$(next_dir)}"
    if [ -z "$candidate" ]; then
      echo "next release is not prepared" >&2
      exit 2
    fi
    candidate="$(readlink_or_echo "$candidate")"
    "$0" smoke "$candidate" >/dev/null
    old_active="$(active_dir)"
    ln -sfn "$old_active" "$ROLLBACK_LINK"
    ln -sfn "$candidate" "$ACTIVE_LINK"
    write_state active "$candidate"
    write_state rollback "$old_active"
    if [ "${HERMES_AGENT_SYNC_ORIGINAL_ON_PROMOTE:-1}" = "1" ] && [ "$SOURCE_DIR" != "$candidate" ]; then
      backup="$RELEASES_DIR/original-backup-$(date +%Y%m%d-%H%M%S)"
      copy_release "$SOURCE_DIR" "$backup"
      copy_release "$candidate" "$SOURCE_DIR"
      write_state originalBackup "$backup"
    fi
    echo "promoted=$candidate"
    echo "rollback=$old_active"
    ;;
  rollback)
    ensure_init
    rollback_target="$(readlink_or_echo "$ROLLBACK_LINK" 2>/dev/null || true)"
    if [ -z "$rollback_target" ] || [ ! -d "$rollback_target" ]; then
      echo "rollback target not found" >&2
      exit 2
    fi
    current="$(active_dir)"
    ln -sfn "$rollback_target" "$ACTIVE_LINK"
    ln -sfn "$current" "$NEXT_LINK"
    write_state active "$rollback_target"
    write_state next "$current"
    echo "rolledBack=$rollback_target"
    echo "previousActive=$current"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
