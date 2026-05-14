# Resonance Command Inventory

This file logically compresses the script surface. Keep the physical scripts for compatibility, but route new agent work through the canonical commands below.

## Canonical Runtime Commands

| Intent | Command | Notes |
| --- | --- | --- |
| Start or recover `/opt/Resonance` | `bash ops/scripts/resonance-up.sh` | First command for `/opt/Resonance 켜줘`. Checks containerd, kubelet, DB, web, port 80, health. |
| Build and redeploy port 80 Kubernetes runtime | `bash ops/scripts/resonance-k8s-build-deploy-80.sh` | Full frontend build, Maven package, image build, rollout, health, rollback hooks. |
| Kubernetes runtime status/repair | `bash ops/scripts/resonance-k8s-doctor.sh` | Runtime diagnosis. |
| Operations doctor | `bash ops/scripts/resonance-k8s-ops-doctor.sh` | Heavier operational check. |
| CUBRID broker check/repair | `bash ops/scripts/resonance-cubrid-broker-doctor.sh` | Broker stability path. |
| Housekeeping | `bash ops/scripts/resonance-k8s-housekeeper.sh` | Disk/log/image cleanup. |
| Log DB registration | `bash ops/scripts/resonance-log-db-register.sh` | Runtime log registration path. |

## Logical Groups

- `00-canonical`: `resonance-up.sh`, `resonance-command-index.sh`
- `10-k8s-runtime`: `resonance-k8s-*`, `resonance-cubrid-*`, `resonance-runtime-watchdog.sh`, `resonance-log-db-register.sh`
- `20-local-legacy-18000`: `start-18000.sh`, `restart-18000.sh`, `build-restart-18000.sh`, maintenance scripts. Do not use for current Kubernetes runtime.
- `30-verify`: `verify-*`, `validate-*` gates.
- `40-codex`: Codex planning/build/status helpers.
- `50-ai-harness`: Ollama/vLLM/Hermes harness scripts.
- `60-deploy-install`: old deploy/install/Jenkins/Windows handoff scripts.
- `70-audit-report`: audit/show/list scripts.
- `80-hermes-emission`: Hermes packet and emission rollout helpers.
- `90-misc`: one-off utilities and older helper scripts.

## Structural Rule

Do not add new top-level startup scripts. Add new behavior behind `resonance-up.sh` for startup or behind `resonance-command-index.sh` for operator routing.
