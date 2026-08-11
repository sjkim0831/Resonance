import fs from "node:fs";
const source=fs.readFileSync(new URL("../../projects/carbonet-frontend/source/src/features/emission-regulatory-submission/RegulatorySubmissionPage.tsx",import.meta.url),"utf8");
const required=["REGULATORY_SUBMISSION_S1","REGULATORY_SUBMISSION_S2","REGULATORY_SUBMISSION_S3","REGULATORY_SUBMISSION_S4","data-qa-coordinate","현재 절차 · {stepContext.order}/4","완료 조건: {stepContext.completion}","담당자","params.get(\"step\")"];
for(const token of required){if(!source.includes(token))throw new Error(`REGULATORY_STEP_CONTEXT_MISSING ${token}`)}
if((source.match(/REGULATORY_SUBMISSION_S[1-4]:\{/g)||[]).length!==4)throw new Error("REGULATORY_STEP_CONTEXT_COUNT");
console.log(`REGULATORY_STEP_CONTEXT_PASS assertions=${required.length+1}`);
