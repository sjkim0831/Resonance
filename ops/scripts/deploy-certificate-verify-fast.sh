#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BASE_REF="${CERTIFICATE_FAST_BASE_REF:-${1:-HEAD~1}}"
LOCAL_PORT="${LOCAL_PORT:-18080}"
CERTIFICATE_ID="${CERTIFICATE_ID:-}"
started_at="$(date +%s)"
DEPLOY_LOCK="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
OVERLAY_LOCK="${CARBONET_FRONTEND_OVERLAY_LOCK_FILE:-/opt/resonance-data/deploy/carbonet-frontend-overlay.lock}"

exec 9>"$DEPLOY_LOCK"
flock -w 5 9 || { echo '[certificate-fast] BLOCKED normal deployment is active' >&2; exit 75; }
exec 8>"$OVERLAY_LOCK"
flock -w 5 8 || { echo '[certificate-fast] BLOCKED frontend overlay writer is active' >&2; exit 75; }

mapfile -t changed_paths < <(git diff --name-only "$BASE_REF" --)
(( ${#changed_paths[@]} > 0 )) || { echo '[certificate-fast] FAIL no changed paths' >&2; exit 2; }

for path in "${changed_paths[@]}"; do
  case "$path" in
    projects/carbonet-frontend/source/src/features/home-entry/HomeCertificateVerifyPage.tsx|\
    projects/carbonet-frontend/source/src/features/home-entry/HomeEntrySections.tsx|\
    projects/carbonet-frontend/source/src/lib/api/emission.ts|\
    projects/carbonet-frontend/source/src/app/routes/families/appOwnedFamily.ts|\
    projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts|\
    projects/carbonet-frontend/source/src/platform/screen-registry/helpContent.ts|\
    projects/carbonet-frontend/source/scripts/verify-certificate-pdf-tamper-contract.mjs)
      ;;
    *)
      echo "[certificate-fast] BLOCKED non-frontend certificate path=$path; use guarded runtime deployment" >&2
      exit 3
      ;;
  esac
done

node projects/carbonet-frontend/source/scripts/verify-certificate-pdf-tamper-contract.mjs
LOCAL_PORT="$LOCAL_PORT" bash ops/scripts/restart-local-carbonet-frontend-fast.sh

page_tmp="$(mktemp)"
api_tmp="$(mktemp)"
trap 'rm -f "$page_tmp" "$api_tmp"' EXIT INT TERM
page_code="$(curl -sS -L --max-time 10 -o "$page_tmp" -w '%{http_code}' "http://127.0.0.1:$LOCAL_PORT/home/certificate-verify")"
[[ "$page_code" == 200 ]] || { echo "[certificate-fast] FAIL page status=$page_code" >&2; exit 1; }
grep -qi '<!doctype html' "$page_tmp" || { echo '[certificate-fast] FAIL page is not HTML' >&2; exit 1; }

if [[ -n "$CERTIFICATE_ID" ]]; then
  api_code="$(curl -sS --max-time 10 -o "$api_tmp" -w '%{http_code}' "http://127.0.0.1:$LOCAL_PORT/api/public/report-certificates/$CERTIFICATE_ID")"
  [[ "$api_code" == 200 ]] || { echo "[certificate-fast] FAIL public API status=$api_code" >&2; exit 1; }
  jq -e '.valid == true and (.certificateId | type == "string")' "$api_tmp" >/dev/null || {
    echo '[certificate-fast] FAIL public certificate identity contract' >&2
    exit 1
  }
fi

elapsed=$(( $(date +%s) - started_at ))
echo "[certificate-fast] PASS paths=${#changed_paths[@]} page=200 api=$([[ -n "$CERTIFICATE_ID" ]] && echo 200 || echo skipped) dbBackup=0 imageBuild=0 rollout=0 elapsed=${elapsed}s"
