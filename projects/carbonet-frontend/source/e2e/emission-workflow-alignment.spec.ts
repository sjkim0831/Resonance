import { expect, test, type Page } from "@playwright/test";

const baseUrl = String(
  process.env.FULL_SCREEN_SMOKE_BASE_URL || "http://172.16.1.232",
).replace(/\/$/, "");
const projectId = process.env.EMISSION_WORKFLOW_E2E_PROJECT_ID || "PRJ-2025-018";

async function openEmissionProcedure(page: Page, procedureName: RegExp) {
  await page.goto(
    `${baseUrl}/emission/index?projectId=${encodeURIComponent(projectId)}`,
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.getByRole("button", { name: "전체 업무 보기" })).toBeVisible();
  await page.getByRole("button", { name: "전체 업무 보기" }).click();
  await page
    .getByRole("combobox", { name: "업무 종류" })
    .selectOption("EMISSION");
  await page
    .getByRole("combobox", { name: "업무 프로세스" })
    .selectOption("EMISSION_PROJECT");
  await page.getByRole("button", { name: procedureName }).click();
  await page
    .getByRole("button", { name: "선택 단계 업무 길잡이 시작" })
    .click();
}

test.describe("emission workflow guide and route alignment", () => {
  test("step 1 keeps guide and organizational-boundary route aligned", async ({
    page,
  }) => {
    await openEmissionProcedure(page, /프로젝트·조직경계 설정 필수/);

    await expect(page).toHaveURL(/\/emission\/organizational-boundary\?/);
    expect(new URL(page.url()).searchParams.get("processCode")).toBe(
      "EMISSION_PROJECT",
    );
    expect(new URL(page.url()).searchParams.get("stepCode")).toBe(
      "EMISSION_PROJECT_SETUP",
    );
    await expect(
      page
        .locator("aside")
        .filter({ hasText: "업무 길잡이" })
        .getByText("1. 프로젝트·조직경계 설정", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "조직경계 및 연결 산정" }),
    ).toBeVisible();
  });

  test("step 7 keeps guide and report-submit route aligned", async ({ page }) => {
    await openEmissionProcedure(page, /보고·제출·인증서 발급 필수/);

    await expect(page).toHaveURL(/\/emission\/report_submit\?/);
    expect(new URL(page.url()).searchParams.get("processCode")).toBe(
      "EMISSION_PROJECT",
    );
    expect(new URL(page.url()).searchParams.get("stepCode")).toBe(
      "EMISSION_PROJECT_REPORT",
    );
    await expect(
      page
        .locator("aside")
        .filter({ hasText: "업무 길잡이" })
        .getByText("7. 보고·제출·인증서 발급", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /보고서 제출|보고·제출/ }),
    ).toBeVisible();
  });
});
