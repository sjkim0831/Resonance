#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { openDeclaredProcessRelayRuntime, relayDeclaredProcessPrerequisites }
  from "./lib/declared-process-relay-runtime.mjs";

export const STATUS_CASES = ["SUCCESS", "VALIDATION_ERROR", "FORBIDDEN", "CONFLICT", "RECOVERY"];
export const EXECUTION_ORDER = ["VALIDATION_ERROR", "FORBIDDEN", "SUCCESS", "CONFLICT", "RECOVERY"];
export const LANES = ["API", "DATABASE", "BROWSER"];
const HTTP_STATUS = { SUCCESS: 200, VALIDATION_ERROR: 400, FORBIDDEN: 403, CONFLICT: 409, RECOVERY: 200 };
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export function deterministicUuid(seed) {
  const bytes = Buffer.from(sha256(seed).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function httpObservationExact(statusCase, httpStatus, body, declaredStatus = HTTP_STATUS[statusCase]) {
  if (httpStatus !== declaredStatus || declaredStatus !== HTTP_STATUS[statusCase]) return false;
  if (statusCase === "RECOVERY") return body?.success === true && body?.idempotent === true && body?.recovered === true;
  if (statusCase === "SUCCESS") return body?.success === true && body?.idempotent === false;
  return body?.success === false && typeof body?.code === "string" && typeof body?.message === "string";
}
function fail(code, material = "") {
  const error = new Error(code); error.code = code; error.materialHash = sha256(String(material)); throw error;
}
function object(value, code) { if (!value || typeof value !== "object" || Array.isArray(value)) fail(code); return value; }
function array(value, code) { if (!Array.isArray(value)) fail(code); return value; }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function bodyOutput(body, fields) {
  const source = object(body, "API_RESPONSE_BODY_INVALID");
  if (stable(Object.keys(source).sort()) !== stable([...fields].sort())) fail("API_RESPONSE_FIELDS_NOT_EXACT", stable(source));
  return Object.fromEntries(fields.map(field => [field, source[field]]));
}
function exactExecutionSelector(context, authority, commandCode, accountId) {
  const selector = { accountId: String(accountId), commandCode: String(commandCode),
    executionId: String(context.executionId || ""), processCode: String(authority.processCode || ""),
    projectId: String(context.projectId || ""), stepCode: String(authority.stepCode || ""),
    tenantId: String(context.tenantId || "") };
  if (!/^[0-9a-fA-F-]{36}$/.test(selector.executionId)
      || Object.values(selector).some(value => !value)) fail("DB_POSTCONDITION_MAPPING_REQUIRED");
  return selector;
}
function invokeDbProbe(root, selector, timeoutMs) {
  const result = spawnSync("bash", [path.join(root, "ops/scripts/composite-live-smoke-db-probe.sh"),
    "--snapshot", JSON.stringify(selector)], { encoding: null, timeout: timeoutMs,
    env: { ...process.env, RESONANCE_ROOT: root }, windowsHide: true });
  if (result.status !== 0 || !result.stdout?.length) fail("DATABASE_REREAD_FAILED", result.stderr || "");
  const raw = Buffer.from(result.stdout);
  let body; try { body = JSON.parse(raw.toString("utf8").trim().split(/\r?\n/).filter(line => line.startsWith("{")).at(-1)); }
  catch { fail("DATABASE_REREAD_NON_JSON", raw); }
  if (body?.schema !== "carbonet.composite-db-reread/v1" || body?.readOnly !== true) fail("DATABASE_REREAD_NOT_READ_ONLY");
  return { body, raw, hash: sha256(raw) };
}
function requestPath(operation, executionId) {
  const route = String(operation.path || "").replace("{executionId}", encodeURIComponent(executionId));
  if (!route.startsWith("/") || route.includes("{") || route.includes("}")) fail("API_PATH_NOT_EXECUTABLE", route);
  return route;
}
function artifactRoot(root, manifest) {
  const override = String(process.env.CARBONET_COMPOSITE_LIVE_SMOKE_EVIDENCE_ROOT || "").trim();
  if (override) {
    const resolvedOverride = path.resolve(override);
    if (!path.isAbsolute(override) || resolvedOverride === path.parse(resolvedOverride).root
        || path.basename(resolvedOverride) !== "composite-live-smoke")
      fail("LIVE_SMOKE_EVIDENCE_ROOT_OVERRIDE_INVALID");
    return resolvedOverride;
  }
  const repositoryRoot = path.resolve(root), configured = String(manifest.evidenceDirectory || "");
  if (!configured || path.isAbsolute(configured)) fail("LIVE_SMOKE_EVIDENCE_DIRECTORY_INVALID");
  const resolved = path.resolve(repositoryRoot, configured);
  const relative = path.relative(repositoryRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    fail("LIVE_SMOKE_EVIDENCE_DIRECTORY_INVALID");
  return resolved;
}
async function writeImmutableArtifact(evidenceRoot, dispatchId, runId, kind, bytes) {
  const value = Buffer.from(bytes), digest = sha256(value);
  const extension = kind === "DOM" ? "dom.html" : "screenshot.png";
  const reference = path.posix.join(String(dispatchId), runId, `${digest}.${extension}`);
  const destination = path.resolve(evidenceRoot, ...reference.split("/"));
  if (!destination.startsWith(`${path.resolve(evidenceRoot)}${path.sep}`)) fail("EVIDENCE_ARTIFACT_PATH_INVALID");
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  let cursor=path.resolve(evidenceRoot);
  const rootStat=await lstat(cursor);
  if(rootStat.isSymbolicLink()||!rootStat.isDirectory())fail("EVIDENCE_ARTIFACT_ROOT_NOT_CONTROLLED");
  for(const component of path.relative(cursor,path.dirname(destination)).split(path.sep).filter(Boolean)){
    cursor=path.join(cursor,component);const stat=await lstat(cursor);
    if(stat.isSymbolicLink()||!stat.isDirectory())fail("EVIDENCE_ARTIFACT_DIRECTORY_NOT_CONTROLLED");
  }
  try { await writeFile(destination, value, { flag: "wx", mode: 0o440 }); }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const stat = await lstat(destination);
    if (!stat.isFile() || stat.isSymbolicLink() || sha256(await readFile(destination)) !== digest)
      fail("EVIDENCE_ARTIFACT_IMMUTABILITY_CONFLICT");
  }
  await chmod(destination, 0o440).catch(() => {});
  return { reference, hash: digest };
}
function responseMatches(response, method, expectedPath) {
  try { return response.request().method().toUpperCase() === method.toUpperCase()
    && new URL(response.url()).pathname === expectedPath; }
  catch { return false; }
}
async function fillScenarioInputs(page, input) {
  for (const [fieldCode, raw] of Object.entries(input)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,119}$/.test(fieldCode)) fail("BROWSER_INPUT_FIELD_CODE_INVALID", fieldCode);
    const control = page.locator(`[name="${fieldCode}"]`);
    if (await control.count() !== 1) fail("BROWSER_INPUT_CONTROL_NOT_EXACT", fieldCode);
    const shape = await control.evaluate(node => ({ tag: node.tagName, type: node.getAttribute("type") || "" }));
    if (shape.tag === "SELECT") await control.selectOption(String(raw));
    else if (shape.type === "checkbox") {
      if (raw === true || raw === "true") await control.check(); else await control.uncheck();
    } else await control.fill(raw == null ? "" : String(raw));
  }
}
async function openScenarioPage({ runtime, accountId, baseURL, authority, command, scenario,
  execution, idempotencyKey, runId, browserTimeout, openPages, denied }) {
  const { context, page } = await runtime.pageFor(accountId); openPages.push(context);
  const browserQuery = new URLSearchParams({ tenantId: authority.tenantId, projectId: authority.projectId,
    processCode: authority.processCode, stepCode: authority.stepCode, executionId: execution.executionId,
    commandCode: command.commandCode, scenarioCode: String(scenario.scenarioCode),
    statusCase: String(scenario.expectedStatus), idempotencyKey, liveSmokeRunId: runId });
  const browserPath = String(authority.routePath).split("?")[0];
  await page.goto(`${baseURL}${browserPath}?${browserQuery}`, { waitUntil: "domcontentloaded", timeout: browserTimeout });
  await page.waitForFunction(() => (document.querySelector("#root")?.children.length || 0) > 0,
    undefined, { timeout: browserTimeout });
  await page.waitForFunction(expectedDenied => document.querySelector("main")?.getAttribute("data-access-denied") ===
    (expectedDenied ? "true" : "false") && (expectedDenied ||
      document.querySelector("main")?.getAttribute("data-runtime-observed") === "true"),
    denied, { timeout: browserTimeout });
  await fillScenarioInputs(page, object(scenario.inputValues, "TEST_INPUT_INVALID"));
  return { context, page, browserPath };
}
async function browserCommand({ runtime, baseURL, authority, command, operation, scenario, execution,
  idempotencyKey, runId, selection, statusCase, browserTimeout, requestTimeout, openPages }) {
  const needsDraftSave = !["CONFLICT", "RECOVERY"].includes(statusCase);
  let prepared;
  if (needsDraftSave) {
    prepared = await openScenarioPage({ runtime, accountId: selection.preparation.accountId, baseURL,
      authority, command, scenario, execution, idempotencyKey, runId, browserTimeout, openPages, denied: false });
    const loadPromise = prepared.page.waitForResponse(response => {
      try { return response.request().method() === "GET"
        && new URL(response.url()).pathname.endsWith("/home/api/process-executions/draft"); }
      catch { return false; }
    }, { timeout: requestTimeout });
    await prepared.page.locator('[data-live-smoke-action="load-draft"]').click();
    const loaded = await loadPromise;
    if (loaded.status() !== 200) fail("BROWSER_DRAFT_LOAD_FAILED", loaded.status());
    let loadedDraft;try{loadedDraft=JSON.parse(Buffer.from(await loaded.body()).toString("utf8"));}
    catch{fail("BROWSER_DRAFT_LOAD_RESPONSE_INVALID");}
    const loadedVersion=Number(loadedDraft?.draft?.draftVersion);
    if(!Number.isSafeInteger(loadedVersion)||loadedVersion<1)fail("BROWSER_DRAFT_LOAD_VERSION_INVALID");
    await prepared.page.waitForFunction(expected => document.querySelector("main")?.getAttribute(
      "data-draft-version") === String(expected), loadedVersion, { timeout: browserTimeout });
    await fillScenarioInputs(prepared.page, object(scenario.inputValues, "TEST_INPUT_INVALID"));
    const savePromise = prepared.page.waitForResponse(response => {
      try { return response.request().method() === "PUT"
        && new URL(response.url()).pathname.endsWith("/home/api/process-executions/draft"); }
      catch { return false; }
    }, { timeout: requestTimeout });
    await prepared.page.locator('[data-live-smoke-action="save-draft"]').click();
    const saved = await savePromise;
    if (saved.status() !== 200) fail("BROWSER_DRAFT_SAVE_FAILED", saved.status());
    await prepared.page.waitForFunction(() => document.querySelector("main")?.getAttribute(
      "data-draft-status") === "DRAFT", undefined, { timeout: browserTimeout });
  }
  const denied = statusCase === "FORBIDDEN";
  const active = prepared && String(selection.command.accountId).toLowerCase() ===
    String(selection.preparation.accountId).toLowerCase() ? prepared : await openScenarioPage({
      runtime, accountId: selection.command.accountId, baseURL, authority, command, scenario, execution,
      idempotencyKey, runId, browserTimeout, openPages, denied });
  const expectedPath = requestPath(operation, execution.executionId);
  const method = String(operation.method).toUpperCase();
  const responsePromise = active.page.waitForResponse(response => responseMatches(response, method, expectedPath),
    { timeout: requestTimeout });
  const button = active.page.locator(`[data-command-code="${command.commandCode}"]`);
  if (await button.count() !== 1) fail("BROWSER_COMMAND_BUTTON_NOT_EXACT", command.commandCode);
  await button.click();
  const response = await responsePromise, raw = Buffer.from(await response.body());
  let body; try { body = raw.length ? JSON.parse(raw.toString("utf8")) : {}; }
  catch { fail("API_RESPONSE_NON_JSON", raw); }
  await active.page.waitForFunction(expected => { const main=document.querySelector("main"); return (
    main?.getAttribute("data-last-command-code") === expected.command
      && main?.getAttribute("data-last-http-status") === String(expected.http)
      && main?.getAttribute("data-last-status-case") === expected.status); },
    { command: command.commandCode, http: Number(scenario.expectedHttpStatus), status: statusCase },
    { timeout: browserTimeout });
  const dom = await active.page.locator("html").evaluate(node => node.outerHTML);
  const state = await active.page.evaluate(() => { const main=document.querySelector("main"); return {
    path:location.pathname,processCode:main?.getAttribute("data-process-code")||"",
    stepCode:main?.getAttribute("data-step-code")||"",audience:main?.getAttribute("data-audience")||"",
    tenantId:main?.getAttribute("data-tenant-id")||"",projectId:main?.getAttribute("data-project-id")||"",
    executionId:main?.getAttribute("data-execution-id")||"",currentState:main?.getAttribute("data-current-state")||"",
    runtimeObserved:main?.getAttribute("data-runtime-observed")==="true",
    accessDenied:main?.getAttribute("data-access-denied")==="true",
    commandCode:main?.getAttribute("data-last-command-code")||"",
    httpStatus:Number(main?.getAttribute("data-last-http-status")||0),
    statusCase:main?.getAttribute("data-last-status-case")||"",
    outputJson:main?.getAttribute("data-last-output-json")||"",
    idempotencyKey:main?.getAttribute("data-last-idempotency-key")||"",
    fatal:/react app did not mount|page error|페이지 처리 중 오류/i.test(document.body?.innerText||"") }; });
  const screenshot = await active.page.screenshot({ fullPage: true });
  return { response, raw, body, dom, state, screenshot, browserPath: active.browserPath };
}
export function selectAccounts(plan, credentials, authority, actor, statusCase, requiredScope) {
  const positiveId = String(credentials[actor] || "");
  if (!positiveId) fail("EXPLICIT_RELAY_ACCOUNT_MAPPING_REQUIRED", actor);
  const assignments = array(plan.eligibleAssignments, "RELAY_ASSIGNMENTS_MISSING");
  const positives = assignments.filter(row => Number(row.authorityId) === Number(authority.authorityId)
    && row.actorCode === actor && String(row.accountId).toLowerCase() === positiveId.toLowerCase()
    && Number(row.assignmentCount) === 1 && row.projectId && row.tenantId
    && (!requiredScope || (row.projectId === requiredScope.projectId && row.tenantId === requiredScope.tenantId)))
    .sort((left, right) => stable([left.tenantId,left.projectId,left.accountId])
      .localeCompare(stable([right.tenantId,right.projectId,right.accountId]), "en"));
  if (!positives.length) fail("EXACT_RELAY_ACCOUNT_REQUIRED", `${authority.authorityId}|${actor}|0`);
  const preparation = positives[0];
  if (statusCase !== "FORBIDDEN") return { command: preparation, preparation };
  const deniedId = String(credentials[`FORBIDDEN:${actor}`] || "");
  if (!deniedId) fail("EXPLICIT_FORBIDDEN_ACCOUNT_MAPPING_REQUIRED", actor);
  const denied = assignments.filter(row => Number(row.authorityId) === Number(authority.authorityId)
    && row.actorCode === actor && row.tenantId === preparation.tenantId
    && row.projectId === preparation.projectId
    && String(row.accountId).toLowerCase() === deniedId.toLowerCase()
    && Number(row.assignmentCount) === 0);
  if (denied.length !== 1) fail("FORBIDDEN_RELAY_ACCOUNT_REQUIRED", `${authority.authorityId}|${actor}|${denied.length}`);
  return { command: denied[0], preparation };
}
function observationState(statusCase, transition) {
  return String(["SUCCESS", "CONFLICT", "RECOVERY"].includes(statusCase) ? transition.toState : transition.fromState);
}
function evidenceKey(authority, scenario, lane) {
  return `${authority.authorityId}|${authority.authorityRevision}|${scenario.commandCode}|${scenario.scenarioCode}|${scenario.expectedStatus}|${lane}`;
}
function executionVersion(seed) { return 1 + Number.parseInt(sha256(seed).slice(0, 7), 16); }
async function jsonCall(api, method, route, data, expected, timeout) {
  const response = await api.fetch(route, { method, ...(data === undefined ? {} : { data }),
    failOnStatusCode: false, timeout });
  const raw = Buffer.from(await response.body()); let body = {};
  try { body = raw.length ? JSON.parse(raw.toString("utf8")) : {}; } catch { fail("API_RESPONSE_NON_JSON", raw); }
  if (!expected.includes(response.status())) fail("FIXTURE_API_STATUS_INVALID", `${method}|${route}|${response.status()}|${sha256(raw)}`);
  return { body, raw, response };
}
export function directStepChain(authorities, targetAuthority) {
  const targetOrder = Number(targetAuthority.stepOrder);
  if (!Number.isSafeInteger(targetOrder) || targetOrder < 1) fail("DIRECT_STEP_ORDER_INVALID");
  const candidates = authorities.filter(row => row.processCode === targetAuthority.processCode
    && row.directIdentity === true && Number(row.stepOrder) <= targetOrder);
  const groups = new Map();
  for (const row of candidates) {
    const order = Number(row.stepOrder);
    const rows = groups.get(order) || []; rows.push(row); groups.set(order, rows);
  }
  const chain = [...groups.entries()].sort(([left],[right]) => left-right).map(([,rows]) => {
    if (new Set(rows.map(row => String(row.stepCode))).size !== 1)
      fail("DIRECT_STEP_ORDER_NOT_EXACT", stable(rows.map(row => row.stepCode)));
    if (Number(rows[0].stepOrder) === targetOrder && targetAuthority.directIdentity === true) {
      const exactTarget = rows.filter(row => Number(row.authorityId) === Number(targetAuthority.authorityId));
      if (exactTarget.length !== 1) fail("DIRECT_TARGET_IDENTITY_NOT_EXACT");
      return exactTarget[0];
    }
    const sameAudience = rows.filter(row => String(row.audience) === String(targetAuthority.audience));
    if (sameAudience.length === 1) return sameAudience[0];
    if (sameAudience.length > 1 || rows.length !== 1) fail("DIRECT_STEP_IDENTITY_NOT_EXACT");
    return rows[0];
  });
  if (!chain.length || chain.at(-1).stepCode !== targetAuthority.stepCode
      || new Set(chain.map(row => Number(row.stepOrder))).size !== chain.length)
    fail("DIRECT_STEP_CHAIN_NOT_EXACT", `${targetAuthority.processCode}|${targetAuthority.stepCode}`);
  return chain;
}
function primarySuccessBinding(authority) {
  const design = object(authority.composite?.executableDesign, "EXECUTABLE_DESIGN_INVALID");
  const primary = array(design.PROCESS?.commands, "PROCESS_COMMANDS_INVALID")
    .filter(row => row.primary === true && row.commandCode === design.PROCESS?.commandCode);
  if (primary.length !== 1) fail("PRIMARY_COMMAND_NOT_EXACT", authority.stepCode);
  const command = primary[0];
  const operations = array(design.API?.operations, "API_OPERATIONS_INVALID")
    .filter(row => row.commandCode === command.commandCode);
  const transitions = array(design.STATE?.states, "STATE_TRANSITIONS_INVALID")
    .filter(row => row.commandCode === command.commandCode);
  const scenarios = array(design.TEST?.scenarios, "TEST_SCENARIOS_INVALID")
    .filter(row => row.commandCode === command.commandCode && row.expectedStatus === "SUCCESS");
  if (operations.length !== 1 || transitions.length !== 1 || scenarios.length !== 1)
    fail("PRIMARY_SUCCESS_BINDING_NOT_EXACT", `${authority.stepCode}|${command.commandCode}`);
  return { command, operation: operations[0], transition: transitions[0], scenario: scenarios[0] };
}
async function saveDraft({ api, authority, actor, input, timeout, evidence }) {
  const draftQuery = new URLSearchParams({ tenantId: authority.tenantId, projectId: authority.projectId,
    processCode: authority.processCode, stepCode: authority.stepCode });
  const loaded = await jsonCall(api, "GET", `/home/api/process-executions/draft?${draftQuery}`, undefined, [200], timeout);
  const expectedVersion = Number(loaded.body?.draft?.draftVersion || 0);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) fail("FIXTURE_DRAFT_VERSION_INVALID");
  const saved = await jsonCall(api, "PUT", "/home/api/process-executions/draft", {
    tenantId: authority.tenantId, projectId: authority.projectId, processCode: authority.processCode,
    stepCode: authority.stepCode, actorCode: actor, expectedVersion,
    payloadJson: JSON.stringify(input), evidenceJson: JSON.stringify(evidence),
  }, [200], timeout);
  if (String(saved.body?.draft?.draftStatus || "") !== "DRAFT") fail("FIXTURE_DRAFT_NOT_SAVED");
  return saved.body;
}
async function prepareExecution({ root, authorities, authority, actor, input, seed, timeout,
  credentials, plan, runtimeForAudience, dbProbe, databaseTimeout }) {
  const chain = directStepChain(authorities, authority);
  const scope = { tenantId: authority.tenantId, projectId: authority.projectId };
  const today = new Date().toISOString().slice(0, 10);
  const relayed = await relayDeclaredProcessPrerequisites({
    steps: chain,
    targetStepCode: authority.stepCode,
    startExecution: async firstAuthority => {
      const binding = primarySuccessBinding(firstAuthority);
      const selected = selectAccounts(plan, credentials, firstAuthority,
        String(binding.command.actorCode), "SUCCESS", scope);
      const first = { ...firstAuthority, ...scope };
      const runtime = await runtimeForAudience(first.audience);
      const start = await jsonCall(runtime.apiFor(selected.preparation.accountId), "POST",
        "/home/api/process-executions/start", {
          tenantId: first.tenantId, projectId: first.projectId, processCode: first.processCode,
          actorCode: binding.command.actorCode, routePath: first.routePath, audience: first.audience,
          cycleType: "AD_HOC", periodStart: today, periodEnd: today,
          executionVersion: executionVersion(seed),
        }, [200], timeout);
      const execution = object(start.body.execution || start.body, "FIXTURE_EXECUTION_START_INVALID");
      return { executionId: String(execution.executionId || ""),
        currentStepCode: String(execution.currentStepCode || "") };
    },
    executeStep: async ({ executionId, step, next, index }) => {
      const binding = primarySuccessBinding(step);
      const selected = selectAccounts(plan, credentials, step,
        String(binding.command.actorCode), "SUCCESS", scope);
      const scoped = { ...step, ...scope };
      const runtime = await runtimeForAudience(scoped.audience);
      const api = runtime.apiFor(selected.command.accountId);
      const setupSeed = `${seed}|setup|${index}|${step.stepCode}|${binding.command.commandCode}`;
      const setupInput = object(binding.scenario.inputValues, "SETUP_SUCCESS_INPUT_INVALID");
      await saveDraft({ api, authority: scoped, actor: String(binding.command.actorCode),
        input: setupInput, timeout, evidence: { liveSmokeSetupHash: sha256(setupSeed) } });
      const execution = { executionId, ...scope };
      const selector = exactExecutionSelector(execution, scoped, binding.command.commandCode,
        selected.command.accountId);
      const before = dbProbe(root, selector, databaseTimeout);
      const idempotencyKey = deterministicUuid(`${setupSeed}|idempotency`);
      const request = { ...setupInput, ...scope, actorCode: String(binding.command.actorCode), idempotencyKey };
      const observed = await jsonCall(api, String(binding.operation.method).toUpperCase(),
        requestPath(binding.operation, executionId), request, [200], timeout);
      if (!httpObservationExact("SUCCESS", observed.response.status(), observed.body, 200))
        fail("SETUP_SUCCESS_STATUS_MISMATCH", sha256(observed.raw));
      const after = dbProbe(root, selector, databaseTimeout);
      const declared = resolveExpectedOutput(binding.scenario, setupInput, binding.transition, after,
        { idempotencyKey });
      const output = bodyOutput(observed.body,
        array(binding.scenario.expectedOutputFields, "SETUP_SUCCESS_FIELDS_INVALID"));
      if (stable(output) !== stable(declared)) fail("SETUP_SUCCESS_OUTPUT_MISMATCH", stable(output));
      assertDatabase("SUCCESS", before, after, binding.transition, idempotencyKey, false);
      const nextStepCode = String(after.body.execution?.current_step_code || "");
      if (nextStepCode !== String(next.stepCode)) fail("SETUP_NEXT_STEP_NOT_OBSERVED", nextStepCode);
      return { nextStepCode, setupReceiptHash: sha256(`${before.hash}|${after.hash}|${sha256(observed.raw)}`) };
    },
  });
  const targetApi = await runtimeForAudience(authority.audience);
  await saveDraft({ api: targetApi.apiFor(selectAccounts(plan, credentials, authority, actor,
    "SUCCESS", scope).preparation.accountId), authority, actor, input, timeout,
    evidence: { liveSmokeRunHash: sha256(seed), setupReceiptHash: sha256(stable(relayed.setupTransitions)) } });
  return { executionId: relayed.executionId, tenantId: authority.tenantId,
    projectId: authority.projectId, setupTransitions: relayed.setupTransitions };
}
function resolveExpectedOutput(scenario, input, transition, after, reference) {
  const declarations = object(scenario.expectedOutputValues, "TEST_EXPECTED_OUTPUT_VALUES_INVALID");
  const event = array(after.body.events, "DATABASE_EVENTS_INVALID").find(row =>
    String(row.idempotency_key || "") === String(reference.idempotencyKey || ""));
  const output = {};
  for (const [field, raw] of Object.entries(declarations)) {
    const declaration = object(raw, "TEST_EXPECTED_OUTPUT_VALUE_INVALID");
    if (declaration.source === "LITERAL") output[field] = declaration.value;
    else if (declaration.source === "REQUEST") output[field] = input[declaration.path];
    else if (declaration.source === "DECLARED_STATE") output[field] = transition[declaration.path];
    else if (declaration.source === "DATABASE_EVENT") {
      if (!event) fail("DATABASE_EVENT_NOT_OBSERVED", reference.idempotencyKey);
      output[field] = declaration.path === "eventId" ? Number(event.event_id) : event[declaration.path];
    } else if (declaration.source === "REFERENCE_SCENARIO") {
      if (!reference.output || !Object.hasOwn(reference.output, declaration.path)) fail("REFERENCE_SCENARIO_OUTPUT_MISSING", declaration.path);
      output[field] = reference.output[declaration.path];
    } else fail("TEST_EXPECTED_OUTPUT_SOURCE_INVALID", declaration.source);
  }
  return output;
}
function assertDatabase(statusCase, before, after, transition, idempotencyKey, resumed) {
  const beforeStable = stable({ execution: before.body.execution, events: before.body.events, draft: before.body.draft });
  const afterStable = stable({ execution: after.body.execution, events: after.body.events, draft: after.body.draft });
  const matching = array(after.body.events, "DATABASE_EVENTS_INVALID").filter(row =>
    String(row.idempotency_key || "") === idempotencyKey);
  if (resumed) { if (!after.body.execution) fail("DATABASE_EXECUTION_NOT_OBSERVED"); return; }
  if (statusCase === "SUCCESS") {
    if (beforeStable === afterStable || matching.length !== 1
        || String(after.body.execution?.current_state || "") !== String(transition.toState))
      fail("DATABASE_SUCCESS_POSTCONDITION_MISMATCH");
  } else if (statusCase === "RECOVERY") {
    if (beforeStable !== afterStable || matching.length !== 1) fail("DATABASE_RECOVERY_POSTCONDITION_MISMATCH");
  } else if (beforeStable !== afterStable) fail("DATABASE_FAILURE_POSTCONDITION_MISMATCH", statusCase);
}

export async function runPlan({ root, plan, manifest, credentials, password, opsToken, baseURL,
  dbProbe = invokeDbProbe, runtimeFactory = openDeclaredProcessRelayRuntime }) {
  if (!opsToken || !password || !Object.keys(credentials).length) fail("LIVE_SMOKE_SECRET_CONFIGURATION_REQUIRED");
  if (manifest.schema !== "carbonet.composite-live-smoke-runner/v1") fail("LIVE_SMOKE_MANIFEST_INVALID");
  const authorities = array(plan.authorities, "LIVE_SMOKE_AUTHORITIES_MISSING");
  const expected = authorities.reduce((total, authority) => total +
    array(object(authority.composite?.executableDesign, "EXECUTABLE_DESIGN_INVALID").TEST?.scenarios,
      "TEST_SCENARIOS_INVALID").length * 3, 0);
  if (expected !== Number(plan.expectedEvidenceCount)) fail("LIVE_SMOKE_EXPECTED_COUNT_MISMATCH", expected);
  const existing = new Set(array(plan.existingEvidenceKeys || [], "LIVE_SMOKE_EXISTING_KEYS_INVALID").map(String));
  const contexts = new Map(array(plan.existingScenarioContexts || [], "LIVE_SMOKE_EXISTING_CONTEXTS_INVALID")
    .map(row => [`${row.authorityId}|${row.scenarioCode}|${row.statusCase}`, row]));
  const selections = new Map(); const accountIds = new Set();
  for (const authority of authorities) {
    const design = object(authority.composite.executableDesign, "EXECUTABLE_DESIGN_INVALID");
    const commands = array(design.PROCESS?.commands, "PROCESS_COMMANDS_INVALID");
    const scenarios = array(design.TEST?.scenarios, "TEST_SCENARIOS_INVALID");
    if (scenarios.length !== commands.length * 5) fail("TEST_FIVE_STATUS_MATRIX_INVALID");
    for (const command of commands) {
      const cases = scenarios.filter(row => row.commandCode === command.commandCode);
      if (cases.length !== 5 || stable(cases.map(row => row.expectedStatus).sort()) !== stable([...STATUS_CASES].sort()))
        fail("TEST_FIVE_STATUS_MATRIX_INVALID");
      for (const scenario of cases) {
        if (Number(scenario.expectedHttpStatus) !== HTTP_STATUS[scenario.expectedStatus]) fail("TEST_HTTP_STATUS_CONTRACT_INVALID");
        const selection = selectAccounts(plan, credentials, authority, String(command.actorCode), String(scenario.expectedStatus));
        selections.set(`${authority.authorityId}|${scenario.scenarioCode}`, selection);
        accountIds.add(String(selection.command.accountId)); accountIds.add(String(selection.preparation.accountId));
      }
    }
  }
  const runtimeAccounts = Object.fromEntries([...accountIds].map(accountId => [accountId, accountId]));
  let userRuntime, adminRuntime;
  const runtimeForAudience = async audience => String(audience).toUpperCase() === "ADMIN"
    ? (adminRuntime ||= await runtimeFactory({ root, baseURL, password, accounts: runtimeAccounts,
        loginPath: "/admin/login/actionLogin", requestTimeoutMs: Number(manifest.timeouts.requestSeconds) * 1000 }))
    : (userRuntime ||= await runtimeFactory({ root, baseURL, password, accounts: runtimeAccounts,
        requestTimeoutMs: Number(manifest.timeouts.requestSeconds) * 1000 }));
  const evidenceRoot = artifactRoot(root, manifest);
  const outputDirectory = path.join(evidenceRoot, String(plan.dispatchId));
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const produced = []; const openPages = [];
  try {
    for (const authorityRow of authorities) {
      const design = authorityRow.composite.executableDesign;
      const runtime = await runtimeForAudience(authorityRow.audience);
      for (const command of design.PROCESS.commands) {
        const operation = design.API.operations.find(row => row.commandCode === command.commandCode);
        const transition = design.STATE.states.find(row => row.commandCode === command.commandCode);
        const cases = design.TEST.scenarios.filter(row => row.commandCode === command.commandCode)
          .sort((left, right) => EXECUTION_ORDER.indexOf(left.expectedStatus) - EXECUTION_ORDER.indexOf(right.expectedStatus));
        if (!operation || !transition) fail("TEST_COMMAND_BINDING_NOT_EXACT");
        const successReferences = new Map();
        for (const scenario of cases) {
          const statusCase = String(scenario.expectedStatus), input = object(scenario.inputValues, "TEST_INPUT_INVALID");
          const selection = selections.get(`${authorityRow.authorityId}|${scenario.scenarioCode}`);
          const authority = { ...authorityRow, projectId: String(selection.preparation.projectId),
            tenantId: String(selection.preparation.tenantId) };
          const contextKey = `${authority.authorityId}|${scenario.scenarioCode}|${statusCase}`;
          const resumed = contexts.get(contextKey);
          const referenceCode = String(scenario.trigger?.referenceScenarioCode || "");
          const successReference = successReferences.get(referenceCode) || contexts.get(
            `${authority.authorityId}|${referenceCode}|SUCCESS`);
          const runId = deterministicUuid(`${plan.dispatchId}|${evidenceKey(authorityRow, scenario, "RUN")}`);
          let execution, idempotencyKey, before, response, raw, body, browser;
          if (resumed) {
            execution = { executionId: resumed.executionId, tenantId: authority.tenantId, projectId: authority.projectId };
            idempotencyKey = String(resumed.idempotencyKey || "");
            if (!/^[0-9a-fA-F-]{36}$/.test(idempotencyKey)) fail("PARTIAL_EVIDENCE_IDEMPOTENCY_MISSING", contextKey);
            const selector = exactExecutionSelector(execution, authority, command.commandCode, selection.command.accountId);
            before = dbProbe(root, selector, Number(manifest.timeouts.databaseSeconds) * 1000);
            response = { status: () => Number(resumed.observedHttpStatus), headers: () => ({ resumed: "true" }) };
            body = object(resumed.output, "PARTIAL_EVIDENCE_OUTPUT_INVALID"); raw = Buffer.from(stable(body));
            if (!existing.has(evidenceKey(authority, scenario, "BROWSER")))
              fail("PARTIAL_BROWSER_ARTIFACT_CONTEXT_REQUIRED", contextKey);
          } else {
            if (existing.has(evidenceKey(authority, scenario, "DATABASE"))
                || existing.has(evidenceKey(authority, scenario, "BROWSER")))
              fail("PARTIAL_EVIDENCE_API_REFERENCE_REQUIRED", contextKey);
            if (["CONFLICT", "RECOVERY"].includes(statusCase)) {
              if (!successReference) fail("REFERENCE_SCENARIO_EXECUTION_MISSING", referenceCode);
              execution = { executionId: successReference.executionId,
                tenantId: authority.tenantId, projectId: authority.projectId };
            } else execution = await prepareExecution({ root, authorities, authority,
              actor: String(command.actorCode), input, seed: `${plan.dispatchId}|${contextKey}`,
              timeout: Number(manifest.timeouts.requestSeconds) * 1000, credentials, plan,
              runtimeForAudience, dbProbe,
              databaseTimeout: Number(manifest.timeouts.databaseSeconds) * 1000 });
            idempotencyKey = statusCase === "RECOVERY" ? successReference.idempotencyKey
              : deterministicUuid(`${plan.dispatchId}|${authority.authorityId}|${scenario.scenarioCode}|idempotency`);
            const selector = exactExecutionSelector(execution, authority, command.commandCode, selection.command.accountId);
            before = dbProbe(root, selector, Number(manifest.timeouts.databaseSeconds) * 1000);
            browser = await browserCommand({ runtime, baseURL, authority, command, operation, scenario,
              execution, idempotencyKey, runId, selection, statusCase,
              browserTimeout: Number(manifest.timeouts.browserSeconds) * 1000,
              requestTimeout: Number(manifest.timeouts.requestSeconds) * 1000, openPages });
            response = browser.response; raw = browser.raw; body = browser.body;
          }
          if (!httpObservationExact(statusCase, response.status(), body, Number(scenario.expectedHttpStatus)))
            fail("API_STATUS_OBSERVATION_MISMATCH", `${statusCase}|${response.status()}|${sha256(raw)}`);
          const selector = exactExecutionSelector(execution, authority, command.commandCode, selection.command.accountId);
          const after = dbProbe(root, selector, Number(manifest.timeouts.databaseSeconds) * 1000);
          const reference = statusCase === "SUCCESS" ? { idempotencyKey } :
            { idempotencyKey, output: successReference?.output };
          const declared = resolveExpectedOutput(scenario, input, transition, after, reference);
          const output = bodyOutput(body, array(scenario.expectedOutputFields, "TEST_OUTPUT_FIELDS_INVALID"));
          if (stable(output) !== stable(declared)) fail("API_OUTPUT_VALUES_MISMATCH", stable({ output, declared }));
          assertDatabase(statusCase, before, after, transition, idempotencyKey, Boolean(resumed));
          const expectedState = observationState(statusCase, transition);
          if (statusCase === "SUCCESS") successReferences.set(String(scenario.scenarioCode), {
            executionId: execution.executionId, idempotencyKey, output, observedHttpStatus: response.status() });

          let browserArtifacts;
          if (browser) {
            const browserState = browser.state, denied = statusCase === "FORBIDDEN";
            let uiOutput; try { uiOutput = JSON.parse(browserState.outputJson); }
            catch { fail("BROWSER_OUTPUT_JSON_INVALID", browserState.outputJson); }
            if (browserState.path !== browser.browserPath || browserState.fatal
                || browserState.processCode !== authority.processCode || browserState.stepCode !== authority.stepCode
                || browserState.audience !== authority.audience || browserState.runtimeObserved === denied
                || browserState.accessDenied !== denied || browserState.commandCode !== command.commandCode
                || browserState.httpStatus !== response.status() || browserState.statusCase !== statusCase
                || browserState.idempotencyKey !== idempotencyKey || stable(uiOutput) !== stable(body)
                || (!denied && (browserState.tenantId !== authority.tenantId
                  || browserState.projectId !== authority.projectId
                  || browserState.executionId.toLowerCase() !== execution.executionId.toLowerCase()
                  || browserState.currentState !== expectedState)))
              fail("BROWSER_CONTEXT_OBSERVATION_MISMATCH", stable(browserState));
            const domArtifact = await writeImmutableArtifact(evidenceRoot, plan.dispatchId, runId, "DOM",
              Buffer.from(browser.dom));
            const screenshotArtifact = await writeImmutableArtifact(evidenceRoot, plan.dispatchId, runId,
              "SCREENSHOT", browser.screenshot);
            browserArtifacts = { domArtifact, screenshotArtifact };
          }
          const common = { jobId: Number(plan.jobId), authorityId: Number(authority.authorityId),
            scenarioCode: scenario.scenarioCode, statusCase, tenantId: authority.tenantId,
            projectId: authority.projectId, executionId: execution.executionId, idempotencyKey,
            observedHttpStatus: response.status(), input, output, observedState: expectedState,
            runId, artifactHash: plan.artifactManifestHash, observedAt: plan.observedAt };
          const transport = Buffer.concat([Buffer.from(`${response.status()}\n${stable(response.headers())}\n`), raw]);
          const laneRequests = {
            API: { ...common, lane: "API", targetRef: `${String(operation.method).toUpperCase()} ${operation.path}`,
              laneDetails: { transportHash: sha256(transport), httpStatus: response.status() } },
            DATABASE: { ...common, lane: "DATABASE", targetRef: "entity:framework_process_execution",
              laneDetails: { rereadHash: after.hash,
                transactionHash: sha256(Buffer.from(`${before.hash}|${after.hash}|READ_ONLY_REPEATABLE_READ`)) } },
            BROWSER: { ...common, lane: "BROWSER", targetRef: authority.routePath,
              laneDetails: browserArtifacts ? { domHash: browserArtifacts.domArtifact.hash,
                screenshotHash: browserArtifacts.screenshotArtifact.hash,
                domArtifactRef: browserArtifacts.domArtifact.reference,
                screenshotArtifactRef: browserArtifacts.screenshotArtifact.reference, rendered: true,
                runtimeObserved: browser.state.runtimeObserved, accessDenied: browser.state.accessDenied } : null },
          };
          for (const lane of LANES) {
            const key = evidenceKey(authority, scenario, lane); if (existing.has(key)) continue;
            if (!laneRequests[lane].laneDetails) fail("BROWSER_ARTIFACT_EVIDENCE_REQUIRED", key);
            const submitted = await runtime.apiFor(selection.command.accountId).post(manifest.evidenceEndpoint, {
              data: laneRequests[lane], headers: { "X-Resonance-Token": opsToken }, failOnStatusCode: false,
              timeout: Number(manifest.timeouts.requestSeconds) * 1000 });
            const submittedRaw = Buffer.from(await submitted.body());
            if (submitted.status() !== 200) fail(submitted.status() === 409 ? "EVIDENCE_IDEMPOTENCY_CONFLICT" :
              "EVIDENCE_SUBMISSION_REJECTED", `${submitted.status()}|${sha256(submittedRaw)}`);
            let accepted; try { accepted = JSON.parse(submittedRaw.toString("utf8")); }
            catch { fail("EVIDENCE_RESPONSE_INVALID", submittedRaw); }
            produced.push({ key, evidenceHash: accepted.evidenceHash,
              screenshotRef: lane === "BROWSER" ? browserArtifacts.screenshotArtifact.reference : null,
              domRef: lane === "BROWSER" ? browserArtifacts.domArtifact.reference : null });
          }
        }
      }
    }
  } finally {
    for (const context of openPages) await context.close().catch(() => {});
    if (adminRuntime) await adminRuntime.close(); if (userRuntime) await userRuntime.close();
  }
  if (existing.size + produced.length !== expected) fail("LIVE_SMOKE_EVIDENCE_COUNT_NOT_EXACT", `${existing.size + produced.length}|${expected}`);
  const summary = { schema: manifest.schema, dispatchId: Number(plan.dispatchId), expectedEvidenceCount: expected,
    existingEvidenceCount: existing.size, submittedEvidenceCount: produced.length,
    evidenceSetHash: sha256(Buffer.from(stable([...existing, ...produced.map(row => row.key)].sort()))), produced };
  await writeFile(path.join(outputDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  return { ...summary, evidenceDirectoryHash: sha256(Buffer.from(stable(
    produced.flatMap(row => [row.domRef, row.screenshotRef]).filter(Boolean).sort()))) };
}

async function main() {
  const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
  const plan = JSON.parse(await readFile(process.env.CARBONET_COMPOSITE_LIVE_SMOKE_PLAN, "utf8"));
  const manifest = JSON.parse(await readFile(path.join(root, "ops/runtime-metadata/composite-live-smoke-runner.json"), "utf8"));
  const credentials = JSON.parse(process.env.CARBONET_COMPOSITE_RELAY_ACCOUNTS_JSON || "{}");
  const result = await runPlan({ root, plan, manifest, credentials,
    password: String(process.env.CARBONET_ACTOR_TEST_PASSWORD || ""),
    opsToken: String(process.env.RESONANCE_OPS_TOKEN || ""),
    baseURL: String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "") });
  process.stdout.write(`${JSON.stringify({ success: true, ...result })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/,"$1"))) {
  main().catch(error => {
    const code = /^[A-Z][A-Z0-9_]{2,99}$/.test(String(error.code || error.message))
      ? String(error.code || error.message) : "LIVE_SMOKE_RUNNER_FAILED";
    process.stderr.write(`${JSON.stringify({ success: false, code,
      errorHash: error.materialHash || sha256(String(error.name || "Error")) })}\n`);
    process.exitCode = 1;
  });
}
