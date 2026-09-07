import { chromium } from "playwright";
import assert from "node:assert/strict";

const storageState = process.env.FULL_SCREEN_SMOKE_STORAGE_STATE;
const out = process.env.RUNTIME_ALERT_ESCALATION_SCREENSHOT || ".cache/runtime-alert-workflow/04-escalated.png";
assert(storageState);
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium-browser" });
const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(8_000);

async function api(path, method = "GET") {
  return page.evaluate(async ({ path, method }) => {
    const response = await fetch(path, { method, credentials: "include" });
    return { status: response.status, body: await response.json() };
  }, { path, method });
}

try {
  await page.goto("http://127.0.0.1:5175/admin/system/notification", { waitUntil: "domcontentloaded" });
  const list = await api("/api/admin/process-preview-recorder-audit");
  const recovered = list.body.entries.find((entry) => entry.id === 22);
  assert(["RESOLVED", "CLOSED"].includes(recovered.workflowStatus));
  assert.equal(recovered.resolvedBy, undefined);

  const canary = list.body.entries.find((entry) => entry.sourceCode?.startsWith("SLA_ESCALATION_") && entry.acknowledgementStatus === "UNACKNOWLEDGED");
  assert(canary);
  assert.equal(canary.workflowStatus, "ASSIGNED");
  assert.equal(canary.assignedActor, "OPERATIONS_MANAGER");
  assert.equal(canary.escalationLevel, 1);

  const card = page.locator("article").filter({ hasText: `#${canary.id} · ${canary.sourceCode}` });
  await page.getByText("화면 준비 중").waitFor({ state: "detached" });
  await card.getByText("OPERATIONS_MANAGER", { exact: true }).waitFor();
  await card.getByText("상위 보고 1", { exact: true }).waitFor();
  await page.screenshot({ path: out, fullPage: true });

  const transitions = await api(`/api/admin/process-preview-recorder-audit/${canary.id}/transitions`);
  assert.deepEqual(transitions.body.transitions.map((entry) => entry.toStatus), ["DETECTED", "ASSIGNED", "ASSIGNED"]);
  assert.equal((await api(`/api/admin/process-preview-recorder-audit/${canary.id}/resolve`, "POST")).status, 200);
  assert.equal((await api(`/api/admin/process-preview-recorder-audit/${canary.id}/acknowledge`, "POST")).status, 200);
  if (recovered.workflowStatus === "RESOLVED") assert.equal((await api("/api/admin/process-preview-recorder-audit/22/acknowledge", "POST")).status, 200);

  const final = await api("/api/admin/process-preview-recorder-audit");
  assert.equal(final.body.entries.find((entry) => entry.id === 22).workflowStatus, "CLOSED");
  assert.equal(final.body.entries.find((entry) => entry.id === canary.id).workflowStatus, "CLOSED");
  console.log(JSON.stringify({ pass: true, recoveredAlertId: 22, escalationCanaryId: canary.id, escalationActor: canary.assignedActor, escalationLevel: canary.escalationLevel }, null, 2));
} finally {
  await browser.close();
}
