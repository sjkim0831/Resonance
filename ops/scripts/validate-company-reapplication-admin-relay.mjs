#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root=path.resolve(process.env.RESONANCE_ROOT||path.join(import.meta.dirname,"../.."));
const require=createRequire(path.join(root,"projects/carbonet-frontend/source/package.json"));
const {chromium,request}=require("@playwright/test");
const base=String(process.env.CARBONET_BROWSER_BASE_URL||process.env.CARBONET_RUNTIME_BASE_URL||"http://127.0.0.1").replace(/\/$/,"");
const password=String(process.env.CARBONET_ADMIN_TEST_PASSWORD||"");
const adminUser=String(process.env.CARBONET_ADMIN_TEST_USER||"webmaster");
const casesFile=String(process.env.CARBONET_REAPPLICATION_BROWSER_CASES_FILE||"");
if(!password)throw new Error("CARBONET_ADMIN_TEST_PASSWORD is required");
if(!casesFile||!existsSync(casesFile))throw new Error("CARBONET_REAPPLICATION_BROWSER_CASES_FILE is required");
const cases=JSON.parse(readFileSync(casesFile,"utf8"));
if(!Array.isArray(cases)||cases.length!==2||cases.some(item=>!item.insttId||!item.companyName||!item.fileName)){
  throw new Error("two complete reapplication relay cases are required");
}

const api=await request.newContext({baseURL:base,ignoreHTTPSErrors:true});
const login=await api.post("/admin/login/actionLogin",{
  data:{userId:adminUser,userPw:password,userSe:"USR"},failOnStatusCode:false,
});
const loginBody=await login.json().catch(()=>({}));
if(login.status()!==200||loginBody.status!=="loginSuccess")throw new Error(`admin login failed status=${login.status()}`);

const executablePath=String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"").trim();
if(executablePath&&!existsSync(executablePath))throw new Error("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH does not exist");
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:["--no-sandbox"]});
const results=[];
try{
  for(const item of cases){
    const viewport=item.viewport==="mobile"?{width:390,height:844}:{width:1440,height:1000};
    const context=await browser.newContext({viewport,ignoreHTTPSErrors:true,storageState:await api.storageState(),acceptDownloads:true});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    const query=new URLSearchParams({searchKeyword:item.bizNo,sbscrbSttus:"A",pageIndex:"1"});
    const response=await page.goto(`${base}/admin/member/company-approve?${query}`,{waitUntil:"domcontentloaded",timeout:20000});
    await page.getByRole("heading",{name:"회원사 가입승인",exact:true}).waitFor({state:"visible",timeout:15000});
    const businessNumberPattern=new RegExp(item.bizNo.split("").join("\\D*"));
    const row=page.getByRole("row").filter({hasText:businessNumberPattern});
    await row.waitFor({state:"visible",timeout:15000});
    if(await row.count()!==1)throw new Error(`${item.viewport} approval row count mismatch after load`);
    await row.getByText(item.fileName,{exact:true}).waitFor({state:"visible",timeout:10000});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
    if((response?.status()||0)>=400||errors.length||overflow)throw new Error(`${item.viewport} approval screen contract failed`);

    if(item.viewport==="desktop"){
      await Promise.all([
        page.waitForResponse(candidate=>new URL(candidate.url()).pathname==="/admin/api/admin/member/company-approve/action"&&candidate.request().method()==="POST"&&candidate.status()===200,{timeout:15000}),
        row.getByRole("button",{name:"승인",exact:true}).click(),
      ]);
    }else{
      await row.getByRole("button",{name:"검토",exact:true}).click();
      const dialog=page.getByRole("dialog",{name:"회원사 가입 신청 상세 검토"});
      await dialog.getByRole("textbox",{name:"반려 사유"}).fill("QA 재신청 증빙 보완 필요");
      await Promise.all([
        page.waitForResponse(candidate=>new URL(candidate.url()).pathname==="/admin/api/admin/member/company-approve/action"&&candidate.request().method()==="POST"&&candidate.status()===200,{timeout:15000}),
        dialog.getByRole("button",{name:"반려",exact:true}).click(),
      ]);
    }
    results.push({viewport:item.viewport,reviewRow:1,evidenceVisible:1,decision:item.viewport==="desktop"?"APPROVE":"REJECT",responsive:1});
    await context.close();
  }
}finally{
  await browser.close();
  await api.dispose();
}

console.log(JSON.stringify({status:"PASS",adminRelay:1,authenticatedAdmin:1,decisions:2,desktop:1,mobile:1,results}));
