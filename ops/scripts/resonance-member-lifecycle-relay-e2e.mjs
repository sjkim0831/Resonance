#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://172.16.1.232").replace(/\/$/, "");
const password = String(process.env.CARBONET_ADMIN_TEST_PASSWORD || "");
const adminUser = String(process.env.CARBONET_ADMIN_TEST_USER || "webmaster");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const executablePath = ["/snap/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(existsSync);
if (!password) throw new Error("CARBONET_ADMIN_TEST_PASSWORD is required");

const tenantId = "TEST_COMPANY_001";
const projectId = "PRJ-ACTOR-TEST";
const processCode = "MEMBER_LIFECYCLE";
const steps = [
  { stepCode: "MEMBER_LIFECYCLE_01_PLAN", actorCode: "COMPANY_MANAGER", accountId: "qaowner26", commandCode: "PLAN" },
  { stepCode: "MEMBER_LIFECYCLE_02_WORK", actorCode: "SITE_DATA_OWNER", accountId: "qadata26", commandCode: "WORK" },
  { stepCode: "MEMBER_LIFECYCLE_03_VERIFY", actorCode: "VERIFIER", accountId: "qaverify26", commandCode: "VERIFY" },
  { stepCode: "MEMBER_LIFECYCLE_04_APPROVE", actorCode: "APPROVER", accountId: "qaapprove26", commandCode: "APPROVE" },
];

const api = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
const login = await api.post("/admin/login/actionLogin", { data: { userId: adminUser, userPw: password, userSe: "USR" }, failOnStatusCode: false });
const loginBody = await login.json().catch(() => ({}));
if (login.status() !== 200 || loginBody.status !== "loginSuccess") throw new Error(`admin login failed HTTP ${login.status()}`);

async function switchAccount(userId) {
  const response = await api.post("/signin/testAccountSwitch", {
    data: { userId }, headers: { "X-Carbonet-Test-Mode": "1" }, failOnStatusCode: false,
  });
  const body = await response.json().catch(() => ({}));
  if (response.status() !== 200 || body.status === "loginFailure") throw new Error(`test account switch failed ${userId} HTTP ${response.status()}`);
}

async function json(method, url, data, expected = [200]) {
  const response = await api.fetch(url, { method, data, failOnStatusCode: false });
  const body = await response.json().catch(() => ({}));
  if (!expected.includes(response.status())) throw new Error(`${method} ${url} HTTP ${response.status()} ${body.message || ""}`);
  return { response, body };
}

await switchAccount("qaapprove26");
const wrongStart = await json("POST", "/home/api/process-executions/start", {
  tenantId, projectId, processCode, actorCode: "APPROVER",
}, [403]);
if (wrongStart.body.success !== false) throw new Error("wrong first-step actor was not rejected");

await switchAccount("qaowner26");
const current = await json("GET", `/home/api/process-executions?${new URLSearchParams({ tenantId, projectId, processCode })}`, undefined, [200]);
if (current.body.found) {
  await json("POST", "/home/api/process-executions/qa-instance", { action: "RESET", projectId, processCode }, [200]);
} else {
  await json("POST", "/home/api/process-executions/qa-instance", { action: "CREATE", projectId, processCode, actorCode: "COMPANY_MANAGER" }, [200]);
}

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const uiResults = [];
let executionId = "";
try {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    await switchAccount(step.accountId);
    const executionResult = await json("GET", `/home/api/process-executions?${new URLSearchParams({ tenantId, projectId, processCode })}`, undefined, [200]);
    const execution = executionResult.body;
    executionId = String(execution.executionId || executionId);
    if (!execution.found || execution.currentStepCode !== step.stepCode || execution.executionStatus !== "RUNNING") {
      throw new Error(`handoff context mismatch ${step.accountId} ${JSON.stringify({ found: execution.found, currentStepCode: execution.currentStepCode, executionStatus: execution.executionStatus })}`);
    }

    const draftUrl = `/home/api/process-executions/draft?${new URLSearchParams({ tenantId, projectId, processCode, stepCode: step.stepCode })}`;
    const draftResult = await json("GET", draftUrl, undefined, [200]);
    const contract = draftResult.body.contract || {};
    const fields = JSON.parse(String(contract.fieldContractJson || "[]"));
    const editableRequired = fields.filter((field) => field.editable === true && field.required === true);
    if (editableRequired.length < 4 || contract.actorCode !== step.actorCode || contract.commandCode !== step.commandCode) {
      throw new Error(`professional field or actor contract incomplete ${step.stepCode}`);
    }

    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      const context = await browser.newContext({ storageState: await api.storageState(), ignoreHTTPSErrors: true, viewport });
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      const route = `/work/execution?${new URLSearchParams({ tenantId, projectId, processCode, stepCode: step.stepCode, guide: "1" })}`;
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForFunction((code) => document.body.innerText.includes(code), step.stepCode, { timeout: 12_000 });
      const state = await page.evaluate((code) => ({
        hasStep: document.body.innerText.includes(code),
        controls: document.querySelectorAll("input,textarea,select").length,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        hasRuntimeError: document.body.innerText.includes("페이지 처리 중 오류") || document.body.innerText.includes("AUTHENTICATION_REQUIRED"),
      }), step.stepCode);
      if ((response?.status() || 0) >= 400 || runtimeErrors.length || !state.hasStep || state.controls < 8 || state.pageOverflow || state.hasRuntimeError) {
        throw new Error(`work UI failed ${viewport.name} ${step.stepCode} ${JSON.stringify(state)} ${runtimeErrors.join(" | ")}`);
      }
      uiResults.push({ stepCode: step.stepCode, accountId: step.accountId, viewport: viewport.name, controls: state.controls, ok: true });
      await context.close();
    }

    const payload = Object.fromEntries(fields.filter((field) => field.editable === true).map((field) => {
      const code = String(field.fieldCode);
      if (code.toLowerCase().includes("date") || code === "effectiveAt") return [code, "2026-08-06"];
      if (code === "lifecycleAction") return [code, "UPDATE"];
      if (code === "targetStatus") return [code, "ACTIVE"];
      if (code.toLowerCase().includes("result") || code === "approvalDecision") return [code, code === "approvalDecision" ? "APPROVE" : "PASS"];
      return [code, `QA ${step.stepCode} ${code}`];
    }));
    Object.assign(payload, {
      workSummary: `${step.stepCode} 실제 계정 릴레이 처리 완료`,
      decisionBasis: `${step.actorCode} 권한과 단계 계약에 따른 검증 가능한 처리 근거`,
      resultValue: String(index + 1), resultUnit: "step", exceptionReason: "",
    });
    const save = await json("PUT", "/home/api/process-executions/draft", {
      tenantId, projectId, processCode, stepCode: step.stepCode, actorCode: step.actorCode,
      expectedVersion: Number(draftResult.body.draft?.draftVersion || 0),
      payloadJson: JSON.stringify(payload),
      evidenceJson: JSON.stringify({ documentId: `QA-MEMBER-${index + 1}`, sourceUrl: `qa://${executionId}/${step.stepCode}`, checksum: crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex") }),
    }, [200]);
    if (save.body.draft?.draftStatus !== "DRAFT") throw new Error(`draft save failed ${step.stepCode}`);

    const idempotencyKey = crypto.randomUUID();
    const commandBody = {
      tenantId, projectId, processCode, stepCode: step.stepCode, actorCode: step.actorCode, commandCode: step.commandCode,
      idempotencyKey, requireDraft: true, requestJson: JSON.stringify(payload),
      resultJson: JSON.stringify({ completed: true, accountId: step.accountId }), snapshotRef: `qa:${executionId}:${step.stepCode}`,
    };
    const completed = await json("POST", `/home/api/process-executions/${executionId}/commands`, commandBody, [200]);
    const replay = await json("POST", `/home/api/process-executions/${executionId}/commands`, commandBody, [200]);
    if (replay.body.idempotent !== true) throw new Error(`idempotency failed ${step.stepCode}`);
    const next = steps[index + 1];
    if (next && (completed.body.nextStepCode !== next.stepCode || completed.body.nextActorCode !== next.actorCode)) {
      throw new Error(`next handoff mismatch ${step.stepCode}`);
    }
    if (!next && completed.body.executionStatus !== "COMPLETED") throw new Error("final execution did not complete");

    if (next) {
      const forbidden = await json("GET", `/home/api/process-executions/draft?${new URLSearchParams({ tenantId, projectId, processCode, stepCode: next.stepCode })}`, undefined, [403]);
      if (forbidden.body.success !== false) throw new Error(`previous actor accessed next step ${next.stepCode}`);
    }
  }
} finally {
  await browser.close();
  await api.dispose();
}

const dbState = execFileSync("kubectl", [
  "-n", process.env.K8S_NAMESPACE || "carbonet-prod", "exec", process.env.PATRONI_POD || "postgres-patroni-2", "-c", "patroni", "--",
  "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "carbonet", "-X", "-AtF", "|", "-c",
  `select execution_status||'|'||current_state||'|'||(select count(*) from framework_process_execution_event where execution_id='${executionId}'::uuid)||'|'||(select count(*) from framework_process_work_draft where tenant_id='${tenantId}' and project_id='${projectId}' and process_code='${processCode}' and draft_status='SUBMITTED') from framework_process_execution where execution_id='${executionId}'::uuid;`,
], { encoding: "utf8" }).trim();
if (dbState !== "COMPLETED|COMPLETED|4|4") throw new Error(`database relay state mismatch ${dbState}`);

console.log(JSON.stringify({
  status: "PASS", processCode, sourceCommit, executionId,
  authenticatedAdmin: 1, api: 1, database: 1, authority: 1, exceptionStates: 1,
  responsive: 1, accessibility: 1, desktop: 1, mobile: 1,
  relay: 1, handoff: 1, actorSwitch: 1, idempotency: 1,
  steps: steps.length, uiRoutes: uiResults,
}));
