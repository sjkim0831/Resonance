import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const generatedFile = resolve("src/generated/screen-generation/generatedScreenFamily.ts");
const source = await readFile(generatedFile, "utf8");
const routeMatch = source.match(
  /const GENERATED_SCREEN_ROUTES = ([\s\S]*?) as const satisfies RouteDefinitionsOf;/,
);
const unitMatch = source.match(
  /const GENERATED_SCREEN_PAGE_UNITS = \[\n([\s\S]*?)\n\] as const satisfies PageUnitsOf<typeof GENERATED_SCREEN_ROUTES>;/,
);
if (!routeMatch || !unitMatch) throw new Error("Generated route family contract is incomplete.");

const routeIds = JSON.parse(routeMatch[1]).map(route => route.id);
const unitIds = [...unitMatch[1].matchAll(/\bid:\s*"([^"]+)"/g)].map(match => match[1]);
const duplicates = values => values.filter((value, index) => values.indexOf(value) !== index);
const routeSet = new Set(routeIds);
const unitSet = new Set(unitIds);
const missingUnits = routeIds.filter(id => !unitSet.has(id));
const orphanUnits = unitIds.filter(id => !routeSet.has(id));
const duplicateRoutes = [...new Set(duplicates(routeIds))];
const duplicateUnits = [...new Set(duplicates(unitIds))];

if (missingUnits.length || orphanUnits.length || duplicateRoutes.length || duplicateUnits.length) {
  console.error(JSON.stringify({
    status: "FAIL",
    routeCount: routeIds.length,
    unitCount: unitIds.length,
    missingUnits: missingUnits.slice(0, 20),
    orphanUnits: orphanUnits.slice(0, 20),
    duplicateRoutes: duplicateRoutes.slice(0, 20),
    duplicateUnits: duplicateUnits.slice(0, 20),
  }));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "PASS",
  routeCount: routeIds.length,
  unitCount: unitIds.length,
  identityClosure: true,
}));

