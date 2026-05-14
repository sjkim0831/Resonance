# Carbonet Kubernetes Maximum Local Automation

Target server: `172.16.1.232`

Installed automation layers:

- frontend auto build: detects React source changes and rebuilds the filesystem overlay
- backend auto redeploy: detects backend/runtime changes, builds image, imports it into containerd, and rolls out through Kubernetes
- runtime high availability: keeps `carbonet-runtime` at two replicas with `maxUnavailable: 0`
- public entrypoint: keeps node port `80` active and preserves legacy `18080`
- CUBRID broker doctor: watches CAS `CLOSE_WAIT` count and restarts broker when it crosses the threshold
- housekeeper: prunes old Docker/build/cache artifacts, old logs, and failed/succeeded pods
- evidence logs: writes JSONL events under `var/ai-runtime`

Manual deploy:

```bash
sudo /opt/Resonance/ops/scripts/resonance-k8s-build-deploy-80.sh
```

Manual doctor:

```bash
sudo /opt/Resonance/ops/scripts/resonance-k8s-ops-doctor.sh
```

Manual housekeeper:

```bash
sudo /opt/Resonance/ops/scripts/resonance-k8s-housekeeper.sh
```

The local model/AI layer should read these JSONL logs and propose improvements.
It should not directly delete images, restart brokers, or roll deployments until
the deterministic scripts above have proven the action is safe.
