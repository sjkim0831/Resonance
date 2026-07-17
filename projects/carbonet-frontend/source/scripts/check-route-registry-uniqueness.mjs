import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const srcRoot = path.resolve("src");
const familyFiles = [];

async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else if (/Family\.ts$/.test(entry.name)) familyFiles.push(absolute);
  }
}

function literalValue(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function objectRoute(node) {
  if (!ts.isObjectLiteralExpression(node)) return null;
  const values = new Map();
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;
    if (name === "id" || name === "koPath" || name === "enPath") values.set(name, literalValue(property.initializer));
  }
  return values.get("id") && values.get("koPath") && values.get("enPath")
    ? { id: values.get("id"), koPath: values.get("koPath"), enPath: values.get("enPath") }
    : null;
}

await collect(srcRoot);
const byId = new Map();
const byPath = new Map();
const failures = [];

function register(map, key, owner, label) {
  const previous = map.get(key);
  if (previous && previous !== owner) failures.push(`${label} '${key}'\n  first: ${previous}\n  again: ${owner}`);
  else map.set(key, owner);
}

for (const file of familyFiles.sort()) {
  const sourceText = await readFile(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function visit(node) {
    const route = objectRoute(node);
    if (route) {
      const position = source.getLineAndCharacterOfPosition(node.getStart(source));
      const owner = `${path.relative(process.cwd(), file)}:${position.line + 1}`;
      register(byId, route.id, owner, "Duplicate route id");
      register(byPath, route.koPath, owner, "Duplicate Korean route path");
      register(byPath, route.enPath, owner, "Duplicate English route path");
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

if (failures.length) {
  console.error(`[route-registry-audit] ${failures.length} collision(s) detected:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`[route-registry-audit] ${byId.size} routes across ${familyFiles.length} families are unique`);
