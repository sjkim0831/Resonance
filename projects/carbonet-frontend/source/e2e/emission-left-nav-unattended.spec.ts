import { expect, test, type Page, type TestInfo } from "@playwright/test";

const baseUrl = String(process.env.CARBONET_FIRST_WORK_BASE_URL || "http://127.0.0.1:5175").replace(/\/$/, "");
const menu = [{
  label: "탄소 배출",
  url: "/emission/index",
  sections: [{ label: "업무 시작", items: [
    { label: "배출량 현황", url: "/emission/index" },
    { label: "배출량 프로젝트", url: "/emission/project_list" },
    { label: "마감·지연 현황", url: "/emission/deadline-status" },
    { label: "활동자료 관리", url: "/emission/activity-data" },
    { label: "데이터 검증", url: "/emission/data-validation" },
    { label: "픽스처 차단 검증용 메뉴", url: "/emission/forbidden-fixture-route" },
  ] }],
}];

async function installFixture(page: Page) {
  await page.route("**/api/frontend/session", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ authenticated: true, userId: "qa-fixture", authorCode: "ROLE_TEST", insttId: "TENANT_FIXTURE", companyScope: "FIXTURE_ONLY", csrfToken: "fixture-token", csrfHeaderName: "X-CSRF-TOKEN", featureCodes: [], capabilityCodes: [] }),
  }));
  await page.route("**/api/home", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isLoggedIn: true, isEn: false, homeMenu: menu }) }));
  await page.route("**/api/telemetry/events", route => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/help/page**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ pageId: "qa-fixture", title: "", summary: "", items: [] }) }));
  await page.route("**/home/api/emission-tasks**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], summary: { serverDate: "2026-10-04" } }) }));
  await page.route("**/home/api/emission-project-list-v1**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ contractVersion: 1, items: [], totalCount: 0, page: 1, pageSize: 20, sites: [], canCreate: false, scopeNotice: "FIXTURE ONLY" }) }));
}

async function openRoute(page: Page, routePath: string) {
  await page.goto(`${baseUrl}/assets/react/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(path => {
    window.history.replaceState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, routePath);
}

async function collapseWorkflowGuide(page: Page) {
  const openPanels = page.locator('[data-task-quest-panel][data-utility-panel-state="open"] button[aria-label="접기"]:visible');
  for (let index = 0; index < 3 && await openPanels.count(); index += 1) await openPanels.first().click();
  await expect(page.locator('[data-task-quest-panel][data-utility-panel-state="open"]')).toHaveCount(0);
}

async function assertMenu(page: Page, current: string) {
  const nav = page.getByRole("complementary", { name: "탄소배출 업무 메뉴" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "배출량 현황", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: /배출량 프로젝트/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /마감·지연 현황/ })).toBeVisible();
  await expect(nav.getByText("픽스처 차단 검증용 메뉴")).toHaveCount(0);
  await expect(nav.getByRole("heading", { name: "자료·검증" })).toHaveCount(0);
  await expect(nav.getByText("활동자료 관리", { exact: true })).toHaveCount(0);
  await expect(nav.getByRole("heading", { name: "최근 메뉴" })).toHaveCount(0);
  await expect(nav.getByRole("searchbox", { name: "메뉴 검색" })).toHaveCount(0);
  await expect(nav.locator(`[href="${current}"][aria-current="page"]`)).toBeVisible();
}

async function assertHeaderFrameAlignment(page: Page) {
  const bounds = await page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const logo = Array.from(document.querySelectorAll("header .home-brand-link")).find(isVisible);
    const logout = Array.from(document.querySelectorAll("header button")).find(button => isVisible(button) && button.textContent?.trim() === "로그아웃");
    const frame = document.querySelector(".ew-work-layout");
    if (!logo || !logout || !frame) return null;
    const logoRect = logo.getBoundingClientRect();
    const logoutRect = logout.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    return { leftDelta: Math.abs(frameRect.left - logoRect.left), rightDelta: Math.abs(frameRect.right - logoutRect.right) };
  });
  expect(bounds, "헤더 로고·로그아웃과 본문 레이아웃 경계 측정").not.toBeNull();
  expect(bounds!.leftDelta, "본문 왼쪽은 로고 왼쪽 기준에 맞춤").toBeLessThanOrEqual(2);
  expect(bounds!.rightDelta, "본문 오른쪽은 로그아웃 버튼 오른쪽 기준에 맞춤").toBeLessThanOrEqual(2);
}

test.describe("무인 QA · 좌측 업무 메뉴 파일럿 (격리 픽스처)", () => {
  test.beforeEach(async ({ page }) => installFixture(page));

  test("마감·지연 현황: 메뉴 권한 필터, 현재 메뉴, 데스크톱 증거", async ({ page }, testInfo: TestInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openRoute(page, "/emission/deadline-status");
    await collapseWorkflowGuide(page);
    await expect(page.getByRole("heading", { name: "마감·지연 현황" })).toBeVisible();
    await assertMenu(page, "/emission/deadline-status");
    await assertHeaderFrameAlignment(page);
    await page.screenshot({ path: testInfo.outputPath("fixture-deadline-desktop.png"), fullPage: true });
  });

  test("배출량 프로젝트: 목록 빈 상태에서도 메뉴·상세 레이아웃 유지", async ({ page }, testInfo: TestInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openRoute(page, "/emission/project_list");
    await collapseWorkflowGuide(page);
    await expect(page.getByRole("heading", { name: "배출량 프로젝트" })).toBeVisible();
    await expect(page.getByText("등록된 프로젝트가 없습니다.")).toBeVisible();
    await assertMenu(page, "/emission/project_list");
    await assertHeaderFrameAlignment(page);
    await page.screenshot({ path: testInfo.outputPath("fixture-projects-desktop.png"), fullPage: true });
  });

  test("모바일: 메뉴 기본 접힘 후 펼치기 및 가로 넘침 없음", async ({ page }, testInfo: TestInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, "/emission/project_list");
    await expect(page.getByRole("heading", { name: "배출량 프로젝트" })).toBeVisible();
    const trigger = page.getByRole("button", { name: "업무 메뉴" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const nav = page.getByRole("complementary", { name: "탄소배출 업무 메뉴" });
    await expect(nav.getByRole("link", { name: /마감·지연 현황/ })).toBeVisible();
    await expect(nav.getByText("활동자료 관리", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "업무 메뉴 닫기" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath("fixture-projects-mobile.png"), fullPage: true });
  });
});
