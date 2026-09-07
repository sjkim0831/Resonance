import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const events = [];
page.on("console", message => events.push({ type: `console:${message.type()}`, text: message.text() }));
page.on("pageerror", error => events.push({ type: "pageerror", text: error.stack || error.message }));
page.on("requestfailed", request => events.push({ type: "requestfailed", text: `${request.url()} ${request.failure()?.errorText || ""}` }));
const response = await page.goto("http://127.0.0.1/admin/system/page-development-master", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);
console.log(JSON.stringify({
  status: response?.status(),
  url: page.url(),
  title: await page.title(),
  rootHtmlLength: await page.locator("#root").innerHTML().then(value => value.length).catch(() => -1),
  bodyText: (await page.locator("body").innerText()).slice(0, 1200),
  events,
}, null, 2));
await browser.close();
