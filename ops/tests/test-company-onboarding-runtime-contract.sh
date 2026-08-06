#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260807061000__align_company_onboarding_runtime_contract.sql"
HARNESS="$ROOT/ops/scripts/resonance-company-onboarding-e2e.mjs"
WRAPPER="$ROOT/ops/tests/run-company-onboarding-business-e2e.sh"
CAPTURE="$ROOT/ops/scripts/capture-business-e2e-contract.sh"
SELF="$ROOT/ops/tests/test-company-onboarding-runtime-contract.sh"

for file in "$MIGRATION" "$HARNESS" "$WRAPPER" "$CAPTURE"; do
  [[ -f "$file" ]] || { echo "[company-onboarding-contract-test] missing: $file" >&2; exit 1; }
done

# Syntax is checked before any semantic assertion so a malformed harness can
# never be mistaken for a missing business assertion.
bash -n "$SELF" "$WRAPPER" "$CAPTURE"
node --check "$HARNESS"

node - "$MIGRATION" "$HARNESS" "$WRAPPER" "$CAPTURE" <<'NODE'
const fs = require('fs');

const [migrationPath, harnessPath, wrapperPath, capturePath] = process.argv.slice(2);
const migration = fs.readFileSync(migrationPath, 'utf8');
const harness = fs.readFileSync(harnessPath, 'utf8');
const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const capture = fs.readFileSync(capturePath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const stepCodes = [
  'COMPANY_ONBOARDING_APPLY',
  'COMPANY_ONBOARDING_APPROVE',
  'COMPANY_ONBOARDING_SITE',
  'COMPANY_ONBOARDING_ACTORS',
  'COMPANY_ONBOARDING_READY',
];
const caseCodes = [
  'COMPANY_ONBOARDING_HAPPY',
  'COMPANY_ONBOARDING_NO_COMPANY',
  'COMPANY_ONBOARDING_NO_SITE',
  'COMPANY_ONBOARDING_ROLE_GAP',
  'COMPANY_ONBOARDING_SOD',
  'COMPANY_ONBOARDING_TENANT',
  'COMPANY_ONBOARDING_RETRY',
];

assert(/process_version\s*=\s*'2\.0\.1'/i.test(migration), 'migration must version the aligned contract as 2.0.1');
assert(/owner_actor_code\s*=\s*'COMPANY_MANAGER'/i.test(migration), 'COMPANY_MANAGER must own the active onboarding contract');
assert(migration.includes("WHEN 'COMPANY_MANAGER' THEN '기업 업무 책임자'"), 'COMPANY_MANAGER Korean display name is missing');
assert(migration.includes("WHEN 'VERIFIER' THEN '검증 담당자'"), 'VERIFIER Korean display name is missing');

const approveRoute = '/admin/api/admin/member/company-approve/action';
const actorRoute = '/admin/api/system/actor-process/assignments';
assert(migration.includes(approveRoute), `corrected approval route missing: ${approveRoute}`);
assert(migration.includes(actorRoute), `corrected assignment route missing: ${actorRoute}`);
assert(!/s\.api_contract\s*<>\s*'POST \/api\/admin\/member\/company-approve\/action'/i.test(migration), 'stale approval route remains an asserted current step contract');
assert(!/s\.api_contract\s*<>\s*'POST \/api\/admin\/system\/actor-process\/assign'/i.test(migration), 'stale actor route remains an asserted current step contract');

const projectOperationsSource = 'projects/carbonet-frontend/source/src/features/emission-project-list/AdminEmissionProjectOperationsPage.tsx';
assert(migration.includes(projectOperationsSource), 'actual project-operations source is not bound in the design ledger');
assert(/step_count\s*<>\s*5/i.test(migration), 'migration must assert exactly 5 process steps');
assert(/case_count\s*<>\s*7/i.test(migration), 'migration must assert exactly 7 automated cases');
assert(/job_status\s*=\s*'PLANNED'/i.test(migration) && /planned_job_count\s*<>\s*60/i.test(migration), 'migration must preserve and assert all 60 jobs as PLANNED');

assert(!/INSERT\s+INTO\s+framework_process_qa_run/i.test(migration), 'migration must not forge BUSINESS_E2E evidence');
assert(!/UPDATE\s+framework_process_qa_run/i.test(migration), 'migration must not mutate BUSINESS_E2E evidence');
assert(!/UPDATE\s+framework_development_job[\s\S]*?job_status\s*=\s*'VERIFIED'/i.test(migration), 'migration must not promote development jobs to VERIFIED');

for (const code of [...stepCodes, ...caseCodes]) {
  assert(harness.includes(code), `harness is missing ${code}`);
}
assert(!/qwer1234/i.test(harness), 'harness contains a hardcoded password');
assert(!/(?:password|passwd|userPw)\s*[:=]\s*['"][^'"$\n]{3,}['"]/i.test(harness), 'harness appears to contain a literal password');
assert(harness.includes('CARBONET_ADMIN_TEST_PASSWORD'), 'admin password must come from CARBONET_ADMIN_TEST_PASSWORD');
assert(harness.includes('CARBONET_ACTOR_TEST_PASSWORD'), 'actor password must come from CARBONET_ACTOR_TEST_PASSWORD');
assert(harness.includes('--self-test'), 'harness must expose a non-mutating --self-test');

const cleanupTables = [
  'framework_account_actor_assignment',
  'emission_site_registry',
  'comtnauthtokenstore',
  'comtnloginhist',
  'comtnemplyrscrtyestbs',
  'comtnemplyrinfo',
  'audit_event',
  'comtninsttfile',
  'comtninsttinfo',
];
for (const table of cleanupTables) {
  assert(harness.toLowerCase().includes(table), `fixture cleanup/reread is missing table ${table}`);
}
assert(
  /\.delete\s*\(\s*`?\/home\/api\/emission-projects\//i.test(harness)
    || /method\s*:\s*['"]DELETE['"][\s\S]{0,240}\/home\/api\/emission-projects\//i.test(harness),
  'fixture project cleanup must use the real DELETE endpoint',
);

assert(wrapper.includes('capture-business-e2e-contract.sh'), 'wrapper must capture immutable current-version contracts');
assert(capture.includes('[[ "$PROCESS_CODE" =~ ^[A-Z0-9_]+$ && "$STEP_CODE" =~ ^[A-Z0-9_]+$ ]]'), 'contract capture must validate identifiers before SQL interpolation');
assert(!capture.includes(":'step_code'") && !capture.includes(":'process_code'"), 'contract capture must not rely on unsupported psql variable expansion inside -c');
assert(capture.includes("framework_current_process_step_contract_fingerprint(p.process_code,'$STEP_CODE')"), 'contract capture must query the validated step code');
assert(wrapper.includes('promote-screen-contract-after-e2e.sh'), 'wrapper must use the common BUSINESS_E2E promoter');
assert(wrapper.includes('--validate-only'), 'wrapper must validate all evidence before promotion');
for (const code of stepCodes) {
  assert(wrapper.includes(code), `wrapper is missing contract capture/promotion step ${code}`);
}
const capturePosition = wrapper.indexOf('capture-business-e2e-contract.sh');
const validatePosition = wrapper.indexOf('--validate-only');
const promoterPositions = [...wrapper.matchAll(/promote-screen-contract-after-e2e\.sh/g)].map((match) => match.index);
assert(capturePosition >= 0 && validatePosition > capturePosition, 'contract capture must precede promoter validation');
assert(promoterPositions.length >= 1, 'common promoter invocation missing');
assert(/contracts[^\n]{0,80}(?:length|count)[^\n]{0,40}5/i.test(harness + '\n' + wrapper) || /stepCodes[^\n]{0,120}5/i.test(harness + '\n' + wrapper), 'E2E evidence must assert exactly 5 captured contracts');
assert(/promotionEligible\s*[:=][^\n]{0,20}false/i.test(harness), 'self-test/failure path must be ineligible for promotion');
assert(/status\s*[:=]\s*['"]SELF_TEST_PASS['"]/i.test(harness), 'self-test must be explicitly distinguishable from BUSINESS_E2E PASS');
NODE

self_test_output="$(node "$HARNESS" --self-test)"
SELF_TEST_OUTPUT="$self_test_output" node <<'NODE'
const raw = process.env.SELF_TEST_OUTPUT || '';
const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
let result;
for (let index = lines.length - 1; index >= 0; index -= 1) {
  try {
    result = JSON.parse(lines[index]);
    break;
  } catch (_) {
    // A harness may log diagnostics, but its final machine record must be JSON.
  }
}
if (!result) throw new Error('self-test did not emit a JSON record');
if (result.status !== 'SELF_TEST_PASS') throw new Error(`unexpected self-test status: ${result.status}`);
if (result.promotionEligible !== false) throw new Error('self-test evidence must never be promotion eligible');
if (result.processCode !== 'COMPANY_ONBOARDING') throw new Error(`unexpected processCode: ${result.processCode}`);
if (result.stepCount !== 5) throw new Error(`expected 5 steps, found ${result.stepCount}`);
if (result.caseCount !== 7) throw new Error(`expected 7 cases, found ${result.caseCount}`);

const expectedSteps = [
  'COMPANY_ONBOARDING_APPLY',
  'COMPANY_ONBOARDING_APPROVE',
  'COMPANY_ONBOARDING_SITE',
  'COMPANY_ONBOARDING_ACTORS',
  'COMPANY_ONBOARDING_READY',
];
const expectedCases = [
  'COMPANY_ONBOARDING_HAPPY',
  'COMPANY_ONBOARDING_NO_COMPANY',
  'COMPANY_ONBOARDING_NO_SITE',
  'COMPANY_ONBOARDING_ROLE_GAP',
  'COMPANY_ONBOARDING_SOD',
  'COMPANY_ONBOARDING_TENANT',
  'COMPANY_ONBOARDING_RETRY',
];
const normalized = (value) => [...new Set(value || [])].sort();
if (JSON.stringify(normalized(result.stepCodes)) !== JSON.stringify(normalized(expectedSteps))) {
  throw new Error(`self-test stepCodes are not the exact 5-step contract: ${JSON.stringify(result.stepCodes)}`);
}
if (JSON.stringify(normalized(result.caseCodes)) !== JSON.stringify(normalized(expectedCases))) {
  throw new Error(`self-test caseCodes are not the exact 7-case contract: ${JSON.stringify(result.caseCodes)}`);
}
NODE

echo '[company-onboarding-contract-test] PASS steps=5 cases=7 plannedJobs=60 routes=aligned fixture=cleanup+reread promotion=fail-closed'
