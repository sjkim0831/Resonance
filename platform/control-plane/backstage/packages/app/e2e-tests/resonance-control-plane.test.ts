import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const username = process.env.BACKSTAGE_E2E_USERNAME;
const password = process.env.BACKSTAGE_E2E_PASSWORD;
const evidenceDir = process.env.RESONANCE_E2E_EVIDENCE_DIR;

const routes = [
  ['/ccus-screen-designs', 'CCUS 플랫폼 1,000 화면 설계'],
  ['/ccus-screen-space', 'CCUS 가상 화면 공간 실행엔진'],
  ['/resonance-projects', 'Resonance 프로젝트 제어'],
  ['/resonance-control-assets', 'Resonance 운영·설계·개발 자산'],
  ['/actor-process-control', 'Actor·Process 프로젝트 제어'],
  ['/design-assets', '공통 디자인 자산 관리'],
  ['/identity-administration', 'Resonance 통합계정 관리'],
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
  await Promise.race([
    sidebar.waitFor({ state: 'attached', timeout: 60_000 }),
    signInButton.waitFor({ state: 'visible', timeout: 60_000 }),
  ]);
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
    const response = await page.goto(route, { waitUntil: 'networkidle' });
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
});
