#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = path.join(root, "src/features/builder-studio/routeSourceInventory.ts");
const fallbackRoutes = [
  "/home",
  "/emission/project_list",
  "/home/certificate-verify",
  "/admin/system/actor-process",
  "/admin/emission/survey-report-print"
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pattern(routes) {
  return `^(${[...new Set(routes)].map(escapeRegex).join("|")})([?#]|$)`;
}

function argumentValues(name) {
  const values = [];
  process.argv.forEach((value, index) => {
    if (value === `--${name}` && process.argv[index + 1]) values.push(process.argv[index + 1]);
  });
  return values;
}

const explicitFiles = argumentValues("changed-file");
const base = process.argv[2] || "";
const target = process.argv[3] || "HEAD";
const changedFiles = explicitFiles.length
  ? explicitFiles
  : execFileSync("git", ["diff", "--no-renames", "--name-only", base, target], {
      cwd: path.resolve(root, "../../.."),
      encoding: "utf8"
    }).split(/\r?\n/).filter(Boolean);

const inventorySource = readFileSync(inventoryPath, "utf8");
const match = inventorySource.match(/ROUTE_SOURCE_INVENTORY[^=]*=\s*(\[[\s\S]*\]);\s*$/);
if (!match) throw new Error(`Cannot parse route source inventory: ${inventoryPath}`);
const inventory = JSON.parse(match[1]);

const frontendSourcePrefix = "projects/carbonet-frontend/source/src/";
const runtimeFiles = changedFiles.filter((file) => file.startsWith(frontendSourcePrefix));
let commonImpact = runtimeFiles.length === 0;
const routes = [];
for (const file of runtimeFiles) {
  const relative = file.slice(frontendSourcePrefix.length);
  const rows = inventory.filter((row) =>
    row.sourcePath === relative ||
    row.effectiveSourcePath === relative ||
    row.routeFamilyFile === relative
  );
  if (rows.length === 0 || !relative.startsWith("features/")) {
    commonImpact = true;
    break;
  }
  for (const row of rows) {
    if (row.koPath) routes.push(row.koPath);
    if (row.enPath) routes.push(row.enPath);
  }
}

const selected = commonImpact || routes.length === 0 ? fallbackRoutes : routes;
process.stdout.write(`${pattern(selected)}\n`);
