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
const users = { owner: "qaowner26", data: "qadata26", calculator: "qacalc26", verifier: "qaverify26", approver: "qaapprove26" };
if (!password) throw new Error("CARBONET_ACTOR_TEST_PASSWORD is required");

const clients = {};
let projectId = "";
const evidence = { startedAt: new Date().toISOString(), steps: [], projectId: "", cleanup: false };
const mark = (step, detail = {}) => evidence.steps.push({ step, at: new Date().toISOString(), ...detail });

async function login(user) {
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  const response = await api.post("/signin/actionLogin", { data: { userId: user, userPw: password, userSe: "USR" }, failOnStatusCode: false });
  const body = await response.json().catch(() => ({}));
  if (response.status() !== 200 || body?.status === "loginFailure") throw new Error(`login failed user=${user} status=${response.status()}`);
  return api;
}

async function call(api, method, url, data, expected = [200]) {
  const response = await api[method](url, { ...(data === undefined ? {} : { data }), failOnStatusCode: false });
  const body = await response.json().catch(() => ({}));
  if (!expected.includes(response.status())) throw new Error(`${method.toUpperCase()} ${url} HTTP ${response.status()} ${body?.message || JSON.stringify(body)}`);
  return body;
}

try {
  for (const [role, user] of Object.entries(users)) clients[role] = await login(user);
  const options = await call(clients.owner, "get", "/home/api/emission-projects/options");
  if (!options?.readiness?.ready || !options?.sites?.length) throw new Error("project creation readiness is incomplete");
  const year = String(new Date().getUTCFullYear());
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await call(clients.owner, "post", "/home/api/emission-projects", {
    clientRequestId: `seven-step-${marker}`,
    name: `Seven-step disposable ${marker}`,
    site: options.sites[0], owner: users.owner, dataOwner: users.data, calculator: users.calculator,
    verifier: users.verifier, approver: users.approver, reportingYear: year,
    periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, dueDate: `${year}-12-31`,
    scopes: ["Scope 1", "Scope 2"], organizationBoundary: "OPERATIONAL_CONTROL",
    emissionStandard: "ISO_14064_1", methodologyVersion: "2018", verificationLevel: "LIMITED",
    collectionCycle: "MONTHLY", materialityThreshold: "5",
  });
  projectId = String(created.id || ""); evidence.projectId = projectId;
  if (!projectId) throw new Error("project id missing");
  mark("BASIC_INFO", { status: "DONE" });

  const dueDate = `${year}-12-31`;
  const initialRequests = await call(clients.owner, "get", `/home/api/emission-projects/${projectId}/activity-requests`);
  const precreated = (initialRequests.items || []).find((item) => item.status === "REQUESTED" && String(item.assignee).toLowerCase() === users.data);
  const requestCreated = precreated || await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/activity-requests`, {
    title: "Monthly electricity evidence", detail: "Disposable full-lifecycle verification request",
    requestedItems: "Electricity usage and source reference", assignee: users.data, dueDate,
  });
  const requestId = Number(requestCreated.id);
  await call(clients.data, "post", `/home/api/emission-projects/${projectId}/activity-requests/${requestId}/start`);

  const activityView = await call(clients.data, "get", `/home/api/emission-projects/${projectId}/activities`);
  const factor = (activityView.factors || []).find((item) => Number(item.value || 0) > 0 && item.name && item.category && item.unit);
  if (!factor) throw new Error("usable emission factor missing");
  const activity = await call(clients.data, "post", `/home/api/emission-projects/${projectId}/activities`, {
    name: factor.name, category: factor.category, period: `${year}-01`, quantity: "10", unit: factor.unit,
    note: `Automated evidence ${marker}`,
  });
  const activityId = Number(activity.id ?? activity);
  if (!activityId) throw new Error("activity id missing");
  const quality = await call(clients.data, "post", `/home/api/emission-projects/${projectId}/quality`);
  if (quality.submitReady !== true) throw new Error(`quality blocked ${JSON.stringify(quality.issues || [])}`);
  const submission = await call(clients.data, "post", `/home/api/emission-projects/${projectId}/submissions`, { idempotencyKey: `submission-${marker}` });
  const submissionId = Number(submission.id);
  await call(clients.data, "post", `/home/api/emission-projects/${projectId}/submissions/${submissionId}/submit`, { activityIds: [activityId], requestId });
  await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/activity-requests/${requestId}/decision`, { decision: "ACCEPT" });
  mark("ACTIVITY_DATA", { status: "DONE", activityId, submissionId, requestId, qualityScore: quality.score });

  await call(clients.calculator, "post", `/home/api/emission-projects/${projectId}/activities/auto-map`);
  const calculationSource = await call(clients.calculator, "get", `/home/api/emission-projects/${projectId}/calculation`);
  const source = (calculationSource.sourceItems || []).find((item) => Number(item.id) === activityId);
  if (!source?.factorId || source.unitMatch !== true) throw new Error(`factor mapping contract failed ${JSON.stringify(source || {})}`);
  const calculation = await call(clients.calculator, "post", `/home/api/emission-projects/${projectId}/calculation`);
  mark("CALCULATION", { status: "DONE", calculationId: calculation.id, factorId: source.factorId });

  await call(clients.verifier, "post", `/home/api/emission-projects/${projectId}/submissions/${submissionId}/verification/start`);
  await call(clients.verifier, "post", `/home/api/emission-projects/${projectId}/submissions/${submissionId}/verification/decision`, { decision: "PASSED", comment: "Automated verification passed", issueCount: 0 });
  mark("VERIFICATION", { status: "DONE" });
  await call(clients.approver, "post", `/home/api/emission-projects/${projectId}/submissions/${submissionId}/approval/decision`, { decision: "APPROVED", comment: "Automated approval passed" });
  mark("APPROVAL", { status: "DONE" });

  const report = await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/reports`, { language: "ko", title: `Automated emission report ${marker}`, summary: "Disposable lifecycle evidence" });
  const reportId = Number(report.id);
  await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/reports/${reportId}/finalize`);
  const certificate = await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/reports/${reportId}/issue`);
  const publicCertificate = await call(clients.owner, "get", `/api/public/report-certificates/${encodeURIComponent(certificate.certificateId)}`);
  if (publicCertificate.valid !== true) throw new Error("public certificate is not valid");
  mark("REPORT", { status: "DONE", reportId, certificateId: certificate.certificateId, certificateValid: true });

  const regulatory = await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/regulatory-submissions`, {
    reportId: String(reportId), clientRequestId: `regulatory-${marker}`, authorityCode: "MOE", authorityName: "환경부",
    reportingProgram: "GHG inventory", reportingPeriod: year, legalBasis: "Framework Act on Carbon Neutrality",
    channel: "SYSTEM", deadline: dueDate, note: "Disposable regulatory package",
  });
  const regulatoryId = Number(regulatory.id);
  await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/regulatory-submissions/${regulatoryId}/transition`, { action: "SUBMIT", note: "Submitted by lifecycle harness" });
  await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/regulatory-submissions/${regulatoryId}/transition`, { action: "RECORD_RECEIPT", receiptNo: `AUTO-${marker}`, note: "Receipt recorded" });
  await call(clients.verifier, "post", `/home/api/emission-projects/${projectId}/regulatory-submissions/${regulatoryId}/transition`, { action: "ACCEPT", note: "Accepted by lifecycle harness" });
  mark("REGULATORY_SUBMISSION", { status: "DONE", regulatoryId });

  const completion = await call(clients.owner, "get", `/home/api/emission-projects/${projectId}/completion`);
  const allTasks = Array.isArray(completion.checklist) ? completion.checklist : [];
  const canonicalCodes = ["BASIC_INFO", "ACTIVITY_DATA", "CALCULATION", "VERIFICATION", "APPROVAL", "REPORT", "REGULATORY_SUBMISSION"];
  const checklist = canonicalCodes.map((code) => allTasks.find((item) => item.code === code)).filter(Boolean);
  if (checklist.length !== 7 || checklist.some((item) => item.status !== "DONE")) throw new Error(`canonical completion is not 7/7 ${JSON.stringify(checklist)}`);
  evidence.finishedAt = new Date().toISOString(); evidence.durationMs = Date.now() - Date.parse(evidence.startedAt);
  evidence.completion = {
    checklist: checklist.map(({ code, status }) => ({ code, status })),
    extensionTaskCount: Array.isArray(completion.extensionTasks) ? completion.extensionTasks.length : 0,
    metrics: completion.metrics,
  };
} finally {
  if (projectId && clients.owner) {
    const removed = await call(clients.owner, "delete", `/home/api/emission-projects/${projectId}`, undefined, [200]).catch((error) => ({ success: false, error: error.message }));
    evidence.cleanup = removed.success === true;
    const tasks = await call(clients.owner, "get", "/home/api/emission-tasks").catch(() => ({ items: [] }));
    evidence.residualTaskCount = (tasks.items || []).filter((item) => String(item.projectId) === projectId).length;
  }
  await Promise.all(Object.values(clients).map((client) => client.dispose()));
  const outputDir = path.join(root, "var/test-evidence");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "seven-step-disposable-latest.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}

if (!evidence.cleanup || evidence.residualTaskCount !== 0) throw new Error(`cleanup failed project=${projectId} residualTasks=${evidence.residualTaskCount}`);
console.log(`SEVEN_STEP_DISPOSABLE_PASS project=deleted workflow=7/7 cleanup=verified durationMs=${evidence.durationMs}`);
