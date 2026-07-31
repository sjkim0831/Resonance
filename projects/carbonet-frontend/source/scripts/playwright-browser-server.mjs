#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const stateDir = path.resolve(arg("state-dir", ".cache/full-screen-smoke/browser-server"));
const endpointPath = path.join(stateDir, "ws-endpoint");
const pidPath = path.join(stateDir, "pid");
const versionPath = path.join(stateDir, "playwright-version");
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const packageVersion = JSON.parse(
  await readFile(new URL("../node_modules/@playwright/test/package.json", import.meta.url), "utf8"),
).version;

await mkdir(stateDir, { recursive: true });
const server = await chromium.launchServer({
  headless: true,
  host: "127.0.0.1",
  port: 0,
  executablePath,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function atomicWrite(file, value) {
  const next = `${file}.${process.pid}.next`;
  await writeFile(next, `${value}\n`, "utf8");
  await rename(next, file);
}

await atomicWrite(endpointPath, server.wsEndpoint());
await atomicWrite(pidPath, String(process.pid));
await atomicWrite(versionPath, packageVersion);
process.stdout.write(`[playwright-browser-server] ready pid=${process.pid} version=${packageVersion}\n`);

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await server.close().catch(() => undefined);
  process.exit(0);
};
process.on("SIGTERM", close);
process.on("SIGINT", close);
process.on("uncaughtException", (error) => {
  console.error(error);
  process.exit(1);
});

await new Promise((resolve) => server.on("close", resolve));
