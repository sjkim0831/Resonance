'use strict';
const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),{performance}=require('perf_hooks');
const N=Number(process.argv[2]||5),source=fs.readFileSync(__dirname+'/composer.js','utf8');
const start=source.indexOf('function dims'),end=source.indexOf('function focusSelection',start);
const production=source.slice(start,end);
const instances=[{id:'floor',templateId:'floor',position:[0,-.15,0],rotation:[0,0,0],scale:[1,1,1],parameters:{width:100,length:100,height:.15}}];
for(let i=0;i<2;i++)instances.push({id:'wall-'+i,templateId:'wall',position:[0,0,i?-8:8],rotation:[0,0,0],scale:[1,1,1],parameters:{width:26,length:.2,height:3.2}});
instances.push({id:'aisle-0',templateId:'aisle',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],parameters:{width:2,length:14,height:.05}});
for(let i=0;i<700;i++)instances.push({id:'fixture-'+String(i+1).padStart(3,'0'),assetId:'A'+String(i+1).padStart(3,'0'),position:null,rotation:[0,0,0],scale:[1,1,1],parameters:{}});
const selected=new Set(instances.filter(x=>x.assetId).slice(0,N).map(x=>x.id)),assetMap=new Map();
for(const x of instances.filter(x=>x.assetId)){const k=Number(x.id.slice(-3));assetMap.set(x.assetId,{model_xyz_m:[1+(k%4),1,1+(k%3)]});}
const ctx={console,performance,doc:{instances,settings:{grid:.5,snap:true}},selected,templates:new Map([['floor',{id:'floor',width:100,length:100,height:.15}],['wall',{id:'wall',width:26,length:.2,height:3.2}],['aisle',{id:'aisle',width:2,length:14,height:.05}]]),assetMap,snap:v=>Math.round(v/.5)*.5,$:()=>({disabled:false}),status:()=>{},window:{addEventListener:()=>{}},document:{querySelector:()=>null}};
vm.createContext(ctx);vm.runInContext(production,ctx);
const before=JSON.stringify(instances);
const t=performance.now();vm.runInContext("globalThis.__out=generateAutoPlacementCore(buildPlacementAdapter(),{optimizationMode:'"+(process.argv[3]||'LEGACY')+"'})",ctx);const out=ctx.__out;
const result=out.valid.map(x=>[x.instanceId,x.status,x.position[0],x.position[2]]);
console.log(JSON.stringify({n:N,result,checksum:crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex'),rawCandidates:out.rejected.raw,placed:out.valid.length,failed:out.failed.length,totalMs:+(performance.now()-t).toFixed(3),previewMutation:before===JSON.stringify(instances),collision:out.metrics?.totalCollisionChecks||out.collisionChecks}));
