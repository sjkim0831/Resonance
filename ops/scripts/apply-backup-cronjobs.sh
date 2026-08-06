#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="carbonet-prod"
HOURLY_CRONJOB="postgres-carbonet-hourly-backup"
DAILY_CRONJOB="postgres-carbonet-daily-backup"
REPLICA_DUMP_HOST="postgres-haproxy.carbonet-prod.svc.cluster.local"

read_cronjob_suspend_state() {
  local name="$1" output rc
  set +e
  output="$(kubectl -n "$NAMESPACE" get cronjob "$name" -o jsonpath='{.spec.suspend}' 2>&1)"
  rc=$?
  set -e
  if (( rc != 0 )); then
    if grep -Eqi '\(NotFound\)|not found' <<<"$output"; then
      printf '%s\n' MISSING
      return 0
    fi
    echo "Unable to read CronJob suspend state for $name: $output" >&2
    return "$rc"
  fi
  output="${output//[[:space:]]/}"
  case "$output" in
    true|false) printf '%s\n' "$output" ;;
    '') printf '%s\n' false ;;
    *) echo "Invalid CronJob suspend state for $name: $output" >&2; return 2 ;;
  esac
}

restore_cronjob_suspend_state() {
  local name="$1" state="$2"
  [[ "$state" != MISSING ]] || return 0
  kubectl -n "$NAMESPACE" patch cronjob "$name" --type=merge \
    -p "{\"spec\":{\"suspend\":$state}}" >/dev/null
}

restore_captured_suspend_states() {
  local rc=0
  [[ "${suspend_restore_pending:-false}" == "true" ]] || return 0
  restore_cronjob_suspend_state "$HOURLY_CRONJOB" "$hourly_suspend_state" || rc=$?
  restore_cronjob_suspend_state "$DAILY_CRONJOB" "$daily_suspend_state" || rc=$?
  (( rc != 0 )) || suspend_restore_pending=false
  return "$rc"
}

validate_backup_cronjob_contract() {
  local name live_command live_paths failed=0
  live_paths="$(
    kubectl -n "$NAMESPACE" get cronjob "$HOURLY_CRONJOB" \
      -o jsonpath='{.spec.jobTemplate.spec.template.spec.volumes[*].hostPath.path}' \
      2>/dev/null || true
  )"
  if [[ "$live_paths" != *"/opt/resonance-data/backups/postgres/primary"* ||
        "$live_paths" != *"/opt/resonance-data/backups/postgres/mirror"* ]]; then
    echo "Backup CronJob storage contract drift: $HOURLY_CRONJOB" >&2
    failed=1
  fi
  for name in "$HOURLY_CRONJOB" "$DAILY_CRONJOB"; do
    live_command="$(
      kubectl -n "$NAMESPACE" get cronjob "$name" \
        -o jsonpath='{.spec.jobTemplate.spec.template.spec.containers[?(@.name=="pgdump")].args[0]}' \
        2>/dev/null || true
    )"
    if [[ "$live_command" != *"pg_dump -h $REPLICA_DUMP_HOST -p 5433"* ]]; then
      echo "Backup CronJob replica-port contract drift: $name" >&2
      failed=1
    fi
  done
  (( failed == 0 ))
}

if [[ "${1:-}" == "--check" ]]; then
  [[ $# -eq 1 ]] || { echo 'Usage: apply-backup-cronjobs.sh [--check]' >&2; exit 2; }
  validate_backup_cronjob_contract
  echo '[backup-cronjobs] PASS storage paths and logical backups use replica port 5433'
  exit 0
fi
[[ $# -eq 0 ]] || { echo 'Usage: apply-backup-cronjobs.sh [--check]' >&2; exit 2; }

# A manual suspension is an operational safety decision. Client-side apply
# normally leaves fields that are absent from the manifest untouched, but the
# explicit snapshot and restore below makes that guarantee independent of
# kubectl field-manager history.
hourly_suspend_state="$(read_cronjob_suspend_state "$HOURLY_CRONJOB")"
daily_suspend_state="$(read_cronjob_suspend_state "$DAILY_CRONJOB")"
suspend_restore_pending=true
trap 'restore_captured_suspend_states' EXIT

# HostPath DirectoryOrCreate paths are created as root:root 0755. Backup Pods
# deliberately run as UID/GID 1000, so prepare every writable root before the
# CronJobs are applied. This makes redeployments self-healing after a directory
# is recreated or a new node is provisioned.
prepare_backup_directory() {
  local expected="$1" resolved
  resolved="$(readlink -m -- "$expected")"
  case "$resolved" in
    /opt/resonance-data/backups/postgres/primary|\
    /opt/resonance-data/backups/postgres/mirror|\
    /opt/resonance-data/backups/postgres/base|\
    /opt/resonance-data/backups/postgres/base-mirror|\
    /opt/resonance-data/postgresql/wal-archive) ;;
    *) echo "Refusing unexpected backup path: $resolved" >&2; return 2 ;;
  esac
  if [[ "$(id -u)" -eq 0 ]]; then
    install -d -o 1000 -g 1000 -m 2770 -- "$resolved"
  else
    sudo -n install -d -o 1000 -g 1000 -m 2770 -- "$resolved"
  fi
}

for backup_directory in \
  /opt/resonance-data/backups/postgres/primary \
  /opt/resonance-data/backups/postgres/mirror \
  /opt/resonance-data/backups/postgres/base \
  /opt/resonance-data/backups/postgres/base-mirror \
  /opt/resonance-data/postgresql/wal-archive; do
  prepare_backup_directory "$backup_directory"
done

kubectl apply -f - <<'YAML'
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-carbonet-hourly-backup
  namespace: carbonet-prod
spec:
  schedule: "7 * * * *"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 200
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 10
  jobTemplate:
    spec:
      activeDeadlineSeconds: 900
      backoffLimit: 2
      template:
        metadata:
          labels: {app: postgres-backup, type: hourly}
        spec:
          restartPolicy: OnFailure
          securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000}
          containers:
          - name: pgdump
            image: postgres:16
            command: ["sh", "-lc"]
            args:
            - |
              set -eu
              ts=$(date +%Y%m%d_%H%M%S)
              name=carbonet_${ts}.dump
              mkdir -p /backups/hourly /mirror/hourly
              trap 'status=$?; if [ "$status" -ne 0 ]; then rm -f "/backups/hourly/$name" "/backups/hourly/$name.manifest" "/backups/hourly/$name.sha256"; fi; exit "$status"' EXIT
              # Logical backups are read-only and must not compete with the
              # transactional leader. HAProxy 5433 selects a healthy Patroni
              # replica; timeouts bound the impact if a replica is unhealthy.
              PGCONNECT_TIMEOUT=10 PGOPTIONS='-c statement_timeout=840000 -c lock_timeout=10000 -c work_mem=16MB' \
                pg_dump -h postgres-haproxy.carbonet-prod.svc.cluster.local -p 5433 \
                  -U carbonet_app -d carbonet -Fc -f "/backups/hourly/$name"
              pg_restore -l "/backups/hourly/$name" > "/backups/hourly/$name.manifest"
              (cd /backups/hourly && sha256sum "$name" > "$name.sha256")
              cp "/backups/hourly/$name" "/mirror/hourly/$name"
              cp "/backups/hourly/$name.manifest" "/mirror/hourly/$name.manifest"
              cp "/backups/hourly/$name.sha256" "/mirror/hourly/$name.sha256"
              (cd /mirror/hourly && sha256sum -c "$name.sha256")
              find /backups/hourly /mirror/hourly -type f -name 'carbonet_*' -mtime +3 -delete
            env:
            - name: PGPASSWORD
              valueFrom: {secretKeyRef: {name: postgres-haproxy-secrets, key: password}}
            resources:
              requests: {cpu: 250m, memory: 256Mi}
              limits: {cpu: "1", memory: 1Gi}
            securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, allowPrivilegeEscalation: false, capabilities: {drop: ["ALL"]}}
            volumeMounts:
            - {name: backups, mountPath: /backups}
            - {name: mirror, mountPath: /mirror}
          volumes:
          - name: backups
            hostPath: {path: /opt/resonance-data/backups/postgres/primary, type: DirectoryOrCreate}
          - name: mirror
            hostPath: {path: /opt/resonance-data/backups/postgres/mirror, type: DirectoryOrCreate}
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-carbonet-daily-backup
  namespace: carbonet-prod
spec:
  schedule: "17 3 * * *"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 600
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 10
  jobTemplate:
    spec:
      activeDeadlineSeconds: 1200
      backoffLimit: 2
      template:
        metadata:
          labels: {app: postgres-backup, type: daily}
        spec:
          restartPolicy: OnFailure
          securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000}
          containers:
          - name: pgdump
            image: postgres:16
            command: ["sh", "-lc"]
            args:
            - |
              set -eu
              ts=$(date +%Y%m%d_%H%M%S)
              name=carbonet_${ts}.dump
              mkdir -p /backups/daily /mirror/daily
              trap 'status=$?; if [ "$status" -ne 0 ]; then rm -f "/backups/daily/$name" "/backups/daily/$name.manifest" "/backups/daily/$name.sha256"; fi; exit "$status"' EXIT
              PGCONNECT_TIMEOUT=10 PGOPTIONS='-c statement_timeout=1140000 -c lock_timeout=10000 -c work_mem=16MB' \
                pg_dump -h postgres-haproxy.carbonet-prod.svc.cluster.local -p 5433 \
                  -U postgres -d carbonet -Fc -f "/backups/daily/$name"
              pg_restore -l "/backups/daily/$name" > "/backups/daily/$name.manifest"
              (cd /backups/daily && sha256sum "$name" > "$name.sha256")
              cp "/backups/daily/$name" "/mirror/daily/$name"
              cp "/backups/daily/$name.manifest" "/mirror/daily/$name.manifest"
              cp "/backups/daily/$name.sha256" "/mirror/daily/$name.sha256"
              (cd /mirror/daily && sha256sum -c "$name.sha256")
              find /backups/daily /mirror/daily -type f -name 'carbonet_*' -mtime +30 -delete
            env:
            - name: PGPASSWORD
              valueFrom: {secretKeyRef: {name: postgres-haproxy-secrets, key: postgres-password}}
            resources:
              requests: {cpu: 250m, memory: 256Mi}
              limits: {cpu: "1", memory: 1Gi}
            securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, allowPrivilegeEscalation: false, capabilities: {drop: ["ALL"]}}
            volumeMounts:
            - {name: backups, mountPath: /backups}
            - {name: mirror, mountPath: /mirror}
          volumes:
          - name: backups
            hostPath: {path: /opt/resonance-data/backups/postgres/primary, type: DirectoryOrCreate}
          - name: mirror
            hostPath: {path: /opt/resonance-data/backups/postgres/mirror, type: DirectoryOrCreate}
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-carbonet-basebackup
  namespace: carbonet-prod
spec:
  schedule: "27 2 * * *"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 600
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 10
  jobTemplate:
    spec:
      activeDeadlineSeconds: 1800
      backoffLimit: 1
      template:
        metadata:
          labels: {app: postgres-backup, type: basebackup}
        spec:
          restartPolicy: OnFailure
          securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000}
          containers:
          - name: pgbasebackup
            image: postgres:16
            terminationMessagePolicy: FallbackToLogsOnError
            securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, allowPrivilegeEscalation: false}
            command: ["sh", "-lc"]
            args:
            - |
              set -eu
              exec > /base/basebackup-last.log 2>&1
              ts=$(date +%Y%m%d_%H%M%S)
              dir=/base/carbonet_base_${ts}
              name=carbonet_base_${ts}.tar.gz
              failure=/base/basebackup-last.failure
              success=/base/basebackup-last.success
              mkdir -p /base /mirror
              finish() {
                status=$?
                if [ "$status" -ne 0 ]; then
                  rm -rf "$dir"
                  rm -f "/base/$name" "/base/$name.sha256" "/mirror/$name" "/mirror/$name.sha256"
                  printf 'status=FAILED timestamp=%s archive=%s exit_code=%s\n' "$(date -Iseconds)" "$name" "$status" \
                    | tee "$failure" > /dev/termination-log
                else
                  rm -f "$failure"
                  printf 'status=VERIFIED timestamp=%s archive=%s checksum=%s\n' \
                    "$(date -Iseconds)" "$name" "$(awk '{print $1}' "/base/$name.sha256")" > "$success"
                fi
                exit "$status"
              }
              trap finish EXIT
              set +e
              pg_basebackup -v -h postgres-haproxy.carbonet-prod.svc.cluster.local -U postgres -D "$dir" -Fp -Xs -P
              base_rc=$?
              set -e
              echo "pg_basebackup exit_code=$base_rc"
              test "$base_rc" -eq 0
              set +e
              /usr/lib/postgresql/16/bin/pg_verifybackup "$dir"
              verify_rc=$?
              set -e
              echo "pg_verifybackup exit_code=$verify_rc"
              test "$verify_rc" -eq 0
              tar -C /base -czf "/base/$name" "carbonet_base_${ts}"
              (cd /base && sha256sum "$name" > "$name.sha256")
              cp "/base/$name" "/mirror/$name"
              cp "/base/$name.sha256" "/mirror/$name.sha256"
              (cd /mirror && sha256sum -c "$name.sha256")
              start_lsn=$(sed -n 's/.*write-ahead log start point: \([^ ]*\).*/\1/p' /base/basebackup-last.log | tail -1)
              test -n "$start_lsn"
              retain_from=$(psql -h postgres-haproxy.carbonet-prod.svc.cluster.local -U postgres -d postgres -Atqc \
                "select pg_walfile_name('$start_lsn'::pg_lsn)")
              case "$retain_from" in
                [0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]) ;;
                *) echo "invalid WAL retention marker: $retain_from" >&2; exit 4 ;;
              esac
              printf '%s\n' "$retain_from" > /wal-archive/.retain-from.tmp
              mv /wal-archive/.retain-from.tmp /wal-archive/.retain-from
              rm -rf "$dir"
              find /base /mirror -maxdepth 1 -type f -name 'carbonet_base_*' -mtime +14 -delete
            env:
            - name: PGPASSWORD
              valueFrom: {secretKeyRef: {name: postgres-haproxy-secrets, key: postgres-password}}
            resources:
              requests: {cpu: 500m, memory: 512Mi}
              limits: {cpu: "2", memory: 4Gi}
            securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, allowPrivilegeEscalation: false, capabilities: {drop: ["ALL"]}}
            volumeMounts:
            - {name: base, mountPath: /base}
            - {name: mirror, mountPath: /mirror}
            - {name: wal-archive, mountPath: /wal-archive}
          volumes:
          - name: base
            hostPath: {path: /opt/resonance-data/backups/postgres/base, type: DirectoryOrCreate}
          - name: mirror
            hostPath: {path: /opt/resonance-data/backups/postgres/base-mirror, type: DirectoryOrCreate}
          - name: wal-archive
            hostPath: {path: /opt/resonance-data/postgresql/wal-archive, type: Directory}
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-carbonet-wal-retention
  namespace: carbonet-prod
spec:
  schedule: "10 4 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 1
      template:
        spec:
          restartPolicy: OnFailure
          securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000}
          containers:
          - name: wal-retention
            image: busybox:1.36
            command: ["sh", "-lc"]
            args:
            - |
              set -eu
              before=$(find /wal-archive -maxdepth 1 -type f | wc -l)
              marker=/wal-archive/.retain-from
              if [ -s "$marker" ]; then
                retain_from=$(cat "$marker")
                case "$retain_from" in
                  [0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]) ;;
                  *) echo "invalid WAL retention marker: $retain_from" >&2; exit 4 ;;
                esac
                find /wal-archive -maxdepth 1 -type f ! -name '*.history' ! -name '.*' \
                  | sed 's#.*/##' \
                  | awk -v keep="$retain_from" '$0 < keep' \
                  | while IFS= read -r wal; do rm -f -- "/wal-archive/$wal"; done
                policy="verified_basebackup marker=$retain_from"
              else
                # Safe fallback before the first verified base-backup marker.
                find /wal-archive -maxdepth 1 -type f -mtime +14 \
                  ! -name '*.history' ! -name '.*' -delete
                policy="age_fallback retention_days=14"
              fi
              after=$(find /wal-archive -maxdepth 1 -type f | wc -l)
              echo "WAL retention complete: before=$before after=$after policy=$policy"
            securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, allowPrivilegeEscalation: false, capabilities: {drop: ["ALL"]}}
            volumeMounts:
            - {name: wal-archive, mountPath: /wal-archive}
          volumes:
          - name: wal-archive
            hostPath: {path: /opt/resonance-data/postgresql/wal-archive, type: Directory}
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-carbonet-backup-retention
  namespace: carbonet-prod
spec:
  schedule: "37 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 1
      template:
        spec:
          restartPolicy: OnFailure
          securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000}
          containers:
          - name: backup-retention
            image: busybox:1.36
            command: ["sh", "-lc"]
            args:
            - |
              set -eu
              used=$(df -P /primary | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
              hourly_minutes=1440
              [ "$used" -gt 75 ] && hourly_minutes=360
              before=$(du -sk /primary /mirror | awk '{sum+=$1} END {print sum}')
              for root in /primary /mirror; do
                [ -d "$root/hourly" ] && find "$root/hourly" -maxdepth 1 -type f -mmin "+$hourly_minutes" -delete
                [ -d "$root/daily" ] && find "$root/daily" -maxdepth 1 -type f -mtime +7 -delete
              done
              after=$(du -sk /primary /mirror | awk '{sum+=$1} END {print sum}')
              echo "backup retention complete: disk=${used}% hourly_minutes=$hourly_minutes before_kib=$before after_kib=$after"
            securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, allowPrivilegeEscalation: false, capabilities: {drop: ["ALL"]}}
            volumeMounts:
            - {name: primary, mountPath: /primary}
            - {name: mirror, mountPath: /mirror}
          volumes:
          - name: primary
            hostPath: {path: /opt/resonance-data/backups/postgres/primary, type: Directory}
          - name: mirror
            hostPath: {path: /opt/resonance-data/backups/postgres/mirror, type: Directory}
YAML

restore_captured_suspend_states
trap - EXIT

retention_path="$(
  kubectl -n "$NAMESPACE" get cronjob postgres-carbonet-wal-retention \
    -o jsonpath='{.spec.jobTemplate.spec.template.spec.volumes[?(@.name=="wal-archive")].hostPath.path}'
)"
[[ "$retention_path" == /opt/resonance-data/postgresql/wal-archive ]] || {
  echo "WAL retention is not connected to the active Patroni archive: $retention_path" >&2
  exit 3
}

validate_backup_cronjob_contract
