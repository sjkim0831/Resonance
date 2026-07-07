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

const detailPayload = {
  found: true,
  resultId: "ER-2026-001",
  projectName: "동해 CCUS 실증",
  companyName: "탄소중립 실증센터",
  calculatedAt: "2026-03-30 09:00",
  submittedAt: "2026-03-30 09:30",
  reportPeriod: "2026 Q1",
  formulaVersion: "v3.4",
  verificationOwner: "qa.operator",
  totalEmission: "124.8 tCO2eq",
  resultStatusCode: "REVIEW",
  resultStatusLabel: "검토 중",
  verificationStatusCode: "PENDING",
  verificationStatusLabel: "검증 대기",
  reviewMessage: "증빙 첨부와 산정식 버전을 함께 확인합니다.",
  reviewChecklist: [
    { title: "배출계수 버전", detail: "v3.4 기준으로 산정되었는지 확인" }
  ],
  siteRows: [
    {
      siteName: "포집시설 A-01",
      scopeLabel: "Scope 1",
      activityLabel: "포집량 1,240t",
      emissionValue: "67.4 tCO2eq",
      statusLabel: "검토 대기"
    }
  ],
  evidenceRows: [
    {
      fileName: "capture-evidence.pdf",
      categoryLabel: "운영 증빙",
      updatedAt: "2026-03-30 08:55",
      owner: "field.manager"
    }
  ],
  historyRows: [
    {
      actionAt: "2026-03-30 09:40",
      actor: "qa.operator",
      actionLabel: "검토 요청",
      note: "배출계수 갱신 여부 확인 필요"
    }
  ],
  siteCount: 1,
  evidenceCount: 1,
  verificationActionUrl: "/admin/emission/validate?resultId=ER-2026-001",
  listUrl: "/admin/emission/result_list",
  historyUrl: "/admin/emission/data_history?searchKeyword=ER-2026-001"
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/frontend/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(frontendSession) });
  });
  await page.route("**/admin/system/menu-data", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(adminMenuTree) });
  });
  await page.route("**/admin/emission/result_detail/page-data**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(detailPayload) });
  });
  await page.route("**/api/help/page**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pageId: "emission-result-detail", title: "", summary: "", items: [] })
    });
  });
  await page.route("**/api/telemetry/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
});

test("emission result detail preserves returnUrl across breadcrumb and action links", async ({ page }) => {
  await page.goto("/assets/react/");
  await page.evaluate(() => {
    window.history.replaceState(
      {},
      "",
      "/admin/emission/result_detail?resultId=ER-2026-001&returnUrl=%2Fadmin%2Femission%2Fresult_list%3FsearchKeyword%3D%25EB%258F%2599%25ED%2595%25B4%26resultStatus%3DREVIEW%26verificationStatus%3DPENDING"
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByRole("heading", { name: "산정 결과 상세" })).toBeVisible();
  await expect(page.getByText("동해 CCUS 실증")).toBeVisible();

  await expect(page.getByRole("link", { name: "산정 결과 목록", exact: true })).toHaveAttribute(
    "href",
    "/admin/emission/result_list?searchKeyword=%EB%8F%99%ED%95%B4&resultStatus=REVIEW&verificationStatus=PENDING"
  );
  await expect(page.getByRole("link", { name: "목록으로" })).toHaveAttribute(
    "href",
    "/admin/emission/result_list?searchKeyword=%EB%8F%99%ED%95%B4&resultStatus=REVIEW&verificationStatus=PENDING"
  );
  await expect(page.getByRole("link", { name: "검증 화면 이동" })).toHaveAttribute(
    "href",
    /\/admin\/emission\/validate\?resultId=ER-2026-001&returnUrl=%2Fadmin%2Femission%2Fresult_list%3FsearchKeyword%3D%25EB%258F%2599%25ED%2595%25B4%26resultStatus%3DREVIEW%26verificationStatus%3DPENDING/
  );
  await expect(page.getByRole("link", { name: "이력 보기" })).toHaveAttribute(
    "href",
    /\/admin\/emission\/data_history\?searchKeyword=ER-2026-001&returnUrl=%2Fadmin%2Femission%2Fresult_list%3FsearchKeyword%3D%25EB%258F%2599%25ED%2595%25B4%26resultStatus%3DREVIEW%26verificationStatus%3DPENDING/
  );
});
