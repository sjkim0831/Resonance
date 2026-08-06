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
const adminUser = String(process.env.CARBONET_ADMIN_TEST_USER || "webmaster");
const executablePath = ["/snap/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(existsSync);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
if (!password) throw new Error("CARBONET_ADMIN_TEST_PASSWORD is required");

const steps = ["MEMBER_LIFECYCLE_03_VERIFY", "MEMBER_LIFECYCLE_04_APPROVE"];
const routes = steps.map((stepCode) => ({
  stepCode,
  path: `/admin/system/process-workspace?process=MEMBER_LIFECYCLE&step=${stepCode}`,
}));

const api = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
const login = await api.post("/admin/login/actionLogin", {
  data: { userId: adminUser, userPw: password, userSe: "USR" },
  failOnStatusCode: false,
});
const loginPayload = await login.json().catch(() => ({}));
if (login.status() !== 200 || loginPayload.status !== "loginSuccess") throw new Error(`admin login failed HTTP ${login.status()}`);

const dataResponse = await api.get("/admin/api/system/actor-process", { failOnStatusCode: false });
const data = await dataResponse.json().catch(() => ({}));
const processDefinition = (data.processes || []).find((row) => row.processCode === "MEMBER_LIFECYCLE");
for (const stepCode of steps) {
  const step = (data.steps || []).find((row) => row.processCode === "MEMBER_LIFECYCLE" && row.stepCode === stepCode);
  if (!processDefinition || !step || !step.actorCode || !step.completionRule || !step.inputContract || !step.outputContract) {
    throw new Error(`actor-process API contract incomplete for ${stepCode}`);
  }
}
if (dataResponse.status() !== 200) throw new Error(`actor-process API HTTP ${dataResponse.status()}`);

const anonymous = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
const anonymousResponse = await anonymous.get("/admin/api/system/actor-process", { failOnStatusCode: false });
if (![401, 403].includes(anonymousResponse.status())) throw new Error(`anonymous API did not fail closed HTTP ${anonymousResponse.status()}`);
await anonymous.dispose();

const databaseCount = Number(execFileSync("kubectl", [
  "-n", process.env.K8S_NAMESPACE || "carbonet-prod", "exec", process.env.PATRONI_POD || "postgres-patroni-2", "-c", "patroni", "--",
  "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "carbonet", "-X", "-Atqc",
  "select count(*) from framework_step_execution_spec where process_code='MEMBER_LIFECYCLE' and step_code in ('MEMBER_LIFECYCLE_03_VERIFY','MEMBER_LIFECYCLE_04_APPROVE') and screen_contract not in ('[]'::jsonb,'{}'::jsonb,'null'::jsonb);",
], { encoding: "utf8" }).trim());
if (databaseCount !== 2) throw new Error(`database screen contract count=${databaseCount}`);

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
    for (const route of routes) {
      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.locator('[data-help-id="process-workspace-selected-step"]').waitFor({ state: "visible", timeout: 12_000 });
      const state = await page.evaluate((stepCode) => {
        const bodyText = document.body?.innerText || "";
        const selected = document.querySelector(`[data-step-code="${CSS.escape(stepCode)}"]`);
        const unnamed = [...document.querySelectorAll("button,a,input,select,textarea")].filter((element) => {
          if (element.matches("input[type=hidden]")) return false;
          const labelledBy = (element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean)
            .map((id) => document.getElementById(id)?.textContent || "").join(" ");
          const id = element.getAttribute("id") || "";
          const associatedLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || "" : "";
          const label = element.getAttribute("aria-label") || labelledBy || associatedLabel || element.getAttribute("title") || element.textContent || element.getAttribute("placeholder") || "";
          return !label.trim();
        }).length;
        return {
          hasProcess: bodyText.includes("MEMBER_LIFECYCLE"),
          hasStep: bodyText.includes(stepCode),
          selected: selected?.getAttribute("aria-current") === "step",
          hasSections: ["process-workspace-sequence", "process-workspace-selected-step", "process-workspace-tests", "process-workspace-jobs"]
            .every((id) => Boolean(document.querySelector(`[data-help-id="${id}"]`))),
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          unnamed,
          hasReplacementCharacter: bodyText.includes("�"),
        };
      }, route.stepCode);
      if ((response?.status() || 0) >= 400 || errors.length) throw new Error(`${viewport.name} ${route.stepCode} runtime error ${errors.join(" | ")}`);
      if (!state.hasProcess || !state.hasStep || !state.selected || !state.hasSections) throw new Error(`${viewport.name} ${route.stepCode} required UI missing`);
      if (state.hasReplacementCharacter) throw new Error(`${viewport.name} ${route.stepCode} contains replacement characters`);
      if (state.pageOverflow) throw new Error(`${viewport.name} ${route.stepCode} page-level horizontal overflow`);
      if (state.unnamed) throw new Error(`${viewport.name} ${route.stepCode} unnamed interactive controls=${state.unnamed}`);
      results.push({ viewport: viewport.name, stepCode: route.stepCode, ok: true });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await api.dispose();
}

console.log(JSON.stringify({
  status: "PASS",
  processCode: "MEMBER_LIFECYCLE",
  sourceCommit,
  authenticatedAdmin: 1,
  api: 1,
  database: 1,
  authority: 1,
  exceptionStates: 1,
  responsive: 1,
  accessibility: 1,
  desktop: 1,
  mobile: 1,
  routes: results,
}));
