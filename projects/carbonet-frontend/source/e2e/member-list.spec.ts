import { expect, test } from "@playwright/test";

const frontendSession = {
  authenticated: true,
  userId: "admin",
  authorCode: "ROLE_ADMIN",
  insttId: "SYSTEM",
  companyScope: "ALLOW_MASTER",
  csrfToken: "playwright-token",
  csrfHeaderName: "X-CSRF-TOKEN",
  featureCodes: ["ADMIN_A0010101_VIEW", "MEMBER_LIST_SEARCH", "MEMBER_DETAIL_LINK"],
  capabilityCodes: []
};

const adminMenuTree = {
  "회원관리": {
    label: "회원관리",
    labelEn: "Members",
    summary: "회원 관리 메뉴",
    groups: [
      {
        title: "회원관리",
        titleEn: "Members",
        icon: "group",
        links: [
          {
            text: "회원 목록 조회",
            tEn: "Member List",
            u: "/admin/member/list",
            icon: "list"
          }
        ]
      }
    ]
  }
};

const memberListPage = {
  canViewMemberList: true,
  canUseMemberListActions: true,
  totalCount: 1,
  pageIndex: 1,
  totalPages: 1,
  searchKeyword: "",
  membershipType: "",
  sbscrbSttus: "",
  member_list: [
    {
      entrprsmberId: "MEMBER-001",
      applcntNm: "홍길동",
      entrprsSeCode: "EMITTER",
      cmpnyNm: "테스트 기업",
      sbscrbDe: "2026-03-18",
      entrprsMberSttus: "P"
    }
  ]
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/frontend/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(frontendSession) });
  });
  await page.route("**/admin/system/menu-data", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminMenuTree) });
  });
  await page.route("**/admin/api/admin/member/list/page**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(memberListPage) });
  });
  await page.route("**/api/help/page**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pageId: "member-list", title: "", summary: "", items: [] })
    });
  });
  await page.route("**/api/telemetry/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
});

test("member list search controls render with aligned heights", async ({ page }) => {
  await page.goto("/assets/react/");
  await page.evaluate(() => {
    window.history.replaceState({}, "", "/admin/member/list");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  const memberType = page.locator("#member-type");
  const status = page.locator("#status");
  const keyword = page.locator("#keyword");
  const searchButton = page.getByRole("button", { name: "검색" });

  await expect(memberType).toBeVisible();
  await expect(status).toBeVisible();
  await expect(keyword).toBeVisible();
  await expect(searchButton).toBeVisible();

  const heights = await Promise.all([
    memberType.evaluate((element) => element.getBoundingClientRect().height),
    status.evaluate((element) => element.getBoundingClientRect().height),
    keyword.evaluate((element) => element.getBoundingClientRect().height)
  ]);

  expect(Math.abs(heights[0] - heights[1])).toBeLessThanOrEqual(1);
  expect(Math.abs(heights[1] - heights[2])).toBeLessThanOrEqual(1);

  await expect(memberType).toHaveClass(/h-12/);
  await expect(status).toHaveClass(/h-12/);
  await expect(keyword).toHaveClass(/h-12/);

  await page.screenshot({ path: "playwright-report/member-list-search.png", fullPage: false });
});
