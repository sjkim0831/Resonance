#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SCRIPT="$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs"
WRAPPER="$ROOT/ops/scripts/resonance-all-process-contract-audit.sh"
PLAN="$ROOT/ops/scripts/plan-incremental-work.sh"
PANEL="$ROOT/projects/carbonet-frontend/source/src/features/actor-process-governance/SystemProcessTestReportPanel.tsx"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for file in "$SCRIPT" "$WRAPPER" "$PLAN" "$PANEL" "$SERVICE"; do
  [[ -f "$file" ]] || { echo "missing file: $file" >&2; exit 1; }
done

python3 - "$SERVICE" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
for required in (
    'order by p.domain_order,p.development_order,p.process_code,p.step_order',
    '"scope","WORK_TYPE_PROCESS_STEP"',
    'List.of("domainOrder","developmentOrder","processCode","stepOrder")',
):
    if required not in source:
        raise SystemExit(f"system-test-report canonical order contract missing: {required}")
PY

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
grep -q 'READ_ONLY_AUDIT_BUSINESS_PASS_REQUIRES_CURRENT_VERSION_LEDGER_NO_PROMOTION' "$SCRIPT"
node - "$SCRIPT" <<'NODE'
const fs = require("fs");
const source = fs.readFileSync(process.argv[2], "utf8");
if ((source.match(/method:\s*"POST"/g) || []).length !== 2
    || !source.includes("/admin/login/actionLogin")
    || !source.includes('const auditPath = `${reportPath}/audit`')
    || !source.includes('const compactReportPath = `${reportPath}?compact=true`')
    || !source.includes('fetch(`${baseUrl}${compactReportPath}`')) {
  throw new Error("the contract audit must POST only login and paged immutable-evidence refresh");
}
if (/method:\s*"(?:PUT|PATCH|DELETE)"/.test(source) || /process-executions\/start|\/commands/.test(source)) {
  throw new Error("business-mutating endpoint detected in contract audit");
}
for (const required of ["runContractAuditPages", "while (true)", "targetOffset", "maxTargets: auditPageSize", "compact: true", "nextTargetOffset", "contractAuditPagination", "errorSamples", "reasonCounts", "samples=${JSON.stringify(samples)}"]) {
  if (!source.includes(required)) throw new Error(`paged contract audit guard missing: ${required}`);
}
for (const required of ["--deployment-preflight", "SYSTEM_TEST_REPORT_DEPLOYMENT_PREFLIGHT", "AUTHENTICATED_COMPACT_REPORT_DEPLOYMENT_PREFLIGHT", "DEPLOYMENT_PREFLIGHT_COMPACT_REPORT_VALIDATION"]) {
  if (!source.includes(required)) throw new Error(`deployment preflight guard missing: ${required}`);
}
for (const required of ["availableParallelism", "adaptiveSmokeConcurrency", "Math.min(24", "route-smoke progress=", "requestsPerSecond"]) {
  if (!source.includes(required)) throw new Error(`adaptive route-smoke guard missing: ${required}`);
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
  "orderContract": {
    "scope": "WORK_TYPE_PROCESS_STEP",
    "fields": ["domainOrder", "developmentOrder", "processCode", "stepOrder"],
    "direction": "ASC"
  },
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
    "businessEvidenceStatus": "NO_CURRENT_VERSION_EVIDENCE"
  },
  "items": [
    {
      "domainOrder": 10,
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
      "businessEvidenceStatus": "NO_CURRENT_VERSION_EVIDENCE"
    },
    {
      "domainOrder": 10,
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
      "businessEvidenceStatus": "NO_CURRENT_VERSION_EVIDENCE"
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
if (value.evidencePolicy !== "READ_ONLY_AUDIT_BUSINESS_PASS_REQUIRES_CURRENT_VERSION_LEDGER_NO_PROMOTION") throw new Error("unsafe evidence policy");
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

# development_order is canonical only inside a work type.  The API first
# groups by business-work-type sort order, so a lower development order after
# a work-type boundary is valid and must not be reported as an ordering defect.
node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items[0].domainOrder = 10;
value.items[0].developmentOrder = 999;
value.items[1].domainCode = "LCA";
value.items[1].domainOrder = 20;
value.items[1].developmentOrder = 1;
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/pass.json" "$TMP/work-type-boundary-pass.json"
boundary_output="$(node "$SCRIPT" --fixture "$TMP/work-type-boundary-pass.json" --skip-http-smoke)"
AUDIT_OUTPUT="$boundary_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "PASS") throw new Error(`work-type boundary reset was rejected: ${JSON.stringify(value.validation)}`);
if (value.validation.orderViolationCount !== 0 || value.validation.issueCounts.PROCESS_ORDER_NOT_ASCENDING) {
  throw new Error("development order was incorrectly treated as globally monotonic");
}
NODE

# A real inversion inside the same work type remains blocked, proving that
# the boundary fix does not weaken the canonical ordering check.
node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items[0].domainOrder = 10;
value.items[0].developmentOrder = 2;
value.items[1].domainOrder = 10;
value.items[1].developmentOrder = 1;
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/pass.json" "$TMP/within-work-type-order-blocked.json"
set +e
within_domain_output="$(node "$SCRIPT" --fixture "$TMP/within-work-type-order-blocked.json" --skip-http-smoke)"
within_domain_status=$?
set -e
[[ "$within_domain_status" -eq 3 ]] || { echo "expected same-work-type order BLOCKED exit 3, got $within_domain_status" >&2; exit 1; }
AUDIT_OUTPUT="$within_domain_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
const violation = value.validation.orderViolations.find((entry) => entry.type === "PROCESS");
if (value.status !== "BLOCKED" || value.validation.issueCounts.PROCESS_ORDER_NOT_ASCENDING !== 1) {
  throw new Error("same-work-type process order inversion was not blocked");
}
if (!violation || violation.previousDevelopmentOrder !== 2 || violation.developmentOrder !== 1
    || violation.previousDomainOrder !== 10 || violation.domainOrder !== 10) {
  throw new Error(`canonical order evidence is incomplete: ${JSON.stringify(violation)}`);
}
NODE

# Prove the deployed preflight performs authenticated compact GET validation
# without the expensive evidence-refresh POST, while the normal/hourly mode
# still executes that POST.  This is behavioral coverage rather than a grep-only
# assertion so a future refactor cannot silently reintroduce the deployment wait.
node - "$SCRIPT" "$TMP/pass.json" <<'NODE'
const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");

const [script, fixturePath] = process.argv.slice(2);
const fixture = fs.readFileSync(fixturePath);
let loginRequests = 0;
let compactGetRequests = 0;
let evidenceRefreshRequests = 0;
let compactEvidenceRefreshRequests = 0;

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/admin/login/actionLogin") {
    loginRequests += 1;
    request.resume();
    response.writeHead(200, {
      "content-type": "application/json",
      "set-cookie": "JSESSIONID=contract-audit-fixture; Path=/; HttpOnly",
    });
    response.end(JSON.stringify({ status: "loginSuccess" }));
    return;
  }
  if (request.method === "POST" && request.url === "/admin/api/system/actor-process/system-test-report/audit") {
    evidenceRefreshRequests += 1;
    let requestBody = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { requestBody += chunk; });
    request.on("end", () => {
      const parsed = JSON.parse(requestBody || "{}");
      if (parsed.compact === true) compactEvidenceRefreshRequests += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        success: true,
        businessFunctionsExecuted: false,
        compact: true,
        outcome: "PASS",
        targetCount: 2,
        passedCount: 2,
        blockedCount: 0,
        errorCount: 0,
        runCount: 2,
        runsOmittedCount: 2,
        reasonCounts: {},
        errorSamples: [],
        runs: [],
        hasMore: false,
      }));
    });
    return;
  }
  if (request.method === "GET" && request.url === "/admin/api/system/actor-process/system-test-report?compact=true") {
    compactGetRequests += 1;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(fixture);
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

function runAudit(baseUrl, deploymentPreflight) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      env: {
        ...process.env,
        CARBONET_RUNTIME_BASE_URL: baseUrl,
        CARBONET_ADMIN_AUDIT_USER: "fixture-user",
        CARBONET_ADMIN_AUDIT_PASSWORD: "fixture-password",
        SYSTEM_TEST_REPORT_SKIP_HTTP_SMOKE: "1",
        SYSTEM_TEST_REPORT_DEPLOYMENT_PREFLIGHT: deploymentPreflight ? "1" : "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`audit exited ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (error) {
        reject(new Error(`invalid audit output: ${error.message}`));
      }
    });
  });
}

server.listen(0, "127.0.0.1", async () => {
  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const preflight = await runAudit(baseUrl, true);
    if (preflight.authenticated !== true || preflight.deploymentPreflight !== true) throw new Error("deployment preflight was not authenticated");
    if (preflight.auditMode !== "AUTHENTICATED_COMPACT_REPORT_DEPLOYMENT_PREFLIGHT") throw new Error("deployment preflight audit mode mismatch");
    if (preflight.contractAuditPagination?.skipped !== true || preflight.contractAuditPagination?.reason !== "DEPLOYMENT_PREFLIGHT_COMPACT_REPORT_VALIDATION") {
      throw new Error("deployment preflight did not report the deliberate refresh skip");
    }
    if (loginRequests !== 1 || compactGetRequests !== 1 || evidenceRefreshRequests !== 0) {
      throw new Error(`deployment preflight request mismatch login=${loginRequests} compact=${compactGetRequests} refresh=${evidenceRefreshRequests}`);
    }

    const hourly = await runAudit(baseUrl, false);
    if (hourly.authenticated !== true || hourly.deploymentPreflight !== false) throw new Error("normal hourly mode identity mismatch");
    if (hourly.auditMode !== "CONTRACT_EVIDENCE_REFRESH_AND_READ_ONLY_INVENTORY") throw new Error("hourly mode no longer performs the full audit");
    if (hourly.contractAuditPagination?.skipped !== false || hourly.contractAuditPagination?.complete !== true) {
      throw new Error("hourly mode did not complete evidence refresh");
    }
    if (loginRequests !== 2 || compactGetRequests !== 2 || evidenceRefreshRequests !== 1 || compactEvidenceRefreshRequests !== 1) {
      throw new Error(`hourly request mismatch login=${loginRequests} compact=${compactGetRequests} refresh=${evidenceRefreshRequests} compactRefresh=${compactEvidenceRefreshRequests}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
NODE

node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const [index,item] of value.items.entries()) {
  const fingerprint = `0123456789abcdef0123456789abcde${index}`;
  item.processVersion = "1.0.0";
  item.businessTestResult = "PASSED";
  item.businessEvidenceStatus = "CURRENT_VERSION_PASS";
  item.businessCurrentVersion = true;
  item.businessProcessVersion = "1.0.0";
  item.businessContractFingerprint = fingerprint;
  item.currentBusinessContractFingerprint = fingerprint;
  item.businessSourceCommit = "0123456789abcdef0123456789abcdef01234567";
  item.currentRuntimeSourceCommit = "0123456789abcdef0123456789abcdef01234567";
  item.businessEvidenceHash = "a".repeat(64);
  item.businessExecutionEnvironment = "contract-test";
  item.businessEvidenceUri = `inline://business-e2e/${index}`;
  item.businessEvidenceJson = { verified: true, index };
  item.businessExecutedBy = "business-e2e-runner";
  item.businessExecutedAt = "2026-08-07T09:02:00+09:00";
}
value.summary.businessEvidenceStatus = "CURRENT_VERSION_PASS";
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/pass.json" "$TMP/current-business-e2e.json"
current_business_output="$(node "$SCRIPT" --fixture "$TMP/current-business-e2e.json" --skip-http-smoke)"
AUDIT_OUTPUT="$current_business_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "PASS" || value.summary.recordedBusinessPassCount !== 2) throw new Error("current-version business E2E was not accepted");
NODE

node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items[0].businessTestResult = "BLOCKED";
value.items[0].businessEvidenceStatus = "CURRENT_VERSION_FAILED";
value.summary.businessEvidenceStatus = "CURRENT_VERSION_FAILED";
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/current-business-e2e.json" "$TMP/current-business-e2e-failed.json"
set +e
current_business_failed_output="$(node "$SCRIPT" --fixture "$TMP/current-business-e2e-failed.json" --skip-http-smoke)"
current_business_failed_status=$?
set -e
[[ "$current_business_failed_status" -eq 3 ]] || { echo "expected current business failure exit 3, got $current_business_failed_status" >&2; exit 1; }
AUDIT_OUTPUT="$current_business_failed_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "BLOCKED" || value.summary.recordedBusinessBlockedCount !== 1) throw new Error("current-version failed business E2E was not blocking");
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
if (!value.validation.issueCounts.BUSINESS_EVIDENCE_STALE_CONTRACT_VERSION || !value.validation.issueCounts.BUSINESS_EVIDENCE_FINGERPRINT_MISMATCH) throw new Error("unbound business result was not rejected");
NODE

node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items[0].businessEvidenceStatus = "CONTRACT_FINGERPRINT_UNAVAILABLE";
value.summary.businessEvidenceStatus = "CONTRACT_FINGERPRINT_UNAVAILABLE";
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/pass.json" "$TMP/fingerprint-unavailable.json"
set +e
fingerprint_unavailable_output="$(node "$SCRIPT" --fixture "$TMP/fingerprint-unavailable.json" --skip-http-smoke)"
fingerprint_unavailable_status=$?
set -e
[[ "$fingerprint_unavailable_status" -eq 3 ]] || { echo "expected unavailable fingerprint exit 3, got $fingerprint_unavailable_status" >&2; exit 1; }
AUDIT_OUTPUT="$fingerprint_unavailable_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "BLOCKED" || !value.validation.issueCounts.BUSINESS_CONTRACT_FINGERPRINT_UNAVAILABLE) throw new Error("missing contract fingerprint did not fail closed");
NODE

node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items[0].businessEvidenceStatus = "RUNTIME_COMMIT_UNAVAILABLE";
value.items[0].currentRuntimeSourceCommit = "";
value.summary.businessEvidenceStatus = "RUNTIME_COMMIT_UNAVAILABLE";
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/pass.json" "$TMP/runtime-commit-unavailable.json"
set +e
runtime_commit_unavailable_output="$(node "$SCRIPT" --fixture "$TMP/runtime-commit-unavailable.json" --skip-http-smoke)"
runtime_commit_unavailable_status=$?
set -e
[[ "$runtime_commit_unavailable_status" -eq 3 ]] || { echo "expected unavailable runtime commit exit 3, got $runtime_commit_unavailable_status" >&2; exit 1; }
AUDIT_OUTPUT="$runtime_commit_unavailable_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "BLOCKED" || !value.validation.issueCounts.BUSINESS_RUNTIME_COMMIT_UNAVAILABLE) throw new Error("missing runtime commit did not fail closed");
NODE

node -e '
const fs = require("fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
value.items[0].currentRuntimeSourceCommit = "fedcba9876543210fedcba9876543210fedcba98";
fs.writeFileSync(process.argv[2], JSON.stringify(value));
' "$TMP/current-business-e2e.json" "$TMP/runtime-commit-mismatch.json"
set +e
runtime_commit_mismatch_output="$(node "$SCRIPT" --fixture "$TMP/runtime-commit-mismatch.json" --skip-http-smoke)"
runtime_commit_mismatch_status=$?
set -e
[[ "$runtime_commit_mismatch_status" -eq 3 ]] || { echo "expected runtime commit mismatch exit 3, got $runtime_commit_mismatch_status" >&2; exit 1; }
AUDIT_OUTPUT="$runtime_commit_mismatch_output" node - <<'NODE'
const value = JSON.parse(process.env.AUDIT_OUTPUT);
if (value.status !== "BLOCKED" || !value.validation.issueCounts.BUSINESS_EVIDENCE_RUNTIME_COMMIT_MISMATCH) throw new Error("stale runtime commit evidence was accepted");
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

# Exercise the production default worker selection against a local delayed HTTP
# server. Every exact-unique route must be requested once, concurrency must be
# CPU-adaptive but capped, and progress must be visible without changing the
# read-only contract semantics.
node - "$SCRIPT" "$TMP/pass.json" "$TMP/smoke-fixture.json" <<'NODE'
const fs = require("fs");
const http = require("http");
const os = require("os");
const { spawn } = require("child_process");

const [script, sourceFixture, smokeFixture] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(sourceFixture, "utf8"));
const base = payload.items[0];
const routeCount = 48;
payload.items = Array.from({ length: routeCount }, (_, index) => ({
  ...base,
  developmentOrder: index + 1,
  processCode: `SMOKE_PROCESS_${index + 1}`,
  processName: `Smoke process ${index + 1}`,
  stepCode: `SMOKE_STEP_${index + 1}`,
  stepName: `Smoke step ${index + 1}`,
  stepOrder: 1,
  userPath: `/audit-smoke/${index + 1}`,
  routePath: `/audit-smoke/${index + 1}`,
  latestRunId: `RUN-SMOKE-${index + 1}`,
  latestSimulationRunId: `SIM-SMOKE-${index + 1}`,
  simulationCaseCode: `SMOKE_CASE_${index + 1}`,
}));
Object.assign(payload, {
  targetCount: routeCount,
  auditedBindingCount: routeCount,
  auditedCapabilityTargetCount: routeCount,
});
Object.assign(payload.summary, {
  processCount: routeCount,
  stepCount: routeCount,
  routedStepCount: routeCount,
  passedStepCount: routeCount,
  blockedStepCount: 0,
  notRunStepCount: 0,
  verifiedContractCount: routeCount,
  totalContractCount: routeCount,
  auditTargetCount: routeCount,
});
fs.writeFileSync(smokeFixture, JSON.stringify(payload));

let active = 0;
let peak = 0;
let requestCount = 0;
const requestedPaths = new Set();
const server = http.createServer((request, response) => {
  active += 1;
  peak = Math.max(peak, active);
  requestCount += 1;
  requestedPaths.add(request.url);
  setTimeout(() => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>audit smoke</title>");
    active -= 1;
  }, 30);
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  const child = spawn(process.execPath, [script, "--fixture", smokeFixture], {
    env: {
      ...process.env,
      CARBONET_RUNTIME_BASE_URL: `http://127.0.0.1:${address.port}`,
      SYSTEM_TEST_REPORT_FIXTURE_COOKIE: "audit-fixture=1",
      SYSTEM_TEST_REPORT_SMOKE_PROGRESS_EVERY: "10",
      SYSTEM_TEST_REPORT_SMOKE_PROGRESS_INTERVAL_MS: "60000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("close", (code) => {
    server.close(() => {
      try {
        if (code !== 0) throw new Error(`route smoke exited ${code}: ${stderr}`);
        const output = JSON.parse(stdout.trim());
        const expectedConcurrency = Math.min(routeCount, 24, Math.max(8, Math.floor(os.availableParallelism() * 0.75)));
        if (output.status !== "PASS") throw new Error(`route smoke status ${output.status}`);
        if (output.routeSmoke.candidateCount !== routeCount || output.routeSmoke.smokedCount !== routeCount || output.routeSmoke.reachableCount !== routeCount) {
          throw new Error(`route coverage changed: ${JSON.stringify(output.routeSmoke)}`);
        }
        if (requestCount !== routeCount || requestedPaths.size !== routeCount) {
          throw new Error(`exact route dedupe/coverage mismatch requests=${requestCount} unique=${requestedPaths.size}`);
        }
        if (output.routeSmoke.concurrency !== expectedConcurrency || peak < Math.min(8, expectedConcurrency)) {
          throw new Error(`adaptive concurrency mismatch reported=${output.routeSmoke.concurrency} expected=${expectedConcurrency} peak=${peak}`);
        }
        if (!stderr.includes(`route-smoke start routes=${routeCount}`) || !stderr.includes(`route-smoke progress=${routeCount}/${routeCount}`)) {
          throw new Error(`progress evidence missing: ${stderr}`);
        }
        if (!(output.routeSmoke.requestsPerSecond > 0) || !(output.routeSmoke.durationMs > 0)) {
          throw new Error("route smoke throughput evidence missing");
        }
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
      }
    });
  });
});
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

echo '[all-process-contract-audit-test] PASS fixtures=9 outputContract=PASS/BLOCKED/ERROR contractVsBusiness=PASS staleSimulation=PASS pagedContractEvidence=PASS canonicalOrder=workType+process+step routes=full+adaptive+progress ioContracts=PASS secretPolicy=kubernetes+exit2 noBuild=PASS'
