#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="$ROOT_DIR/var/run"
LOG_DIR="$ROOT_DIR/var/logs"
LOCK_FILE="$RUN_DIR/resonance-backend-auto-redeploy.lock"
STAMP_FILE="$RUN_DIR/backend-source.fingerprint"
mkdir -p "$RUN_DIR" "$LOG_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0
fingerprint() {
  (
    cd "$ROOT_DIR"
    find pom.xml apps modules projects/carbonet-adapter projects/carbonet-runtime ops/docker ops/scripts/deploy-carbonet-kubeadm-k8s.sh -type f \
      \( -name '*.java' -o -name '*.xml' -o -name '*.yml' -o -name '*.yaml' -o -name 'Dockerfile*' -o -name '*.sh' \) \
      ! -path '*/target/*' \
      ! -path '*/node_modules/*' \
      -printf '%T@ %s %p\n' 2>/dev/null | sort | sha256sum | awk '{print $1}'
  )
}
new_fp="$(fingerprint)"
old_fp="$(cat "$STAMP_FILE" 2>/dev/null || true)"
if [[ "$new_fp" == "$old_fp" ]]; then
  exit 0
fi
{
  echo "[$(date -Is)] backend/runtime change detected; building image and rolling deployment"
  cd "$ROOT_DIR"
  SKIP_FRONTEND=true SKIP_MAVEN_CLEAN=true RESONANCE_AUTO_GIT_COMMIT=false RESONANCE_AUTO_GIT_PUSH=false \
    bash ops/scripts/deploy-carbonet-kubeadm-k8s.sh
  printf '%s\n' "$new_fp" > "$STAMP_FILE"
  echo "[$(date -Is)] backend redeploy complete"
} >> "$LOG_DIR/resonance-backend-auto-redeploy.log" 2>&1
