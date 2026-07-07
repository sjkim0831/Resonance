import { expect, test } from "@playwright/test";

const frontendSession = {
  authenticated: true,
  userId: "admin",
  authorCode: "ROLE_ADMIN",
  insttId: "SYSTEM",
  companyScope: "ALLOW_MASTER",
  csrfToken: "playwright-token",
  csrfHeaderName: "X-CSRF-TOKEN",
  featureCodes: ["ADMIN_A0020101_VIEW", "EMISSION_HISTORY_VIEW", "EMISSION_RESULT_DETAIL_LINK"],
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
            text: "데이터 변경 이력",
            textEn: "Data Change History",
            u: "/admin/emission/data_history",
            icon: "history"
          }
        ]
      }
    ]
  }
};

const historyPayload = {
  totalCount: 1,
  pageIndex: 1,
  pageSize: 10,
  totalPages: 1,
  searchKeyword: "ER-2026-001",
  changeType: "CORRECTION",
  changeTarget: "ACTIVITY_DATA",
  summaryCards: [
    {
      title: "오늘 변경",
      value: "1건",
      description: "실시간 추적 대상"
    }
  ],
  changeTypeOptions: [
    { value: "", label: "전체" },
    { value: "CORRECTION", label: "정정" }
  ],
  changeTargetOptions: [
    { value: "", label: "전체" },
    { value: "ACTIVITY_DATA", label: "활동자료" }
  ],
  changeTypeMeta: {
    CORRECTION: {
      label: "정정",
      badgeClass: "bg-amber-100 text-amber-700"
    }
  },
  changeTargetMeta: {
    ACTIVITY_DATA: {
      label: "활동자료",
      badgeClass: "bg-slate-100 text-slate-700"
    }
  },
  historyRows: [
    {
      historyId: "HIS-2026-001",
      changedAt: "2026-03-30 10:10",
      projectName: "동해 CCUS 실증",
      siteName: "포집시설 A-01",
      changedBy: "qa.operator",
      changeTypeCode: "CORRECTION",
      changeTypeLabel: "정정",
      changeTargetCode: "ACTIVITY_DATA",
      changeTargetLabel: "활동자료",
      beforeValue: "1230",
      afterValue: "1240",
      detailUrl: "/admin/emission/result_detail?resultId=ER-2026-001"
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
  await page.route("**/admin/emission/data_history/page-data**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(historyPayload) });
  });
  await page.route("**/api/help/page**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pageId: "emission-data-history", title: "", summary: "", items: [] })
    });
  });
  await page.route("**/api/telemetry/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
});

test("emission data history preserves returnUrl in breadcrumb and trace links", async ({ page }) => {
  await page.goto("/assets/react/");
  await page.evaluate(() => {
    window.history.replaceState(
      {},
      "",
      "/admin/emission/data_history?searchKeyword=ER-2026-001&changeType=CORRECTION&changeTarget=ACTIVITY_DATA&returnUrl=%2Fadmin%2Femission%2Fresult_list%3FsearchKeyword%3D%25EB%258F%2599%25ED%2595%25B4%26resultStatus%3DREVIEW%26verificationStatus%3DPENDING"
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByRole("heading", { name: "데이터 변경 이력" })).toBeVisible();
  await expect(page.getByRole("link", { name: "산정 결과 상세", exact: true })).toHaveAttribute(
    "href",
    "/admin/emission/result_list?searchKeyword=%EB%8F%99%ED%95%B4&resultStatus=REVIEW&verificationStatus=PENDING"
  );
  await expect(page.locator("#searchKeyword")).toHaveValue("ER-2026-001");
  await expect(page.locator("#changeType")).toHaveValue("CORRECTION");
  await expect(page.locator("#changeTarget")).toHaveValue("ACTIVITY_DATA");
  await expect(page.getByRole("link", { name: "열기" })).toHaveAttribute(
    "href",
    /\/admin\/emission\/result_detail\?resultId=ER-2026-001&returnUrl=%2Fadmin%2Femission%2Fresult_list%3FsearchKeyword%3D%25EB%258F%2599%25ED%2595%25B4%26resultStatus%3DREVIEW%26verificationStatus%3DPENDING/
  );
});
