#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/ops/scripts/apply-backup-cronjobs.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
MOCK_BIN="$TMP_DIR/bin"
MOCK_LOG="$TMP_DIR/kubectl.log"
mkdir -p "$MOCK_BIN"

cat >"$MOCK_BIN/install" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
cat >"$MOCK_BIN/sudo" <<'MOCK'
#!/usr/bin/env bash
[[ "${1:-}" == "-n" ]] && shift
exec "$@"
MOCK
cat >"$MOCK_BIN/kubectl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$MOCK_LOG"
name=""
for arg in "$@"; do
  case "$arg" in
    postgres-carbonet-*) name="$arg" ;;
  esac
done
if [[ " $* " == *" apply -f - "* ]]; then
  cat >/dev/null
  [[ "${MOCK_APPLY_FAILURE:-false}" != "true" ]] || exit 1
  exit 0
fi
if [[ "$*" == *" patch cronjob "* ]]; then
  exit 0
fi
if [[ "$*" == *" get cronjob "* ]]; then
  if [[ "$name" == "postgres-carbonet-hourly-backup" && "$*" == *".spec.suspend"* ]]; then
    [[ "${MOCK_CAPTURE_FAILURE:-false}" != "true" ]] || { echo 'transport unavailable' >&2; exit 1; }
    printf '%s' true
    exit 0
  fi
  if [[ "$name" == "postgres-carbonet-daily-backup" && "$*" == *".spec.suspend"* ]]; then
    printf '%s' false
    exit 0
  fi
  if [[ "$name" == "postgres-carbonet-hourly-backup" && "$*" == *"volumes[*].hostPath.path"* ]]; then
    printf '%s' '/opt/resonance-data/backups/postgres/primary /opt/resonance-data/backups/postgres/mirror'
    exit 0
  fi
  if [[ "$name" == "postgres-carbonet-wal-retention" ]]; then
    printf '%s' '/opt/resonance-data/postgresql/wal-archive'
    exit 0
  fi
  if [[ "$name" == "postgres-carbonet-hourly-backup" || "$name" == "postgres-carbonet-daily-backup" ]]; then
    if [[ "${MOCK_REPLICA_DRIFT:-false}" == "true" && "$name" == "postgres-carbonet-daily-backup" ]]; then
      printf '%s' 'pg_dump -h postgres-haproxy.carbonet-prod.svc.cluster.local -p 5432'
    else
      printf '%s' 'pg_dump -h postgres-haproxy.carbonet-prod.svc.cluster.local -p 5433'
    fi
    exit 0
  fi
fi
echo "unsupported mock kubectl call: $*" >&2
exit 2
MOCK
chmod +x "$MOCK_BIN/install" "$MOCK_BIN/sudo" "$MOCK_BIN/kubectl"

export PATH="$MOCK_BIN:$PATH" MOCK_LOG
: >"$MOCK_LOG"
bash "$SCRIPT"
grep -Fq 'patch cronjob postgres-carbonet-hourly-backup --type=merge -p {"spec":{"suspend":true}}' "$MOCK_LOG"
grep -Fq 'patch cronjob postgres-carbonet-daily-backup --type=merge -p {"spec":{"suspend":false}}' "$MOCK_LOG"
[[ "$(grep -c '^apply -f -$' "$MOCK_LOG")" -eq 1 ]]

: >"$MOCK_LOG"
if MOCK_APPLY_FAILURE=true bash "$SCRIPT" >/dev/null 2>&1; then
  echo '[backup-cronjobs-suspend-test] FAIL: mocked apply failure was accepted' >&2
  exit 1
fi
grep -Fq 'patch cronjob postgres-carbonet-hourly-backup --type=merge -p {"spec":{"suspend":true}}' "$MOCK_LOG"
grep -Fq 'patch cronjob postgres-carbonet-daily-backup --type=merge -p {"spec":{"suspend":false}}' "$MOCK_LOG"

: >"$MOCK_LOG"
bash "$SCRIPT" --check
if MOCK_REPLICA_DRIFT=true bash "$SCRIPT" --check >/dev/null 2>&1; then
  echo '[backup-cronjobs-suspend-test] FAIL: replica-port drift was accepted' >&2
  exit 1
fi

: >"$MOCK_LOG"
if MOCK_CAPTURE_FAILURE=true bash "$SCRIPT" >/dev/null 2>&1; then
  echo '[backup-cronjobs-suspend-test] FAIL: unreadable suspend state did not fail closed' >&2
  exit 1
fi
! grep -Fq 'apply -f -' "$MOCK_LOG"

echo '[backup-cronjobs-suspend-test] PASS: suspend survives success/failure, drift fails check, capture failure is fail-closed'
