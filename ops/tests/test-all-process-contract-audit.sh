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
grep -q 'READ_ONLY_AUDIT_NO_BUSINESS_PASS_PROMOTION' "$SCRIPT"

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
      "scenarioCount": 1
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
      "latestResult": "NOT_RUN"
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
if (value.evidencePolicy !== "READ_ONLY_AUDIT_NO_BUSINESS_PASS_PROMOTION") throw new Error("unsafe evidence policy");
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

echo '[all-process-contract-audit-test] PASS fixtures=3 outputContract=PASS/BLOCKED order=PASS routes=PASS ioContracts=PASS secretPolicy=kubernetes noBuild=PASS'
