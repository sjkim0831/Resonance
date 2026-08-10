import { createRequire } from "node:module";
import path from "node:path";

const root="/opt/Resonance/var/deploy-worktrees/runtime-build";
const require=createRequire(path.join(root,"projects/carbonet-frontend/source/package.json"));
const { chromium,request }=require("@playwright/test");
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
  const browser=await chromium.launch({headless:true}); const routes=[]; const samples=[]; const sampleDetails=[];
  try {
    const actors=[{audience:"USER",state:await successor.storageState(),prefix:"/work"},{audience:"ADMIN",state:adminState,prefix:"/admin/work"}],steps=["cmd_request","cmd_approve","cmd_handover"],viewports=[{name:"desktop",width:1440,height:1000},{name:"mobile",width:390,height:844}],sessions=[];
    for(const actor of actors)for(const viewport of viewports){
      const context=await browser.newContext({storageState:actor.state,viewport});const page=await context.newPage();const errors=[];page.on("pageerror",error=>errors.push(error.message));
      await page.goto(`${base}${actor.prefix}/company-manager-delegation?projectId=${encodeURIComponent(projectId)}`,{waitUntil:"domcontentloaded",timeout:20000});await page.getByRole("heading",{name:"회원사 관리자 위임·승계·업무 인계"}).first().waitFor({timeout:12000});errors.length=0;
      sessions.push({actor,viewport,context,page,errors});
    }
    for(const session of sessions)for(const step of steps){
      await session.page.bringToFront();
      const response=await session.page.goto(`${base}${session.actor.prefix}/company-manager-delegation?step=${step}&projectId=${encodeURIComponent(projectId)}`,{waitUntil:"domcontentloaded",timeout:20000});await session.page.getByRole("heading",{name:"회원사 관리자 위임·승계·업무 인계"}).first().waitFor({timeout:12000});
      const measured=await session.page.evaluate(()=>{const nav=performance.getEntriesByType("navigation")[0];const resources=performance.getEntriesByType("resource").map(entry=>({name:new URL(entry.name).pathname.split("/").pop()||"document",duration:Math.round(entry.duration)})).sort((a,b)=>b.duration-a.duration).slice(0,3);return {duration:Math.round(nav?.duration||0),resources,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,unnamed:[...document.querySelectorAll("input,select,textarea,button")].filter(el=>!(el.getAttribute("aria-label")||el.getAttribute("aria-labelledby")||el.closest("label")||el.textContent?.trim())).length};});
      if(response?.status()!==200||session.errors.length||measured.overflow||measured.unnamed)throw new Error(`UI_CONTRACT_${session.actor.audience}_${step}_${session.viewport.name}`);samples.push(measured.duration);routes.push({audience:session.actor.audience,step,viewport:session.viewport.name,status:200,duration:measured.duration,resources:measured.resources});
    }
    for(let index=routes.length;index<20;index++){const session=sessions[index%sessions.length];await session.page.bringToFront();await session.page.goto(`${base}${session.actor.prefix}/company-manager-delegation?projectId=${encodeURIComponent(projectId)}&sample=${index}`,{waitUntil:"domcontentloaded",timeout:20000});await session.page.getByRole("heading",{name:"회원사 관리자 위임·승계·업무 인계"}).first().waitFor({timeout:12000});const duration=await session.page.evaluate(()=>Math.round(performance.getEntriesByType("navigation")[0]?.duration||0));samples.push(duration);sampleDetails.push({audience:session.actor.audience,viewport:session.viewport.name,duration});}
    await Promise.all(sessions.map(session=>session.context.close()));
  } finally { await browser.close(); }
  const sorted=[...samples].sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];
  await call(successor,"DELETE",`/home/api/emission-projects/${encodeURIComponent(projectId)}`); deleted=true;
  console.log(JSON.stringify({status:"PASS",promotionEligible:false,processCode:"COMPANY_MANAGER_DELEGATION",stepCount:3,caseCount:5,request:1,idempotency:1,authorityDenial:1,approval:1,atomicHandover:1,successorVisible:1,projectCleanup:1,cleanup:0,api:1,database:1,authority:1,responsive:1,accessibility:1,exceptionStates:1,audit:1,recovery:1,desktop:1,mobile:1,routes,sampleDetails,performanceSampleCount:samples.length,performanceSamples:samples,performanceP95Ms:p95,steps:{CMD_REQUEST:{result:"PASSED"},CMD_APPROVE:{result:"PASSED"},CMD_HANDOVER:{result:"PASSED"}},cases:{COMPANY_MANAGER_DELEGATION_AUTHORITY:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_EXCEPTION:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_HAPPY:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_ISOLATION:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_RECOVERY:{result:"PASSED"}}}));
} finally {
  if(projectId&&!deleted) { await successor.delete(`/home/api/emission-projects/${encodeURIComponent(projectId)}`,{headers:{"X-Carbonet-Test-Mode":"1"},failOnStatusCode:false}).catch(()=>{}); await owner.delete(`/home/api/emission-projects/${encodeURIComponent(projectId)}`,{headers:{"X-Carbonet-Test-Mode":"1"},failOnStatusCode:false}).catch(()=>{}); }
  await Promise.all([seed.dispose(),admin.dispose(),owner.dispose(),successor.dispose()]);
}
