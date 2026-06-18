#!/usr/bin/env bash
set -euo pipefail
export RESONANCE_SUDO_PASSWORD="qwer1234"

SCRIPT_DIR="/opt/Resonance/ops/scripts"
BACKUP_DIR="/opt/Resonance/var/backup/scripts"
PROTECTED_FILES=(
    "resonance-k8s-build-deploy-80.sh"
)

log_event() {
    printf '[script-protector] %s\n' "$1"
}

sudo_cmd() {
    printf '%s\n' "$RESONANCE_SUDO_PASSWORD" | sudo -S "$@" 2>/dev/null
}

for file in "${PROTECTED_FILES[@]}"; do
    src="$SCRIPT_DIR/$file"
    backup="$BACKUP_DIR/$file.sh"
    if [[ -f "$backup" ]] && [[ ! -f "$src" ]]; then
        log_event "RESTORING $file from backup"
        sudo_cmd chattr -i "$backup" 2>/dev/null || true
        cp "$backup" "$src"
        sudo_cmd chattr +i "$src"
        sudo_cmd chattr +i "$backup"
        log_event "RESTORED $file"
    elif [[ ! -f "$src" ]]; then
        log_event "ERROR: no backup and no source for $file"
        exit 1
    fi
    if ! sudo_cmd lsattr "$src" 2>/dev/null | grep -q 'i'; then
        log_event "WARNING: $file lost immutable flag, re-applying"
        sudo_cmd chattr +i "$src"
    fi
    if ! sudo_cmd lsattr "$backup" 2>/dev/null | grep -q 'i'; then
        log_event "WARNING: backup $file lost immutable flag, re-applying"
        sudo_cmd chattr +i "$backup"
    fi
done
log_event "All protected scripts verified"
