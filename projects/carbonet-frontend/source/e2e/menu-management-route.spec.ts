import { expect, test } from "@playwright/test";

const frontendSession = {
  authenticated: true,
  userId: "admin",
  authorCode: "ROLE_ADMIN",
  insttId: "SYSTEM",
  companyScope: "ALLOW_MASTER",
  csrfToken: "playwright-token",
  csrfHeaderName: "X-CSRF-TOKEN",
  featureCodes: ["MENU_MANAGEMENT_VIEW", "MENU_MANAGEMENT_CREATE", "MENU_MANAGEMENT_ORDER"],
  capabilityCodes: []
};

const adminMenuTree = {
  "시스템": {
    label: "시스템",
    labelEn: "System",
    summary: "시스템 관리 메뉴",
    groups: [
      {
        title: "환경",
        titleEn: "Environment",
        icon: "folder",
        links: [
          {
            text: "메뉴 관리",
            tEn: "Menu Management",
            u: "/admin/system/menu",
            icon: "account_tree"
          }
        ]
      }
    ]
  }
};

const menuManagementPage = {
  menuType: "ADMIN",
  menuRows: [
    { code: "A006", codeNm: "시스템", codeDc: "System", menuUrl: "#", menuIcon: "folder", useAt: "Y", sortOrdr: 1 },
    { code: "A00601", codeNm: "환경", codeDc: "Environment", menuUrl: "#", menuIcon: "folder_open", useAt: "Y", sortOrdr: 1 },
    { code: "A0060107", codeNm: "메뉴 관리", codeDc: "Menu Management", menuUrl: "/admin/system/menu", menuIcon: "account_tree", useAt: "Y", sortOrdr: 1 }
  ],
  menuTypes: [
    { value: "USER", label: "홈" },
    { value: "ADMIN", label: "관리자" }
  ],
  groupMenuOptions: [
    { value: "A00601", label: "A00601 · 환경" }
  ],
  iconOptions: ["account_tree", "folder", "web"],
  useAtOptions: ["Y", "N"],
  menuMgmtGuide: "새 페이지 메뉴는 여기서 먼저 등록합니다.",
  siteMapMgmtGuide: "사이트맵 노출은 별도 메뉴에서 운영합니다."
};

const contentMenuManagementPage = {
  menuType: "CONTENT",
  menuRows: [
    { code: "A004", codeNm: "콘텐츠", codeDc: "Content", menuUrl: "#", menuIcon: "folder", useAt: "Y", sortOrdr: 1 },
    { code: "A00401", codeNm: "기타 관리자", codeDc: "Other Administration", menuUrl: "#", menuIcon: "folder_open", useAt: "Y", sortOrdr: 1 },
    { code: "A0040105", codeNm: "메뉴 관리", codeDc: "Content Menu Management", menuUrl: "/admin/content/menu", menuIcon: "account_tree", useAt: "Y", sortOrdr: 2 }
  ],
  groupMenuOptions: [
    { value: "A00401", label: "A00401 · 기타 관리자" }
  ],
  iconOptions: ["account_tree", "article", "folder"],
  useAtOptions: ["Y", "N"]
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/frontend/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(frontendSession) });
  });
  await page.route("**/admin/system/menu-data", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminMenuTree) });
  });
  await page.route("**/admin/content/menu/page-data**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(contentMenuManagementPage) });
  });
  await page.route("**/admin/system/menu-management/page-data**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(menuManagementPage) });
  });
  await page.route("**/api/help/page**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pageId: "menu-management", title: "", summary: "", items: [] })
    });
  });
  await page.route("**/api/telemetry/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
});

test("system and content menu management use separate pages", async ({ page }) => {
  await page.goto("/assets/react/");

  await page.evaluate(() => {
    window.history.replaceState({}, "", "/admin/system/menu?menuType=ADMIN");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByRole("heading", { name: "메뉴 관리" })).toBeVisible();
  await expect(page.locator("body")).toContainText("시스템");
  await expect(page.locator("body")).toContainText("빠른 페이지 등록");
  await expect(page.locator("#menuUrl")).toHaveValue("");

  await page.evaluate(() => {
    window.history.replaceState({}, "", "/admin/content/menu?menuType=ADMIN");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByRole("heading", { name: "콘텐츠 메뉴 관리" })).toBeVisible();
  await expect(page.locator("body")).toContainText("A004");
  await expect(page.locator("#contentMenuUrl")).toHaveValue("");
});
