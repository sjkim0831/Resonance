import { expect, test, type Page } from "@playwright/test";

const adminSession = {
  authenticated: true,
  userId: "admin-e2e",
  authorCode: "ROLE_ADMIN",
  insttId: "SYSTEM",
  companyScope: "ALLOW_MASTER",
  csrfToken: "playwright-token",
  csrfHeaderName: "X-CSRF-TOKEN",
  featureCodes: ["ADMIN_A0010101_VIEW", "MEMBER_LIST_SEARCH", "MEMBER_DETAIL_LINK"],
  capabilityCodes: []
};

const restrictedSession = {
  ...adminSession,
  userId: "restricted-e2e",
  authorCode: "ROLE_AUDITOR",
  companyScope: "DENY",
  featureCodes: []
};

const adminMenuTree = {
  "회원관리": {
    label: "회원관리",
    labelEn: "Members",
    summary: "회원 관리 메뉴",
    groups: [{
      title: "회원관리",
      titleEn: "Members",
      icon: "group",
      links: [{ text: "회원 목록 조회", tEn: "Member List", u: "/admin/member/list", icon: "list" }]
    }]
  }
};

const memberListPage = {
  canViewMemberList: true,
  canUseMemberListActions: true,
  canManageAllCompanies: true,
  canManageOwnCompany: false,
  currentUserInsttId: "SYSTEM",
  totalCount: 1,
  pageIndex: 1,
  totalPages: 1,
  searchKeyword: "",
  membershipType: "",
  sbscrbSttus: "",
  member_list: [{
    entrprsmberId: "MEMBER-RECOVERY-001",
    applcntNm: "복구 검증 사용자",
    entrprsSeCode: "EMITTER",
    cmpnyNm: "복구 검증 기업",
    sbscrbDe: "2026-07-22",
    entrprsMberSttus: "P"
  }]
};

async function stubAdminShell(page: Page, session = adminSession) {
  await page.route("**/api/frontend/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });
  await page.route("**/admin/system/menu-data", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminMenuTree) });
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
}

async function openMemberList(page: Page) {
  await page.goto("/assets/react/");
  await page.evaluate(() => {
    window.history.replaceState({}, "", "/admin/member/list");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

test.describe("admin access and recovery states", () => {
  test("authorized administrator sees the member list", async ({ page }) => {
    await stubAdminShell(page);
    await page.route("**/admin/api/admin/member/list/page**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(memberListPage) });
    });

    await openMemberList(page);

    await expect(page.getByRole("heading", { name: "회원 목록 조회" })).toBeVisible();
    await expect(page.getByText("복구 검증 사용자")).toBeVisible();
    await expect(page.getByText("권한이 없습니다.")).toHaveCount(0);
  });

  test("restricted actor receives the governed permission-denied state", async ({ page }) => {
    await stubAdminShell(page, restrictedSession);
    await page.route("**/admin/api/admin/member/list/page**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...memberListPage, canViewMemberList: false, canUseMemberListActions: false, member_list: [] })
      });
    });

    await openMemberList(page);

    await expect(page.getByRole("heading", { name: "권한이 없습니다." })).toBeVisible();
    await expect(page.getByText("현재 계정으로는 이 회원 관리 화면을 조회할 수 없습니다.")).toBeVisible();
    await expect(page.getByRole("button", { name: "검색" })).toHaveCount(0);
  });

  test("server 403 is rendered as an explicit access failure", async ({ page }) => {
    await stubAdminShell(page, restrictedSession);
    await page.route("**/admin/api/admin/member/list/page**", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ status: "forbidden", message: "접근 권한이 없습니다." })
      });
    });

    await openMemberList(page);

    await expect(page.getByText("조회 중 오류: Failed to load member list page: 403")).toBeVisible();
    await expect(page.getByRole("button", { name: "검색" })).toHaveCount(0);
  });

  test("temporary API failure recovers on a scoped retry", async ({ page }) => {
    await stubAdminShell(page);
    let requestCount = 0;
    await page.route("**/admin/api/admin/member/list/page**", async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "temporary unavailable" })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(memberListPage)
      });
    });

    await openMemberList(page);
    await expect(page.getByText("조회 중 오류: Failed to load member list page: 503")).toBeVisible();

    await openMemberList(page);

    await expect(page.getByText("복구 검증 사용자")).toBeVisible();
    await expect(page.getByText(/조회 중 오류:/)).toHaveCount(0);
    expect(requestCount).toBe(2);
  });

  test("expired session alerts once, logs out, and returns to login", async ({ page }) => {
    await stubAdminShell(page);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("adminSessionExpireAt", String(Date.now() - 1_000));
    });
    await page.route("**/admin/login/actionLogout", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success" }) });
    });
    await page.route("**/admin/api/admin/member/list/page**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(memberListPage) });
    });

    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await openMemberList(page);

    await expect(page).toHaveURL(/\/admin\/login\/loginView$/, { timeout: 5_000 });
    expect(dialogs).toEqual(["세션이 만료되어 로그아웃됩니다."]);
  });
});
