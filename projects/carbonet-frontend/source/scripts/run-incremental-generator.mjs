import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [key, script, outputsCsv, ...inputs] = process.argv.slice(2);
if (!key || !script || !outputsCsv || inputs.length === 0) {
  console.error("Usage: run-incremental-generator <key> <script> <outputsCsv> <input...>");
  process.exit(2);
}

const root = process.cwd();
const cacheDir = path.join(root, "node_modules", ".cache", "carbonet-generators");
const cacheFile = path.join(cacheDir, `${key}.json`);
const outputs = outputsCsv.split(",").map((value) => path.resolve(root, value));
const ignoredGeneratedFiles = new Set([
  ...outputs,
  path.join(root, "src", "generated", "systemComponentCatalog.json"),
  path.join(root, "src", "generated", "frameworkContractMetadata.json"),
  path.join(root, "src", "generated", "verificationCenterInventory.json"),
  path.join(root, "src", "features", "builder-studio", "pageCompletenessInventory.ts"),
  path.join(root, "src", "features", "builder-studio", "routeSourceInventory.ts"),
].map((value) => path.normalize(value)));
const ignoredRepoPaths = new Set([...ignoredGeneratedFiles]
  .map((value) => path.relative(root, value).split(path.sep).join("/")));
const hash = createHash("sha256");

async function outputHashes() {
  const result = {};
  for (const output of outputs) {
    if (!existsSync(output)) return null;
    result[path.relative(root, output).split(path.sep).join("/")] = createHash("sha256")
      .update(await readFile(output))
      .digest("hex");
  }
  return result;
}

async function fingerprintByContent(target) {
  const absolute = path.resolve(root, target);
  if (ignoredGeneratedFiles.has(path.normalize(absolute))) return;
  if (!existsSync(absolute)) {
    hash.update(`missing:${target}\n`);
    return;
  }
  const info = await stat(absolute);
  if (!info.isDirectory()) {
    hash.update(`${path.relative(root, absolute)}\0`);
    hash.update(await readFile(absolute));
    return;
  }
  for (const entry of (await readdir(absolute, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "node_modules" || entry.name === "target" || entry.name === "build" || entry.name === ".gradle") continue;
    await fingerprintByContent(path.join(absolute, entry.name));
  }
}

function gitOutput(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout : null;
}

async function fingerprint(target) {
  const relative = path.relative(root, path.resolve(root, target)).split(path.sep).join("/");
  const tracked = gitOutput(["ls-files", "-s", "-z", "--", relative]);
  if (tracked === null) {
    await fingerprintByContent(target);
    return;
  }

  const trackedRecords = tracked.split("\0").filter(Boolean).filter((record) => {
    const file = record.slice(record.indexOf("\t") + 1);
    return !ignoredRepoPaths.has(file);
  }).sort();
  for (const record of trackedRecords) hash.update(`tracked:${record}\n`);

  const changed = gitOutput(["diff", "--name-only", "-z", "--", relative]) || "";
  const untracked = gitOutput(["ls-files", "--others", "--exclude-standard", "-z", "--", relative]) || "";
  const workingFiles = [...new Set([...changed.split("\0"), ...untracked.split("\0")]
    .filter(Boolean)
    .filter((file) => !ignoredRepoPaths.has(file)))].sort();
  for (const file of workingFiles) {
    const absolute = path.join(root, file);
    hash.update(`working:${file}\0`);
    if (existsSync(absolute)) hash.update(await readFile(absolute));
    else hash.update("deleted");
  }
}

for (const input of [script, ...inputs]) await fingerprint(input);
const signature = hash.digest("hex");
let previous = null;
try {
  previous = JSON.parse(await readFile(cacheFile, "utf8"));
} catch {
  // First execution or invalid cache: regenerate safely.
}

const force = process.env.CARBONET_FORCE_GENERATORS === "true";
const currentOutputHashes = await outputHashes();
if (!force && previous?.signature === signature && currentOutputHashes
  && JSON.stringify(previous.outputHashes) === JSON.stringify(currentOutputHashes)) {
  console.log(`[incremental-generator] ${key}: unchanged, reused ${outputs.length} output(s)`);
  process.exit(0);
}

const result = spawnSync(process.execPath, [script], { cwd: root, env: process.env, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (!outputs.every(existsSync)) {
  console.error(`[incremental-generator] ${key}: generator completed but an output is missing`);
  process.exit(3);
}

await mkdir(cacheDir, { recursive: true });
await writeFile(cacheFile, `${JSON.stringify({
  signature,
  outputHashes: await outputHashes(),
  generatedAt: new Date().toISOString(),
})}\n`);
console.log(`[incremental-generator] ${key}: regenerated`);
