import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-co2-quality-analysis-business-e2e.sh", root), "utf8");
for (const token of [
  "CQA_PLAN,CQA_TEST,CQA_DECIDE",
  "LAB_ANALYST,LAB_ANALYST,CERTIFICATE_OFFICER",
  '"LAB_ANALYST":"qacalc26"',
  '"CERTIFICATE_OFFICER":"qaapprove26"',
  "/work/co2-quality-analysis",
]) if (!declared.includes(token)) throw new Error(`missing CO2 quality analysis relay contract: ${token}`);
console.log("CO2_QUALITY_ANALYSIS_CONTRACT_PASS steps=3 actors=2 cleanup=1");
