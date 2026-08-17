#!/usr/bin/env bash
set -Eeuo pipefail

# Retired: this legacy boot/manual recovery path performed rollout restarts on
# carbonet-prod/carbonet-runtime without the durable release-attempt journal or
# runtime-identity ledger transition. The installed boot owner is now
# carbonet-post-reboot-recovery.service, whose same-template recovery contract
# is verified independently. Keep this entrypoint deterministic for old command
# aliases and installed snapshots, but do not touch services, builds, or K8s.
echo '[resonance-up] retired; use carbonet-post-reboot-recovery.service (mutation=0)' >&2
exit 78
