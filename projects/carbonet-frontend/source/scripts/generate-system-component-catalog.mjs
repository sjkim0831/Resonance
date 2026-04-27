import fs from "fs";
import path from "path";
import ts from "typescript";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(frontendRoot, "src");
const featuresRoot = path.join(srcRoot, "features");
const routesDefinitionsPath = path.join(srcRoot, "app/routes/definitions.ts");
const pageRegistryPath = path.join(srcRoot, "app/routes/pageRegistry.tsx");
const outputPath = path.join(srcRoot, "generated/systemComponentCatalog.json");

const ROUTE_FOLDER_OVERRIDES = new Map([
  ["external-connection-add", "../external-connection-edit/"]
]);

/** @typedef {"button" | "input" | "select" | "textarea" | "table" | "pagination"} SystemComponentCatalogType */

/** @type {SystemComponentCatalogType[]} */
const SUPPORTED_TYPES = ["button", "input", "select", "textarea", "table", "pagination"];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readSource(filePath, scriptKind = ts.ScriptKind.TS) {
  return ts.createSourceFile(filePath, fs.readFileSync(filePath, "utf8"), ts.ScriptTarget.Latest, true, scriptKind);
}

function walk(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => walk(child, visitor));
}

function normalizeFeatureImportPath(value) {
  const trimmed = value.trim().replace(/^\.\.\/\.\.\/features\//, "../").replace(/^\.\.\/\.\.\//, "../");
  return trimmed.endsWith(".tsx") ? trimmed : `${trimmed}.tsx`;
}

function toFolderPath(value) {
  return normalizeFeatureImportPath(value).replace(/[^/]+\.tsx$/, "");
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

function stylePrefix(type) {
  switch (type) {
    case "button":
      return "BTN";
    case "input":
      return "INP";
    case "select":
      return "SEL";
    case "textarea":
      return "TXT";
    case "table":
      return "TBL";
    case "pagination":
      return "PGN";
    default:
      return "CMP";
  }
}

function getLiteralTextFromNode(node) {
  if (!node) {
    return "";
  }
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isJsxExpression(node)) {
    return getLiteralTextFromNode(node.expression);
  }
  if (ts.isTemplateExpression(node)) {
    if (!node.templateSpans.length) {
      return node.head.text;
    }
    return "";
  }
  if (ts.isParenthesizedExpression(node)) {
    return getLiteralTextFromNode(node.expression);
  }
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    return getLiteralTextFromNode(node.expression);
  }
  return "";
}

function getJsxAttributeValue(attrs, name) {
  const attr = attrs.properties.find((property) => ts.isJsxAttribute(property) && property.name.text === name);
  if (!attr || !ts.isJsxAttribute(attr)) {
    return "";
  }
  if (!attr.initializer) {
    return "true";
  }
  if (ts.isStringLiteral(attr.initializer)) {
    return attr.initializer.text;
  }
  if (ts.isJsxExpression(attr.initializer)) {
    return getLiteralTextFromNode(attr.initializer.expression);
  }
  return "";
}

function collectJsxChildrenText(children) {
  const parts = [];
  for (const child of children) {
    if (ts.isJsxText(child)) {
      const value = child.getText().replace(/\s+/g, " ").trim();
      if (value) {
        parts.push(value);
      }
      continue;
    }
    if (ts.isJsxExpression(child)) {
      const value = getLiteralTextFromNode(child.expression).replace(/\s+/g, " ").trim();
      if (value) {
        parts.push(value);
      }
      continue;
    }
    if (ts.isJsxElement(child)) {
      const value = collectJsxChildrenText(child.children);
      if (value) {
        parts.push(value);
      }
      continue;
    }
    if (ts.isJsxFragment(child)) {
      const value = collectJsxChildrenText(child.children);
      if (value) {
        parts.push(value);
      }
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function extractRouteDefinitions() {
  const sourceFile = readSource(routesDefinitionsPath, ts.ScriptKind.TS);
  const routes = new Map();
  walk(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node) || node.name.getText(sourceFile) !== "ROUTES" || !node.initializer || !ts.isArrayLiteralExpression(node.initializer)) {
      return;
    }
    for (const element of node.initializer.elements) {
      if (!ts.isObjectLiteralExpression(element)) {
        continue;
      }
      const route = { id: "", label: "", koPath: "", enPath: "" };
      for (const prop of element.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name) || !ts.isStringLiteralLike(prop.initializer)) {
          continue;
        }
        route[prop.name.text] = prop.initializer.text;
      }
      if (route.id) {
        routes.set(route.id, route);
      }
    }
  });
  return routes;
}

function parseLoaderImportPath(expression, sharedLoaders) {
  if (ts.isIdentifier(expression)) {
    return sharedLoaders.get(expression.text) || "";
  }
  if (!ts.isArrowFunction(expression) && !ts.isFunctionExpression(expression)) {
    return "";
  }
  let body = expression.body;
  if (ts.isBlock(body)) {
    const returnStatement = body.statements.find((statement) => ts.isReturnStatement(statement) && statement.expression);
    body = returnStatement?.expression;
  }
  if (body && ts.isCallExpression(body) && body.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const [firstArg] = body.arguments;
    if (firstArg && ts.isStringLiteralLike(firstArg)) {
      return firstArg.text;
    }
  }
  return "";
}

function extractRouteFolderMap() {
  const sourceFile = readSource(pageRegistryPath, ts.ScriptKind.TSX);
  const sharedLoaders = new Map();
  const routeFolderMap = new Map();

  walk(sourceFile, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const importPath = parseLoaderImportPath(node.initializer, sharedLoaders);
      if (importPath) {
        sharedLoaders.set(node.name.text, importPath);
      }
    }
  });

  walk(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node) || node.name.getText(sourceFile) !== "pageComponents" || !node.initializer || !ts.isObjectLiteralExpression(node.initializer)) {
      return;
    }
    for (const property of node.initializer.properties) {
      if (!ts.isPropertyAssignment(property)) {
        continue;
      }
      const routeId = ts.isStringLiteralLike(property.name) ? property.name.text : "";
      if (!routeId || !ts.isCallExpression(property.initializer)) {
        continue;
      }
      const [loaderArg] = property.initializer.arguments;
      const importPath = loaderArg ? parseLoaderImportPath(loaderArg, sharedLoaders) : "";
      if (importPath) {
        routeFolderMap.set(routeId, toFolderPath(importPath));
      }
    }
  });

  for (const [routeId, folderPath] of ROUTE_FOLDER_OVERRIDES.entries()) {
    if (routeFolderMap.has(routeId)) {
      routeFolderMap.set(routeId, folderPath);
    }
  }

  return routeFolderMap;
}

function detectComponentType(tagName) {
  switch (tagName) {
    case "MemberButton":
    case "MemberLinkButton":
    case "MemberPermissionButton":
    case "MemberIconButton":
      return "button";
    case "input":
      return "input";
    case "select":
      return "select";
    case "textarea":
      return "textarea";
    case "table":
      return "table";
    case "MemberPagination":
      return "pagination";
    default:
      return "";
  }
}

function collectComponentUsages(filePath, routeFolderMap, routeMap) {
  const relativeModulePath = `../${path.relative(featuresRoot, filePath).replace(/\\/g, "/")}`;
  if (relativeModulePath.includes("/screen-builder/") || relativeModulePath.includes("/admin-ui/") || relativeModulePath.endsWith("/common.tsx")) {
    return [];
  }
  const matchingRoutes = Array.from(routeFolderMap.entries())
    .filter(([, folder]) => relativeModulePath.startsWith(folder))
    .map(([routeId]) => routeId)
    .map((routeId) => routeMap.get(routeId))
    .filter(Boolean);
  if (!matchingRoutes.length) {
    return [];
  }

  const sourceFile = readSource(filePath, ts.ScriptKind.TSX);
  const usages = [];

  walk(sourceFile, (node) => {
    const opening = ts.isJsxSelfClosingElement(node)
      ? node
      : ts.isJsxElement(node)
        ? node.openingElement
        : null;
    if (!opening) {
      return;
    }
    const tagName = opening.tagName.getText(sourceFile);
    const componentType = detectComponentType(tagName);
    if (!componentType || !SUPPORTED_TYPES.includes(componentType)) {
      return;
    }
    const attrs = opening.attributes;
    const variant = getJsxAttributeValue(attrs, "variant");
    const size = getJsxAttributeValue(attrs, "size");
    const className = getJsxAttributeValue(attrs, "className");
    const icon = getJsxAttributeValue(attrs, "icon");
    const placeholder = getJsxAttributeValue(attrs, "placeholder");
    const label = ts.isJsxElement(node) ? collectJsxChildrenText(node.children) : "";
    const summary = [variant, size, className, icon, placeholder].filter(Boolean).join(" / ");

    for (const route of matchingRoutes) {
      usages.push({
        route,
        componentType,
        componentName: tagName,
        variant,
        size,
        className,
        icon,
        label,
        placeholder,
        summary
      });
    }
  });

  return usages;
}

function walkFiles(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, result);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".tsx")) {
      result.push(fullPath);
    }
  }
  return result;
}

function buildCatalog() {
  const routeMap = extractRouteDefinitions();
  const routeFolderMap = extractRouteFolderMap();
  const entries = new Map();
  const files = walkFiles(featuresRoot);

  for (const filePath of files) {
    const usages = collectComponentUsages(filePath, routeFolderMap, routeMap);
    for (const usage of usages) {
      const key = [
        usage.componentType,
        usage.componentName,
        usage.variant,
        usage.size,
        usage.className,
        usage.icon,
        usage.placeholder
      ].join(":");
      const current = entries.get(key) || {
        key,
        styleGroupId: "",
        componentType: usage.componentType,
        componentName: usage.componentName,
        variant: usage.variant,
        size: usage.size,
        className: usage.className,
        icon: usage.icon,
        placeholder: usage.placeholder,
        summary: usage.summary,
        routes: new Map(),
        instances: []
      };
      current.routes.set(usage.route.id, {
        routeId: usage.route.id,
        label: usage.route.label,
        koPath: usage.route.koPath,
        enPath: usage.route.enPath
      });
      current.instances.push({
        route: {
          routeId: usage.route.id,
          label: usage.route.label,
          koPath: usage.route.koPath,
          enPath: usage.route.enPath
        },
        componentType: usage.componentType,
        componentName: usage.componentName,
        variant: usage.variant,
        size: usage.size,
        className: usage.className,
        icon: usage.icon,
        label: usage.label,
        placeholder: usage.placeholder,
        summary: usage.summary
      });
      entries.set(key, current);
    }
  }

  return Array.from(entries.values())
    .map((entry) => ({
      key: entry.key,
      styleGroupId: `${stylePrefix(entry.componentType)}-${slugify(`${entry.componentName}-${entry.variant || "plain"}-${entry.size || "md"}-${entry.className || "plain"}-${entry.placeholder || "noplace"}`)}`,
      componentType: entry.componentType,
      componentName: entry.componentName,
      variant: entry.variant,
      size: entry.size,
      className: entry.className,
      icon: entry.icon,
      placeholder: entry.placeholder,
      summary: entry.summary,
      routeCount: entry.routes.size,
      instanceCount: entry.instances.length,
      labels: Array.from(new Set(entry.instances.map((item) => item.label || item.placeholder).filter(Boolean))).slice(0, 6),
      routes: Array.from(entry.routes.values()).sort((left, right) => left.koPath.localeCompare(right.koPath)),
      instances: entry.instances
    }))
    .sort((left, right) =>
      right.instanceCount - left.instanceCount ||
      right.routeCount - left.routeCount ||
      left.componentType.localeCompare(right.componentType) ||
      left.componentName.localeCompare(right.componentName) ||
      left.className.localeCompare(right.className)
    );
}

ensureDir(outputPath);
const catalog = buildCatalog();
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`[generate-system-component-catalog] wrote ${catalog.length} style groups to ${outputPath}`);
