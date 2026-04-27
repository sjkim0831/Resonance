import fs from "node:fs";
import path from "node:path";

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, "..");

const sourcePath = path.join(repoRoot, "src/main/resources/framework/contracts/framework-contract-metadata.json");
const generatedPath = path.join(frontendRoot, "src/generated/frameworkContractMetadata.json");

const requiredTopLevelKeys = [
  "frameworkId",
  "frameworkName",
  "contractVersion",
  "authorityPolicyId",
  "builderProfiles",
  "authorityDefaults"
];

const requiredBuilderProfileKeys = [
  "pageFrameProfileIds",
  "layoutZoneIds",
  "componentTypeIds",
  "artifactUnitIds"
];

const requiredAuthorityDefaultKeys = [
  "allowedScopePolicies",
  "tierOrder"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

const issues = [];

if (!fs.existsSync(sourcePath)) {
  issues.push(`Missing canonical framework contract metadata: ${path.relative(repoRoot, sourcePath)}`);
}
if (!fs.existsSync(generatedPath)) {
  issues.push(`Missing generated framework contract metadata: ${path.relative(repoRoot, generatedPath)}`);
}

let sourceJson = null;
let generatedJson = null;

if (issues.length === 0) {
  sourceJson = readJson(sourcePath);
  generatedJson = readJson(generatedPath);
}

if (sourceJson && generatedJson) {
  for (const key of requiredTopLevelKeys) {
    if (!hasOwn(sourceJson, key)) {
      issues.push(`Canonical metadata missing required key "${key}"`);
    }
    if (!hasOwn(generatedJson, key)) {
      issues.push(`Generated metadata missing required key "${key}"`);
    }
  }

  const sourceBuilderProfiles = sourceJson.builderProfiles || {};
  const generatedBuilderProfiles = generatedJson.builderProfiles || {};
  for (const key of requiredBuilderProfileKeys) {
    if (!Array.isArray(sourceBuilderProfiles[key])) {
      issues.push(`Canonical metadata builderProfiles.${key} must be an array`);
    }
    if (!Array.isArray(generatedBuilderProfiles[key])) {
      issues.push(`Generated metadata builderProfiles.${key} must be an array`);
    }
  }

  const sourceAuthorityDefaults = sourceJson.authorityDefaults || {};
  const generatedAuthorityDefaults = generatedJson.authorityDefaults || {};
  for (const key of requiredAuthorityDefaultKeys) {
    if (!Array.isArray(sourceAuthorityDefaults[key])) {
      issues.push(`Canonical metadata authorityDefaults.${key} must be an array`);
    }
    if (!Array.isArray(generatedAuthorityDefaults[key])) {
      issues.push(`Generated metadata authorityDefaults.${key} must be an array`);
    }
  }

  if (stableStringify(sourceJson) !== stableStringify(generatedJson)) {
    issues.push(
      "Framework contract metadata drift detected. Run `npm --prefix frontend run generate:framework-contract-metadata` after updating the canonical resource."
    );
  }
}

console.log(`Framework contract metadata audit: ${issues.length} issue(s)`);

if (issues.length > 0) {
  console.log("\nIssues:");
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
} else {
  console.log("\nCanonical resource and generated frontend metadata are in sync.");
}

process.exit(issues.length > 0 ? 1 : 0);
