import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const events = [];
page.on("pageerror", error => events.push(`pageerror: ${error.message}`));
page.on("console", message => { if (message.type() === "error") events.push(`console: ${message.text()}`); });
await page.goto("http://127.0.0.1/admin/login/loginView", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#admin-id", { timeout: 10000 });
await page.fill("#admin-id", process.env.ADMIN_USER || "");
await page.fill("#password", process.env.ADMIN_PASSWORD || "");
await Promise.all([
  page.waitForLoadState("domcontentloaded"),
  page.locator("button[type=submit]").click(),
]);
await page.waitForTimeout(1500);
await page.goto("http://127.0.0.1/admin/system/page-development-master", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(document.querySelector("#root")?.innerHTML.trim()), null, { timeout: 10000 });
await page.waitForTimeout(1500);
console.log(JSON.stringify({
  url: page.url(),
  heading: await page.locator("h1,h2").first().innerText().catch(() => ""),
  hasControlCenter: await page.getByText("1천 화면을 하나의 계약과 네 가지 관점으로 관리합니다.").count(),
  hasOperationsDashboard: await page.getByText("운영 관리 대시보드").count(),
  bodyText: (await page.locator("body").innerText()).slice(0, 1200),
  events: events.slice(-20),
  relevantLinks: await page.locator("a").evaluateAll(nodes => nodes.map(node => ({ text: node.textContent?.trim(), href: node.getAttribute("href") })).filter(item => /개발|관제/.test(item.text || "") || /page-development/.test(item.href || ""))),
  menuData: await page.evaluate(async () => {
    const response = await fetch("/admin/system/menu-data", { credentials: "include" });
    return { status: response.status, body: (await response.text()).slice(0, 20000) };
  }),
}, null, 2));
await browser.close();
