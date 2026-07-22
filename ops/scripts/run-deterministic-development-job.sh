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
if [[ "$JOB_TYPE" == "FULL_STACK" || "$JOB_TYPE" == "FULL_STACK_GENERATION" ]]; then
  jq -e 'type == "object" and .generatorRequired == true and .reuseCommonAssets == true' "$SPEC_FILE" >/dev/null
else
  jq -e 'type == "object" and (.requirement | type == "string")' "$SPEC_FILE" >/dev/null
fi

slug_process="$(tr '[:upper:]' '[:lower:]' <<<"$PROCESS")"
slug_step="$(tr '[:upper:]' '[:lower:]' <<<"$STEP")"
generated_dimension_validator="$WT/ops/scripts/validate-generated-process-dimension.sh"
generated_step_package="$WT/projects/carbonet-backend-metadata/process-runtime/generated/$PROCESS/${PROCESS}__${STEP}.json"
case "$JOB_TYPE" in
  FULL_STACK|FULL_STACK_GENERATION)
    artifact="projects/carbonet-backend-metadata/process-runtime/generated/$PROCESS/index.json"
    FULL_STACK_PACKAGE_OUT="$WT/projects/carbonet-backend-metadata/process-runtime/generated" \
      bash "$WT/ops/scripts/generate-full-stack-design-packages.sh" "$WT" "$PROCESS" >/dev/null
    jq -e --arg process "$PROCESS" '
      .packageCount>0 and ([.packages[].processCode]|all(.==$process))
    ' "$WT/$artifact" >/dev/null
    # Process-level output cannot prove a different step is implemented.
    # The exact step package is the deterministic completion boundary.
    [[ -s "$generated_step_package" ]] || {
      echo "[deterministic-development] exact step package missing: $PROCESS/$STEP" >&2
      exit 4
    }
    jq -e --arg process "$PROCESS" --arg step "$STEP" '
      .process.code==$process and .step.code==$step
    ' "$generated_step_package" >/dev/null
    python3 "$WT/ops/scripts/fast-process-package-test.py" "$generated_step_package" \
      --cache-dir "$WT/var/verification/process-package-tests" \
      --evidence "$WT/var/test-evidence/process-package-tests/${PROCESS}__${STEP}.json" 1>&2
    ;;
  TEST|ACTOR_TEST|INTEGRATION)
    if [[ -s "$generated_step_package" ]]; then
      adoption_json="$(bash "$generated_dimension_validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")" || exit $?
      runtime_evidence="$(jq -r '.evidence' <<<"$adoption_json")"
    else
      validator="$WT/ops/scripts/validate-existing-emission-project-journey.sh"
      adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")" || exit $?
      runtime_evidence_root="${CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR:-$WT/var/test-evidence/process-runtime-smoke}"
      CARBONET_RUNTIME_SMOKE_PROCESS="$PROCESS" CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR="$runtime_evidence_root" \
        bash "$WT/ops/scripts/run-process-runtime-smoke.sh" 1>&2
      runtime_evidence="$runtime_evidence_root/latest.json"
    fi
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE-job-$JOB_ID.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    cat >"$WT/$artifact" <<EOF
# Verified actor journey adoption: $PROCESS / $STEP

- Job: $JOB_ID
- Job type: $JOB_TYPE
- Source commit: $(git -C "$WT" rev-parse HEAD)
- Requirement: $(jq -r '.requirement' "$SPEC_FILE")
- Validation result: $adoption_json
- Live runtime evidence: $runtime_evidence

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, a real rolled-back state transition, idempotency, runtime p95 evidence, and two ready replicas.
EOF
    ;;
  SEARCH)
    validator="$WT/ops/scripts/validate-existing-emission-project-search.sh"
    adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP")" || exit $?
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE-job-$JOB_ID.md"
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
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE-job-$JOB_ID.md"
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
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE-job-$JOB_ID.md"
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
  FRONTEND_USER|FRONTEND_ADMIN)
    [[ -s "$generated_step_package" ]] || exit 3
    adoption_json="$(bash "$generated_dimension_validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")" || exit $?
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE-job-$JOB_ID.md"
    mkdir -p "$WT/$(dirname "$artifact")"
    cat >"$WT/$artifact" <<EOF
# Verified generated frontend adoption: $PROCESS / $STEP

- Job: $JOB_ID
- Job type: $JOB_TYPE
- Source commit: $(git -C "$WT" rev-parse HEAD)
- Validation result: $adoption_json

The exact approved step package supplies the matching USER or ADMIN route,
professional field contract, shared KRDS layout, responsive behavior,
accessibility, server authorization, and actor/process traceability.
EOF
    ;;
  API|API_QUALITY|BACKEND|BACKEND_QUALITY)
    if [[ -s "$generated_step_package" ]]; then
      if ! adoption_json="$(bash "$generated_dimension_validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")"; then
        FULL_STACK_PACKAGE_OUT="$WT/projects/carbonet-backend-metadata/process-runtime/generated" \
          bash "$WT/ops/scripts/generate-full-stack-design-packages.sh" "$WT" "$PROCESS" >/dev/null
        adoption_json="$(bash "$generated_dimension_validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")" || exit $?
      fi
    else
      validator="$WT/ops/scripts/validate-existing-emission-project-api.sh"
      adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP")" || exit $?
    fi
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE-job-$JOB_ID.md"
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
    if [[ -s "$generated_step_package" ]]; then
      if ! adoption_json="$(bash "$generated_dimension_validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")"; then
        FULL_STACK_PACKAGE_OUT="$WT/projects/carbonet-backend-metadata/process-runtime/generated" \
          bash "$WT/ops/scripts/generate-full-stack-design-packages.sh" "$WT" "$PROCESS" >/dev/null
        adoption_json="$(bash "$generated_dimension_validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")" || exit $?
      fi
    else
      validator="$WT/ops/scripts/validate-existing-emission-project-database.sh"
      adoption_json="$(bash "$validator" "$WT" "$PROCESS" "$STEP" "$JOB_TYPE")" || exit $?
    fi
    artifact="docs/ai/85-adopted-quality/$slug_process/$slug_step-$JOB_TYPE-job-$JOB_ID.md"
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
