import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runAsync(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed (${signal || code || "unknown"})`));
    });
  });
}

// Local builds and official deployment builds consume the same immutable
// catalog/definition/type closure before any TypeScript or Vite process starts.
run(process.execPath, ["scripts/ensure-shared-generated-screen-assets.mjs"]);

if (!process.argv.includes("--build")) {
  const generateAsync = (key, script, outputs, inputs) =>
    runAsync(process.execPath, [
      "scripts/run-incremental-generator.mjs",
      key,
      script,
      outputs.join(","),
      ...inputs,
    ]);
  console.log("[frontend-pipeline] four independent generators and customer-journey audit run concurrently");
  await Promise.all([
    generateAsync("system-component-catalog", "scripts/generate-system-component-catalog.mjs", [
      "src/generated/systemComponentCatalog.json",
    ], ["src/features", "src/app/routes"]),
    generateAsync("framework-contract-metadata", "scripts/generate-framework-contract-metadata.mjs", [
      "src/generated/frameworkContractMetadata.json",
    ], ["../../../modules/resonance-common/carbonet-contract-metadata/src/main/resources/framework/contracts"]),
    generateAsync("verification-center-inventory", "scripts/generate-verification-center-inventory.mjs", [
      "src/generated/verificationCenterInventory.json",
    ], [
      "src/platform/screen-registry/pageManifests.ts",
      "e2e",
      "../src/test",
      "../../../docs/ai/40-backend/controller-service-map.csv",
      "../../../docs/ai/20-ui/event-map.csv",
    ]),
    generateAsync("page-completeness-inventory", "scripts/generate-page-completeness-inventory.mjs", [
      "src/features/builder-studio/pageCompletenessInventory.ts",
      "src/features/builder-studio/routeSourceInventory.ts",
    ], ["src/app/routes", "src/platform/routes", "src/features"]),
    runAsync(process.execPath, ["scripts/check-customer-journey-governance.mjs"]),
  ]);
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
    runAsync(process.execPath, ["scripts/verify-screen-work-context-integration.mjs"]),
    runAsync(process.execPath, ["scripts/verify-operational-usage-ledger.mjs"]),
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
      ? ["-p", "tsconfig.app.json", "--pretty", "false"]
      : [
          "-p", "tsconfig.app.json",
          "--incremental",
          "--tsBuildInfoFile", "tsconfig.app.tsbuildinfo",
          "--pretty", "false",
        ];
    console.log(`[frontend-pipeline] typecheck mode=${forceFullTypecheck ? "full" : "incremental"}`);
    console.log(`[frontend-pipeline] bundler=${frontendBundler}`);
    try {
      await Promise.all([
        ...validationTasks,
        runAsync(process.execPath, [path.join(frontendRoot, "node_modules/typescript/bin/tsc"), ...typecheckArgs]),
        runAsync(bundlerCommand, bundlerArgs),
      ]);
    } catch (error) {
      console.error(`[frontend-pipeline] parallel build failed: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }
}
