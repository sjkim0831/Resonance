#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "projects/carbonet-frontend/src/main/resources/static/react-app");
const manifestPath = path.join(root, ".vite", "manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error(`manifest missing: ${manifestPath}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const required = new Set(["index.html", ".vite/manifest.json"]);
for (const entry of Object.values(manifest)) {
  if (entry.file) required.add(entry.file);
  for (const css of entry.css || []) required.add(css);
  for (const asset of entry.assets || []) required.add(asset);
}

const missing = [...required].filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`[asset-closure] missing ${missing.length} manifest assets`);
  missing.forEach((file) => console.error(file));
  process.exit(1);
}
console.log(`[asset-closure] verified ${required.size} files in ${root}`);
