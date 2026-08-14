import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

export const GENERATED_SCREEN_DEFINITION_CLOSURE_SCHEMA =
  "carbonet.generated-screen-definition-closure/v1";

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const stableValue = (value) => Array.isArray(value)
  ? value.map(stableValue)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
    : value;

export const stableJson = (value) => JSON.stringify(stableValue(value));

export function parseGeneratedScreenDefinitionImports(catalogSource) {
  const imports = [...catalogSource.matchAll(
    /^import \{ (screen_[a-z0-9_]+) \} from "\.\/definitions\/([a-z0-9-]+)";$/gm,
  )].map((match) => ({ symbol: match[1], file: `${match[2]}.ts` }));
  if (!imports.length) throw new Error("generated screen catalog has no definition imports");
  const symbols = new Set();
  const files = new Set();
  for (const entry of imports) {
    if (symbols.has(entry.symbol)) throw new Error(`duplicate generated screen symbol: ${entry.symbol}`);
    if (files.has(entry.file)) throw new Error(`duplicate generated screen definition: ${entry.file}`);
    symbols.add(entry.symbol);
    files.add(entry.file);
  }
  return imports.sort((left, right) => left.file.localeCompare(right.file));
}

async function readRegularFile(path, label) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file: ${path}`);
  }
  return readFile(path);
}

export async function inspectGeneratedScreenDefinitionSet(definitionsRoot, imports) {
  const directoryStat = await lstat(definitionsRoot);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error(`generated screen definitions must be a real directory: ${definitionsRoot}`);
  }
  const rows = [];
  for (const entry of imports) {
    const path = resolve(definitionsRoot, entry.file);
    const content = await readRegularFile(path, "generated screen definition");
    const source = content.toString("utf8");
    const exported = source.match(/^export const (screen_[a-z0-9_]+) = /m)?.[1];
    if (exported !== entry.symbol) {
      throw new Error(`generated screen definition export mismatch: ${entry.file}`);
    }
    rows.push(`${entry.file}\u0000${entry.symbol}\u0000${sha256(content)}`);
  }
  const actualFiles = (await readdir(definitionsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => entry.name)
    .sort();
  const expectedFiles = new Set(imports.map((entry) => entry.file));
  const extraFiles = actualFiles.filter((file) => !expectedFiles.has(file));
  return {
    count: rows.length,
    setHash: sha256(rows.join("\n")),
    actualFileCount: actualFiles.length,
    extraFiles,
  };
}

export function createGeneratedScreenDefinitionClosure({
  catalogSource,
  typeContractSource,
  definitionSet,
}) {
  const core = {
    schema: GENERATED_SCREEN_DEFINITION_CLOSURE_SCHEMA,
    algorithm: "sha256",
    catalog: {
      file: "generatedScreenCatalog.ts",
      sha256: sha256(catalogSource),
    },
    typeContract: {
      file: "generatedScreenTypes.ts",
      sha256: sha256(typeContractSource),
    },
    definitions: {
      directory: "definitions",
      count: definitionSet.count,
      setHash: definitionSet.setHash,
    },
  };
  return { ...core, closureHash: sha256(stableJson(core)) };
}

export function validateGeneratedScreenDefinitionClosure({
  manifest,
  catalogSource,
  typeContractSource,
  definitionSet,
}) {
  if (manifest?.schema !== GENERATED_SCREEN_DEFINITION_CLOSURE_SCHEMA) {
    throw new Error(`unsupported generated screen definition closure: ${manifest?.schema || "missing"}`);
  }
  const { closureHash, ...core } = manifest;
  if (!/^[a-f0-9]{64}$/.test(String(closureHash || ""))
      || sha256(stableJson(core)) !== closureHash) {
    throw new Error("generated screen definition closureHash mismatch");
  }
  if (manifest.algorithm !== "sha256"
      || manifest.catalog?.file !== "generatedScreenCatalog.ts"
      || manifest.catalog?.sha256 !== sha256(catalogSource)) {
    throw new Error("generated screen catalog provenance mismatch");
  }
  if (manifest.typeContract?.file !== "generatedScreenTypes.ts"
      || manifest.typeContract?.sha256 !== sha256(typeContractSource)) {
    throw new Error("generated screen type contract provenance mismatch");
  }
  if (manifest.definitions?.directory !== "definitions"
      || manifest.definitions?.count !== definitionSet.count
      || manifest.definitions?.setHash !== definitionSet.setHash) {
    throw new Error("generated screen definition set provenance mismatch");
  }
  return true;
}

export async function buildGeneratedScreenDefinitionClosure({
  catalogSource,
  typeContractSource,
  definitionsRoot,
}) {
  const imports = parseGeneratedScreenDefinitionImports(catalogSource);
  const definitionSet = await inspectGeneratedScreenDefinitionSet(definitionsRoot, imports);
  return {
    imports,
    definitionSet,
    manifest: createGeneratedScreenDefinitionClosure({
      catalogSource,
      typeContractSource,
      definitionSet,
    }),
  };
}

export function assertClosureManifestFileName(path) {
  if (basename(path) !== "generatedScreenDefinitionClosure.json") {
    throw new Error(`closure manifest filename is fixed: ${path}`);
  }
}
