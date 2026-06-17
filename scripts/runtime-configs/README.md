# CUBRID / Runtime Saved Configurations
Saved: 2026-06-17

## What's inside

| File | Description |
|------|-------------|
| `cubrid.conf.current` | Current server params: 512M buffer, 256M log, 2M sort, 100 max clients |
| `cubrid_broker.conf.current` | Brokers: query_editor@30000, BROKER1@33000, auto-commit ON |
| `databases.txt.current` | DB location: `/var/lib/cubrid/carbonet/databases` (PVC `cubrid-pvc`, 50Gi) |
| `cm.conf.current` | CUBRID Manager config |
| `cubrid_env.txt` | CUBRID env vars in pod |
| `volume_usage.txt` | PVC mount usage |
| `statefulset-cubrid-carbonet.yaml` | Full StatefulSet definition with init container |
| `deployment-carbonet-runtime.yaml` | Webapp deployment spec |
| `service-carbonet-runtime.json` | Service spec (NodePort 80, targetPort 8080) |
| `services.yaml` | All services in carbonet-prod namespace |
| `secret-carbonet-runtime.yaml` | DB/SMTP credentials (base64) |
| `secret-ecoinvent.yaml` | ecoinvent API credentials |

## Critical connection info

| Item | Value |
|------|-------|
| DB host (internal) | `cubrid-carbonet.carbonet-prod.svc.cluster.local:33000` |
| DB host (external) | `172.16.1.232:33001` |
| DB name | `carbonet` |
| DB user | `dba` (no password) |
| DB volume path | `/var/lib/cubrid/carbonet/databases` (PVC: `cubrid-pvc`, 50Gi) |
| Webapp health | `http://172.16.1.232:80/actuator/health` |
| CUBRID version | 11.4-latest |
| data_buffer_size | 512M |
| max_clients | 100 |

## Pod init container (cleanup-cubrid-ipc)

The init container sets `databases.txt` to:
```
carbonet /var/lib/cubrid/carbonet/databases carbonet localhost /var/lib/cubrid/carbonet/databases file:/var/lib/cubrid/carbonet/databases/lob
```

This overrides the default `/tmp/cubrid_test` path. Any manual edit to `databases.txt` inside the pod is ephemeral — it gets reset on pod restart by the init container.

## PVC info

- PVC name: `cubrid-pvc`
- PV name: `cubrid-pv`
- Storage: 50Gi, RWO
- StorageClass: `local-storage`
