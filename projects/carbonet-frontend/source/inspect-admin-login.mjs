import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1/admin/login/loginView", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(document.querySelector("#root")?.innerHTML.trim()), null, { timeout: 10000 });
console.log(JSON.stringify({
  inputs: await page.locator("input").evaluateAll(nodes => nodes.map(node => ({ name: node.getAttribute("name"), id: node.id, type: node.getAttribute("type"), placeholder: node.getAttribute("placeholder") }))),
  buttons: await page.locator("button").evaluateAll(nodes => nodes.map(node => ({ text: node.textContent?.trim(), type: node.getAttribute("type") }))),
  forms: await page.locator("form").evaluateAll(nodes => nodes.map(node => ({ action: node.getAttribute("action"), method: node.getAttribute("method") }))),
  formHtml: await page.locator("form").first().innerHTML(),
}, null, 2));
await browser.close();
