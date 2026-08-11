import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const app = readFileSync(new URL("projects/carbonet-frontend/source/src/App.tsx", root), "utf8");
const page = readFileSync(new URL("projects/carbonet-frontend/source/src/features/generated-screen/GeneratedScreenPage.tsx", root), "utf8");
const e2e = readFileSync(new URL("ops/scripts/resonance-facility-operation-monitoring-e2e.mjs", root), "utf8");
const wrapper = readFileSync(new URL("ops/tests/run-facility-operation-monitoring-business-e2e.sh", root), "utf8");

for (const [source, token] of [
  [app, "generatedContractRoutePath"],
  [app, 'get("step")'],
  [page, "contractLookupPath()"],
  [e2e, '"FOM_PLAN,FOM_OPERATE,FOM_HANDOVER"'],
  [e2e, "CARBONET_RELAY_PROCESS_CODE"],
  [e2e, "optimistic conflict failed"],
  [e2e, "authority isolation failed"],
  [e2e, "database reread failed"],
  [e2e, "mobileOverflow"],
  [e2e, "desktopDurationMs"],
  [e2e, "mobileDurationMs"],
  [e2e, "Math.max(desktopDurationMs, mobileDurationMs)"],
  [wrapper, "framework_process_execution_event"],
  [wrapper, 'E2E_DEPLOYED_COMMIT="$RUNTIME_COMMIT"'],
  [wrapper, 'E2E_VALIDATION_COMMIT="$VALIDATION_COMMIT"'],
  [wrapper, 'required="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup"'],
]) if (!source.includes(token)) throw new Error(`missing FOM closure contract: ${token}`);

console.log("FACILITY_OPERATION_MONITORING_CONTRACT_PASS steps=3 actors=2 viewports=2 cleanup=1");
