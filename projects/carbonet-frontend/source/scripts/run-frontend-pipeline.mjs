import { spawn, spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const env = {
  ...process.env,
  NODE_OPTIONS: `--max-old-space-size=${process.env.CARBONET_NODE_HEAP_MB || "8192"} ${process.env.NODE_OPTIONS || ""}`.trim(),
};
const skipBuildTypecheck = process.env.CARBONET_SKIP_BUILD_TYPECHECK === "true";

function run(command, args) {
  const requiresWindowsCommandShell = process.platform === "win32" && (command === npm || command === npx);
  const result = spawnSync(command, args, { env, stdio: "inherit", shell: requiresWindowsCommandShell });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runAsync(command, args) {
  const requiresWindowsCommandShell = process.platform === "win32" && (command === npm || command === npx);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      shell: requiresWindowsCommandShell,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed (${signal || code || "unknown"})`));
    });
  });
}

function generate(key, script, outputs, inputs) {
  run(process.execPath, [
    "scripts/run-incremental-generator.mjs",
    key,
    script,
    outputs.join(","),
    ...inputs,
  ]);
}

if (!process.argv.includes("--build")) {
  generate("system-component-catalog", "scripts/generate-system-component-catalog.mjs", [
    "src/generated/systemComponentCatalog.json",
  ], ["src/features", "src/app/routes"]);
  generate("framework-contract-metadata", "scripts/generate-framework-contract-metadata.mjs", [
    "src/generated/frameworkContractMetadata.json",
  ], ["../../../modules/resonance-common/carbonet-contract-metadata/src/main/resources/framework/contracts"]);
  generate("verification-center-inventory", "scripts/generate-verification-center-inventory.mjs", [
    "src/generated/verificationCenterInventory.json",
  ], [
    "src/platform/screen-registry/pageManifests.ts",
    "e2e",
    "../src/test",
    "../../../docs/ai/40-backend/controller-service-map.csv",
    "../../../docs/ai/20-ui/event-map.csv",
  ]);
  generate("page-completeness-inventory", "scripts/generate-page-completeness-inventory.mjs", [
    "src/features/builder-studio/pageCompletenessInventory.ts",
    "src/features/builder-studio/routeSourceInventory.ts",
  ], ["src/app/routes", "src/platform/routes", "src/features"]);
  run(npm, ["run", "audit:customer-journey"]);
}

if (process.argv.includes("--build")) {
  run(process.execPath, ["scripts/dedupe-generated-route-family.mjs"]);
  run(process.execPath, ["scripts/check-generated-prototype-isolation.mjs"]);
  run(npm, ["run", "audit:route-registry"]);
  if (skipBuildTypecheck) {
    console.log("[frontend-pipeline] project-reference typecheck skipped; external noEmit evidence required");
    run(npx, ["vite", "build"]);
  } else {
    console.log("[frontend-pipeline] typecheck and Vite build run concurrently; both remain fail-closed");
    try {
      await Promise.all([
        runAsync(npx, ["tsc", "-b"]),
        runAsync(npx, ["vite", "build"]),
      ]);
    } catch (error) {
      console.error(`[frontend-pipeline] parallel build failed: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }
}
