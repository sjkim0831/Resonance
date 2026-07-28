import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const workspaces = readFileSync(
  resolve(
    root,
    'packages/app/src/plugins/ccus-screen-designs/actorProcessWorkspaces.ts',
  ),
  'utf8',
);
const page = readFileSync(
  resolve(
    root,
    'packages/app/src/plugins/ccus-screen-designs/ActorProcessControlPage.tsx',
  ),
  'utf8',
);
const plugin = readFileSync(
  resolve(root, 'packages/app/src/plugins/ccus-screen-designs/plugin.tsx'),
  'utf8',
);
const tabIds = [...workspaces.matchAll(/\btab\('([^']+)'/g)].map(
  match => match[1],
);
const failures = [];
if (tabIds.length !== 33) failures.push(`expected 33 tabs, got ${tabIds.length}`);
if (new Set(tabIds).size !== tabIds.length) failures.push('duplicate tab id');
for (const field of ['projectId', 'tenantId', 'designVersion', 'tab']) {
  if (!page.includes(field)) failures.push(`missing context field ${field}`);
}
if (!page.includes("fetch('/api/resonance-projects')")) {
  failures.push('dynamic project registry is not connected');
}
if (!plugin.includes("path: '/actor-process-control'")) {
  failures.push('Backstage actor-process route is missing');
}
if (failures.length) {
  console.error(JSON.stringify({ valid: false, failures }, null, 2));
  process.exit(1);
}
console.log(
  JSON.stringify({
    valid: true,
    workspaces: 4,
    tabs: tabIds.length,
    projectContextFields: 4,
  }),
);
