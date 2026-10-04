const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const acknowledgements=[];
  page.on('response',async r=>{if(r.url().endsWith('/api/telemetry/events'))try{acknowledgements.push({http:r.status(),body:await r.json()})}catch{}});
  for(const [name,path] of [['home','/home'],['login','/signin/loginView'],['certificate','/home/certificate-verify']]) {
   const response=await page.goto('http://172.16.1.232'+path,{waitUntil:'domcontentloaded'});
   await page.waitForTimeout(2500);
   await page.screenshot({path:'/tmp/ccus-event-'+name+'-20260908.png'});
   console.log(JSON.stringify({page:name,http:response.status(),url:page.url(),title:await page.title(),bodyLength:(await page.locator('body').innerText()).length,errors:errors.length}));
  }
  console.log(JSON.stringify({acknowledgements,errors}));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('carbonet:telemetry',{detail:{traceId:'ccus-qa-telemetry-20260908',requestId:'qa-transport',pageId:'/home/certificate-verify',type:'ui_action',actionId:'QA_TRANSPORT_SELFTEST',locale:'ko',occurredAt:new Date().toISOString(),payloadSummary:{test:true,purpose:'transport verification'}}})));
  await page.waitForTimeout(4000);
  console.log(JSON.stringify({afterTestAcknowledgements:acknowledgements}));
  console.log(JSON.stringify(await page.evaluate(async()=>{const r=await fetch('/api/frontend/session',{credentials:'include'});const b=await r.json();return {sessionHttp:r.status,keys:Object.keys(b),hasCsrf:!!b.csrfToken}})));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
