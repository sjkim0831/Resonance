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
const executablePath = ["/snap/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(existsSync);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
if (!password) throw new Error("CARBONET_ADMIN_TEST_PASSWORD is required");

const routes = [
  {
    path: "/admin/member/register",
    api: "/admin/member/register/page-data",
    title: "신규 회원 등록",
    selectors: ["member-register-basic", "member-register-affiliation", "member-register-actions"],
    validate(payload) {
      return payload?.canViewMemberRegister === true
        && Array.isArray(payload.memberTypeOptions)
        && Array.isArray(payload.permissionOptions)
        && Array.isArray(payload.memberRegisterFeatureCodes);
    },
  },
  {
    path: "/admin/member/stats",
    api: "/admin/member/stats/page-data",
    title: "회원 통계 현황",
    selectors: ["member-stats-summary", "member-stats-trend", "member-stats-region"],
    validate(payload) {
      return Number.isFinite(Number(payload?.totalMembers))
        && Number(payload.totalMembers) >= 1
        && Array.isArray(payload.memberTypeStats)
        && Array.isArray(payload.monthlySignupStats)
        && Array.isArray(payload.regionalDistribution);
    },
  },
];

const api = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
const login = await api.post("/admin/login/actionLogin", {
  data: { userId: "webmaster", userPw: password, userSe: "USR" },
  failOnStatusCode: false,
});
const loginPayload = await login.json().catch(() => ({}));
if (login.status() !== 200 || loginPayload.status !== "loginSuccess") throw new Error(`admin login failed HTTP ${login.status()}`);

for (const route of routes) {
  const response = await api.get(route.api, { failOnStatusCode: false });
  const payload = await response.json().catch(() => ({}));
  if (response.status() !== 200 || !route.validate(payload)) throw new Error(`member API contract failed ${route.api} HTTP ${response.status()}`);
}

const anonymous = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
for (const route of routes) {
  const response = await anonymous.get(route.api, { failOnStatusCode: false });
  if (![401, 403].includes(response.status())) throw new Error(`anonymous API did not fail closed ${route.api} HTTP ${response.status()}`);
}
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
    for (const route of routes) {
      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.locator(`[data-help-id="${route.selectors[0]}"]`).waitFor({ state: "visible", timeout: 12_000 }).catch(() => undefined);
      const state = await page.evaluate(({ title, selectors }) => {
        const bodyText = document.body?.innerText || "";
        const unnamed = [...document.querySelectorAll("button,a,input,select,textarea")].filter((element) => {
          if (element.matches("input[type=hidden]")) return false;
          const label = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || element.getAttribute("placeholder") || "";
          return !label.trim();
        }).length;
        return {
          bodyText,
          hasTitle: bodyText.includes(title),
          hasAllSections: selectors.every((selector) => Boolean(document.querySelector(`[data-help-id="${selector}"]`))),
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          unnamed,
          hasReplacementCharacter: bodyText.includes("�"),
        };
      }, route);
      if ((response?.status() || 0) >= 400 || errors.length) throw new Error(`${viewport.name} ${route.path} runtime error ${errors.join(" | ")}`);
      if (!state.hasTitle || !state.hasAllSections) throw new Error(`${viewport.name} ${route.path} required UI missing`);
      if (state.hasReplacementCharacter) throw new Error(`${viewport.name} ${route.path} contains replacement characters`);
      if (state.pageOverflow) throw new Error(`${viewport.name} ${route.path} page-level horizontal overflow`);
      if (state.unnamed) throw new Error(`${viewport.name} ${route.path} unnamed interactive controls=${state.unnamed}`);
      results.push({ viewport: viewport.name, route: route.path, ok: true });
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
