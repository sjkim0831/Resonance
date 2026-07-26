import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1";
const targetPath = process.env.REACT_MOUNT_PROBE_PATH || "/admin/login/loginView";
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
  const response = await page.goto(`${baseUrl}${targetPath}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  const rootLength = await page.locator("#root").innerHTML().then(value => value.length).catch(() => 0);
  if (!response || response.status() >= 400) failures.push(`http: ${response?.status() ?? "no-response"}`);
  if (rootLength === 0) failures.push("mount: #root is empty");
  if (failures.length) {
    console.error(JSON.stringify({ success: false, url: page.url(), rootLength, failures }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ success: true, url: page.url(), rootLength }, null, 2));
  }
} finally {
  await browser.close();
}
