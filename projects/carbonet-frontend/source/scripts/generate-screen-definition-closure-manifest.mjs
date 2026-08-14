import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_SCREEN_TYPES_SOURCE } from "./generated-screen-type-contract.mjs";
import {
  assertClosureManifestFileName,
  buildGeneratedScreenDefinitionClosure,
} from "./generated-screen-definition-closure.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) =>
  value.startsWith("--") ? [value.slice(2), all[index + 1]?.startsWith("--") ? "true" : all[index + 1]] : null
).filter(Boolean));
const scriptRoot = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptRoot, "..");
const catalogPath = resolve(args.catalog ||
  `${frontendRoot}/src/generated/screen-generation/generatedScreenCatalog.ts`);
const definitionsRoot = resolve(args.definitions ||
  `${frontendRoot}/src/generated/screen-generation/definitions`);
const outputPath = resolve(args.out ||
  `${frontendRoot}/src/generated/screen-generation/generatedScreenDefinitionClosure.json`);
assertClosureManifestFileName(outputPath);

const catalogSource = await readFile(catalogPath, "utf8");
const closure = await buildGeneratedScreenDefinitionClosure({
  catalogSource,
  typeContractSource: GENERATED_SCREEN_TYPES_SOURCE,
  definitionsRoot,
});
const output = `${JSON.stringify(closure.manifest, null, 2)}\n`;
const temporary = `${outputPath}.tmp-${process.pid}`;
await writeFile(temporary, output);
await rename(temporary, outputPath);
console.log(JSON.stringify({
  status: "PASS",
  definitionCount: closure.definitionSet.count,
  extraDefinitionCount: closure.definitionSet.extraFiles.length,
  catalogSha256: closure.manifest.catalog.sha256,
  definitionSetHash: closure.manifest.definitions.setHash,
  closureHash: closure.manifest.closureHash,
  output: outputPath,
}));
