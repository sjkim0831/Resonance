#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const frontend = path.join(root, "projects/carbonet-frontend/source/src");
const storePath = path.join(root, "projects/carbonet-backend-metadata/builder/platform-builder-store.json");

function generatedArray(file, constantName) {
  const text = fs.readFileSync(file, "utf8");
  const marker = `export const ${constantName}`;
  const declaration = text.indexOf(marker);
  const assignment = text.indexOf("=", declaration);
  const start = text.indexOf("[", assignment);
  const end = text.indexOf("\n];", start);
  if (start < 0 || end < 0) throw new Error(`Cannot read ${constantName}`);
  return JSON.parse(text.slice(start, end + 2));
}

function walk(dir, predicate, rows = []) {
  if (!fs.existsSync(dir)) return rows;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "build", "dist", ".gradle", "assets"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, rows);
    else if (predicate(full)) rows.push(full);
  }
  return rows;
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

const routes = generatedArray(
  path.join(frontend, "features/builder-studio/routeSourceInventory.ts"),
  "ROUTE_SOURCE_INVENTORY"
);
const completeness = generatedArray(
  path.join(frontend, "features/builder-studio/pageCompletenessInventory.ts"),
  "PAGE_COMPLETENESS_INVENTORY"
);
const completenessBySource = new Map();
for (const row of completeness) {
  completenessBySource.set(row.sourcePath, row);
  completenessBySource.set(row.effectiveSourcePath, row);
  for (const sourcePath of row.effectiveSourcePaths || []) completenessBySource.set(sourcePath, row);
}

const routeAssets = routes.map((route) => ({
  id: `ROUTE_${route.routeId}`,
  assetType: "route",
  ...route,
  status: completenessBySource.get(route.effectiveSourcePath)?.status || "missing"
}));

const pageAssets = routes.map((route) => {
  const quality = completenessBySource.get(route.effectiveSourcePath) || {};
  return {
    id: `PAGE_${route.routeId}`,
    assetType: "page",
    pageId: route.routeId,
    title: route.label,
    routePath: route.koPath,
    sourcePath: route.effectiveSourcePath,
    exportName: route.effectiveExportName,
    status: quality.status || "missing",
    lineCount: quality.lineCount || 0,
    capabilities: {
      asyncData: Boolean(quality.hasAsyncData),
      form: Boolean(quality.hasForm),
      table: Boolean(quality.hasTable),
      builderLink: Boolean(quality.hasBuilderLink)
    }
  };
});

const sourceComponents = [];
for (const file of walk(path.join(frontend, "features"), (name) => name.endsWith(".tsx"))) {
  const text = fs.readFileSync(file, "utf8");
  const names = new Set();
  for (const match of text.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g)) names.add(match[1]);
  for (const name of names) {
    sourceComponents.push({
      id: `SOURCE_COMPONENT_${name}`,
      assetType: "source-component",
      componentId: name,
      sourcePath: relative(file),
      status: "ACTIVE"
    });
  }
}

const apiAssets = [];
for (const file of walk(path.join(root, "apps/carbonet-api/src/main/java"), (name) => name.endsWith("Controller.java"))) {
  const text = fs.readFileSync(file, "utf8");
  const base = text.match(/@RequestMapping\("([^"]+)"\)/)?.[1] || "";
  const controller = path.basename(file, ".java");
  for (const match of text.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping(?:\("([^"]*)"\))?/g)) {
    apiAssets.push({
      id: `API_${controller}_${match.index}`,
      assetType: "api",
      controller,
      method: match[1].toUpperCase(),
      path: `${base}${match[2] || ""}`,
      sourcePath: relative(file),
      status: "ACTIVE"
    });
  }
}

const dbAssets = walk(path.join(root, "apps/carbonet-api/src/main/resources/db"), (name) => /\.(sql|ya?ml|xml)$/.test(name))
  .map((file) => ({
    id: `DB_${relative(file).replace(/[^A-Za-z0-9]+/g, "_")}`,
    assetType: "database-migration",
    name: path.basename(file),
    sourcePath: relative(file),
    engine: file.includes("liquibase") || file.includes("changelog") ? "liquibase" : "flyway",
    status: "ACTIVE"
  }));

const store = fs.existsSync(storePath)
  ? JSON.parse(fs.readFileSync(storePath, "utf8"))
  : { components: [], screens: [], themes: [], assets: {} };
store.assets ||= {};

const manualComponents = (store.components || []).filter((item) => !String(item.componentId || "").startsWith("SOURCE_COMPONENT_"));
const sourcePageComponent = {
  componentId: "SOURCE_PAGE",
  componentNm: "기존 구현 화면",
  componentDc: "기존 React 화면을 보존하면서 SDUI 노드 트리에 연결하는 전환용 컴포넌트",
  componentType: "OTHER",
  categoryCd: "LAYOUT",
  iconNm: "web",
  defaultProps: { sourcePath: "", exportName: "", routePath: "" },
  defaultClassNm: "min-w-0",
  defaultStyle: { runtimeMode: "source-backed" },
  dataAttrs: { "data-sdui-component": "SOURCE_PAGE" },
  isContainer: true,
  isReusable: true,
  sortOrder: 5,
  useAt: "Y"
};
const generatedComponents = sourceComponents.map((item, index) => ({
  componentId: item.id,
  componentNm: item.componentId,
  componentDc: `소스 자동 등록: ${item.sourcePath}`,
  componentType: "OTHER",
  categoryCd: "LAYOUT",
  iconNm: "widgets",
  defaultProps: { sourcePath: item.sourcePath, exportName: item.componentId },
  defaultClassNm: "",
  defaultStyle: { registrySource: "automatic" },
  dataAttrs: { "data-source-component": item.componentId },
  isContainer: false,
  isReusable: true,
  sortOrder: 1000 + index,
  useAt: "Y"
}));
store.components = [
  ...manualComponents.filter((item) => item.componentId !== "SOURCE_PAGE"),
  sourcePageComponent,
  ...generatedComponents
];

const existingScreens = new Map((store.screens || []).map((item) => [item.screenId, item]));
store.screens = routes.map((route) => {
  const screenId = `route-${route.routeId}`;
  const existing = existingScreens.get(screenId) || {};
  const now = new Date().toISOString();
  return {
    screenId,
    menuCode: existing.menuCode || route.routeId,
    pageId: route.routeId,
    menuNm: route.label,
    menuUrl: route.koPath,
    templateType: route.koPath.startsWith("/admin/") ? "admin" : "home",
    schemaVersion: "sdui.v1",
    runtimeMode: "source-backed",
    nodes: existing.nodes?.length ? existing.nodes : [{
      nodeId: `${screenId}-source-page`,
      componentId: "SOURCE_PAGE",
      parentNodeId: null,
      componentType: "OTHER",
      slotName: "content",
      sortOrder: 0,
      props: {
        sourcePath: route.effectiveSourcePath,
        exportName: route.effectiveExportName,
        routePath: route.koPath
      }
    }],
    events: existing.events || [],
    themeId: existing.themeId || "theme-default",
    customClasses: existing.customClasses || "",
    customStyles: existing.customStyles || "",
    status: existing.status || "PUBLISHED",
    version: existing.version || 1,
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
});
store.assets.routes = routeAssets;
store.assets.pages = pageAssets;
store.assets["source-components"] = sourceComponents;
store.assets.apis = apiAssets;
store.assets["database-migrations"] = dbAssets;
store.assets["system-page-checklist"] = pageAssets
  .filter((page) => page.routePath === "/admin/system" || page.routePath.startsWith("/admin/system/"))
  .map((page) => ({
    id: `SYSTEM_CHECK_${page.pageId}`,
    pageId: page.pageId,
    title: page.title,
    routePath: page.routePath,
    sourcePath: page.sourcePath,
    implementationStatus: page.status,
    checks: {
      routeRegistered: true,
      sourceRegistered: Boolean(page.sourcePath),
      hasDataBinding: page.capabilities.asyncData,
      hasFormAction: page.capabilities.form,
      hasGridOrTable: page.capabilities.table,
      sduiRegistered: true,
      runtimeVerified: false
    },
    normalizationStatus: ["implemented", "delegated"].includes(page.status) ? "STATIC_READY" : "REVIEW_REQUIRED"
  }));
store.assets["registry-summary"] = [{
  id: "SYSTEM_ASSET_REGISTRY_SUMMARY",
  generatedAt: new Date().toISOString(),
  routes: routeAssets.length,
  pages: pageAssets.length,
  sourceComponents: sourceComponents.length,
  apis: apiAssets.length,
  databaseMigrations: dbAssets.length,
  systemPages: store.assets["system-page-checklist"].length
}];

fs.mkdirSync(path.dirname(storePath), { recursive: true });
const temp = `${storePath}.next`;
fs.writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`);
fs.renameSync(temp, storePath);
console.log(JSON.stringify(store.assets["registry-summary"][0]));
