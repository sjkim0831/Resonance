#!/usr/bin/env node
import {readFileSync} from "node:fs";
const browser=readFileSync("ops/scripts/resonance-company-onboarding-e2e.mjs","utf8");
const wrapper=readFileSync("ops/tests/run-company-onboarding-business-e2e.sh","utf8");
for(const needle of ["publicLookupHandle","/join/api/company-status/detail","registeredContact","company status lookup handle missing","publicState","companyJoinStatusDetail?lookupHandle="]){if(!browser.includes(needle))throw new Error(`onboarding browser missing ${needle}`)}
if(browser.includes("companyJoinStatusDetail?bizNo="))throw new Error("legacy raw identity detail route remains");
if(!wrapper.includes("company-onboarding-latest.json")||!wrapper.includes("jq -c '{status,failure,cleanup"))throw new Error("wrapper does not report fail-closed evidence");
console.log("COMPANY_ONBOARDING_LOOKUP_HANDLE_CONTRACT_PASS");
