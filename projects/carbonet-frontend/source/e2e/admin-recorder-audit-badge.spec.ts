import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.ADMIN_RECORDER_BADGE_BASE_URL || "http://127.0.0.1";

const adminSession = {
  authenticated: true,
  userId: "admin-recorder-badge-e2e",
  authorCode: "ROLE_ADMIN",
  insttId: "SYSTEM",
  companyScope: "ALLOW_MASTER",
  csrfToken: "recorder-badge-e2e-token",
  csrfHeaderName: "X-CSRF-TOKEN",
  featureCodes: ["ADMIN_A0010101_VIEW", "MEMBER_LIST_SEARCH"],
  capabilityCodes: [],
};

const adminMenuTree = {
  "운영 대시보드": {
    label: "운영 대시보드",
    labelEn: "Operations Dashboard",
    summary: "운영 대시보드",
    groups: [{
      title: "운영 대시보드",
      titleEn: "Operations Dashboard",
      icon: "dashboard",
      links: [{ text: "관리자 홈", tEn: "Admin Home", u: "/admin/", icon: "dashboard" }],
    }],
  },
};

async function stubAdminShell(page: Page, unacknowledgedCount: number) {
  await page.route("**/api/frontend/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(adminSession),
  }));
  await page.route("**/admin/system/menu-data", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(adminMenuTree),
  }));
  await page.route("**/qa/process-preview-recorder-audit.json", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ version: "process-preview-recorder-audit-v2", unacknowledgedCount, entries: [] }),
  }));
  await page.route("**/api/admin/process-preview-recorder-audit", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, unacknowledgedCount, entries: [] }),
  }));
  await page.route("**/api/telemetry/events", (route) => route.fulfill({ status: 204, body: "" }));
}

async function openAdminShell(page: Page) {
  await page.goto(`${baseURL}/assets/react/`);
  await page.evaluate(() => {
    window.history.replaceState({}, "", "/admin/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

test.describe("admin recorder audit notification badge", () => {
  test("renders the green zero state and audit-ledger link", async ({ page }) => {
    await stubAdminShell(page, 0);
    await openAdminShell(page);

    const badge = page.locator("[data-recorder-audit-notification]");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("녹화");
    await expect(badge).toContainText("0");
    await expect(badge).toHaveAttribute("aria-label", "미리보기 녹화 알림: 미확인 0건");
    await expect(badge).toHaveAttribute("href", "/qa/process-preview-recorder-audit/index.html");
    await expect(badge).toHaveAttribute("target", "_blank");
    await expect(badge).toHaveClass(/border-emerald-300/);
    await expect(badge).toHaveClass(/text-emerald-700/);
  });

  test("renders the red warning state with the exact unresolved count", async ({ page }) => {
    await stubAdminShell(page, 2);
    await openAdminShell(page);

    const badge = page.locator("[data-recorder-audit-notification]");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("녹화");
    await expect(badge).toContainText("2");
    await expect(badge).toHaveAttribute("aria-label", "미리보기 녹화 알림: 미확인 2건");
    await expect(badge).toHaveClass(/border-red-300/);
    await expect(badge).toHaveClass(/text-red-700/);
  });
});
