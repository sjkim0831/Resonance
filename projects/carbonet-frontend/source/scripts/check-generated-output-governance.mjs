import fs from "node:fs";
import path from "node:path";

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, "..");

const routeDefinitionsPath = path.join(frontendRoot, "src", "app", "routes", "definitions.ts");
const pageRegistryPath = path.join(frontendRoot, "src", "app", "routes", "pageRegistry.tsx");
const manifestPath = path.join(frontendRoot, "src", "app", "screen-registry", "pageManifests.ts");

const generatedRoots = [path.join(frontendRoot, "src", "features")];
const dynamicMenuCodePageIds = new Set(["repair-workbench"]);

const forbiddenPatterns = [
  {
    id: "frontend_raw_fetch",
    label: "raw fetch in generated frontend output",
    pattern: /\bfetch\s*\(/g,
    appliesTo: (file) => file.endsWith(".tsx") || file.endsWith(".ts")
  },
  {
    id: "frontend_raw_api_path",
    label: "hard-coded /api path in generated frontend output",
    pattern: /["'`]\/api\/[^"'`]+["'`]/g,
    appliesTo: (file) => file.endsWith(".tsx") || file.endsWith(".ts")
  },
  {
    id: "frontend_direct_navigation",
    label: "direct window.location navigation in generated frontend output",
    pattern: /\bwindow\.location\.href\s*=|\bwindow\.location\.(assign|replace)\s*\(/g,
    appliesTo: (file) => file.endsWith(".tsx") || file.endsWith(".ts")
  }
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile() && (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts"))) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseRoutes(routeSource) {
  const routePattern =
    /\{\s*id:\s*"([^"]+)",\s*label:\s*"[^"]*",\s*group:\s*"([^"]+)",\s*koPath:\s*"([^"]+)",\s*enPath:\s*"([^"]+)"\s*\}/g;
  const routes = new Map();
  for (const match of routeSource.matchAll(routePattern)) {
    routes.set(match[1], {
      id: match[1],
      group: match[2],
      koPath: match[3],
      enPath: match[4]
    });
  }
  return routes;
}

function parseSharedLoaders(source) {
  const result = new Map();
  const sharedLoaderPattern = /const\s+(\w+)\s*=\s*\(\)\s*=>\s*import\("([^"]+)"\);/g;
  for (const match of source.matchAll(sharedLoaderPattern)) {
    result.set(match[1], { importPath: match[2] });
  }
  return result;
}

function parsePageRegistry(source, sharedLoaders) {
  const result = new Map();
  const registryPattern = /"([^"]+)":\s*lazyNamed\(([\s\S]*?),\s*"([^"]+)"\)/g;
  for (const match of source.matchAll(registryPattern)) {
    const routeId = match[1];
    const loaderExpression = match[2].trim();
    let importPath = "";
    const directImport = /import\("([^"]+)"\)/.exec(loaderExpression);
    if (directImport) {
      importPath = directImport[1];
    } else {
      const sharedLoader = sharedLoaders.get(loaderExpression);
      if (sharedLoader) {
        importPath = sharedLoader.importPath;
      }
    }
    if (!importPath) {
      continue;
    }
    result.set(routeId, path.resolve(path.dirname(pageRegistryPath), `${importPath}.tsx`));
  }
  return result;
}

function parsePageManifests(source) {
  const manifests = new Map();
  const entryPattern = /"([^"]+)":\s*\{([\s\S]*?)\n\s*\},/g;
  for (const match of source.matchAll(entryPattern)) {
    const pageId = match[1];
    const block = match[2];
    manifests.set(pageId, {
      pageId,
      routePath: /routePath:\s*"([^"]+)"/.exec(block)?.[1] || "",
      menuCode: /menuCode:\s*"([^"]+)"/.exec(block)?.[1] || ""
    });
  }
  return manifests;
}

function relative(filePath) {
  return path.relative(repoRoot, filePath) || ".";
}

const issues = [];
const warnings = [];

const routes = parseRoutes(read(routeDefinitionsPath));
const sharedLoaders = parseSharedLoaders(read(pageRegistryPath));
const routeToFile = parsePageRegistry(read(pageRegistryPath), sharedLoaders);
const manifests = parsePageManifests(read(manifestPath));

for (const [pageId, manifest] of manifests) {
  if (!routes.has(pageId)) {
    issues.push(`Generated unit missing route registry binding for pageId "${pageId}"`);
  }
  if (!manifest.menuCode && !dynamicMenuCodePageIds.has(pageId)) {
    warnings.push(`Generated unit missing menuCode for pageId "${pageId}"`);
  }
  if (!manifest.routePath) {
    issues.push(`Generated unit missing routePath for pageId "${pageId}"`);
  }
  if (!routeToFile.has(pageId)) {
    issues.push(`Generated unit missing pageRegistry mapping for pageId "${pageId}"`);
  }
}

for (const file of generatedRoots.flatMap((dir) => walk(dir))) {
  const source = read(file);
  for (const rule of forbiddenPatterns) {
    if (!rule.appliesTo(file)) {
      continue;
    }
    const count = (source.match(rule.pattern) || []).length;
    if (count > 0) {
      issues.push(`${relative(file)} violates ${rule.id} (${rule.label}) x${count}`);
    }
  }
}

console.log(`Generated output governance audit: ${issues.length} issue(s), ${warnings.length} warning(s)`);

if (issues.length > 0) {
  console.log("\nIssues:");
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
}

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (issues.length === 0 && warnings.length === 0) {
  console.log("\nAll checked generated outputs satisfy the current thin-output governance baseline.");
}

process.exit(issues.length > 0 ? 1 : 0);
