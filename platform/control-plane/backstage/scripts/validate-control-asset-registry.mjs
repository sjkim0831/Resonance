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
const catalogSource = readFileSync(
  resolve(
    root,
    'packages/app/src/plugins/ccus-screen-designs/generatedCatalog.ts',
  ),
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
const marker =
  'export const CCUS_SCREEN_DESIGN_CATALOG: CcusScreenDesignCatalog = ';
const markerOffset = catalogSource.indexOf(marker);
if (markerOffset < 0) {
  failures.push('generated screen catalog payload is missing');
}
let metrics = {};
if (markerOffset >= 0) {
  const catalog = JSON.parse(
    catalogSource
      .slice(markerOffset + marker.length)
      .replace(/;\s*$/, ''),
  );
  const rules = {
    OPERATIONS:
      /(monitor|operation|ops|status|health|log|audit|backup|restore|batch|cron|schedule|alert|incident|security|access|block|external|integration|deploy|release|runtime|database|db-|maintenance|usage|retry)/i,
    DESIGN:
      /(design|theme|section|component|css|layout|screen|page|flow|actor|process|scenario|task|schema|column|contract|menu|builder)/i,
    DEVELOPMENT:
      /(develop|build|code|api|function|controller|module|generator|asset|git|deploy|release|version|package|provision|studio)/i,
  };
  const controlPrefixes = [
    '/admin/system/',
    '/admin/external/',
    '/admin/monitoring/',
  ];
  const routes = new Map();
  let candidates = 0;
  for (const record of catalog.records ?? []) {
    if (typeof record.routePath !== 'string' || !record.routePath.startsWith('/')) {
      failures.push(`invalid route: ${String(record.routePath)}`);
      continue;
    }
    const searchable = [
      record.routePath,
      record.screenName,
      ...(record.processCodes ?? []),
      ...(record.actorCodes ?? []),
    ].join(' ');
    const tags = Object.entries(rules)
      .filter(([, pattern]) => pattern.test(searchable))
      .map(([tag]) => tag);
    if (
      !tags.length &&
      controlPrefixes.some(prefix => record.routePath.startsWith(prefix))
    ) {
      tags.push('OPERATIONS');
    }
    if (!tags.length) continue;
    candidates += 1;
    routes.set(record.routePath, [
      ...new Set([...(routes.get(record.routePath) ?? []), ...tags]),
    ]);
  }
  const values = [...routes.values()];
  metrics = {
    catalogScreens: catalog.records?.length ?? 0,
    uniqueAssets: routes.size,
    mergedContracts: candidates - routes.size,
    operations: values.filter(tags => tags.includes('OPERATIONS')).length,
    design: values.filter(tags => tags.includes('DESIGN')).length,
    development: values.filter(tags => tags.includes('DEVELOPMENT')).length,
  };
  if (metrics.catalogScreens !== 1000) {
    failures.push(`expected 1000 catalog screens, got ${metrics.catalogScreens}`);
  }
  for (const capability of ['operations', 'design', 'development']) {
    if (!metrics[capability]) failures.push(`empty ${capability} registry`);
  }
}
if (failures.length) {
  console.error(JSON.stringify({ valid: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ valid: true, capabilities: 3, ...metrics }));
