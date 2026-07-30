import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const username = process.env.BACKSTAGE_E2E_USERNAME;
const password = process.env.BACKSTAGE_E2E_PASSWORD;
const evidenceDir = process.env.RESONANCE_E2E_EVIDENCE_DIR;
const designDocumentTitles = [
  '업무·요구사항',
  '액터·RACI',
  '권한·데이터 범위',
  '프로세스·분기',
  '상태 전이',
  '화면 흐름·라우팅',
  '액티브 UI·레이아웃',
  '테마·섹션·컴포넌트',
  '필드·데이터 사전',
  '입출력·데이터 연계',
  'DB·스키마',
  'API·이벤트',
  '업무 규칙·계산식',
  '검증·오류·예외',
  '알림·기한·에스컬레이션',
  '테스트 시나리오·기대값',
  '개발 태스크·산출물·증적',
  '배포·감사·복구',
] as const;

const routes = [
  ['/ccus-screen-designs', 'CCUS 플랫폼 1,000 화면 설계'],
  ['/ccus-screen-space', 'CCUS 가상 화면 공간 실행엔진'],
  ['/resonance-projects', 'Resonance 프로젝트 제어'],
  ['/resonance-control-assets', 'Resonance 운영·설계·개발 자산'],
  ['/actor-process-control', 'Actor·Process 프로젝트 제어'],
  ['/actor-process-design', 'Actor·Process 프로젝트 제어'],
  ['/actor-process-development', 'Actor·Process 프로젝트 제어'],
  ['/actor-process-operations', 'Actor·Process 프로젝트 제어'],
  ['/design-assets', '공통 디자인 자산 관리'],
  ['/identity-administration', 'Resonance 통합계정 관리'],
  ['/system-recovery', 'PC 외부 백업 전체 복원 검증'],
] as const;

async function signIn(page: Page) {
  if (!username || !password) {
    throw new Error(
      'BACKSTAGE_E2E_USERNAME and BACKSTAGE_E2E_PASSWORD are required',
    );
  }

  await page.goto('/');
  const sidebar = page.getByRole('navigation', { name: 'sidebar nav' });
  const signInButton = page
    .getByRole('button')
    .filter({ hasText: /Resonance|로그인|Sign in/i })
    .first();
  const readySurface = await Promise.all([
    sidebar
      .waitFor({ state: 'attached', timeout: 30_000 })
      .then(() => 'sidebar' as const)
      .catch(() => null),
    signInButton
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => 'sign-in' as const)
      .catch(() => null),
  ]);
  if (!readySurface.some(Boolean)) {
    throw new Error('Backstage did not expose a sidebar or sign-in action');
  }
  if (await sidebar.isVisible()) {
    return;
  }

  const popupPromise = page.waitForEvent('popup');
  await signInButton.click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('#username').fill(username);
  await popup.locator('#password').fill(password);
  await popup.locator('#kc-login').click();
  await popup.waitForEvent('close');

  await expect(
    page.getByRole('navigation', { name: 'sidebar nav' }),
  ).toBeAttached({ timeout: 30_000 });
}

test('authenticated Resonance control-plane routes render without runtime errors', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const runtimeErrors: string[] = [];

  page.on('pageerror', error =>
    runtimeErrors.push(`pageerror: ${error.message}`),
  );
  page.on('console', message => {
    if (message.type() === 'error') {
      runtimeErrors.push(
        `console: ${message.text()} (${message.location().url || 'unknown'})`,
      );
    }
  });
  page.on('response', response => {
    const request = response.request();
    const isIdentityAdminApi = response
      .url()
      .includes('/api/resonance-identity-admin/');
    if (
      (response.status() >= 500 ||
        (isIdentityAdminApi && response.status() >= 400)) &&
      ['document', 'fetch', 'xhr', 'script'].includes(request.resourceType())
    ) {
      runtimeErrors.push(
        `http ${response.status()}: ${request.method()} ${response.url()}`,
      );
    }
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText === 'net::ERR_ABORTED') {
      return;
    }
    if (
      ['document', 'fetch', 'xhr', 'script'].includes(request.resourceType())
    ) {
      runtimeErrors.push(
        `requestfailed: ${request.method()} ${request.url()} (${
          request.failure()?.errorText
        })`,
      );
    }
  });

  await signIn(page);
  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  for (const [route, expectedTitle] of routes) {
    const errorOffset = runtimeErrors.length;
    // Backstage keeps catalog/auth requests active in the background. Waiting
    // for global network idleness can hang after the page is already usable.
    const response = await page.goto(route, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    expect(response?.status(), `${route} document response`).toBe(200);
    await expect(
      page.getByText(expectedTitle, { exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator('body')).not.toContainText(
      /React app did not mount|Unexpected token '<'|페이지 처리 중 오류가 발생했습니다|Something went wrong/i,
    );
    expect(
      (await page.locator('body').innerText()).trim().length,
    ).toBeGreaterThan(200);

    if (evidenceDir) {
      await page.screenshot({
        path: path.join(
          evidenceDir,
          `${route.slice(1).replaceAll('/', '-')}.png`,
        ),
        fullPage: true,
      });
    }

    expect(
      runtimeErrors.slice(errorOffset),
      `${route} emitted runtime errors`,
    ).toEqual([]);
  }

  const controlRoute =
    '/actor-process-control?workspace=operate&tab=work-dashboard&projectId=CCUS-PLATFORM';
  // The route was already visited in the navigation sweep above. Backstage
  // keeps the mounted page and its dataset cache when only query parameters
  // change, so waiting for a second browser response can consume the entire
  // deployment timeout even though the screen is ready.
  const runtimeResponse = await page.request.get(
    '/api/resonance-projects/actor-process/runtime-dashboard?dataset=processes',
  );
  const taskResponse = await page.request.get(
    '/api/resonance-projects/actor-process/runtime-dashboard?dataset=emissionProjectTasks',
  );
  expect(runtimeResponse.status()).toBe(200);
  expect(taskResponse.status()).toBe(200);
  const taskPayload = await taskResponse.json();
  expect(taskPayload.emissionProjectTasks?.length).toBeGreaterThan(0);
  await page.goto(controlRoute, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await expect(page.getByText('프로세스 계약 지도')).toBeVisible();
  await expect(page.getByText('실제 프로젝트 실행 업무')).toBeVisible();
  await expect(page.getByText('고객 여정 시뮬레이션')).toBeVisible();
  await expect(
    page.getByText('액터·화면·데이터·테스트 실행 준비도'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /정상 업무/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /권한·직무분리/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /테넌트·프로젝트 격리/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /오류·예외/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /복구·재처리/ })).toBeVisible();

  await page.getByRole('button', { name: '설계 워크벤치 열기' }).click();
  const designDialog = page.getByRole('dialog');
  await expect(designDialog).toBeVisible();
  for (const title of designDocumentTitles) {
    await expect(
      designDialog
        .getByRole('button', { name: new RegExp(`^${title}`) })
        .first(),
    ).toBeVisible();
  }
  expect(designDocumentTitles).toHaveLength(18);
  await designDialog.getByRole('button', { name: '닫기' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(controlRoute, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await expect(page.getByText('고객 여정 시뮬레이션')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
    'mobile page must not create body-level horizontal overflow',
  ).toBe(true);
  await expect(page.getByRole('button', { name: /정상 업무/ })).toBeVisible();
  if (evidenceDir) {
    await page.screenshot({
      path: path.join(evidenceDir, 'actor-process-control-mobile.png'),
      fullPage: true,
    });
  }
});
