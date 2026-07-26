# Kilo NVIDIA M2.7 - 1,000 screen continuation

You are continuing an existing production-adjacent Resonance screen-governance task. Do not restart the investigation from zero.

## Read first

1. `/opt/Resonance/AGENTS.md`
2. The `CURRENT PREFLIGHT JSON` supplied with this prompt
3. `/opt/Resonance/docs/operations/kilo-m27-screen-handoff.md`
4. Only the specific source files named by those documents or by a failing check

The supplied preflight JSON is current evidence. Counts quoted in this prompt are only a historical hint and must not override it.

## Objective

Reach at least 1,000 genuinely distinct, governed screen routes without sacrificing the currently passing runtime and deploy gate. A route is not complete merely because a file or database row exists.

Each accepted screen needs a unique route and screen identity plus a real business purpose, actor, process, task/action, data/API lineage, authority contract, loading/empty/error/success behavior, responsive/accessibility behavior, test evidence, ownership, and rollback path.

## Current continuation point

The last verified snapshot had 925 routes, average quality 95.57, P0=0, P1=0, P2=1, deploy gate 925/925, 551 design-preview files, 122 generated packages, and 428 review-required items. Recalculate all of these from the preflight and live files before deciding work.

The immediate order is:

1. Preserve runtime health and the existing 925/925 passing gate.
2. Resolve the remaining P2 item with the smallest valid metadata/overlay change.
3. Classify the gap to 1,000 from existing reviewed backlog before proposing new screens.
4. Generate only evidence-backed, non-duplicate screens in bounded batches.
5. Re-run changed-route smoke first; run the full 8-shard gate only at a promotion checkpoint.

## Non-negotiable rules

- Never use or copy the legacy `parallel-nvidia-m27.sh`; it contains embedded credentials. Use Kilo's registered provider only.
- Never print, read into the prompt, modify, or commit credentials, `.env` files, API keys, tokens, runtime databases, or vector indexes.
- Do not restart `carbonet-runtime`, PostgreSQL, Patroni, or HAProxy because an old log mentions a failure. Check current state first. If readiness is not UP, stop implementation and report the live blocker.
- Do not blindly insert rows into PostgreSQL. Database mutations require a reviewed migration, dry-run counts, transaction boundaries, idempotency, and rollback SQL.
- Do not manufacture the target by cloning templates or renaming identical screens. Route, actor/process behavior, data contract, and acceptance evidence must be materially distinct.
- Treat page work as no-build, metadata/SDUI-first work per `AGENTS.md`. Do not run npm, Maven, Docker, image builds, or Kubernetes rollout for page-only changes.
- Do not edit Vite `index.html` manually. Do not touch frontend/core/runtime paths outside the page-development allowlist unless the evidence proves a core change is unavoidable.
- Do not overwrite unrelated work. The repository is intentionally dirty; inspect only targeted paths and report overlap before editing.
- Do not run broad recursive scans over `/opt/Resonance`. Use `rg --files` with named roots and exclusions.
- Keep each implementation batch at 25 screens initially. Increase to at most 50 only after two consecutive clean batches.
- Every generator or apply operation must support dry-run, atomic output, idempotent rerun, and failed-batch retry.

## Canonical assets

- `projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-quality-report.json`
- `projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-development-priority-queue.json`
- `projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-deploy-gate-status.json`
- `projects/carbonet-backend-metadata/process-runtime/design-preview/`
- `projects/carbonet-backend-metadata/process-runtime/generated/index.json`
- `projects/carbonet-frontend/source/scripts/build-full-screen-quality-queue.mjs`
- `projects/carbonet-frontend/source/scripts/generate-full-screen-smoke-manifest.mjs`
- `projects/carbonet-frontend/source/scripts/run-full-screen-smoke.sh`
- `ops/scripts/resonance-full-screen-deploy-gate.sh`
- `ops/scripts/resonance-no-build-apply.sh`
- `/admin/system/build-studio`

## Plan-mode output contract

When asked to adapt or plan, do not modify project files or services. Return one compact JSON object with:

- `verifiedBaseline`
- `activeWorkConflicts`
- `immediateP2Target`
- `screenGapTo1000`
- `backlogClassification`
- `firstBatch` containing exact IDs/routes and why each is legitimate
- `allowedWriteRoots`
- `commands` split into dry-run, apply, changed-route test, promotion gate
- `stopConditions`
- `rollback`
- `estimatedMinutes` with the longest step identified

Do not claim completion without command output proving counts, tests, health, and rollback state.
