#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(process.argv[2] || process.cwd());
const requireFromFrontend = createRequire(path.join(root, "frontend/package.json"));
const postcss = requireFromFrontend("postcss");
const outPath = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : `/tmp/css-ast-theme-registry-${Date.now()}.sql`;
const scanBatchId = `css-ast-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}`;
const projectId = "carbonet";
const cssRoots = [
  "frontend/src",
  "frontend/src/styles.css",
  "apps/carbonet-api/src/main/resources/static/react-app"
].map((item) => path.join(root, item));
const usageRoots = [
  "frontend/src"
].map((item) => path.join(root, item));
const excludedParts = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}target${path.sep}`,
  `${path.sep}.git${path.sep}`,
  `${path.sep}assets${path.sep}`
];

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function idFor(prefix, ...parts) {
  const digest = sha(parts.join("|")).slice(0, 24);
  const label = String(parts[parts.length - 1] || prefix)
    .replace(/[^0-9A-Za-z가-힣_-]+/g, "-")
    .slice(0, 90)
    .replace(/-+$/g, "");
  return `${prefix}-${label}-${digest}`.slice(0, 180);
}

function sqlLit(value, limit = 3900) {
  const text = String(value ?? "").replace(/\r/g, " ").replace(/\0/g, "").slice(0, limit);
  return `'${text.replace(/'/g, "''")}'`;
}

function walkFiles(start, extensions) {
  const files = [];
  if (!fs.existsSync(start)) return files;
  const stat = fs.statSync(start);
  if (stat.isFile()) {
    if (extensions.has(path.extname(start).toLowerCase()) && !shouldSkip(start)) files.push(start);
    return files;
  }
  for (const entry of fs.readdirSync(start)) {
    const full = path.join(start, entry);
    if (shouldSkip(full)) continue;
    const childStat = fs.statSync(full);
    if (childStat.isDirectory()) {
      files.push(...walkFiles(full, extensions));
    } else if (extensions.has(path.extname(full).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

function shouldSkip(filePath) {
  const normalized = path.normalize(filePath);
  return excludedParts.some((part) => normalized.includes(part));
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function selectorKind(selector) {
  if (selector.includes(":root")) return "ROOT_TOKEN_SCOPE";
  if (selector.includes(".gov-")) return "GOV_COMPONENT";
  if (selector.includes(".admin-")) return "ADMIN_COMPONENT";
  if (selector.includes(".material-symbols")) return "ICON";
  if (selector.includes("@")) return "AT_RULE";
  if (selector.includes(":")) return "STATE_OR_PSEUDO";
  if (selector.includes("[")) return "ATTRIBUTE";
  return "GENERAL";
}

function tokenGroup(prop, value) {
  const name = String(prop || "").toLowerCase();
  const raw = String(value || "").toLowerCase();
  if (name.startsWith("--")) {
    if (name.includes("color") || raw.includes("#") || raw.includes("rgb")) return "color";
    if (name.includes("space") || name.includes("gap") || name.includes("padding") || name.includes("margin")) return "spacing";
    if (name.includes("radius")) return "radius";
    if (name.includes("font") || name.includes("text")) return "typography";
    return "custom-property";
  }
  if (["color", "background", "background-color", "border-color", "outline-color", "box-shadow"].includes(name)) return "color";
  if (name.includes("padding") || name.includes("margin") || name === "gap" || name.includes("inset")) return "spacing";
  if (name.includes("radius")) return "radius";
  if (name.includes("font") || name.includes("line-height") || name.includes("letter-spacing")) return "typography";
  if (name.includes("width") || name.includes("height") || name.includes("grid") || name.includes("flex")) return "layout";
  return "";
}

function classNamesFromSelector(selector) {
  const names = new Set();
  for (const match of selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
    names.add(`.${match[1]}`);
  }
  return [...names];
}

function extractCssRows(cssFiles) {
  const stylesheets = [];
  const selectors = [];
  const declarations = [];
  const cssClassNames = new Set();
  for (const file of cssFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relative = rel(file);
    const stylesheetId = idFor("csssheet", scanBatchId, relative);
    let ruleCount = 0;
    let declarationCount = 0;
    const rootNode = postcss.parse(source, { from: file });
    rootNode.walkRules((rule) => {
      ruleCount += 1;
      const selectorText = rule.selector || "";
      const selectorId = idFor("csssel", scanBatchId, relative, selectorText, rule.source?.start?.line || 0);
      const decls = [];
      for (const node of rule.nodes || []) {
        if (node.type === "decl") decls.push(node);
      }
      for (const className of classNamesFromSelector(selectorText)) {
        cssClassNames.add(className);
      }
      selectors.push({
        selectorId,
        stylesheetId,
        sourcePath: relative,
        selectorText,
        selectorKind: selectorKind(selectorText),
        ruleContext: parentAtRuleContext(rule),
        declarationCount: decls.length,
        firstLine: rule.source?.start?.line || 0
      });
      for (const decl of decls) {
        declarationCount += 1;
        const tokenName = decl.prop.startsWith("--") ? decl.prop : "";
        declarations.push({
          declarationId: idFor("cssdecl", scanBatchId, relative, selectorText, decl.prop, decl.source?.start?.line || 0),
          selectorId,
          stylesheetId,
          sourcePath: relative,
          selectorText,
          propertyName: decl.prop,
          propertyValue: decl.value,
          tokenName,
          tokenGroup: tokenGroup(decl.prop, decl.value),
          firstLine: decl.source?.start?.line || 0
        });
      }
    });
    stylesheets.push({
      stylesheetId,
      sourcePath: relative,
      ruleCount,
      declarationCount,
      contentHash: sha(source)
    });
  }
  return { stylesheets, selectors, declarations, cssClassNames };
}

function parentAtRuleContext(rule) {
  const parts = [];
  let node = rule.parent;
  while (node) {
    if (node.type === "atrule") parts.unshift(`@${node.name} ${node.params || ""}`.trim());
    node = node.parent;
  }
  return parts.join(" > ");
}

function extractUsageRows(usageFiles, cssClassNames) {
  const rows = [];
  const classList = [...cssClassNames].filter((name) => name.length > 1);
  for (const file of usageFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relative = rel(file);
    const lines = source.split(/\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const selectorText of classList) {
        const className = selectorText.slice(1);
        if (!line.includes(className)) continue;
        rows.push({
          usageId: idFor("cssuse", scanBatchId, relative, selectorText, i + 1),
          selectorText,
          usageKind: file.endsWith(".tsx") || file.endsWith(".jsx") ? "REACT_CLASS_USAGE" : "SOURCE_TEXT_USAGE",
          sourcePath: relative,
          lineNo: i + 1,
          usageContext: line.trim().slice(0, 1000)
        });
        if (rows.length >= 5000) return rows;
      }
    }
  }
  return rows;
}

function insertSelect(table, columns, values, keyColumn, keyValue) {
  return `INSERT INTO ${table} (${columns.join(", ")}) SELECT ${values.join(", ")} FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE ${keyColumn} = ${sqlLit(keyValue)});`;
}

function buildSql(rows) {
  const statements = [
    `UPDATE system_css_ast_stylesheet_registry SET active_yn='N' WHERE project_id='${projectId}';`,
    `UPDATE system_css_selector_registry SET active_yn='N' WHERE project_id='${projectId}';`,
    `UPDATE system_css_declaration_registry SET active_yn='N' WHERE project_id='${projectId}';`,
    `UPDATE system_css_usage_registry SET active_yn='N' WHERE project_id='${projectId}';`
  ];
  for (const row of rows.stylesheets) {
    statements.push(insertSelect(
      "system_css_ast_stylesheet_registry",
      ["stylesheet_id", "project_id", "scan_batch_id", "source_path", "parser_name", "rule_count", "declaration_count", "content_hash"],
      [sqlLit(row.stylesheetId, 180), sqlLit(projectId), sqlLit(scanBatchId), sqlLit(row.sourcePath, 1000), "'postcss'", String(row.ruleCount), String(row.declarationCount), sqlLit(row.contentHash, 80)],
      "stylesheet_id",
      row.stylesheetId
    ));
  }
  for (const row of rows.selectors) {
    statements.push(insertSelect(
      "system_css_selector_registry",
      ["selector_id", "project_id", "scan_batch_id", "stylesheet_id", "source_path", "selector_text", "selector_kind", "rule_context", "declaration_count", "first_line"],
      [sqlLit(row.selectorId, 180), sqlLit(projectId), sqlLit(scanBatchId), sqlLit(row.stylesheetId, 180), sqlLit(row.sourcePath, 1000), sqlLit(row.selectorText, 1000), sqlLit(row.selectorKind, 80), sqlLit(row.ruleContext, 1000), String(row.declarationCount), String(row.firstLine)],
      "selector_id",
      row.selectorId
    ));
  }
  for (const row of rows.declarations) {
    statements.push(insertSelect(
      "system_css_declaration_registry",
      ["declaration_id", "project_id", "scan_batch_id", "selector_id", "stylesheet_id", "source_path", "selector_text", "property_name", "property_value", "token_name", "token_group", "first_line"],
      [sqlLit(row.declarationId, 180), sqlLit(projectId), sqlLit(scanBatchId), sqlLit(row.selectorId, 180), sqlLit(row.stylesheetId, 180), sqlLit(row.sourcePath, 1000), sqlLit(row.selectorText, 1000), sqlLit(row.propertyName, 160), sqlLit(row.propertyValue, 1200), sqlLit(row.tokenName, 180), sqlLit(row.tokenGroup, 80), String(row.firstLine)],
      "declaration_id",
      row.declarationId
    ));
  }
  for (const row of rows.usages) {
    statements.push(insertSelect(
      "system_css_usage_registry",
      ["usage_id", "project_id", "scan_batch_id", "selector_text", "usage_kind", "source_path", "line_no", "usage_context"],
      [sqlLit(row.usageId, 180), sqlLit(projectId), sqlLit(scanBatchId), sqlLit(row.selectorText, 1000), sqlLit(row.usageKind, 80), sqlLit(row.sourcePath, 1000), String(row.lineNo), sqlLit(row.usageContext, 1000)],
      "usage_id",
      row.usageId
    ));
  }
  statements.push("COMMIT;");
  return `${statements.join("\n")}\n`;
}

const cssFiles = [...new Set(cssRoots.flatMap((item) => walkFiles(item, new Set([".css", ".scss"]))))].sort();
const usageFiles = [...new Set(usageRoots.flatMap((item) => walkFiles(item, new Set([".tsx", ".ts", ".jsx", ".js"]))))].sort();
const parsed = extractCssRows(cssFiles);
const usages = extractUsageRows(usageFiles, parsed.cssClassNames);
const rows = { ...parsed, usages };
fs.writeFileSync(outPath, buildSql(rows), "utf8");
console.log(JSON.stringify({
  sqlPath: outPath,
  scanBatchId,
  stylesheets: rows.stylesheets.length,
  selectors: rows.selectors.length,
  declarations: rows.declarations.length,
  cssClassNames: rows.cssClassNames.size,
  usages: rows.usages.length
}, null, 2));
