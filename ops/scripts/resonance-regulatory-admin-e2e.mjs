#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://172.16.1.232").replace(/\/$/, "");
const password = String(process.env.CARBONET_ADMIN_TEST_PASSWORD || "");
const projectId = String(process.env.CARBONET_REGULATORY_TEST_PROJECT || "PRJ-2026-5B8992");
const executablePath = ["/snap/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(existsSync);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
if (!password) throw new Error("CARBONET_ADMIN_TEST_PASSWORD is required");

const api = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
const login = await api.post("/admin/login/actionLogin", {
  data: { userId: "webmaster", userPw: password, userSe: "USR" },
  failOnStatusCode: false,
});
const loginPayload = await login.json().catch(() => ({}));
if (login.status() !== 200 || loginPayload.status !== "loginSuccess") throw new Error(`admin login failed HTTP ${login.status()}`);

const list = await api.get("/home/api/emission-projects?page=1&size=100", { failOnStatusCode: false });
const listPayload = await list.json().catch(() => ({}));
if (list.status() !== 200 || !(listPayload.items || []).some((item) => String(item.id) === projectId)) {
  throw new Error(`admin project scope failed HTTP ${list.status()}`);
}
const workflow = await api.get(`/home/api/emission-projects/${encodeURIComponent(projectId)}/regulatory-submissions`, { failOnStatusCode: false });
const workflowPayload = await workflow.json().catch(() => ({}));
if (workflow.status() !== 200 || !workflowPayload.project || !Array.isArray(workflowPayload.items) || !Array.isArray(workflowPayload.events)) {
  throw new Error(`regulatory workflow API failed HTTP ${workflow.status()}`);
}
const missing = await api.get("/home/api/emission-projects/PROJECT-DOES-NOT-EXIST/regulatory-submissions", { failOnStatusCode: false });
if (![403, 404].includes(missing.status())) throw new Error(`missing project did not fail closed HTTP ${missing.status()}`);
const anonymous = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
const anonymousApi = await anonymous.get(`/home/api/emission-projects/${encodeURIComponent(projectId)}/regulatory-submissions`, { failOnStatusCode: false });
if (![401, 403].includes(anonymousApi.status())) throw new Error(`anonymous API did not fail closed HTTP ${anonymousApi.status()}`);
await anonymous.dispose();

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const viewports = [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }];
const results = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ storageState: await api.storageState(), ignoreHTTPSErrors: true, viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500 && new URL(response.url()).origin === new URL(baseUrl).origin) errors.push(`${response.status()} ${response.url()}`);
    });
    const response = await page.goto(`${baseUrl}/admin/emission/regulatory-submissions?projectId=${encodeURIComponent(projectId)}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.locator('[data-testid="admin-regulatory-submission"]').waitFor({ state: "visible", timeout: 12_000 }).catch(() => undefined);
    await page.waitForFunction((targetProjectId) => [...document.querySelectorAll("option")].some((option) => option.value === targetProjectId), projectId, { timeout: 10_000 }).catch(() => undefined);
    const state = await page.evaluate(() => {
      const unnamed = [...document.querySelectorAll("button,a,input,select,textarea")].filter((element) => {
        if (element.matches("input[type=hidden]")) return false;
        const label = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || element.getAttribute("placeholder") || "";
        return !label.trim();
      }).length;
      return {
        text: document.body?.innerText || "",
        pathname: location.pathname,
        hasWorkspace: Boolean(document.querySelector('[data-testid="admin-regulatory-submission"]')),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        unnamed,
        projectSelected: [...document.querySelectorAll("option")].some((option) => option.value === new URL(location.href).searchParams.get("projectId")),
        optionValues: [...document.querySelectorAll("option")].slice(0, 20).map((option) => option.value),
      };
    });
    if ((response?.status() || 0) >= 400 || errors.length) throw new Error(`${viewport.name} runtime error ${errors.join(" | ")}`);
    if (!state.hasWorkspace) throw new Error(`${viewport.name} workspace missing path=${state.pathname} text=${state.text.slice(0, 160).replace(/\s+/g, " ")}`);
    if (!state.projectSelected) throw new Error(`${viewport.name} project selector did not load target project options=${state.optionValues.join(",")}`);
    if (state.pageOverflow) throw new Error(`${viewport.name} page-level horizontal overflow`);
    if (state.unnamed) throw new Error(`${viewport.name} unnamed interactive controls=${state.unnamed}`);
    results.push({ viewport: viewport.name, ok: true });
    await context.close();
  }
} finally {
  await browser.close();
  await api.dispose();
}

console.log(JSON.stringify({
  status: "PASS",
  processCode: "REGULATORY_SUBMISSION",
  sourceCommit,
  projectId,
  authenticatedAdmin: 1,
  projectScope: 1,
  api: 1,
  database: 1,
  authority: 1,
  exceptionStates: 1,
  responsive: 1,
  accessibility: 1,
  desktop: 1,
  mobile: 1,
  viewports: results,
}));
