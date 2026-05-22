# Hermes Workflow DB

Date: 2026-05-18 KST

## Purpose

Hermes stores request interpretation, ordered execution steps, runtime evidence, and reusable failure patterns in DB.

Hermes DB is not the executor. Execution remains Codex plus deterministic scripts.

## Flow

```text
User request
-> hermes_task
-> hermes_command_interpretation
-> hermes_development_pattern / hermes_pattern_match
-> hermes_similar_work_match / hermes_task_lesson
-> ai-agent-teams selection
-> registered work guard / checkpoint templates
-> project knowledge assets
-> hermes_task_step
-> hermes_execution_log
-> hermes_verification_log
-> hermes_failure_pattern / hermes_runtime_snapshot / hermes_model_decision
```

## Model Policy

- Qwen3.6 40B is the primary planner and architecture judge.
- Small models are support-only for logs, summaries, candidate extraction, and shadow comparison.
- DB migration, Kubernetes apply, deploy, rollback, and service restart require deterministic evidence.

## Minimum Tables

- `hermes_task`: request, interpreted intent, status, plan, result.
- `hermes_command_interpretation`: normalized command and ordered stage JSON.
- `hermes_development_pattern`: reusable Carbonet work categories such as frontend, backend, DB, scripts, deploy, and AI orchestration.
- `hermes_development_pattern_step`: ordered pattern playbook that becomes `hermes_task_step`.
- `hermes_development_pattern_check`: build, route, runtime, SQL, and diff checks expected for the pattern.
- `hermes_development_pattern_artifact_rule`: path ownership and artifact boundaries for the pattern.
- `hermes_development_pattern_team_rule`: required, gate, and support AI team rules for each pattern.
- `hermes_pattern_match`: selected pattern and match confidence for a specific request.
- `hermes_similar_work_match`: prior tasks, pages, failures, and fixes selected as references for the current request.
- `hermes_task_lesson`: reusable task lessons that must be applied to similar future work.
- `hermes_work_packet`: compact, replayable implementation context assembled from the selected pattern, similar work, files, checks, and lessons.
- `hermes_work_execution_guard_policy`: mandatory guard policies for DB-first order checks, midpoint reports, parity verification, rework, and restore readiness.
- `hermes_work_checkpoint_template`: reusable checkpoints inserted into each task so operators can inspect progress and options.
- `hermes_task_work_checkpoint`: task-level planned/running/done checkpoint rows.
- `hermes_project_scan_batch`: source/skill/doc/harness scan batch evidence.
- `hermes_project_knowledge_asset`: registered directory, source, skill, doc, SQL, and harness assets with pattern/team hints.
- `hermes_task_step`: stage-by-stage work order.
- `hermes_execution_log`: command/script execution evidence.
- `hermes_verification_log`: route/build/runtime proof.
- `hermes_failure_pattern`: reusable fixes and prevention notes.
- `hermes_model_decision`: why 40B/small model/script path was selected.
- `hermes_model_lane_policy`: local-first model lane policy for Gemma4 translation, Qwen2.5 Instruct classification, Qwen2.5 Coder draft work, Qwen Math calculation checks, Qwen3.5 9B candidate benchmarks, 40B judgment, and deterministic verification. Qwen3 small models are not selected for Carbonet local lanes.
- `hermes_runtime_snapshot`: raw system, DB, k8s, service snapshots.

## Default Order

1. Request capture
2. Intent and risk parse
3. Pattern resolve: match request to a DB-backed Carbonet development pattern
4. Similar work retrieval: find prior tasks/pages/failures/fixes and apply lessons to the current task
5. Scope route: frontend/backend/database/scripts/kubernetes
6. Work packet build: persist the compact context needed after chat context compression
7. Precheck
8. Implementation
9. Verification
10. Reflection and memory update

## Similar Work Retrieval

Hermes must not treat repeated Carbonet work as a new blank task. After pattern resolution and before implementation, it should search for similar prior work and persist the result.

Similarity must consider:

- selected `pattern_id`
- route, menu, domain, and page family
- frontend/backend/DB artifact overlap
- API CRUD shape and entity structure
- verification checks used by the previous task
- failure patterns and repairs seen in previous work

The retrieval output becomes part of the task contract:

- `referenceTasks`: prior `hermes_task` ids that should be inspected
- `referencePages`: approved pages or routes to compare against
- `lessonsApplied`: failures, fixes, and decisions copied into the current checklist
- `sourceArtifactsToOpen`: concrete files that must be reopened before implementation
- `additionalChecks`: checks added because similar work failed before

This prevents context compression from becoming the source of truth. The compact work packet points back to original files, DB rows, and evidence logs, and the implementer must reopen those originals before editing.

## Development Pattern Registry

The canonical seed lives at:

```text
ops/hermes/development-patterns.seed.json
```

The DB schema and initial registry seed live at:

```text
ops/db/carbonet/20260518_007_hermes_development_pattern_registry.sql
```

The agent-team registry is checked for every request:

```text
var/ai-agent-teams/ai-agent-teams.json
```

The local-first model routing policy is:

```text
ops/hermes/model-routing-policy.seed.json
```

Hermes must use registered local endpoints first. Normal task execution must not block on HuggingFace model downloads; model acquisition is a separate setup task.

Pattern resolution emits `agentTeamSelection` with:

- `requiredTeams`: teams that must be considered before work starts.
- `gateTeams`: teams whose concerns become stop conditions or verification gates.
- `supportTeams`: teams that can assist with draft, triage, scoring, or follow-up.
- `workSelectionPolicy`: the rule that the request must be filtered through agent-team ownership before execution.

Initial pattern families:

- `BUILD_RESTART_18000`
- `BUILD_REDEPLOY_80`
- `ADMIN_REACT_PAGE_CHANGE`
- `BACKEND_CONTROLLER_SERVICE_API_CHANGE`
- `DB_SCHEMA_PATCH_CHANGE`
- `FULLSTACK_ADMIN_DB_API_CHANGE`
- `HERMES_PATTERN_REGISTRY_CHANGE`

Hermes should not invent a new workflow when one of these patterns matches. The 40B model interprets intent and risk, then `ops/scripts/hermes-resolve-pattern.sh` selects the closest governed pattern. The selected pattern's steps are persisted as the authoritative `hermes_task_step` sequence for execution.

The resolver also reads `ai-agent-teams.json` and writes the selected teams into:

- the pattern resolution JSON
- `hermes_command_interpretation.target_hint_json`
- `hermes_command_interpretation.risk_gate_json`
- `hermes_context_pack.agent_team_context`
- `hermes_pattern_match.matched_reason`

This keeps "what to check first" and "which work should be selected" inside the task record, not only in the chat history.

## Work Guard Policy

Every work request must check these DB-backed guard policies before claiming progress:

1. `DB_WORK_ORDER_FIRST`: read registered pattern, steps, checks, teams, and project knowledge before implementation.
2. `SIMILAR_WORK_RETRIEVAL`: retrieve related tasks/pages/failures/fixes and add their lessons to the current checklist.
3. `CONTEXT_GAP_CHECK`: compare supplied context with current source, skills, docs, and harnesses.
4. `WORK_PACKET_READY`: persist a compact implementation packet before editing so the task survives chat context compression.
5. `MIDPOINT_REPORT_AND_OPTIONS`: record selected work, excluded work, options, and uncertainty before risky implementation.
6. `EXISTING_SCRIPT_PARITY`: compare results with existing scripts and harnesses; rework when output is inaccurate or unnecessary.
7. `VERIFY_REWORK_AND_RESTORE`: keep rework and restore anchors available when verification or user review fails.

The schema lives at:

```text
ops/db/carbonet/20260518_008_hermes_project_knowledge_and_work_guard.sql
```

The project structure and knowledge registry are refreshed with:

```bash
bash ops/scripts/hermes-sync-project-knowledge.sh --apply
```

The scanner registers:

- project directories
- React frontend features and routes
- Java/Spring/eGovFrame backend sources
- SQL migrations
- Codex/Hermes/build/deploy scripts
- `.codex/skills/*/SKILL.md`
- AI, architecture, operation, and SQL docs

`hermes-record-request.sh` records a DB work-order preflight in each `hermes_context_pack`, then creates planned rows in `hermes_task_work_checkpoint`. This lets an operator or the user inspect the task midway, ask for correction, or request restore with a stable evidence trail.

## CLI

```bash
cd /opt/Resonance
bash ops/scripts/hermes-record-request.sh "요청 내용"
```

Dry-run pattern resolution without DB writes:

```bash
bash ops/scripts/hermes-resolve-pattern.sh --request "80포트 빌드 재배포해줘" \
  --team-file var/ai-agent-teams/ai-agent-teams.json
```

The script records the request and stage order in DB, then stores a JSONL evidence copy under:

```text
var/ai-runtime/hermes-workflow/
```
