import { createRequire } from "node:module";
import path from "node:path";

const root="/opt/Resonance/var/deploy-worktrees/runtime-build";
const require=createRequire(path.join(root,"projects/carbonet-frontend/source/package.json"));
const { request }=require("@playwright/test");
const base="http://172.16.1.232";
const password=String(process.env.CARBONET_ADMIN_TEST_PASSWORD||"");
const adminUser=String(process.env.CARBONET_ADMIN_TEST_USER||"webmaster");
if(!password)throw new Error("CARBONET_ADMIN_TEST_PASSWORD_REQUIRED");
const seed=await request.newContext({baseURL:base});
const login=await seed.post("/admin/login/actionLogin",{data:{userId:adminUser,userPw:password,userSe:"USR"},failOnStatusCode:false});
const loginBody=await login.json().catch(()=>({}));
if(login.status()!==200||loginBody.status!=="loginSuccess")throw new Error(`ADMIN_LOGIN_${login.status()}`);
const adminState=await seed.storageState();
async function contextFor(userId) { const api=await request.newContext({baseURL:base,storageState:adminState}); if(userId){const response=await api.post("/signin/testAccountSwitch",{data:{userId},headers:{"X-Carbonet-Test-Mode":"1"},failOnStatusCode:false});if(response.status()!==200)throw new Error(`SWITCH_${userId}_${response.status()}`);}return api; }
async function call(api,method,url,data,expected=[200]) { const response=await api.fetch(url,{method,data,headers:{"X-Carbonet-Test-Mode":"1"},failOnStatusCode:false});const body=await response.json().catch(()=>({}));if(!expected.includes(response.status()))throw new Error(`${method}_${url}_${response.status()}_${body.message||""}`);return body; }
const admin=await contextFor(); const owner=await contextFor("qaowner26"); const successor=await contextFor("qaassign26");
let projectId="",delegationId="",deleted=false;
try {
  const stale=await call(owner,"GET","/home/api/emission-projects?keyword=QA%20delegation%20delegation-e2e-&size=100");
  for(const item of stale.items||[]) await call(owner,"DELETE",`/home/api/emission-projects/${encodeURIComponent(item.id)}`);
  const options=await call(owner,"GET","/home/api/emission-projects/options");
  if(!options?.readiness?.ready||!options?.sites?.length) throw new Error("PROJECT_OPTIONS_NOT_READY");
  const marker=`delegation-e2e-${Date.now()}`; const year=String(new Date().getUTCFullYear()); const site=String(options.sites[0]);
  const created=await call(owner,"POST","/home/api/emission-projects",{clientRequestId:marker,name:`QA delegation ${marker}`,site,owner:"qaowner26",dataOwner:"qadata26",calculator:"qacalc26",verifier:"qaverify26",approver:"qaapprove26",reportingYear:year,periodStart:`${year}-01-01`,periodEnd:`${year}-12-31`,dueDate:`${year}-12-31`,scopes:["Scope 1","Scope 2"],organizationBoundary:"OPERATIONAL_CONTROL",emissionStandard:"ISO_14064_1",methodologyVersion:"2018",verificationLevel:"LIMITED",collectionCycle:"MONTHLY",materialityThreshold:"5"});
  projectId=String(created.id||""); if(!projectId)throw new Error("PROJECT_ID_MISSING");
  const key=`qa-delegation-${marker}`;
  const requested=await call(owner,"POST","/home/api/company-manager-delegations",{projectId,successorAccountId:"qaassign26",reason:"QA 원자적 관리자 인계 검증",idempotencyKey:key});
  delegationId=String(requested.delegationId||""); if(!delegationId||requested.status!=="REQUESTED")throw new Error("REQUEST_STATE_INVALID");
  const duplicate=await call(owner,"POST","/home/api/company-manager-delegations",{projectId,successorAccountId:"qaassign26",reason:"QA 원자적 관리자 인계 검증",idempotencyKey:key});
  if(duplicate.delegationId!==delegationId)throw new Error("IDEMPOTENCY_FAILED");
  await call(owner,"POST",`/home/api/company-manager-delegations/${delegationId}/decision`,{decision:"APPROVE"},[403]);
  const approved=await call(admin,"POST",`/home/api/company-manager-delegations/${delegationId}/decision`,{decision:"APPROVE"});
  if(approved.status!=="APPROVED")throw new Error("APPROVAL_STATE_INVALID");
  const completed=await call(owner,"POST",`/home/api/company-manager-delegations/${delegationId}/complete`);
  if(completed.status!=="COMPLETED")throw new Error("COMPLETION_STATE_INVALID");
  const successorView=await call(successor,"GET",`/home/api/company-manager-delegations?projectId=${encodeURIComponent(projectId)}`);
  if(successorView.canRequest!==true||!successorView.items.some(item=>item.delegationId===delegationId&&item.status==="COMPLETED"))throw new Error("SUCCESSOR_HANDOVER_NOT_VISIBLE");
  await call(successor,"DELETE",`/home/api/emission-projects/${encodeURIComponent(projectId)}`); deleted=true;
  console.log(JSON.stringify({status:"PASS",promotionEligible:false,processCode:"COMPANY_MANAGER_DELEGATION",stepCount:3,caseCount:5,request:1,idempotency:1,authorityDenial:1,approval:1,atomicHandover:1,successorVisible:1,projectCleanup:1,cleanup:0,steps:{CMD_REQUEST:{result:"PASSED"},CMD_APPROVE:{result:"PASSED"},CMD_HANDOVER:{result:"PASSED"}},cases:{COMPANY_MANAGER_DELEGATION_AUTHORITY:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_EXCEPTION:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_HAPPY:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_ISOLATION:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_RECOVERY:{result:"PASSED"}}}));
} finally {
  if(projectId&&!deleted) { await successor.delete(`/home/api/emission-projects/${encodeURIComponent(projectId)}`,{headers:{"X-Carbonet-Test-Mode":"1"},failOnStatusCode:false}).catch(()=>{}); await owner.delete(`/home/api/emission-projects/${encodeURIComponent(projectId)}`,{headers:{"X-Carbonet-Test-Mode":"1"},failOnStatusCode:false}).catch(()=>{}); }
  await Promise.all([seed.dispose(),admin.dispose(),owner.dispose(),successor.dispose()]);
}
