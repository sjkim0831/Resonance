# AI Skill And Doc Routing Matrix

Use this file as the first routing gate for AI-assisted work in this repository.

Goal:

- keep default reads small
- choose one primary skill and at most one secondary skill
- cap the default mandatory reads to the smallest useful set
- stop broad doc exploration unless the task actually needs it

## Default Read Budget

For most tasks, do not read more than:

1. this file
2. one primary skill file
3. one or two task-specific docs

Do not open large active, archive, example, handoff, or architecture chains unless the routing below explicitly points there.

## Quick Gate

Choose the first matching route.

### 1. Simple question or code explanation

Use when:

- the user asks what a file does
- the user asks where something is implemented
- no code change is requested

Primary skill:

- `carbonet-codex-token-optimizer`

Read:

1. `docs/operations/codex-token-optimization-guide.md`
2. the target source file or exact map file

Do not read by default:

- `docs/ai/00-governance/ai-session-partitioning.md`
- `docs/ai/60-operations/session-orchestration/**`
- broad architecture docs

### 2. Small isolated code change

Use when:

- one file family changes
- no shared DTO/API/mapper contract is involved
- no durable handoff is needed

Primary skill:

- domain skill only

Secondary skill:

- `carbonet-codex-token-optimizer`

Read:

1. the relevant domain skill
2. the target implementation files
3. one focused map if needed

Read `docs/ai/00-governance/ai-session-partitioning.md` only if shared ownership becomes likely while exploring.

### 3. Normal feature implementation

Use when:

- frontend and backend may both move
- routes, templates, APIs, mappers, or menu metadata may change

Primary skill:

- `carbonet-feature-builder`

Secondary skill:

- `carbonet-ai-session-orchestrator`

Read:

1. `.codex/skills/carbonet-feature-builder/SKILL.md`
2. `.codex/skills/carbonet-ai-session-orchestrator/SKILL.md`
3. `docs/ai/00-governance/ai-session-partitioning.md`
4. only the exact UI/backend/data maps needed by the target feature

Do not read by default:

- `docs/ai/60-operations/session-orchestration/active/**`
- `docs/ai/60-operations/session-orchestration/archive/**`

### 4. Design-driven screen work

Primary skill:

- `carbonet-screen-design-workspace`

Secondary skill:

- `carbonet-feature-builder`

Read:

1. `.codex/skills/carbonet-screen-design-workspace/SKILL.md`
2. the top-level design HTML files under `/home/imaneya/workspace/화면설계`
3. `.codex/skills/carbonet-feature-builder/SKILL.md` only after the canonical design source is known

### 5. Builder or common-vs-project ownership work

Primary skill:

- `carbonet-common-project-boundary-switcher` or `carbonet-screen-builder`

Secondary skill:

- `carbonet-ai-session-orchestrator`

Read:

1. the primary skill file
2. `docs/ai/00-governance/ai-session-partitioning.md`
3. only the canonical builder live-entry docs when the task is already in active continuation

Default live-entry pair for active builder resource ownership continuation only:

1. `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`
2. `docs/architecture/builder-resource-ownership-queue-map.md`

Do not read by default:

- row-specific example docs
- decision note templates
- blocker example docs

Open those only when the selected live-entry pair explicitly routes there.

### 6. Runtime freshness, build, restart, or :18000 proof

Primary skill:

- `carbonet-fast-bootstrap-ops`

Secondary skill:

- `carbonet-react-refresh-consistency` only when browser cache or static asset freshness is part of the issue

Read:

1. `.codex/skills/carbonet-fast-bootstrap-ops/SKILL.md`
2. `docs/operations/fast-bootstrap-runtime-freshness.md`
3. `AGENTS.md`

### 7. React hard refresh, manifest, cache, or stale asset behavior

Primary skill:

- `carbonet-react-refresh-consistency`

Secondary skill:

- `carbonet-fast-bootstrap-ops` only when packaging or restart proof is also required

Read:

1. `.codex/skills/carbonet-react-refresh-consistency/SKILL.md`
2. `docs/ai/60-operations/react-refresh-and-cache-control.md`

### 8. Codex execution console or SR Workbench execution flow

Primary skill:

- `carbonet-codex-execution-console`

Secondary skill:

- `carbonet-ai-session-orchestrator`

Read:

1. `.codex/skills/carbonet-codex-execution-console/SKILL.md`
2. the exact console route or runner script files

### 9. High-parallel multi-account or collab delivery

Use when:

- the operator wants many Codex accounts or lanes active at once
- handoff and ownership rules matter more than raw implementation volume
- a collaboration or collab function will be used to keep many sessions aligned

Primary skill:

- `carbonet-ai-session-orchestrator`

Secondary skill:

- exactly one domain skill after the ownership freeze

Read:

1. `.codex/skills/carbonet-ai-session-orchestrator/SKILL.md`
2. `docs/ai/00-governance/ai-session-partitioning.md`
3. `docs/ai/60-operations/session-orchestration/README.md`
4. `docs/architecture/tmux-multi-account-delivery-playbook.md` when account-to-lane or tmux/collab layout is part of the request

Rules:

- do not create one write lane per available account
- account count does not change the ownership model
- keep one active writer per shared file family
- extra accounts should be used for bounded non-overlapping lanes, verification, docs, runtime proof, or paused standby ownership
- when `14` accounts are available, start from the same minimum safe lane design and expand only if there are truly disjoint ownership families

## Primary Skill Short Map

- ordinary screen/menu/service work: `carbonet-feature-builder`
- design interpretation: `carbonet-screen-design-workspace`
- builder/systemization work: `carbonet-screen-builder`
- common vs project reversibility: `carbonet-common-project-boundary-switcher`
- runtime freshness/build/restart proof: `carbonet-fast-bootstrap-ops`
- cache or hard-refresh issues: `carbonet-react-refresh-consistency`
- audit/trace/registry architecture: `carbonet-audit-trace-architecture`
- codex runner lifecycle: `carbonet-codex-execution-console`
- token-cost control: `carbonet-codex-token-optimizer`
- high-parallel collab orchestration: `carbonet-ai-session-orchestrator`

## Read Escalation Rule

Only expand the doc set when one of these is true:

- a shared ownership boundary is unclear
- a contract change crosses frontend and backend
- the task is a continuation of an already-active lane
- runtime proof is required
- the user explicitly asks for deep architecture review

If none of those are true, stay inside the quick gate path.

## Anti-Waste Rules

- Do not treat `README.md`, `STRUCTURE.md`, and `docs/ai/00-governance/ai-fast-path.md` as mandatory for every task.
- Do not open `docs/ai/60-operations/session-orchestration/active/**` unless the task is explicitly resuming an active coordinated lane.
- Do not open `docs/ai/60-operations/session-orchestration/archive/**` during normal implementation.
- Do not open `*-example.md` files unless a live-entry file points to that exact example.
- Do not open row-specific builder review docs before reading the live-entry pair.

## Maintenance Rule

When a new skill or governance doc is added, update:

1. this file
2. `docs/ai/00-governance/ai-reference-reduction-policy.md`
3. `docs/ai/00-governance/ai-orchestration-doc-retention-inventory.md` when retention or cleanup rules change
4. `docs/ai/80-skills/skill-index.md`
