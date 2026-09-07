import fs from "node:fs";
import path from "node:path";

const stylesPath = path.resolve("src/styles.css");
const styles = fs.readFileSync(stylesPath, "utf8");
const helpFab = /\.help-fab\s*\{(?<rules>[\s\S]*?)\}/.exec(styles)?.groups?.rules || "";

const requiredRules = [
  ["top", "auto"],
  ["right", "auto"],
  ["bottom", "20px"],
  ["left", "20px"]
];

const failures = requiredRules.filter(
  ([property, value]) => !new RegExp(`\\b${property}\\s*:\\s*${value.replace(".", "\\.")}\\s*;`).test(helpFab)
);

if (failures.length > 0) {
  console.error(
    `[floating-control-safe-zones] FAIL help-fab must stay in the lower-left safe zone: ${failures
      .map(([property, value]) => `${property}:${value}`)
      .join(", ")}`
  );
  process.exit(1);
}

console.log("[floating-control-safe-zones] PASS help-fab avoids header actions");
