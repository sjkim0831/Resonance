const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/jwchoo/Documents/Codex/2026-07-11/new-chat/carbon-workflow-deploy/projects/carbonet-frontend/source/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const base = 'http://172.16.1.232';
const apiRoot = `${base}/projects/P006/registry-api`;
const root = __dirname;
const reportPath = path.join(root, 'equipment-studio-browser-qa.json');
const screenshotPath = path.join(root, 'equipment-studio-browser-qa.png');
const startedAt = Date.now();
const report = {
  runDate: new Date().toISOString(),
  route: `${base}/projects/P006/assets/equipment-registry/equipment-studio.html`,
  tests: [],
  fixtureCustomerId: null,
  fixtureCustomerCode: null,
  fixtureEquipmentId: null,
  mocked: false,
  persistedTestRows: 0
};

function persist() {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

function check(name, pass, details = '') {
  report.tests.push({ name, pass: !!pass, ...(details ? { details } : {}) });
  persist();
  if (!pass) throw new Error(name);
}

function readToken() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed.token) throw new Error('QA session token missing');
        resolve(parsed.token);
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on('error', reject);
  });
}

(async () => {
  let browser;
  let context;
  let customerCreated = false;
  const token = await readToken();
  try {
    browser = await chromium.launch({
      executablePath: 'C:/Users/jwchoo/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
      headless: true
    });
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{
      name: 'P006_SESSION', value: token, domain: '172.16.1.232', path: '/', httpOnly: true, sameSite: 'Lax'
    }]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    const headers = {
      Origin: base,
      'X-P006-Requested-With': 'equipment-registry',
      'Content-Type': 'application/json'
    };
    async function api(pathname, method = 'GET', body) {
      const response = method === 'GET'
        ? await context.request.get(`${apiRoot}${pathname}`)
        : await context.request.fetch(`${apiRoot}${pathname}`, { method, headers, data: body });
      let data = {};
      try { data = await response.json(); } catch {}
      return { status: response.status(), data };
    }
    async function createHierarchy(entity, parentId, suffix) {
      const code = `QA_STUDIO_${suffix}`;
      const result = await api('/hierarchy', 'POST', {
        entity,
        ...(parentId ? { parentId } : {}),
        code,
        name: `Equipment Studio QA ${entity} ${suffix}`
      });
      if (result.status !== 200 || !result.data.id) throw new Error(`Hierarchy ${entity} API failed: ${result.status}`);
      return { id: result.data.id, code };
    }

    const suffix = `${Date.now()}`;
    const customer = await createHierarchy('customer', null, `C_${suffix}`);
    report.fixtureCustomerId = customer.id;
    report.fixtureCustomerCode = customer.code;
    customerCreated = true;
    persist();
    const plant = await createHierarchy('plant', customer.id, `P_${suffix}`);
    const line = await createHierarchy('line', plant.id, `L_${suffix}`);
    const process = await createHierarchy('process', line.id, `PROC_${suffix}`);
    check('QA_HIERARCHY_CREATED', !!process.id, '독립 QA 고객/부지/라인/공정');

    await page.goto(report.route);
    await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('조회 완료'), { timeout: 20000 });
    check('AUTHENTICATED_STUDIO_LOADED', true, '현재 화면에서 API 조회 완료');

    const code = `QAS${suffix}`;
    const form = page.locator('#equipmentForm');
    await form.locator('[name="processId"]').selectOption(process.id);
    await form.locator('[name="equipmentTypeCode"]').selectOption('melting_furnace');
    await form.locator('[name="code"]').fill(code);
    await form.locator('[name="name"]').fill(`QA 전용 설비 ${suffix}`);
    await form.locator('[name="purpose"]').fill('브라우저 CRUD 검증 전용 · 실제 장비 아님');
    await form.locator('[name="dimensionsMm"]').fill(JSON.stringify({ width: 1000, depth: 2000, height: 1500, unit: 'mm' }));
    await form.locator('[name="installation"]').fill(JSON.stringify({ unit: 'mm', coordinateSystem: 'Y_UP', position: [0, 0, 0] }));
    await form.locator('[name="workpiece"]').fill(JSON.stringify({ kind: 'QA synthetic only' }));
    await form.locator('[name="io"]').fill(JSON.stringify({ input: { position: [0, 0, 0], direction: [1, 0, 0] }, output: { position: [1000, 0, 0], direction: [1, 0, 0] } }));
    const createResponse = page.waitForResponse(response => response.url().endsWith('/registry-api/equipment') && response.request().method() === 'POST');
    await page.locator('#saveEquipment').click();
    const created = await createResponse;
    const createdBody = await created.json();
    report.fixtureEquipmentId = createdBody.id;
    persist();
    check('STUDIO_EQUIPMENT_CREATE', created.status() === 200 && !!createdBody.id, `HTTP ${created.status()}`);
    await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('설비 정보 저장 완료'));

    await page.locator('#sourceKind').selectOption('MANUAL');
    await page.locator('#sourceUri').fill(`/qa-only/equipment-studio/${suffix}/fixture-manual.pdf`);
    const evidenceResponse = page.waitForResponse(response => response.url().includes(`/equipment/${createdBody.id}/evidence`) && response.request().method() === 'POST');
    await page.locator('#addSources').click();
    const evidence = await evidenceResponse;
    check('STUDIO_EVIDENCE_REFERENCE_CREATE', evidence.status() === 200, `HTTP ${evidence.status()}`);
    await page.waitForFunction(() => document.querySelector('#evidenceCount')?.textContent.includes('자료 1개'));
    check('STUDIO_EVIDENCE_VISIBLE', (await page.locator('#evidenceList').innerText()).includes('MANUAL'));

    await page.locator('#sourceFiles').setInputFiles({
      name: `qa-fixture-manual-${suffix}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`Synthetic Equipment Studio QA only: ${suffix}. Not an actual equipment manual.`)
    });
    const uploadResponse = page.waitForResponse(response => response.url().includes(`/equipment/${createdBody.id}/evidence`) && response.request().method() === 'POST');
    await page.locator('#addSources').click();
    const upload = await uploadResponse;
    const uploadBody = await upload.json();
    check('STUDIO_EVIDENCE_BINARY_UPLOAD', upload.status() === 200 && uploadBody.status === 'UNREVIEWED', `HTTP ${upload.status()}`);
    await page.waitForFunction(() => document.querySelector('#evidenceCount')?.textContent.includes('자료 2개'));
    const uploadedState = await api(`/equipment/${createdBody.id}`);
    check('STUDIO_EVIDENCE_FILE_HASH', uploadedState.status === 200 && uploadedState.data.evidence.some(item => item.bytes > 0 && /^[0-9a-f]{64}$/.test(item.sha256 || '')));

    await form.locator('[name="managementNumber"]').fill(`QA-MGMT-${suffix}`);
    const updateResponse = page.waitForResponse(response => response.url().endsWith(`/registry-api/equipment/${createdBody.id}`) && response.request().method() === 'PATCH');
    await page.locator('#saveEquipment').click();
    const updated = await updateResponse;
    check('STUDIO_EQUIPMENT_UPDATE', updated.status() === 200, `HTTP ${updated.status()}`);
    const updatedBody = await updated.json();
    if (!updatedBody.match?.assetId || !['EXACT_MATCH', 'REFERENCE_MATCH'].includes(updatedBody.match.grade)) throw new Error(`QA fixture has no connectable catalog reference after update: ${JSON.stringify(updatedBody.match || null)}`);
    const bindResponse = await api(`/equipment/${createdBody.id}/bind`, 'POST', { assetId: updatedBody.match.assetId, acceptReference: true });
    check('STUDIO_ACCEPTED_REFERENCE_BIND', bindResponse.status === 200 && bindResponse.data.status === 'CONNECTED' && ['EXACT_MATCH', 'REFERENCE_MATCH'].includes(bindResponse.data.grade), `HTTP ${bindResponse.status} · ${JSON.stringify(bindResponse.data)}`);
    await page.waitForFunction(value => document.querySelector('#equipmentForm [name="managementNumber"]')?.value === value, `QA-MGMT-${suffix}`);

    await page.reload();
    await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('조회 완료'), { timeout: 20000 });
    const card = page.locator('#equipmentList [data-select]').filter({ hasText: code });
    await card.waitFor({ state: 'visible' });
    await card.click();
    await page.waitForFunction(value => document.querySelector('#equipmentForm [name="managementNumber"]')?.value === value, `QA-MGMT-${suffix}`);
    await page.waitForFunction(() => document.querySelector('#evidenceCount')?.textContent.includes('자료 2개'));
    check('STUDIO_RELOAD_RESTORE', true, '새로고침 후 관리번호와 경로/업로드 자료 2건 복원');
    await page.evaluate(assetId => localStorage.setItem('p006-product-plans-v1', JSON.stringify({ activeId: 'QA_PLAN', plans: [{ id: 'QA_PLAN', productName: 'QA 가상 조립 계획', revision: 1, processes: [{ id: 'QA_PROCESS', name: 'QA 조립 공정', kind: 'ASSEMBLY' }] }] })), updatedBody.match.assetId);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('조회 완료'), { timeout: 20000 });
    await page.locator('#equipmentList [data-select]').filter({ hasText: code }).click();
    await page.locator('#planTarget').selectOption('QA_PLAN::QA_PROCESS');
    await page.locator('#applyPlanLink').click();
    const linkedPlan = await page.evaluate(() => JSON.parse(localStorage.getItem('p006-product-plans-v1')));
    const linkedModel = linkedPlan.plans[0].processes[0].equipmentModel;
    check('PRODUCT_PLANNER_PROCESS_LINK', linkedModel?.assetId === updatedBody.match.assetId && linkedModel.glbPath && linkedModel.source.includes(createdBody.id), linkedModel ? `${linkedModel.assetId} · ${linkedModel.glbPath}` : 'missing equipmentModel');
    check('NO_BROWSER_JS_ERRORS', errors.length === 0, errors.join(' | '));
    await page.screenshot({ path: screenshotPath, fullPage: true });
    report.screenshot = path.basename(screenshotPath);
    persist();

    const persisted = await api(`/equipment/${createdBody.id}`);
    check('API_RELOAD_STATE', persisted.status === 200 && persisted.data.equipment.management_number === `QA-MGMT-${suffix}` && persisted.data.evidence.length === 2);
    report.persistedTestRows = 1;
    persist();
  } catch (error) {
    report.error = error.message;
    persist();
    process.exitCode = 1;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    report.elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));
    report.passed = report.tests.filter(test => test.pass).length;
    report.total = report.tests.length;
    report.cleanupRequired = customerCreated;
    persist();
    console.log(JSON.stringify({
      passed: report.passed,
      total: report.total,
      fixtureCustomerId: report.fixtureCustomerId,
      fixtureEquipmentId: report.fixtureEquipmentId,
      cleanupRequired: report.cleanupRequired,
      error: report.error || null
    }));
  }
})().catch(error => {
  report.error = error.message;
  persist();
  console.error(error.message);
  process.exitCode = 1;
});
