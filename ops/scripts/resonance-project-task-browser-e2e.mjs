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
const projectId = String(process.env.CARBONET_ACTOR_TEST_PROJECT || "PRJ-2026-001");
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
let taskCount = 0;
const startedAt = Date.now();

try {
  for (const account of accounts) {
    const api = await request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
    try {
      const login = await api.post("/signin/actionLogin", {
        data: { userId: account, userPw: password, userSe: "USR" },
        failOnStatusCode: false,
      });
      if (login.status() !== 200) throw new Error(`login failed account=${account} status=${login.status()}`);
      const loginPayload = await login.json();
      if (loginPayload?.status === "loginFailure") throw new Error(`login rejected account=${account}`);
      const tasksResponse = await api.get("/home/api/emission-tasks", { failOnStatusCode: false });
      if (tasksResponse.status() !== 200) throw new Error(`task API failed account=${account} status=${tasksResponse.status()}`);
      const tasksPayload = await tasksResponse.json();
      const tasks = (tasksPayload.items || [])
        .filter((task) => String(task.projectId) === projectId && task.targetUrl)
        .sort((left, right) => Number(left.stepOrder || 0) - Number(right.stepOrder || 0));
      if (!tasks.length) throw new Error(`assigned task route missing account=${account} project=${projectId}`);
      taskCount += tasks.length;

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
  }

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
} finally {
  await browser.close();
}

const uniqueRoutes = new Set(routeResults.map((result) => result.target));
console.log(`[project-task-browser-e2e] PASS project=${projectId} accounts=${accounts.length} tasks=${taskCount} uniqueRoutes=${uniqueRoutes.size} anonymous=blocked durationMs=${Date.now() - startedAt}`);
