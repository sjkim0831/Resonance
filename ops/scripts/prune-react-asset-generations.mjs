#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "");
const previousManifestPath = process.argv[3] ? path.resolve(process.argv[3]) : "";
const preserveRoot = process.argv[4] ? path.resolve(process.argv[4]) : "";
const currentManifestPath = path.join(root, ".vite", "manifest.json");
const assetsRoot = path.join(root, "assets");
const rootStat = root && fs.existsSync(root) ? fs.lstatSync(root) : null;
const preserveRootStat = preserveRoot && fs.existsSync(preserveRoot)
  ? fs.lstatSync(preserveRoot)
  : null;
const assetsRootStat = fs.existsSync(assetsRoot) ? fs.lstatSync(assetsRoot) : null;

if (!root || !preserveRoot || !rootStat?.isDirectory() || rootStat.isSymbolicLink() ||
    !fs.existsSync(currentManifestPath) ||
    !assetsRootStat?.isDirectory() || assetsRootStat.isSymbolicLink() ||
    !preserveRootStat?.isDirectory() || preserveRootStat.isSymbolicLink()) {
  throw new Error(`invalid React overlay: ${root}`);
}

const collectPreservedAssets = () => {
  const preservedAssetsRoot = path.join(preserveRoot, "assets");
  const files = new Map();
  if (!fs.existsSync(preservedAssetsRoot)) return files;
  const preservedAssetsRootStat = fs.lstatSync(preservedAssetsRoot);
  if (!preservedAssetsRootStat.isDirectory() || preservedAssetsRootStat.isSymbolicLink()) {
    throw new Error(`refusing non-directory preserved asset root: ${preservedAssetsRoot}`);
  }
  const visitPreserved = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`refusing symlink in preserved asset tree: ${absolute}`);
      }
      if (entry.isDirectory()) {
        visitPreserved(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.normalize(path.relative(preserveRoot, absolute));
      files.set(relative, absolute);
    }
  };
  visitPreserved(preservedAssetsRoot);
  return files;
};

const collect = (manifestPath) => {
  if (!manifestPath || !fs.existsSync(manifestPath)) return new Set();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const files = new Set();
  for (const entry of Object.values(manifest)) {
    if (entry.file) files.add(entry.file);
    for (const key of ["css", "assets"]) {
      for (const file of entry[key] || []) files.add(file);
    }
  }
  return files;
};

const current = collect(currentManifestPath);
const previous = collect(previousManifestPath);
const preservedAssets = collectPreservedAssets();
const keep = new Set([
  ...current,
  ...previous,
  ...preservedAssets.keys(),
].map((file) => path.normalize(file)));
let removedFiles = 0;
let removedBytes = 0;
const removals = [];
const directories = [];

const plan = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`refusing symlink in immutable asset tree: ${absolute}`);
    }
    if (entry.isDirectory()) {
      plan(absolute);
      directories.push(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    const relative = path.normalize(path.relative(root, absolute));
    if (keep.has(relative)) continue;
    const stat = fs.statSync(absolute);
    removals.push({ absolute, size: stat.size });
  }
};

const validateClosures = (phase) => {
  for (const required of current) {
    const absolute = path.resolve(root, required);
    if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute)) {
      throw new Error(`current manifest closure damaged ${phase}: ${required}`);
    }
  }

  for (const [relative, source] of preservedAssets) {
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute) ||
        !fs.readFileSync(source).equals(fs.readFileSync(absolute))) {
      throw new Error(`preserved asset closure damaged ${phase}: ${relative}`);
    }
  }
};

plan(assetsRoot);
validateClosures("before pruning");
for (const removal of removals) {
  fs.unlinkSync(removal.absolute);
  removedFiles += 1;
  removedBytes += removal.size;
}
for (const dir of directories.sort((a, b) => b.length - a.length)) {
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
validateClosures("after pruning");

console.log(JSON.stringify({
  status: "PASS",
  currentFiles: current.size,
  previousFiles: previous.size,
  retainedGenerations: previous.size > 0 ? 2 : 1,
  preservedFiles: preservedAssets.size,
  removedFiles,
  removedBytes,
}));
