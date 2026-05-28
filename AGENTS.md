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

## Codex / Hermes Safety Guard

Before server edits, run from `/opt/Resonance` and verify the Git root. Do not treat `projects/carbonet-frontend/source` as a separate repository root.

Use `ops/scripts/codex-safe-status.sh` before broad staging commands. The pre-commit hook blocks oversized files, local vector DB / SQLite runtime state, possible secrets, and accidental mixed source + frontend artifact commits.

For `/admin/emission/survey-report`, product and byproduct rows live under `OUTPUT_PRODUCTS`; distinguish them with `group` or `sectionLabel`, not `OUTPUT_BYPRODUCTS`.

Vite bundles are minified. Do not decide whether a bundle is correct by grepping local variable names such as `isUnallocated` or `productOnlyMass`; verify behavior logic, manifest, and the runtime `react-app-overlay` path.

Commit source changes first. Commit frontend build artifacts separately only when explicitly requested. Never commit `data/ai-runtime/*.sqlite3`, `*.db`, vector indexes, runtime caches, or credentials.
