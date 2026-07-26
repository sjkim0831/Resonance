import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.app.json"), "utf8"));
const requiredExcludes = ["src/generated/screens/**", "src/generated/templates/**"];
const excludes = new Set(config.exclude || []);
const failures = [];

for (const required of requiredExcludes) {
  if (!excludes.has(required)) failures.push(`tsconfig.app.json must exclude ${required}`);
}

const sourceRoots = ["src/app", "src/features", "src/platform", "src/shared"];
const prototypeImport = /(?:from\s+|import\s*\()['"][^'"]*generated\/(?:screens|templates)(?:\/|['"])/;
const forbiddenRuntimeDependency = /@mui\/(?:material|icons-material)|(?:from\s+|import\s*\()['"]axios['"]/;

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      const source = fs.readFileSync(full, "utf8");
      if (prototypeImport.test(source)) {
        failures.push(`production source imports design prototype: ${path.relative(root, full)}`);
      }
      if (forbiddenRuntimeDependency.test(source)) {
        failures.push(`production source bypasses common UI/API assets: ${path.relative(root, full)}`);
      }
    }
  }
}

for (const sourceRoot of sourceRoots) walk(path.join(root, sourceRoot));

if (failures.length) {
  console.error("[generated-prototype-isolation] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "[generated-prototype-isolation] PASS design prototypes are isolated; production uses registered common assets",
);
