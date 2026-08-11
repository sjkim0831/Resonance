#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium } = require("@playwright/test");
const baseUrl = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};

function completePath(id, name = "QA 신청자", company = "QA 기업") {
  return `/join/step5?${new URLSearchParams({
    mberId: id,
    mberNm: name,
    insttNm: company,
    receiptNumber: `RCPT-${id}`,
    applicationStatus: "PENDING_APPROVAL",
    membershipType: "E",
    submittedAt: "2026-08-11 15:00",
    nextAction: "ADMIN_APPROVAL",
  })}`;
}

async function inspect(context, route, expected = {}) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.getByRole("heading", { name: "가입 신청 완료", exact: true }).waitFor({ timeout: 12_000 });
  const state = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    fatal: /페이지 처리 중 오류|AUTHENTICATION_REQUIRED|React app did not mount/.test(document.body.innerText),
    unnamedActions: [...document.querySelectorAll("button,a[href]")].filter(element => {
      const label = (element.getAttribute("aria-label") || element.textContent || "").trim();
      return !label;
    }).length,
    duplicateIds: [...document.querySelectorAll("[id]")].map(element => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index).length,
  }));
  if ((response?.status() || 0) >= 400 || pageErrors.length || state.overflow || state.fatal || state.unnamedActions || state.duplicateIds) {
    throw new Error(`step5 visual contract failed ${JSON.stringify({ status: response?.status(), ...state, pageErrorCount: pageErrors.length })}`);
  }
  for (const text of expected.present || []) await page.getByText(text, { exact: true }).waitFor();
  for (const text of expected.absent || []) {
    if (await page.getByText(text, { exact: true }).count()) throw new Error("step5 isolation contract failed");
  }
  return page;
}

const results = [];
try {
  const happy = await browser.newContext({ viewport: viewports.desktop });
  const happyPage = await inspect(happy, completePath("QA-S5-HAPPY"), {
    present: ["QA-S5-HAPPY", "RCPT-QA-S5-HAPPY", "관리자 승인 대기", "관리자 검토·승인"],
  });
  await happyPage.getByRole("button", { name: "홈으로 이동", exact: true }).waitFor();
  results.push({ caseType: "HAPPY_PATH", viewport: "desktop", passed: 1 });
  await happy.close();

  const authority = await browser.newContext({ viewport: viewports.mobile });
  await inspect(authority, completePath("QA-S5-PUBLIC"), { present: ["QA-S5-PUBLIC", "가입 신청 완료"] });
  results.push({ caseType: "AUTHORITY", viewport: "mobile", anonymousAccess: 1, passed: 1 });
  await authority.close();

  const isolatedA = await browser.newContext({ viewport: viewports.desktop });
  const isolatedB = await browser.newContext({ viewport: viewports.desktop });
  await inspect(isolatedA, completePath("QA-S5-ISO-A"), { present: ["QA-S5-ISO-A"], absent: ["QA-S5-ISO-B"] });
  await inspect(isolatedB, completePath("QA-S5-ISO-B"), { present: ["QA-S5-ISO-B"], absent: ["QA-S5-ISO-A"] });
  results.push({ caseType: "ISOLATION", contexts: 2, passed: 1 });
  await isolatedA.close();
  await isolatedB.close();

  const exception = await browser.newContext({ viewport: viewports.mobile });
  const exceptionPage = await inspect(exception, "/join/step5", { present: ["확인 불가"] });
  if (await exceptionPage.getByText("확인 불가", { exact: true }).count() < 5) throw new Error("step5 missing-data fallback incomplete");
  results.push({ caseType: "EXCEPTION", fallbackFields: 5, passed: 1 });
  await exception.close();

  const recovery = await browser.newContext({ viewport: viewports.mobile });
  const recoveryPage = await inspect(recovery, completePath("QA-S5-RECOVERY"), { present: ["QA-S5-RECOVERY"] });
  await recoveryPage.reload({ waitUntil: "domcontentloaded" });
  await recoveryPage.getByText("QA-S5-RECOVERY", { exact: true }).waitFor();
  results.push({ caseType: "RECOVERY", reload: 1, passed: 1 });
  await recovery.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  status: "PASS",
  processCode: "MEMBER_REGISTRATION",
  stepCode: "MEMBER_REGISTRATION_S5",
  caseCount: results.length,
  responsive: 1,
  accessibility: 1,
  results,
}));
