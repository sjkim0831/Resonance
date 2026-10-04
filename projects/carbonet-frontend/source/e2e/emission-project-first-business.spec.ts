import { expect, test } from "@playwright/test";

const baseUrl = process.env.CARBONET_FIRST_WORK_BASE_URL || "http://127.0.0.1:5175";
const projectId = "PRJ-TEST-PORTFOLIO-001";

const testSession = {
  authenticated: true,
  userId: "test-company-manager",
  authorCode: "ROLE_USER",
  insttId: "TENANT-TEST",
  companyScope: "TEST_ONLY",
  csrfToken: "playwright-test-token",
  csrfHeaderName: "X-CSRF-TOKEN",
  featureCodes: [],
  capabilityCodes: []
};

const portfolioRow = {
  id: projectId,
  name: "Fixture emission project",
  sites: [{ id: "9001", name: "Fixture site" }],
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  status: "IN_PROGRESS",
  calculatedStatus: "NOT_CALCULATED",
  updatedAt: "2026-09-28T09:00:00"
};

function workspace(status = "READY", setupDone = false) {
  const tasks: Array<{id:number;code:string;name:string;order:number;status:string;weight:number;dueDate:string;targetUrl:string;actorCode:string;completionRule:string}> = [{
    id: 99001,
    code: "BASIC_INFO",
    name: "프로젝트 기본정보 확인",
    order: 1,
    status: setupDone ? "DONE" : status,
    weight: 10,
    dueDate: "2026-12-31",
    targetUrl: "/emission/organizational-boundary",
    actorCode: "COMPANY_MANAGER",
    completionRule: "프로젝트 기간과 참여 사업장 확인"
  }];
  if (setupDone) tasks.push({
    id: 99002,
    code: "ACTIVITY_DATA",
    name: "활동자료 입력·제출",
    order: 2,
    status: "READY",
    weight: 15,
    dueDate: "2026-12-31",
    targetUrl: `/emission/activity-data?projectId=${projectId}`,
    actorCode: "SITE_DATA_OWNER",
    completionRule: "품질검사를 통과한 자료 제출"
  });
  return {
    project: {
      id: projectId,
      name: "Fixture emission project",
      site: "Fixture site",
      sites: ["Fixture site"],
      period: "2026-01-01 ~ 2026-12-31",
      scope: "미설정",
      owner: "test-company-manager",
      progress: 0,
      step: "프로젝트 준비 확인 필요",
      dueDate: "2026-12-31",
      status: "진행",
      tasks,
      members: [],
      history: []
    },
    metrics: {
      activityCount: 0,
      missingEvidenceCount: 0,
      unmappedCount: 0,
      blockingCount: 0,
      warningCount: 0,
      qualityScore: 0,
      submitReady: false,
      approvalPendingCount: 0,
      correctionCount: 0,
      calculationRunCount: 0,
      verifiedCount: 0,
      approvedCount: 0,
      totalEmission: 0,
      finalizedReportCount: 0
    },
    recentActivities: [],
    recentSubmissions: [],
    emissionBreakdown: [],
    messages: []
  };
}

async function openHomeRoute(page: import("@playwright/test").Page, route: string) {
  await page.goto(`${baseUrl}/assets/react/`);
  await page.evaluate((target) => {
    window.history.replaceState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/frontend/session", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(testSession)
  }));
  await page.route("**/api/home", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ isLoggedIn: true, isEn: false, homeMenu: [] })
  }));
  await page.route("**/api/telemetry/events", route => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/help/page**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ pageId: "emission-project-list", title: "", summary: "", items: [] })
  }));
});

test("first process selects a project and hands the same ID to project setup", async ({ page }, testInfo) => {
  const listRequests: string[] = [];
  const detailRequests: string[] = [];
  const setupRequests: string[] = [];
  let taskStatus = "READY";
  let setupDone = false;
  await page.route("**/home/api/emission-project-list-v1**", async route => {
    listRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      contractVersion: 1,
      items: [portfolioRow],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      sites: [{ id: "9001", name: "Fixture site" }],
      canCreate: false,
      scopeNotice: "TEST ONLY"
    }) });
  });
  await page.route(`**/home/api/emission-projects/${projectId}/workspace`, async route => {
    detailRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(workspace(taskStatus, setupDone)) });
  });
  await page.route(`**/home/api/emission-projects/${projectId}/setup/confirm`, async route => {
    expect(route.request().method()).toBe("POST");
    setupRequests.push(route.request().url());
    setupDone = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ projectId, setupConfirmed: true }) });
  });
  await page.route("**/home/api/emission-tasks/99001/status", async route => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ status: "IN_PROGRESS" });
    taskStatus = "IN_PROGRESS";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await openHomeRoute(page, "/emission/project_list");
  await expect(page.getByRole("heading", { name: "배출량 프로젝트" })).toBeVisible();
  await expect(page.getByText("Fixture emission project")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("first-process-portfolio.png"), fullPage: true });

  await page.getByRole("link", { name: "Fixture emission project" }).click();
  await expect(page).toHaveURL(new RegExp(`/emission/project/detail\\?projectId=${projectId}$`));
  await expect(page.getByRole("heading", { name: "프로젝트 기본정보 확인" })).toBeVisible();
  await expect.poll(() => detailRequests.length).toBe(1);
  expect(listRequests[0]).toContain("pageSize=20");

  await page.screenshot({ path: testInfo.outputPath("first-process-selected-project.png"), fullPage: true });
  await page.screenshot({ path: testInfo.outputPath("first-process-project-workspace.png"), fullPage: true });
  await page.getByRole("button", { name: "업무 시작" }).click();
  await expect(page.getByRole("button", { name: "업무 시작" })).toHaveCount(0);
  await page.getByRole("link", { name: "업무 화면 열기" }).click();
  await expect(page).toHaveURL(new RegExp(`/emission/project/detail\\?projectId=${projectId}$`));
  await expect(page.getByRole("heading", { name: "프로젝트 준비 확인" })).toBeVisible();
  await page.getByRole("button", { name: "준비 확인" }).click();
  await expect(page.getByRole("heading", { name: "활동자료 입력·제출" })).toBeVisible();
  await expect.poll(() => setupRequests.length).toBe(1);
  expect(setupRequests[0]).toContain(`/home/api/emission-projects/${projectId}/setup/confirm`);
  await expect(page.getByRole("link", { name: "업무 화면 열기" })).toHaveAttribute("href", `/emission/activity-data?projectId=${projectId}`);
  expect(detailRequests.length).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath("first-process-next-work-handoff.png"), fullPage: true });
});

test("new project creation keeps the returned project ID through detail re-read", async ({ page }, testInfo) => {
  let createPayload: Record<string, unknown> | null = null;
  let reloadedWorkspaceId = "";
  await page.route("**/home/api/emission-project-list-v1**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ contractVersion: 1, items: [], totalCount: 0, page: 1, pageSize: 20,
      sites: [{ id: "9001", name: "Fixture site" }], canCreate: true, scopeNotice: "TEST ONLY" })
  }));
  await page.route("**/home/api/emission-project-drafts/options", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ projectSetupContractVersion: 2, sites: [{ id: "9001", code: "FIXTURE", name: "Fixture site", address: "TEST ONLY" }] })
  }));
  await page.route("**/home/api/emission-project-drafts", async route => {
    createPayload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: projectId, replayed: false }) });
  });
  await page.route(`**/home/api/emission-projects/${projectId}/workspace`, async route => {
    reloadedWorkspaceId = projectId;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(workspace("READY")) });
  });

  await openHomeRoute(page, "/emission/project_list");
  await page.getByRole("link", { name: "프로젝트 등록" }).click();
  await page.getByLabel("프로젝트명 *").fill("Fixture emission project");
  await page.getByLabel("산정 시작일 *").fill("2026-01-01");
  await page.getByLabel("산정 종료일 *").fill("2026-12-31");
  await page.getByLabel("보고연도 *").fill("2026");
  await page.getByLabel("업무 마감일 *").fill("2027-01-31");
  await page.getByLabel("Scope 1", { exact: true }).check();
  await page.getByLabel("조직 경계 *").selectOption("OPERATIONAL_CONTROL");
  await page.getByLabel("적용 표준 *").selectOption("ISO_14064_1");
  await page.getByLabel("방법론 버전 *").fill("FIXTURE-1");
  await page.getByLabel("검증 수준 *").selectOption("LIMITED");
  await page.getByLabel("자료 수집 주기 *").selectOption("MONTHLY");
  await page.getByLabel("중요성 기준 (%) *").fill("5");
  await page.getByLabel("Fixture site").check();
  await page.setViewportSize({ width: 1440, height: 1500 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("project-create-with-methodology.png") });
  await page.getByRole("button", { name: "저장 후 상세 보기" }).click();

  await expect(page).toHaveURL(new RegExp(`/emission/project/detail\\?projectId=${projectId}$`));
  await expect(page.getByRole("heading", { name: "프로젝트 기본정보 확인" })).toBeVisible();
  expect(createPayload).not.toBeNull();
  expect(createPayload).toMatchObject({
    name: "Fixture emission project",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    dueDate: "2027-01-31",
    reportingYear: 2026,
    siteIds: ["9001"],
    scopes: ["Scope 1"],
    organizationBoundary: "OPERATIONAL_CONTROL",
    emissionStandard: "ISO_14064_1",
    methodologyVersion: "FIXTURE-1",
    verificationLevel: "LIMITED",
    collectionCycle: "MONTHLY",
    materialityThreshold: 5
  });
  expect(String(createPayload?.clientRequestId || "")).toMatch(/^[A-Za-z0-9_-]{16,100}$/);
  expect(createPayload).not.toHaveProperty("tenantId");
  await expect.poll(() => reloadedWorkspaceId).toBe(projectId);
});

test("setup confirmation keeps the current task when server prerequisites are missing", async ({ page }) => {
  await page.route(`**/home/api/emission-projects/${projectId}/workspace`, route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(workspace("IN_PROGRESS"))
  }));
  await page.route(`**/home/api/emission-projects/${projectId}/setup/confirm`, async route => {
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ message: "PROJECT_SETUP_INCOMPLETE" }) });
  });

  await openHomeRoute(page, `/emission/project/detail?projectId=${projectId}`);
  await page.getByRole("button", { name: "준비 확인" }).click();
  await expect(page.getByRole("alert")).toContainText("PROJECT_SETUP_INCOMPLETE");
  await expect(page.getByRole("heading", { name: "프로젝트 기본정보 확인" })).toBeVisible();
  await expect(page.getByRole("link", { name: "업무 화면 열기" })).toHaveAttribute("href", `/emission/project/detail?projectId=${projectId}`);
});

test("legacy backend cannot silently save the project without setup fields", async ({ page }) => {
  await page.route("**/home/api/emission-project-drafts/options", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ sites: [{ id: "9001", code: "FIXTURE", name: "Fixture site", address: "TEST ONLY" }] })
  }));
  await openHomeRoute(page, "/emission/project/create");
  await expect(page.getByRole("alert")).toContainText("프로젝트 준비 저장 API가 구버전입니다");
  await expect(page.getByRole("button", { name: "저장 후 상세 보기" })).toBeDisabled();
});
