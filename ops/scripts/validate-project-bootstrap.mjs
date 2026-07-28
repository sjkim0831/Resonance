#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '');
const manifestPath = resolve(root, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const failures = [];

const requireValue = (condition, message) => {
  if (!condition) failures.push(message);
};

requireValue(manifest.schemaVersion === 1, 'schemaVersion must be 1');
requireValue(
  /^[A-Za-z][A-Za-z0-9_-]{1,31}$/.test(manifest.metadata?.projectId ?? ''),
  'metadata.projectId is invalid',
);
requireValue(Boolean(manifest.metadata?.projectName), 'metadata.projectName is required');
requireValue(
  ['PROJECT_DB', 'COMMON_DB + PROJECT_DB'].includes(
    manifest.bindings?.database?.bindingMode,
  ),
  'database bindingMode is invalid',
);
requireValue(
  /^jdbc:postgresql:\/\//.test(manifest.bindings?.database?.projectDb?.url ?? ''),
  'project database URL is invalid',
);
requireValue(Boolean(manifest.bindings?.database?.projectDb?.schema), 'database schema is required');
requireValue(Boolean(manifest.bindings?.theme?.id), 'theme id is required');
requireValue(
  manifest.runtime?.runtimeMode === 'DEDICATED_PROJECT_RUNTIME',
  'runtimeMode is invalid',
);
requireValue(Boolean(manifest.runtime?.packagePath), 'runtime packagePath is required');
requireValue(Boolean(manifest.runtime?.manifestPath), 'runtime manifestPath is required');
requireValue(Boolean(manifest.runtime?.routing?.routePrefix), 'runtime routePrefix is required');
requireValue(Boolean(manifest.runtime?.routing?.infoPath), 'runtime infoPath is required');

for (const file of [
  'design/project-contract.json',
  'frontend/screen-contracts.json',
  'backend/api-contracts.json',
  'db/schema-contract.json',
  'tests/scenarios.json',
  'ops/runtime.json',
]) {
  try {
    JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  } catch (error) {
    failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ valid: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ valid: true, projectId: manifest.metadata.projectId }));
