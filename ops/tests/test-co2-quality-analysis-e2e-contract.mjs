import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-co2-quality-analysis-business-e2e.sh", root), "utf8");
const engine = readFileSync(new URL("ops/scripts/resonance-facility-operation-monitoring-e2e.mjs", root), "utf8");
for (const token of [
  "CQA_PLAN,CQA_TEST,CQA_DECIDE",
  "LAB_ANALYST,LAB_ANALYST,CERTIFICATE_OFFICER",
  '"LAB_ANALYST":"qacalc26"',
  '"CERTIFICATE_OFFICER":"qaapprove26"',
  "/work/co2-quality-analysis",
]) if (!declared.includes(token)) throw new Error(`missing CO2 quality analysis relay contract: ${token}`);
for (const token of ["const browserContexts = new Map()", "browserContexts.set(transition.actorCode, context)", "const warmup = await context.newPage()", "await page.close()"]) if (!engine.includes(token)) throw new Error(`missing warmed relay browser contract: ${token}`);
console.log("CO2_QUALITY_ANALYSIS_CONTRACT_PASS steps=3 actors=2 cleanup=1 warmedBrowser=1");
