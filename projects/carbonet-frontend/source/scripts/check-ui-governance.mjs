import fs from "node:fs";
import path from "node:path";

const frontendRoot = process.cwd();
const srcRoot = path.join(frontendRoot, "src");
const repoRoot = path.resolve(frontendRoot, "..");

const manifestPath = path.join(srcRoot, "platform", "screen-registry", "pageManifests.ts");
const helpContentPath = path.join(srcRoot, "platform", "screen-registry", "helpContent.ts");
const helpJsonPath = path.join(repoRoot, "src", "main", "resources", "help", "page-help.json");
const screenCommandPath = path.join(
  repoRoot,
  "src",
  "main",
  "java",
  "egovframework",
  "com",
  "feature",
  "admin",
  "service",
  "impl",
  "ScreenCommandCenterServiceImpl.java"
);
const routeSourceRoots = [
  path.join(srcRoot, "app", "routes"),
  path.join(srcRoot, "features"),
  path.join(srcRoot, "platform", "routes")
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listSourceFiles(baseDir) {
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  const results = [];
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const resolved = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(resolved);
        continue;
      }
      if (entry.isFile() && (resolved.endsWith(".ts") || resolved.endsWith(".tsx"))) {
        results.push(resolved);
      }
    }
  }
  walk(baseDir);
  return results;
}

function parseRoutes(routeSources) {
  const routePattern =
    /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*group:\s*"([^"]+)",\s*koPath:\s*"([^"]+)",\s*enPath:\s*"([^"]+)"\s*\}/g;
  const routes = new Map();
  for (const routeSource of routeSources) {
    for (const match of routeSource.matchAll(routePattern)) {
      routes.set(match[1], {
        id: match[1],
        label: match[2],
        group: match[3],
        koPath: match[4],
        enPath: match[5]
      });
    }
  }
  return routes;
}

function parseSharedLoaders(source) {
  const result = new Map();
  const sharedLoaderPattern = /const\s+(\w+)\s*=\s*\(\)\s*=>\s*import\("([^"]+)"\);/g;
  for (const match of source.matchAll(sharedLoaderPattern)) {
    result.set(match[1], {
      importPath: match[2],
      exportName: ""
    });
  }
  return result;
}

function parsePageRegistry(sources) {
  const result = new Map();
  const registryPattern = /\{\s*id:\s*"([^"]+)",\s*exportName:\s*"([^"]+)",\s*loader:\s*([^}\n]+?)\s*\}/g;
  for (const { filePath, source } of sources) {
    const sharedLoaders = parseSharedLoaders(source);
    for (const match of source.matchAll(registryPattern)) {
      const routeId = match[1];
      const exportName = match[2];
      const loaderExpression = match[3].trim().replace(/,$/, "");
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
      const resolvedImport = resolveLocalImport(filePath, importPath);
      if (!resolvedImport) {
        continue;
      }
      result.set(routeId, {
        sourceFile: resolvedImport,
        exportName
      });
    }
  }
  return result;
}

function parsePageManifests(source) {
  const manifests = new Map();
  const entryPattern = /"([^"]+)":\s*\{([\s\S]*?)\n\s*\},/g;
  for (const match of source.matchAll(entryPattern)) {
    const pageId = match[1];
    const block = match[2];
    const routePath = /routePath:\s*"([^"]+)"/.exec(block)?.[1] || "";
    const componentKeys = [...block.matchAll(/instanceKey:\s*"([^"]+)"/g)].map((item) => item[1]);
    manifests.set(pageId, { pageId, routePath, componentKeys });
  }
  return manifests;
}

function parseHelpContent(source) {
  const entries = new Map();
  const pagePattern = /"([^"]+)":\s*\{([\s\S]*?)\n\s*\},/g;
  for (const match of source.matchAll(pagePattern)) {
    const pageId = match[1];
    const block = match[2];
    const anchors = [...block.matchAll(/anchorSelector:\s*'\[data-help-id="([^"]+)"\]'/g)].map((item) => item[1]);
    if (anchors.length > 0) {
      entries.set(pageId, anchors);
    }
  }
  return entries;
}

function parseHelpJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return new Map();
  }
  const parsed = JSON.parse(read(filePath));
  const entries = new Map();
  for (const [pageId, entry] of Object.entries(parsed)) {
    const anchors = (entry.items || [])
      .map((item) => item.anchorSelector)
      .filter(Boolean)
      .map((value) => /\[data-help-id="([^"]+)"\]/.exec(value)?.[1])
      .filter(Boolean);
    if (anchors.length > 0) {
      entries.set(pageId, anchors);
    }
  }
  return entries;
}

function parseScreenCommandIds(source) {
  const pageOptions = new Set([...source.matchAll(/pageOption\("([^"]+)"/g)].map((match) => match[1]));
  for (const match of source.matchAll(/addStaticPageOption\([^,]+,[^,]+,\s*"([^"]+)"/g)) {
    pageOptions.add(match[1]);
  }
  return {
    pageOptions,
    buildCases: new Set([...source.matchAll(/case\s+"([^"]+)":/g)].map((match) => match[1])),
    supportsDraftFallback: source.includes("return buildRegistryDraftPage(pageId);")
  };
}

function parseHelpIds(source) {
  const helpIds = new Set([
    ...source.matchAll(/data-help-id=["{]?"([^"]+)"/g),
    ...source.matchAll(/dataHelpId=["{]?"([^"]+)"/g)
  ].map((match) => match[1]));
  const dynamicExternalConnectionHelpIds = [
    ...source.matchAll(/data-help-id=\{helpId\(mode,\s*"([^"]+)"\)\}/g),
    ...source.matchAll(/dataHelpId=\{helpId\(mode,\s*"([^"]+)"\)\}/g)
  ].map((match) => match[1]);
  for (const suffix of dynamicExternalConnectionHelpIds) {
    helpIds.add(`external-connection-add-${suffix}`);
    helpIds.add(`external-connection-edit-${suffix}`);
  }
  return helpIds;
}

function resolveLocalImport(fromFile, importPath) {
  const basePath = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [
    `${basePath}.tsx`,
    `${basePath}.ts`,
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.ts")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function collectHelpIds(filePath, visited = new Set()) {
  if (!filePath || visited.has(filePath) || !fs.existsSync(filePath)) {
    return new Set();
  }
  visited.add(filePath);
  const source = read(filePath);
  const helpIds = parseHelpIds(source);
  const importPattern = /import[\s\S]*?from\s+"(\.[^"]+)";/g;
  for (const match of source.matchAll(importPattern)) {
    const resolved = resolveLocalImport(filePath, match[1]);
    if (!resolved) {
      continue;
    }
    for (const id of collectHelpIds(resolved, visited)) {
      helpIds.add(id);
    }
  }
  const exportPattern = /export[\s\S]*?from\s+"(\.[^"]+)";/g;
  for (const match of source.matchAll(exportPattern)) {
    const resolved = resolveLocalImport(filePath, match[1]);
    if (!resolved) {
      continue;
    }
    for (const id of collectHelpIds(resolved, visited)) {
      helpIds.add(id);
    }
  }
  return helpIds;
}

function relative(filePath) {
  return path.relative(frontendRoot, filePath) || ".";
}

function classifyIssue(message) {
  if (message.startsWith("Route mismatch")) {
    return "manifest-drift";
  }
  if (message.startsWith("Missing data-help-id=") || message.startsWith("helpContent anchor ") || message.startsWith("page-help.json anchor ")) {
    return "help-marker-drift";
  }
  if (message.startsWith("ScreenCommandCenter ")) {
    return "backend-metadata-drift";
  }
  if (message.startsWith("No component mapping found") || message.startsWith("Component source missing")) {
    return "page-module-drift";
  }
  return "other";
}

function classifyWarning(message) {
  if (message.includes("has no page manifest yet")) {
    return "missing-manifest";
  }
  if (message.includes("has no component instance keys")) {
    return "empty-manifest";
  }
  return "other";
}

function summarizeByCategory(messages, classifier) {
  const summary = new Map();
  for (const message of messages) {
    const category = classifier(message);
    summary.set(category, (summary.get(category) || 0) + 1);
  }
  return [...summary.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

const manifestSource = read(manifestPath);
const helpContentSource = read(helpContentPath);
const screenCommandSource = read(screenCommandPath);
const routeSourceFiles = routeSourceRoots.flatMap((root) => listSourceFiles(root));
const routeSources = routeSourceFiles.map((filePath) => ({ filePath, source: read(filePath) }));

const routes = parseRoutes(routeSources.map((entry) => entry.source));
const routeToFile = parsePageRegistry(routeSources);
const manifests = parsePageManifests(manifestSource);
const helpContent = parseHelpContent(helpContentSource);
const helpJson = parseHelpJson(helpJsonPath);
const screenCommand = parseScreenCommandIds(screenCommandSource);

const issues = [];
const warnings = [];

for (const [routeId, route] of routes) {
  if (!manifests.has(routeId)) {
    warnings.push(`Route "${routeId}" (${route.koPath}) has no page manifest yet`);
  }
}

for (const [pageId, manifest] of manifests) {
  const route = routes.get(pageId);
  if (!route) {
    issues.push(`Manifest page "${pageId}" is not present in definitions.ts ROUTES`);
    continue;
  }
  if (manifest.routePath && route.koPath !== manifest.routePath) {
    issues.push(
      `Route mismatch for "${pageId}": definitions.ts=${route.koPath}, pageManifests.ts=${manifest.routePath}`
    );
  }
  if (!screenCommand.pageOptions.has(pageId) && !screenCommand.supportsDraftFallback) {
    issues.push(`ScreenCommandCenter page option missing for "${pageId}"`);
  }
  if (!screenCommand.buildCases.has(pageId) && !screenCommand.supportsDraftFallback) {
    issues.push(`ScreenCommandCenter build case missing for "${pageId}"`);
  }

  const sourceFile = routeToFile.get(pageId);
  if (!sourceFile) {
    issues.push(`No component mapping found in pageRegistry.tsx for "${pageId}"`);
    continue;
  }
  if (!fs.existsSync(sourceFile.sourceFile)) {
    issues.push(`Component source missing for "${pageId}": ${relative(sourceFile.sourceFile)}`);
    continue;
  }

  const helpIds = collectHelpIds(sourceFile.sourceFile);
  for (const key of manifest.componentKeys) {
    if (!helpIds.has(key)) {
      issues.push(
        `Missing data-help-id="${key}" in ${relative(sourceFile.sourceFile)} for manifest page "${pageId}"`
      );
    }
  }

  const helpAnchors = helpContent.get(pageId) || [];
  for (const anchor of helpAnchors) {
    if (!helpIds.has(anchor)) {
      issues.push(
        `helpContent anchor "${anchor}" not found in ${relative(sourceFile.sourceFile)} for page "${pageId}"`
      );
    }
  }

  const helpJsonAnchors = helpJson.get(pageId) || [];
  for (const anchor of helpJsonAnchors) {
    if (!helpIds.has(anchor)) {
      issues.push(
        `page-help.json anchor "${anchor}" not found in ${relative(sourceFile.sourceFile)} for page "${pageId}"`
      );
    }
  }

  if (manifest.componentKeys.length === 0) {
    warnings.push(`Manifest page "${pageId}" has no component instance keys`);
  }
}

for (const [pageId] of helpContent) {
  if (!manifests.has(pageId)) {
    warnings.push(`helpContent page "${pageId}" has no page manifest yet`);
  }
}

for (const [pageId] of helpJson) {
  if (!manifests.has(pageId)) {
    warnings.push(`page-help.json page "${pageId}" has no page manifest yet`);
  }
}

const header = `UI governance audit: ${issues.length} issue(s), ${warnings.length} warning(s)`;
console.log(header);

const issueSummary = summarizeByCategory(issues, classifyIssue);
const warningSummary = summarizeByCategory(warnings, classifyWarning);

if (issueSummary.length > 0 || warningSummary.length > 0) {
  console.log("\nCategory summary:");
  for (const [category, count] of issueSummary) {
    console.log(`- issue:${category}=${count}`);
  }
  for (const [category, count] of warningSummary) {
    console.log(`- warning:${category}=${count}`);
  }
}

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
  console.log("\nAll checked routes currently satisfy the UI governance baseline.");
}

process.exit(issues.length > 0 ? 1 : 0);
