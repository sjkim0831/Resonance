#!/usr/bin/env node
import {readFileSync} from "node:fs";
const browser=readFileSync("ops/scripts/resonance-company-onboarding-e2e.mjs","utf8");
const wrapper=readFileSync("ops/tests/run-company-onboarding-business-e2e.sh","utf8");
const registerPage=readFileSync("projects/carbonet-frontend/source/src/features/join-company-register/JoinCompanyRegisterMigrationPage.tsx","utf8");
const actorProcessPage=readFileSync("projects/carbonet-frontend/source/src/features/actor-process-governance/ActorProcessGovernancePage.tsx","utf8");
for(const needle of ["publicLookupHandle","/join/api/company-status/detail","registeredContact","company status lookup handle missing","publicState","companyJoinStatusDetail?lookupHandle="]){if(!browser.includes(needle))throw new Error(`onboarding browser missing ${needle}`)}
if(browser.includes("companyJoinStatusDetail?bizNo="))throw new Error("legacy raw identity detail route remains");
if(!wrapper.includes("company-onboarding-latest.json")||!wrapper.includes("jq -c '{status,failure,cleanup"))throw new Error("wrapper does not report fail-closed evidence");
if(!browser.includes("performanceSampleCount: 0")||!browser.includes("timings.push(loadMs)")||!browser.includes("evidence.performanceSampleCount = timings.length"))throw new Error("same-envelope performance samples missing");
if(!browser.includes('performance.getEntriesByType("navigation")')||!browser.includes("navigation.domContentLoadedEventEnd - navigation.startTime"))throw new Error("browser navigation performance measurement missing");
if(!browser.includes("const routeContextCache = new Map()")||!browser.includes("routeContextCache.get(contextKey)")||!browser.includes("await page.close()"))throw new Error("actor and viewport browser-session reuse is missing");
if(browser.includes("await context.close();"))throw new Error("route checks still discard the SPA session cache");
if(!browser.includes('validationCommit: ""')||!browser.includes("process.env.E2E_VALIDATION_COMMIT || evidence.sourceCommit"))throw new Error("validation harness commit identity missing");
if(!wrapper.includes("carbonet-main-success.commit")||!wrapper.includes("export E2E_VALIDATION_COMMIT"))throw new Error("wrapper does not bind evidence to the processed harness commit");
if(!registerPage.includes("aria-label={card.title}"))throw new Error("membership radios do not expose their visible card title as the accessible name");
if(!actorProcessPage.includes("const IntegratedWorkOperationsMap = lazy(")||!actorProcessPage.includes("<Suspense fallback="))throw new Error("actor-process initial bundle is not split by active workspace");
console.log("COMPANY_ONBOARDING_LOOKUP_HANDLE_CONTRACT_PASS");
