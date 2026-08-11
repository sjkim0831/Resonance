#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
const root=path.resolve(process.env.RESONANCE_ROOT||path.join(import.meta.dirname,"../.."));
const require=createRequire(path.join(root,"projects/carbonet-frontend/source/package.json"));
const {request}=require("@playwright/test");
const baseURL=String(process.env.CARBONET_RUNTIME_BASE_URL||"http://127.0.0.1").replace(/\/$/,"");
const account=String(process.env.CARBONET_SIMULATION_TEST_ACCOUNT||"qadata26");
const password=String(process.env.CARBONET_SIMULATION_TEST_PASSWORD||"");
if(!password)throw new Error("CARBONET_SIMULATION_TEST_PASSWORD is required");
const api=await request.newContext({baseURL,ignoreHTTPSErrors:true});
async function body(response,label,expected=200){const text=await response.text();if(response.status()!==expected)throw new Error(`${label} HTTP=${response.status()} expected=${expected}`);return text?JSON.parse(text):{};}
try{
 const login=await body(await api.post("/signin/actionLogin",{data:{userId:account,userPw:password,userSe:"USR"},failOnStatusCode:false}),"login");
 if(login.status==="loginFailure")throw new Error("login rejected");
 const portfolio=await body(await api.get("/home/api/emission-projects?size=100",{failOnStatusCode:false}),"portfolio");
 let projectId="";
 for(const project of portfolio.items||[]){const calculation=await api.get(`/home/api/emission-projects/${encodeURIComponent(project.id)}/calculation`,{failOnStatusCode:false});if(calculation.status()===200){const payload=await calculation.json();if(Array.isArray(payload.runs)&&payload.runs.length){projectId=String(project.id);break;}}}
 if(!projectId)throw new Error("no accessible calculated project");
 const key=`QA-SIM-${Date.now()}`;
 const data={scenarioCode:"BALANCED",techInvestment:51,efficiencyGain:63,renewableRate:36,ccusScale:21,idempotencyKey:key};
 const first=await body(await api.post(`/home/api/emission-projects/${projectId}/simulate`,{data,failOnStatusCode:false}),"simulate");
 const second=await body(await api.post(`/home/api/emission-projects/${projectId}/simulate`,{data,failOnStatusCode:false}),"idempotent replay");
 if(!first.scenarioId||first.scenarioId!==second.scenarioId||first.version!==second.version)throw new Error("idempotency mismatch");
 const workflow=await body(await api.get(`/home/api/emission-projects/${projectId}/simulation-workflow`,{failOnStatusCode:false}),"workflow");
 if(!Array.isArray(workflow.scenarios)||!workflow.scenarios.some(row=>Number(row.scenarioId)===Number(first.scenarioId)))throw new Error("saved scenario missing from workflow");
 console.log(JSON.stringify({status:"PASS",projectId,scenarioId:first.scenarioId,idempotencyKey:key,create:1,replay:1,read:1}));
}finally{await api.dispose();}
