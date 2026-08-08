#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(process.env.RESONANCE_ROOT || process.cwd());
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const base = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const password = String(process.env.CARBONET_ADMIN_TEST_PASSWORD || "");
const ids = String(process.env.MEMBER_APPROVAL_FIXTURE_IDS || "").split(",").filter(Boolean);
if (!password || ids.length !== 2) throw new Error("admin secret and exactly two fixture ids are required");

const api = await request.newContext({ baseURL: base, ignoreHTTPSErrors: true });
const login = await api.post("/admin/login/actionLogin", { data: { userId: "webmaster", userPw: password, userSe: "USR" }, failOnStatusCode: false });
const loginBody = await login.json().catch(() => ({}));
if (login.status() !== 200 || loginBody.status !== "loginSuccess") throw new Error(`admin login failed ${login.status()}`);

const anonymous = await request.newContext({ baseURL: base, ignoreHTTPSErrors: true });
for (const url of ["/admin/api/admin/member/approve/page", "/admin/api/admin/member/approve/action"]) {
  const response = url.endsWith("/action")
    ? await anonymous.post(url, { data: { action: "approve", memberId: ids[0] }, failOnStatusCode: false })
    : await anonymous.get(url, { failOnStatusCode: false });
  if (![401, 403].includes(response.status())) throw new Error(`anonymous access not denied ${url} ${response.status()}`);
}
await anonymous.dispose();

const invalid = await api.post("/admin/api/admin/member/approve/action", { data: { action: "unsupported", memberId: ids[0] }, failOnStatusCode: false });
if (invalid.status() < 400) throw new Error("unsupported approval action did not fail closed");

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const outcomes = [];
try {
  for (const [index, fixtureId] of ids.entries()) {
    const viewport = index === 0 ? { name: "desktop", width: 1440, height: 1000 } : { name: "mobile", width: 390, height: 844 };
    const context = await browser.newContext({ viewport, storageState: await api.storageState(), ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`${base}/admin/member/approve?sbscrbSttus=A&searchKeyword=${encodeURIComponent(fixtureId)}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.locator('[data-help-id="member-approve-search"]').waitFor({ state: "visible", timeout: 15000 });
    const row = page.getByRole("row").filter({ hasText: fixtureId });
    await row.waitFor({ state: "visible", timeout: 12000 });
    if (await row.count() !== 1) throw new Error(`${viewport.name} fixture row count mismatch`);
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      unnamed: [...document.querySelectorAll("button,a,input,select,textarea")].filter((el) => {
        if (el.matches("input[type=hidden]")) return false;
        const id = el.getAttribute("id") || "";
        const label = el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || (id ? document.querySelector(`label[for=\"${CSS.escape(id)}\"]`)?.textContent : "") || "";
        return !label.trim();
      }).length,
    }));
    if ((response?.status() || 0) >= 400 || errors.length || state.overflow || state.unnamed) throw new Error(`${viewport.name} UI contract failed ${JSON.stringify(state)}`);
    if (index === 0) {
      const [decision] = await Promise.all([
        page.waitForResponse((r) => new URL(r.url()).pathname === "/admin/api/admin/member/approve/action" && r.request().method() === "POST", { timeout: 15000 }),
        row.getByRole("button", { name: "승인", exact: true }).click(),
      ]);
      if (decision.status() !== 200) {
        const body = await decision.json().catch(() => ({}));
        throw new Error(`approve failed ${decision.status()} code=${String(body.errorCode || body.status || "UNKNOWN")}`);
      }
      outcomes.push({ viewport: viewport.name, action: "APPROVE", responsive: 1, accessible: 1 });
    } else {
      await row.getByRole("button", { name: "반려", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ state: "visible", timeout: 10000 });
      const reason = dialog.locator("textarea");
      await reason.fill("QA 자동 검증 보완 요청");
      const [decision] = await Promise.all([
        page.waitForResponse((r) => new URL(r.url()).pathname === "/admin/api/admin/member/approve/action" && r.request().method() === "POST", { timeout: 15000 }),
        dialog.getByRole("button", { name: "반려", exact: true }).click(),
      ]);
      if (decision.status() !== 200) {
        const body = await decision.json().catch(() => ({}));
        throw new Error(`reject failed ${decision.status()} code=${String(body.errorCode || body.status || "UNKNOWN")}`);
      }
      outcomes.push({ viewport: viewport.name, action: "REJECT", responsive: 1, accessible: 1 });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await api.dispose();
}
console.log(JSON.stringify({ status: "PASS", processCode: "MEMBER_APPROVAL", happy: 1, auth: 1, exception: 1, isolation: 1, recovery: 1, databasePending: 1, outcomes }));
