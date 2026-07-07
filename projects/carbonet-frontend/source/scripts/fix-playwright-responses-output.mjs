import fs from "node:fs";
import path from "node:path";

const target = path.resolve(
  process.cwd(),
  "node_modules/playwright-core/lib/mcpBundleImpl/index.js",
);

const badSnippet = "output:t.result.content.map(UU)";
const priorFixedSnippet = "output:JSON.stringify(t.result.content.map(UU))";
const fixedSnippet =
  'output:(()=>{const r=t.result.content||[],s=r.filter(n=>n.type==="text").map(n=>n.text).join("\\n");return s||JSON.stringify(r.map(UU))})()';

if (!fs.existsSync(target)) {
  process.exit(0);
}

const source = fs.readFileSync(target, "utf8");
if (source.includes(fixedSnippet)) {
  process.exit(0);
}

if (!source.includes(badSnippet) && !source.includes(priorFixedSnippet)) {
  console.warn(
    `[fix-playwright-responses-output] Expected snippet not found in ${target}`,
  );
  process.exit(0);
}

const patched = source
  .replace(priorFixedSnippet, fixedSnippet)
  .replace(badSnippet, fixedSnippet);

fs.writeFileSync(target, patched, "utf8");
console.log(
  "[fix-playwright-responses-output] Patched Playwright MCP Responses output serialization.",
);
