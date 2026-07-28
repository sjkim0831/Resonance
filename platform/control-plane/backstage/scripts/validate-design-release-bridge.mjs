import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relative =>
  fs.readFileSync(path.join(root, relative), 'utf8');
const backend = read(
  'packages/backend/src/plugins/resonanceProjects.ts',
);
const page = read(
  'packages/app/src/plugins/ccus-screen-designs/ActorProcessControlPage.tsx',
);
const worker = read(
  '../../../ops/scripts/resonance-design-release-worker.sh',
);
const failures = [];

for (const marker of [
  "router.post('/:projectId/design-releases'",
  "'/:projectId/design-releases/:designVersion/promote'",
  "'/:projectId/development-contract'",
  "task_type: 'DESIGN_PROMOTION'",
]) {
  if (!backend.includes(marker)) failures.push(`backend missing ${marker}`);
}
for (const marker of [
  'Backstage 설계 원장 저장',
  'Resonance 개발 기준으로 승격',
  'development-contract',
]) {
  if (!page.includes(marker)) failures.push(`page missing ${marker}`);
}
for (const marker of [
  'sourceOfTruth',
  'BACKSTAGE',
  'COMPILE_AND_QUEUE',
  'backstage-development-contract.json',
]) {
  if (!worker.includes(marker)) failures.push(`worker missing ${marker}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  JSON.stringify({
    valid: true,
    sourceOfTruth: 'BACKSTAGE',
    promotionTask: 'DESIGN_PROMOTION',
    generatorAction: 'COMPILE_AND_QUEUE',
  }),
);
