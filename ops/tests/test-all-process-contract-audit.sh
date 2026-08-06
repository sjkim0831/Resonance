#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SCRIPT="$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs"
WRAPPER="$ROOT/ops/scripts/resonance-all-process-contract-audit.sh"
PLAN="$ROOT/ops/scripts/plan-incremental-work.sh"
PANEL="$ROOT/projects/carbonet-frontend/source/src/features/actor-process-governance/SystemProcessTestReportPanel.tsx"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for file in "$SCRIPT" "$WRAPPER" "$PLAN" "$PANEL"; do
  [[ -f "$file" ]] || { echo "missing file: $file" >&2; exit 1; }
done

node - "$SCRIPT" "$WRAPPER" <<'NODE'
const fs = require("fs");
const source = process.argv.slice(2).map((file) => fs.readFileSync(file, "utf8")).join("\n");
const forbidden = [
  /rhdxhd/i,
  /qwer\d/i,
  /userPw\s*:\s*["'][^"'$]/i,
  /PASSWORD\s*=\s*["'][^"'$]/,
];
if (forbidden.some((pattern) => pattern.test(source))) {
  throw new Error("hardcoded credential pattern detected");
}
NODE
grep -q 'kubectl -n "$NAMESPACE" get secret "$SECRET_NAME"' "$WRAPPER"
grep -q 'CARBONET_ADMIN_AUDIT_SECRET:-carbonet-screen-smoke' "$WRAPPER"
grep -q 'AUDIT_ENGINE="${RESONANCE_AUDIT_ENGINE:-$SCRIPT_DIR/resonance-all-process-contract-audit.mjs}"' "$WRAPPER"
grep -q 'READ_ONLY_AUDIT_BUSINESS_PASS_REQUIRES_RECORDED_BUSINESS_RUN_NO_PROMOTION' "$SCRIPT"
node - "$SCRIPT" <<'NODE'
const fs = require("fs");
const source = fs.readFileSync(process.argv[2], "utf8");
if ((source.match(/method:\s*"POST"/g) || []).length !== 2
    || !source.includes("/admin/login/actionLogin")
    || !source.includes('const auditPath = `${reportPath}/audit`')) {
  throw new Error("the contract audit must POST only login and paged immutable-evidence refresh");
}
if (/method:\s*"(?:PUT|PATCH|DELETE)"/.test(source) || /process-executions\/start|\/commands/.test(source)) {
  throw new Error("business-mutating endpoint detected in contract audit");
}
for (const required of ["runContractAuditPages", "while (true)", "targetOffset", "maxTargets: auditPageSize", "nextTargetOffset", "contractAuditPagination", "reasonCounts", "samples=${JSON.stringify(samples)}"]) {
  if (!source.includes(required)) throw new Error(`paged contract audit guard missing: ${required}`);
}
NODE

node - "$PANEL" <<'NODE'
const fs = require("fs");
const source = fs.readFileSync(process.argv[2], "utf8");
for (const required of [
  "while (true)",
  "targetOffset, maxTargets: 250",
  "nextOffset <= targetOffset",
  "계약 감사 진행 중",
  "계약 감사 전체 페이지 완료",
  'if (outcome === "BLOCKED") finalOutcome = "BLOCKED"',
]) {
  if (!source.includes(required)) throw new Error(`frontend paged audit guard missing: ${required}`);
}
const loop = source.indexOf("while (true)");
const complete = source.indexOf("계약 감사 전체 페이지 완료", loop);
const reload = source.indexOf("await load()", complete);
if (loop < 0 || complete < loop || reload < complete) {
  throw new Error("frontend must announce completion and reload only after the full page loop");
}
NODE

cat > "$TMP/blocked.json" <<'JSON'
{
  "success": true,
  "businessFunctionsExecuted": false,
  "targetCount": 2,
  "auditedBindingCount": 2,
  "auditedCapabilityTargetCount": 2,
  "summary": {
    "processCount": 2,
    "stepCount": 2,
    "routedStepCount": 2,
    "passedStepCount": 1,
    "blockedStepCount": 0,
    "notRunStepCount": 1,
    "verifiedContractCount": 1,
    "totalContractCount": 2,
    "auditTargetCount": 2,
    "businessEvidenceStatus": "EVIDENCE_LEDGER_UNAVAILABLE"
  },
  "items": [
    {
      "developmentOrder": 1,
      "domainCode": "MEMBER",
      "processCode": "MEMBER_ONBOARDING",
      "processName": "회원 온보딩",
      "stepOrder": 1,
      "stepCode": "MEMBER_REGISTER",
      "stepName": "회원 등록",
      "actorCode": "MEMBER_APPLICANT",
      "commandCode": "REGISTER",
      "fromState": "DRAFT",
      "toState": "SUBMITTED",
      "completionRule": "필수 약관과 회원 정보가 저장된다.",
      "userPath": "/signup",
      "routePath": "/signup",
      "inputContract": {"required": ["memberName"]},
      "outputContract": {"memberId": "string"},
      "apiContract": ["POST /api/members"],
      "requiresUserPage": true,
      "latestResult": "PASSED",
      "latestRunId": "RUN-001",
      "latestInput": {"memberName": "QA member"},
      "latestOutput": {"memberId": "MEMBER-001"},
      "executedBy": "qa-member",
      "executedAt": "2026-08-07T09:00:00+09:00",
      "scenarioCount": 1,
      "latestSimulationRunId": "SIM-RUN-001",
      "simulationTestResult": "PASSED",
      "simulationCaseCode": "MEMBER_REGISTER_CONTRACT",
      "simulationCaseType": "CONTRACT_SIMULATION",
      "simulationTraceScope": "STEP",
      "simulationProcessVersion": 1,
      "simulationCurrentVersion": true,
      "simulationEvidenceJson": {"contractFingerprint": "fingerprint-001", "verified": true},
      "simulationExecutedBy": "qa-member",
      "simulationExecutedAt": "2026-08-07T09:00:01+09:00",
      "businessTestResult": "NOT_RUN",
      "businessEvidenceStatus": "EVIDENCE_LEDGER_UNAVAILABLE"
    },
    {
      "developmentOrder": 2,
      "domainCode": "MEMBER",
      "processCode": "MEMBER_APPROVAL",
      "processName": "회원 승인",
      "stepOrder": 1,
      "stepCode": "MEMBER_REVIEW",
      "stepName": "가입 검토",
      "actorCode": "MEMBER_ADMIN",
      "commandCode": "REVIEW",
      "fromState": "SUBMITTED",
      "toState": "REVIEWED",
      "completionRule": "검토 결과와 근거가 저장된다.",
      "adminPath": "/admin/member/list",
      "routePath": "/admin/member/list",
      "inputContract": {"memberId": "string"},
      "outputContract": {"decision": "string"},
      "apiContract": ["POST /admin/api/members/review"],
      "requiresAdminPage": true,
      "latestResult": "NOT_RUN",
      "latestSimulationRunId": 0,
      "simulationTestResult": "NOT_RUN",
      "simulationCaseCode": "",
      "simulationCaseType": "",
      "simulationTraceScope": "",
      "simulationProcessVersion": 0,
      "simulationCurrentVersion": false,
      "simulationEvidenceJson": {},
      "simulationExecutedBy": "",
      "simulationExecutedAt": "",
      "businessTestResult": "NOT_RUN",
      "businessEvidenceStatus": "EVIDENCE_LEDGER_UNAVAILABLE"
    }
  ]
}
JSON

set +e
blocked_output="$(node "$SCRIPT" --fixture "$TMP/blocked.json" --skip-http-smoke)"
blocked_status=$?
set -e
[[ "$blocked_status" -eq 3 ]] || { echo "expected BLOCKED exit 3, got $blocked_status" >&2; exit 1; }
mkdir -p "$TMP/portable-control-plane"
cp "$WRAPPER" "$TMP/portable-control-plane/resonance-all-process-contract-audit.sh"
cp "$SCRIPT" "$TMP/portable-control-plane/resonance-all-process-contract-audit.mjs"
set +e
SYSTEM_TEST_REPORT_FIXTURE="$TMP/blocked.json" \
  bash "$TMP/portable-control-plane/resonance-all-process-contract-audit.sh" >/dev/null
portable_status=$?
set -e
[[ "$portable_status" -eq 3 ]] || { echo "installed sibling engine lookup returned $portable_status instead of 3" >&2; exit 1; }
AUDIT_OUTPUT="$blocked_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "BLOCKED") throw new Error("expected BLOCKED status");
if (value.summary.processCount !== 2 || value.summary.stepCount !== 2) throw new Error("count contract mismatch");
if (value.summary.passCount !== 1 || value.summary.notRunCount !== 1) throw new Error("result contract mismatch");
if (value.summary.contractBlockedCount !== 0) throw new Error("valid contracts were blocked");
if (value.summary.contractTestPassedCount !== 1) throw new Error("contract test count mismatch");
if (value.auditMode !== "READ_ONLY_INVENTORY" || value.businessExecutionPerformed !== false || value.businessFunctionsExecuted !== false || value.contractTestResultsAreNotBusinessTests !== true) {
  throw new Error("read-only audit semantics are ambiguous");
}
if (value.auditCoverage.targetCount !== 2 || value.auditCoverage.auditedBindingCount !== 2 || value.auditCoverage.auditedCapabilityTargetCount !== 2) throw new Error("audit target coverage mismatch");
if (value.summary.recordedBusinessNotRunCount !== 2 || value.summary.recordedBusinessPassCount !== 0) throw new Error("real business E2E must remain NOT_RUN");
if (value.summary.simulationPassedCount !== 1 || value.summary.simulationNotRunCount !== 1) throw new Error("simulation evidence summary mismatch");
if (value.evidencePolicy !== "READ_ONLY_AUDIT_BUSINESS_PASS_REQUIRES_RECORDED_BUSINESS_RUN_NO_PROMOTION") throw new Error("unsafe evidence policy");
NODE

node -e '
const fs = require("fs");
const path = process.argv[1];
const value = JSON.parse(fs.readFileSync(path, "utf8"));
value.summary.passedStepCount = 2;
value.summary.notRunStepCount = 0;
value.summary.verifiedContractCount = 2;
value.items[1].latestResult = "PASSED";
value.items[1].latestRunId = "RUN-002";
value.items[1].latestInput = {memberId: "MEMBER-001"};
value.items[1].latestOutput = {decision: "APPROVED"};
value.items[1].executedBy = "qa-admin";
value.items[1].executedAt = "2026-08-07T09:01:00+09:00";
value.items[1].scenarioCount = 1;
value.items[1].latestSimulationRunId = "SIM-RUN-002";
value.items[1].simulationTestResult = "PASSED";
value.items[1].simulationCaseCode = "MEMBER_REVIEW_CONTRACT";
value.items[1].simulationCaseType = "CONTRACT_SIMULATION";
value.items[1].simulationTraceScope = "STEP";
value.items[1].simulationProcessVersion = 1;
value.items[1].simulationCurrentVersion = true;
value.items[1].simulationEvidenceJson = {contractFingerprint: "fingerprint-002", verified: true};
value.items[1].simulationExecutedBy = "qa-admin";
value.items[1].simulationExecutedAt = "2026-08-07T09:01:01+09:00";
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/blocked.json" "$TMP/pass.json"
pass_output="$(SYSTEM_TEST_REPORT_FIXTURE="$TMP/pass.json" bash "$WRAPPER")"
AUDIT_OUTPUT="$pass_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "PASS") throw new Error("expected PASS status");
if (value.summary.passCount !== 2 || value.summary.blockedCount !== 0 || value.summary.notRunCount !== 0) {
  throw new Error("PASS/BLOCKED/NOT_RUN output contract mismatch");
}
if (value.summary.recordedBusinessNotRunCount !== 2 || value.summary.recordedBusinessPassCount !== 0) throw new Error("contract simulations were promoted to real business E2E");
if (value.summary.simulationPassedCount !== 2 || value.summary.simulationNotRunCount !== 0) throw new Error("simulation evidence was not counted separately");
NODE

node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items[1].businessTestResult = "PASSED";
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/pass.json" "$TMP/unsafe-business-promotion.json"
set +e
unsafe_business_output="$(node "$SCRIPT" --fixture "$TMP/unsafe-business-promotion.json" --skip-http-smoke)"
unsafe_business_status=$?
set -e
[[ "$unsafe_business_status" -eq 3 ]] || { echo "expected unsafe business promotion exit 3, got $unsafe_business_status" >&2; exit 1; }
AUDIT_OUTPUT="$unsafe_business_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "BLOCKED") throw new Error("unsafe business promotion must be blocked");
if (value.summary.contractTestPassedCount !== 2 || value.summary.recordedBusinessPassCount !== 1) throw new Error("contract and business evidence separation mismatch");
if (!value.validation.issueCounts.BUSINESS_RESULT_MUST_REMAIN_NOT_RUN) throw new Error("unsafe business result was not identified");
NODE

node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items[0].simulationCurrentVersion = false;
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/pass.json" "$TMP/stale-simulation.json"
set +e
stale_simulation_output="$(node "$SCRIPT" --fixture "$TMP/stale-simulation.json" --skip-http-smoke)"
stale_simulation_status=$?
set -e
[[ "$stale_simulation_status" -eq 3 ]] || { echo "expected stale simulation exit 3, got $stale_simulation_status" >&2; exit 1; }
AUDIT_OUTPUT="$stale_simulation_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "BLOCKED" || !value.validation.issueCounts.SIMULATION_STALE_CONTRACT_VERSION) throw new Error("stale simulation PASS was not invalidated");
NODE

mkdir -p "$TMP/bin"
cat > "$TMP/bin/kubectl" <<'SH'
#!/usr/bin/env bash
exit 1
SH
chmod +x "$TMP/bin/kubectl"
set +e
secret_error="$(SYSTEM_TEST_REPORT_FIXTURE= PATH="$TMP/bin:$PATH" bash "$WRAPPER" 2>&1)"
secret_status=$?
set -e
[[ "$secret_status" -eq 2 ]] || { echo "expected secret read ERROR exit 2, got $secret_status" >&2; exit 1; }
grep -q 'unable to read admin username secret' <<<"$secret_error"
if grep -Eiq 'password=.*|userPw|authorization:|accessToken' <<<"$secret_error"; then
  echo 'secret error output exposed credential material' >&2
  exit 1
fi

node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items.push({
  ...value.items[0],
  stepCode: "MEMBER_CONFIRM",
  stepName: "회원 등록 확인",
  stepOrder: 0,
  userPath: "",
  routePath: "",
  outputContract: null,
  latestResult: "PASSED",
});
Object.assign(value.summary, {
  stepCount: 3,
  routedStepCount: 2,
  passedStepCount: 3,
  verifiedContractCount: 2,
  totalContractCount: 3,
});
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/pass.json" "$TMP/invalid.json"
set +e
invalid_output="$(node "$SCRIPT" --fixture "$TMP/invalid.json" --skip-http-smoke)"
invalid_status=$?
set -e
[[ "$invalid_status" -eq 3 ]] || { echo "expected invalid contract exit 3, got $invalid_status" >&2; exit 1; }
AUDIT_OUTPUT="$invalid_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
const issues = value.validation.issueCounts;
if (value.status !== "BLOCKED" || value.summary.contractBlockedCount !== 1) throw new Error("invalid contract was not blocked");
for (const code of ["STEP_ORDER_INVALID", "STEP_ORDER_NOT_ASCENDING", "OUTPUT_CONTRACT_MISSING", "USER_ROUTE_MISSING", "ROUTE_MISSING"]) {
  if (!issues[code]) throw new Error(`missing validator evidence: ${code}`);
}
NODE

set +e
error_output="$(node "$SCRIPT" --fixture "$TMP/missing.json" --skip-http-smoke 2>/dev/null)"
error_status=$?
set -e
[[ "$error_status" -eq 2 ]] || { echo "expected ERROR exit 2, got $error_status" >&2; exit 1; }
AUDIT_OUTPUT="$error_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "ERROR" || value.errorCode !== "AUDIT_EXECUTION_FAILED") throw new Error("ERROR output contract mismatch");
NODE

mkdir -p "$TMP/plan/ops/scripts"
cp "$PLAN" "$TMP/plan/ops/scripts/plan-incremental-work.sh"
(
  cd "$TMP/plan"
  git init -q
  git config user.email audit-test@example.invalid
  git config user.name audit-test
  git add ops/scripts/plan-incremental-work.sh
  git commit -qm baseline
  printf '#!/usr/bin/env bash\n' > ops/scripts/new-audit-only.sh
  git add ops/scripts/new-audit-only.sh
  git commit -qm audit
  plan_output="$(bash ops/scripts/plan-incremental-work.sh HEAD^ HEAD)"
  grep -q 'runtime=false frontend=false backend=false database=false infrastructure=true' <<<"$plan_output"
  grep -q 'reasons=automation-only' <<<"$plan_output"
)

echo '[all-process-contract-audit-test] PASS fixtures=6 outputContract=PASS/BLOCKED/ERROR contractVsBusiness=PASS staleSimulation=PASS pagedContractEvidence=PASS order=PASS routes=PASS ioContracts=PASS secretPolicy=kubernetes+exit2 noBuild=PASS'
