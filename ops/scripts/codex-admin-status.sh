#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_PATH="${1:-$ROOT_DIR/docs/operations/admin-screen-implementation-status.md}"
STATUS_FILE="$(mktemp)"

git -C "$ROOT_DIR" status --short -- \
  frontend/src/features \
  frontend/src/app/routes/definitions.ts \
  frontend/src/app/routes/pageRegistry.tsx \
  src/main/java \
  src/main/resources/egovframework/mapper \
  docs/sql > "$STATUS_FILE"

node - "$ROOT_DIR" "$OUTPUT_PATH" "$STATUS_FILE" <<'NODE'
const fs = require("fs");
const path = require("path");

const rootDir = process.argv[2];
const outputPath = process.argv[3];
const statusFile = process.argv[4];

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

function gitStatusLines() {
  const output = fs.readFileSync(statusFile, "utf8");
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

const definitions = read("frontend/src/app/routes/definitions.ts");
const pageRegistry = read("frontend/src/app/routes/pageRegistry.tsx");
const parityInventory = read("docs/frontend/admin-template-parity-inventory.md");
const statusLines = gitStatusLines();

const remainingDomains = [
  {
    key: "emission-auth",
    label: "배출/인증",
    routeIds: [
      "admin-login",
      "auth-group",
      "auth-change",
      "dept-role",
      "password-reset",
      "admin-permission",
      "admin-create",
      "admin-list",
      "emission-result-list",
      "emission-site-management",
    ],
  },
  {
    key: "trade",
    label: "거래",
    routeIds: [
      "company-account",
      "company-list",
      "company-approve",
      "company-detail",
      "member-approve",
      "member-list",
      "member-withdrawn",
      "member-activate",
      "member-detail",
      "member-stats",
      "member-register",
      "member-edit",
      "login-history",
      "external-connection-list",
      "external-connection-add",
      "external-connection-edit",
      "external-sync",
    ],
  },
  {
    key: "content",
    label: "콘텐츠",
    routeIds: [
      "notification",
      "help-management",
      "admin-sitemap",
      "admin-menu-placeholder",
    ],
  },
];

const remainingRouteIdSet = new Set(remainingDomains.flatMap((domain) => domain.routeIds));
const domainByRouteId = new Map(
  remainingDomains.flatMap((domain) => domain.routeIds.map((routeId) => [routeId, domain.label]))
);

const adminRoutes = [...definitions.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", group: "([^"]+)", koPath: "([^"]+)"/g)]
  .map((match) => ({
    id: match[1],
    label: match[2],
    group: match[3],
    koPath: match[4],
  }))
  .filter((route) => route.group === "admin" && remainingRouteIdSet.has(route.id));

const pageComponentMatches = [...pageRegistry.matchAll(/"([^"]+)": lazyNamed\(\(\) => import\("([^"]+)"\), "([^"]+)"\)/g)];
const directMap = new Map(pageComponentMatches.map((match) => [match[1], { importPath: match[2], exportName: match[3] }]));

const sharedMap = new Map(
  [...pageRegistry.matchAll(/"([^"]+)": lazyNamed\((shared[^,]+), "([^"]+)"\)/g)].map((match) => [
    match[1],
    { importPath: match[2], exportName: match[3] },
  ])
);

const sharedLoaders = new Map(
  [...pageRegistry.matchAll(/const ([^ ]+) = \(\) => import\("([^"]+)"\);/g)].map((match) => [match[1], match[2]])
);

const preloaderIds = new Set(
  [...pageRegistry.matchAll(/"([^"]+)": \(\) => import\(|"([^"]+)": shared[^,\n]+/g)].map((match) => match[1] || match[2])
);

const parityConnectedIds = new Set(
  [...parityInventory.matchAll(/\| `([^`]+)` \| `[^`]+` \|/g)].map((match) => match[1])
);

function resolveImportInfo(routeId) {
  if (directMap.has(routeId)) {
    return directMap.get(routeId);
  }
  const shared = sharedMap.get(routeId);
  if (!shared) {
    return null;
  }
  return {
    importPath: sharedLoaders.get(shared.importPath) || shared.importPath,
    exportName: shared.exportName,
  };
}

function importPathToFeatureDir(importPath) {
  if (!importPath || !importPath.startsWith("../../features/")) {
    return "";
  }
  return `frontend/src/features/${importPath.replace("../../features/", "").split("/")[0]}/`;
}

function collectDirtyHints(route) {
  const info = resolveImportInfo(route.id);
  const featureDir = info ? importPathToFeatureDir(info.importPath) : "";
  const matched = statusLines.filter((line) => {
    const filePath = line.slice(3);
    return (
      (featureDir && filePath.startsWith(featureDir)) ||
      filePath.includes(route.id) ||
      filePath.toLowerCase().includes(route.id.replace(/-/g, "")) ||
      filePath.includes(route.label.replace(/\s+/g, ""))
    );
  });
  return { info, featureDir, matched };
}

const rows = adminRoutes.map((route) => {
  const { info, featureDir, matched } = collectDirtyHints(route);
  const hasPage = Boolean(info);
  const hasPreloader = preloaderIds.has(route.id);
  const parity = parityConnectedIds.has(route.id) ? "connected" : "custom_or_untracked";
  let status = "not_started";
  if (matched.length > 0) {
    status = "in_progress";
  } else if (hasPage) {
    status = "done";
  }
  const notes = [];
  if (matched.length > 0) {
    notes.push(`dirty: ${matched.map((line) => line.slice(3)).join(", ")}`);
  }
  if (!hasPreloader) {
    notes.push("preloader missing");
  }
  if (parity === "connected") {
    notes.push("parity inventory connected");
  }
  if (parity === "custom_or_untracked") {
    notes.push("custom or parity-untracked route");
  }
  return {
    ...route,
    domain: domainByRouteId.get(route.id) || "",
    status,
    importPath: info ? info.importPath : "",
    featureDir,
    notes: notes.join("; "),
  };
});

const summary = rows.reduce(
  (acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  },
  { done: 0, in_progress: 0, not_started: 0 }
);

const lines = [];
lines.push("# Admin Screen Implementation Status");
lines.push("");
lines.push("Generated from `frontend/src/app/routes/definitions.ts`, `frontend/src/app/routes/pageRegistry.tsx`, `docs/frontend/admin-template-parity-inventory.md`, and the current `git status --short` snapshot.");
lines.push("");
lines.push(`Generated on: \`${new Date().toISOString().slice(0, 10)}\``);
lines.push("");
lines.push("Scope: remaining admin routes only for `배출/인증`, `거래`, `콘텐츠`.");
lines.push("");
lines.push("## Start Command");
lines.push("");
lines.push("1. `bash ops/scripts/codex-resume-status.sh`");
lines.push("2. `bash ops/scripts/codex-admin-status.sh`");
lines.push("");
lines.push("## Status Rules");
lines.push("");
lines.push("- `done`: remaining-scope route is connected in `pageRegistry` and there is no route-specific dirty feature work in the current working tree");
lines.push("- `in_progress`: the route's feature directory or route-specific files are dirty in the current working tree");
lines.push("- `not_started`: remaining-scope route exists in `definitions.ts` but has no page component mapping in `pageRegistry`");
lines.push("- `preloader missing` in notes means the route has a page mapping but no dedicated preloader entry");
lines.push("");
lines.push("## Summary");
lines.push("");
for (const domain of remainingDomains) {
  lines.push(`- ${domain.label}: \`${rows.filter((row) => row.domain === domain.label).length}\``);
}
lines.push(`- remaining admin routes total: \`${adminRoutes.length}\``);
lines.push(`- done: \`${summary.done}\``);
lines.push(`- in_progress: \`${summary.in_progress}\``);
lines.push(`- not_started: \`${summary.not_started}\``);
lines.push("");
lines.push("## Current Table");
lines.push("");
lines.push("| Domain | Status | Route id | Label | KO path | Feature | Notes |");
lines.push("| --- | --- | --- | --- | --- | --- | --- |");

for (const row of rows) {
  lines.push(
    `| ${row.domain} | \`${row.status}\` | \`${row.id}\` | ${row.label} | \`${row.koPath}\` | \`${row.featureDir || row.importPath || "-"}\` | ${row.notes || "-"} |`
  );
}

lines.push("");
lines.push("## In-Progress Routes");
lines.push("");
for (const row of rows.filter((row) => row.status === "in_progress")) {
  lines.push(`- [${row.domain}] \`${row.id}\` ${row.label}: ${row.notes}`);
}

lines.push("");
lines.push("## Preloader Gaps");
lines.push("");
for (const row of rows.filter((row) => row.notes.includes("preloader missing"))) {
  lines.push(`- \`${row.id}\` ${row.label}`);
}

lines.push("");
lines.push("## Use Rule");
lines.push("");
lines.push("- treat this file as the canonical remaining-route snapshot for AI session restarts");
lines.push("- refresh it with `bash ops/scripts/codex-admin-status.sh` before opening a new admin implementation lane");
lines.push("- if this file and `git status --short` disagree, the working tree wins");

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(`wrote ${path.relative(rootDir, outputPath)}`);
NODE

rm -f "$STATUS_FILE"
