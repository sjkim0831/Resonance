import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(frontendRoot, "src");
const routeFamiliesRoot = path.join(srcRoot, "app/routes/families");
const outputPath = path.join(srcRoot, "features/builder-studio/pageCompletenessInventory.ts");
const routeSourceOutputPath = path.join(srcRoot, "features/builder-studio/routeSourceInventory.ts");

function listRouteFamilyFiles() {
  return fs.readdirSync(routeFamiliesRoot)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(routeFamiliesRoot, name));
}

function resolveLoaderImport(routeFile, importPath) {
  const base = path.dirname(routeFile);
  const resolved = path.resolve(base, importPath);
  const candidates = path.extname(resolved)
    ? [resolved]
    : [`${resolved}.tsx`, `${resolved}.ts`, path.join(resolved, "index.tsx"), path.join(resolved, "index.ts")];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function parseRouteDefinitions(source) {
  const definitions = new Map();
  const pattern = /\{\s*id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]*)"\s*,\s*group:\s*"([^"]*)"\s*,\s*koPath:\s*"([^"]*)"\s*,\s*enPath:\s*"([^"]*)"/g;
  for (const match of source.matchAll(pattern)) {
    definitions.set(match[1], {
      routeId: match[1],
      label: match[2],
      group: match[3],
      koPath: match[4],
      enPath: match[5],
    });
  }
  return definitions;
}

function resolveModuleFile(fromFile, importPath) {
  const base = path.dirname(fromFile);
  const resolved = path.resolve(base, importPath);
  const candidates = path.extname(resolved)
    ? [resolved]
    : [`${resolved}.tsx`, `${resolved}.ts`, path.join(resolved, "index.tsx"), path.join(resolved, "index.ts")];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function parseImportMap(source) {
  const imports = new Map();
  const namedPattern = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(namedPattern)) {
    const spec = match[1];
    const importPath = match[2];
    for (const rawPart of spec.split(",")) {
      const part = rawPart.trim();
      if (!part) continue;
      const aliasMatch = part.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
      const imported = aliasMatch ? aliasMatch[1] : part;
      const local = aliasMatch ? aliasMatch[2] : part;
      imports.set(local, { imported, importPath });
    }
  }

  const defaultPattern = /import\s+([A-Za-z0-9_$]+)\s+from\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(defaultPattern)) {
    imports.set(match[1], { imported: "default", importPath: match[2] });
  }

  return imports;
}

function resolveReExportTarget(filePath, exportName, visited = new Set()) {
  const key = `${filePath}#${exportName}`;
  if (visited.has(key) || !fs.existsSync(filePath)) {
    return { filePath, exportName };
  }
  visited.add(key);
  const source = fs.readFileSync(filePath, "utf8").trim();

  const namedPattern = /export\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(namedPattern)) {
    const spec = match[1];
    const importPath = match[2];
    for (const rawPart of spec.split(",")) {
      const part = rawPart.trim();
      if (!part) continue;
      const aliasMatch = part.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
      const original = aliasMatch ? aliasMatch[1] : part;
      const alias = aliasMatch ? aliasMatch[2] : part;
      if (alias !== exportName) continue;
      const targetFile = resolveModuleFile(filePath, importPath);
      return resolveReExportTarget(targetFile, original, visited);
    }
  }

  const imports = parseImportMap(source);
  const directReturn = source.match(/return\s*\(?\s*<([A-Z][A-Za-z0-9_$]*)[\s/>]/);
  if (directReturn) {
    const localComponent = directReturn[1];
    const imported = imports.get(localComponent);
    if (imported) {
      const targetFile = resolveModuleFile(filePath, imported.importPath);
      return { filePath: targetFile, exportName: imported.imported === "default" ? localComponent : imported.imported };
    }
  }

  return { filePath, exportName };
}

function collectRouteSourceEntries() {
  const entries = [];
  const seenRouteIds = new Set();
  for (const routeFile of listRouteFamilyFiles()) {
    const source = fs.readFileSync(routeFile, "utf8");
    const definitions = parseRouteDefinitions(source);
    const unitPattern = /\{\s*id:\s*"([^"]+)"\s*,\s*exportName:\s*"([^"]+)"\s*,\s*loader:\s*\(\)\s*=>\s*import\("([^"]+)"\)/g;
    for (const match of source.matchAll(unitPattern)) {
      const routeId = match[1];
      const exportName = match[2];
      const importPath = match[3];
      if (!importPath.startsWith("../../../features")) continue;
      const pageFile = resolveLoaderImport(routeFile, importPath);
      const sourcePath = path.relative(srcRoot, pageFile).replace(/\\/g, "/");
      const effectiveTarget = resolveReExportTarget(pageFile, exportName);
      const effectiveSourcePath = path.relative(srcRoot, effectiveTarget.filePath).replace(/\\/g, "/");
      if (seenRouteIds.has(routeId)) continue;
      seenRouteIds.add(routeId);
      const definition = definitions.get(routeId) || { label: routeId, group: "", koPath: "", enPath: "" };
      entries.push({
        routeId,
        label: definition.label,
        group: definition.group,
        koPath: definition.koPath,
        enPath: definition.enPath,
        exportName,
        sourcePath,
        effectiveExportName: effectiveTarget.exportName,
        effectiveSourcePath,
        routeFamilyFile: path.relative(srcRoot, routeFile).replace(/\\/g, "/"),
      });
    }
  }
  return entries.sort((a, b) => a.routeId.localeCompare(b.routeId));
}

function hasAny(source, values) {
  return values.some((value) => source.includes(value));
}

function classify(rel, source, lineCount, exists) {
  const relLower = rel.toLowerCase();
  const hasData = hasAny(source, ["useAsyncValue", "fetch", "useFrontendSession"]);
  const hasForm = hasAny(source, ["<form", "onSubmit", "AdminInput", "<input", "AdminSelect", "AdminTextarea"]);
  const hasTable = hasAny(source, ["<table", "data-table", "SimpleTable", "CollectionResultPanel", "SummaryCards", "SummaryMetricCard"]);
  const hasTabs = hasAny(source, ["TabBar", "tabs =", "setTab"]);
  const hasActions = hasAny(source, ["actions=", "gov-btn", "MemberButton", "button"]);
  const hasExternalRuntime = hasAny(source, ["<iframe", "iframe"]);
  const delegatesToComponent = lineCount < 60 && /return\s*\(?\s*<[A-Z][A-Za-z0-9_]*[\s/>]/.test(source);

  if (!exists) {
    return ["missing", "라우트 loader 대상 파일을 찾을 수 없습니다."];
  }
  if (relLower.includes("placeholder")) {
    return ["placeholder-managed", "메뉴 접근과 메타데이터 표시는 가능하며, 상세 업무 화면 이관은 빌더에서 추적합니다."];
  }
  if (hasData && (hasForm || hasTable || hasTabs || hasActions)) {
    return ["implemented", "데이터와 UI/동작 신호가 있는 라우트 화면입니다."];
  }
  if ((source.trim().startsWith("export {") && lineCount <= 3) || delegatesToComponent) {
    return ["delegated", "라우트는 공통 구현으로 위임됩니다. 위임 대상 화면의 기능으로 관리합니다."];
  }
  if (hasExternalRuntime && hasActions) {
    return ["implemented", "외부 런타임을 감싸는 관리형 화면이며 상태/조치 UI를 제공합니다."];
  }
  if (hasData && lineCount >= 100) {
    return ["implemented", "데이터 기반 포털/조회 화면으로 구성되어 있습니다."];
  }
  if (lineCount < 120) {
    return ["thin", "라우트 화면으로 등록되어 있으나 데이터/폼/표/액션 신호가 부족해 보강 여부 점검이 필요합니다."];
  }
  return ["implemented", "자체 UI와 동작 로직이 있는 라우트 화면입니다."];
}

const routeSourceEntries = collectRouteSourceEntries();
const routePageFiles = [...new Set(routeSourceEntries.map((entry) => entry.sourcePath))].sort((a, b) => a.localeCompare(b));
const routeEntriesBySource = routeSourceEntries.reduce((acc, entry) => {
  if (!acc.has(entry.sourcePath)) acc.set(entry.sourcePath, []);
  acc.get(entry.sourcePath).push(entry);
  return acc;
}, new Map());

const rows = routePageFiles.map((rel) => {
  const entriesForSource = routeEntriesBySource.get(rel) || [];
  const effectiveSourcePaths = [...new Set(entriesForSource.map((entry) => entry.effectiveSourcePath || entry.sourcePath))];
  const effectiveExportNames = [...new Set(entriesForSource.map((entry) => entry.effectiveExportName || entry.exportName))];
  const routeIds = entriesForSource.map((entry) => entry.routeId).sort((a, b) => a.localeCompare(b));
  const analysisRel = effectiveSourcePaths[0] || rel;
  const filePath = path.join(srcRoot, analysisRel);
  const exists = fs.existsSync(filePath);
  const source = exists ? fs.readFileSync(filePath, "utf8") : "";
  const lineCount = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
  const [status, reason] = classify(analysisRel, source, lineCount, exists);
  return {
    sourcePath: rel,
    effectiveSourcePath: analysisRel,
    effectiveSourcePaths,
    effectiveExportNames,
    routeIds,
    routeCount: routeIds.length,
    status,
    lineCount,
    reason,
    hasAsyncData: hasAny(source, ["useAsyncValue", "fetch", "useFrontendSession"]),
    hasForm: hasAny(source, ["<form", "onSubmit", "AdminInput", "<input", "AdminSelect", "AdminTextarea"]),
    hasTable: hasAny(source, ["<table", "data-table", "SimpleTable", "CollectionResultPanel", "SummaryCards", "SummaryMetricCard"]),
    hasBuilderLink: hasAny(source, ["builder-studio", "Builder", "빌더 관리"]),
  };
});

const body = `export type PageCompletenessStatus = "implemented" | "delegated" | "thin" | "placeholder-managed" | "missing";\n\nexport type PageCompletenessInventoryRow = {\n  sourcePath: string;\n  effectiveSourcePath: string;\n  effectiveSourcePaths: string[];\n  effectiveExportNames: string[];\n  routeIds: string[];\n  routeCount: number;\n  status: PageCompletenessStatus;\n  lineCount: number;\n  reason: string;\n  hasAsyncData: boolean;\n  hasForm: boolean;\n  hasTable: boolean;\n  hasBuilderLink: boolean;\n};\n\nexport const PAGE_COMPLETENESS_INVENTORY: PageCompletenessInventoryRow[] = ${JSON.stringify(rows, null, 2)};\n`;
const routeSourceBody = `export type RouteSourceInventoryRow = {
  routeId: string;
  label: string;
  group: string;
  koPath: string;
  enPath: string;
  exportName: string;
  sourcePath: string;
  effectiveExportName: string;
  effectiveSourcePath: string;
  routeFamilyFile: string;
};

export const ROUTE_SOURCE_INVENTORY: RouteSourceInventoryRow[] = ${JSON.stringify(routeSourceEntries, null, 2)};
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, body);
fs.writeFileSync(routeSourceOutputPath, routeSourceBody);

const summary = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});
console.log(`[generate-page-completeness-inventory] wrote ${rows.length} rows to ${outputPath}`);
console.log(`[generate-page-completeness-inventory] wrote ${routeSourceEntries.length} route source rows to ${routeSourceOutputPath}`);
console.log(`[generate-page-completeness-inventory] summary ${JSON.stringify(summary)}`);
