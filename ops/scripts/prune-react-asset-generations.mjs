#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "");
const previousManifestPath = process.argv[3] ? path.resolve(process.argv[3]) : "";
const currentManifestPath = path.join(root, ".vite", "manifest.json");
const assetsRoot = path.join(root, "assets");

if (!root || !fs.existsSync(currentManifestPath) || !fs.existsSync(assetsRoot)) {
  throw new Error(`invalid React overlay: ${root}`);
}

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
const keep = new Set([...current, ...previous].map((file) => path.normalize(file)));
let removedFiles = 0;
let removedBytes = 0;

const visit = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`refusing symlink in immutable asset tree: ${absolute}`);
    }
    if (entry.isDirectory()) {
      visit(absolute);
      if (fs.readdirSync(absolute).length === 0) fs.rmdirSync(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    const relative = path.normalize(path.relative(root, absolute));
    if (keep.has(relative)) continue;
    const stat = fs.statSync(absolute);
    fs.unlinkSync(absolute);
    removedFiles += 1;
    removedBytes += stat.size;
  }
};

visit(assetsRoot);

for (const required of current) {
  const absolute = path.resolve(root, required);
  if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute)) {
    throw new Error(`current manifest closure damaged after pruning: ${required}`);
  }
}

console.log(JSON.stringify({
  status: "PASS",
  currentFiles: current.size,
  previousFiles: previous.size,
  retainedGenerations: previous.size > 0 ? 2 : 1,
  removedFiles,
  removedBytes,
}));

