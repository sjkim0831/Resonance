#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const harnessPath = process.env.MEMBER_RELAY_HARNESS_PATH
  ? path.resolve(process.env.MEMBER_RELAY_HARNESS_PATH)
  : path.join(root, "ops/scripts/resonance-member-lifecycle-relay-e2e.mjs");
const source = readFileSync(harnessPath, "utf8");

function functionBody(candidate, name, nextName) {
  const start = candidate.indexOf(`async function ${name}(`);
  const asyncEnd = nextName ? candidate.indexOf(`async function ${nextName}(`, start + 1) : -1;
  const syncEnd = nextName ? candidate.indexOf(`function ${nextName}(`, start + 1) : -1;
  const end = [asyncEnd, syncEnd].filter((value) => value > start).sort((a, b) => a - b)[0] || candidate.length;
  return start >= 0 && end > start ? candidate.slice(start, end) : "";
}

function violations(candidate) {
  const execute = functionBody(candidate, "executeRelay", "cleanupRun");
  const cleanup = functionBody(candidate, "cleanupRun", "persistEvidence");
  const reset = functionBody(candidate, "resetProcessState", "qaProvenance");
  const baselineAt = execute.indexOf("const baseline = scopedRelayState(runId, \"\")");
  const credentialsAt = execute.indexOf("loadDedicatedCredentials()");
  const loginAt = execute.indexOf('adminApi.post("/signin/actionLogin"');
  const createAt = execute.indexOf("siteScopeJson: JSON.stringify({ qaProvenance: executionProvenance() })");
  const checks = [
    ["dedicated-secret-default", candidate.includes('|| "carbonet-usage-ledger-system-admin"')
      && !candidate.includes("CARBONET_QA_AUTH_SECRET") && !candidate.includes("carbonet-test-account-switch")
      && !candidate.includes("CARBONET_QA_AUTH_USER") && !candidate.includes("CARBONET_ADMIN_TEST_USER")],
    ["no-webmaster-default", !/\|\|\s*["']webmaster["']/.test(candidate)],
    ["webmaster-rejected", candidate.includes('user.toLowerCase() === "webmaster"')],
    ["complete-explicit-pair", candidate.includes("explicit credential pair is incomplete")],
    ["secret-credential-source", candidate.includes('loadSecretField("username")') && candidate.includes('loadSecretField("password")')],
    ["password-env-cleared", candidate.includes("for (const key of explicitPairs.flat()) delete process.env[key]")],
    ["canonical-auth-lock", candidate.includes('"/tmp/carbonet-qa-auth-session.lock"')
      && candidate.includes('spawn("flock"') && candidate.includes('"-F", "-w", lockWaitSeconds')],
    ["active-token-expiry", candidate.includes("and (expiration_at is null or expiration_at > current_timestamp)")],
    ["active-token-baseline-zero", candidate.includes("evidence.cleanup.activeTokenBaseline !== 0")],
    ["baseline-before-auth-and-write", baselineAt >= 0 && credentialsAt > baselineAt && loginAt > credentialsAt && createAt > loginAt],
    ["baseline-triple-zero", execute.includes("baseline.executionCount === 0 && baseline.eventCount === 0 && baseline.draftCount === 0")],
    ["foreign-state-fail-closed", execute.includes("if (!explicitRunId || baseline.executionIds.length !== 1)")
      && execute.includes("foreign MEMBER_LIFECYCLE state blocks relay before login/write")
      && execute.includes("isExactTestOwnedState(recoverable, false)")],
    ["scoped-residue-joins", candidate.includes("join scoped_execution execution on execution.execution_id=event.execution_id")
      && candidate.includes("framework_process_work_draft") && !candidate.includes("where false")],
    ["exact-draft-provenance", candidate.includes("draft.evidence_json#>>'{qaProvenance,harness}'")
      && candidate.includes("draft.evidence_json#>>'{qaProvenance,runId}'")
      && candidate.includes("draft.evidence_json#>>'{qaProvenance,executionId}'")
      && candidate.includes("draft.evidence_json#>>'{qaProvenance,processCode}'=draft.process_code")
      && candidate.includes("draft.evidence_json#>>'{qaProvenance,stepCode}'=draft.step_code")
      && candidate.includes("draft.evidence_json#>>'{qaProvenance,actorCode}'=draft.actor_code")
      && candidate.includes("draft.evidence_json#>>'{qaProvenance,accountId}')=lower(draft.account_id)")
      && candidate.includes("draft.evidence_json#>>'{qaProvenance,sourceCommit}'=(")],
    ["atomic-execution-provenance", (candidate.match(/execution\.site_scope#>>'\{qaProvenance,harness\}'/g) || []).length >= 2
      && (candidate.match(/execution\.site_scope#>>'\{qaProvenance,runId\}'/g) || []).length >= 2
      && (candidate.match(/execution\.site_scope#>>'\{qaProvenance,actorCode\}'/g) || []).length >= 2
      && (candidate.match(/execution\.site_scope#>>'\{qaProvenance,accountId\}'/g) || []).length >= 2
      && (candidate.match(/execution\.site_scope#>>'\{qaProvenance,sourceCommit\}'/g) || []).length >= 2
      && execute.includes("siteScopeJson: JSON.stringify({ qaProvenance: executionProvenance() })")
      && cleanup.includes('ownershipBasis === "ZERO_BASELINE_ATOMIC_MARKER"')],
    ["exact-event-provenance", candidate.includes("framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,runId}'")
      && candidate.includes("framework_try_jsonb(event.request_json,'{}'::jsonb)#>>'{qaProvenance,sourceCommit}'=(")
      && candidate.includes("framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,runId}'")
      && candidate.includes("framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,stepCode}'=event.step_code")
      && candidate.includes("framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,actorCode}'=event.actor_code")
      && candidate.includes("framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,accountId}')=lower(event.executed_by)")
      && candidate.includes("framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,sourceCommit}'=(")],
    ["snapshot-provenance", candidate.includes("'qa-member-relay:'||")
      && candidate.includes("snapshotRef: `qa-member-relay:${runId}:${executionId}:${step.stepCode}`")],
    ["ownership-marker", execute.includes('evidenceType: "TEST_OWNERSHIP_MARKER"')
      && execute.includes("if (!isExactTestOwnedState(markedState, false))")],
    ["reset-owned-only", reset.includes("const ownedState = scopedRelayState(runId, executionId)")
      && reset.indexOf("isExactTestOwnedState") < reset.indexOf('action: "RESET"')
      && cleanup.includes('ownershipBasis !== "NONE"')],
    ["reset-then-delete", reset.indexOf('action: "RESET"') >= 0
      && reset.indexOf('action: "DELETE"') > reset.indexOf('action: "RESET"')
      && reset.includes("deletedExecutions) === 1")],
    ["full-residue-zero", cleanup.includes("residue.executionCount !== 0 || residue.eventCount !== 0 || residue.draftCount !== 0")],
    ["help-lane-dom", candidate.includes('page.locator("button.help-fab").filter({ hasText: /^도움말$/ })')],
    ["work-guide-lane-dom", candidate.includes('name: "업무 길잡이", exact: true')
      && candidate.includes('data-common-component="COMMON_STEP_FLOW"')],
    ["full-workflow-lane-dom", candidate.includes("data-task-quest-panel")
      && candidate.includes('name: "전체 업무 보기", exact: true')
      && candidate.includes('getByRole("dialog", { name: "전체 업무 프로세스", exact: true })')
      && candidate.includes('getByLabel("업무 프로세스", { exact: true })')
      && candidate.includes("workflowProcess.inputValue() !== processCode")
      && candidate.includes('name: "전체 업무 닫기", exact: true')],
    ["qa-lane-dom", candidate.includes('name: "QA 검증", exact: true')
      && candidate.includes("data-process-qa-card") && candidate.includes('name: "QA 업무", exact: true')
      && candidate.includes('data-qa-screen-context][data-screen-classification="EXECUTABLE"')
      && candidate.includes("QA workflow context is access restricted")],
    ["design-card-lane-dom", candidate.includes('name: "화면 설계 요약", exact: true')
      && candidate.includes('data-common-component="COMMON_STATUS_BADGE"') && candidate.includes("hasText: /^KRDS$/")],
    ["next-handoff-lane-dom", (candidate.match(/name: "다음 업무", exact: true/g) || []).length >= 3
      && candidate.includes("data-utility-panel-state")],
    ["api-coordinate-contract", candidate.includes("process.processCode === processCode")
      && candidate.includes('screen.route === "/work/execution"') && candidate.includes('screen.audience === "USER"')
      && candidate.includes("process.stepCode === step.stepCode") && candidate.includes("permission.actorCode === step.actorCode")],
    ["api-support-lanes", candidate.includes("const help = support.help || {}")
      && candidate.includes("const workGuide = support.workGuide || {}")
      && candidate.includes("const qa = support.qa || {}")
      && candidate.includes("const designCard = support.designCard || {}")
      && candidate.includes("workGuide.nextAction") && candidate.includes("qa.requiredScenarioTypes.length === requiredScenarios.length")
      && candidate.includes("qa.checks.every((check) => check.passed === true)")
      && candidate.includes("testContract[key] === true")],
    ["api-version-hash-contract", candidate.includes('/^[0-9a-f]{32}$/.test(contractHash)')
      && candidate.includes("Number.isSafeInteger(versionId)") && candidate.includes("versionId < 1")],
    ["direct-resolver-status-hash-binding", candidate.includes('const runtimeContractResult = await json(actorApi, "GET", runtimeContractPath, undefined, [200])')
      && candidate.includes("runtimeContractResult.response.status() !== 200")
      && candidate.includes("evidence.supportContracts.push(supportContract)")],
    ["page-resolver-mandatory", candidate.includes("const pageContractPromise = page.waitForResponse")
      && candidate.includes('candidate.request().method() === "GET"')
      && candidate.includes("const [response, pageContractResponse] = await Promise.all([")
      && candidate.includes("pageContractPromise," )],
    ["page-resolver-non200-fast", !candidate.includes("candidate.status() === 200")
      && candidate.includes("if (pageContractResponse.status() !== 200)")],
    ["page-api-contract-binding", candidate.includes('candidateUrl.pathname === "/runtime/screens/resolve"')
      && candidate.includes('candidateUrl.searchParams.get("routePath") === "/work/execution"')
      && candidate.includes('candidateUrl.searchParams.get("processCode") === processCode')
      && candidate.includes('candidateUrl.searchParams.get("stepCode") === step.stepCode')
      && candidate.includes('candidateUrl.searchParams.get("audience") === "USER"')
      && candidate.includes("pageSupportContract.contractHash !== supportContract.contractHash")
      && candidate.includes("pageSupportContract.versionId !== supportContract.versionId")],
    ["dom-contract-binding", candidate.includes('page.locator("[data-versioned-support-contract]")')
      && candidate.includes('"data-contract-hash", supportContract.contractHash')
      && candidate.includes('"data-version-id", String(supportContract.versionId)')
      && candidate.includes('"data-process-code", processCode')
      && candidate.includes('"data-step-code", step.stepCode')
      && candidate.includes('"data-actor-code", step.actorCode')
      && candidate.includes('"data-required-scenario-count", String(supportContract.requiredScenarioCount)')
      && candidate.includes("assertSupportDom(page, step, supportContract)")
      && candidate.includes("supportContractVersionId: supportContract.versionId")
      && candidate.includes("supportContractHash: pageSupportContract.contractHash")],
    ["support-surface-open-contract", candidate.includes("await helpButton.click()")
      && candidate.includes('data-help-work-context][data-screen-classification="EXECUTABLE"')
      && candidate.includes('getByRole("button", { name: "QA 업무", exact: true }).click()')
      && candidate.includes("qaWorkContext")
      && candidate.includes("workflowProcess.inputValue() !== processCode")],
    ["desktop-mobile-eight", candidate.includes('{ name: "desktop", width: 1440, height: 1000 }')
      && candidate.includes('{ name: "mobile", width: 390, height: 844 }')
      && candidate.includes("evidence.screenshotPaths.length !== 8")],
    ["console-error-gate", candidate.includes('page.on("console"') && candidate.includes('message.type() === "error"')
      && candidate.includes("consoleErrors.length || failedRequests.length")],
    ["request-failed-gate", candidate.includes('page.on("requestfailed"')
      && candidate.includes("failedRequests.push") && candidate.includes("consoleErrors.length || failedRequests.length")],
    ["total-deadline", candidate.includes("CARBONET_MEMBER_RELAY_TOTAL_DEADLINE_MS")
      && candidate.includes("CARBONET_MEMBER_RELAY_STARTED_AT_MS: String(wrapperStartedAtMs)")
      && candidate.includes("Math.max(0, deadlineAt - Date.now())")
      && candidate.includes("const deadlineTimer = setTimeout") && candidate.includes("assertRelayActive")],
    ["sigterm-finally", candidate.includes('process.once("SIGTERM", onSigterm)')
      && candidate.includes('process.once("SIGTERM", forwardSigterm)') && candidate.includes("locked.kill(signal)")
      && candidate.includes("await Promise.race([executionPromise, interruptPromise])")
      && candidate.includes("await executionPromise.catch(() => {})")
      && /finally\s*\{[\s\S]*await cleanupRun\(\);[\s\S]*await persistEvidence\(\);/.test(candidate)],
    ["bounded-request-cleanup", (candidate.match(/timeout: requestTimeoutMs/g) || []).length >= 2
      && candidate.includes("cleanupBudgetMs") && candidate.includes("cleanupDurationMs > cleanupBudgetMs")],
    ["actor-admin-logout", cleanup.includes('await logoutAndDisposeActor("cleanup", true)')
      && (cleanup.match(/await logoutContext\(adminApi, "admin", true\);/g) || []).length >= 2],
    ["context-disposal", candidate.includes("await disposeRequestContext(context);")
      && (candidate.match(/await uiContext\.close\(\);/g) || []).length >= 2],
    ["active-token-zero", cleanup.includes("postCleanupTokenCount !== 0")],
    ["immutable-evidence", candidate.includes('{ flag: "wx", mode: 0o600 }')
      && candidate.includes("await chmod(evidencePath, 0o400)")],
    ["screenshot-hashes", candidate.includes("await page.screenshot")
      && candidate.includes("evidence.screenshotPaths.push") && candidate.includes('createHash("sha256")')],
    ["no-secret-output", !/(console\.(?:log|error)|JSON\.stringify)\s*\([^\n]*(credentialPassword|credentials\.password|selected\.password)/.test(candidate)],
  ];
  violations.lastCheckCount = checks.length;
  return checks.filter(([, passed]) => !passed).map(([name]) => name);
}

function assertContract(candidate, label) {
  const failed = violations(candidate);
  if (failed.length) throw new Error(`${label} failed safe relay contract: ${failed.join(",")}`);
}

let mutantCount = 0;
function mutate(label, needle, replacement, expectedViolation) {
  if (!source.includes(needle)) throw new Error(`mutation fixture missing source needle: ${label}`);
  mutantCount += 1;
  const failed = violations(source.replace(needle, replacement));
  if (!failed.includes(expectedViolation)) {
    throw new Error(`${label} mutation survived; expected ${expectedViolation}, observed ${failed.join(",") || "none"}`);
  }
}

assertContract(source, "canonical harness");

mutate("general switch secret introduction", '|| "carbonet-usage-ledger-system-admin"', '|| "carbonet-test-account-switch"', "dedicated-secret-default");
mutate("webmaster rejection removal", 'user.toLowerCase() === "webmaster"', 'user.toLowerCase() === "never-a-real-account"', "webmaster-rejected");
mutate("token expiry removal", "and (expiration_at is null or expiration_at > current_timestamp)", "and true", "active-token-expiry");
mutate("token null fail-open", "expiration_at is null or expiration_at > current_timestamp", "expiration_at > current_timestamp", "active-token-expiry");
mutate("foreign execution baseline weakening", "baseline.executionCount === 0", "baseline.executionCount >= 0", "baseline-triple-zero");
mutate("foreign draft baseline weakening", "baseline.draftCount === 0", "baseline.draftCount >= 0", "baseline-triple-zero");
mutate("foreign provenance bypass", "if (!explicitRunId || baseline.executionIds.length !== 1)", "if (baseline.executionIds.length > 1)", "foreign-state-fail-closed");
mutate("early-failure event join removal", "join scoped_execution execution on execution.execution_id=event.execution_id", "where false", "scoped-residue-joins");
mutate("draft run provenance removal", "draft.evidence_json#>>'{qaProvenance,runId}'", "draft.evidence_json#>>'{qaProvenance,ignoredRunId}'", "exact-draft-provenance");
mutate("draft commit provenance removal", "draft.evidence_json#>>'{qaProvenance,sourceCommit}'", "draft.evidence_json#>>'{qaProvenance,ignoredCommit}'", "exact-draft-provenance");
mutate("atomic execution marker removal", "execution.site_scope#>>'{qaProvenance,runId}'", "execution.site_scope#>>'{qaProvenance,ignoredRunId}'", "atomic-execution-provenance");
mutate("atomic execution account marker removal", "execution.site_scope#>>'{qaProvenance,accountId}'", "execution.site_scope#>>'{qaProvenance,ignoredAccountId}'", "atomic-execution-provenance");
mutate("event result provenance removal", "framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,runId}'", "framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,ignoredRunId}'", "exact-event-provenance");
mutate("event result actor provenance removal", "framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,actorCode}'", "framework_try_jsonb(event.result_json,'{}'::jsonb)#>>'{qaProvenance,ignoredActorCode}'", "exact-event-provenance");
mutate("lock no-fork removal", '"-F", "-w", lockWaitSeconds', '"-w", lockWaitSeconds', "canonical-auth-lock");
mutate("ownership guard removal", "if (!isExactTestOwnedState(markedState, false))", "if (false)", "ownership-marker");
mutate("cleanup ownership bypass", 'ownershipBasis !== "NONE"', 'ownershipBasis === "NONE"', "reset-owned-only");
mutate("reset removal", 'action: "RESET"', 'action: "KEEP"', "reset-then-delete");
mutate("execution residue weakening", "residue.executionCount !== 0", "residue.executionCount < 0", "full-residue-zero");

const laneMutations = [
  ["help lane removal", 'page.locator("button.help-fab").filter({ hasText: /^도움말$/ })', 'page.locator("button.missing-help")', "help-lane-dom"],
  ["work-guide lane removal", 'data-common-component="COMMON_STEP_FLOW"', 'data-common-component="REMOVED_STEP_FLOW"', "work-guide-lane-dom"],
  ["full-workflow lane removal", 'name: "전체 업무 보기", exact: true', 'name: "없는 전체 업무", exact: true', "full-workflow-lane-dom"],
  ["QA lane removal", 'name: "QA 검증", exact: true', 'name: "없는 QA", exact: true', "qa-lane-dom"],
  ["design lane removal", 'name: "화면 설계 요약", exact: true', 'name: "없는 설계", exact: true', "design-card-lane-dom"],
  ["next-handoff lane removal", 'name: "다음 업무", exact: true', 'name: "없는 다음 업무", exact: true', "next-handoff-lane-dom"],
];
for (const mutation of laneMutations) mutate(...mutation);

mutate("API actor binding removal", "permission.actorCode === step.actorCode", "permission.actorCode !== step.actorCode", "api-coordinate-contract");
mutate("support QA contract removal", "const qa = support.qa || {}", "const qa = {}", "api-support-lanes");
mutate("support scenario five weakening", "qa.requiredScenarioTypes.length === requiredScenarios.length", "qa.requiredScenarioTypes.length >= requiredScenarios.length", "api-support-lanes");
mutate("direct resolver audience binding removal", 'screen.audience === "USER"', 'screen.audience === "ADMIN"', "api-coordinate-contract");
mutate("direct resolver status binding removal", "runtimeContractResult.response.status() !== 200", "false", "direct-resolver-status-hash-binding");
mutate("direct resolver hash format removal", "/^[0-9a-f]{32}$/.test(contractHash)", "Boolean(contractHash)", "api-version-hash-contract");
mutate("direct resolver version gate removal", "Number.isSafeInteger(versionId)", "Number.isFinite(versionId)", "api-version-hash-contract");
mutate("zero-page-resolver fixture", "const pageContractPromise = page.waitForResponse", "const pageContractPromise = Promise.resolve", "page-resolver-mandatory");
mutate("page resolver mandatory wait detached", "          pageContractPromise,", "          Promise.resolve(null),", "page-resolver-mandatory");
mutate("page resolver non-200 slow wait", 'candidate.request().method() === "GET"', 'candidate.request().method() === "GET" && candidate.status() === 200', "page-resolver-non200-fast");
mutate("page contract route binding removal", 'candidateUrl.searchParams.get("routePath") === "/work/execution"', "true", "page-api-contract-binding");
mutate("page contract audience binding removal", 'candidateUrl.searchParams.get("audience") === "USER"', "true", "page-api-contract-binding");
mutate("page contract step binding removal", 'candidateUrl.searchParams.get("stepCode") === step.stepCode', "true", "page-api-contract-binding");
mutate("page contract version binding removal", "pageSupportContract.versionId !== supportContract.versionId", "false", "page-api-contract-binding");
mutate("DOM contract hash binding removal", '"data-contract-hash", supportContract.contractHash', '"data-contract-hash", "unbound"', "dom-contract-binding");
mutate("DOM contract version binding removal", '"data-version-id", String(supportContract.versionId)', '"data-version-id", "0"', "dom-contract-binding");
mutate("DOM process binding removal", '"data-process-code", processCode', '"data-process-code", "OTHER"', "dom-contract-binding");
mutate("DOM step binding removal", '"data-step-code", step.stepCode', '"data-step-code", "OTHER"', "dom-contract-binding");
mutate("DOM actor binding removal", '"data-actor-code", step.actorCode', '"data-actor-code", "OTHER"', "dom-contract-binding");
mutate("DOM scenario count binding removal", '"data-required-scenario-count", String(supportContract.requiredScenarioCount)', '"data-required-scenario-count", "0"', "dom-contract-binding");
mutate("help open verification removal", "await helpButton.click();", "void helpButton;", "support-surface-open-contract");
mutate("QA panel open verification removal", 'getByRole("button", { name: "QA 업무", exact: true }).click()', 'getByRole("button", { name: "QA 업무", exact: true }).focus()', "support-surface-open-contract");
mutate("full workflow coordinate weakening", "workflowProcess.inputValue() !== processCode", "false", "full-workflow-lane-dom");
mutate("console observer removal", 'page.on("console"', 'page.on("ignored-console"', "console-error-gate");
mutate("console blocker removal", "consoleErrors.length || failedRequests.length", "false || failedRequests.length", "console-error-gate");
mutate("network observer removal", 'page.on("requestfailed"', 'page.on("ignored-requestfailed"', "request-failed-gate");
mutate("network blocker removal", "consoleErrors.length || failedRequests.length", "consoleErrors.length || false", "request-failed-gate");
mutate("SIGTERM handler removal", 'process.once("SIGTERM", onSigterm)', 'process.once("IGNORED", onSigterm)', "sigterm-finally");
mutate("wrapper SIGTERM forwarding removal", 'process.once("SIGTERM", forwardSigterm)', 'process.once("IGNORED", forwardSigterm)', "sigterm-finally");
mutate("absolute deadline propagation removal", "CARBONET_MEMBER_RELAY_STARTED_AT_MS: String(wrapperStartedAtMs)", "CARBONET_MEMBER_RELAY_STARTED_AT_MS: String(Date.now())", "total-deadline");
mutate("in-flight settlement removal", "await executionPromise.catch(() => {});", "void executionPromise;", "sigterm-finally");
mutate("request timeout removal", "timeout: requestTimeoutMs", "timeout: 0", "bounded-request-cleanup");
mutate("actor logout removal", 'await logoutAndDisposeActor("cleanup", true);', "void actorApi;", "actor-admin-logout");
mutate("active token assertion weakening", "postCleanupTokenCount !== 0", "postCleanupTokenCount < 0", "active-token-zero");
mutate("immutable evidence write removal", '{ flag: "wx", mode: 0o600 }', "{ mode: 0o600 }", "immutable-evidence");
mutate("screenshot count regression", "evidence.screenshotPaths.length !== 8", "evidence.screenshotPaths.length !== 7", "desktop-mobile-eight");
mutate("credential console exposure", "credentialPassword = credentials.password;", "credentialPassword = credentials.password; console.log(credentials.password);", "no-secret-output");

const checkCount = Number(violations.lastCheckCount || 0);
console.log(`MEMBER_LIFECYCLE_RELAY_SAFE_HARNESS_CONTRACT_PASS checks=${checkCount} mutants=${mutantCount} screenshots=8 supportLanes=6 pageResolver=mandatory+non200-fast domBinding=hash+version+process+step+actor+scenario5 cleanup=owned-reset-delete+logout+tokens+full-residue`);
