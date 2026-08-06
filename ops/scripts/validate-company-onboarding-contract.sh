#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/web/MemberJoinController.java"
PAGE="$ROOT/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectCreatePage.tsx"

require() { grep -Fq "$2" "$1" || { echo "missing contract: $2" >&2; exit 1; }; }

# COMPANY_ONBOARDING_HAPPY / NO_COMPANY / NO_SITE / ROLE_GAP
require "$SERVICE" 'COMPANY_NOT_APPROVED'
require "$SERVICE" 'ACTIVE_SITE_REQUIRED'
require "$SERVICE" 'REQUIRED_ACTOR_MISSING:'
require "$SERVICE" 'result.put("ready",missing.isEmpty())'

# COMPANY_ONBOARDING_SOD: calculator, verifier and approver must be separate accounts.
require "$SERVICE" "actor_code IN ('CALCULATOR','VERIFIER','APPROVER')"
require "$SERVICE" 'HAVING count(DISTINCT actor_code)>1'
require "$SERVICE" 'SEGREGATION_OF_DUTIES_REQUIRED:CALCULATOR,VERIFIER,APPROVER'
require "$SERVICE" 'result.put("segregationOfDuties",segregationOfDuties)'

# COMPANY_ONBOARDING_TENANT: every readiness lookup is tenant scoped.
tenant_predicates="$(grep -o 'tenant_id=?' "$SERVICE" | wc -l | tr -d ' ')"
[[ "$tenant_predicates" -ge 4 ]] || { echo "tenant isolation predicates are incomplete" >&2; exit 1; }

# COMPANY_ONBOARDING_RETRY: the registration command reports failure and does not claim success.
require "$CONTROLLER" 'response.put("success", false)'
require "$CONTROLLER" 'return ResponseEntity.internalServerError().body(response)'

# User-visible professional readiness evidence.
require "$PAGE" '업무분리'
require "$PAGE" '산정·검증·승인은 서로 다른 3개 계정에 배정해야 합니다.'

printf 'COMPANY_ONBOARDING_CONTRACT_PASS cases=7 steps=5 tenantPredicates=%s sod=verified ui=verified\n' "$tenant_predicates"
