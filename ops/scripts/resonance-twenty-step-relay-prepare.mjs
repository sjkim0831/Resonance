#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { request } = require("@playwright/test");
const baseURL = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const password = String(process.env.CARBONET_ACTOR_TEST_PASSWORD || "");
if (!password) throw new Error("CARBONET_ACTOR_TEST_PASSWORD is required");

const accounts = {
  COMPANY_MANAGER: "qaowner26",
  SITE_DATA_OWNER: "qadata26",
  CALCULATOR: "qacalc26",
  VERIFIER: "qaverify26",
  APPROVER: "qaapprove26",
};

async function call(api, method, url, data, expected = [200]) {
  const response = await api[method](url, { ...(data === undefined ? {} : { data }), failOnStatusCode: false });
  const body = await response.json().catch(() => ({}));
  if (!expected.includes(response.status())) {
    throw new Error(`${method.toUpperCase()} ${url} HTTP ${response.status()} ${body?.message || JSON.stringify(body)}`);
  }
  return body;
}

const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
let projectId = "";
let ready = false;
const startedAt = Date.now();
try {
  const login = await api.post("/signin/actionLogin", {
    data: { userId: accounts.COMPANY_MANAGER, userPw: password, userSe: "USR" },
    failOnStatusCode: false,
  });
  if (login.status() !== 200) throw new Error(`login failed HTTP ${login.status()}`);

  const options = await call(api, "get", "/home/api/emission-projects/options");
  if (!options?.readiness?.ready || !options?.sites?.length) throw new Error("project creation readiness is incomplete");
  const year = String(new Date().getUTCFullYear());
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const periodStart = `${year}-01-01`;
  const periodEnd = `${year}-12-31`;
  const created = await call(api, "post", "/home/api/emission-projects", {
    clientRequestId: `manual-relay-${marker}`,
    name: `Manual twenty-step relay ${marker}`,
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
  const tenantId = String(created.tenantId || options.tenantId || "DEFAULT");
  const processCode = "EMISSION_PROJECT_PORTFOLIO";
  const actorCode = "COMPANY_MANAGER";
  const workflowHealth = created.workflowHealth || {};
  if (String(workflowHealth.status || "") !== "READY" || Number(workflowHealth.missingPredecessorCount || 0) !== 0) {
    throw new Error(`project workflow is not ready: ${JSON.stringify(workflowHealth)}`);
  }
  const started = await call(api, "post", "/home/api/process-executions/start", {
    tenantId,
    projectId,
    processCode,
    actorCode,
    cycleType: "ONCE",
    periodStart: "",
    periodEnd: "",
    siteScopeJson: JSON.stringify([String(options.sites[0])]),
    methodologyVersion: "ISO_14064_1_2018",
    boundaryVersion: "OPERATIONAL_CONTROL_V1",
    executionVersion: 2,
  });
  const execution = started.execution || started;
  const executionId = String(started.executionId || execution.executionId || "");
  const stepCode = String(started.currentStepCode || execution.currentStepCode || "");
  if (!executionId || !stepCode) throw new Error("first execution was not created");
  const query = new URLSearchParams({ tenantId, projectId, processCode, stepCode });
  const draft = await call(api, "get", `/home/api/process-executions/draft?${query}`);
  const fields = JSON.parse(String(draft.contract?.fieldContractJson || "[]"));
  if (!Array.isArray(fields) || fields.length === 0) throw new Error("first step field contract is empty");
  const route = new URL("/work/execution", baseURL);
  route.searchParams.set("projectId", projectId);
  route.searchParams.set("processCode", processCode);
  route.searchParams.set("stepCode", stepCode);
  route.searchParams.set("actorCode", actorCode);
  route.searchParams.set("guide", "1");
  const page = await api.get(route.href, { failOnStatusCode: false });
  if (page.status() !== 200) throw new Error(`first work screen HTTP ${page.status()}`);
  const evidence = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    projectId,
    tenantId,
    processCode,
    stepCode,
    actorCode,
    account: accounts.COMPANY_MANAGER,
    executionId,
    fieldCount: fields.length,
    requiredFieldCount: fields.filter((field) => field.required === true).length,
    route: route.pathname + route.search,
    relayProcessCount: 5,
    relayUniqueStepCount: 20,
    relayTransitionCount: 21,
    relayAccountCount: 5,
    status: "READY",
    durationMs: Date.now() - startedAt,
  };
  const outputDir = path.join(root, "var/test-evidence");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "twenty-step-relay-ready-latest.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  ready = true;
  console.log(`TWENTY_STEP_RELAY_READY project=${projectId} process=${processCode} step=${stepCode} actor=${actorCode} fields=${fields.length} durationMs=${evidence.durationMs}`);
} finally {
  if (!ready && projectId) {
    await call(api, "delete", `/home/api/emission-projects/${projectId}`, undefined, [200]).catch(() => undefined);
  }
  await api.dispose();
}
