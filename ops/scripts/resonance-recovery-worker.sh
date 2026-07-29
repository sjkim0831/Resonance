#!/usr/bin/env bash
set -euo pipefail

API_BASE="${RESONANCE_RECOVERY_API_BASE:-https://backstage.172.16.1.232.nip.io/api/resonance-recovery}"
CA_CERT="${RESONANCE_RECOVERY_CA_CERT:-/opt/resonance-data/pki/resonance-internal-ca/ca.crt}"
BACKUP_ROOT="${RESONANCE_RECOVERY_BACKUP_ROOT:-/opt/resonance-backups/postgresql/on-demand}"
WORKER_ID="${RESONANCE_RECOVERY_WORKER_ID:-$(hostname)-postgres-backup}"
WORKER_VERSION="2"
NAMESPACE="${RESONANCE_RECOVERY_NAMESPACE:-carbonet-prod}"
DATABASE="${RESONANCE_RECOVERY_DATABASE:-carbonet}"
MIN_BACKUP_BYTES="${RESONANCE_RECOVERY_MIN_BACKUP_BYTES:-1048576}"
ARCHIVE_VERIFY_IMAGE="${RESONANCE_RECOVERY_ARCHIVE_VERIFY_IMAGE:-localhost:5000/spilo-16-uid1000:3.2-p3}"
KUBECONFIG="${KUBECONFIG:-/home/sjkim/.kube/config}"
export KUBECONFIG

for command in curl jq kubectl sha256sum stat; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "[recovery-worker] missing command: $command" >&2
    exit 1
  }
done
[[ -r "$CA_CERT" ]] || {
  echo "[recovery-worker] CA certificate is not readable" >&2
  exit 1
}
mkdir -p "$BACKUP_ROOT"
resolved_root="$(readlink -f "$BACKUP_ROOT")"
case "$resolved_root" in
  /opt/resonance-backups/postgresql/on-demand) ;;
  *) echo "[recovery-worker] unsafe backup root" >&2; exit 2 ;;
esac

token="$(kubectl -n resonance-ops get secret resonance-ops-bridge \
  -o jsonpath='{.data.RESONANCE_RECOVERY_WORKER_TOKEN}' | base64 -d)"
[[ "${#token}" -ge 32 ]] || {
  echo "[recovery-worker] service token is unavailable" >&2
  exit 1
}

api() {
  curl --silent --show-error --fail --cacert "$CA_CERT" \
    -H "authorization: Bearer $token" \
    -H 'content-type: application/json' "$@"
}

claim_file="$(mktemp)"
cleanup() { rm -f -- "$claim_file"; }
trap cleanup EXIT
status="$(curl --silent --show-error --cacert "$CA_CERT" \
  -o "$claim_file" -w '%{http_code}' \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d "$(jq -nc --arg workerId "$WORKER_ID" --arg workerVersion "$WORKER_VERSION" '{workerId:$workerId,workerVersion:$workerVersion}')" \
  "$API_BASE/worker/claim")"
[[ "$status" == "204" ]] && exit 0
[[ "$status" == "200" ]] || {
  echo "[recovery-worker] claim failed: HTTP $status" >&2
  exit 1
}

command_id="$(jq -r '.commandId' "$claim_file")"
command_type="$(jq -r '.commandType' "$claim_file")"
lease_token="$(jq -r '.leaseToken' "$claim_file")"
[[ "$command_id" =~ ^[0-9a-f-]{36}$ && "$lease_token" =~ ^[0-9a-f-]{36}$ ]] || {
  echo "[recovery-worker] invalid claim payload" >&2
  exit 1
}

find_leader() {
  local pod
  while IFS= read -r pod; do
    if [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
      printf '%s\n' "$pod"
      return 0
    fi
  done < <(kubectl -n "$NAMESPACE" get pods \
    -l app=postgres-patroni -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')
  return 1
}

ARCHIVE_VERIFICATION_MODE=""
verify_archive() {
  local archive="$1" leader
  [[ -f "$archive" ]] || return 1
  case "$(readlink -f "$archive")" in
    "$resolved_root"/*) ;;
    *) echo "[recovery-worker] archive is outside the safe backup root" >&2; return 2 ;;
  esac

  if command -v pg_restore >/dev/null 2>&1; then
    pg_restore -l "$archive" >/dev/null
    ARCHIVE_VERIFICATION_MODE="host-pg-restore"
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    if ! docker image inspect "$ARCHIVE_VERIFY_IMAGE" >/dev/null 2>&1; then
      docker pull "$ARCHIVE_VERIFY_IMAGE" >/dev/null
    fi
    docker run --rm --network none \
      --entrypoint pg_restore \
      -v "$resolved_root:/backup:ro" \
      "$ARCHIVE_VERIFY_IMAGE" \
      -l "/backup/$(basename "$archive")" >/dev/null
    ARCHIVE_VERIFICATION_MODE="local-container-pg-restore"
    return 0
  fi

  leader="$(find_leader)" || return 1
  kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- \
    pg_restore -l <"$archive" >/dev/null
  ARCHIVE_VERIFICATION_MODE="kubernetes-stream-pg-restore"
}

complete() {
  local success="$1" message="$2" result_json="$3"
  api -d "$(jq -nc \
    --arg leaseToken "$lease_token" \
    --arg workerId "$WORKER_ID" \
    --arg message "$message" \
    --argjson success "$success" \
    --argjson result "$result_json" \
    '{leaseToken:$leaseToken,workerId:$workerId,success:$success,message:$message,result:$result}')" \
    "$API_BASE/worker/commands/$command_id/complete" >/dev/null
}

run_backup() {
  local leader timestamp partial final bytes checksum manifest
  leader="$(find_leader)" || return 1
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  partial="$resolved_root/.carbonet-${timestamp}-${command_id}.dump.partial"
  final="$resolved_root/carbonet-${timestamp}-${command_id}.dump"
  manifest="$final.json"
  trap 'rm -f -- "$partial"' RETURN
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    pg_dump -h 127.0.0.1 -U postgres -d "$DATABASE" -Fc >"$partial"
  bytes="$(stat -c %s "$partial")"
  [[ "$bytes" -ge "$MIN_BACKUP_BYTES" ]]
  verify_archive "$partial"
  checksum="$(sha256sum "$partial" | awk '{print $1}')"
  mv -- "$partial" "$final"
  jq -n \
    --arg file "$(basename "$final")" \
    --arg sha256 "$checksum" \
    --arg createdAt "$(date -u +%FT%TZ)" \
    --argjson bytes "$bytes" \
    --arg verificationMode "$ARCHIVE_VERIFICATION_MODE" \
    '{file:$file,sha256:$sha256,bytes:$bytes,createdAt:$createdAt,verified:true,verificationMode:$verificationMode}' \
    >"$manifest"
  complete true "backup created and verified" \
    "$(jq -nc --arg file "$(basename "$final")" --arg sha256 "$checksum" --arg verificationMode "$ARCHIVE_VERIFICATION_MODE" --argjson bytes "$bytes" '{file:$file,sha256:$sha256,bytes:$bytes,verified:true,verificationMode:$verificationMode}')"
}

run_verify() {
  local latest manifest expected actual bytes
  latest="$(find "$resolved_root" -maxdepth 1 -type f -name 'carbonet-*.dump' -printf '%T@ %p\n' \
    | sort -nr | head -1 | cut -d' ' -f2-)"
  [[ -n "$latest" && -f "$latest" ]]
  manifest="$latest.json"
  [[ -f "$manifest" ]]
  expected="$(jq -r '.sha256' "$manifest")"
  actual="$(sha256sum "$latest" | awk '{print $1}')"
  [[ "$expected" == "$actual" ]]
  verify_archive "$latest"
  bytes="$(stat -c %s "$latest")"
  complete true "backup checksum and archive verified" \
    "$(jq -nc --arg file "$(basename "$latest")" --arg sha256 "$actual" --arg verificationMode "$ARCHIVE_VERIFICATION_MODE" --argjson bytes "$bytes" '{file:$file,sha256:$sha256,bytes:$bytes,verified:true,verificationMode:$verificationMode}')"
}

set +e
case "$command_type" in
  CREATE_BACKUP) run_backup; result=$? ;;
  VERIFY_BACKUP) run_verify; result=$? ;;
  *) result=64 ;;
esac
set -e
if [[ "$result" -ne 0 ]]; then
  complete false "worker command failed with exit code $result" \
    "$(jq -nc --argjson exitCode "$result" '{exitCode:$exitCode}')"
  exit "$result"
fi
