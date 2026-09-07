import { chromium } from "@playwright/test";

const baseURL = process.env.BASE_URL || "https://resonance.172.16.1.232.nip.io";
const password = process.env.TEST_ACCOUNT_PASSWORD;
if (!password) throw new Error("TEST_ACCOUNT_PASSWORD is required");

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } });
const response = await context.request.post(`${baseURL}/signin/actionLogin`, {
  data: { userId: "qaowner26", userPw: password, userSe: "USR" },
  headers: { "Content-Type": "application/json" }
});
if (!response.ok()) throw new Error(`login failed: ${response.status()}`);

const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
page.on("console", (message) => { if (message.type() === "error") errors.push(`console:${message.text()}`); });
page.on("response", (response) => { if (response.status() >= 400) errors.push(`http:${response.status()}:${response.url()}`); });
const routeResponse = await page.goto(`${baseURL}/emission/index`, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.getByRole("heading", { name: "배출량 현황", exact: true }).waitFor({ timeout: 15000 });
const body = await page.locator("body").innerText();
if (!body.includes("등록된 배출량 프로젝트가 없습니다.")) throw new Error("empty state not rendered");
if (body.includes("LCA 분석") || body.includes("감축 시나리오") || body.includes("91.4%")) throw new Error("legacy launcher content remains");
await page.screenshot({ path: "/tmp/emission-index-desktop.png", fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
await page.getByRole("heading", { name: "배출량 현황", exact: true }).waitFor({ timeout: 15000 });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) throw new Error(`mobile horizontal overflow: ${overflow}px`);
await page.screenshot({ path: "/tmp/emission-index-mobile.png", fullPage: true });

console.log(JSON.stringify({ http: routeResponse?.status(), title: await page.title(), errors, mobileOverflow: overflow }));
await browser.close();
