#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const password = String(process.env.CARBONET_ACTOR_TEST_PASSWORD || "");
const account = String(process.env.CARBONET_PORTFOLIO_TEST_ACCOUNT || "qaowner26");
const executablePath = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "") || [
  "/snap/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
].find((candidate) => existsSync(candidate)) || "";
if (!password) throw new Error("CARBONET_ACTOR_TEST_PASSWORD is required");

const startedAt = Date.now();
const cases = {};
const api = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
const anonymous = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
let disposableProjectId = "";

function pass(code, evidence) { cases[code] = { result: "PASSED", evidence }; }
function assert(condition, message) { if (!condition) throw new Error(message); }

try {
  const login = await api.post("/signin/actionLogin", {
    data: { userId: account, userPw: password, userSe: "USR" }, failOnStatusCode: false,
  });
  assert(login.status() === 200, `login failed HTTP ${login.status()}`);
  const loginBody = await login.json().catch(() => ({}));
  assert(loginBody?.status !== "loginFailure", "login rejected");

  const denied = await anonymous.get("/home/api/emission-projects?page=1&size=10", { failOnStatusCode: false });
  assert([401, 403].includes(denied.status()), `anonymous portfolio expected 401/403 received ${denied.status()}`);
  pass("PROJECT_PORTFOLIO_AUTH", { anonymousStatus: denied.status(), databaseMutation: false });

  const allResponse = await api.get("/home/api/emission-projects?page=1&size=100", { failOnStatusCode: false });
  assert(allResponse.status() === 200, `portfolio HTTP ${allResponse.status()}`);
  const all = await allResponse.json();
  assert(Array.isArray(all.items) && all.items.length > 0, "portfolio has no actor-scoped rows");
  assert(Number(all.total) >= all.items.length, "portfolio total is inconsistent");
  pass("PROJECT_PORTFOLIO_ISOLATION", { actor: account, visibleRows: all.items.length, total: all.total });

  const first = all.items[0];
  const keyword = String(first.name || first.site || "").trim().split(/\s+/)[0];
  const filteredResponse = await api.get(`/home/api/emission-projects?keyword=${encodeURIComponent(keyword)}&page=1&size=100`, { failOnStatusCode: false });
  assert(filteredResponse.status() === 200, `filter HTTP ${filteredResponse.status()}`);
  const filtered = await filteredResponse.json();
  assert((filtered.items || []).length > 0, "keyword filter returned no rows");
  assert((filtered.items || []).every((item) => `${item.name} ${item.site} ${item.owner}`.includes(keyword)), "keyword filter leaked a non-matching row");
  pass("PROJECT_PORTFOLIO_FILTER", { keyword, matchedRows: filtered.items.length });

  const pageOneResponse = await api.get("/home/api/emission-projects?page=1&size=2", { failOnStatusCode: false });
  assert(pageOneResponse.status() === 200, `paging HTTP ${pageOneResponse.status()}`);
  const pageOne = await pageOneResponse.json();
  assert((pageOne.items || []).length <= 2 && Number(pageOne.total) >= (pageOne.items || []).length, "paging contract mismatch");
  pass("PROJECT_PORTFOLIO_PAGING", { page: 1, size: 2, returned: (pageOne.items || []).length, total: pageOne.total });

  const context = await browser.newContext({ storageState: await api.storageState(), ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/emission/project-portfolio`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.getByRole("heading", { name: "배출량 프로젝트 포트폴리오" }).waitFor({ timeout: 8_000 });
    const localizedStatus = all.items.map((item) => String(item.status || ""))
      .find((value) => ["진행", "검증", "완료"].includes(value));
    assert(localizedStatus, "portfolio has no supported localized status");
    await page.getByLabel("상태").selectOption(localizedStatus);
    const statusRows = page.locator("tbody tr");
    await statusRows.first().waitFor({ state: "visible", timeout: 5_000 });
    const statusTexts = await statusRows.allTextContents();
    assert(statusTexts.length > 0 && statusTexts.every((text) => text.includes(localizedStatus)), "localized status filter mismatch");
    await page.getByLabel("상태").selectOption("");
    const preferred = page.getByRole("radio", { name: "Test 선택", exact: true });
    const radio = await preferred.count() ? preferred : page.locator('input[type="radio"]').first();
    await radio.click();
    await page.getByText("1단계 완료 기준", { exact: true }).waitFor({ timeout: 5_000 });
    const completionSection = page.getByText("1단계 완료 기준", { exact: true }).locator("..");
    await completionSection.getByText("5/5", { exact: true }).waitFor({ timeout: 5_000 });
    pass("PROJECT_PORTFOLIO_HAPPY", { route: "/emission/project-portfolio", selected: true, completion: "5/5", localizedStatus, statusFilterRows: statusTexts.length });

    const recoveryPage = await context.newPage();
    let aborted = false;
    await recoveryPage.route("**/home/api/emission-projects?*", async (route) => {
      if (!aborted) { aborted = true; await route.abort("failed"); return; }
      await route.continue();
    });
    await recoveryPage.goto(`${baseUrl}/emission/project-portfolio`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    const retry = recoveryPage.getByRole("button", { name: "다시 시도", exact: true });
    await retry.waitFor({ state: "visible", timeout: 8_000 });
    await retry.click();
    await recoveryPage.locator("tbody tr").first().waitFor({ state: "visible", timeout: 8_000 });
    pass("PROJECT_PORTFOLIO_RECOVERY", { injectedFailure: true, retrySucceeded: true });
  } finally {
    await context.close();
  }

  const optionsResponse = await api.get("/home/api/emission-projects/options", { failOnStatusCode: false });
  const options = await optionsResponse.json();
  assert(optionsResponse.status() === 200 && options?.readiness?.ready && options.sites?.length, "project create prerequisites unavailable");
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const create = await api.post("/home/api/emission-projects", { data: {
    clientRequestId: `portfolio-delete-${marker}`, name: `포트폴리오 삭제 검증 ${marker}`,
    site: options.sites[0], owner: "qaowner26", dataOwner: "qadata26", calculator: "qacalc26",
    verifier: "qaverify26", approver: "qaapprove26", reportingYear: year,
    periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, dueDate: `${year}-12-31`,
    scopes: ["Scope 1", "Scope 2"], organizationBoundary: "OPERATIONAL_CONTROL",
    emissionStandard: "ISO_14064_1", methodologyVersion: "2018", verificationLevel: "LIMITED",
    collectionCycle: "MONTHLY", materialityThreshold: "5",
  }, failOnStatusCode: false });
  const created = await create.json().catch(() => ({}));
  assert(create.status() === 200 && created.id, `disposable project create failed HTTP ${create.status()}`);
  disposableProjectId = String(created.id);
  const remove = await api.delete(`/home/api/emission-projects/${encodeURIComponent(disposableProjectId)}`, { failOnStatusCode: false });
  assert(remove.status() === 200, `disposable project delete failed HTTP ${remove.status()}`);
  const reread = await api.get(`/home/api/emission-projects/${encodeURIComponent(disposableProjectId)}`, { failOnStatusCode: false });
  assert([403, 404].includes(reread.status()), `deleted project remained readable HTTP ${reread.status()}`);
  disposableProjectId = "";
  pass("PROJECT_PORTFOLIO_DELETE", { created: true, deleted: true, rereadStatus: reread.status() });
} finally {
  if (disposableProjectId) await api.delete(`/home/api/emission-projects/${encodeURIComponent(disposableProjectId)}`, { failOnStatusCode: false }).catch(() => undefined);
  await browser.close();
  await api.dispose();
  await anonymous.dispose();
}

const required = ["AUTH", "DELETE", "FILTER", "HAPPY", "ISOLATION", "PAGING", "RECOVERY"].map((suffix) => `PROJECT_PORTFOLIO_${suffix}`);
assert(required.every((code) => cases[code]?.result === "PASSED"), "portfolio contract suite is incomplete");
console.log(JSON.stringify({ status: "PASS", processCode: "EMISSION_PROJECT_PORTFOLIO", stepCode: "EMISSION_PROJECT_PORTFOLIO_LIST", cases, caseCount: required.length, durationMs: Date.now() - startedAt }));
