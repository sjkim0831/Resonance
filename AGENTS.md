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

## No-Build / No-Deploy Page Development Rule

All AI agents must treat page development as server-driven / metadata-driven by default.

For new pages, page edits, UI layout changes, SDUI changes, menu-screen mapping, page assets, and static files, edit only these project-owned overlay paths:

- `projects/carbonet-frontend/src/main/resources/static/react-app/**`
- `projects/carbonet-assets/static/**`
- `projects/carbonet-backend-metadata/**`
- `var/k8s/carbonet-runtime-manifest.json` only for runtime manifest changes
- `ops/runtime-metadata/**` only for runtime metadata registry changes

Do not edit these paths for ordinary page development unless the user explicitly asks for runtime/core work:

- `frontend/src/**`
- `apps/**`
- `modules/**`
- `release/**`
- `templates/**`
- `deploy/**`
- `scripts/runtime-configs/**`

The operating rule is:

1. Use `/admin/system/build-studio` as the primary SDUI control plane for all screens and assets.
2. Store screen structure and behavior as SDUI/metadata, not as new Java controllers or compiled frontend source.
3. Store page-owned assets under `projects/carbonet-assets/static/**`.
4. Store backend-driven screen metadata under `projects/carbonet-backend-metadata/**`.
5. Use `ops/scripts/resonance-no-build-apply.sh` for metadata/overlay diffs.
6. Never run `npm run build`, Maven package, Docker build, image push, or Kubernetes rollout for page-only work.
7. If a requested page change appears to require Java/core changes, first redesign it as SDUI metadata or an existing generic runtime API.
8. Only classify work as build/redeploy-required when it truly changes runtime engine behavior, security/auth, DB schema, or shared Java contracts.

Before finishing any page task, verify the served overlay path, for example:

```bash
curl -sI http://127.0.0.1:32947/assets/react/api/build-studio-asset-inventory.json
curl -sI http://127.0.0.1:32947/assets/react/assets/BuilderStudioPage-BBdbfW4J.js
```
