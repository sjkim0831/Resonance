#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.env.RESONANCE_ROOT||process.cwd());
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const wrapper=read("ops/tests/run-company-registration-approval-business-e2e.sh");
const promoter=read("ops/scripts/promote-company-registration-approval-after-e2e.sh");
const browser=read("ops/scripts/company-registration-approval-route-e2e.mjs");
for(const token of ["run-company-onboarding-business-e2e.sh","run-member-approval-business-e2e.sh","actualContractCount:8","plannedActiveCount:0"]){if(!wrapper.includes(token))throw new Error(`wrapper missing ${token}`)}
for(const token of ["actual_verified<>8","planned_verified<>0","cases_passed<>5","planned_active<>0","automation_mode='ORCHESTRATOR'"]){if(!promoter.includes(token))throw new Error(`promoter missing ${token}`)}
if(!browser.includes("duplicateMount: 0")||!browser.includes("/join/companyRegisterComplete")||!browser.includes("/admin/member/company_list"))throw new Error("browser closure routes missing");
if(!promoter.includes("lower(split_part(c.route_path,'?',1))=lower(split_part(s.user_path,'?',1))")||!promoter.includes("lower(split_part(c.route_path,'?',1))=lower(split_part(s.admin_path,'?',1))"))throw new Error("promotion is not restricted to exact execution routes");
console.log("COMPANY_REGISTRATION_APPROVAL_COMPOSITION_PASS components=2 routes=4 cases=5 actual=8 planned=8");
