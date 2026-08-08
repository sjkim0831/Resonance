#!/usr/bin/env node
import { readFileSync } from "node:fs";
const harness=readFileSync("ops/tests/run-member-approval-business-e2e.sh","utf8");
const browser=readFileSync("ops/scripts/member-approval-e2e.mjs","utf8");
const promoter=readFileSync("ops/scripts/promote-member-approval-after-e2e.sh","utf8");
for(const needle of ["result_status='SUCCESS'","RESIDUE","trap cleanup EXIT","select pg_is_in_recovery()"]){if(!harness.includes(needle))throw new Error(`harness missing ${needle}`)}
for(const needle of ["anonymous access not denied","unsupported approval action","responsive","accessible","상세 검토","QA 자동 검증 보완 요청"]){if(!browser.includes(needle))throw new Error(`browser missing ${needle}`)}
for(const code of ["MEMBER_APPROVAL_AUTH","MEMBER_APPROVAL_EXCEPTION","MEMBER_APPROVAL_HAPPY","MEMBER_APPROVAL_ISOLATION","MEMBER_APPROVAL_RECOVERY"]){if(!promoter.includes(code))throw new Error(`promoter missing ${code}`)}
if(!promoter.includes("BEGIN;")||!promoter.includes("COMMIT;")||!promoter.includes("a<>5 OR r<>5"))throw new Error("atomic promoter guard missing");
console.log("MEMBER_APPROVAL_E2E_CONTRACT_PASS cases=5");
