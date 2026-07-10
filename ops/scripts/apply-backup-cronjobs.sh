#!/usr/bin/env bash
set -euo pipefail
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
              pg_dump -h postgres-haproxy.carbonet-prod.svc.cluster.local -U carbonet_app -d carbonet -Fc -f "/backups/hourly/$name"
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
            hostPath: {path: /opt/Resonance/var/postgres-backups, type: DirectoryOrCreate}
          - name: mirror
            hostPath: {path: /opt/Resonance/var/postgres-backups-ha, type: DirectoryOrCreate}
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
              pg_dump -h postgres-haproxy.carbonet-prod.svc.cluster.local -U postgres -d carbonet -Fc -f "/backups/daily/$name"
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
            hostPath: {path: /opt/Resonance/var/postgres-backups, type: DirectoryOrCreate}
          - name: mirror
            hostPath: {path: /opt/Resonance/var/postgres-backups-ha, type: DirectoryOrCreate}
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
      backoffLimit: 0
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
              mkdir -p /base /mirror
              trap 'status=$?; if [ "$status" -ne 0 ]; then rm -rf "$dir"; rm -f "/base/$name" "/base/$name.sha256"; fi; exit "$status"' EXIT
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
          volumes:
          - name: base
            hostPath: {path: /opt/Resonance/var/postgres-basebackups, type: DirectoryOrCreate}
          - name: mirror
            hostPath: {path: /opt/Resonance/var/postgres-basebackups-ha, type: DirectoryOrCreate}
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
              find /wal-archive -maxdepth 1 -type f -mtime +14 -delete
              after=$(find /wal-archive -maxdepth 1 -type f | wc -l)
              echo "WAL retention complete: before=$before after=$after retention_days=14"
            securityContext: {runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, allowPrivilegeEscalation: false, capabilities: {drop: ["ALL"]}}
            volumeMounts:
            - {name: wal-archive, mountPath: /wal-archive}
          volumes:
          - name: wal-archive
            hostPath: {path: /opt/Resonance/var/postgres-patroni-wal-archive, type: DirectoryOrCreate}
YAML
