import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  comparableRouteKey,
  registerCanonicalRoute,
} from "./route-path-canonicalization.mjs";

const generatedFile = resolve("src/generated/screen-generation/generatedScreenFamily.ts");

async function collectFamilies(directory, files = []) {
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory() && entry.name !== "generated") await collectFamilies(path, files);
      else if (/Family\.ts$/.test(entry.name)) files.push(path);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return files;
}

const reserved = new Map();
for (const file of await collectFamilies(resolve("src"))) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/\b(?:koPath|enPath)\s*:\s*["'`]([^"'`]+)["'`]/g)) {
    registerCanonicalRoute(reserved, match[1], file);
  }
}
try {
  const runtimeRoutes = await readFile(resolve("src/app/routes/runtime.ts"), "utf8");
  for (const match of runtimeRoutes.matchAll(/\[\s*["'`]([^"'`]+)["'`]\s*,/g)) {
    registerCanonicalRoute(reserved, match[1], "src/app/routes/runtime.ts");
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const source = await readFile(generatedFile, "utf8");
const routePattern = /const GENERATED_SCREEN_ROUTES = ([\s\S]*?) as const satisfies RouteDefinitionsOf;/;
const routeMatch = source.match(routePattern);
if (!routeMatch) throw new Error("Generated route array was not found.");
const routes = JSON.parse(routeMatch[1]);
const keptRoutes = routes.filter(route => !reserved.has(comparableRouteKey(route.koPath)));
const removedIds = new Set(routes.filter(route => reserved.has(comparableRouteKey(route.koPath))).map(route => route.id));
const keptIds = new Set(keptRoutes.map(route => route.id));

const unitPattern = /const GENERATED_SCREEN_PAGE_UNITS = \[\n([\s\S]*?)\n\] as const satisfies PageUnitsOf<typeof GENERATED_SCREEN_ROUTES>;/;
const unitMatch = source.match(unitPattern);
if (!unitMatch) throw new Error("Generated page unit array was not found.");
const unitById = new Map();
for (const line of unitMatch[1].split("\n")) {
  const id = line.match(/\bid:\s*"([^"]+)"/)?.[1];
  if (!id) continue;
  if (unitById.has(id)) throw new Error(`Duplicate generated page unit id: ${id}`);
  unitById.set(id, line);
}
const missingUnitIds = [...keptIds].filter(id => !unitById.has(id));
if (missingUnitIds.length) {
  throw new Error(`Generated routes without page units: ${missingUnitIds.slice(0, 10).join(",")}`);
}
// Rebuild in route order instead of filtering the previous unit list. This
// makes route and page-unit identity equal by construction, including when a
// prior interrupted build had already deduplicated only one side.
const keptUnits = keptRoutes.map(route => unitById.get(route.id)).join("\n");

const next = source
  .replace(routePattern, `const GENERATED_SCREEN_ROUTES = ${JSON.stringify(keptRoutes, null, 2)} as const satisfies RouteDefinitionsOf;`)
  .replace(unitPattern, `const GENERATED_SCREEN_PAGE_UNITS = [\n${keptUnits}\n] as const satisfies PageUnitsOf<typeof GENERATED_SCREEN_ROUTES>;`);

if (next !== source) {
  const temporary = `${generatedFile}.tmp-${process.pid}`;
  await writeFile(temporary, next);
  await rename(temporary, generatedFile);
}

console.log(JSON.stringify({
  generatedRoutes: routes.length,
  reservedRoutes: reserved.size,
  removedCollisions: removedIds.size,
  remainingGeneratedRoutes: keptRoutes.length,
  file: generatedFile.slice(dirname(resolve(".")).length + 1),
}));
