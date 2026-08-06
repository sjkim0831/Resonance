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
const mark = (processCode, stepCode, actor, endpoints, detail = {}) => evidence.steps.push({
  ordinal: evidence.steps.length + 1, processCode, stepCode, actor,
  endpoints: Array.isArray(endpoints) ? endpoints : [endpoints], at: new Date().toISOString(), ...detail,
});

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
  mark("EMISSION_PROJECT_PORTFOLIO", "EMISSION_PROJECT_PORTFOLIO_LIST", "COMPANY_MANAGER",
    ["GET /home/api/emission-projects/options", "POST /home/api/emission-projects"], { status: "DONE" });

  const boundaryPath = `/home/api/emission-projects/${projectId}/organizational-boundary`;
  await call(clients.owner, "put", boundaryPath, {
    boundaryMethod: "OPERATIONAL_CONTROL", reportingBasis: "ISO 14064-1",
    rationale: "운영 통제 기준으로 보고 법인과 사업장을 포함합니다.",
    effectiveFrom: `${year}-01-01`, effectiveUntil: `${year}-12-31`,
    members: [{
      entityCode: `QA-${marker.slice(-6)}`, entityName: String(options.sites[0]), entityType: "SITE",
      countryCode: "KR", ownershipPercent: "100", controlType: "OPERATIONAL",
      includedYn: "Y", exclusionReason: "", evidenceRef: `QA-BOUNDARY-${marker}`,
    }],
  });
  mark("ORGANIZATIONAL_BOUNDARY", "ORGANIZATIONAL_BOUNDARY_S1", "COMPANY_MANAGER",
    ["GET /organizational-boundary", "PUT /organizational-boundary"], { status: "DONE" });
  await call(clients.owner, "post", `${boundaryPath}/review-ready`);
  mark("ORGANIZATIONAL_BOUNDARY", "ORGANIZATIONAL_BOUNDARY_S2", "COMPANY_MANAGER",
    "POST /organizational-boundary/review-ready", { status: "DONE" });
  await call(clients.calculator, "post", `${boundaryPath}/consolidate`, { grossEmission: "0", eliminations: [] });
  mark("ORGANIZATIONAL_BOUNDARY", "ORGANIZATIONAL_BOUNDARY_S3", "CALCULATOR",
    "POST /organizational-boundary/consolidate", { status: "DONE" });
  await call(clients.approver, "post", `${boundaryPath}/decision`, { decision: "APPROVE" });
  mark("ORGANIZATIONAL_BOUNDARY", "ORGANIZATIONAL_BOUNDARY_S4", "APPROVER",
    "POST /organizational-boundary/decision", { status: "DONE" });

  const dueDate = `${year}-12-31`;
  const initialRequests = await call(clients.owner, "get", `/home/api/emission-projects/${projectId}/activity-requests`);
  const precreated = (initialRequests.items || []).find((item) => item.status === "REQUESTED" && String(item.assignee).toLowerCase() === users.data);
  const requestCreated = precreated || await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/activity-requests`, {
    title: "Monthly electricity evidence", detail: "Disposable full-lifecycle verification request",
    requestedItems: "Electricity usage and source reference", assignee: users.data, dueDate,
  });
  const requestId = Number(requestCreated.id);
  mark("ACTIVITY_DATA", "ACTIVITY_DATA_01_PLAN", "COMPANY_MANAGER",
    ["GET /activity-requests", "POST /activity-requests"], { status: "DONE", requestId });
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
  mark("ACTIVITY_DATA", "ACTIVITY_DATA_02_WORK", "SITE_DATA_OWNER",
    ["POST /activities", "POST /quality", "POST /submissions", "POST /submissions/{id}/submit"],
    { status: "DONE", activityId, submissionId, requestId, qualityScore: quality.score });

  const verifiedQuality = await call(clients.verifier, "post", `/home/api/emission-projects/${projectId}/quality`);
  if (verifiedQuality.submitReady !== true) throw new Error(`verifier quality gate blocked ${JSON.stringify(verifiedQuality.issues || [])}`);
  mark("ACTIVITY_DATA", "ACTIVITY_DATA_03_VERIFY", "VERIFIER",
    "POST /quality", { status: "DONE", qualityScore: verifiedQuality.score });
  await call(clients.approver, "post", `/home/api/emission-projects/${projectId}/activity-requests/${requestId}/decision`, { decision: "ACCEPT" });
  mark("ACTIVITY_DATA", "ACTIVITY_DATA_04_APPROVE", "APPROVER",
    "POST /activity-requests/{id}/decision", { status: "DONE" });

  await call(clients.owner, "get", `/home/api/emission-projects/${projectId}/calculation`);
  mark("EMISSION_CALCULATION", "EMISSION_CALCULATION_01_PLAN", "COMPANY_MANAGER",
    "GET /calculation", { status: "DONE" });
  await call(clients.calculator, "post", `/home/api/emission-projects/${projectId}/activities/auto-map`);
  const calculationSource = await call(clients.calculator, "get", `/home/api/emission-projects/${projectId}/calculation`);
  const source = (calculationSource.sourceItems || []).find((item) => Number(item.id) === activityId);
  if (!source?.factorId || source.unitMatch !== true) throw new Error(`factor mapping contract failed ${JSON.stringify(source || {})}`);
  const calculation = await call(clients.calculator, "post", `/home/api/emission-projects/${projectId}/calculation`);
  mark("EMISSION_CALCULATION", "EMISSION_CALCULATION_02_WORK", "CALCULATOR",
    ["POST /activities/auto-map", "POST /calculation"], { status: "DONE", calculationId: calculation.id, factorId: source.factorId });
  await call(clients.verifier, "post", `/home/api/emission-projects/${projectId}/submissions/${submissionId}/verification/start`);
  await call(clients.verifier, "post", `/home/api/emission-projects/${projectId}/submissions/${submissionId}/verification/decision`, { decision: "PASSED", comment: "자동 산정 검증 통과", issueCount: 0 });
  await call(clients.verifier, "get", `/home/api/emission-projects/${projectId}/review-workflow`);
  mark("EMISSION_CALCULATION", "EMISSION_CALCULATION_03_VERIFY", "VERIFIER",
    ["POST /verification/start", "POST /verification/decision", "GET /review-workflow"], { status: "DONE" });
  await call(clients.approver, "post", `/home/api/emission-projects/${projectId}/submissions/${submissionId}/approval/decision`, { decision: "APPROVED", comment: "자동 산정 승인 통과" });
  const calculated = await call(clients.approver, "get", `/home/api/emission-projects/${projectId}/calculation`);
  if (!calculated?.latestRun?.id && !calculated?.latest?.id && !calculated?.calculation?.id) throw new Error("approved calculation version is missing");
  mark("EMISSION_CALCULATION", "EMISSION_CALCULATION_04_APPROVE", "APPROVER",
    ["POST /approval/decision", "GET /calculation"], { status: "DONE", calculationId: calculation.id });

  await call(clients.owner, "get", `/home/api/emission-projects/${projectId}/completion`);
  mark("REPORT_CERTIFICATION", "REPORT_CERTIFICATION_01_PLAN", "COMPANY_MANAGER",
    "GET /completion", { status: "DONE" });
  const report = await call(clients.calculator, "post", `/home/api/emission-projects/${projectId}/reports`, { language: "ko", title: `자동 배출량 보고서 ${marker}`, summary: "폐기형 심층 업무 검증 증적" });
  const reportId = Number(report.id);
  mark("REPORT_CERTIFICATION", "REPORT_CERTIFICATION_02_WORK", "CALCULATOR",
    "POST /reports", { status: "DONE", reportId });
  await call(clients.verifier, "post", `/home/api/emission-projects/${projectId}/reports/${reportId}/finalize`);
  mark("REPORT_CERTIFICATION", "REPORT_CERTIFICATION_03_VERIFY", "VERIFIER",
    "POST /reports/{id}/finalize", { status: "DONE", reportId });
  const certificate = await call(clients.approver, "post", `/home/api/emission-projects/${projectId}/reports/${reportId}/issue`);
  const publicCertificate = await call(clients.owner, "get", `/api/public/report-certificates/${encodeURIComponent(certificate.certificateId)}`);
  if (publicCertificate.valid !== true) throw new Error("public certificate is not valid");
  mark("REPORT_CERTIFICATION", "REPORT_CERTIFICATION_04_APPROVE", "APPROVER",
    ["POST /reports/{id}/issue", "GET /api/public/report-certificates/{id}"],
    { status: "DONE", reportId, certificateId: certificate.certificateId, certificateValid: true });

  const regulatory = await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/regulatory-submissions`, {
    reportId: String(reportId), clientRequestId: `regulatory-${marker}`, authorityCode: "MOE", authorityName: "환경부",
    reportingProgram: "GHG inventory", reportingPeriod: year, legalBasis: "Framework Act on Carbon Neutrality",
    channel: "SYSTEM", deadline: dueDate, note: "Disposable regulatory package",
  });
  const regulatoryId = Number(regulatory.id);
  mark("REGULATORY_SUBMISSION", "REGULATORY_SUBMISSION_S1", "COMPANY_MANAGER",
    "POST /regulatory-submissions", { status: "DONE", regulatoryId });
  await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/regulatory-submissions/${regulatoryId}/transition`, { action: "SUBMIT", note: "Submitted by lifecycle harness" });
  mark("REGULATORY_SUBMISSION", "REGULATORY_SUBMISSION_S2", "COMPANY_MANAGER",
    "POST /regulatory-submissions/{id}/transition:SUBMIT", { status: "DONE", regulatoryId });
  await call(clients.owner, "post", `/home/api/emission-projects/${projectId}/regulatory-submissions/${regulatoryId}/transition`, { action: "RECORD_RECEIPT", receiptNo: `AUTO-${marker}`, note: "Receipt recorded" });
  mark("REGULATORY_SUBMISSION", "REGULATORY_SUBMISSION_S3", "VERIFIER",
    "POST /regulatory-submissions/{id}/transition:RECORD_RECEIPT", { status: "DONE", regulatoryId });
  await call(clients.approver, "post", `/home/api/emission-projects/${projectId}/regulatory-submissions/${regulatoryId}/transition`, { action: "ACCEPT", note: "Accepted by lifecycle harness" });
  mark("REGULATORY_SUBMISSION", "REGULATORY_SUBMISSION_S4", "APPROVER",
    "POST /regulatory-submissions/{id}/transition:ACCEPT", { status: "DONE", regulatoryId });

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
  const canonicalSteps = new Set(evidence.steps.map((item) => `${item.processCode}/${item.stepCode}`));
  if (evidence.steps.length !== 21 || canonicalSteps.size !== 21 || evidence.steps.some((item) => item.status !== "DONE" || !item.endpoints.length)) {
    throw new Error(`professional domain relay is incomplete steps=${evidence.steps.length} unique=${canonicalSteps.size}`);
  }
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
console.log(`PROFESSIONAL_DOMAIN_RELAY_PASS project=deleted processes=6 steps=21 workflow=7/7 cleanup=verified durationMs=${evidence.durationMs}`);
