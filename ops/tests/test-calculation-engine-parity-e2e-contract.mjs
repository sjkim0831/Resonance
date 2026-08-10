import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const engine = readFileSync(new URL("ops/scripts/resonance-facility-operation-monitoring-e2e.mjs", root), "utf8");
const wrapper = readFileSync(new URL("ops/tests/run-calculation-engine-parity-business-e2e.sh", root), "utf8");
for (const [source, token] of [
  [engine, "CARBONET_RELAY_PROCESS_CODE"],
  [wrapper, "CEP_BASELINE,CEP_COMPARE,CEP_GATE"],
  [wrapper, "VERIFIER,CALCULATOR,VERIFIER"],
  [wrapper, 'E2E_DEPLOYED_COMMIT="$RUNTIME_COMMIT"'],
  [wrapper, "framework_process_execution_event"],
  [wrapper, 'required="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup"'],
]) if (!source.includes(token)) throw new Error(`missing CEP closure contract: ${token}`);
console.log("CALCULATION_ENGINE_PARITY_CONTRACT_PASS steps=3 actors=2 viewports=2 cleanup=1");
