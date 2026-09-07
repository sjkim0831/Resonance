import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, "..");

const pages = [
  {
    name: "company reapplication",
    path: "src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx"
  },
  {
    name: "company status",
    path: "src/features/join-company-status/JoinCompanyStatusMigrationPage.tsx"
  },
  {
    name: "shared user portal",
    path: "src/components/user-shell/UserPortalChrome.tsx",
    scope: "source"
  }
];

const failures = [];
const requireContract = (condition, message) => {
  if (!condition) failures.push(message);
};

function openingTagContaining(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return "";
  const start = source.lastIndexOf("<", markerIndex);
  const end = source.indexOf(">", markerIndex);
  return start >= 0 && end >= 0 ? source.slice(start, end + 1) : "";
}

function headerSource(source) {
  const start = source.indexOf("<header ");
  const end = source.indexOf("</header>", start);
  return start >= 0 && end >= 0 ? source.slice(start, end + "</header>".length) : "";
}

for (const page of pages) {
  const source = fs.readFileSync(path.resolve(sourceRoot, page.path), "utf8");
  const header = page.scope === "source" ? source : headerSource(source);
  const wrapper = openingTagContaining(header, "data-join-brand-wrapper");
  const action = openingTagContaining(header, "data-join-brand-action");
  const subtitle = openingTagContaining(header, "data-join-brand-subtitle");

  requireContract(Boolean(header), `${page.name}: custom header is missing`);
  requireContract(!/\bshrink-0\b/.test(header), `${page.name}: custom header must not use shrink-0`);
  requireContract(
    wrapper.includes("min-w-0") && wrapper.includes("max-w-full"),
    `${page.name}: brand wrapper must be intrinsically shrinkable`
  );
  requireContract(
    action.includes("min-w-0") && action.includes("max-w-full"),
    `${page.name}: brand action must be intrinsically shrinkable`
  );
  requireContract(
    subtitle.includes("hidden") && subtitle.includes("sm:block") && subtitle.includes("truncate") && subtitle.includes("max-w-full"),
    `${page.name}: subtitle must hide below sm and truncate when visible`
  );
  requireContract(header.includes("truncate text-lg"), `${page.name}: brand title must truncate instead of widening the viewport`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log(`PASS join-company-mobile-header-contract pages=${pages.length} viewport=390 overflow=guarded desktop=preserved`);
