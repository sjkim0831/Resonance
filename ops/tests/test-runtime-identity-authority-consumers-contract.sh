#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ACTOR="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
ACTOR_TEST="$ROOT/modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/ActorProcessGovernanceServiceSecurityTest.java"
MANAGER="$ROOT/ops/scripts/promote-company-manager-delegation-after-e2e.sh"
MANAGER_TEST="$ROOT/ops/tests/test-promote-company-manager-delegation-after-e2e.sh"
REGULATORY="$ROOT/ops/scripts/complete-regulatory-submission-assurance.sh"
REGULATORY_TEST="$ROOT/ops/tests/test-regulatory-submission-assurance-contract.sh"
REGISTRY="$ROOT/ops/runtime-metadata/business-e2e-runner-registry.json"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235000__bind_runtime_identity_to_pod_template.sql"
USAGE_E2E="$ROOT/ops/scripts/validate-operational-usage-ledger-e2e.sh"

for file in "$ACTOR" "$ACTOR_TEST" "$MANAGER" "$MANAGER_TEST" "$REGULATORY" "$REGULATORY_TEST" "$REGISTRY" "$MIGRATION" "$USAGE_E2E"; do
  [[ -f "$file" ]] || { echo "missing runtime authority consumer: $file" >&2; exit 1; }
done
bash -n "$USAGE_E2E"
for token in \
  'framework_runtime_release_identity_hash(runtime)' \
  'RUNTIME_IDENTITY_HASH' \
  'POD_TEMPLATE_SHA256' \
  '.review.reviewRuntimeIdentityHash==$runtimeHash' \
  "runtime_identity_hash='\${RUNTIME_IDENTITY_HASH}'"; do
  grep -Fq "$token" "$USAGE_E2E" || { echo "usage-review E2E runtime binding missing: $token" >&2; exit 1; }
done

for token in \
  'ADD COLUMN IF NOT EXISTS runtime_identity_hash varchar(64)' \
  'ck_framework_system_usage_review_runtime_identity_hash' \
  'framework_validate_system_usage_review_runtime_identity()' \
  "WHERE release_key='CARBONET_RUNTIME' AND health_status='UP'" \
  'FOR SHARE' \
  'NEW.source_commit IS DISTINCT FROM runtime_state.source_commit' \
  'NEW.runtime_identity_hash IS DISTINCT FROM canonical_runtime_hash' \
  'BEFORE INSERT ON framework_system_usage_review'; do
  grep -Fq "$token" "$MIGRATION" || { echo "usage-review migration guard missing: $token" >&2; exit 1; }
done
bash -n "$MANAGER" "$MANAGER_TEST" "$REGULATORY" "$REGULATORY_TEST"
bash "$MANAGER_TEST"
bash "$REGULATORY_TEST"

for token in \
  'framework_runtime_release_identity_hash(runtime) as "runtimeIdentityHash"' \
  'for share of runtime' \
  'runtime_identity_hash as "reviewRuntimeIdentityHash"' \
  'runtime_identity_hash,reviewed_by' \
  'review.runtime_identity_hash=runtime.runtime_identity_hash' \
  'usage.runtime_identity_hash=(select runtime_identity_hash from runtime_release)' \
  'reviewRuntimeIdentityHash'; do
  grep -Fq "$token" "$ACTOR" || { echo "Actor runtime identity contract missing: $token" >&2; exit 1; }
done
for token in \
  humanReviewFailsClosedWhenCanonicalRuntimeIdentityIsUnavailable \
  humanReviewReplayRejectsTemplateOnlyRuntimeIdentityDrift; do
  grep -Fq "$token" "$ACTOR_TEST" || { echo "Actor runtime identity mutant missing: $token" >&2; exit 1; }
done

jq -e '.runners[] | select(.processCode=="COMPANY_MANAGER_DELEGATION")
  | .automation=="AUTOMATIC" and .runner=="ops/tests/run-company-manager-delegation-business-e2e.sh"
    and .deployLockMode=="SHARED_PARENT"' "$REGISTRY" >/dev/null
jq -e '.runners[] | select(.processCode=="REGULATORY_SUBMISSION")
  | .automation=="AUTOMATIC" and .runner=="ops/scripts/complete-regulatory-submission-assurance.sh"
    and .deployLockMode=="SHARED_PARENT"' "$REGISTRY" >/dev/null

python3 - "$ACTOR" "$MANAGER" "$REGULATORY" "$MIGRATION" "$USAGE_E2E" <<'PY'
from pathlib import Path
import sys

actor, manager, regulatory, migration, usage_e2e = [Path(path).read_text(encoding="utf-8") for path in sys.argv[1:]]
method = actor.split("public Map<String,Object> saveSystemUsageReview", 1)[1].split(
    "static Map<String,Object> compactContractAuditDiagnostics", 1
)[0]
lock = method.index("for share of runtime")
hash_check = method.index("Current healthy runtime identity is unavailable")
review_insert = method.index("insert into framework_system_usage_review")
job_insert = method.index("insert into framework_development_job")
if not lock < hash_check < review_insert < job_insert:
    raise SystemExit("Actor usage review must lock/check runtime before review or job writes")
for token in ("runtime_identity_hash,reviewed_by", "reviewRuntimeIdentityHash"):
    mutant = method.replace(token, "REMOVED", 1)
    if mutant == method:
        raise SystemExit(f"Actor runtime identity mutant ineffective: {token}")

usage_guard = migration.split(
    "CREATE OR REPLACE FUNCTION framework_validate_system_usage_review_runtime_identity()", 1
)[1].split("$usage_review_identity_trigger$;", 1)[0]
guard_lock = usage_guard.index("FOR SHARE")
guard_hash = usage_guard.index("canonical_runtime_hash:=framework_runtime_release_identity_hash(runtime_state)")
guard_source = usage_guard.index("NEW.source_commit IS DISTINCT FROM runtime_state.source_commit")
guard_identity = usage_guard.index("NEW.runtime_identity_hash IS DISTINCT FROM canonical_runtime_hash")
if not guard_lock < guard_hash < guard_source < guard_identity:
    raise SystemExit("usage-review insert guard must lock and compare source plus canonical identity")
for token in (
    "NEW.source_commit IS DISTINCT FROM runtime_state.source_commit",
    "NEW.runtime_identity_hash IS DISTINCT FROM canonical_runtime_hash",
):
    mutant = usage_guard.replace(token, "false", 1)
    if mutant == usage_guard or token in mutant:
        raise SystemExit(f"usage-review trigger mutant ineffective: {token}")

runtime_contract = usage_e2e.index('runtime_contract="$(db_scalar')
runtime_hash_check = usage_e2e.index('[[ "$RUNTIME_IDENTITY_HASH" =~ ^[0-9a-f]{64}$ ]]', runtime_contract)
review_post = usage_e2e.index("POST '/admin/api/system/actor-process/system-test-report/reviews'", runtime_hash_check)
persisted_hash = usage_e2e.index("runtime_identity_hash='${RUNTIME_IDENTITY_HASH}'", review_post)
if not runtime_contract < runtime_hash_check < review_post < persisted_hash:
    raise SystemExit("usage-review E2E must capture and verify canonical identity before persistence proof")
for token in (
    'framework_runtime_release_identity_hash(runtime)',
    '.review.reviewRuntimeIdentityHash==$runtimeHash',
    "runtime_identity_hash='${RUNTIME_IDENTITY_HASH}'",
):
    mutant = usage_e2e.replace(token, "REMOVED", 1)
    if mutant == usage_e2e:
        raise SystemExit(f"usage-review E2E mutant ineffective: {token}")

manager_live = manager.index('DEPLOYMENT_JSON="$(kubectl')
manager_lock = manager.index("FROM framework_runtime_release_state runtime", manager_live)
manager_insert = manager.index("INSERT INTO framework_simulation_run", manager_lock)
if not manager_live < manager_lock < manager_insert:
    raise SystemExit("manager delegation must prove live+locked DB runtime before simulation writes")

reg_capture = regulatory.index('RUNTIME_CONTRACT="$(bash')
reg_lock = regulatory.index("FROM framework_runtime_release_state runtime", reg_capture)
reg_insert = regulatory.index("INSERT INTO framework_simulation_run", reg_lock)
reg_job = regulatory.index("UPDATE framework_development_job", reg_insert)
if not reg_capture < reg_lock < reg_insert < reg_job:
    raise SystemExit("regulatory completion must capture/lock runtime before all authority writes")
PY

echo '[runtime-identity-authority-consumers-test] PASS Actor=locked+persisted+currentness manager=contracts3+live+DB regulatory=capture+DB-atomic automatic=2'
