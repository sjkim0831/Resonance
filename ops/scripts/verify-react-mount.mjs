import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(`${process.cwd()}/package.json`);
const playwrightEntry = require.resolve("playwright");
const playwright = await import(pathToFileURL(playwrightEntry).href);
const chromium = playwright.chromium ?? playwright.default?.chromium;
if (!chromium) throw new Error(`Playwright Chromium export is unavailable: ${playwrightEntry}`);

const baseUrl = process.env.BASE_URL || "http://127.0.0.1";
const targetPath = process.env.REACT_MOUNT_PROBE_PATH || "/admin/login/loginView";
const authenticatedRoutes = [
  {
    path: "/admin/system/page-development-master",
    expectedText: "1천 화면을 하나의 계약과 네 가지 관점으로 관리합니다.",
    forbiddenText: "운영 관리 대시보드",
  },
];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const failures = [];
page.on("pageerror", error => failures.push(`pageerror: ${error.message}`));
page.on("requestfailed", request => {
  const url = request.url();
  if (url.includes("/assets/react/")) failures.push(`asset: ${url} ${request.failure()?.errorText || ""}`);
});
page.on("console", message => {
  if (message.type() === "error" && /runtime error|conflict|not mount|uncaught/i.test(message.text())) failures.push(`console: ${message.text()}`);
});

try {
  const response = await page.goto(`${baseUrl}${targetPath}`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForFunction(() => Boolean(document.querySelector("#root")?.innerHTML.trim()), null, { timeout: 10000 }).catch(() => undefined);
  const rootLength = await page.locator("#root").innerHTML().then(value => value.length).catch(() => 0);
  if (!response || response.status() >= 400) failures.push(`http: ${response?.status() ?? "no-response"}`);
  if (rootLength === 0) failures.push("mount: #root is empty");
  if (process.env.ADMIN_SMOKE_USER && process.env.ADMIN_SMOKE_PASSWORD) {
    await page.goto(`${baseUrl}/admin/login/loginView`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("#admin-id", { timeout: 10000 });
    await page.fill("#admin-id", process.env.ADMIN_SMOKE_USER);
    await page.fill("#password", process.env.ADMIN_SMOKE_PASSWORD);
    await page.locator("button[type=submit]").click();
    await page.waitForTimeout(1200);
    for (const route of authenticatedRoutes) {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForFunction(expected => document.body.innerText.includes(String(expected)), route.expectedText, { timeout: 10000 }).catch(() => undefined);
      const body = await page.locator("body").innerText();
      if (!body.includes(route.expectedText)) failures.push(`route: ${route.path} expected fingerprint missing`);
      if (body.includes(route.forbiddenText)) failures.push(`route: ${route.path} resolved to forbidden fallback`);
    }
  }
  if (failures.length) {
    console.error(JSON.stringify({ success: false, url: page.url(), rootLength, failures }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ success: true, url: page.url(), rootLength }, null, 2));
  }
} finally {
  await browser.close();
}
