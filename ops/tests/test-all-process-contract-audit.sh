#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SCRIPT="$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs"
WRAPPER="$ROOT/ops/scripts/resonance-all-process-contract-audit.sh"
PLAN="$ROOT/ops/scripts/plan-incremental-work.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for file in "$SCRIPT" "$WRAPPER" "$PLAN"; do
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
grep -q 'READ_ONLY_AUDIT_BUSINESS_PASS_REQUIRES_RECORDED_BUSINESS_RUN_NO_PROMOTION' "$SCRIPT"
node - "$SCRIPT" <<'NODE'
const fs = require("fs");
const source = fs.readFileSync(process.argv[2], "utf8");
if ((source.match(/method:\s*"POST"/g) || []).length !== 1 || !source.includes("/admin/login/actionLogin")) {
  throw new Error("the only POST allowed by the read-only audit is admin login");
}
if (/method:\s*"(?:PUT|PATCH|DELETE)"/.test(source) || /system-test-report\/audit|process-executions\/start|\/commands/.test(source)) {
  throw new Error("mutating endpoint detected in read-only audit");
}
NODE

cat > "$TMP/blocked.json" <<'JSON'
{
  "success": true,
  "summary": {
    "processCount": 2,
    "stepCount": 2,
    "routedStepCount": 2,
    "passedStepCount": 1,
    "blockedStepCount": 0,
    "notRunStepCount": 1,
    "verifiedContractCount": 1,
    "totalContractCount": 2
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
      "businessTestResult": "PASSED",
      "latestBusinessRunId": "BUSINESS-RUN-001",
      "businessCaseCode": "MEMBER_REGISTER_HAPPY",
      "businessCaseType": "HAPPY_PATH",
      "businessEvidenceJson": {"memberId": "MEMBER-001", "verified": true},
      "businessExecutedBy": "qa-member",
      "businessExecutedAt": "2026-08-07T09:00:01+09:00"
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
      "businessTestResult": "NOT_RUN"
    }
  ]
}
JSON

set +e
blocked_output="$(node "$SCRIPT" --fixture "$TMP/blocked.json" --skip-http-smoke)"
blocked_status=$?
set -e
[[ "$blocked_status" -eq 3 ]] || { echo "expected BLOCKED exit 3, got $blocked_status" >&2; exit 1; }
AUDIT_OUTPUT="$blocked_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "BLOCKED") throw new Error("expected BLOCKED status");
if (value.summary.processCount !== 2 || value.summary.stepCount !== 2) throw new Error("count contract mismatch");
if (value.summary.passCount !== 1 || value.summary.notRunCount !== 1) throw new Error("result contract mismatch");
if (value.summary.contractBlockedCount !== 0) throw new Error("valid contracts were blocked");
if (value.summary.contractTestPassedCount !== 1) throw new Error("contract test count mismatch");
if (value.auditMode !== "READ_ONLY_INVENTORY" || value.businessExecutionPerformed !== false || value.contractTestResultsAreNotBusinessTests !== true) {
  throw new Error("read-only audit semantics are ambiguous");
}
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
value.items[1].businessTestResult = "PASSED";
value.items[1].latestBusinessRunId = "BUSINESS-RUN-002";
value.items[1].businessCaseCode = "MEMBER_REVIEW_HAPPY";
value.items[1].businessCaseType = "HAPPY_PATH";
value.items[1].businessEvidenceJson = {decision: "APPROVED", verified: true};
value.items[1].businessExecutedBy = "qa-admin";
value.items[1].businessExecutedAt = "2026-08-07T09:01:01+09:00";
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/blocked.json" "$TMP/pass.json"
pass_output="$(SYSTEM_TEST_REPORT_FIXTURE="$TMP/pass.json" bash "$WRAPPER")"
AUDIT_OUTPUT="$pass_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "PASS") throw new Error("expected PASS status");
if (value.summary.passCount !== 2 || value.summary.blockedCount !== 0 || value.summary.notRunCount !== 0) {
  throw new Error("PASS/BLOCKED/NOT_RUN output contract mismatch");
}
NODE

node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items[1].businessTestResult = "NOT_RUN";
delete value.items[1].latestBusinessRunId;
delete value.items[1].businessCaseCode;
delete value.items[1].businessCaseType;
delete value.items[1].businessEvidenceJson;
delete value.items[1].businessExecutedBy;
delete value.items[1].businessExecutedAt;
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/pass.json" "$TMP/contract-only.json"
set +e
contract_only_output="$(node "$SCRIPT" --fixture "$TMP/contract-only.json" --skip-http-smoke)"
contract_only_status=$?
set -e
[[ "$contract_only_status" -eq 3 ]] || { echo "expected contract-only evidence exit 3, got $contract_only_status" >&2; exit 1; }
AUDIT_OUTPUT="$contract_only_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "BLOCKED") throw new Error("contract-only evidence must not pass business E2E");
if (value.summary.contractTestPassedCount !== 2 || value.summary.passCount !== 1 || value.summary.notRunCount !== 1) {
  throw new Error("contract and business evidence were conflated");
}
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

echo '[all-process-contract-audit-test] PASS fixtures=5 outputContract=PASS/BLOCKED/ERROR contractVsBusiness=PASS readOnly=PASS order=PASS routes=PASS ioContracts=PASS secretPolicy=kubernetes+exit2 noBuild=PASS'
