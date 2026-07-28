import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(
  resolve(
    root,
    'packages/app/src/plugins/ccus-screen-designs/controlAssetRegistry.ts',
  ),
  'utf8',
);
const page = readFileSync(
  resolve(
    root,
    'packages/app/src/plugins/ccus-screen-designs/ResonanceControlAssetsPage.tsx',
  ),
  'utf8',
);
const plugin = readFileSync(
  resolve(root, 'packages/app/src/plugins/ccus-screen-designs/plugin.tsx'),
  'utf8',
);

const failures = [];
for (const capability of ['OPERATIONS', 'DESIGN', 'DEVELOPMENT']) {
  if (!source.includes(capability)) failures.push(`missing ${capability}`);
}
if (!source.includes('CCUS_SCREEN_DESIGN_CATALOG.records')) {
  failures.push('registry is not generated from the canonical screen catalog');
}
if (!page.includes('record.capabilities.includes(activeCapability)')) {
  failures.push('capability filter is not connected');
}
if (!page.includes('selected.sourceUrl')) {
  failures.push('source runtime link is not connected');
}
if (!plugin.includes("path: '/resonance-control-assets'")) {
  failures.push('Backstage page route is missing');
}
if (failures.length) {
  console.error(JSON.stringify({ valid: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ valid: true, capabilities: 3 }));
