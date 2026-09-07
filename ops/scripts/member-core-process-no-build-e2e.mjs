#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";

const root=path.resolve(process.env.MEMBER_CORE_PLAYWRIGHT_ROOT||"/opt/Resonance/var/deploy-worktrees/runtime-build");
const require=createRequire(path.join(root,"projects/carbonet-frontend/source/package.json"));
const {chromium,request}=require("@playwright/test");
const apiBase=String(process.env.MEMBER_CORE_API_BASE||"http://127.0.0.1:18080");
const uiBase=String(process.env.MEMBER_CORE_UI_BASE||"https://production.172.16.1.232.nip.io");
const password=String(process.env.CARBONET_ADMIN_TEST_PASSWORD||"");
if(!password) throw new Error("CARBONET_ADMIN_TEST_PASSWORD_REQUIRED");

const api=await request.newContext({baseURL:apiBase,ignoreHTTPSErrors:true});
const login=await api.post("/admin/login/actionLogin",{data:{userId:"webmaster",userPw:password,userSe:"USR"},failOnStatusCode:false});
const loginBody=await login.json().catch(()=>({}));
if(login.status()!==200||loginBody.status!=="loginSuccess") throw new Error(`ADMIN_LOGIN_${login.status()}`);
const host=new URL(uiBase);
const adminState=await api.storageState();
adminState.cookies=(adminState.cookies||[]).map(cookie=>({...cookie,domain:host.hostname,secure:host.protocol==="https:"}));

const pages=[
  ...[1,2,3,4,5].map(step=>({process:"MEMBER_REGISTRATION",page:`JOIN_STEP_${step}`,audience:"PUBLIC",path:`/join/step${step}?guide=1&processCode=MEMBER_REGISTRATION&stepCode=MEMBER_REGISTRATION_S${step}`,expectedPath:step===1?"/join/step1":"/join/step1",guarded:step>1})),
  {process:"MEMBER_APPROVAL",page:"MEMBER_APPROVAL_BOARD",audience:"ADMIN",path:"/admin/member/approve"},
  {process:"ACCOUNT_WITHDRAWAL",page:"WITHDRAWAL_REQUEST",audience:"ADMIN",path:"/planned/member/account-withdrawal/account-withdrawal-s1?processCode=ACCOUNT_WITHDRAWAL&stepCode=ACCOUNT_WITHDRAWAL_S1"},
  {process:"ACCOUNT_WITHDRAWAL",page:"WITHDRAWAL_STATUS",audience:"ADMIN",path:"/planned/member/account-withdrawal/account-withdrawal-s2?processCode=ACCOUNT_WITHDRAWAL&stepCode=ACCOUNT_WITHDRAWAL_S2"},
  {process:"ACCOUNT_WITHDRAWAL",page:"WITHDRAWAL_REVIEW",audience:"ADMIN",path:"/admin/planned/member/account-withdrawal/account-withdrawal-s3?processCode=ACCOUNT_WITHDRAWAL&stepCode=ACCOUNT_WITHDRAWAL_S3"},
  {process:"ACCOUNT_WITHDRAWAL",page:"WITHDRAWAL_COMPLETE",audience:"ADMIN",path:"/planned/member/account-withdrawal/account-withdrawal-s4?processCode=ACCOUNT_WITHDRAWAL&stepCode=ACCOUNT_WITHDRAWAL_S4"},
];
const viewports=[{name:"desktop",width:1440,height:1000},{name:"mobile",width:390,height:844}];
const browser=await chromium.launch({headless:true});
const results=[];
try{
  for(const pageDef of pages) for(const viewport of viewports){
    const context=await browser.newContext({viewport,ignoreHTTPSErrors:true,storageState:pageDef.audience==="ADMIN"?adminState:undefined});
    const page=await context.newPage(); const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    const started=Date.now();
    const response=await page.goto(`${uiBase}${pageDef.path}`,{waitUntil:"domcontentloaded",timeout:20000});
    await page.locator("body").waitFor({state:"visible",timeout:12000});
    await page.waitForLoadState("networkidle",{timeout:5000}).catch(()=>{});
    await page.waitForTimeout(300);
    const state=await page.evaluate(()=>({
      text:(document.body?.innerText||"").trim().length,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
      title:document.title,
      pathname:location.pathname,
      loginRedirect:/\/signin\/loginView/.test(location.pathname),
    }));
    const expectedPath=pageDef.expectedPath||new URL(`${uiBase}${pageDef.path}`).pathname;
    if(response?.status()!==200||state.text<20||state.overflow||errors.length||state.loginRedirect||state.pathname!==expectedPath) throw new Error(`MEMBER_PAGE_${pageDef.page}_${viewport.name}_${response?.status()}_${JSON.stringify(state)}_${errors.join("|")}`);
    results.push({...pageDef,outcome:pageDef.guarded?"PREREQUISITE_GUARD_PASSED":"RENDERED",viewport:viewport.name,status:200,durationMs:Date.now()-started,textLength:state.text});
    await context.close();
  }
}finally{await browser.close();await api.dispose();}
const durations=results.map(item=>item.durationMs).sort((a,b)=>a-b);
console.log(JSON.stringify({status:"PASS",processCount:3,pageCount:pages.length,routeCount:results.length,renderedRouteCount:results.filter(item=>item.outcome==="RENDERED").length,prerequisiteGuardCount:results.filter(item=>item.outcome==="PREREQUISITE_GUARD_PASSED").length,desktop:1,mobile:1,noOverflow:1,noPageErrors:1,p95Ms:durations[Math.ceil(durations.length*.95)-1],results}));
