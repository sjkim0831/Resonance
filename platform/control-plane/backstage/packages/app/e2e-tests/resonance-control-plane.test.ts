import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const username = process.env.BACKSTAGE_E2E_USERNAME;
const password = process.env.BACKSTAGE_E2E_PASSWORD;
const evidenceDir = process.env.RESONANCE_E2E_EVIDENCE_DIR;
const e2eScope = process.env.RESONANCE_BACKSTAGE_E2E_SCOPE ?? 'full';
const requestedRoutes = (process.env.RESONANCE_BACKSTAGE_E2E_ROUTES ?? '')
  .split(',')
  .map(route => route.trim())
  .filter(Boolean);
const storageStatePath = process.env.BACKSTAGE_E2E_STORAGE_STATE;
// Visual-only changes must exercise the deployed runtime without rebuilding it.
const designDocumentTitles = [
  '업무·요구사항',
  '액터·RACI',
  '권한·데이터 범위',
  '프로세스·분기',
  '상태 전이',
  '화면 흐름·라우트',
  '액티브 UI·레이아웃',
  '테마·섹션·컴포넌트',
  '필드·데이터 사전',
  '입출력·데이터 인계',
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
  ['/system-operations', '시스템 운영 관제'],
  ['/system-development', '개발 자산 제어'],
  ['/system-security', '보안·권한 관제'],
  ['/migration-cutover', 'Resonance → Backstage 이관 원장'],
  ['/system-recovery', 'PC 외부 백업 전체 복원 검증'],
] as const;
const selectedRoutes =
  requestedRoutes.length > 0
    ? routes.filter(([route]) => requestedRoutes.includes(route))
    : e2eScope === 'recovery'
    ? routes.filter(([route]) => route === '/system-recovery')
    : routes;
const targetedRouteMode = requestedRoutes.length > 0 || e2eScope === 'recovery';
const actorRouteSelected = selectedRoutes.some(([route]) =>
  route.startsWith('/actor-process-'),
);

async function signIn(page: Page) {
  if (!username || !password) {
    throw new Error(
      'BACKSTAGE_E2E_USERNAME and BACKSTAGE_E2E_PASSWORD are required',
    );
  }

  const sidebar = page.getByRole('navigation', { name: 'sidebar nav' });
  const signInButton = page
    .getByRole('button')
    .filter({ hasText: /Resonance|로그인|Sign in/i })
    .first();
  let readySurface: 'sidebar' | 'sign-in' | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await page.goto('/', {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    if (!response || response.status() >= 500) {
      await page.waitForTimeout(attempt * 1_000);
      continue;
    }
    readySurface = await Promise.race([
      sidebar
        .waitFor({ state: 'attached', timeout: 20_000 })
        .then(() => 'sidebar' as const),
      signInButton
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'sign-in' as const),
    ]).catch(() => null);
    if (readySurface) break;
    await page.waitForTimeout(attempt * 1_000);
  }
  if (!readySurface) {
    throw new Error(
      'Backstage did not expose a sidebar or sign-in action after 3 readiness attempts',
    );
  }
  if (readySurface === 'sidebar') {
    return;
  }

  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 20_000 }),
    signInButton.click({ timeout: 20_000 }),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('#username').fill(username);
  await popup.locator('#password').fill(password);
  await popup.locator('#kc-login').click();
  await popup.waitForEvent('close');

  await expect(
    page.getByRole('navigation', { name: 'sidebar nav' }),
  ).toBeAttached({ timeout: 30_000 });
}

async function verifyRoute(
  page: Page,
  [route, expectedTitle]: (typeof routes)[number],
) {
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

  if (route === '/system-recovery') {
    await expect(page.getByText('외부 백업 전체 복원 검증')).toBeVisible();
    await expect(page.getByText('복구 관리자 작업')).toBeVisible();
    await expect(page.getByText(/carbonet_\d{8}_\d{6}\.dump/)).toBeVisible();
    await expect(
      page.getByText(/등록된 복구 작업이 없습니다.|조치 필요|해결/).first(),
    ).toBeVisible();
    await expect(page.getByText('정상', { exact: true }).first()).toBeVisible();
  }

  if (route === '/system-operations') {
    await expect(page.getByText('자동 배포 복구 현황')).toBeVisible();
    await expect(
      page.getByText(/^자동 배포 (RUNNING|SUCCESS|FAILED|UNKNOWN)$/),
    ).toBeVisible();
    await expect(page.getByText('NONE', { exact: true })).toBeVisible();
  }

  if (route === '/actor-process-operations') {
    await page.getByText('계정·액터 배정', { exact: true }).first().click();
    await expect(page.getByText('계정별 업무 액터·데이터 범위')).toBeVisible();
    await expect(page.getByText('유효 배정', { exact: true })).toBeVisible();
    await expect(
      page.getByText('프로젝트 범위', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('배정 저장', { exact: true })).toBeVisible();
    await page.getByText('완료·개발 현황', { exact: true }).first().click();
    await expect(page.getByText('프로세스별 완료 판정')).toBeVisible();
    await expect(page.getByText('최근 자동 완료 실행')).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: '필수 작업' }),
    ).toBeVisible();
  }

  if (route === '/actor-process-design') {
    await expect(page.getByText('액터 사전', { exact: true })).toBeVisible();
    await expect(page.getByText('액터 책임·권한 설계')).toBeVisible();
    await expect(page.getByLabel('액터 코드')).toBeVisible();
    await expect(page.getByLabel('수행 책임(Responsibility)')).toBeVisible();
    await expect(page.getByLabel('최종 책무(Accountability)')).toBeVisible();
  }

  if (evidenceDir) {
    await page.screenshot({
      path: path.join(
        evidenceDir,
        `${route.slice(1).replaceAll('/', '-')}.png`,
      ),
      fullPage: true,
    });
  }
  expect(runtimeErrors, `${route} emitted runtime errors`).toEqual([]);
}

async function persistStorageState(page: Page) {
  if (!storageStatePath) return;
  fs.mkdirSync(path.dirname(storageStatePath), {
    recursive: true,
    mode: 0o700,
  });
  await page.context().storageState({ path: storageStatePath });
  fs.chmodSync(storageStatePath, 0o600);
}

test('authenticated Resonance control-plane routes render without runtime errors', async ({
  page,
}) => {
  test.setTimeout(120_000);
  if (
    requestedRoutes.length > 0 &&
    selectedRoutes.length !== new Set(requestedRoutes).size
  ) {
    throw new Error(
      `Unknown Backstage E2E route requested: ${requestedRoutes
        .filter(route => !routes.some(([knownRoute]) => knownRoute === route))
        .join(',')}`,
    );
  }
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
  // Backstage performs an optional OIDC refresh before the first interactive
  // login. Its expected 401 is not an authenticated application runtime error.
  runtimeErrors.length = 0;
  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Route rendering and the independent actor-role contract gate run in
  // parallel at deployment level; keep browser fan-out bounded and repeatable.
  // Full regression has no concurrent deployment workload, so it can use
  // sixteen pages. Impact-scoped deploy gates stay at four to protect rollout
  // and role-contract checks that run beside the browser test.
  const routeConcurrency = targetedRouteMode ? 4 : 16;
  for (
    let offset = 0;
    offset < selectedRoutes.length;
    offset += routeConcurrency
  ) {
    await Promise.all(
      selectedRoutes
        .slice(offset, offset + routeConcurrency)
        .map(async routeSpec => {
          const routePage = await page.context().newPage();
          try {
            await verifyRoute(routePage, routeSpec);
          } finally {
            await routePage.close();
          }
        }),
    );
  }

  if (targetedRouteMode && !actorRouteSelected) {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [route, expectedTitle] of selectedRoutes) {
      await page.goto(route, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      await expect(
        page.getByText(expectedTitle, { exact: true }).first(),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
        `${route} mobile page must not create body-level horizontal overflow`,
      ).toBe(true);
      if (evidenceDir) {
        await page.screenshot({
          path: path.join(
            evidenceDir,
            `${route.slice(1).replaceAll('/', '-')}-mobile.png`,
          ),
          fullPage: true,
        });
      }
    }
    expect(runtimeErrors, 'targeted route emitted runtime errors').toEqual([]);
    await persistStorageState(page);
    return;
  }

  const controlRoute =
    '/actor-process-control?workspace=operate&tab=work-dashboard&projectId=CCUS-PLATFORM';
  // The route was already visited in the navigation sweep above. Backstage
  // keeps the mounted page and its authenticated fetchApi dataset cache when
  // only query parameters change, so the rendered work contract is the stable
  // readiness signal. APIRequestContext does not carry Backstage's OAuth token.
  await page.goto(controlRoute, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await expect(page.getByText('프로세스 계약 지도')).toBeVisible();
  // Assert the stable workflow-guide contract rather than a retired section
  // caption; selected process and step titles are intentionally data-driven.
  await expect(page.getByText('3. 실시간 업무 길잡이')).toBeVisible();
  await expect(page.getByText('설계 → 개발 자동 실행')).toBeVisible();
  await expect(page.getByText('자동 개발 실행 타임라인')).toBeVisible();
  await expect(
    page.getByText(
      '생성·테스트·배포 게이트의 현재 상태와 증적을 실시간 데이터로 표시합니다.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /자동 개발 시작/ }),
  ).toBeVisible();
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
  await page.goto('/system-recovery', {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await expect(page.getByText('복구 관리자 작업')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
    'mobile recovery page must not create body-level horizontal overflow',
  ).toBe(true);
  expect(runtimeErrors, 'interactive route emitted runtime errors').toEqual([]);
  await persistStorageState(page);
  if (evidenceDir) {
    await page.screenshot({
      path: path.join(evidenceDir, 'actor-process-control-mobile.png'),
      fullPage: true,
    });
  }
});
