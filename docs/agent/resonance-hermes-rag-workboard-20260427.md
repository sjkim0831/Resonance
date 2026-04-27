# Resonance Hermes/RAG Workboard - 2026-04-27

## Board state

체스판 기준으로 지금은 캐슬링을 끝낸 상태다. 왕은 안전해졌고, 이제 중앙 파일을 열기 전에 각 말의 역할을 고정해야 한다.

- Project folder move: complete
- Project split: complete, hardening remains
- Build version control: active through manifests and version-control data
- Theme management: usable at route-family level, central registry hardening remains
- Kubernetes: Docker Desktop kind cluster created and reachable from WSL
- Operations console: running in `resonance-ops`
- Carbonet runtime: running in `carbonet-prod`
- AI 3B deterministic: route map and model matrix active
- Hermes/RAG: context pack and playbook created

## Verified cluster position

- Current context: `docker-desktop`
- Cluster type: Docker Desktop managed kind
- Nodes: 8 Ready
- Kubernetes version: `v1.34.3`
- Namespaces:
  - `resonance-ops`
  - `carbonet-prod`
- Project deployments: not deployed yet
- Operations deployment: `operations-console` is running in `resonance-ops`
- Runtime deployment: `carbonet-runtime` is running in `carbonet-prod`
- ConfigMap: `carbonet-runtime-config` applied in `carbonet-prod`
- Images:
  - `registry.local/operations-console:2026.04.26` built and image-check passed
  - `registry.local/operations-console:2026.04.27-opsfix8` rolled out successfully
- `registry.local/carbonet-runtime:2026.04.26` built and image-check passed
  - `registry.local/carbonet-runtime:2026.04.26` rolled out successfully

## Selected files for this wave

- `data/ai-runtime/hermes-rag-context-pack.json`
  - Bounded opening book for Hermes, RAG, cluster status, model status, and next safe moves.
- `docs/agent/hermes-rag-agent-playbook.md`
  - Operating rules for Hermes as orchestrator, deterministic workers, 3B classifier, and bounded patch agents.
- `data/ai-runtime/deterministic-route-map.json`
  - Added a deterministic route for `hermes`, `rag`, `context pack`, and bounded orchestration requests.

## Active objectives

### 1. Project split hardening

Goal:

- Keep Carbonet project code thin.
- Keep common framework code reusable.
- Keep builder logic out of project business rules.

Safe next move:

- Review `docs/resonance-carbonet-boundary-matrix.md`, `projects/pom.xml`, `modules/pom.xml`, and package sets before editing code.

Do not move:

- Do not promote project-specific business logic into common or theme files.

### 2. Build version management

Goal:

- Make package registry, compatibility matrix, and release manifests the source of truth.

Safe next move:

- Align active k8s image tags with `data/version-control` and `manifests/resonance-k8s-release-manifest.example.yaml`.

Do not move:

- Do not infer runtime compatibility from filenames alone.

### 3. Theme management

Goal:

- Preserve current route-family theme bindings while adding a central registry.

Safe next move:

- Add or strengthen a theme registry manifest before allowing AI-generated theme edits.

Do not move:

- Do not put project business decisions into theme tokens.

### 4. Docker Desktop Kubernetes

Goal:

- Use the existing Docker Desktop cluster instead of recreating it.

Safe next move:

- Build/load images and create ConfigMap/Secret manifests, then run server-side dry-run before apply.

Do not move:

- Do not click create cluster again or run destructive delete/recreate unless we intentionally reset the board.

### 5. AI 3B deterministic

Goal:

- Make small models useful by giving them a bounded board.

Safe next move:

- Use `gemma3:4b` for classify/route/safety summaries and `gemma-4-e2b-it` for bounded planning.

Do not move:

- Do not let any model expand the read budget or start with a whole-repo scan.

### 6. Hermes agent hardening with RAG

Goal:

- Hermes coordinates objectives, context packs, deterministic scripts, and verification reports.

Safe next move:

- Feed `data/ai-runtime/hermes-rag-context-pack.json` first for Hermes tasks.

Do not move:

- Do not let Hermes directly execute deploy, rollback, restart, k8s apply, backup, or DB migration.

## Deployment gate before first workload

Before deploying `operations-console` or `carbonet-runtime`, require:

- Namespace standard decision: keep `resonance-ops` and `carbonet-prod`.
- Image availability: local Docker/kind can resolve the image tags in manifests.
- ConfigMap and Secret manifests exist for `carbonet-runtime`.
- `kubectl apply --dry-run=server` passes.
- Rollout verification command is written before apply.

## Verification run

Commands:

```bash
jq empty data/ai-runtime/deterministic-route-map.json data/ai-runtime/hermes-rag-context-pack.json
kubectl config current-context
kubectl get nodes --no-headers | wc -l
kubectl get ns resonance-ops carbonet-prod --no-headers
```

Result:

- JSON validation: pass
- Current context: `docker-desktop`
- Ready node count: `8`
- Namespaces: `resonance-ops`, `carbonet-prod`

## Next recommended move

다음 수는 Hermes/RAG가 읽을 최신 컨텍스트 팩을 기준으로 서비스 레이어 스모크 테스트를 설계하는 것이다. `operations-console`과 `carbonet-runtime`은 둘 다 캐슬링에 성공했으므로, 이제 에이전트에게 배포 권한을 주기 전에 관측/라우팅/스모크 게이트를 고정해야 한다.

## K8s prep gate update

Commands:

```bash
bash ops/scripts/prepare-docker-desktop-k8s-gate.sh
APPLY_CONFIG=true bash ops/scripts/prepare-docker-desktop-k8s-gate.sh
docker build -f ops/docker/Dockerfile.operations-console -t registry.local/operations-console:2026.04.26 .
docker build --build-arg PROJECT_ID=carbonet -f ops/docker/Dockerfile.project-runtime -t registry.local/carbonet-runtime:2026.04.26 var/releases/P003/image-context
kubectl -n resonance-ops run image-check-ops --image=registry.local/operations-console:2026.04.26 --restart=Never --image-pull-policy=IfNotPresent --command -- sh -c echo
kubectl -n carbonet-prod run image-check-runtime --image=registry.local/carbonet-runtime:2026.04.26 --restart=Never --image-pull-policy=IfNotPresent --command -- sh -c echo
```

Result:

- Server dry-run: pass
- ConfigMap apply: pass
- Operations image check: pass
- Carbonet runtime image check: pass
- Secret apply: pending real values

## Operations rollout update

Commands:

```bash
mvn -pl apps/operations-console -am -Dmaven.test.skip=true package
docker build --no-cache -f ops/docker/Dockerfile.operations-console -t registry.local/operations-console:2026.04.27-opsfix8 .
kubectl apply -f deploy/k8s/base/operations-console.deployment.yaml
kubectl -n resonance-ops rollout status deployment/operations-console --timeout=240s
kubectl -n resonance-ops get deploy,rs,pod,svc -o wide
kubectl -n resonance-ops logs deploy/operations-console --tail=100
```

Result:

- Maven package: pass
- Docker image: `registry.local/operations-console:2026.04.27-opsfix8`
- Rollout: pass
- Deployment: `operations-console` `1/1 Running`
- Service: `operations-console` ClusterIP `10.96.10.130`, port `80/TCP`
- Startup logs: menu provisioning and dispatcher servlet initialization completed

Notes:

- K8s bootstrap required explicit operations-console beans for builder/screenbuilder adapter configuration.
- Screenbuilder runtime compare source currently returns a safe `SKIPPED` response when no project runtime compare source is configured.
- `tmux` is not installed in the runtime image; startup now tolerates this path, but interactive lane execution should be treated as a separate container-image hardening move.

## Carbonet runtime rollout update

Commands:

```bash
bash ops/scripts/prepare-docker-desktop-k8s-gate.sh
APPLY_CONFIG=true APPLY_SECRET=true APPLY_RUNTIME=true bash ops/scripts/prepare-docker-desktop-k8s-gate.sh
kubectl -n carbonet-prod get deploy,rs,pod,svc,cm,secret -o wide
kubectl -n carbonet-prod run carbonet-runtime-curl --image=curlimages/curl:8.10.1 --restart=Never --rm -i --quiet --command -- curl -fsS http://carbonet-runtime/actuator/health
```

Result:

- Server dry-run: pass
- ConfigMap apply: pass
- Secret apply: pass, generated at deploy time and not written to repo
- Rollout: pass
- Deployment: `carbonet-runtime` `2/2 Running`
- Service: `carbonet-runtime` ClusterIP `10.96.42.88`, port `80/TCP`
- Health: `{"status":"UP","groups":["liveness","readiness"]}`

Notes:

- K8s ConfigMap overrides the runtime datasource with `SPRING_DATASOURCE_URL=jdbc:cubrid:host.docker.internal:33000:carbonet:::?charset=UTF-8`.
- Secret includes both legacy `DB_*` keys and Spring Boot datasource keys for compatibility.
- Pods show early restarts during bootstrap, then settle to Ready; keep watching restart counts during the next Hermes/RAG smoke test.

## Hermes/RAG smoke update

Commands:

```bash
bash ops/scripts/run-hermes-rag-smoke.sh
```

Result:

- Opening book JSON validation: pass
- Hermes `readFirst` contract: pass
- Deterministic route for Hermes/RAG: pass
- Kubernetes context: `docker-desktop`
- `operations-console`: `1/1`
- `carbonet-runtime`: `2/2`
- Runtime health: `{"status":"UP","groups":["liveness","readiness"]}`
- Dangerous operation guard: pass
- Model gate: skipped by default; use `RUN_MODEL_GATE=true MODEL=gemma3:4b bash ops/scripts/run-hermes-rag-smoke.sh`
- Report: `var/ai-model-gates/hermes-rag-smoke-20260427-133720.md`

## Build version metadata gate

Commands:

```bash
bash ops/scripts/verify-build-version-metadata.sh
```

Result:

- Runtime status file: `data/version-control/k8s-runtime-status-20260427.json`
- Deterministic route: `build version`, `version metadata`, `release manifest`, `package registry`, `compatibility matrix`, `runtime status`, `image tag`
- Verification target: current Docker Desktop Kubernetes context and deployed image tags
- Mutation policy: read-only verification, no deploy or rollback command embedded

Notes:

- This is the version-control rook on the open file: Hermes can now compare the release manifest, version-control data, and live Kubernetes runtime without scanning the whole board.

## Theme registry gate

Commands:

```bash
bash ops/scripts/verify-theme-registry.sh
```

Result:

- Central registry: `data/theme-registry/theme-registry.json`
- Deterministic route: theme requests now read the registry and verifier before broad builder/template paths
- AI edit policy: mutation disabled by default, registry diff and preview verification required before theme writes
- Boundary rule: theme tokens remain presentation-only; project business rules stay outside theme files

Notes:

- This is the theme bishop development move: route-family theme bindings stay in place, but future AI edits must pass through the central diagonal before touching tokens or bundles.

## Project boundary gate

Commands:

```bash
bash ops/scripts/verify-project-boundary.sh
```

Result:

- Boundary contract: `data/project-boundary/resonance-carbonet-boundary-contract.json`
- Deterministic route: project split/common jar/adapter requests now read the contract and verifier first
- Maven split: `projects/pom.xml` remains thin with `carbonet-adapter` and `carbonet-runtime`
- AI edit policy: cross-zone moves require source zone, target zone, reusable/project-only decision, and verifier pass

Notes:

- This is the project split knight fork prevention move: Carbonet stays thin, reusable framework logic stays in Resonance, and uncertain moves default to Resonance first through an adapter.

## Deterministic agent policy gate

Commands:

```bash
bash ops/scripts/verify-deterministic-agent-policy.sh
```

Result:

- Agent policy: `data/ai-runtime/deterministic-agent-policy.json`
- Default local model: `gemma3:4b`
- Generic worker: verification-only, no mutation
- Dangerous operations: deploy, backup, rollback, restart, k8s apply, and DB migration remain script-only
- Restricted coder models: allowed to draft bounded patches only, not act as safety authority

Notes:

- This is the AI knight discipline move: the model may suggest candidate squares, but deterministic scripts decide whether the move is legal.

Next move:

- Use the smoke gate before Hermes delegates work.
- Keep deploy, backup, rollback, restart, k8s apply, and DB migration behind deterministic scripts.
- Open the model gate only after confirming local Ollama availability.

## Hermes task packet and model gate update

Commands:

```bash
INTENT="hermes rag bounded orchestration" bash ops/scripts/render-hermes-task-packet.sh
RUN_MODEL_GATE=true MODEL=gemma3:4b bash ops/scripts/run-hermes-rag-smoke.sh
```

Result:

- Task packet render: pass
- Packet: `var/agent-task-packets/hermes-task-packet-HERMES-20260427-134855.json`
- Selected file budget: 6 files
- Worker status: `READY_FOR_WORKER`
- Verification gate: `bash ops/scripts/run-hermes-rag-smoke.sh`
- Ollama model: `gemma3:4b`
- Route gate: pass, model returned `NEEDS_ROUTE_MAP` when no candidate files were supplied
- Safety gate: pass, model classified `db_migration`, `backup`, `restart`, `k8s`, and `deploy` as `script_only`
- Smoke report: `var/ai-model-gates/hermes-rag-smoke-20260427-134855.md`
- Ollama report: `var/ai-model-gates/ollama-gate-gemma3_4b-20260427-134858.md`

Next move:

- Hermes can now hand bounded packets to a worker.
- The worker still cannot mutate deploy, backup, rollback, restart, k8s apply, or DB migration directly; those remain script-only.
- The next useful board square is a small worker loop that consumes a packet, runs only the packet verification gate, and writes a closeout report.

## Hermes worker loop update

Commands:

```bash
bash ops/scripts/render-hermes-task-packet.sh
bash ops/scripts/run-hermes-worker-loop.sh var/agent-task-packets/hermes-task-packet-HERMES-20260427-135522.json
```

Result:

- Worker loop: pass
- Consumed packet: `var/agent-task-packets/hermes-task-packet-HERMES-20260427-135522.json`
- Closeout JSON: `var/agent-closeouts/hermes-worker-closeout-HERMES-20260427-135522-20260427-135528.json`
- Closeout Markdown: `var/agent-closeouts/hermes-worker-closeout-HERMES-20260427-135522-20260427-135528.md`
- Verification command: `bash ops/scripts/run-hermes-rag-smoke.sh`
- Verification result: pass
- Runtime impact: no mutation, verification only

Next move:

- Add a second worker mode only after we define a non-mutating patch packet schema.
- Keep generic worker loop verification-only; dangerous operation packets must continue to fail closed.

## Hermes non-mutating patch plan update

Commands:

```bash
bash ops/scripts/render-hermes-task-packet.sh
bash ops/scripts/render-hermes-patch-packet.sh var/agent-task-packets/hermes-task-packet-HERMES-20260427-140028.json
bash ops/scripts/validate-hermes-patch-packet.sh var/agent-task-packets/hermes-patch-packet-PATCH-20260427-140036.json
bash ops/scripts/run-hermes-rag-smoke.sh
```

Result:

- Patch packet schema: added
- Patch packet render: pass
- Patch packet validation: pass
- Smoke chain includes patch packet render and validation: pass
- Example patch packet: `var/agent-task-packets/hermes-patch-packet-PATCH-20260427-140036.json`
- Latest smoke patch packet: `var/agent-task-packets/hermes-patch-packet-PATCH-20260427-140050.json`
- Verified smoke patch packet after unique health pod fix: `var/agent-task-packets/hermes-patch-packet-PATCH-20260427-140147.json`
- Latest smoke report: `var/ai-model-gates/hermes-rag-smoke-20260427-140147.md`
- Mutation allowed: `false`
- Implementation allowed: `false`
- Patch content: intentionally omitted until implementation approval
- Health-check pod naming: changed to a timestamped pod name to avoid `AlreadyExists` conflicts during repeated smoke runs

Next move:

- If we need actual code edits, create a separate implementation packet type with explicit approval, exact changed files, and rollback commands.
- Until then, patch packets remain planning artifacts only.

## Hermes implementation envelope update

Commands:

```bash
bash ops/scripts/render-hermes-implementation-packet.sh var/agent-task-packets/hermes-patch-packet-PATCH-20260427-140147.json
bash ops/scripts/validate-hermes-implementation-packet.sh var/agent-task-packets/hermes-implementation-packet-IMPL-20260427-140518.json
bash ops/scripts/run-hermes-worker-loop.sh var/agent-task-packets/hermes-implementation-packet-IMPL-20260427-140518.json
bash ops/scripts/run-hermes-rag-smoke.sh
```

Result:

- Implementation packet schema: added
- Implementation packet render: pass
- Implementation packet validation: pass
- Generic worker loop refusal: pass
- Example implementation packet: `var/agent-task-packets/hermes-implementation-packet-IMPL-20260427-140518.json`
- Latest smoke implementation packet: `var/agent-task-packets/hermes-implementation-packet-IMPL-20260427-140531.json`
- Latest smoke report: `var/ai-model-gates/hermes-rag-smoke-20260427-140531.md`
- Default status: `IMPLEMENTATION_APPROVAL_REQUIRED`
- Generic worker allowed: `false`
- Dedicated implementation worker required: `true`

Next move:

- Pick one real objective lane, preferably theme registry hardening or build version metadata, and generate a lane-specific task packet.
- Do not create a dedicated implementation worker until the target lane and exact file set are selected.
