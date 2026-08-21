#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.RESONANCE_ROOT || path.join(testRoot, "../.."));
const relative = {
  contract: "projects/carbonet-frontend/source/src/features/emission-project-list/emissionMyTasksScreen.contract.json",
  page: "projects/carbonet-frontend/source/src/features/emission-project-list/EmissionMyTasksPage.tsx",
  accounts: "projects/carbonet-frontend/source/src/features/home-entry/TestAccountSwitcher.tsx",
  manifest: "projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts",
  help: "projects/carbonet-frontend/source/src/platform/screen-registry/helpContent.ts",
  verificationInventory: "projects/carbonet-frontend/source/src/generated/verificationCenterInventory.json",
  routeFamily: "projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts",
  service: "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java",
  controller: "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java",
  designDoc: "docs/design/emission-my-tasks-screen.md",
  browserE2e: "ops/scripts/resonance-project-task-browser-e2e.mjs",
};

const read = (key) => readFileSync(path.join(root, relative[key]), "utf8");
const baseline = {
  contract: JSON.parse(read("contract")),
  page: read("page"),
  accounts: read("accounts"),
  manifest: read("manifest"),
  help: read("help"),
  verificationInventory: JSON.parse(read("verificationInventory")),
  routeFamily: read("routeFamily"),
  service: read("service"),
  controller: read("controller"),
  designDoc: read("designDoc"),
  browserE2e: read("browserE2e"),
};

const SECTION_CODES = [
  "WORK_CONTEXT",
  "TODAY_STATUS",
  "NEXT_ACTION",
  "TASK_QUEUE",
  "PROCESS_PROGRESS",
  "RISKS",
  "HANDOFF_ACTIVITY",
  "NEXT_GUIDANCE",
];
const SECTION_NAMES = ["업무 문맥", "오늘의 업무 상태", "가장 먼저 할 일", "내 처리 대기함", "프로세스 진행 현황", "지연·위험·예외", "최근 인계와 활동", "다음 업무 안내"];
const QA_SCENARIOS = ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"];
const RELAY_ACCOUNTS = [
  { accountId: "qaowner26", actorCode: "COMPANY_MANAGER", stepOrders: [1, 6, 7], expectedVisibleTasks: ["BASIC_INFO", "REPORT", "REGULATORY_SUBMISSION"] },
  { accountId: "qadata26", actorCode: "SITE_DATA_OWNER", stepOrders: [2], expectedVisibleTasks: ["ACTIVITY_DATA"] },
  { accountId: "qacalc26", actorCode: "CALCULATOR", stepOrders: [3], expectedVisibleTasks: ["CALCULATION"] },
  { accountId: "qaverify26", actorCode: "VERIFIER", stepOrders: [4], expectedVisibleTasks: ["VERIFICATION"] },
  { accountId: "qaapprove26", actorCode: "APPROVER", stepOrders: [5], expectedVisibleTasks: ["APPROVAL"] },
];
const WORKFLOW_STEPS = [
  { stepOrder: 1, taskCode: "BASIC_INFO", processCode: "EMISSION_PROJECT", processStepCode: "EMISSION_PROJECT_SETUP", actorCode: "COMPANY_MANAGER", accountId: "qaowner26" },
  { stepOrder: 2, taskCode: "ACTIVITY_DATA", processCode: "EMISSION_PROJECT", processStepCode: "EMISSION_PROJECT_COLLECT", actorCode: "SITE_DATA_OWNER", accountId: "qadata26" },
  { stepOrder: 3, taskCode: "CALCULATION", processCode: "EMISSION_PROJECT", processStepCode: "EMISSION_PROJECT_CALCULATE", actorCode: "CALCULATOR", accountId: "qacalc26" },
  { stepOrder: 4, taskCode: "VERIFICATION", processCode: "EMISSION_PROJECT", processStepCode: "EMISSION_PROJECT_VALIDATE", actorCode: "VERIFIER", accountId: "qaverify26" },
  { stepOrder: 5, taskCode: "APPROVAL", processCode: "EMISSION_PROJECT", processStepCode: "EMISSION_PROJECT_APPROVE", actorCode: "APPROVER", accountId: "qaapprove26" },
  { stepOrder: 6, taskCode: "REPORT", processCode: "EMISSION_PROJECT", processStepCode: "EMISSION_PROJECT_REPORT", actorCode: "COMPANY_MANAGER", accountId: "qaowner26" },
  { stepOrder: 7, taskCode: "REGULATORY_SUBMISSION", processCode: "REGULATORY_SUBMISSION", processStepCode: "REGULATORY_SUBMISSION_S1", actorCode: "COMPANY_MANAGER", accountId: "qaowner26" },
];
const EXCEPTION_STEPS = [
  { processStepCode: "EMISSION_PROJECT_CORRECT", actorCode: "SITE_DATA_OWNER", accountId: "qadata26", trigger: "VALIDATION_REJECTED", reentryProcessStepCode: "EMISSION_PROJECT_CALCULATE" },
];

function count(source, token) {
  return source.split(token).length - 1;
}

function balancedBlock(source, start) {
  if (start < 0 || source[start] !== "{") return "";
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < source.length; index += 1) {
    const value = source[index];
    const next = source[index + 1] || "";
    if (lineComment) {
      if (value === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (value === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (value === "\\") { escaped = true; continue; }
      if (value === quote) quote = "";
      continue;
    }
    if (value === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (value === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (value === "\"" || value === "'" || value === "`") { quote = value; continue; }
    if (value === "{") depth += 1;
    if (value === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

function objectBlock(source, key) {
  const keyIndex = source.indexOf(`"${key}"`);
  if (keyIndex < 0) return "";
  const colon = source.indexOf(":", keyIndex + key.length + 2);
  return balancedBlock(source, source.indexOf("{", colon + 1));
}

function methodBlock(source, signature) {
  const signatureIndex = source.indexOf(signature);
  if (signatureIndex < 0) return "";
  return balancedBlock(source, source.indexOf("{", signatureIndex + signature.length));
}

function statementLine(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const end = source.indexOf("\n", start);
  return source.slice(start, end < 0 ? source.length : end);
}

function add(violations, failed, code) {
  if (failed) violations.push(code);
}

function validate(candidate) {
  const violations = [];
  const { contract, page, accounts, manifest, help, verificationInventory, routeFamily, service, controller, designDoc, browserE2e } = candidate;

  add(violations, contract.schemaVersion !== 2 || contract.pageId !== "emission-my-tasks" || contract.route !== "/emission/my-tasks" || contract.runtimeScope !== "EMISSION", "IDENTITY");
  add(violations, contract.designSystem !== "KRDS" || contract.templateCode !== "WORK_EXECUTION_HUB", "DESIGN_SYSTEM");
  const projectedSections = Array.isArray(contract.sections) ? contract.sections.map((item) => ({ code: item.code, name: item.name?.ko, required: item.required, helpId: item.helpId })) : [];
  add(violations, !isDeepStrictEqual(projectedSections, SECTION_CODES.map((code, index) => ({ code, name: SECTION_NAMES[index], required: true, helpId: `emission-my-tasks-${code.toLowerCase().replaceAll("_", "-")}` }))), "SECTIONS_EXACT");
  add(violations, Array.isArray(contract.sections) && contract.sections.some((item) => !isDeepStrictEqual(Object.keys(item).sort(), ["code", "helpId", "name", "required"]) || !isDeepStrictEqual(Object.keys(item.name || {}).sort(), ["en", "ko"])), "SECTION_SHAPE");
  const projectedQa = Array.isArray(contract.qaScenarios) ? contract.qaScenarios.map((item) => item.code) : [];
  add(violations, !isDeepStrictEqual(projectedQa, QA_SCENARIOS), "QA_SCENARIOS_EXACT");
  add(violations, Array.isArray(contract.qaScenarios) && contract.qaScenarios.some((item) => !isDeepStrictEqual(Object.keys(item).sort(), ["code", "label"]) || !isDeepStrictEqual(Object.keys(item.label || {}).sort(), ["en", "ko"])), "QA_SCENARIO_SHAPE");
  add(violations, !isDeepStrictEqual((contract.supportSurfaces || []).map((item) => item.code), ["HELP", "DESIGN", "QA", "GUIDE", "ALL_WORK"]), "SUPPORT_CARDS_EXACT");

  const fixture = contract.relayFixture || {};
  add(violations, fixture.scope !== "AUTOMATED_QA_FIXTURE", "RELAY_SCOPE");
  add(violations, !isDeepStrictEqual(Object.keys(fixture).sort(), ["accounts", "exceptionSteps", "scope", "workflowSteps"]), "RELAY_FIXTURE_SHAPE");
  const projectedAccounts = Array.isArray(fixture.accounts) ? fixture.accounts.map((item) => ({
    accountId: item.accountId,
    actorCode: item.actorCode,
    stepOrders: item.stepOrders,
    expectedVisibleTasks: item.expectedVisibleTasks,
  })) : [];
  add(violations, !isDeepStrictEqual(projectedAccounts, RELAY_ACCOUNTS), "RELAY_ACCOUNTS_EXACT");
  add(violations, Array.isArray(fixture.accounts) && fixture.accounts.some((item) => !isDeepStrictEqual(Object.keys(item).sort(), ["accountId", "actorCode", "expectedVisibleTasks", "stepOrders"])), "RELAY_ACCOUNT_SHAPE");
  const projectedSteps = Array.isArray(fixture.workflowSteps) ? fixture.workflowSteps.map((item) => ({
    stepOrder: item.stepOrder,
    taskCode: item.taskCode,
    processCode: item.processCode,
    processStepCode: item.processStepCode,
    actorCode: item.actorCode,
    accountId: item.accountId,
  })) : [];
  add(violations, !isDeepStrictEqual(projectedSteps, WORKFLOW_STEPS), "RELAY_WORKFLOW_EXACT");
  add(violations, Array.isArray(fixture.workflowSteps) && fixture.workflowSteps.some((item) => !isDeepStrictEqual(Object.keys(item).sort(), ["accountId", "actorCode", "processCode", "processStepCode", "stepOrder", "taskCode"])), "RELAY_WORKFLOW_SHAPE");
  add(violations, !isDeepStrictEqual(fixture.exceptionSteps, EXCEPTION_STEPS), "RELAY_EXCEPTION_EXACT");
  add(violations, Object.hasOwn(contract, "accountRelay"), "LEGACY_RELAY_AMBIGUITY");

  add(violations, !designDoc.includes("화면 ID: `emission-my-tasks`") || !designDoc.includes("경로: `/emission/my-tasks`") || !designDoc.includes("현재 실행 범위: `EMISSION`") || !designDoc.includes("실행 원장: `emission_project_task`") || !designDoc.includes("범위 판정: `DOMAIN_SCOPED`"), "DESIGN_DOC_SCOPE");
  add(violations, !SECTION_NAMES.every((name) => designDoc.includes(name)) || !designDoc.includes("8개 필수 섹션"), "DESIGN_DOC_SECTIONS");
  const docWorkflow = [...designDoc.matchAll(/^\|\s*([1-7])\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/gm)].map((match) => ({
    stepOrder: Number(match[1]),
    taskCode: match[2],
    accountId: match[3],
    actorCode: match[4],
  }));
  const expectedDocWorkflow = WORKFLOW_STEPS.map(({ stepOrder, taskCode, accountId, actorCode }) => ({ stepOrder, taskCode, accountId, actorCode }));
  add(violations, !isDeepStrictEqual(docWorkflow, expectedDocWorkflow), "DESIGN_DOC_WORKFLOW_EXACT");
  add(violations, !designDoc.includes("CORRECTION_REQUIRED") || !designDoc.includes("qadata26 / SITE_DATA_OWNER / EMISSION_PROJECT_CORRECT") || !designDoc.includes("재검증") || !designDoc.includes("정상 경로의 고정 다섯 번째 업무가 아니라"), "DESIGN_DOC_EXCEPTION_BRANCH");
  const docQaLine = statementLine(designDoc, "| QA |");
  const docQa = [...docQaLine.matchAll(/`([A-Z_]+)`/g)].map((match) => match[1]);
  add(violations, !isDeepStrictEqual(docQa, QA_SCENARIOS) || !docQaLine.includes("정확 5종"), "DESIGN_DOC_QA_EXACT");

  add(violations, !page.includes('data-my-work-summary=""') || !page.includes("data-page-id={screenContract.pageId}") || !page.includes("data-screen-contract={screenContract.templateCode}"), "PAGE_ROOT_HOOK");
  for (const sectionCode of SECTION_CODES) add(violations, count(page, `data-section-code="${sectionCode}"`) !== 1, `PAGE_SECTION_${sectionCode}`);
  add(violations, !page.includes("data-primary-task-id"), "PRIMARY_TASK_HOOK");
  add(violations, !page.includes("data-task-id={task.id}"), "TASK_ROW_HOOK");
  add(violations, /function\s+SupportPanel\b|<SupportPanel\b/.test(page), "LOCAL_SUPPORT_PANEL_DUPLICATE");
  add(violations, /HeaderBrand|HeaderDesktopNav|HeaderMobileMenu|HomeInlineStyles|fetchHomePayload/.test(page), "DUPLICATE_GLOBAL_HEADER");
  add(violations, /\{\s*focusProjectTasks\.length\s*>\s*0\s*&&\s*<section[^>]+data-section-code="PROCESS_PROGRESS"/.test(page), "REQUIRED_SECTION_CONDITIONAL");
  add(violations, !page.includes("Asia/Seoul") || !page.includes("data?.summary.serverDate || kstDateKey()") || /toISOString\(\)\.slice\(0,\s*10\)/.test(page), "KST_DATE_BOUNDARY");
  add(violations, !page.includes('!String(task.assignee || "").trim()') || page.includes("explicitlyAssigned"), "ASSIGNEE_GAP_METRIC");
  add(violations, !/new\s+AbortController\s*\(/.test(page) || !/signal:\s*(?:signal|[\w.]+\.signal)\b/.test(page) || !/load\([\w.]+\.signal\)/.test(page) || !/\.abort\(\)/.test(page), "ABORTABLE_LOAD");
  const compactBranch = service.indexOf("if(compact)");
  const fullCatalogBranch = service.indexOf('result.put("workTypes"');
  const summaryBranch = service.indexOf('result.put("summary"');
  const notificationsBranch = service.indexOf('result.put("notifications"');
  add(violations,
    !page.includes("&compact=true") ||
    !controller.includes('@RequestParam(name="compact",defaultValue="false") String compact') ||
    !controller.includes('boolean compactRequested="true".equalsIgnoreCase(compact)') ||
    !controller.includes("status,period,compactRequested") ||
    compactBranch < 0 || fullCatalogBranch < 0 || compactBranch > fullCatalogBranch ||
    summaryBranch < 0 || summaryBranch > compactBranch ||
    notificationsBranch < 0 || notificationsBranch > compactBranch ||
    !service.slice(compactBranch, compactBranch + 220).includes('"SUMMARY_COMPACT"'),
    "COMPACT_PAGE_API");
  add(violations, !/const\s*\[loading,\s*setLoading\]\s*=\s*useState/.test(page) || !page.includes("aria-busy={loading}") || !page.includes("data-load-state="), "LOADING_STATE");
  add(violations, !page.includes('aria-live="polite"') || !page.includes('role="alert"'), "ASYNC_A11Y");
  add(violations, !page.includes("<caption") || !page.includes('scope="col"'), "TABLE_A11Y");
  add(violations, !page.includes('role="progressbar"') || !page.includes("aria-valuenow="), "PROGRESS_A11Y");

  const manifestBlock = objectBlock(manifest, "emission-my-tasks");
  add(violations, !manifestBlock || !manifestBlock.includes('pageId: "emission-my-tasks"') || !manifestBlock.includes('routePath: "/emission/my-tasks"') || !manifestBlock.includes('designTokenVersion: "krds-current"'), "PAGE_MANIFEST");
  const componentIds = [...manifestBlock.matchAll(/componentId:\s*"([^"]+)"/g)].map((match) => match[1]);
  const instanceKeys = [...manifestBlock.matchAll(/instanceKey:\s*"([^"]+)"/g)].map((match) => match[1]);
  add(violations, componentIds.length < SECTION_CODES.length || instanceKeys.length !== componentIds.length || new Set(instanceKeys).size !== instanceKeys.length, "PAGE_MANIFEST_COMPONENTS");
  const inventoryPage = Array.isArray(verificationInventory?.pages)
    ? verificationInventory.pages.find((item) => item?.pageId === "emission-my-tasks")
    : null;
  add(violations, !inventoryPage || inventoryPage.routePath !== "/emission/my-tasks" || inventoryPage.menuCode !== "H1010102" || inventoryPage.menuBindingType !== "static", "VERIFICATION_INVENTORY_PAGE");

  const helpBlock = objectBlock(help, "emission-my-tasks");
  add(violations, !helpBlock || !helpBlock.includes('pageId: "emission-my-tasks"') || !/title:\s*"[^"]+"/.test(helpBlock) || !/summary:\s*"[^"]+"/.test(helpBlock), "PAGE_HELP");
  const helpAnchors = [...helpBlock.matchAll(/anchorSelector:\s*(["'])\[data-help-id=(["'])([^"']+)\2\]\1/g)].map((match) => match[3]);
  add(violations, helpAnchors.length < SECTION_CODES.length || new Set(helpAnchors).size !== helpAnchors.length, "PAGE_HELP_ITEMS");
  for (const anchor of helpAnchors) add(violations, !page.includes(`data-help-id="${anchor}"`), `PAGE_HELP_ANCHOR_${anchor}`);

  add(violations, count(routeFamily, 'id: "emission-my-tasks"') !== 2 || !routeFamily.includes('koPath: "/emission/my-tasks"') || !routeFamily.includes('enPath: "/en/emission/my-tasks"') || !routeFamily.includes('exportName: "EmissionMyTasksPage"'), "ROUTE_REGISTRY");
  for (const expected of [
    ["qaowner26", "COMPANY_MANAGER", "1·6·7단계"],
    ["qadata26", "SITE_DATA_OWNER", "2단계"],
    ["qacalc26", "CALCULATOR", "3단계"],
    ["qaverify26", "VERIFIER", "4단계"],
    ["qaapprove26", "APPROVER", "5단계"],
  ]) {
    const accountLine = statementLine(accounts, `{ id: "${expected[0]}"`);
    add(violations, !accountLine.includes(`actorCode: "${expected[1]}"`) || !accountLine.includes(`steps: "${expected[2]}"`), `TEST_ACCOUNT_${expected[0]}`);
  }

  const myTasksBody = methodBlock(service, "public Map<String,Object> myTasks(");
  const itemVisibility = statementLine(myTasksBody, 'String where="');
  const summaryVisibility = statementLine(myTasksBody, 'result.put("summary"');
  add(violations, !itemVisibility.includes("aa.actor_code=t.actor_code"), "ITEM_ACTOR_AUTHORITY_JOIN");
  add(violations, !summaryVisibility.includes("a.actor_code=t.actor_code"), "SUMMARY_ACTOR_AUTHORITY_JOIN");
  const updateTaskBody = methodBlock(service, "@Transactional public int updateTask(");
  const updateWrite = updateTaskBody.indexOf('return jdbc.update("UPDATE emission_project_task');
  for (const [token, code] of [
    ['List.of("READY","IN_PROGRESS").contains(status)', "TASK_STATUS_ALLOWLIST"],
    ["FOR UPDATE OF t", "TASK_ROW_LOCK"],
    ["TASK_ACTOR_NOT_ASSIGNED", "TASK_ASSIGNEE_DENIAL"],
    ["TASK_ACTOR_AUTHORITY_REQUIRED", "TASK_ACTOR_DENIAL"],
    ["TASK_PREDECESSOR_INCOMPLETE", "TASK_PREDECESSOR_DENIAL"],
  ]) add(violations, !updateTaskBody.includes(token), code);
  add(violations, updateWrite < 0 || ["TASK_ACTOR_NOT_ASSIGNED", "TASK_ACTOR_AUTHORITY_REQUIRED", "TASK_PREDECESSOR_INCOMPLETE"].some((token) => updateTaskBody.indexOf(token) > updateWrite), "TASK_DENIAL_BEFORE_WRITE");
  add(violations, !/actor_code=\?[^\n]+text\(task\.get\("actor_code"\)\)/.test(updateTaskBody), "TASK_EXACT_ACTOR_BINDING");

  const canonicalMatch = service.match(/CANONICAL_QA_SCENARIO_TYPES\s*=\s*Set\.of\(([^)]*)\)/s);
  const canonicalValues = canonicalMatch ? [...canonicalMatch[1].matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]) : [];
  add(violations, !isDeepStrictEqual(canonicalValues, QA_SCENARIOS), "BACKEND_QA_CANONICAL_SET");
  const canonicalValidator = methodBlock(service, "private boolean canonicalSupportValid(");
  add(violations, !canonicalValidator.includes("CANONICAL_QA_SCENARIO_TYPES.equals(new HashSet<>(scenarioTypes))") || !/scenarioTypes\.size\(\)\s*==\s*CANONICAL_QA_SCENARIO_TYPES\.size\(\)/.test(canonicalValidator), "BACKEND_QA_EXACT_VALIDATOR");

  const controllerList = methodBlock(controller, "public ResponseEntity<?> myTasks(");
  const controllerUpdate = methodBlock(controller, "public ResponseEntity<?> updateTask(");
  add(violations, !controller.includes('"/home/api/emission-tasks"') || !controllerList.includes("status(401)") || !controllerList.includes("service.myTasks"), "TASK_API_AUTHENTICATION");
  add(violations, !controller.includes('"/home/api/emission-tasks/{taskId}/status"') || !controllerUpdate.includes("catch(SecurityException e)") || !controllerUpdate.includes("status(403)"), "TASK_API_AUTHORIZATION");

  add(violations, !browserE2e.includes('[data-my-work-summary][data-page-id="emission-my-tasks"]') || !browserE2e.includes("assertMyTasksScreen") || !browserE2e.includes('getAttribute("data-load-state")'), "BROWSER_ROOT_CONTRACT");
  for (const sectionCode of SECTION_CODES) add(violations, !browserE2e.includes(`"${sectionCode}"`), `BROWSER_SECTION_${sectionCode}`);
  add(violations, !browserE2e.includes("data-primary-task-id") || !browserE2e.includes("data-task-id") || !browserE2e.includes("selectOption(disposableProjectId)"), "BROWSER_TASK_IDENTITY");
  add(violations, !page.includes('id="my-work-project"') || !browserE2e.includes('root.locator("#my-work-project").selectOption(disposableProjectId)') || browserE2e.includes('getByLabel("프로젝트"'), "BROWSER_LOCALE_NEUTRAL_PROJECT_SELECTOR");
  add(violations, /page\.locator\("article"\)[\s\S]{0,180}업무 시작/.test(browserE2e), "BROWSER_LEGACY_ARTICLE_SELECTOR");
  add(violations, !browserE2e.includes("wrong actor transition expected 403") || !browserE2e.includes("post-transition task lookup"), "BROWSER_ACTOR_AND_READBACK");

  return violations;
}

const initialViolations = validate(baseline);
assert.deepEqual(initialViolations, [], `my-work summary contract violations: ${initialViolations.join(", ")}`);

let mutants = 0;
function killed(name, override, expectedViolation) {
  const candidate = { ...baseline, ...override };
  const found = validate(candidate);
  assert.ok(found.includes(expectedViolation), `${name} mutant survived; violations=${found.join(",")}`);
  mutants += 1;
}
function cloneContract() { return structuredClone(baseline.contract); }
function replaceAfter(source, marker, token, replacement) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return source;
  const tokenIndex = source.indexOf(token, markerIndex);
  if (tokenIndex < 0) return source;
  return source.slice(0, tokenIndex) + replacement + source.slice(tokenIndex + token.length);
}

{
  const contract = cloneContract(); contract.sections.pop();
  killed("required section deletion", { contract }, "SECTIONS_EXACT");
}
{
  const contract = cloneContract(); contract.sections[7].code = "HANDOFF_ACTIVITY";
  killed("required section duplication", { contract }, "SECTIONS_EXACT");
}
{
  const contract = cloneContract(); contract.qaScenarios[3] = "CONFLICT";
  killed("QA vocabulary drift", { contract }, "QA_SCENARIOS_EXACT");
}
{
  const contract = cloneContract(); contract.qaScenarios.push("RECOVERY");
  killed("QA duplicate", { contract }, "QA_SCENARIOS_EXACT");
}
{
  const contract = cloneContract(); contract.relayFixture.accounts[2].actorCode = "VERIFIER";
  killed("relay account actor swap", { contract }, "RELAY_ACCOUNTS_EXACT");
}
{
  const contract = cloneContract(); contract.relayFixture.workflowSteps.splice(5, 1);
  killed("relay step deletion", { contract }, "RELAY_WORKFLOW_EXACT");
}
{
  const contract = cloneContract(); contract.relayFixture.exceptionSteps[0].reentryProcessStepCode = "EMISSION_PROJECT_APPROVE";
  killed("exception reentry drift", { contract }, "RELAY_EXCEPTION_EXACT");
}
killed("primary identity hook deletion", { page: baseline.page.replaceAll("data-primary-task-id", "data-removed-primary-task-id") }, "PRIMARY_TASK_HOOK");
killed("local support panel reintroduction", { page: `${baseline.page}\nfunction SupportPanel(){return null;}\n` }, "LOCAL_SUPPORT_PANEL_DUPLICATE");
killed("KST boundary deletion", { page: baseline.page.replaceAll("Asia/Seoul", "UTC") }, "KST_DATE_BOUNDARY");
killed("server date authority deletion", { page: baseline.page.replace("data?.summary.serverDate || kstDateKey()", "kstDateKey()") }, "KST_DATE_BOUNDARY");
killed("assignee gap metric bypass", { page: baseline.page.replace('!String(task.assignee || "").trim()', "false") }, "ASSIGNEE_GAP_METRIC");
killed("item actor join deletion", { service: baseline.service.replace("aa.actor_code=t.actor_code AND ", "") }, "ITEM_ACTOR_AUTHORITY_JOIN");
killed("summary actor join deletion", { service: replaceAfter(baseline.service, 'result.put("summary",jdbc.queryForMap("SELECT count(*) AS total', "a.actor_code=t.actor_code AND ", "") }, "SUMMARY_ACTOR_AUTHORITY_JOIN");
killed("assignee denial deletion", { service: baseline.service.replace("TASK_ACTOR_NOT_ASSIGNED", "TASK_ACTOR_ALLOWED") }, "TASK_ASSIGNEE_DENIAL");
killed("active actor denial deletion", { service: baseline.service.replace("TASK_ACTOR_AUTHORITY_REQUIRED", "TASK_ACTOR_ALLOWED") }, "TASK_ACTOR_DENIAL");
killed("backend QA member drift", { service: baseline.service.replace('"EXCEPTION", "RECOVERY"', '"EXCEPTION", "CONFLICT"') }, "BACKEND_QA_CANONICAL_SET");
killed("backend QA duplicate guard deletion", { service: baseline.service.replace("scenarioTypes.size()==CANONICAL_QA_SCENARIO_TYPES.size()", "scenarioTypes.size()>=CANONICAL_QA_SCENARIO_TYPES.size()") }, "BACKEND_QA_EXACT_VALIDATOR");
killed("browser exact selector deletion", { browserE2e: baseline.browserE2e.replaceAll("data-primary-task-id", "data-removed-primary-task-id") }, "BROWSER_TASK_IDENTITY");
killed("browser localized project selector reintroduction", { browserE2e: baseline.browserE2e.replace('root.locator("#my-work-project")', 'root.getByLabel("프로젝트", { exact: true })') }, "BROWSER_LOCALE_NEUTRAL_PROJECT_SELECTOR");
killed("abort wiring deletion", { page: baseline.page.replace(/load\([\w.]+\.signal\)/, "load()") }, "ABORTABLE_LOAD");
killed("compact page request deletion", { page: baseline.page.replace("&compact=true", "") }, "COMPACT_PAGE_API");
killed("compact backend bypass deletion", { service: baseline.service.replace("if(compact)", "if(false)") }, "COMPACT_PAGE_API");
killed("compact controller forwarding deletion", { controller: baseline.controller.replace("status,period,compactRequested", "status,period,false") }, "COMPACT_PAGE_API");
killed("compact empty-value tolerance deletion", { controller: baseline.controller.replace('@RequestParam(name="compact",defaultValue="false") String compact', '@RequestParam(defaultValue="false") boolean compact') }, "COMPACT_PAGE_API");
killed("design scope expansion", { designDoc: baseline.designDoc.replace("현재 실행 범위: `EMISSION`", "현재 실행 범위: `ALL`") }, "DESIGN_DOC_SCOPE");
killed("design exception deletion", { designDoc: baseline.designDoc.replaceAll("EMISSION_PROJECT_CORRECT", "EMISSION_PROJECT_APPROVE") }, "DESIGN_DOC_EXCEPTION_BRANCH");
{
  const verificationInventory = structuredClone(baseline.verificationInventory);
  verificationInventory.pages = verificationInventory.pages.filter((item) => item.pageId !== "emission-my-tasks");
  killed("verification inventory page deletion", { verificationInventory }, "VERIFICATION_INVENTORY_PAGE");
}

const helpItems = [...objectBlock(baseline.help, "emission-my-tasks").matchAll(/anchorSelector:/g)].length;
console.log(`MY_WORK_SUMMARY_SCREEN_CONTRACT_PASS sections=${SECTION_CODES.length} qa=${QA_SCENARIOS.length} accounts=${RELAY_ACCOUNTS.length} relaySteps=${WORKFLOW_STEPS.length} exceptionSteps=${EXCEPTION_STEPS.length} helpItems=${helpItems} mutants=${mutants}`);
