#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(process.env.RESONANCE_ROOT || process.cwd());
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const base = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const password = String(process.env.CARBONET_ADMIN_TEST_PASSWORD || "");
if (!password) throw new Error("admin test password is required");

const api = await request.newContext({ baseURL: base, ignoreHTTPSErrors: true });
const login = await api.post("/admin/login/actionLogin", {
  data: { userId: "webmaster", userPw: password, userSe: "USR" },
  failOnStatusCode: false,
});
const loginBody = await login.json().catch(() => ({}));
if (login.status() !== 200 || loginBody.status !== "loginSuccess") throw new Error(`admin login failed ${login.status()}`);

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const routes = [];
try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    for (const route of ["/join/companyRegisterComplete", "/admin/member/company_list"]) {
      const context = await browser.newContext({
        viewport,
        storageState: route.startsWith("/admin/") ? await api.storageState() : undefined,
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const started = performance.now();
      const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(() => window.__CARBONET_REACT_APP_MOUNTED__ === true && (document.querySelector("#root")?.children.length || 0) > 0, null, { timeout: 15000 });
      await page.waitForFunction(() => document.body.innerText.trim().length >= 40, null, { timeout: 15000 });
      const durationMs = Math.round(performance.now() - started);
      const state = await page.evaluate(() => {
        const controls = [...document.querySelectorAll("button,a,input,select,textarea")].filter((element) => !element.matches("input[type=hidden]"));
        const unnamed = controls.filter((element) => {
          const id = element.getAttribute("id") || "";
          const label = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || (id ? document.querySelector(`label[for=\"${CSS.escape(id)}\"]`)?.textContent : "") || "";
          return !label.trim();
        }).length;
        const ids = [...document.querySelectorAll("[id]")].map((element) => element.id).filter(Boolean);
        return {
          bodyLength: document.body.innerText.trim().length,
          duplicateIds: ids.length - new Set(ids).size,
          fatal: /Page Error|React app did not mount|페이지 처리 중 오류/.test(document.body.innerText),
          mainContentCount: document.querySelectorAll("#main-content").length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
          unnamed,
        };
      });
      if ((response?.status() || 0) >= 400 || pageErrors.length || state.bodyLength < 40 || state.fatal || state.overflow || state.unnamed || state.duplicateIds || state.mainContentCount > 1) {
        throw new Error(`${viewport.name} ${route} contract failed ${JSON.stringify({ status: response?.status(), pageErrors: pageErrors.length, ...state })}`);
      }
      routes.push({ viewport: viewport.name, route, status: response?.status() || 0, durationMs, responsive: 1, accessible: 1, duplicateMount: 0 });
      await context.close();
    }
  }
} finally {
  await browser.close();
  await api.dispose();
}

console.log(JSON.stringify({ status: "PASS", processCode: "COMPANY_REGISTRATION_APPROVAL", routeCount: routes.length, routes }));
