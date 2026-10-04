import { chromium } from "playwright";

const baseUrl = "http://172.16.1.232";
const username = process.env.FULL_SCREEN_SMOKE_ADMIN_USER;
const password = process.env.FULL_SCREEN_SMOKE_ADMIN_PASSWORD;
if (!username || !password) throw new Error("smoke Secret injection is required");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await page.goto(`${baseUrl}/admin/login/loginView`, { waitUntil: "domcontentloaded" });
if (/\/admin\/login\/loginView$/.test(new URL(page.url()).pathname)) {
  await page.getByRole("textbox", { name: "관리자 아이디", exact: true }).fill(username);
  await page.getByRole("textbox", { name: "비밀번호", exact: true }).fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith("/admin/login/loginView")),
    page.getByRole("button", { name: /로그인/ }).click()
  ]);
}

const results = [];
for (const width of [360, 768, 1280]) {
  await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
  await page.goto(`${baseUrl}/admin/system/consent-history`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /약관·동의 이력 관리|Terms and Consent History/ }).waitFor();
  const result = await page.evaluate(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    };
    const table = document.querySelector("table");
    const labels = [...document.querySelectorAll("label")].filter(visible).length;
    const controls = [...document.querySelectorAll("input,select,button")].filter(visible);
    const unlabeled = controls.filter((element) => {
      if (element instanceof HTMLButtonElement) return !element.textContent?.trim() && !element.getAttribute("aria-label");
      const id = element.getAttribute("id");
      return !element.getAttribute("aria-label") && !(id && document.querySelector(`label[for="${id}"]`));
    }).length;
    return {
      path: location.pathname,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      mainLandmarks: document.querySelectorAll("main").length,
      headings: document.querySelectorAll("h1,h2,h3").length,
      visibleLabels: labels,
      unlabeledControls: unlabeled,
      tableVisible: visible(table),
      liveRegions: document.querySelectorAll('[aria-live="polite"]').length,
      alertCount: document.querySelectorAll('[role="alert"]').length
    };
  });
  results.push({ width, ...result });
}

await browser.close();
console.log(JSON.stringify(results, null, 2));

for (const result of results) {
  if (result.path !== "/admin/system/consent-history") throw new Error(`route mismatch at ${result.width}px`);
  if (result.overflowX) throw new Error(`horizontal overflow at ${result.width}px`);
  if (result.mainLandmarks < 1 || result.headings < 1) throw new Error(`landmark/heading missing at ${result.width}px`);
  if (result.visibleLabels < 3 || result.unlabeledControls > 0) throw new Error(`accessible labels failed at ${result.width}px`);
  if (result.liveRegions < 1) throw new Error(`live status region missing at ${result.width}px`);
}
if (results.find((item) => item.width === 360)?.tableVisible) throw new Error("desktop table is visible at 360px");
if (!results.find((item) => item.width === 1280)?.tableVisible) throw new Error("desktop table is not visible at 1280px");
