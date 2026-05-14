# Carbonet Runtime 80 Port HA Apply

Remote server: 172.16.1.232 / Kubernetes namespace `carbonet-prod`.

Applied state:

- `carbonet-runtime` Deployment uses two replicas.
- Rolling update keeps `maxUnavailable: 0` and `maxSurge: 1`.
- Runtime Service exposes both external node ports `80` and legacy `18080`.
- Pod shutdown waits through `preStop: sleep 10` and `terminationGracePeriodSeconds: 60`.
- Runtime Hikari pool is limited to reduce CUBRID broker pressure.
- Backups are written under `/opt/Resonance/var/backups/k8s`.
- Apply log is written to `/opt/Resonance/var/ai-runtime/k8s-runtime-80-ha-events.jsonl`.

Reapply:

```bash
bash /opt/Resonance/ops/scripts/resonance-k8s-runtime-80-ha-apply.sh
```
