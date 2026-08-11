#!/usr/bin/env node
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const baseURL = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const password = String(process.env.CARBONET_ADMIN_TEST_PASSWORD || "");
const account = String(process.env.CARBONET_ADMIN_TEST_USER || "webmaster");
const evidenceFile = String(process.env.CARBONET_RELAY_EVIDENCE_FILE || "");
const routeBase = String(process.env.CARBONET_RELAY_ADMIN_ROUTE || "");
const steps = String(process.env.CARBONET_RELAY_STEPS || "").split(",").filter(Boolean);
const sampleRounds = Math.max(4, Number(process.env.CARBONET_ADMIN_SAMPLE_ROUNDS || 4));
if (!password || !evidenceFile || !routeBase || !steps.length) throw new Error("admin relay browser inputs are required");

const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
const login = await api.post("/admin/login/actionLogin", { data: { userId: account, userPw: password, userSe: "USR" }, failOnStatusCode: false });
const loginBody = await login.json().catch(() => ({}));
if (login.status() !== 200 || loginBody.status !== "loginSuccess") throw new Error(`admin login failed HTTP ${login.status()}`);

const browser = await chromium.launch({ headless: true });
const routes = [];
const samples = [];
const contexts = new Map();
try {
  const storageState = await api.storageState();
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ storageState, viewport });
    contexts.set(viewport.name, context);
    const warmup = await context.newPage();
    const separator = routeBase.includes("?") ? "&" : "?";
    await warmup.goto(`${baseURL}${routeBase}${separator}step=${encodeURIComponent(steps[0].toLowerCase())}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await warmup.waitForFunction(() => (document.body?.innerText || "").includes("SCREEN COORDINATE"), undefined, { timeout: 10_000 });
    await warmup.close();
  }
  for (const stepCode of steps) {
    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      for (let round = 1; round <= sampleRounds; round += 1) {
      const context = contexts.get(viewport.name);
      if (!context) throw new Error(`missing warmed context: ${viewport.name}`);
      const page = await context.newPage();
      const failures = [];
      page.on("pageerror", error => failures.push(`pageerror:${error.name}`));
      page.on("response", response => { if (response.status() >= 500 && response.url().startsWith(baseURL)) failures.push(`http:${response.status()}`); });
      const separator = routeBase.includes("?") ? "&" : "?";
      const route = `${routeBase}${separator}step=${encodeURIComponent(stepCode.toLowerCase())}`;
      const startedAt = Date.now();
      const response = await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForFunction(() => (document.querySelector("#root")?.children.length || 0) > 0 && (document.body?.innerText || "").includes("SCREEN COORDINATE") && document.querySelectorAll("input,select,textarea,button,a[href]").length >= 8, undefined, { timeout: 10_000 });
      const durationMs = Date.now() - startedAt;
      const state = await page.evaluate(() => ({
        pathname: location.pathname,
        headings: document.querySelectorAll("h1,h2").length,
        controls: document.querySelectorAll("input,select,textarea,button,a[href]").length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        fatal: /page error|페이지 처리 중 오류|react app did not mount/i.test(document.body?.innerText || ""),
      }));
      if ((response?.status() || 0) >= 400 || !state.pathname.startsWith("/admin/") || state.headings < 1 || state.controls < 4 || state.overflow || state.fatal || failures.length) {
        throw new Error(`admin browser failed step=${stepCode} viewport=${viewport.name} status=${response?.status() || 0} headings=${state.headings} controls=${state.controls} overflow=${state.overflow} fatal=${state.fatal} failures=${failures.join(",")}`);
      }
      samples.push(durationMs);
      routes.push({ stepCode, viewport: viewport.name, round, durationMs, headings: state.headings, controls: state.controls });
      await page.close();
      }
    }
  }
} finally {
  await browser.close();
  await api.dispose();
}
const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"));
const sortedAdmin = [...samples].sort((a, b) => a - b);
if (sortedAdmin.length < 20) throw new Error(`admin performance sample count too small: ${sortedAdmin.length}`);
const adminP95 = sortedAdmin[Math.max(0, Math.ceil(sortedAdmin.length * .95) - 1)];
const p95 = Math.max(Number(evidence.performanceP95Ms || 0), adminP95);
writeFileSync(evidenceFile, `${JSON.stringify({ ...evidence, adminBrowser: 1, adminResponsive: 1, adminAccessibility: 1, adminRoutes: routes, adminPerformanceP95Ms: adminP95, performanceP95Ms: p95, performanceSampleCount: Number(evidence.performanceSampleCount || 0) + samples.length }, null, 2)}\n`);
console.log(`DECLARED_PROCESS_ADMIN_BROWSER_PASS steps=${steps.length} routes=${routes.length} p95=${p95}`);
