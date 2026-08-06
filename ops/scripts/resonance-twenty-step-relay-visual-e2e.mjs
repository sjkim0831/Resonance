#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const baseURL = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const prepareOnly = process.env.CARBONET_RELAY_PREPARE_ONLY === "1";
const password = String(process.env.CARBONET_ACTOR_TEST_PASSWORD || "");
if (!password) throw new Error("CARBONET_ACTOR_TEST_PASSWORD is required");

const accounts = {
  COMPANY_MANAGER: "qaowner26",
  SITE_DATA_OWNER: "qadata26",
  CALCULATOR: "qacalc26",
  VERIFIER: "qaverify26",
  APPROVER: "qaapprove26",
};
const processPlan = [
  { code: "EMISSION_PROJECT_PORTFOLIO", expected: 1, firstActor: "COMPANY_MANAGER" },
  { code: "ORGANIZATIONAL_BOUNDARY", expected: 4, firstActor: "COMPANY_MANAGER" },
  { code: "ACTIVITY_DATA", expected: 4, firstActor: "COMPANY_MANAGER" },
  { code: "EMISSION_CALCULATION", expected: 4, firstActor: "COMPANY_MANAGER" },
  { code: "REPORT_CERTIFICATION", expected: 4, firstActor: "COMPANY_MANAGER" },
  { code: "REGULATORY_SUBMISSION", expected: 4, firstActor: "COMPANY_MANAGER" },
];
const expectedStepTotal = processPlan.reduce((total, definition) => total + definition.expected, 0);
const routes = {
  EMISSION_PROJECT_PORTFOLIO_LIST: "/emission/project-portfolio",
  EMISSION_PROJECT_SETUP: "/emission/organizational-boundary",
  EMISSION_PROJECT_COLLECT: "/emission/activity-data",
  EMISSION_PROJECT_CALCULATE: "/emission/calculation",
  EMISSION_PROJECT_VALIDATE: "/emission/validate",
  EMISSION_PROJECT_CORRECT: "/emission/activity-data?mode=correction",
  EMISSION_PROJECT_APPROVE: "/emission/validate?tab=approval",
  EMISSION_PROJECT_REPORT: "/emission/report_submit",
  ORGANIZATIONAL_BOUNDARY_S1: "/emission/organizational-boundary",
  ORGANIZATIONAL_BOUNDARY_S2: "/emission/organizational-boundary",
  ORGANIZATIONAL_BOUNDARY_S3: "/emission/organizational-boundary",
  ORGANIZATIONAL_BOUNDARY_S4: "/emission/organizational-boundary",
  ACTIVITY_DATA_01_PLAN: "/emission/project/detail",
  ACTIVITY_DATA_02_WORK: "/emission/activity-data",
  ACTIVITY_DATA_03_VERIFY: "/emission/validate",
  ACTIVITY_DATA_04_APPROVE: "/emission/validate?tab=approval",
  EMISSION_CALCULATION_01_PLAN: "/emission/project/detail",
  EMISSION_CALCULATION_02_WORK: "/emission/calculation",
  EMISSION_CALCULATION_03_VERIFY: "/emission/validate",
  EMISSION_CALCULATION_04_APPROVE: "/emission/calculation-results",
  REPORT_CERTIFICATION_01_PLAN: "/emission/report_submit",
  REPORT_CERTIFICATION_02_WORK: "/emission/report_submit",
  REPORT_CERTIFICATION_03_VERIFY: "/emission/report_submit?mode=verify",
  REPORT_CERTIFICATION_04_APPROVE: "/emission/report-download",
  REGULATORY_SUBMISSION_S1: "/emission/report-submission",
  REGULATORY_SUBMISSION_S2: "/emission/report-submission",
  REGULATORY_SUBMISSION_S3: "/emission/report-submission",
  REGULATORY_SUBMISSION_S4: "/emission/report-submission",
};
const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "/snap/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].find((candidate) => candidate && existsSync(candidate)) || "";
const fatalText = /React app did not mount|Bootstrap loaded\. Waiting for React app mount|An unexpected error occurred|page processing error/i;
const clients = {};
let browser;
let projectId = "";
let previousRelayStep = null;
const evidence = { startedAt: new Date().toISOString(), projectId: "", processes: [], steps: [], routes: [], transforms: {}, cleanup: false };
let prerequisiteRequirementCount = 0;

function assertMappedTransform(mapping, sourcePayload, mappedPayload) {
  const fromField = String(mapping.fromField || "");
  const toField = String(mapping.toField || "");
  const transform = String(mapping.transform || "IDENTITY").toUpperCase();
  const source = sourcePayload[fromField];
  const mapped = mappedPayload[toField];
  const same = JSON.stringify(source) === JSON.stringify(mapped);
  if (transform === "IDENTITY" && !same) throw new Error(`IDENTITY transform mismatch ${fromField}->${toField}`);
  if (transform === "ARRAY_WRAP" && (!Array.isArray(mapped) || (Array.isArray(source) ? !same : JSON.stringify(mapped) !== JSON.stringify([source])))) {
    throw new Error(`ARRAY_WRAP transform mismatch ${fromField}->${toField}`);
  }
  if (transform === "AGGREGATE_SUM") {
    const values = Array.isArray(source) ? source : [source];
    const expected = values.map((value) => Number(String(value).replaceAll(",", ""))).filter(Number.isFinite)
      .reduce((total, value) => total + value, 0);
    if (!Number.isFinite(Number(mapped)) || Math.abs(Number(mapped) - expected) > 1e-9) {
      throw new Error(`AGGREGATE_SUM transform mismatch ${fromField}->${toField}`);
    }
  }
  if (transform === "LOOKUP_SITE_LABEL" && (typeof mapped !== "string" || !mapped.trim())) {
    throw new Error(`LOOKUP_SITE_LABEL transform mismatch ${fromField}->${toField}`);
  }
  if (!["IDENTITY", "ARRAY_WRAP", "AGGREGATE_SUM", "LOOKUP_SITE_LABEL"].includes(transform)) {
    throw new Error(`unsupported transform reached browser contract: ${transform}`);
  }
  evidence.transforms[transform] = Number(evidence.transforms[transform] || 0) + 1;
}

async function login(user) {
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  const response = await api.post("/signin/actionLogin", {
    data: { userId: user, userPw: password, userSe: "USR" },
    failOnStatusCode: false,
  });
  const body = await response.json().catch(() => ({}));
  if (response.status() !== 200 || body?.status === "loginFailure") throw new Error(`login failed user=${user} status=${response.status()}`);
  return api;
}

async function call(api, method, url, data, expected = [200]) {
  const response = await api[method](url, { ...(data === undefined ? {} : { data }), failOnStatusCode: false });
  const body = await response.json().catch(() => ({}));
  if (!expected.includes(response.status())) {
    throw new Error(`${method.toUpperCase()} ${url} HTTP ${response.status()} ${body?.message || JSON.stringify(body)}`);
  }
  return body;
}

function valueFor(field, context) {
  const code = String(field.fieldCode || field.code || "").toLowerCase();
  const dataType = String(field.dataType || "").toUpperCase();
  const control = String(field.controlType || field.control || "").toUpperCase();
  if (control === "PROJECT_SELECT" || code.includes("project")) return context.projectId;
  if (control === "ACTOR_SELECT" || code.includes("actor")) return context.actor;
  if (control === "SITE_SELECT" || code.includes("site")) return String(context.site);
  if (code.includes("tenant")) return context.tenantId;
  if (code.includes("company") || code.includes("organization")) return "RESONANCE_TEST_COMPANY";
  if (code.includes("account") || code.includes("assignee") || code.includes("owner")) return accounts[context.actor];
  if (dataType === "BOOLEAN" || dataType === "BOOL") return true;
  if (dataType === "INTEGER" || dataType === "DECIMAL" || dataType === "NUMBER") return 1;
  if (dataType === "DATE" || code.endsWith("date") || code.includes("periodstart")) return context.periodStart;
  if (code.includes("periodend") || code.includes("deadline") || code.includes("duedate")) return context.periodEnd;
  if (code.includes("year")) return Number(context.year);
  if (code.includes("status")) return "CONFIRMED";
  if (code.includes("scope")) return "Scope 1";
  if (code.includes("unit")) return "tCO2e";
  if (code.includes("evidence") || code.includes("file")) return `E2E-EVIDENCE-${context.marker}`;
  return `relay-${field.fieldCode || field.code || "value"}-${context.marker}`;
}

async function verifyRoute(api, stepCode, actor, processCode) {
  const raw = routes[stepCode];
  if (!raw) throw new Error(`route missing step=${stepCode}`);
  const target = new URL(raw, baseURL);
  target.searchParams.set("projectId", projectId);
  target.searchParams.set("processCode", processCode);
  target.searchParams.set("stepCode", stepCode);
  target.searchParams.set("actorCode", actor);
  target.searchParams.set("guide", "1");
  const context = await browser.newContext({
    storageState: await api.storageState(),
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const routeStartedAt = Date.now();
    const response = await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForFunction(() => {
      const root = document.querySelector("#root");
      const text = (document.body?.innerText || "").trim();
      const headings = document.querySelectorAll("h1,h2,[role=heading]");
      return (root?.children.length || 0) > 0 && headings.length > 0 && text.length >= 20 &&
        !/불러오는 중|loading/i.test(text) &&
        !/Bootstrap loaded\. Waiting for React app mount|React app did not mount/.test(text);
    }, undefined, { timeout: 8_000 });
    const state = await page.evaluate(() => ({
      text: (document.body?.innerText || "").trim(),
      pathname: location.pathname,
      headings: [...document.querySelectorAll("h1,h2,[role=heading]")].map((node) => (node.textContent || "").trim()),
      language: document.documentElement.lang,
      focusableCount: document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').length,
      formControlCount: document.querySelectorAll("input,select,textarea").length,
      actionCount: document.querySelectorAll("button,a[href]").length,
      emptyActionCount: [...document.querySelectorAll("button,a[href]")].filter((node) =>
        !(node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent || "").trim()).length,
      duplicateIdCount: [...document.querySelectorAll("[id]")].filter((node,index,all) =>
        all.findIndex((candidate) => candidate.id === node.id) !== index).length,
      replacementCharacterCount: ((document.body?.innerText || "").match(/�/g) || []).length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }));
    if ((response?.status() || 0) >= 400) throw new Error(`route HTTP ${response?.status()}`);
    if (/\/signin\/loginView\/?$/.test(state.pathname)) throw new Error("route redirected to login");
    if (fatalText.test(state.text)) throw new Error("fatal UI text");
    if (state.headings.some((heading) => /운영\s*관리\s*대시보드/.test(heading))) throw new Error("fallback dashboard");
    if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);
    if (!state.language || !state.headings.length || !state.focusableCount || state.overflow ||
        state.emptyActionCount || state.duplicateIdCount || state.replacementCharacterCount) {
      throw new Error(`desktop accessibility/responsive baseline failed route=${target.pathname} state=${JSON.stringify(state)}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForFunction(() => (document.querySelector("#root")?.children.length || 0) > 0, undefined, { timeout: 8_000 });
    const mobile = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      visibleText: (document.body?.innerText || "").trim().length,
    }));
    if (mobile.overflow || mobile.visibleText < 20) throw new Error(`mobile responsive baseline failed route=${target.pathname} state=${JSON.stringify(mobile)}`);
    evidence.routes.push({
      processCode, stepCode, actor, path: target.pathname, ok: true,
      headingCount: state.headings.length, focusableCount: state.focusableCount,
      formControlCount: state.formControlCount, actionCount: state.actionCount,
      emptyActionCount: state.emptyActionCount, duplicateIdCount: state.duplicateIdCount,
      replacementCharacterCount: state.replacementCharacterCount,
      desktopOverflow: state.overflow, mobileOverflow: mobile.overflow,
      durationMs: Date.now() - routeStartedAt,
    });
  } finally {
    await context.close();
  }
}

async function runProcess(definition, context) {
  const ownerApi = clients[definition.firstActor];
  const start = await call(ownerApi, "post", "/home/api/process-executions/start", {
    tenantId: context.tenantId,
    projectId,
    processCode: definition.code,
    actorCode: definition.firstActor,
    cycleType: definition.code === "EMISSION_PROJECT_PORTFOLIO" ? "ONCE" : "ANNUAL",
    periodStart: definition.code === "EMISSION_PROJECT_PORTFOLIO" ? "" : context.periodStart,
    periodEnd: definition.code === "EMISSION_PROJECT_PORTFOLIO" ? "" : context.periodEnd,
    siteScopeJson: JSON.stringify([String(context.site)]),
    methodologyVersion: "ISO_14064_1_2018",
    boundaryVersion: "OPERATIONAL_CONTROL_V1",
    executionVersion: 1,
  });
  const nested = start.execution || {};
  const executionId = String(start.executionId || nested.executionId || "");
  let stepCode = String(start.currentStepCode || nested.currentStepCode || "");
  let actor = definition.firstActor;
  if (!executionId || !stepCode) throw new Error(`execution start incomplete process=${definition.code} ${JSON.stringify(start)}`);
  const uniqueSteps = new Set();
  let transitionCount = 0;
  let correctionCovered = false;
  while (stepCode) {
    if (++transitionCount > 15) throw new Error(`transition loop process=${definition.code}`);
    const api = clients[actor];
    if (!api) throw new Error(`test account missing actor=${actor}`);
    await verifyRoute(api, stepCode, actor, definition.code);
    const query = new URLSearchParams({
      tenantId: context.tenantId, projectId, processCode: definition.code, stepCode,
    });
    const draft = await call(api, "get", `/home/api/process-executions/draft?${query}`);
    const contract = draft.contract || {};
    const upstream = draft.handoff || {};
    const prerequisites = draft.prerequisiteReadiness || {};
    if (!Array.isArray(prerequisites.items) || Number(prerequisites.blockingMissingCount || 0) !== 0) {
      throw new Error(`prerequisite readiness failed ${definition.code}/${stepCode} ${JSON.stringify(prerequisites)}`);
    }
    prerequisiteRequirementCount += Number(prerequisites.requirementCount || 0);
    const defaultPayload = typeof draft.defaultPayloadJson === "string"
      ? JSON.parse(draft.defaultPayloadJson || "{}") : (draft.defaultPayloadJson || {});
    for (const requiredContext of ["tenantId", "projectId", "processCode", "stepCode", "actorCode"]) {
      if (!String(defaultPayload[requiredContext] || "").trim()) {
        throw new Error(`execution default missing ${requiredContext} at ${definition.code}/${stepCode}`);
      }
    }
    if (previousRelayStep) {
      if (String(upstream.fromProcessCode || "") !== previousRelayStep.processCode ||
          String(upstream.fromStepCode || "") !== previousRelayStep.stepCode ||
          !String(upstream.payloadJson || "").trim()) {
        throw new Error(`data handoff mismatch expected=${previousRelayStep.processCode}/${previousRelayStep.stepCode} actual=${upstream.fromProcessCode || ""}/${upstream.fromStepCode || ""}`);
      }
      const sourcePayload = JSON.parse(String(upstream.payloadJson || "{}"));
      const mappedPayload = JSON.parse(String(upstream.mappedPayloadJson || "{}"));
      const mappingContract = JSON.parse(String(upstream.mappingContractJson || "{}"));
      const fieldMappings = Array.isArray(mappingContract.fieldMappings) ? mappingContract.fieldMappings : [];
      const unmappedTargetFields = Array.isArray(mappingContract.unmappedTargetFields) ? mappingContract.unmappedTargetFields : [];
      const unmappedFieldPolicies = Array.isArray(mappingContract.unmappedFieldPolicies) ? mappingContract.unmappedFieldPolicies : [];
      if (!Array.isArray(mappingContract.contextMappings) ||
          fieldMappings.length + unmappedTargetFields.length !== Number(mappingContract.targetFieldCount || 0) ||
          unmappedFieldPolicies.length !== unmappedTargetFields.length || mappingContract.inputPolicyMode !== "FAIL_CLOSED") {
        throw new Error("semantic mapping classification incomplete " + previousRelayStep.processCode + "/" + previousRelayStep.stepCode);
      }
      const policyCodes = new Set(unmappedFieldPolicies.map((policy) => String(policy.fieldCode || "")));
      if (unmappedTargetFields.some((fieldCode) => !policyCodes.has(String(fieldCode))) ||
          unmappedFieldPolicies.some((policy) => !["AUTO_CONTEXT", "SYSTEM_DERIVED", "DOMAIN_ACTION", "USER_REQUIRED", "USER_OPTIONAL"].includes(String(policy.inputClass || "")))) {
        throw new Error("unmapped input policy is not closed " + previousRelayStep.processCode + "/" + previousRelayStep.stepCode);
      }
      const expectedMapped = fieldMappings.filter((mapping) => Object.hasOwn(sourcePayload, String(mapping.fromField || "")));
      if (expectedMapped.some((mapping) => !Object.hasOwn(mappedPayload, String(mapping.toField || "")))) {
        throw new Error("mapped payload missing contracted target " + previousRelayStep.processCode + "/" + previousRelayStep.stepCode);
      }
      expectedMapped.forEach((mapping) => assertMappedTransform(mapping, sourcePayload, mappedPayload));
    }
    if (String(contract.actorCode) !== actor) throw new Error(`actor contract mismatch step=${stepCode}`);
    const fields = JSON.parse(String(contract.fieldContractJson || "[]"));
    if (!Array.isArray(fields) || fields.length < 1) throw new Error(`field contract empty step=${stepCode}`);
    const payload = Object.fromEntries(
      fields
        .filter((field) => field.editable !== false)
        .map((field) => [String(field.fieldCode || field.code), valueFor(field, { ...context, actor })])
        .filter(([key]) => key),
    );
    const saved = await call(api, "put", "/home/api/process-executions/draft", {
      tenantId: context.tenantId, projectId, processCode: definition.code, stepCode, actorCode: actor,
      payloadJson: JSON.stringify(payload),
      evidenceJson: JSON.stringify({ source: "TWENTY_STEP_USER_RELAY", route: routes[stepCode], marker: context.marker }),
      expectedVersion: Number(draft.draft?.draftVersion || 0),
    });
    const command = {
      tenantId: context.tenantId, projectId, processCode: definition.code, stepCode, actorCode: actor,
      commandCode: String(contract.commandCode),
      idempotencyKey: `relay-${context.marker}-${definition.code}-${stepCode}-${transitionCount}`,
      requireDraft: true,
      snapshotRef: `relay:${projectId}:${definition.code}:${stepCode}:${transitionCount}`,
      requestJson: JSON.stringify({ payload, draftVersion: saved.draft?.draftVersion || 1 }),
      resultJson: JSON.stringify({ verifiedBy: accounts[actor], route: routes[stepCode] }),
    };
    if (definition.code === "EMISSION_PROJECT" && stepCode === "EMISSION_PROJECT_VALIDATE" && !correctionCovered) {
      command.requestedToState = "CORRECTION_REQUIRED";
      correctionCovered = true;
    }
    const completed = await call(api, "post", `/home/api/process-executions/${executionId}/commands`, command);
    uniqueSteps.add(stepCode);
    evidence.steps.push({
      ordinal: evidence.steps.length + 1,
      processCode: definition.code,
      stepCode,
      actor,
      account: accounts[actor],
      fieldCount: fields.length,
      requiredFieldCount: fields.filter((field) => field.required === true).length,
      route: routes[stepCode],
      toState: completed.toState,
      nextActor: completed.nextActorCode || "",
      handoffStatus: completed.handoffStatus,
      upstreamProcessCode: String(upstream.fromProcessCode || ""),
      upstreamStepCode: String(upstream.fromStepCode || ""),
      mappedFieldCount: Object.keys(JSON.parse(String(upstream.mappedPayloadJson || "{}"))).length,
    });
    previousRelayStep = { processCode: definition.code, stepCode };
    stepCode = String(completed.nextStepCode || "");
    actor = String(completed.nextActorCode || "");
  }
  if (uniqueSteps.size !== definition.expected) {
    throw new Error(`unique step mismatch process=${definition.code} expected=${definition.expected} actual=${uniqueSteps.size}`);
  }
  const expectedNext = {
    EMISSION_PROJECT_PORTFOLIO: "ORGANIZATIONAL_BOUNDARY",
    ORGANIZATIONAL_BOUNDARY: "ACTIVITY_DATA",
    ACTIVITY_DATA: "EMISSION_CALCULATION",
    EMISSION_CALCULATION: "REPORT_CERTIFICATION",
    REPORT_CERTIFICATION: "REGULATORY_SUBMISSION",
  }[definition.code];
  if (expectedNext) {
    const chained = await call(clients.COMPANY_MANAGER, "get", `/home/api/process-executions?${new URLSearchParams({
      tenantId: context.tenantId,
      projectId,
      processCode: expectedNext,
    })}`);
    if (!chained.found || chained.executionStatus !== "RUNNING") {
      throw new Error(`next process was not auto-started process=${definition.code} next=${expectedNext}`);
    }
  }
  evidence.processes.push({
    processCode: definition.code,
    uniqueSteps: uniqueSteps.size,
    transitions: transitionCount,
    correctionBranch: correctionCovered,
    status: "COMPLETED",
  });
}

try {
  for (const [actor, user] of Object.entries(accounts)) clients[actor] = await login(user);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const options = await call(clients.COMPANY_MANAGER, "get", "/home/api/emission-projects/options");
  if (!options?.readiness?.ready || !options?.sites?.length) throw new Error("project creation readiness is incomplete");
  const year = String(new Date().getUTCFullYear());
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const periodStart = `${year}-01-01`;
  const periodEnd = `${year}-12-31`;
  const created = await call(clients.COMPANY_MANAGER, "post", "/home/api/emission-projects", {
    clientRequestId: `twenty-step-${marker}`,
    name: `Twenty-step relay ${marker}`,
    site: options.sites[0],
    owner: accounts.COMPANY_MANAGER,
    dataOwner: accounts.SITE_DATA_OWNER,
    calculator: accounts.CALCULATOR,
    verifier: accounts.VERIFIER,
    approver: accounts.APPROVER,
    reportingYear: year,
    periodStart,
    periodEnd,
    dueDate: periodEnd,
    scopes: ["Scope 1", "Scope 2"],
    organizationBoundary: "OPERATIONAL_CONTROL",
    emissionStandard: "ISO_14064_1",
    methodologyVersion: "2018",
    verificationLevel: "LIMITED",
    collectionCycle: "MONTHLY",
    materialityThreshold: "5",
  });
  projectId = String(created.id || "");
  if (!projectId) throw new Error("project id missing");
  evidence.projectId = projectId;
  const context = {
    projectId,
    tenantId: String(created.tenantId || options.tenantId || "DEFAULT"),
    site: options.sites[0],
    year,
    periodStart,
    periodEnd,
    marker,
  };
  if (prepareOnly) {
    const first = processPlan[0];
    const started = await call(clients.COMPANY_MANAGER, "post", "/home/api/process-executions/start", {
      tenantId: context.tenantId,
      projectId,
      processCode: first.code,
      actorCode: first.firstActor,
      cycleType: "ONCE",
      periodStart: "",
      periodEnd: "",
      siteScopeJson: JSON.stringify([String(context.site)]),
      methodologyVersion: "ISO_14064_1_2018",
      boundaryVersion: "OPERATIONAL_CONTROL_V1",
      executionVersion: 1,
    });
    const execution = started.execution || started;
    const stepCode = String(started.currentStepCode || execution.currentStepCode || "");
    if (!stepCode) throw new Error("prepared relay first step missing");
    await verifyRoute(clients.COMPANY_MANAGER, stepCode, first.firstActor, first.code);
    evidence.prepared = {
      processCode: first.code,
      stepCode,
      actorCode: first.firstActor,
      account: accounts.COMPANY_MANAGER,
      executionId: String(started.executionId || execution.executionId || ""),
    };
    evidence.finishedAt = new Date().toISOString();
    evidence.durationMs = Date.now() - Date.parse(evidence.startedAt);
  } else {
    for (const definition of processPlan) await runProcess(definition, context);
    const uniqueSteps = new Set(evidence.steps.map((step) => `${step.processCode}:${step.stepCode}`));
    if (uniqueSteps.size !== expectedStepTotal) throw new Error(`canonical relay coverage mismatch expected=${expectedStepTotal} actual=${uniqueSteps.size}`);
    if (evidence.routes.length < expectedStepTotal) throw new Error(`route coverage mismatch expected=${expectedStepTotal} actual=${evidence.routes.length}`);
    if (prerequisiteRequirementCount !== 21) throw new Error(`prerequisite coverage mismatch expected=21 actual=${prerequisiteRequirementCount}`);
    evidence.finishedAt = new Date().toISOString();
    evidence.durationMs = Date.now() - Date.parse(evidence.startedAt);
    evidence.summary = {
      processes: evidence.processes.length,
      uniqueSteps: uniqueSteps.size,
      transitions: evidence.steps.length,
      accounts: Object.keys(accounts).length,
      routes: evidence.routes.length,
      dataHandoffs: evidence.steps.filter((step) => step.upstreamStepCode).length,
      prerequisiteRequirements: prerequisiteRequirementCount,
      responsive: 1,
      accessibility: 1,
    };
  }
} finally {
  if (!prepareOnly && projectId && clients.COMPANY_MANAGER) {
    const removed = await call(clients.COMPANY_MANAGER, "delete", `/home/api/emission-projects/${projectId}`, undefined, [200])
      .catch((error) => ({ success: false, error: error.message }));
    evidence.cleanup = removed.success === true;
    const tasks = await call(clients.COMPANY_MANAGER, "get", "/home/api/emission-tasks").catch(() => ({ items: [] }));
    evidence.residualTaskCount = (tasks.items || []).filter((item) => String(item.projectId) === projectId).length;
  }
  if (browser) await browser.close();
  await Promise.all(Object.values(clients).map((client) => client.dispose()));
  const outputDir = path.join(root, "var/test-evidence");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "twenty-step-relay-latest.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}

if (!prepareOnly && (!evidence.cleanup || evidence.residualTaskCount !== 0)) {
  throw new Error(`cleanup failed project=${projectId} residualTasks=${evidence.residualTaskCount}`);
}
if (prepareOnly) {
  console.log(`TWENTY_STEP_RELAY_READY project=${projectId} process=${evidence.prepared.processCode} step=${evidence.prepared.stepCode} actor=${evidence.prepared.actorCode} durationMs=${evidence.durationMs}`);
} else {
  console.log(`CANONICAL_RELAY_PASS project=deleted processes=${processPlan.length} uniqueSteps=${expectedStepTotal} transitions=${evidence.steps.length} accounts=${Object.keys(accounts).length} routes=${evidence.routes.length} cleanup=verified durationMs=${evidence.durationMs}`);
}
