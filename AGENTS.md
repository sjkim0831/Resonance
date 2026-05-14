# Resonance Agent Startup Rule

When the user says `/opt/Resonance 켜줘`, `Resonance 켜줘`, or asks to start this server, use this canonical startup command first:

```bash
cd /opt/Resonance && bash ops/scripts/resonance-up.sh
```

Do not substitute old `18000` local scripts for this Kubernetes runtime. The expected external service port is `80`.

## Command Compression

For every other operational intent, open the command index first:

```bash
cd /opt/Resonance && bash ops/scripts/resonance-command-index.sh help
```

Primary aliases:

- `up`: start/recover `/opt/Resonance`
- `deploy`: build/redeploy Kubernetes runtime on port `80`
- `doctor`: Kubernetes runtime status
- `broker`: CUBRID broker check/repair
- `logs`: runtime log DB registration
- `inventory`: grouped command map

## What `resonance-up.sh` Does

- enable/start `containerd` and `kubelet` when needed and when sudo is available
- wait for the Kubernetes API
- check namespace `carbonet-prod`
- ensure CUBRID StatefulSet `cubrid-carbonet` is ready
- ensure web Deployment `carbonet-runtime` is ready with 2 replicas
- keep service `carbonet-runtime` exposed on port `80`
- verify `http://127.0.0.1/actuator/health`
- write startup/repair events to `/opt/Resonance/var/ai-runtime/resonance-up-events.jsonl`

## Failure Inspection

```bash
kubectl -n carbonet-prod get pod,svc,deploy,statefulset -o wide
kubectl -n carbonet-prod describe pod -l app=carbonet-runtime
kubectl -n carbonet-prod logs deploy/carbonet-runtime --tail=200
kubectl -n carbonet-prod logs statefulset/cubrid-carbonet --tail=200
cat /opt/Resonance/var/ai-runtime/resonance-up-events.jsonl | tail -20
```

## Documentation Compression

Open `docs/operations/resonance-doc-index.md` before reading scattered docs. Treat `docs/resonance-wave-*` files as historical migration records, not current runtime instructions.
