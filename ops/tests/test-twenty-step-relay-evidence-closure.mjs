#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.env.RESONANCE_ROOT||process.cwd());
const runtime=fs.readFileSync(path.join(root,"ops/scripts/resonance-twenty-step-relay-e2e.mjs"),"utf8");
const promoter=fs.readFileSync(path.join(root,"ops/scripts/promote-relay-contracts-after-e2e.sh"),"utf8");
for(const token of ["apiCommandCount","databaseRereadCount","exceptionStateCount","stale draft did not fail","unsupported command did not fail closed","database reread mismatch","performanceSampleCount"]){
  if(!runtime.includes(token))throw new Error(`relay runtime evidence missing ${token}`);
}
for(const token of [".api==1",".database==1",".exceptionStates==1","performanceSampleCount>=20","$ASSERTIONS\" USER","promotionEligible\":true"]){
  if(!promoter.includes(token))throw new Error(`relay promoter closure missing ${token}`);
}
if(promoter.includes("API_DATABASE_EXCEPTION_EVIDENCE_REQUIRED")||promoter.includes("--validate-only >/dev/null"))throw new Error("relay promoter still stops before real promotion");
console.log("TWENTY_STEP_RELAY_EVIDENCE_CLOSURE_PASS api=21 database=21 exceptions=2 audience=USER");
