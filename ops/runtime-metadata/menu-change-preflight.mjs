import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only gate. Never mistakes a plan, SPA HTTP 200, or anonymous request for deployment.
export function assess(plan, session, menuStatus, menu, routes, legacy) {
  const blockers = [];
  if (!session.authenticated) blockers.push('AUTOMATION_SESSION_NOT_AUTHENTICATED');
  if (menuStatus !== 200) blockers.push(`MENU_ADMIN_HTTP_${menuStatus}`);
  const items = [];
  const walk = nodes => { for (const n of nodes || []) { items.push(n); walk(n.sections); walk(n.items); } };
  walk(menu.homeMenu);
  const changes = plan.changes.map(change => {
    const codes = change.menus || (change.menu ? [change.menu] : []);
    const evidence = codes.map(code => {
      const row = items.find(n => n.code === code);
      if (!row) return { code, status: 'MENU_NOT_FOUND' };
      const url = new URL(row.url || '/', 'http://local');
      const routeExists = routes.includes(`koPath: "${url.pathname}"`);
      const dispatchExists = url.pathname !== '/emission/lca' || ['H1030101', 'H1030102'].includes(code) || legacy.includes(`menuCode === "${code}"`);
      return { code, label: row.label, url: row.url, status: !routeExists ? 'ROUTE_NOT_REGISTERED' : !dispatchExists ? 'LEGACY_MENU_HAS_NO_DEDICATED_DISPATCH' : 'SOURCE_ROUTE_FOUND_NOT_E2E_VERIFIED' };
    });
    return { ...change, evidence };
  });
  if (changes.some(c => c.publish === false)) blockers.push('PLAN_CONTAINS_UNIMPLEMENTED_OR_CONDITIONAL_CHANGES');
  if (changes.some(c => c.evidence.some(e => !e.status.startsWith('SOURCE_ROUTE')))) blockers.push('MENU_ROUTE_CONTRACT_INCOMPLETE');
  if (!plan.operations?.length) blockers.push('NO_EXECUTABLE_MENU_OPERATIONS');
  return { status: blockers.length ? 'BLOCKED_NOT_APPLIED' : 'PREFLIGHT_ONLY_NOT_APPLIED', runtimeChanged: false, blockers, changes };
}

export async function run(args) {
  const [root, planPath, base = 'http://127.0.0.1:5175'] = args;
  if (!root || !planPath) throw new Error('Usage: node menu-change-preflight.mjs ROOT PLAN [BASE_URL]');
  const headers = { Accept: 'application/json' };
  // Explicit operator-provided cookie only; never read browser stores or print secrets.
  if (process.env.MENU_ADMIN_COOKIE) headers.Cookie = process.env.MENU_ADMIN_COOKIE;
  async function get(path) {
    const r = await fetch(new URL(path, base), { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    const type = r.headers.get('content-type') || '';
    return { status: r.status, body: type.includes('json') ? await r.json() : {} };
  }
  const started = Date.now();
  const source = resolve(root, 'projects/carbonet-frontend/source/src');
  const [plan, session, admin, home, routes, legacy] = await Promise.all([
    readFile(planPath, 'utf8').then(JSON.parse), get('/api/frontend/session'),
    get('/admin/system/menu/page-data?menuType=USER'), get('/api/home'),
    readFile(resolve(source, 'app/routes/families/emissionMonitoringFamily.ts'), 'utf8'),
    readFile(resolve(source, 'features/emission-lca/EmissionLcaMigrationPage.tsx'), 'utf8')
  ]);
  const result = assess(plan, session.body, admin.status, home.body, routes, legacy);
  if (home.status !== 200 || !Array.isArray(home.body.homeMenu)) result.blockers.push('HOME_MENU_RESPONSE_INVALID');
  result.status = result.blockers.length ? 'BLOCKED_NOT_APPLIED' : result.status;
  return { ...result, elapsedMs: Date.now() - started, authenticationScope: 'This tool session only; does not describe the users browser session.', menuSource: '/api/home -> server-managed menu', adminReadStatus: admin.status };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const result = await run(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.blockers.length ? 2 : 0; }
  catch (e) { console.error(JSON.stringify({status: 'PREFLIGHT_FAILED_NOT_APPLIED', error: e.message})); process.exitCode = 1; }
}
