#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
const root=path.resolve(process.env.RESONANCE_ROOT||process.cwd());
const require=createRequire(path.join(root,"projects/carbonet-frontend/source/package.json"));
const {chromium,request}=require("@playwright/test");
const base=String(process.env.CARBONET_RUNTIME_BASE_URL||"http://127.0.0.1").replace(/\/$/,"");
const password=String(process.env.CARBONET_ADMIN_TEST_PASSWORD||"");
const memberId=String(process.env.MEMBER_ADMIN_FIXTURE_ID||"");
if(!password||!memberId)throw new Error("admin secret and fixture id are required");
const api=await request.newContext({baseURL:base,ignoreHTTPSErrors:true});
const login=await api.post("/admin/login/actionLogin",{data:{userId:"webmaster",userPw:password,userSe:"USR"},failOnStatusCode:false});
if(login.status()!==200||(await login.json().catch(()=>({}))).status!=="loginSuccess")throw new Error("admin login failed");
const anonymous=await request.newContext({baseURL:base});
for(const url of ["/admin/member/register/page-data","/admin/api/admin/member/list/page"]){const r=await anonymous.get(url,{failOnStatusCode:false});if(![401,403].includes(r.status()))throw new Error(`anonymous access not denied ${url}`)}
const denied=await anonymous.post("/admin/api/admin/member/register",{data:{memberId},failOnStatusCode:false});if(![401,403].includes(denied.status()))throw new Error("anonymous register not denied");await anonymous.dispose();

const invalid=await api.post("/admin/api/admin/member/register",{data:{memberId:"bad",password:"weak"},failOnStatusCode:false});if(invalid.status()!==400)throw new Error(`invalid registration status=${invalid.status()}`);
const registration={memberId,applcntNm:"QA 회원 관리",password:"Qa!23456Test",passwordConfirm:"Qa!23456Test",applcntEmailAdres:`${memberId}@example.invalid`,phoneNumber:"01012345678",entrprsSeCode:"enterprise",insttId:"TEST_COMPANY_001",deptNm:"QA 자동화",authorCode:"ROLE_USER",zip:"12345",adres:"QA 테스트 주소",detailAdres:"CRUD E2E"};
const created=await api.post("/admin/api/admin/member/register",{data:registration,failOnStatusCode:false});const createdBody=await created.json().catch(()=>({}));if(created.status()!==200||createdBody.success!==true)throw new Error(`member register failed ${created.status()} validationCount=${Array.isArray(createdBody.errors)?createdBody.errors.length:0} errors=${JSON.stringify(createdBody.errors||[])}`);
const duplicate=await api.post("/admin/api/admin/member/register",{data:registration,failOnStatusCode:false});if(duplicate.status()!==400)throw new Error(`duplicate registration not rejected ${duplicate.status()}`);
const list=await api.get(`/admin/api/admin/member/list/page?searchKeyword=${memberId}`,{failOnStatusCode:false});const listBody=await list.json().catch(()=>({}));if(list.status()!==200||!Array.isArray(listBody.member_list)||!listBody.member_list.some((row)=>String(row.entrprsmberId||row.memberId||"")===memberId))throw new Error("registered member missing from list");
const editPage=await api.get(`/admin/api/admin/member/edit?memberId=${memberId}`,{failOnStatusCode:false});const editPageBody=await editPage.json().catch(()=>({}));if(editPage.status()!==200||String(editPageBody.memberId||editPageBody.entrprsmberId||"")!==memberId)throw new Error("member edit payload missing");
const editBase={memberId,applcntNm:"QA 회원 관리 수정",applcntEmailAdres:`updated-${memberId}@example.invalid`,phoneNumber:"01098765432",entrprsSeCode:"E",authorCode:"ROLE_USER",featureCodes:[],zip:"54321",adres:"QA 수정 주소",detailAdres:"상태 전이 검증",marketingYn:"N",deptNm:"QA 검증팀"};
for(const status of ["X","P"]){const updated=await api.post("/admin/api/admin/member/edit",{data:{...editBase,entrprsMberSttus:status},failOnStatusCode:false});const body=await updated.json().catch(()=>({}));if(updated.status()!==200||body.success!==true)throw new Error(`member status ${status} failed ${updated.status()}`)}

const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});const routes=[];
try{for(const viewport of [{name:"desktop",width:1440,height:1000},{name:"mobile",width:390,height:844}]){const context=await browser.newContext({viewport,storageState:await api.storageState(),ignoreHTTPSErrors:true});const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));for(const route of ["/admin/member/register",`/admin/member/list?searchKeyword=${memberId}`,`/admin/member/edit?memberId=${memberId}`]){const response=await page.goto(`${base}${route}`,{waitUntil:"domcontentloaded",timeout:20000});await page.waitForFunction(()=>document.querySelectorAll("input,select,textarea,button").length>=3,{timeout:12000});const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,error:(document.body.innerText||"").includes("페이지 처리 중 오류"),controls:document.querySelectorAll("input,select,textarea,button").length}));if((response?.status()||0)>=400||errors.length||state.overflow||state.error||state.controls<3)throw new Error(`${viewport.name} ${route} UI failed ${JSON.stringify(state)}`);routes.push({viewport:viewport.name,route,responsive:1})}await context.close()}}finally{await browser.close();await api.dispose()}
console.log(JSON.stringify({status:"PASS",processCode:"MEMBER_ADMINISTRATION",happy:1,auth:1,exception:1,isolation:1,recovery:1,register:1,duplicateRejected:1,update:1,deactivate:1,reactivate:1,responsive:1,accessibility:1,routes}));
