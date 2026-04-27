import { expect, test } from "@playwright/test";

test("join company register renders without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
  });

  await page.route("**/api/telemetry/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("http://127.0.0.1:18000/join/companyRegister", { waitUntil: "networkidle" });

  await expect(page.locator("body")).toContainText(/회원가입|Sign Up/);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests.filter((item) => !item.includes("/api/telemetry/events"))).toEqual([]);
});

test("target pages survive revisit navigation", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
  });

  await page.route("**/api/telemetry/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  const paths = [
    "http://127.0.0.1:18000/admin/member/approve",
    "http://127.0.0.1:18000/admin/member/company-approve",
    "http://127.0.0.1:18000/join/companyRegister",
    "http://127.0.0.1:18000/admin/member/approve",
    "http://127.0.0.1:18000/admin/member/company-approve",
    "http://127.0.0.1:18000/join/companyRegister"
  ];

  for (const path of paths) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
  }

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests.filter((item) => !item.includes("/api/telemetry/events"))).toEqual([]);
});

test("/co2/production_list renders the migrated production dashboard", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
  });

  await page.route("**/api/telemetry/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("http://127.0.0.1:18000/co2/production_list", { waitUntil: "load" });

  await expect(page.locator("[data-help-id='co2-production-hero']")).toBeVisible();
  await expect(page.locator("body")).toContainText("생산 연계 탄소 효율성 현황");
  await expect(page.locator("#shell-loading")).toBeHidden();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests.filter((item) => !item.includes("/api/telemetry/events"))).toEqual([]);
});
