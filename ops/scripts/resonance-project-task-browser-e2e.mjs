#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const frontendPackage = path.join(root, "projects/carbonet-frontend/source/package.json");
const require = createRequire(frontendPackage);
const { chromium, request } = require("@playwright/test");

const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const projectId = String(process.env.CARBONET_ACTOR_TEST_PROJECT || "PRJ-ACTOR-TEST");
const password = String(process.env.CARBONET_ACTOR_TEST_PASSWORD || "");
const configuredExecutable = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "");
const executablePath = configuredExecutable || [
  "/snap/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].find((candidate) => existsSync(candidate)) || "";
const accounts = ["qaowner26", "qadata26", "qacalc26", "qaverify26", "qaapprove26"];
const fatalText = /React app did not mount|Bootstrap loaded\. Waiting for React app mount|페이지 처리 중 오류가 발생했습니다|An unexpected error occurred/;
const loginPath = /\/signin\/loginView\/?$/;

if (!password) throw new Error("CARBONET_ACTOR_TEST_PASSWORD is required");

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const routeResults = [];
const workflowResults = [];
let taskCount = 0;
let transitionVerified = false;
const startedAt = Date.now();

async function authenticatedApi(account) {
  const api = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
  const login = await api.post("/signin/actionLogin", {
    data: { userId: account, userPw: password, userSe: "USR" },
    failOnStatusCode: false,
  });
  if (login.status() !== 200) throw new Error(`login failed account=${account} status=${login.status()}`);
  const payload = await login.json();
  if (payload?.status === "loginFailure") throw new Error(`login rejected account=${account}`);
  return api;
}

try {
  // Each account owns an isolated API session and browser context. Running
  // these read-only route checks concurrently avoids paying cold page/runtime
  // latency five times. The state-changing transition proof remains below
  // this barrier and therefore still executes exactly once.
  await Promise.all(accounts.map(async (account) => {
    const api = await authenticatedApi(account);
    try {
      const tasksResponse = await api.get("/home/api/emission-tasks", { failOnStatusCode: false });
      if (tasksResponse.status() !== 200) throw new Error(`task API failed account=${account} status=${tasksResponse.status()}`);
      const tasksPayload = await tasksResponse.json();
      const tasks = (tasksPayload.items || [])
        .filter((task) => String(task.projectId) === projectId && task.targetUrl)
        .sort((left, right) => Number(left.stepOrder || 0) - Number(right.stepOrder || 0));
      if (!tasks.length) throw new Error(`assigned task route missing account=${account} project=${projectId}`);
      taskCount += tasks.length;
      const workflow = (tasksPayload.workflows || [])
        .filter((task) => String(task.projectId) === projectId)
        .sort((left, right) => Number(left.stepOrder || 0) - Number(right.stepOrder || 0));
      if (workflow.length !== 7) throw new Error(`workflow length account=${account} expected=7 actual=${workflow.length}`);
      workflowResults.push({ account, workflow });

      const context = await browser.newContext({
        storageState: await api.storageState(),
        ignoreHTTPSErrors: true,
        viewport: { width: 1440, height: 1000 },
      });
      try {
        for (const task of tasks) {
          const page = await context.newPage();
          const pageErrors = [];
          const serverFailures = [];
          page.on("pageerror", (error) => pageErrors.push(error.message));
          page.on("response", (response) => {
            if (response.status() >= 500 && new URL(response.url()).origin === new URL(baseUrl).origin) {
              serverFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
            }
          });
          try {
            const target = new URL(String(task.targetUrl), baseUrl);
            if (!target.searchParams.has("projectId")) target.searchParams.set("projectId", projectId);
            const response = await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 15_000 });
            await page.waitForFunction(() => {
              const root = document.querySelector("#root");
              const text = (document.body?.innerText || "").trim();
              return (root?.children.length || 0) > 0 && text.length >= 20 &&
                !/Bootstrap loaded\. Waiting for React app mount|React app did not mount/.test(text);
            }, undefined, { timeout: 8_000 });
            const state = await page.evaluate(() => ({
              text: (document.body?.innerText || "").trim(),
              rootChildren: document.querySelector("#root")?.children.length || 0,
              pathname: location.pathname,
              headings: [...document.querySelectorAll("h1,h2,[role=heading]")].map((node) => (node.textContent || "").trim()),
              projectVisible: (document.body?.innerText || "").includes(new URL(location.href).searchParams.get("projectId") || ""),
            }));
            if ((response?.status() || 0) >= 400) throw new Error(`page HTTP ${response?.status()}`);
            if (loginPath.test(state.pathname)) throw new Error("authenticated task redirected to login");
            const fatalMatch = state.text.match(fatalText)?.[0];
            if (fatalMatch) throw new Error(`fatal UI=${JSON.stringify(fatalMatch)} account=${account} task=${task.taskCode} target=${target.pathname}`);
            if (target.pathname !== "/admin" && state.headings.some((heading) => heading === "운영 관리 대시보드")) {
              throw new Error(`fallback dashboard account=${account} task=${task.taskCode} target=${target.pathname}`);
            }
            if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
            if (serverFailures.length) throw new Error(`server failures: ${serverFailures.join(" | ")}`);
            routeResults.push({ account, taskCode: task.taskCode, target: target.pathname, ok: true });
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    } finally {
      await api.dispose();
    }
  }));

  const protectedTarget = routeResults[0]?.target;
  if (!protectedTarget) throw new Error("no protected task route was verified");
  const anonymous = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const page = await anonymous.newPage();
    await page.goto(new URL(protectedTarget, baseUrl).href, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(400);
    const anonymousState = await page.evaluate(() => ({
      pathname: location.pathname,
      text: (document.body?.innerText || "").trim(),
    }));
    if (!loginPath.test(anonymousState.pathname) && !/로그인|아이디|비밀번호/.test(anonymousState.text)) {
      throw new Error(`anonymous task route did not fail closed path=${anonymousState.pathname}`);
    }
  } finally {
    await anonymous.close();
  }

  // Use a disposable project to prove that a visible UI action commits the
  // task transition, rejects the wrong actor, and leaves no test data behind.
  const ownerApi = await authenticatedApi("qaowner26");
  let disposableProjectId = "";
  try {
    const expectedCodes = ["BASIC_INFO", "ACTIVITY_DATA", "CALCULATION", "VERIFICATION", "APPROVAL", "REPORT", "REGULATORY_SUBMISSION"];
    for (const { account, workflow } of workflowResults) {
      if (workflow.map((task) => task.taskCode).join(",") !== expectedCodes.join(",")) {
        throw new Error(`seven-step order mismatch account=${account}`);
      }
      if (workflow.some((task) => task.status !== "DONE" || task.completionSatisfied !== true || !task.completionRule || !task.targetUrl)) {
        throw new Error(`seven-step completion evidence incomplete account=${account}`);
      }
      if (workflow.slice(0, -1).some((task, index) => task.nextTaskName !== workflow[index + 1].name)) {
        throw new Error(`seven-step handoff mismatch account=${account}`);
      }
    }

    const completionResponse = await ownerApi.get(`/home/api/emission-projects/${encodeURIComponent(projectId)}/completion`, { failOnStatusCode: false });
    if (completionResponse.status() !== 200) throw new Error(`project completion HTTP ${completionResponse.status()}`);
    const completion = await completionResponse.json();
    const checklist = Array.isArray(completion.checklist) ? completion.checklist : [];
    const metrics = completion.metrics || {};
    if (checklist.length !== 7 || checklist.some((task) => task.status !== "DONE")) {
      throw new Error("completion checklist is not 7/7 DONE");
    }
    const artifactCounts = [metrics.activityCount, metrics.approvedSubmissions, metrics.finalizedReports, metrics.activeCertificates];
    if (artifactCounts.some((value) => Number(value || 0) < 1) || Number(metrics.totalEmission || 0) <= 0) {
      throw new Error(`business artifacts incomplete metrics=${JSON.stringify(metrics)}`);
    }
    const certifiedReport = (completion.reports || []).find((report) => report.certificateId && report.certificateStatus === "ACTIVE");
    if (!certifiedReport) throw new Error("active report certificate missing");
    const certificateResponse = await ownerApi.get(`/api/public/report-certificates/${encodeURIComponent(certifiedReport.certificateId)}`, { failOnStatusCode: false });
    const certificate = await certificateResponse.json().catch(() => ({}));
    if (certificateResponse.status() !== 200 || certificate.valid !== true) throw new Error("public certificate verification failed");

    const optionsResponse = await ownerApi.get("/home/api/emission-projects/options", { failOnStatusCode: false });
    if (optionsResponse.status() !== 200) throw new Error(`project options HTTP ${optionsResponse.status()}`);
    const options = await optionsResponse.json();
    if (!options?.readiness?.ready || !Array.isArray(options.sites) || !options.sites.length) {
      throw new Error("disposable project readiness is incomplete");
    }
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const projectName = `브라우저 전환 검증 ${marker}`;
    const createResponse = await ownerApi.post("/home/api/emission-projects", {
      data: {
        clientRequestId: `browser-transition-${marker}`,
        name: projectName,
        site: options.sites[0],
        owner: "qaowner26",
        dataOwner: "qadata26",
        calculator: "qacalc26",
        verifier: "qaverify26",
        approver: "qaapprove26",
        reportingYear: year,
        periodStart: `${year}-01-01`,
        periodEnd: `${year}-12-31`,
        dueDate: `${year}-12-31`,
        scopes: ["Scope 1", "Scope 2"],
        organizationBoundary: "OPERATIONAL_CONTROL",
        emissionStandard: "ISO_14064_1",
        methodologyVersion: "2018",
        verificationLevel: "LIMITED",
        collectionCycle: "MONTHLY",
        materialityThreshold: "5",
      },
      failOnStatusCode: false,
    });
    const created = await createResponse.json().catch(() => ({}));
    if (createResponse.status() !== 200 || !created.id) {
      throw new Error(`disposable project create failed HTTP ${createResponse.status()} ${created.message || ""}`);
    }
    disposableProjectId = String(created.id);

    let actionable = null;
    let actionAccount = "";
    let actionApi = null;
    for (const account of accounts) {
      const api = account === "qaowner26" ? ownerApi : await authenticatedApi(account);
      const payload = await (await api.get("/home/api/emission-tasks")).json();
      const candidate = (payload.items || []).find((task) =>
        String(task.projectId) === disposableProjectId && task.actionable === true && task.status === "READY");
      if (candidate) {
        actionable = candidate;
        actionAccount = account;
        actionApi = api;
        break;
      }
      if (api !== ownerApi) await api.dispose();
    }
    if (!actionable || !actionApi) throw new Error("disposable project has no actionable READY task");

    const context = await browser.newContext({ storageState: await actionApi.storageState(), ignoreHTTPSErrors: true });
    try {
      const page = await context.newPage();
      await page.goto(`${baseUrl}/emission/my-tasks`, { waitUntil: "domcontentloaded", timeout: 15_000 });
      await page.waitForFunction((name) => (document.body?.innerText || "").includes(String(name)), projectName, { timeout: 8_000 });
      const start = page.locator("article")
        .filter({ hasText: projectName })
        .getByRole("button", { name: "업무 시작", exact: true })
        .first();
      await start.waitFor({ state: "visible", timeout: 5_000 });
      const [transitionResponse] = await Promise.all([
        page.waitForResponse((response) => response.url().includes(`/home/api/emission-tasks/${actionable.id}/status`) && response.request().method() === "POST"),
        start.click(),
      ]);
      if (transitionResponse.status() !== 200) throw new Error(`browser task transition HTTP ${transitionResponse.status()}`);
    } finally {
      await context.close();
    }
    const afterPayload = await (await actionApi.get("/home/api/emission-tasks")).json();
    const after = (afterPayload.items || []).find((task) => Number(task.id) === Number(actionable.id));
    if (after?.status !== "IN_PROGRESS") throw new Error(`browser transition not persisted status=${after?.status}`);

    const wrongAccount = accounts.find((account) => account !== actionAccount) || "qacalc26";
    const wrongApi = await authenticatedApi(wrongAccount);
    try {
      const denied = await wrongApi.post(`/home/api/emission-tasks/${actionable.id}/status`, {
        data: { status: "IN_PROGRESS" }, failOnStatusCode: false,
      });
      if (denied.status() !== 403) throw new Error(`wrong actor transition expected 403 received ${denied.status()}`);
    } finally {
      await wrongApi.dispose();
    }
    if (actionApi !== ownerApi) await actionApi.dispose();
    transitionVerified = true;
  } finally {
    if (disposableProjectId) {
      const deleted = await ownerApi.delete(`/home/api/emission-projects/${encodeURIComponent(disposableProjectId)}`, { failOnStatusCode: false });
      if (deleted.status() !== 200) throw new Error(`disposable project cleanup HTTP ${deleted.status()}`);
      const remaining = await (await ownerApi.get("/home/api/emission-tasks")).json();
      if ((remaining.items || []).some((task) => String(task.projectId) === disposableProjectId)) {
        throw new Error("disposable project tasks remain after cleanup");
      }
    }
    await ownerApi.dispose();
  }
} finally {
  await browser.close();
}

const uniqueRoutes = new Set(routeResults.map((result) => result.target));
console.log(`[project-task-browser-e2e] PASS project=${projectId} accounts=${accounts.length} tasks=${taskCount} workflow=7/7 artifacts=5 certificate=valid uniqueRoutes=${uniqueRoutes.size} anonymous=blocked transition=${transitionVerified ? "committed-and-rolled-back" : "missing"} durationMs=${Date.now() - startedAt}`);
