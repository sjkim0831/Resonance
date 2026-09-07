import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_SCREEN_TYPES_SOURCE } from "./generated-screen-type-contract.mjs";
import {
  inspectGeneratedScreenDefinitionSet,
  parseGeneratedScreenDefinitionImports,
  validateGeneratedScreenDefinitionClosure,
} from "./generated-screen-definition-closure.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptRoot, "..");
const generatedRoot = path.resolve(process.env.GENERATED_SCREEN_DIR ||
  path.join(frontendRoot, "src/generated/screen-generation"));
const sharedRoot = path.resolve(process.env.SHARED_GENERATED_SCREEN_DIR ||
  "/opt/Resonance/projects/carbonet-frontend/source/src/generated/screen-generation");
const catalogPath = path.join(generatedRoot, "generatedScreenCatalog.ts");
const manifestPath = path.join(generatedRoot, "generatedScreenDefinitionClosure.json");
const targetDefinitions = path.join(generatedRoot, "definitions");
const targetTypes = path.join(generatedRoot, "generatedScreenTypes.ts");
const sourceDefinitions = path.join(sharedRoot, "definitions");

if (generatedRoot === sharedRoot) {
  throw new Error("generated screen closure must materialize in an isolated candidate worktree");
}

async function exists(target) {
  try { await lstat(target); return true; } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function atomicWriteIfChanged(target, content) {
  try {
    const currentStat = await lstat(target);
    if (currentStat.isFile() && !currentStat.isSymbolicLink()
        && await readFile(target, "utf8") === content) return false;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const temporary = `${target}.tmp-${process.pid}`;
  await rm(temporary, { force: true, recursive: true });
  await writeFile(temporary, content, { mode: 0o644 });
  if (await exists(target)) await rm(target, { force: true, recursive: true });
  await rename(temporary, target);
  return true;
}

async function targetIsExact(imports, manifest, catalogSource) {
  try {
    const targetEntries = (await readdir(targetDefinitions, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"));
    if (targetEntries.length !== imports.length) return false;
    const definitionSet = await inspectGeneratedScreenDefinitionSet(targetDefinitions, imports);
    validateGeneratedScreenDefinitionClosure({
      manifest,
      catalogSource,
      typeContractSource: GENERATED_SCREEN_TYPES_SOURCE,
      definitionSet,
    });
    return definitionSet.extraFiles.length === 0;
  } catch {
    return false;
  }
}

async function materializeExactDefinitions(imports) {
  const staging = path.join(generatedRoot, `.definitions.closure-${process.pid}`);
  const retired = path.join(generatedRoot, `.definitions.retired-${process.pid}`);
  await rm(staging, { recursive: true, force: true });
  await rm(retired, { recursive: true, force: true });
  await mkdir(staging, { recursive: true, mode: 0o755 });
  try {
    for (const entry of imports) {
      const source = path.join(sourceDefinitions, entry.file);
      const sourceStat = await lstat(source);
      if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
        throw new Error(`shared generated screen definition must be a regular file: ${source}`);
      }
      await copyFile(source, path.join(staging, entry.file));
    }
    if (await exists(targetDefinitions)) await rename(targetDefinitions, retired);
    try {
      await rename(staging, targetDefinitions);
    } catch (error) {
      if (await exists(retired)) await rename(retired, targetDefinitions);
      throw error;
    }
    await rm(retired, { recursive: true, force: true });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

await mkdir(generatedRoot, { recursive: true });
const manifestTextBefore = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestTextBefore);
const catalogSource = await readFile(catalogPath, "utf8");
const imports = parseGeneratedScreenDefinitionImports(catalogSource);

const sharedSetBefore = await inspectGeneratedScreenDefinitionSet(sourceDefinitions, imports);
validateGeneratedScreenDefinitionClosure({
  manifest,
  catalogSource,
  typeContractSource: GENERATED_SCREEN_TYPES_SOURCE,
  definitionSet: sharedSetBefore,
});

const typeContractChanged = await atomicWriteIfChanged(targetTypes, GENERATED_SCREEN_TYPES_SOURCE);
let definitionsChanged = false;
if (!await targetIsExact(imports, manifest, catalogSource)) {
  await materializeExactDefinitions(imports);
  definitionsChanged = true;
}

const targetSet = await inspectGeneratedScreenDefinitionSet(targetDefinitions, imports);
validateGeneratedScreenDefinitionClosure({
  manifest,
  catalogSource,
  typeContractSource: await readFile(targetTypes, "utf8"),
  definitionSet: targetSet,
});
if (targetSet.actualFileCount !== imports.length || targetSet.extraFiles.length) {
  throw new Error("materialized generated screen definitions are not an exact catalog closure");
}

const manifestTextAfter = await readFile(manifestPath, "utf8");
if (manifestTextAfter !== manifestTextBefore) {
  throw new Error("generated screen definition closure changed during materialization");
}
const sharedSetAfter = await inspectGeneratedScreenDefinitionSet(sourceDefinitions, imports);
validateGeneratedScreenDefinitionClosure({
  manifest,
  catalogSource,
  typeContractSource: GENERATED_SCREEN_TYPES_SOURCE,
  definitionSet: sharedSetAfter,
});

console.log(JSON.stringify({
  status: "PASS",
  definitionCount: imports.length,
  sharedDefinitionCount: sharedSetAfter.actualFileCount,
  excludedSharedDefinitions: sharedSetAfter.extraFiles.length,
  targetDefinitionCount: targetSet.actualFileCount,
  catalogSha256: manifest.catalog.sha256,
  definitionSetHash: manifest.definitions.setHash,
  closureHash: manifest.closureHash,
  definitionsChanged,
  typeContractChanged,
}));
