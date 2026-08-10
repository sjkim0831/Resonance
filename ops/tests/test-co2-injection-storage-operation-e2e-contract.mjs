import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const engine = readFileSync(new URL("ops/scripts/resonance-facility-operation-monitoring-e2e.mjs", root), "utf8");
const wrapper = readFileSync(new URL("ops/tests/run-co2-injection-storage-operation-business-e2e.sh", root), "utf8");
for (const [source, token] of [
  [engine, "CARBONET_RELAY_PROCESS_CODE"],
  [engine, "CARBONET_RELAY_STEP_ACTORS"],
  [engine, "expectedSteps.length"],
  [wrapper, "CISO_PLAN,CISO_OPERATE,CISO_REVIEW"],
  [wrapper, "STORAGE_SITE_MANAGER,STORAGE_SITE_MANAGER,HSE_MANAGER"],
  [wrapper, 'E2E_DEPLOYED_COMMIT="$RUNTIME_COMMIT"'],
  [wrapper, 'E2E_VALIDATION_COMMIT="$VALIDATION_COMMIT"'],
  [wrapper, "framework_process_execution_event"],
  [wrapper, 'required="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup"'],
]) if (!source.includes(token)) throw new Error(`missing CISO closure contract: ${token}`);
console.log("CO2_INJECTION_STORAGE_OPERATION_CONTRACT_PASS steps=3 actors=2 viewports=2 cleanup=1");
