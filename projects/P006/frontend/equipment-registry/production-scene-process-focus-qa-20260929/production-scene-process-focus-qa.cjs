const { chromium } = require('C:/Users/jwchoo/Documents/Codex/2026-07-11/new-chat/carbon-workflow-deploy/projects/carbonet-frontend/source/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

(async () => {
  const out = __dirname;
  const workpieceRoute = JSON.parse(execFileSync(process.execPath, [path.join(out, 'production-scene-workpiece-route-qa.cjs')], { encoding: 'utf8' }));
  const browser = await chromium.launch({
    executablePath: 'C:/Users/jwchoo/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const started = Date.now();
  try {
    const res = await page.goto('http://172.16.1.232/projects/P006/assets/equipment-registry/production-scene.html?rev=20260929-process-focus-3', { waitUntil: 'networkidle', timeout: 45000 });
    if (res.status() !== 200) throw new Error('페이지 HTTP ' + res.status());
    await page.getByRole('button', { name: '자동차 가상 예시' }).click();
    await page.waitForFunction(() => document.querySelectorAll('#focus-cards .focus-card').length > 0, null, { timeout: 15000 });
    await page.waitForFunction(() => {
      const m = document.getElementById('counts')?.textContent.match(/설비 GLB (\d+)\/(\d+)/);
      return m && Number(m[2]) > 0 && Number(m[1]) === Number(m[2]);
    }, null, { timeout: 45000 });
    const t0 = await page.locator('#focus-cards').innerText();
    if (!t0.includes('차체 패널 성형') || !t0.includes('차체·도어 패널 세트')) throw new Error('초기 동시 공정의 설비·제품 식별 누락: ' + t0);
    await page.screenshot({ path: path.join(out, 'production-scene-focus-running.png'), fullPage: true });
    await page.getByRole('button', { name: '작업 셀 확대' }).first().click();
    if (!(await page.locator('#crumb').innerText()).includes('차체 패널 성형')) throw new Error('작업 셀 확대 후 현재 공정 표시 실패');
    await page.locator('#time').evaluate(el => { el.value = '12'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.screenshot({ path: path.join(out, 'production-scene-focus-cell.png'), fullPage: true });
    await page.locator('#overview').click();
    await page.locator('#time').evaluate(el => { el.value = '26'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => document.getElementById('focus-cards')?.innerText.includes('차체 접합'), null, { timeout: 15000 });
    const t26 = await page.locator('#focus-cards').innerText();
    if (!t26.includes('차체 접합')) throw new Error('시간 이동 후 설비 상태 전환 실패: ' + t26);
    await page.locator('.focus-card').filter({ hasText: '차체 접합' }).getByRole('button', { name: '작업 셀 확대' }).click();
    await page.screenshot({ path: path.join(out, 'production-scene-focus-weld.png'), fullPage: true });
    await page.locator('#time').evaluate(el => { el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.selectOption('#speed', '10');
    await page.locator('#play').click();
    await page.waitForFunction(() => Number.parseFloat(document.getElementById('clock')?.textContent || '0') > 0, null, { timeout: 15000 });
    const playbackClock = await page.locator('#clock').innerText();
    await page.locator('#pause').click();
    await page.locator('#time').evaluate(el => { el.value = el.max; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => document.getElementById('state')?.textContent === '완료', null, { timeout: 15000 });
    const finalCards = await page.locator('#focus-cards').innerText();
    if (!finalCards.includes('완제품 기능 검사')) throw new Error('종료 시 검사 공정 식별 실패: ' + finalCards);
    await page.screenshot({ path: path.join(out, 'production-scene-focus-complete.png'), fullPage: true });
    const counts = await page.locator('#counts').innerText();
    if (errors.length) throw new Error('브라우저 오류: ' + errors.join(' | '));
    const result = {
      result: 'PASS',
      elapsedSeconds: Math.round((Date.now() - started) / 100) / 10,
      routeHttp: res.status(),
      initialCards: t0,
      time26Cards: t26,
      workpieceRoute,
      playbackClock,
      finalCards,
      counts,
      pageErrors: errors,
      screenshots: ['production-scene-focus-running.png', 'production-scene-focus-cell.png', 'production-scene-focus-weld.png', 'production-scene-focus-complete.png']
    };
    fs.writeFileSync(path.join(out, 'production-scene-process-focus-qa.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
