#!/usr/bin/env node
import {readFileSync} from "node:fs";
const b=readFileSync("ops/scripts/member-administration-e2e.mjs","utf8"),w=readFileSync("ops/tests/run-member-administration-business-e2e.sh","utf8"),p=readFileSync("ops/scripts/promote-member-administration-after-e2e.sh","utf8");
for(const x of ["duplicate registration not rejected","deactivate:1","reactivate:1","anonymous register not denied","/admin/member/edit"]){if(!b.includes(x))throw new Error(`browser missing ${x}`)}
for(const x of ["trap cleanup EXIT","business_change_log","comtnuserfeatureoverride","RESIDUE","AUDITS"]){if(!w.includes(x))throw new Error(`wrapper missing ${x}`)}
for(const x of ["MEMBER_ADMINISTRATION_AUTH","MEMBER_ADMINISTRATION_EXCEPTION","MEMBER_ADMINISTRATION_HAPPY","MEMBER_ADMINISTRATION_ISOLATION","MEMBER_ADMINISTRATION_RECOVERY","a<>5 OR r<>5"]){if(!p.includes(x))throw new Error(`promoter missing ${x}`)}
console.log("MEMBER_ADMINISTRATION_E2E_CONTRACT_PASS cases=5 routes=6");
