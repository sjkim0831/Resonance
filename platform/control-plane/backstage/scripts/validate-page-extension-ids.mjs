import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'packages', 'app', 'src');
const sourceFiles = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      sourceFiles.push(path);
    }
  }
}

walk(root);
const failures = [];
let pageCount = 0;

for (const path of sourceFiles) {
  const source = readFileSync(path, 'utf8');
  const definitions = source.split('PageBlueprint.make({').slice(1);
  if (!definitions.length) continue;
  pageCount += definitions.length;
  const ids = definitions.map(definition => {
    const preParams = definition.split(/\bparams\s*:/, 1)[0];
    return preParams.match(/\bname\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? '<default>';
  });
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) {
    failures.push(
      `${relative(root, path)}: duplicate page extension id(s): ${[
        ...new Set(duplicates),
      ].join(', ')}`,
    );
  }
}

if (failures.length) {
  throw new Error(
    `Backstage page extension validation failed:\n${failures.join('\n')}`,
  );
}

console.log(
  `[page-extension-validator] PASS ${pageCount} page definitions have unique ids`,
);
