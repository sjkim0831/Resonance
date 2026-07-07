import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const candidateSourcePaths = [
  path.resolve(frontendRoot, "../../..", "modules/resonance-common/carbonet-contract-metadata/src/main/resources/framework/contracts/framework-contract-metadata.json"),
  path.join(repoRoot, "modules/carbonet-contract-metadata/src/main/resources/framework/contracts/framework-contract-metadata.json"),
  path.join(repoRoot, "src/main/resources/framework/contracts/framework-contract-metadata.json")
];
const outputPath = path.join(frontendRoot, "src/generated/frameworkContractMetadata.json");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const sourcePath = candidateSourcePaths.find((candidate) => fs.existsSync(candidate));

if (!sourcePath) {
  throw new Error(`framework-contract-metadata.json not found in any expected path: ${candidateSourcePaths.join(", ")}`);
}

const metadata = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
ensureDir(outputPath);
fs.writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
