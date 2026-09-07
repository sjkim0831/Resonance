import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${baseUrl}/admin/login/loginView`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#admin-id", { timeout: 10000 });
await page.fill("#admin-id", process.env.ADMIN_USER || "");
await page.fill("#password", process.env.ADMIN_PASSWORD || "");
await page.locator("button[type=submit]").click();
await page.waitForTimeout(1200);

const terms = ["프로젝트", "활동자료", "증빙", "산정", "검증", "승인", "보고서", "인증서"];
const result = [];
for (const query of terms) {
  const response = await page.evaluate(async q => {
    const url = `/admin/api/system/actor-process/page-development-master?query=${encodeURIComponent(q)}&processCode=&status=`;
    const res = await fetch(url, { credentials: "include" });
    return { status: res.status, body: await res.json() };
  }, query);
  const items = Array.isArray(response.body?.items) ? response.body.items : [];
  result.push({
    query,
    status: response.status,
    count: items.length,
    items: items.slice(0, 20).map(item => ({
      itemId: item.itemId,
      screenName: item.screenName,
      routePath: item.routePath,
      processCodes: item.processCodes,
      designGateStatus: item.designGateStatus,
      designGateScore: item.designGateScore,
      frontendStatus: item.frontendStatus,
      backendStatus: item.backendStatus,
      testStatus: item.testStatus,
      nextAction: item.nextAction,
    })),
  });
}
console.log(JSON.stringify(result, null, 2));
await browser.close();
