import { expect, test } from "@playwright/test";

const frontendSession = {
  authenticated: true,
  userId: "admin",
  authorCode: "ROLE_ADMIN",
  insttId: "SYSTEM",
  companyScope: "ALLOW_MASTER",
  csrfToken: "playwright-token",
  csrfHeaderName: "X-CSRF-TOKEN",
  featureCodes: ["ADMIN_A0020101_VIEW", "EMISSION_VALIDATE_VIEW", "EMISSION_RESULT_DETAIL_LINK"],
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
            text: "검증 관리",
            textEn: "Verification Management",
            u: "/admin/emission/validate",
            icon: "rule"
          }
        ]
      }
    ]
  }
};

const validatePayload = {
  totalCount: 1,
  pageIndex: 1,
  pageSize: 10,
  totalPages: 1,
  resultId: "ER-2026-001",
  searchKeyword: "동해",
  verificationStatus: "PENDING",
  priorityFilter: "HIGH",
  selectedResultFound: true,
  selectedResult: {
    resultId: "ER-2026-001",
    projectName: "동해 CCUS 실증",
    companyName: "탄소중립 실증센터",
    verificationStatusLabel: "검증 대기",
    priorityLabel: "높음"
  },
  summaryCards: [
    {
      title: "검증 대기",
      value: "1건",
      description: "즉시 검토 필요"
    }
  ],
  actionLinks: [
    {
      label: "산정 결과 상세",
      icon: "fact_check",
      url: "/admin/emission/result_detail?resultId=ER-2026-001"
    },
    {
      label: "데이터 변경 이력",
      icon: "history",
      url: "/admin/emission/data_history?searchKeyword=ER-2026-001"
    }
  ],
  queueRows: [
    {
      resultId: "ER-2026-001",
      projectName: "동해 CCUS 실증",
      calculatedAt: "2026-03-30 09:00",
      companyName: "탄소중립 실증센터",
      priorityCode: "HIGH",
      priorityLabel: "높음",
      totalEmission: "124.8 tCO2eq",
      verificationStatusCode: "PENDING",
      verificationStatusLabel: "검증 대기",
      assignee: "qa.operator",
      priorityReason: "배출계수 증빙 확인 필요",
      actionLabel: "상세",
      detailUrl: "/admin/emission/result_detail?resultId=ER-2026-001"
    }
  ],
  priorityLegend: [
    {
      code: "HIGH",
      label: "높음",
      description: "즉시 검토"
    }
  ],
  policyRows: [
    {
      title: "배출계수 버전 확인",
      detail: "최신 정책 버전 기준 검토"
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
  await page.route("**/admin/emission/validate/page-data**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(validatePayload) });
  });
  await page.route("**/api/help/page**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pageId: "emission-validate", title: "", summary: "", items: [] })
    });
  });
  await page.route("**/api/telemetry/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
});

test("emission validate preserves returnUrl in breadcrumb, quick links, and queue actions", async ({ page }) => {
  await page.goto("/assets/react/");
  await page.evaluate(() => {
    window.history.replaceState(
      {},
      "",
      "/admin/emission/validate?resultId=ER-2026-001&searchKeyword=%EB%8F%99%ED%95%B4&verificationStatus=PENDING&priorityFilter=HIGH&returnUrl=%2Fadmin%2Femission%2Fresult_list%3FsearchKeyword%3D%25EB%258F%2599%25ED%2595%25B4%26resultStatus%3DREVIEW%26verificationStatus%3DPENDING"
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByRole("heading", { name: "검증 관리" })).toBeVisible();
  await expect(page.getByRole("link", { name: "산정 결과 상세", exact: true })).toHaveAttribute(
    "href",
    "/admin/emission/result_list?searchKeyword=%EB%8F%99%ED%95%B4&resultStatus=REVIEW&verificationStatus=PENDING"
  );
  await expect(page.locator("#searchKeyword")).toHaveValue("동해");
  await expect(page.locator("#verificationStatus")).toHaveValue("PENDING");
  await expect(page.locator("#priorityFilter")).toHaveValue("HIGH");

  await expect(page.locator('[data-help-id="emission-validate-links"] a').first()).toHaveAttribute(
    "href",
    /\/admin\/emission\/result_detail\?resultId=ER-2026-001&returnUrl=%2Fadmin%2Femission%2Fresult_list%3FsearchKeyword%3D%25EB%258F%2599%25ED%2595%25B4%26resultStatus%3DREVIEW%26verificationStatus%3DPENDING/
  );
  await expect(page.getByRole("link", { name: "상세", exact: true })).toHaveAttribute(
    "href",
    /\/admin\/emission\/result_detail\?resultId=ER-2026-001&returnUrl=%2Fadmin%2Femission%2Fresult_list%3FsearchKeyword%3D%25EB%258F%2599%25ED%2595%25B4%26resultStatus%3DREVIEW%26verificationStatus%3DPENDING/
  );
});
