import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = "/opt/Resonance/projects/carbonet-frontend/source/.cache/full-screen-smoke";
const target = JSON.parse(
  await readFile(path.join(root, "contract-2971-target/results/shard-0.json"), "utf8")
).results.find((item) => item.routePath === "/admin/system/consent-history");
if (!target) throw new Error("target smoke result is missing");

let replacements = 0;
for (let shard = 0; shard < 8; shard += 1) {
  const file = path.join(root, `results/shard-${shard}.json`);
  let payload;
  try {
    payload = JSON.parse(await readFile(file, "utf8"));
  } catch {
    continue;
  }
  payload.results = (payload.results || []).map((item) => {
    if (item.routePath !== target.routePath) return item;
    replacements += 1;
    return target;
  });
  await writeFile(`${file}.next`, `${JSON.stringify(payload, null, 2)}\n`);
  await rename(`${file}.next`, file);
}
if (replacements !== 1) throw new Error(`expected one global result replacement, received ${replacements}`);
console.log(JSON.stringify({ routePath: target.routePath, replacements, durationMs: target.durationMs }));
