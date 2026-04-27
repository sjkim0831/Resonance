# Hermes RAG Agent Playbook

## Purpose

Hermes is the knight that coordinates the board, not the queen that captures everything alone.

Use Hermes as an orchestration agent over bounded RAG context packs, deterministic route maps, and script-only workers. Hermes may rank, summarize, draft, and request a verified worker action, but it must not freely scan or directly execute dangerous operations.

## Current board

- Root: `/opt/Resonance`
- Kubernetes context: `docker-desktop`
- Cluster: Docker Desktop kind cluster, 8 Ready nodes
- Namespaces: `resonance-ops`, `carbonet-prod`
- Operations workload: `operations-console` Running 1/1 in `resonance-ops`
- Project workload: `carbonet-runtime` Running 2/2 in `carbonet-prod`
- Small classifier: `gemma3:4b`
- GPU planner: `gemma-4-e2b-it`
- RAG opening book: `data/ai-runtime/hermes-rag-context-pack.json`

## Agent roles

### Hermes Orchestrator

- Receives the user intent.
- Selects the objective from the RAG context pack.
- Resolves candidate files through `data/ai-runtime/deterministic-route-map.json`.
- Produces a bounded task packet for the next worker.
- Escalates when route, boundary, or safety confidence is low.

### Deterministic Worker

- Runs scripts, validation, dry-runs, builds, and smoke checks.
- Owns k8s apply, backup, rollback, restart, and DB migration execution.
- Writes verification reports.

### 3B Classifier

- Classifies zone and intent.
- Ranks already-selected files.
- Summarizes verification failures.
- Returns `NEEDS_ROUTE_MAP` instead of scanning broadly.

### Bounded Patch Agent

- Edits only selected files.
- Must stay under the implementation cap of 6 files.
- Must include a verification command and rollback note.

## RAG contract

Every Hermes request should include:

- `objective_id`
- `zone`
- `selected_files`
- `reason_per_file`
- `verification_gate`
- `dangerous_operation`
- `rollback_note`

If any field cannot be filled deterministically, Hermes must stop with `NEEDS_ROUTE_MAP`.

## Safe opening sequence

1. Read `data/ai-runtime/hermes-rag-context-pack.json`.
2. Pick exactly one active objective.
3. Read the listed `readFirst` files only.
4. Resolve selected files and max edit budget.
5. Ask the model to plan or patch inside the selected context only.
6. Run deterministic verification.
7. Write back a report or route-map hint only after verification passes.

## Smoke gate

Before Hermes delegates work to a model or worker, run:

```bash
bash ops/scripts/run-hermes-rag-smoke.sh
```

Use `RUN_MODEL_GATE=true MODEL=gemma3:4b bash ops/scripts/run-hermes-rag-smoke.sh` only when the local Ollama registry is expected to be available.

## Task packet gate

Hermes should produce a worker packet before asking any model or worker to act:

```bash
INTENT="hermes rag bounded orchestration" bash ops/scripts/render-hermes-task-packet.sh
```

The packet is written under `var/agent-task-packets/` and must include `objective_id`, `zone`, `selected_files`, `reason_per_file`, `verification_gate`, `dangerous_operation`, and `rollback_note`.

## Worker loop

For verification-only packets, run the generic worker loop:

```bash
bash ops/scripts/run-hermes-worker-loop.sh var/agent-task-packets/<packet>.json
```

The generic worker loop may only consume `READY_FOR_WORKER` packets whose verification gate is allowlisted. It writes closeout artifacts under `var/agent-closeouts/` and refuses dangerous-operation packets.

## Patch Plan Gate

Before any patch worker is allowed to edit files, Hermes must create a non-mutating patch plan:

```bash
bash ops/scripts/render-hermes-patch-packet.sh var/agent-task-packets/<packet>.json
bash ops/scripts/validate-hermes-patch-packet.sh var/agent-task-packets/<patch-packet>.json
```

Patch plan packets must have `mutation_allowed=false`, `implementation_allowed=false`, and no patch content. They are a planning artifact only; implementation requires a later, explicitly approved packet type.

## Implementation Packet Gate

Implementation packets are approval-gated envelopes, not something the generic worker loop may execute:

```bash
bash ops/scripts/render-hermes-implementation-packet.sh var/agent-task-packets/<patch-packet>.json
bash ops/scripts/validate-hermes-implementation-packet.sh var/agent-task-packets/<implementation-packet>.json
```

By default, implementation packets stay in `IMPLEMENTATION_APPROVAL_REQUIRED`. Even with `IMPLEMENTATION_APPROVED=true`, only a future dedicated implementation worker may consume them; `run-hermes-worker-loop.sh` must refuse them.

## K8s deployment rule

For Docker Desktop Kubernetes, Hermes may prepare these moves:

- namespace check
- image existence check
- ConfigMap/Secret manifest draft
- server-side dry-run
- rollout status summary

Hermes must not directly do these moves:

- raw generated `kubectl apply`
- destructive delete
- cluster-wide mutation
- DB migration execution
- rollback without backup evidence

## Project split rule

Treat the board as four lanes:

- operations platform: deploy, k8s, backup, rollback, version control, AI runtime
- common framework: reusable jars, shared contracts, authority, mapper/web support
- Carbonet project: project pages, adapters, runtime config, package selection
- builder system: screen builder, theme registry, package composer, scaffolding

Do not move business logic from the Carbonet project into common/theme files.

## Theme rule

Theme management should stay registry-led:

- route-family theme binding is allowed
- centralized theme registry is preferred
- project business rules must not live in theme tokens
- AI-generated theme changes need a registry diff and preview verification

## Build version rule

Version decisions should come from:

- `data/version-control/project-runtime-manifest.json`
- `data/version-control/package-registry.json`
- `data/version-control/compatibility-matrix.json`
- `manifests/resonance-k8s-release-manifest.example.yaml`

Do not infer runtime versions from filenames alone.

## Closeout format

Hermes closeout must include:

- changed files
- verification command
- verification result
- cluster or runtime impact
- route-map or RAG memory update needed
