import { expect, test } from "@playwright/test";

const frontendSession = {
  authenticated: true,
  userId: "admin",
  authorCode: "ROLE_ADMIN",
  insttId: "SYSTEM",
  companyScope: "ALLOW_MASTER",
  csrfToken: "playwright-token",
  csrfHeaderName: "X-CSRF-TOKEN",
  featureCodes: ["ADMIN_A0020101_VIEW", "EMISSION_RESULT_DETAIL_LINK", "EMISSION_RESULT_LIST_SEARCH"],
  capabilityCodes: []
};

const adminMenuTree = {
  "배출/인증": {
    label: "배출/인증",
    labelEn: "Emissions & Certification",
    summary: "배출/인증 관리자 메뉴",
    groups: [
      {
        title: "배출/인증",
        titleEn: "Emissions & Certification",
        icon: "co2",
        links: [
          {
            text: "산정 결과 목록",
            textEn: "Emission Result List",
            u: "/admin/emission/result_list",
            icon: "table_view"
          }
        ]
      }
    ]
  }
};

const basePagePayload = {
  totalCount: 2,
  reviewCount: 1,
  verifiedCount: 1,
  pageIndex: 1,
  pageSize: 10,
  totalPages: 1,
  searchKeyword: "동해",
  resultStatus: "REVIEW",
  verificationStatus: "PENDING",
  emissionResultList: [
    {
      resultId: "ER-2026-001",
      projectName: "동해 CCUS 실증",
      companyName: "탄소중립 실증센터",
      calculatedAt: "2026-03-30 09:00",
      totalEmission: "124.8 tCO2eq",
      resultStatusCode: "REVIEW",
      resultStatusLabel: "검토 중",
      verificationStatusCode: "PENDING",
      verificationStatusLabel: "검증 대기",
      detailUrl: "/admin/emission/result_detail?resultId=ER-2026-001"
    },
    {
      resultId: "ER-2026-002",
      projectName: "서해 저장소 검증",
      companyName: "국가 저장소 운영원",
      calculatedAt: "2026-03-29 16:20",
      totalEmission: "97.2 tCO2eq",
      resultStatusCode: "COMPLETED",
      resultStatusLabel: "산정 완료",
      verificationStatusCode: "VERIFIED",
      verificationStatusLabel: "검증 완료",
      detailUrl: "/admin/emission/result_detail?resultId=ER-2026-002"
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
  await page.route("**/admin/emission/result_list/page-data**", async (route) => {
    const url = new URL(route.request().url());
    const payload = {
      ...basePagePayload,
      searchKeyword: url.searchParams.get("searchKeyword") || "",
      resultStatus: url.searchParams.get("resultStatus") || "",
      verificationStatus: url.searchParams.get("verificationStatus") || ""
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  await page.route("**/api/help/page**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pageId: "emission-result-list", title: "", summary: "", items: [] })
    });
  });
  await page.route("**/api/telemetry/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
});

test("emission result list restores filters from the URL and preserves returnUrl on detail links", async ({ page }) => {
  await page.goto("/assets/react/");
  await page.evaluate(() => {
    window.history.replaceState({}, "", "/admin/emission/result_list?searchKeyword=%EB%8F%99%ED%95%B4&resultStatus=REVIEW&verificationStatus=PENDING");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByRole("heading", { name: "산정 결과 목록" })).toBeVisible();
  await expect(page.locator("#searchKeyword")).toHaveValue("동해");
  await expect(page.locator("#resultStatus")).toHaveValue("REVIEW");
  await expect(page.locator("#verificationStatus")).toHaveValue("PENDING");
  await expect(page.getByText("검토 큐가 적용된 상태입니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "검증 대기만 보기" })).toBeVisible();

  const detailLink = page.getByRole("link", { name: "상세" }).first();
  await expect(detailLink).toHaveAttribute(
    "href",
    /\/admin\/emission\/result_detail\?resultId=ER-2026-001&returnUrl=%2Fadmin%2Femission%2Fresult_list%3FsearchKeyword%3D%25EB%258F%2599%25ED%2595%25B4%26resultStatus%3DREVIEW%26verificationStatus%3DPENDING/
  );

  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(page.locator("#searchKeyword")).toHaveValue("");
  await expect(page.locator("#resultStatus")).toHaveValue("");
  await expect(page.locator("#verificationStatus")).toHaveValue("");
  await expect(page).toHaveURL(/\/admin\/emission\/result_list$/);
});
