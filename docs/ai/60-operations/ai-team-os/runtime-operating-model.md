# Carbonet AI Team OS Runtime Operating Model

## Hardware Baseline

- GPU: RTX 5090 32GB
- CPU: Threadripper 9955WX class
- RAM: about 45 GiB free in normal operation
- Model format: GGUF Q4
- Normal context:
  - micro/router: 2K-4K
  - 4B/utility: 4K-8K
  - 14B coder: 16K-32K
  - 26B/40B judge: 32K-64K only when VRAM allows

## Default Runtime Shape

The default shape is hybrid, not "everything always on".

Always warm:

- `main-qwen36-40b-gpu`: fixed main judge and complex development model at 131K context
- `translation-gemma4-e4b-gpu`: Korean/English copy, glossary, and small translation work
- `sub-qwen7-coder-cpu`: Hermes watchdog, task extraction, loop detection, and small draft support
- `micro-router-qwen05-cpu`: request routing, team selection, first risk gate
- `utility-qwen15-cpu`: log summary, build triage, QA checklist draft

Dynamic:

- GPU 7B candidate only after a no-regression benchmark proves Qwen40 throughput does not drop.
- `sub-qwen14-coder-gpu` is disabled by default.
- SuperGemma 26B is retired and must not be selected.

## Team Startup Classes

- `always-on-light`: CPU micro teams that classify, validate, log, and gate.
- `app-pod-sidecar-light`: app pod companion roles only for health, log, validation, and routing.
- `db-pod-sidecar-light`: DB pod companion roles only for read-only diagnosis and risk classification.
- `on-demand-cpu`: cheap text, copy, and triage workers.
- `on-demand-gpu`: 14B/26B/40B specialists.
- `manual`: benchmark or risky experimental lanes.

## CUBRID DBA AI Boundary

The 1B-or-smaller DBA model is not a DBA executor. It is a router and gatekeeper.

Allowed:

- classify DB intent
- distinguish read-only, write, destructive, HA/restart, backup/restore
- choose read-only diagnostic tools
- draft checklists
- escalate to 14B/40B and approval gates

Forbidden:

- execute `DROP`, `TRUNCATE`, destructive `UPDATE` or `DELETE`
- apply migrations
- restart broker/DB
- change HA, backup, permission, or production data
- train on secrets, passwords, personal data, raw customer data

Gold labels for fine-tuning:

- `read_only_ok`
- `explain_only`
- `sql_draft_only`
- `approval_required`
- `forbidden`

Promotion gates:

- JSON validity at least 99%
- forbidden-action false negative count must be 0 on the eval set
- known incident routing at least 95%
- active alias promotion requires operator approval

## Request Flow

1. Micro router classifies the request and selects a work kind.
2. Hermes infers a request-specific work kind from the registry. `CUBRID`, `SQL`, or `DB` routes to `db-management`; pod and sidecar work routes to `web-pod-management`; KRDS, layout, theme, CSS, and UI work routes to `design-build`.
3. `resonance-model-ask classify` uses the router role, `context` and `review` use the utility role, and `draft` uses the CPU 7B sub role unless explicitly overridden.
4. Lightweight sidecar or CPU utility collects logs, schema hints, and risk.
5. CPU 7B drafts bounded support and watches Hermes for delay, repeated failures, terminal loops, and evidence gaps.
6. Main judge reviews only risky work.
7. Codex or deterministic scripts execute and verify.
8. Verified outcome is reflected to DB/RAG/pattern memory.

## Hermes Watchdog

Qwen40 is the main worker, but Hermes itself is supervised by the CPU 7B helper. The watchdog records checkpoint summaries rather than token-by-token logs.

Signals:

- request extraction is empty or ambiguous
- the same command or error repeats
- terminal preparation loops
- model download loops
- no output timeout
- context compression stall
- iteration budget reached
- success is claimed without build, route, DB, or runtime evidence

Feedback flow:

1. Hermes records a checkpoint.
2. CPU 7B summarizes the risk or next correction.
3. The summary is stored in `/opt/Resonance/var/ai-runtime/hermes-watchdog/hermes-watchdog-events.jsonl`.
4. The same summary is inserted into `hermes_runtime_snapshot` with `snapshot_type='WATCHDOG_FEEDBACK'` when the DB pod is available.
5. Qwen40 receives the compact `modelDecision.watchdogFeedbackBlock` before the next stage.

Live session guard:

1. `hermes-launcher.sh` records the preflight work packet before launching Hermes.
2. While Hermes runs, `hermes-live-watchdog.sh` samples transcript/stdout tails on change and on no-output stalls.
3. CPU 7B reports only observed risks and stores them as `hermes_runtime_snapshot.snapshot_type='HERMES_LIVE_WATCHDOG'`.
4. The live watchdog is advisory and must not kill the primary Hermes process by itself; deterministic command, DB, and runtime evidence remain the source of truth.

## Hermes Agent Self-Heal

Hermes agent repair uses a blue/green runtime boundary.

- `hermes-agent-active`: stable runtime used by `hermes`
- `hermes-agent-next`: candidate runtime updated and smoke-tested after a failure
- `hermes-agent-rollback`: previous stable runtime

Failure flow:

1. `hermes-launcher.sh` records the failed task, stdout/stderr refs, and exit code.
2. `hermes-agent-self-heal.sh` stores `HERMES_AGENT_FAILURE`.
3. Qwen40 is called through `resonance-model-ask agent-repair` to produce a repair plan.
4. `hermes-agent-release-manager.sh prepare-next` copies active to a candidate release.
5. A complete safe patch may be applied to `next`; active is never edited directly.
6. `hermes-agent-release-manager.sh smoke next` runs deterministic CLI smoke checks.
7. A handoff file is written with the original `hermes --resume <session-id>` command when detected.
8. Promotion is gated by Qwen40 `promoteRecommended=true` plus deterministic smoke success. Set `HERMES_AGENT_SELF_HEAL_AUTO_PROMOTE=0` to force operator-only promotion.

## Current Registry Sources

- Runtime model registry: `/opt/Resonance/var/ai-model-runtime/model-runtime-registry.json`
- Hermes runtime view: `/opt/Resonance/var/ai-model-runtime/hermes-runtime-view.json`
- Team manifest: `/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json`
- Repository seed: `ops/hermes/model-runtime-registry.seed.json`
- Repository team seed: `ops/ai-agent-teams/ai-agent-teams.seed.json`
