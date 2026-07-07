import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rootDir = new URL("../src/features", import.meta.url);
const featureRoot = rootDir.pathname;

const ignoreSuffixes = new Set([
  "buttonCatalog.tsx",
  "primitives.tsx",
  "common.tsx"
]);

const rules = [
  { id: "raw_button", label: "raw <button>", pattern: /<button\b/g },
  { id: "raw_link", label: "raw <a>", pattern: /<a\b/g },
  { id: "raw_input", label: "raw <input>", pattern: /<input\b/g },
  { id: "raw_select", label: "raw <select>", pattern: /<select\b/g },
  { id: "raw_textarea", label: "raw <textarea>", pattern: /<textarea\b/g },
  { id: "raw_table", label: "raw <table>", pattern: /<table\b/g },
  { id: "legacy_permission_button", label: "PermissionButton", pattern: /\bPermissionButton\b/g },
  { id: "legacy_form_input", label: "form-input", pattern: /\bform-input\b/g },
  { id: "legacy_input_field", label: "input-field", pattern: /\binput-field\b/g },
  { id: "legacy_mypage_form_input", label: "mypage-form-input", pattern: /\bmypage-form-input\b/g }
];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function classifySurface(filePath) {
  if (filePath.includes("/admin-") || filePath.includes("/environment-management/") || filePath.includes("/screen-builder/") || filePath.includes("/security-") || filePath.includes("/system-") || filePath.includes("/function-management/") || filePath.includes("/auth-") || filePath.includes("/member-") || filePath.includes("/company-") || filePath.includes("/dept-role-mapping/")) {
    return "admin";
  }
  if (filePath.includes("/public-entry/") || filePath.includes("/home-entry/") || filePath.includes("/join-") || filePath.includes("/mypage/")) {
    return "home";
  }
  return "shared";
}

const summary = [];
for (const file of walk(featureRoot)) {
  if ([...ignoreSuffixes].some((suffix) => file.endsWith(suffix))) {
    continue;
  }
  const source = readFileSync(file, "utf8");
  const hits = rules
    .map((rule) => ({ ...rule, count: (source.match(rule.pattern) || []).length }))
    .filter((rule) => rule.count > 0);
  if (hits.length === 0) {
    continue;
  }
  summary.push({
    file: relative(process.cwd(), file),
    surface: classifySurface(file),
    total: hits.reduce((sum, hit) => sum + hit.count, 0),
    hits
  });
}

summary.sort((a, b) => b.total - a.total || a.file.localeCompare(b.file));

console.log("== component standardization audit ==");
for (const item of summary) {
  const details = item.hits.map((hit) => `${hit.id}:${hit.count}`).join(", ");
  console.log(`${item.total}\t${item.surface}\t${item.file}\t${details}`);
}

const surfaceTotals = summary.reduce((acc, item) => {
  acc[item.surface] = (acc[item.surface] || 0) + item.total;
  return acc;
}, {});

console.log("\n== surface totals ==");
for (const [surface, total] of Object.entries(surfaceTotals).sort((a, b) => b[1] - a[1])) {
  console.log(`${surface}\t${total}`);
}
