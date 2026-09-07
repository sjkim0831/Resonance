#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const designDir = path.resolve(root, "../../carbonet-backend-metadata/process-runtime/generated");
const outputDir = path.resolve(process.env.PROCESS_VISUAL_RESULT_DIR || ".cache/process-visual-regression");
const baselinePath = path.resolve(process.env.PROCESS_VISUAL_BASELINE || path.join(outputDir, "last-success.json"));
const baseUrl = String(process.env.PROCESS_VISUAL_BASE_URL || "http://172.16.1.232:5175").replace(/\/$/, "");
const concurrency = Math.max(1, Math.min(8, Number(process.env.PROCESS_VISUAL_WORKERS || 4)));
const routePattern = process.env.PROCESS_VISUAL_ROUTE_PATTERN ? new RegExp(process.env.PROCESS_VISUAL_ROUTE_PATTERN) : null;
const managedExecutablePath = chromium.executablePath();
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync(managedExecutablePath) ? managedExecutablePath : fs.existsSync("/snap/bin/chromium") ? "/snap/bin/chromium" : managedExecutablePath);

const stableHash = (value) => createHash("sha256").update(value).digest("hex");
const normalizeRoute = (value) => {
  try {
    const url = new URL(String(value || ""), "http://process.local");
    return `${url.pathname}${url.search}`;
  } catch { return ""; }
};

if (!fs.existsSync(designDir)) throw new Error(`process design directory missing: ${designDir}`);
fs.mkdirSync(path.join(outputDir, "screenshots"), { recursive: true });

const routeMap = new Map();
let stepDocumentCount = 0;
for (const fileName of fs.readdirSync(designDir).filter((name) => name.endsWith(".json")).sort()) {
  const document = JSON.parse(fs.readFileSync(path.join(designDir, fileName), "utf8"));
  const processCode = String(document?.process?.code || "");
  const stepCode = String(document?.step?.code || "");
  if (!processCode || !stepCode) continue;
  stepDocumentCount += 1;
  const actorCode = String(document?.step?.actor?.actorCode || document?.step?.guide?.actorCode || "UNASSIGNED");
  const workTypeCode = String(document?.process?.workType || document?.process?.domain || "UNCLASSIFIED");
  const pages = Array.isArray(document?.frontend?.pages) ? document.frontend.pages : [];
  for (const page of pages) {
    const routePath = normalizeRoute(page?.route || (page?.audience === "ADMIN" ? document?.step?.guide?.adminPath : document?.step?.guide?.userPath));
    if (!routePath || (routePattern && !routePattern.test(routePath))) continue;
    const current = routeMap.get(routePath) || { routePath, processCodes: new Set(), stepCodes: new Set(), actorCodes: new Set(), workTypeCodes: new Set(), audiences: new Set(), pageCodes: new Set(), routeStatuses: new Set() };
    current.processCodes.add(processCode);
    current.stepCodes.add(stepCode);
    current.actorCodes.add(actorCode);
    current.workTypeCodes.add(workTypeCode);
    current.audiences.add(String(page?.audience || "UNKNOWN"));
    current.pageCodes.add(String(page?.pageCode || ""));
    current.routeStatuses.add(String(page?.routeStatus || "UNKNOWN").toUpperCase());
    routeMap.set(routePath, current);
  }
}

const routes = [...routeMap.values()].map((entry) => Object.fromEntries(Object.entries(entry).map(([key, value]) => [key, value instanceof Set ? [...value].filter(Boolean).sort() : value]))).sort((a, b) => a.routePath.localeCompare(b.routePath));
let baseline = { routes: {} };
try { baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")); } catch {}

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
const startedAt = Date.now();
const results = [];
let cursor = 0;

async function worker(workerIndex) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  while (true) {
    const index = cursor++;
    if (index >= routes.length) break;
    const route = routes[index];
    const routeStartedAt = Date.now();
    const routeIsDesignOnly = /(^|\/)planned\/|(^|\/)generated\//.test(route.routePath) || !route.routeStatuses.includes("IMPLEMENTED");
    if (routeIsDesignOnly) {
      results.push({ ...route, workerIndex, status: "DESIGN_ONLY", httpStatus: 0, finalPath: "", bodyTextLength: 0, rootChildren: 0, commonComponentCount: 0, headingCount: 0, iframeCount: 0, crash: false, overflowX: false, consoleErrorCount: 0, pageErrorCount: 0, errors: [], screenshotSha256: "", visualChanged: false, durationMs: Date.now() - routeStartedAt });
      continue;
    }
    await page.goto("about:blank", { waitUntil: "load", timeout: 3_000 }).catch(() => undefined);
    await context.clearCookies();
    const consoleErrors = [];
    const pageErrors = [];
    const onConsole = (message) => { if (message.type() === "error") consoleErrors.push(message.text()); };
    const onPageError = (error) => pageErrors.push(error.message);
    page.on("console", onConsole); page.on("pageerror", onPageError);
    let status = 0; let navigationError = "";
    try {
      const response = await page.goto(`${baseUrl}${route.routePath}`, { waitUntil: "domcontentloaded", timeout: 12_000 });
      status = response?.status() || 0;
      await page.waitForFunction(() => {
        const text = (document.body?.innerText || "").trim();
        const root = document.querySelector("#root");
        return text.length >= 20 && (root?.children.length || 0) > 0;
      }, undefined, { polling: 100, timeout: 2_500 }).catch(() => undefined);
    } catch (error) {
      navigationError = error instanceof Error ? error.message : String(error);
      await page.waitForTimeout(1_000);
      await page.waitForLoadState("domcontentloaded", { timeout: 2_000 }).catch(() => undefined);
    }
    const metrics = await page.evaluate(() => {
      const text = (document.body?.innerText || "").trim();
      const root = document.querySelector("#root");
      return {
        finalPath: `${location.pathname}${location.search}`,
        bodyTextLength: text.length,
        rootChildren: root?.children.length || 0,
        commonComponentCount: document.querySelectorAll("[data-common-component]").length,
        headingCount: document.querySelectorAll("h1,h2,[role=heading]").length,
        iframeCount: document.querySelectorAll("iframe").length,
        crash: /화면 오류가 발생했습니다|React app did not mount|Unexpected response format/i.test(text),
        overflowX: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) > document.documentElement.clientWidth + 2,
      };
    }).catch(() => ({ finalPath: "", bodyTextLength: 0, rootChildren: 0, commonComponentCount: 0, headingCount: 0, iframeCount: 0, crash: true, overflowX: false }));
    const protectedPath = /^\/(admin|emission|mypage|work|ccus)(\/|$)/.test(route.routePath);
    const authRequired = (/\/signin\/|\/admin\/login\//.test(metrics.finalPath) && !/\/signin\/|\/admin\/login\//.test(route.routePath)) || (protectedPath && !metrics.finalPath && status === 200);
    const designOnly = routeIsDesignOnly;
    const prerequisiteRequired = !authRequired && Boolean(metrics.finalPath) && metrics.finalPath !== route.routePath;
    const fatalConsoleErrors = consoleErrors.filter((message) => /uncaught|typeerror|referenceerror|react app did not mount|error boundary/i.test(message));
    const errors = [authRequired || designOnly ? "" : navigationError, ...pageErrors, ...fatalConsoleErrors].filter(Boolean);
    if (status >= 400) errors.push(`HTTP_${status}`);
    if (!authRequired && !designOnly && !prerequisiteRequired && (metrics.bodyTextLength < 20 || metrics.rootChildren === 0)) errors.push("BLANK_SCREEN");
    if (metrics.crash) errors.push("REACT_CRASH");
    if (metrics.overflowX) errors.push("OVERFLOW_X");
    let resultStatus = designOnly ? "DESIGN_ONLY" : authRequired ? "AUTH_REQUIRED" : prerequisiteRequired ? "PREREQUISITE_REQUIRED" : errors.length ? "FAIL" : "PASS";
    const fileStem = `${String(index + 1).padStart(4, "0")}-${stableHash(route.routePath).slice(0, 12)}`;
    let screenshotSha256 = "";
    if (resultStatus !== "FAIL") {
      const screenshotPath = path.join(outputDir, "screenshots", `${fileStem}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);
      if (fs.existsSync(screenshotPath)) screenshotSha256 = stableHash(fs.readFileSync(screenshotPath));
    }
    const previousSha = baseline.routes?.[route.routePath]?.screenshotSha256 || "";
    results.push({ ...route, workerIndex, status: resultStatus, httpStatus: status, ...metrics, consoleErrorCount: consoleErrors.length, pageErrorCount: pageErrors.length, errors: [...new Set(errors)].slice(0, 20), screenshotSha256, visualChanged: Boolean(previousSha && screenshotSha256 && previousSha !== screenshotSha256), durationMs: Date.now() - routeStartedAt });
    page.off("console", onConsole); page.off("pageerror", onPageError);
  }
  await context.close();
}

await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1)));
await browser.close();
results.sort((a, b) => a.routePath.localeCompare(b.routePath));
const processCodes = new Set(results.flatMap((item) => item.processCodes));
const stepCodes = new Set(results.flatMap((item) => item.stepCodes));
const actorCodes = new Set(results.flatMap((item) => item.actorCodes));
const counts = Object.fromEntries(["PASS", "AUTH_REQUIRED", "PREREQUISITE_REQUIRED", "DESIGN_ONLY", "FAIL"].map((status) => [status, results.filter((item) => item.status === status).length]));
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), baseUrl, durationMs: Date.now() - startedAt, counts: { processDesignCount: processCodes.size, stepDocumentCount, mappedStepCount: stepCodes.size, routeCount: results.length, actorCount: actorCodes.size, ...counts, visualChanged: results.filter((item) => item.visualChanged).length }, routes: results };
fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, "last-success.json"), `${JSON.stringify({ generatedAt: report.generatedAt, routes: Object.fromEntries(results.filter((item) => item.screenshotSha256).map((item) => [item.routePath, { status: item.status, screenshotSha256: item.screenshotSha256 }])) }, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, durationMs: report.durationMs, counts: report.counts }, null, 2));
if (counts.FAIL) process.exitCode = 1;
