import { spawnSync } from "node:child_process";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] || new URL("../..", import.meta.url).pathname);
const frontend = join(root, "projects/carbonet-frontend/source");
const ensureScript = join(frontend, "scripts/ensure-shared-generated-screen-assets.mjs");
const closureLibrary = await import(pathToFileURL(
  join(frontend, "scripts/generated-screen-definition-closure.mjs"),
));
const { GENERATED_SCREEN_TYPES_SOURCE } = await import(pathToFileURL(
  join(frontend, "scripts/generated-screen-type-contract.mjs"),
));
const work = mkdtempSync(join(tmpdir(), "generated-screen-definition-closure."));
const fail = (message) => { throw new Error(message); };
const assert = (value, message) => { if (!value) fail(message); };

const definition = (symbol, id) =>
  `import type { GeneratedScreenDefinition } from "../generatedScreenTypes";\nexport const ${symbol} = ${JSON.stringify({ id })} as const satisfies GeneratedScreenDefinition;\n`;
const catalog = [
  'import type { GeneratedScreenDefinition } from "./generatedScreenTypes";',
  'import { screen_alpha } from "./definitions/alpha";',
  'import { screen_beta } from "./definitions/beta";',
  'export const GENERATED_SCREEN_CATALOG: readonly GeneratedScreenDefinition[] = [',
  '  screen_alpha as GeneratedScreenDefinition,',
  '  screen_beta as GeneratedScreenDefinition',
  '];',
  '',
].join("\n");

function runEnsure(generatedRoot, sharedRoot, expectedSuccess) {
  const result = spawnSync(process.execPath, [ensureScript], {
    cwd: frontend,
    env: {
      ...process.env,
      GENERATED_SCREEN_DIR: generatedRoot,
      SHARED_GENERATED_SCREEN_DIR: sharedRoot,
    },
    encoding: "utf8",
  });
  if (expectedSuccess && result.status !== 0) {
    fail(`ensure failed: ${result.stderr || result.stdout}`);
  }
  if (!expectedSuccess && result.status === 0) fail("closure mutant survived");
  return result;
}

async function makeFixture(name) {
  const fixture = join(work, name);
  const generatedRoot = join(fixture, "candidate");
  const sharedRoot = join(fixture, "shared");
  const definitionsRoot = join(sharedRoot, "definitions");
  mkdirSync(generatedRoot, { recursive: true });
  mkdirSync(definitionsRoot, { recursive: true });
  writeFileSync(join(generatedRoot, "generatedScreenCatalog.ts"), catalog);
  writeFileSync(join(definitionsRoot, "alpha.ts"), definition("screen_alpha", "alpha"));
  writeFileSync(join(definitionsRoot, "beta.ts"), definition("screen_beta", "beta"));
  writeFileSync(join(definitionsRoot, "stale-extra.ts"), definition("screen_stale_extra", "stale-extra"));
  writeFileSync(join(sharedRoot, "generatedScreenTypes.ts"), "STALE_SHARED_TYPE_MUST_NOT_BE_READ\n");
  const closure = await closureLibrary.buildGeneratedScreenDefinitionClosure({
    catalogSource: catalog,
    typeContractSource: GENERATED_SCREEN_TYPES_SOURCE,
    definitionsRoot,
  });
  writeFileSync(join(generatedRoot, "generatedScreenDefinitionClosure.json"),
    `${JSON.stringify(closure.manifest, null, 2)}\n`);
  return { fixture, generatedRoot, sharedRoot, definitionsRoot, closure };
}

try {
  const base = await makeFixture("base");
  const first = runEnsure(base.generatedRoot, base.sharedRoot, true);
  const result = JSON.parse(first.stdout.trim().split(/\r?\n/).at(-1));
  const targetDefinitions = join(base.generatedRoot, "definitions");
  assert(result.definitionCount === 2 && result.sharedDefinitionCount === 3
    && result.excludedSharedDefinitions === 1 && result.targetDefinitionCount === 2,
  "exact materialization counts");
  assert(!lstatSync(targetDefinitions).isSymbolicLink(), "definitions must not be a shared symlink");
  assert(readdirSync(targetDefinitions).sort().join() === "alpha.ts,beta.ts", "shared extra isolation");
  assert(readFileSync(join(base.generatedRoot, "generatedScreenTypes.ts"), "utf8")
    === GENERATED_SCREEN_TYPES_SOURCE, "candidate-owned type contract");
  const second = JSON.parse(runEnsure(base.generatedRoot, base.sharedRoot, true)
    .stdout.trim().split(/\r?\n/).at(-1));
  assert(second.definitionsChanged === false && second.typeContractChanged === false,
    "idempotent materialization");

  let mutantsKilled = 0;
  for (const mutant of ["definition-byte", "missing", "catalog", "manifest"]) {
    const copy = join(work, mutant);
    cpSync(base.fixture, copy, { recursive: true });
    const generatedRoot = join(copy, "candidate");
    const sharedRoot = join(copy, "shared");
    if (mutant === "definition-byte") {
      writeFileSync(join(sharedRoot, "definitions/alpha.ts"),
        `${readFileSync(join(sharedRoot, "definitions/alpha.ts"), "utf8")} `);
    } else if (mutant === "missing") {
      unlinkSync(join(sharedRoot, "definitions/beta.ts"));
    } else if (mutant === "catalog") {
      writeFileSync(join(generatedRoot, "generatedScreenCatalog.ts"), `${catalog}// mutant\n`);
    } else {
      const manifestPath = join(generatedRoot, "generatedScreenDefinitionClosure.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.closureHash = "0".repeat(64);
      writeFileSync(manifestPath, JSON.stringify(manifest));
    }
    runEnsure(generatedRoot, sharedRoot, false);
    mutantsKilled += 1;
  }

  const wrongExport = await makeFixture("wrong-export");
  writeFileSync(join(wrongExport.definitionsRoot, "alpha.ts"), definition("screen_wrong", "alpha"));
  try {
    await closureLibrary.buildGeneratedScreenDefinitionClosure({
      catalogSource: catalog,
      typeContractSource: GENERATED_SCREEN_TYPES_SOURCE,
      definitionsRoot: wrongExport.definitionsRoot,
    });
  } catch { mutantsKilled += 1; }

  const deployScript = readFileSync(join(root, "ops/scripts/resonance-k8s-build-deploy-80-v2.sh"), "utf8");
  const overlayScript = readFileSync(join(root, "ops/scripts/resonance-screen-overlay-apply.sh"), "utf8");
  const pipelineScript = readFileSync(join(frontend, "scripts/run-frontend-pipeline.mjs"), "utf8");
  for (const [name, source] of [["deploy", deployScript], ["overlay", overlayScript], ["local", pipelineScript]]) {
    assert(source.includes("ensure-shared-generated-screen-assets.mjs"), `${name} closure preflight`);
  }
  assert(!deployScript.includes('ln -s "$shared_generated_dir/definitions"')
    && !overlayScript.includes('ln -s "$SHARED_GENERATED_SCREEN_DIR/definitions"'),
  "mutable shared definition symlink removed");
  assert(mutantsKilled === 5, `mutants killed=${mutantsKilled}`);
  console.log(`PASS definitions=2 shared=3 excluded=1 mutants=${mutantsKilled} typeOwner=candidate`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
