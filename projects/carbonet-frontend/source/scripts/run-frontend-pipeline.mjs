import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptRoot, "..");
const frontendBundler = process.env.CARBONET_FRONTEND_BUNDLER === "rolldown" ? "rolldown" : "vite";
const env = {
  ...process.env,
  NODE_OPTIONS: `--max-old-space-size=${process.env.CARBONET_NODE_HEAP_MB || "8192"} ${process.env.NODE_OPTIONS || ""}`.trim(),
};
const skipBuildTypecheck = process.env.CARBONET_SKIP_BUILD_TYPECHECK === "true";
const forceFullTypecheck = process.env.CARBONET_FORCE_FULL_TYPECHECK === "true";

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
  // Dedupe can rewrite generated route-family sources and therefore must
  // complete before both validation and bundling. The remaining checks are
  // read-only and independent; run them alongside typecheck and bundling so
  // frontend deploy latency is the longest lane, not the sum of every lane.
  run(process.execPath, ["scripts/dedupe-generated-route-family.mjs"]);
  const validationTasks = [
    runAsync(process.execPath, ["scripts/check-generated-route-family-integrity.mjs"]),
    runAsync(process.execPath, ["scripts/check-generated-prototype-isolation.mjs"]),
    runAsync(process.execPath, ["scripts/check-route-registry-uniqueness.mjs"]),
  ];
  const bundlerCommand = process.execPath;
  const bundlerArgs = frontendBundler === "rolldown"
    ? [path.join(frontendRoot, "node_modules/rolldown-vite/bin/vite.js"), "build"]
    : [path.join(frontendRoot, "node_modules/vite/bin/vite.js"), "build"];
  if (skipBuildTypecheck) {
    console.log("[frontend-pipeline] project-reference typecheck skipped; external noEmit evidence required");
    console.log(`[frontend-pipeline] bundler=${frontendBundler}`);
    try {
      await Promise.all([
        ...validationTasks,
        runAsync(bundlerCommand, bundlerArgs),
      ]);
    } catch (error) {
      console.error(`[frontend-pipeline] parallel validation/build failed: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  } else {
    console.log(`[frontend-pipeline] validations, typecheck and ${frontendBundler} build run concurrently; all remain fail-closed`);
    const typecheckArgs = forceFullTypecheck
      ? ["tsc", "-p", "tsconfig.app.json", "--pretty", "false"]
      : [
          "tsc", "-p", "tsconfig.app.json",
          "--incremental",
          "--tsBuildInfoFile", "tsconfig.app.tsbuildinfo",
          "--pretty", "false",
        ];
    console.log(`[frontend-pipeline] typecheck mode=${forceFullTypecheck ? "full" : "incremental"}`);
    console.log(`[frontend-pipeline] bundler=${frontendBundler}`);
    try {
      await Promise.all([
        ...validationTasks,
        runAsync(npx, typecheckArgs),
        runAsync(bundlerCommand, bundlerArgs),
      ]);
    } catch (error) {
      console.error(`[frontend-pipeline] parallel build failed: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }
}
