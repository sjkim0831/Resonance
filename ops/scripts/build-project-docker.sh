#!/usr/bin/env bash
set -eu
printf '%s\n' 'ERROR: Kubernetes/Docker deployment has been retired. No changes were made.' 'Use the current native systemd operations procedure; do not recreate the old cluster.' >&2
exit 64
