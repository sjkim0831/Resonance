import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const env = {
  ...process.env,
  NODE_OPTIONS: `--max-old-space-size=${process.env.CARBONET_NODE_HEAP_MB || "8192"} ${process.env.NODE_OPTIONS || ""}`.trim(),
};

function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.argv.includes("--build")) {
  for (const script of [
    "generate:system-component-catalog",
    "generate:framework-contract-metadata",
    "generate:verification-center-inventory",
    "generate:page-completeness-inventory",
    "audit:customer-journey",
  ]) run(npm, ["run", script]);
}

if (process.argv.includes("--build")) {
  run(npm, ["run", "audit:route-registry"]);
  run(npx, ["tsc", "-b"]);
  run(npx, ["vite", "build"]);
}
