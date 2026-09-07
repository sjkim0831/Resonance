import { chromium } from "playwright";
import assert from "node:assert/strict";

const storageState = process.env.FULL_SCREEN_SMOKE_STORAGE_STATE;
const baseURL = process.env.RUNTIME_ALERT_UI_BASE_URL || "http://127.0.0.1:5175";
const outDir = process.env.RUNTIME_ALERT_EVIDENCE_DIR || ".cache/runtime-alert-workflow";
assert(storageState, "FULL_SCREEN_SMOKE_STORAGE_STATE is required");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium-browser"
});
const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(8_000);

async function api(path, init) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, { credentials: "include", ...init });
    const text = await response.text();
    let body = text;
    try { body = JSON.parse(text); } catch {}
    return { status: response.status, body };
  }, { path, init });
}

try {
  await page.goto(`${baseURL}/admin/system/notification`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  const list = await api("/api/admin/process-preview-recorder-audit");
  assert.equal(list.status, 200);
  const alert = list.body.entries.find((entry) =>
    entry.sourceCode === "PAGE_HTTP_404"
      && entry.status === "FAILED_FINAL"
      && entry.acknowledgementStatus === "UNACKNOWLEDGED");
  assert(alert, "unacknowledged PAGE_HTTP_404 alert missing");
  assert.equal(alert.severity, "HIGH");
  assert.equal(alert.assignedActor, "WEB_ADMIN");
  assert(["ASSIGNED", "RESOLVED"].includes(alert.workflowStatus));
  assert(alert.dueAt, "dueAt missing");

  let prematureCloseStatus = null;

  const alertCard = page.locator("article").filter({ hasText: `#${alert.id} · PAGE_HTTP_404` });
  await alertCard.waitFor();
  await alertCard.getByText("HIGH", { exact: true }).waitFor();
  await alertCard.getByText("WEB_ADMIN", { exact: true }).waitFor();
  if (alert.workflowStatus === "ASSIGNED") {
    const prematureClose = await api(`/api/admin/process-preview-recorder-audit/${alert.id}/acknowledge`, { method: "POST" });
    assert.equal(prematureClose.status, 409, "ASSIGNED alert must not close directly");
    prematureCloseStatus = prematureClose.status;
    await alertCard.getByText("ASSIGNED", { exact: true }).waitFor();
    await page.screenshot({ path: `${outDir}/01-assigned.png`, fullPage: true });
    await alertCard.getByRole("button", { name: "조치 완료", exact: true }).click();
    await alertCard.getByText("RESOLVED", { exact: true }).waitFor();
  }
  await alertCard.getByRole("button", { name: "확인·종료", exact: true }).waitFor();
  await page.screenshot({ path: `${outDir}/02-resolved.png`, fullPage: true });

  const resolvedTransitions = await api(`/api/admin/process-preview-recorder-audit/${alert.id}/transitions`);
  assert.equal(resolvedTransitions.status, 200);
  assert.deepEqual(resolvedTransitions.body.transitions.map((entry) => entry.toStatus), ["DETECTED", "ASSIGNED", "RESOLVED"]);

  await alertCard.getByRole("button", { name: "확인·종료", exact: true }).click();
  await alertCard.waitFor({ state: "detached" });

  const closed = await api("/api/admin/process-preview-recorder-audit");
  const closedAlert = closed.body.entries.find((entry) => entry.id === alert.id);
  assert.equal(closedAlert.workflowStatus, "CLOSED");
  assert.equal(closedAlert.acknowledgementStatus, "ACKNOWLEDGED");
  const finalTransitions = await api(`/api/admin/process-preview-recorder-audit/${alert.id}/transitions`);
  assert.deepEqual(finalTransitions.body.transitions.map((entry) => entry.toStatus), ["DETECTED", "ASSIGNED", "RESOLVED", "CLOSED"]);
  await page.locator("[data-recorder-audit-notification]").getByText("0", { exact: true }).waitFor();
  await page.screenshot({ path: `${outDir}/03-closed.png`, fullPage: true });

  console.log(JSON.stringify({
    pass: true,
    alertId: alert.id,
    policy: { severity: alert.severity, assignedActor: alert.assignedActor, dueAt: alert.dueAt },
    prematureCloseStatus,
    transitions: finalTransitions.body.transitions.map((entry) => entry.toStatus),
    finalStatus: closedAlert.workflowStatus,
    acknowledgementStatus: closedAlert.acknowledgementStatus
  }, null, 2));
} finally {
  await browser.close();
}
