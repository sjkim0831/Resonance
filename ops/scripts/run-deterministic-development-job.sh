#!/usr/bin/env bash
set -Eeuo pipefail

WT="${1:?worktree is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"
JOB_ID="${4:?job id is required}"
JOB_TYPE="${5:?job type is required}"
TARGET="${6:-}"
SPEC_FILE="${7:?specification file is required}"
SEARCH_CONTEXT="${8:?search context is required}"

POLICY="$WT/ops/runtime-metadata/deterministic-development-policy.json"
jq -e --arg type "$JOB_TYPE" '.deterministicJobTypes | index($type) != null' "$POLICY" >/dev/null || exit 3
jq -e 'type == "object" and (.requirement | type == "string")' "$SPEC_FILE" >/dev/null

slug_process="$(tr '[:upper:]' '[:lower:]' <<<"$PROCESS")"
slug_step="$(tr '[:upper:]' '[:lower:]' <<<"$STEP")"
case "$JOB_TYPE" in
  FULL_STACK|FULL_STACK_GENERATION)
    artifact="projects/carbonet-backend-metadata/process-runtime/generated/$PROCESS/index.json"
    FULL_STACK_PACKAGE_OUT="$WT/projects/carbonet-backend-metadata/process-runtime/generated" \
      bash "$WT/ops/scripts/generate-full-stack-design-packages.sh" "$WT" "$PROCESS" >/dev/null
    jq -e --arg process "$PROCESS" '
      .packageCount>0 and ([.packages[].processCode]|all(.==$process))
    ' "$WT/$artifact" >/dev/null
    ;;
  TEST|ACTOR_TEST|INTEGRATION)
    validator="$WT/ops/scripts/validate-existing-emission-project-journey.sh"
    adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")" || exit $?
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    cat >"$WT/$artifact" <<EOF
# Verified actor journey adoption: $PROCESS / $STEP

- Job: $JOB_ID
- Job type: $JOB_TYPE
- Source commit: $(git -C "$WT" rev-parse HEAD)
- Requirement: $(jq -r '.requirement' "$SPEC_FILE")
- Validation result: $adoption_json

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, state transitions, runtime p95 evidence, and two ready replicas.
EOF
    ;;
  SEARCH)
    validator="$WT/ops/scripts/validate-existing-emission-project-search.sh"
    adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP")" || exit $?
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    cat >"$WT/$artifact" <<EOF
# Verified integrated search adoption: $PROCESS / $STEP

- Job: $JOB_ID
- Source commit: $(git -C "$WT" rev-parse HEAD)
- Requirement: $(jq -r '.requirement' "$SPEC_FILE")
- Validation result: $adoption_json

The deterministic validator requires the DB-backed menu, work, and post scopes, list/detail navigation, the exact process route in the generated route index, and a healthy live search page.
EOF
    ;;
  PERFORMANCE)
    validator="$WT/ops/scripts/validate-existing-emission-project-performance.sh"
    adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP")" || exit $?
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    cat >"$WT/$artifact" <<EOF
# Verified runtime performance adoption: $PROCESS / $STEP

- Job: $JOB_ID
- Source commit: $(git -C "$WT" rev-parse HEAD)
- Requirement: $(jq -r '.requirement' "$SPEC_FILE")
- Validation result: $adoption_json

The deterministic validator requires incremental-build controls, a recent successful deployment, the step-specific end-to-end runtime gate, two ready replicas, and measured integrated-search p95 latency.
EOF
    ;;
  NOTIFICATION)
    validator="$WT/ops/scripts/validate-existing-emission-project-notification.sh"
    adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP")" || exit $?
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    cat >"$WT/$artifact" <<EOF
# Verified existing in-app notification adoption: $PROCESS / $STEP

- Job: $JOB_ID
- Source commit: $(git -C "$WT" rev-parse HEAD)
- Requirement: $(jq -r '.requirement' "$SPEC_FILE")
- Validation result: $adoption_json

The deterministic validator requires persisted step-specific workflow events, authenticated user-facing readers, executable workflow tests, and a healthy live project workflow. Missing event or reader contracts leave this job incomplete.
EOF
    ;;
  API|API_QUALITY|BACKEND|BACKEND_QUALITY)
    validator="$WT/ops/scripts/validate-existing-emission-project-api.sh"
    adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP")" || exit $?
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    cat >"$WT/$artifact" <<EOF
# Verified existing server adoption: $PROCESS / $STEP

- Job: $JOB_ID
- Job type: $JOB_TYPE
- Source commit: $(git -C "$WT" rev-parse HEAD)
- Requirement: $(jq -r '.requirement' "$SPEC_FILE")
- Validation result: $adoption_json

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.
EOF
    ;;
  DATABASE|DATABASE_QUALITY)
    validator="$WT/ops/scripts/validate-existing-emission-project-database.sh"
    adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")" || exit $?
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    cat >"$WT/$artifact" <<EOF
# Verified existing database adoption: $PROCESS / $STEP

- Job: $JOB_ID
- Job type: $JOB_TYPE
- Source commit: $(git -C "$WT" rev-parse HEAD)
- Requirement: $(jq -r '.requirement' "$SPEC_FILE")
- Validation result: $adoption_json

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.
EOF
    ;;
  REFERENCE_ANALYSIS)
    artifact="docs/ai/70-reference/$slug_process/$slug_step.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    requirement="$(jq -r '.requirement' "$SPEC_FILE")"
    repo_candidates="$(awk '/\[indexed repository candidates/{on=1;next}/\[indexed menu/{on=0}on&&NF{print "- `"$0"`"}' "$SEARCH_CONTEXT" | head -n 40)"
    route_candidates="$(awk '/\[indexed menu and route candidates/{on=1;next}/\[reference candidates/{on=0}on&&NF{print "- `"$0"`"}' "$SEARCH_CONTEXT" | head -n 30)"
    reference_candidates="$(awk '/\[reference candidates/{on=1;next}/\[required completeness/{on=0}on&&NF{print "- `"$0"`"}' "$SEARCH_CONTEXT" | head -n 30)"
    cat >"$WT/$artifact" <<EOF
# $PROCESS / $STEP

## Approved requirement

$requirement

## Deterministic evidence scope

- Source commit: $(git -C "$WT" rev-parse HEAD)
- Job: $JOB_ID
- Target: $TARGET
- Method: versioned repository, route, and reference indexes; no language-model inference

## Existing implementation candidates

${repo_candidates:-- No indexed implementation candidate. This remains an implementation gap.}

## Menu and route candidates

${route_candidates:-- No indexed route candidate. Route design remains required.}

## Reference candidates

${reference_candidates:-- No indexed reference candidate. The approved requirement is the controlling source.}

## Required delivery contracts

- Actor authority and tenant/project isolation must be enforced by the server.
- Commands require entry-state validation, idempotency, optimistic locking, audit evidence, and an explicit next state.
- User and administrator routes require loading, empty, error, forbidden, ready, and mobile states.
- API, database, notification, and search work remains incomplete until its own executable job passes its gate.
- HAPPY_PATH, AUTHORITY, ISOLATION, EXCEPTION, and RECOVERY scenarios must all pass.

## Reuse decision

Only exact registered candidates above may be adopted. Missing implementation is retained as a development job and is not represented as complete by this analysis artifact.
EOF
    ;;
  DESIGN_PREFLIGHT)
    artifact="docs/ai/35-design-preflight/$slug_process/$slug_step-job-$JOB_ID.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    target_status="NOT_APPLICABLE"
    if [[ "$TARGET" == /* ]]; then
      route="${TARGET%%\?*}"
      inventory="$WT/projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts"
      grep -Fq "\"koPath\": \"$route\"" "$inventory" && target_status="REGISTERED" || target_status="MISSING"
    elif [[ -n "$TARGET" ]]; then
      [[ -s "$WT/$TARGET" ]] && target_status="EXISTS" || target_status="MISSING"
    fi
    cat >"$WT/$artifact" <<EOF
# Design preflight: $PROCESS / $STEP

- Job: $JOB_ID
- Target: $TARGET
- Target status: $target_status
- Specification JSON: VALID
- Requirement: $(jq -r '.requirement' "$SPEC_FILE")
- Design contracts: $(jq -c '.designContracts // []' "$SPEC_FILE")

## Gate decision

This preflight records only deterministic contract and target checks. A missing target is not adopted and must be created by its frontend, backend, or database job. Completion of this artifact does not verify those downstream jobs.
EOF
    ;;
  DEPLOYMENT)
    artifact="docs/ai/95-delivery/$slug_process/$slug_step-job-$JOB_ID.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    cat >"$WT/$artifact" <<EOF
# Deployment verification request: $PROCESS / $STEP

- Job: $JOB_ID
- Source commit before delivery: $(git -C "$WT" rev-parse HEAD)
- Requirement: $(jq -r '.requirement' "$SPEC_FILE")

The deterministic worker requests the standard guarded deployment. The parent worker must verify that this commit is contained in the deployed revision, the Kubernetes deployment is fully ready, and `/actuator/health` succeeds before it marks this job verified.
EOF
    ;;
  DESIGN)
    # DESIGN is generated directly by the parent worker because it owns the
    # normalized professional screen contracts.
    exit 3
    ;;
esac

jq -cn --arg strategy "DETERMINISTIC_GENERATOR" --arg type "$JOB_TYPE" --arg artifact "$artifact" \
  '{handled:true,strategy:$strategy,jobType:$type,artifact:$artifact}'
