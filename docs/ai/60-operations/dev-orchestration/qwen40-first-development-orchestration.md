# Qwen7-Primary, Qwen40-Judge Development Orchestration

Date: 2026-05-18 KST
Canonical project root: `/opt/Resonance`

## Decision

Use `Qwen2.5 Coder 7B` as the primary bounded development classifier, context packer, and draft model. Use `Qwen3.6 40B` as the escalation judge, not as the default worker for every subtask.

Small models are selected first for bounded support work:

- Gemma for translation, glossary normalization, and product-name mapping
- Qwen2.5 Coder 7B for development classification, context pack selection, log classification, duplicate detection, candidate extraction, and first implementation drafts
- Qwen 14B only after a registered local endpoint exists and 7B quality is insufficient
- deterministic Codex/scripts for execution and verification

Risky development decisions remain under `Qwen3.6 40B` plus deterministic Codex verification.

## Model Routing Policy

Do not ask one model to read all Skills/Docs. Every request must first select the smallest useful model lane and the smallest useful document pack.

| Lane | Recommended model class | Allowed work | Escalate to 40B when |
| --- | --- | --- | --- |
| `translation` | Gemma4 CPU local first, default `gemma4-e4b-cpu-shadow` via `:24451` | translate Korean/English text, normalize glossary, map product names | Hangul/JSON/glossary validation fails or the endpoint is unavailable |
| `dev-classify` | Qwen2.5 Coder 7B `qwen2.5-coder-7b-instruct-shadow` on `:24751` | primary classifier/context packer for normal development requests | security, permission, DB migration, shared API/DTO/mapper contract, architecture, or confidence below 0.75 |
| `fast-draft` | Qwen2.5 Coder 7B `qwen2.5-coder-7b-instruct-shadow` on `:24751` | primary first-pass coder for normal development drafts | more than one file family changes, API/DB contract changes, verification fails, or confidence is unclear |
| `mid-draft` | Qwen2.5 Coder 14B only when a registered local endpoint exists | fallback when 7B quality is low or the pattern task needs stronger code reasoning | shared DTO/API/mapper contracts, security, migration, or runtime proof is involved |
| `math` | Qwen Math local first, default `qwen-math:7b` | formula checks, unit conversion, numeric validation, calculation review | calculation affects stored emissions or audit evidence |
| `agent-candidate` | Qwen3.5 9B Q4_K_M on `:24119` | benchmark general reasoning, agent planning, long-context behavior | any source write or failed benchmark |
| `judge` | Qwen3.6 40B | architecture judgment, risky implementation review, exception handling, failure interpretation | only after a 7B packet exists or when 7B is unavailable |
| `verify` | deterministic scripts/Codex | build, tests, route probes, DB/runtime evidence | model output conflicts with command evidence |

The default Carbonet development path is:

1. Call Qwen2.5 Coder 7B first for `classify`, `context`, and `draft` packets.
2. Use local registered endpoints first; do not download models during normal request execution.
3. Let 7B produce the normal plan when risk is low or medium and confidence is at least 0.75.
4. Give Qwen3.6 40B a constrained prompt only when judgment is needed: 7B packet, selected task type, selected docs, writable paths, ordered stages, and verification commands.
5. Let Codex/scripts apply changes and collect evidence.
6. Use 40B again only for risky review, failure interpretation, or final correction.

This policy favors repeatable specialization over fine-tuning. Do not fine-tune tiny models until deterministic routing, context selection, and verification logs have enough high-quality examples.

## Context Pack Rules

The selected model must receive a bounded context pack:

- one primary skill, at most one secondary skill
- one or two task-specific docs
- exact candidate files from deterministic search
- explicit writable path boundaries
- exact verification commands, or `TODO` when no known command exists

Avoid broad Skills/Docs loading. If the task cannot be routed with a small context pack, escalate to Qwen3.6 40B for planning instead of adding more documents blindly.

## Runtime Roles

| Role | Runtime | Purpose |
| --- | --- | --- |
| Translation worker | llama.cpp/vLLM `http://127.0.0.1:24451/v1`, default `gemma4-e4b-cpu-shadow` | Korean/English translation, glossary, product-name mapping |
| Development classifier | llama.cpp/vLLM `http://127.0.0.1:24751/v1`, default `qwen2.5-coder-7b-instruct-shadow` | classify task, summarize logs, select candidate files/docs, decide escalation |
| Development draft worker | llama.cpp/vLLM `http://127.0.0.1:24751/v1`, default `qwen2.5-coder-7b-instruct-shadow`; 14B only after registered endpoint setup | primary pattern-based draft work before Codex execution and optional 40B review |
| Math worker | local Qwen Math endpoint, default `qwen-math:7b` | formula checks, unit conversion, numeric validation |
| Agent candidate | llama.cpp/vLLM `http://127.0.0.1:24119/v1`, default `qwen3.5-9b-q4_k_m` | candidate lane for Qwen3.5 9B benchmarks before promotion |
| Primary judge | `codex-qwen36.service`, `http://127.0.0.1:24036/v1` | Decompose risky work, judge architecture, review frontend/backend/db/script/k8s impact |
| Executor | Codex and deterministic scripts | Edit files, run build, deploy, verify, rollback |
| Source of truth | Git, DB, runtime logs, Kubernetes state | Evidence and rollback boundary |

## Stage Contract

Every development request should be separated into these stages before code changes:

1. `scope`: user-visible goal and affected runtime.
2. `frontend`: pages, routes, components, build assets.
3. `backend`: controllers, services, mappers, DTOs, domain rules.
4. `database`: tables, migrations, backfill, rollback notes.
5. `scripts`: build, deploy, self-healing, operational scripts.
6. `kubernetes`: pods, services, ingress, rollout, readiness.
7. `verification`: deterministic commands and route proof.
8. `memory`: docs, logs, learned patterns, follow-up automation.

The model may propose. Codex and scripts apply.

## Hard Rules

- Do not let a small model rewrite production code without a 40B or Codex review.
- Do not use an AI model as the source of truth for DB migration, rollback, or Kubernetes apply.
- Do not perform broad repository exploration through a model. Resolve candidate files deterministically first.
- Do not send all Skills/Docs to Qwen3.6 40B by default. Route the request, then load only the selected context pack.
- Do not let Hermes download a model from HuggingFace during a normal work request. Register or install the model separately, then route to it.
- Do not increase `llama.cpp -np` for Hermes long sessions unless the per-slot context remains large enough for the target session. `-c` is shared across slots.
- Keep runtime proof mandatory after deploy-affecting changes.
- For `:18000` freshness, use the existing Carbonet verification scripts.
- For Kubernetes runtime, prefer `/opt/Resonance/ops/scripts/resonance-k8s-build-deploy-80.sh` and operational doctors.

## Promotion Gate For Small Models

A small model may only auto-accept a result when all checks pass:

- output contains required Korean or code shape
- no source-copy failure
- no forbidden broad-scan instruction
- deterministic validation passes
- result matches a known DB cache, glossary, or 40B-derived pattern

Otherwise, escalate to `Qwen3.6 40B`.

## Command

Use:

```bash
cd /opt/Resonance
bash ops/scripts/resonance-dev-orchestrate-40b.sh "요청 내용"
```

The script writes a traceable plan under:

```text
var/ai-runtime/dev-orchestration/
```

The output is a plan, not an automatic deploy.
