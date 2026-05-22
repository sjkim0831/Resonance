# Codex55-Grade Agent Architecture For Resonance

Date: 2026-05-18 KST
Root: `/opt/Resonance`

## Goal

Move the local Hermes/Qwen40 workflow toward a Codex 5.5-grade operating pattern:

1. preserve the user's persistent `/goal`
2. infer the immediate request from system state and previous work
3. decompose work into bounded stages
4. execute only through Codex or deterministic scripts
5. verify with runtime evidence
6. write the result and the next recommended action back to Hermes memory

This is an execution-intelligence layer, not a promise that the local 40B model equals Codex 5.5.

## Current Concrete Stack

| Layer | Current tool | Role |
| --- | --- | --- |
| Gateway | Hermes CLI, ops web `:17890`, scripts | Accepts human requests and button-triggered operations |
| Orchestrator | `resonance-codex55-grade-plan.sh` | Builds context packs and Qwen40 execution plans |
| Persistent goal | `resonance-goal.sh`, `current-goal.json`, `hermes_task` | Keeps the active operating objective visible across sessions |
| Main planner | Qwen3.6 40B OpenAI-compatible endpoint | Interprets work and produces ordered steps |
| Executor | Codex, K8s deploy scripts, DB scripts | Performs file edits, deployment, verification, rollback |
| Memory | CUBRID `hermes_*` tables, JSON evidence files | Stores requests, context packs, plans, steps, runtime snapshots |
| Runtime | Kubernetes, CUBRID, Nginx, Spring Boot | Runs Carbonet service on 80 and 32947 |
| Observability | Hermes workflow dashboard, K8s logs, CUBRID rows | Shows what happened and what should happen next |

## Target Open Source Components

These are the preferred open-source components when the current scripts need to grow into a larger agent runtime.

| Capability | Preferred component | Why |
| --- | --- | --- |
| Stateful orchestration | LangGraph | Durable graph execution, checkpoints, interrupts, multi-agent subgraphs |
| Tool protocol | Model Context Protocol | Standard tool/resource/prompt exposure for models |
| Browser verification | Playwright MCP/CLI | Structured browser automation and trace artifacts |
| Semantic memory | Qdrant | Vector collections with metadata payload filtering |
| Short-lived state | Redis | Fast locks, leases, session state, rate limits |
| Workflow DB | PostgreSQL or current CUBRID | Durable task, plan, and verification records |
| LLM observability | Langfuse | LLM traces, sessions, prompt versions, evaluations |
| System telemetry | OpenTelemetry | Vendor-neutral traces, metrics, and logs |
| Metrics | Prometheus/Grafana | Kubernetes and service-level dashboards |
| Larger model serving | vLLM | Higher-throughput GPU model serving when hardware is available |
| Local quantized model serving | llama.cpp | Current low-dependency local model endpoint |

Do not add these all at once. Add them only when the current CUBRID/script control plane has a proven gap.

## Execution Loop

```text
User/Hermes/Ops button
  -> gateway records request
  -> /goal is loaded
  -> context pack is built
  -> Qwen40 plans bounded stages
  -> Codex or deterministic script executes
  -> runtime/DB/log verification runs
  -> Hermes memory stores result, failure pattern, and next action
  -> future requests reuse that evidence
```

## Stage Contract

Every non-trivial request must produce these fields before execution:

1. user intent
2. inferred missing details
3. affected surfaces
4. ordered steps
5. risk gates
6. verification plan
7. small-model support only when bounded
8. next recommended action

## Safety Rules

- The model may plan, classify, summarize, and recommend.
- The model must not be the source of truth for DB migration success, Kubernetes rollout success, or web runtime health.
- Code changes, DB changes, and deployments must be executed by Codex or deterministic scripts.
- A task that affects the running service is incomplete until HTTP health, pod readiness, or route proof is recorded.
- Small models may support log classification and duplicate detection, but cannot auto-edit production code without review.

## Commands

Turn on the persistent operating goal:

```bash
bash ops/scripts/resonance-goal.sh on
```

Set a custom goal:

```bash
bash ops/scripts/resonance-goal.sh set "목표 문장"
```

Check the goal:

```bash
bash ops/scripts/resonance-goal.sh status
```

Create a Codex55-grade execution plan:

```bash
bash ops/scripts/resonance-codex55-grade-plan.sh "요청 내용"
```

Run the current Kubernetes deploy path:

```bash
curl -sS -X POST -d 'cmd=deploy-80' 'http://127.0.0.1:17890/run?token=qwer1234'
```

## Future Upgrade Order

1. Keep `/goal`, context pack, ordered steps, and verification evidence stable.
2. Add Playwright route checks for key admin pages and ops button workflows.
3. Add Qdrant only for semantic retrieval of docs, past failures, and implementation patterns.
4. Add Langfuse or OpenTelemetry bridge after the local DB evidence format is stable.
5. Add LangGraph only when script-only sequencing becomes hard to maintain.
6. Add MCP router after at least three tools need model-discoverable schemas.

