import { expect, test, type ConsoleMessage, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type SmokeRoute = {
  id: string;
  routePath: string;
  contractIds: number[];
  audiences: string[];
  actorCodes: string[];
  processCodes: string[];
};

type SmokeManifest = {
  counts: { contractCount: number; routeCount: number; selectedRouteCount: number };
  routes: SmokeRoute[];
  shards: Array<{ index: number; routeIds: string[] }>;
};

type RouteResult = {
  routeId: string;
  routePath: string;
  contractIds: number[];
  ok: boolean;
  recovered: boolean;
  attempts: number;
  finalUrl: string;
  status: number;
  bodyTextLength: number;
  overflowX: boolean;
  loginRedirect: boolean;
  errors: string[];
  durationMs: number;
};

const manifestPath = path.resolve(process.env.FULL_SCREEN_SMOKE_MANIFEST || ".cache/full-screen-smoke/manifest.json");
const resultDir = path.resolve(process.env.FULL_SCREEN_SMOKE_RESULT_DIR || ".cache/full-screen-smoke/results");
const baseUrl = String(process.env.FULL_SCREEN_SMOKE_BASE_URL || "http://172.16.1.232").replace(/\/$/, "");
const username = String(process.env.FULL_SCREEN_SMOKE_ADMIN_USER || "");
const password = String(process.env.FULL_SCREEN_SMOKE_ADMIN_PASSWORD || "");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SmokeManifest;
const routesById = new Map(manifest.routes.map((route) => [route.id, route]));

test.use({ viewport: { width: 1440, height: 1000 } });
test.describe.configure({ mode: "parallel" });
test.setTimeout(5 * 60_000);

async function ensureAdminSession(page: Page) {
  await page.goto(`${baseUrl}/admin/login/loginView`, { waitUntil: "domcontentloaded" });
  if (!/\/admin\/login\/loginView$/.test(new URL(page.url()).pathname)) return;
  if (!username || !password) throw new Error("FULL_SCREEN_SMOKE_ADMIN_USER and FULL_SCREEN_SMOKE_ADMIN_PASSWORD are required");
  await page.getByRole("textbox", { name: "관리자 아이디", exact: true }).fill(username);
  await page.getByRole("textbox", { name: "비밀번호", exact: true }).fill(password);
  await Promise.all([
    page.waitForURL((url) => !/\/admin\/login\/loginView$/.test(url.pathname), { timeout: 15_000 }),
    page.getByRole("button", { name: /로그인/ }).click()
  ]);
}

async function inspectRoute(page: Page, route: SmokeRoute, testInfo: TestInfo, attempt: number) {
  const startedAt = Date.now();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const onPageError = (error: Error) => pageErrors.push(error.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  let status = 0;
  let navigationError = "";
  try {
    const response = await page.goto(`${baseUrl}${route.routePath}`, { waitUntil: "domcontentloaded", timeout: 12_000 });
    status = response?.status() || 0;
    await page.waitForFunction(() => {
      const text = (document.body?.innerText || "").trim();
      return !/관리자 화면을 준비하고 있습니다|Bootstrap loaded\. Waiting for React app mount|Loading admin shell|화면 준비 중/.test(text);
    }, undefined, { polling: 100, timeout: 2_500 }).catch(() => undefined);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  const metrics = await page.evaluate(() => {
    const body = document.body;
    const root = document.querySelector("#root");
    const text = (body?.innerText || "").trim();
    const width = Math.max(document.documentElement.scrollWidth, body?.scrollWidth || 0);
    const loginRedirect = /\/admin\/login\/loginView$/.test(location.pathname);
    return {
      finalUrl: location.href,
      bodyTextLength: text.length,
      rootChildren: root?.children.length ?? -1,
      overflowX: width > document.documentElement.clientWidth + 2,
      loginRedirect,
      bootstrapStuck: /Bootstrap loaded\. Waiting for React app mount/.test(text)
    };
  });
  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  const errors = [navigationError, ...pageErrors, ...consoleErrors].filter(Boolean);
  if (status >= 400) errors.push(`HTTP_${status}`);
  if (metrics.bodyTextLength < 20 || metrics.rootChildren === 0) errors.push("BLANK_SCREEN");
  if (metrics.bootstrapStuck) errors.push("BOOTSTRAP_STUCK");
  if (metrics.overflowX) errors.push("OVERFLOW_X");
  if (route.audiences.includes("ADMIN") && metrics.loginRedirect) errors.push("ADMIN_LOGIN_REDIRECT");
  const ok = errors.length === 0;
  if (!ok && attempt === 2) {
    await page.screenshot({ path: testInfo.outputPath(`route-${route.id}.png`), fullPage: false });
  }
  return {
    routeId: route.id,
    routePath: route.routePath,
    contractIds: route.contractIds,
    ok,
    recovered: false,
    attempts: attempt,
    finalUrl: metrics.finalUrl,
    status,
    bodyTextLength: metrics.bodyTextLength,
    overflowX: metrics.overflowX,
    loginRedirect: metrics.loginRedirect,
    errors: [...new Set(errors)].map((error) => String(error).slice(0, 500)),
    durationMs: Date.now() - startedAt
  } satisfies RouteResult;
}

for (const shard of manifest.shards) {
  test(`full screen smoke shard ${shard.index + 1}/${manifest.shards.length}`, async ({ page }, testInfo) => {
    test.skip(shard.routeIds.length === 0, "No changed routes assigned to this shard");
    await ensureAdminSession(page);
    const results: RouteResult[] = [];
    for (const routeId of shard.routeIds) {
      const route = routesById.get(routeId);
      if (!route) throw new Error(`Unknown route id: ${routeId}`);
      let result = await inspectRoute(page, route, testInfo, 1);
      if (!result.ok) {
        await page.waitForTimeout(120);
        const retry = await inspectRoute(page, route, testInfo, 2);
        result = { ...retry, recovered: retry.ok };
      }
      results.push(result);
      mkdirSync(resultDir, { recursive: true });
      writeFileSync(path.join(resultDir, `shard-${shard.index}.json`), `${JSON.stringify({ shard: shard.index, complete: false, results }, null, 2)}\n`);
    }

    mkdirSync(resultDir, { recursive: true });
    writeFileSync(path.join(resultDir, `shard-${shard.index}.json`), `${JSON.stringify({ shard: shard.index, complete: true, results }, null, 2)}\n`);
    const failures = results.filter((result) => !result.ok);
    const recovered = results.filter((result) => result.recovered);
    await testInfo.attach("screen-smoke-summary", {
      body: JSON.stringify({ routes: results.length, failures: failures.length, recovered: recovered.length }),
      contentType: "application/json"
    });
    expect(failures, failures.slice(0, 10).map((failure) => `${failure.routePath}: ${failure.errors.join(",")}`).join("\n")).toEqual([]);
  });
}
