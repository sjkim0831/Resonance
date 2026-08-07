#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback = "") => {
  const inline = args.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")
    ? args[index + 1]
    : fallback;
};

const repoRoot = path.resolve(option("--repo-root", path.join(scriptDir, "../..")));
const frontendRoot = path.resolve(
  option("--frontend-root", path.join(repoRoot, "projects/carbonet-frontend/source")),
);
const sourceRoot = path.join(frontendRoot, "src");
const format = option("--format", "json").toLowerCase();
const outFile = option("--out");
const requireFromFrontend = createRequire(path.join(frontendRoot, "package.json"));
const ts = requireFromFrontend("typescript");

function collectFamilyFiles(directory, target = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFamilyFiles(absolute, target);
    else if (/Family\.ts$/.test(entry.name)) target.push(absolute);
  }
  return target;
}

function literalValue(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function routeObject(node) {
  if (!ts.isObjectLiteralExpression(node)) return null;
  const values = new Map();
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name =
      ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
        ? property.name.text
        : null;
    if (["id", "label", "koPath", "enPath", "sourcePath"].includes(name)) {
      values.set(name, literalValue(property.initializer));
    }
  }
  return values.get("id") && values.get("koPath") && values.get("enPath")
    ? Object.fromEntries(values)
    : null;
}

function canonicalRoute(value) {
  const raw = String(value || "").split(/[?#]/, 1)[0].trim();
  const localized = /^\/en$/i.test(raw) ? "/" : raw.replace(/^\/en(?=\/)/i, "");
  const normalized = localized === "/" ? "/" : localized.replace(/\/+$/, "");
  return (normalized || "/").toLowerCase();
}

function assertUnique(rows, property, label) {
  const owners = new Map();
  const failures = [];
  for (const row of rows) {
    const key = row[property];
    const previous = owners.get(key);
    if (previous && previous.owner !== row.owner) {
      failures.push(`${label} '${key}' first=${previous.owner} again=${row.owner}`);
    } else owners.set(key, row);
  }
  if (failures.length) throw new Error(failures.join("\n"));
}

function ownerPriority(row) {
  return (
    (row.routeId.startsWith("auto-") ? 0 : 100) +
    (row.label && row.label !== row.routeId ? 10 : 0) +
    (row.koPath === canonicalRoute(row.koPath) ? 1 : 0)
  );
}

const rawRoutes = [];
for (const file of collectFamilyFiles(sourceRoot).sort()) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function visit(node) {
    const route = routeObject(node);
    if (route) {
      const position = source.getLineAndCharacterOfPosition(node.getStart(source));
      const familyFile = path.relative(frontendRoot, file).replaceAll(path.sep, "/");
      rawRoutes.push({
        routeId: route.id,
        label: route.label || route.id,
        koPath: route.koPath,
        enPath: route.enPath,
        sourcePath: route.sourcePath || "",
        familyFile,
        owner: `${familyFile}:${position.line + 1}`,
        routeKey: canonicalRoute(route.koPath),
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

assertUnique(rawRoutes, "routeId", "Duplicate route id");
assertUnique(rawRoutes, "koPath", "Duplicate Korean route path");
assertUnique(rawRoutes, "enPath", "Duplicate English route path");

const grouped = new Map();
for (const route of rawRoutes) {
  if (!grouped.has(route.routeKey)) grouped.set(route.routeKey, []);
  grouped.get(route.routeKey).push(route);
}

const routes = [...grouped.entries()]
  .map(([routeKey, aliases]) => {
    const sorted = [...aliases].sort(
      (left, right) => ownerPriority(right) - ownerPriority(left) || left.owner.localeCompare(right.owner),
    );
    const primary = sorted[0];
    return {
      routeKey,
      routeId: primary.routeId,
      label: primary.label,
      familyFile: primary.familyFile,
      sourcePath: primary.sourcePath,
      koPath: primary.koPath,
      enPath: primary.enPath,
      aliases: sorted.map(({ routeId, koPath, enPath, owner }) => ({ routeId, koPath, enPath, owner })),
    };
  })
  .sort((left, right) => left.routeKey.localeCompare(right.routeKey));

const collisions = routes.filter((route) => route.aliases.length > 1);
const registry = {
  schemaVersion: "1.0.0",
  source: "TYPESCRIPT_ROUTE_FAMILY_AST",
  generatedAt: new Date().toISOString(),
  frontendRoot,
  familyFileCount: new Set(rawRoutes.map((route) => route.familyFile)).size,
  rawRouteCount: rawRoutes.length,
  canonicalRouteCount: routes.length,
  canonicalCollisionCount: collisions.length,
  canonicalCollisions: collisions.map(({ routeKey, aliases }) => ({ routeKey, aliases })),
  routes,
};

const sqlLiteral = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;
let output;
if (format === "sql-values") {
  output = routes
    .map((route) =>
      `(${[
        sqlLiteral(route.routeKey),
        sqlLiteral(route.routeId),
        sqlLiteral(route.label),
        sqlLiteral(route.familyFile),
        sqlLiteral(route.sourcePath),
        sqlLiteral(route.koPath),
        sqlLiteral(route.enPath),
        `${sqlLiteral(JSON.stringify(route.aliases))}::jsonb`,
      ].join(",")})`,
    )
    .join(",\n");
} else if (format === "summary") {
  output = JSON.stringify(
    {
      familyFileCount: registry.familyFileCount,
      rawRouteCount: registry.rawRouteCount,
      canonicalRouteCount: registry.canonicalRouteCount,
      canonicalCollisionCount: registry.canonicalCollisionCount,
    },
    null,
    2,
  );
} else if (format === "json") {
  output = JSON.stringify(registry, null, 2);
} else {
  throw new Error(`Unsupported --format: ${format}`);
}

if (outFile) {
  const absolute = path.resolve(outFile);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${output}\n`, "utf8");
  if (fs.existsSync(absolute) && fs.readFileSync(absolute, "utf8") === `${output}\n`) {
    fs.unlinkSync(temporary);
  } else fs.renameSync(temporary, absolute);
} else process.stdout.write(`${output}\n`);

process.stderr.write(
  `[frontend-route-registry] raw=${registry.rawRouteCount} canonical=${registry.canonicalRouteCount} ` +
    `families=${registry.familyFileCount} collisions=${registry.canonicalCollisionCount}\n`,
);
