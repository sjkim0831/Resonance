const {chromium}=require('playwright-core');
(async()=>{
const b=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const acks=[];p.on('response',async r=>{if(r.url().endsWith('/api/telemetry/events'))try{acks.push(await r.json())}catch{}});
 await p.goto('http://172.16.1.232/home',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
 await p.evaluate(()=>{
  for(const polling of [false,true])window.dispatchEvent(new CustomEvent('carbonet:telemetry',{detail:{traceId:'ccus-qa-classification-20260908',requestId:'qa-classification',pageId:'/home',type:polling?'api_request':'ui_action',actionId:'QA_CLASSIFICATION_SELFTEST',locale:'ko',occurredAt:new Date().toISOString(),payloadSummary:{test:true,polling,url:polling?'/api/frontend/session':'/home'}}}));
 });
 await p.waitForTimeout(2500);await p.screenshot({path:'/tmp/ccus-classification-home-20260908.png'});
 console.log(JSON.stringify({browserErrors:errors,acknowledged:acks.reduce((n,r)=>n+r.acceptedCount,0),batches:acks.length}));
 if(errors.length||!acks.some(r=>r.success&&r.acceptedCount>=2))process.exitCode=1;
}finally{await b.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
