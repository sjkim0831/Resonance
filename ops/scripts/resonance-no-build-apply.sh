#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 2 ]]; then
  cat <<'USAGE'
Usage:
  bash ops/scripts/resonance-no-build-apply.sh <repo-root> <diff-file>

Purpose:
  Apply server-driven / metadata-driven runtime changes without npm build,
  Maven build, image build, rollout restart, or redeploy.

Instant runtime paths:
  projects/carbonet-frontend/src/main/resources/static/react-app/**
    - mounted into the running pod at /app/react-app-overlay
    - use for JS/CSS/assets and JSON metadata consumed by the React shell
  projects/carbonet-assets/static/**
    - mounted into the running pod at /app/static-overlay
    - use for every non-compiled static asset, including downloads, images,
      error pages, react-shell, and react-app fallback assets
  projects/carbonet-backend-metadata/**
    - mounted into the running pod at /app/backend-metadata
    - use for server-driven JSON responses and backend metadata
  var/k8s/carbonet-runtime-manifest.json
    - applied to ConfigMap carbonet-runtime-manifest
    - projected into the pod at /app/config/manifest.json

Non-runtime code paths are rejected because they still require a normal build.
USAGE
  exit 0
fi

REPO_ROOT="${1:?repo root is required}"
DIFF_FILE="${2:?diff file is required}"
ARTIFACTS_ROOT="$(cd "$(dirname "$DIFF_FILE")" && pwd)"
RUN_DIR="$REPO_ROOT/var/run"
LOG_DIR="$REPO_ROOT/var/logs"
STATUS_FILE="$RUN_DIR/no-build-apply-status.json"
CHANGED_FILE="$ARTIFACTS_ROOT/no-build-changed-files.txt"
mkdir -p "$RUN_DIR" "$LOG_DIR"

if [[ ! -d "$REPO_ROOT" ]]; then
  echo "Repository root does not exist: $REPO_ROOT" >&2
  exit 1
fi
if [[ ! -f "$DIFF_FILE" ]]; then
  echo "Diff file does not exist: $DIFF_FILE" >&2
  exit 1
fi

cd "$REPO_ROOT"

mapfile -t changed_files < <(git diff --name-only --diff-filter=ACMRTUXB --no-index /dev/null /dev/null 2>/dev/null || true)
mapfile -t changed_files < <(git apply --numstat --summary "$DIFF_FILE" 2>/dev/null | awk '
  /^[0-9-]+[[:space:]]+[0-9-]+[[:space:]]+/ {print $3; next}
  / create mode / {print $NF; next}
  / delete mode / {print $NF; next}
  / rename / {
    line=$0; sub(/^.* rename /, "", line); sub(/ \([0-9]+%\)$/, "", line); print line; next
  }
' | sed 's# => #/#g' | sort -u)

if [[ ${#changed_files[@]} -eq 0 && -f "$ARTIFACTS_ROOT/changed-files.txt" ]]; then
  mapfile -t changed_files < <(sed '/^[[:space:]]*$/d' "$ARTIFACTS_ROOT/changed-files.txt" | sort -u)
fi

printf '%s\n' "${changed_files[@]}" > "$CHANGED_FILE"

is_runtime_path() {
  local f="$1"
  [[ "$f" == projects/carbonet-frontend/src/main/resources/static/react-app/* ]] && return 0
  [[ "$f" == projects/carbonet-assets/static/* ]] && return 0
  [[ "$f" == projects/carbonet-backend-metadata/* ]] && return 0
  [[ "$f" == var/k8s/carbonet-runtime-manifest.json ]] && return 0
  [[ "$f" == ops/runtime-metadata/* ]] && return 0
  [[ "$f" == ops/scripts/resonance-no-build-apply.sh ]] && return 0
  return 1
}

rejected=()
for f in "${changed_files[@]}"; do
  [[ -z "$f" ]] && continue
  if ! is_runtime_path "$f"; then
    rejected+=("$f")
  fi
done

if [[ ${#rejected[@]} -gt 0 ]]; then
  {
    echo "No-build apply rejected. These paths still require build/redeploy:"
    printf ' - %s\n' "${rejected[@]}"
    echo
    echo "Move screen behavior into react-app overlay JSON/assets or backend metadata before using this path."
  } >&2
  exit 2
fi

if ! git apply --check --whitespace=nowarn "$DIFF_FILE"; then
  echo "git apply --check failed; refusing no-build apply to avoid partial runtime state." >&2
  exit 1
fi

git apply --whitespace=nowarn "$DIFF_FILE"

manifest_applied=false
if printf '%s\n' "${changed_files[@]}" | grep -qx 'var/k8s/carbonet-runtime-manifest.json'; then
  kubectl -n carbonet-prod create configmap carbonet-runtime-manifest \
    --from-file=manifest.json="$REPO_ROOT/var/k8s/carbonet-runtime-manifest.json" \
    --dry-run=client -o yaml | kubectl apply -f -
  manifest_applied=true
fi

pod="$(kubectl -n carbonet-prod get pod -l app=carbonet-runtime -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
overlay_ok=false
manifest_seen=false
if [[ -n "$pod" ]]; then
  if kubectl -n carbonet-prod exec "$pod" -- sh -lc 'test -d /app/react-app-overlay && test -r /app/react-app-overlay/api/page-component-map.json'; then
    overlay_ok=true
  fi
  if [[ "$manifest_applied" == true ]]; then
    for _ in $(seq 1 24); do
      if kubectl -n carbonet-prod exec "$pod" -- sh -lc 'grep -q "projectId" /app/config/manifest.json'; then
        manifest_seen=true
        break
      fi
      sleep 5
    done
  else
    manifest_seen=true
  fi
fi

cat > "$STATUS_FILE" <<STATUS
{
  "mode": "no-build-no-deploy",
  "appliedAt": "$(date -Is)",
  "diffFile": "$DIFF_FILE",
  "changedFiles": "$(printf '%s,' "${changed_files[@]}" | sed 's/,$//')",
  "npmBuild": false,
  "mavenBuild": false,
  "imageBuild": false,
  "rolloutRestart": false,
  "overlayMounted": $overlay_ok,
  "manifestConfigMapApplied": $manifest_applied,
  "manifestVisibleInPod": $manifest_seen,
  "pod": "$pod"
}
STATUS

cat "$STATUS_FILE"
