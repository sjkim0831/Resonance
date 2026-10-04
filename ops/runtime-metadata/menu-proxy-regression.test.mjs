import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const config = readFileSync(new URL('../../projects/carbonet-frontend/source/vite.config.ts', import.meta.url), 'utf8');
const patterns = [...config.matchAll(/"(\^\/[^"\n]+)":\s*\{/g)].map(m => new RegExp(JSON.parse('"' + m[1] + '"')));
for (const path of ['/admin/system/runtime-command/execute','/en/admin/system/runtime-command/execute','/admin/system/menu/order','/admin/system/menu/update-page','/en/admin/system/menu/update-dependent-screen']) {
  test(`backend proxy covers ${path}`, () => assert.ok(patterns.some(re => re.test(path))));
}
test('menu page stays a frontend route', () => assert.ok(!patterns.some(re => re.test('/admin/system/menu'))));
