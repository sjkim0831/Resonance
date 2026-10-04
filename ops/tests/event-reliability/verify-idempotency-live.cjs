const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://172.16.1.232/home',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2000);
  const session=await(await p.request.get('http://172.16.1.232/api/frontend/session')).json();
  const headers={'Content-Type':'application/json'};if(session.csrfToken)headers[session.csrfHeaderName||'X-CSRF-TOKEN']=session.csrfToken;
  const event={eventId:'ccusqa20260908idempotency0001',traceId:'ccus-qa-idempotency-20260908',requestId:'qa-replay',pageId:'/home',locale:'ko',type:'page_view',actionId:'QA_IDEMPOTENCY_SELFTEST',occurredAt:'2026-09-08T04:00:00.000Z',payloadSummary:{test:true,purpose:'idempotency verification'}};
  const count=process.argv.includes('--replay')?1:20;
  const results=await Promise.all(Array.from({length:count},async()=>{
    const r=await p.request.post('http://172.16.1.232/api/telemetry/events',{headers,data:{events:[event]}});
    const data=await r.json();assert.equal(r.status(),200);assert.equal(data.success,true);assert.deepEqual(data.acceptedEventIds,[event.eventId]);return data;
  }));
  const inserted=results.reduce((n,r)=>n+r.newCount,0);assert.equal(inserted,count===1?0:1);
  await p.screenshot({path:'/tmp/ccus-idempotency-home-20260908.png'});
  console.log(JSON.stringify({requests:count,acknowledged:results.length,newEvents:inserted,browserErrors:errors}));
 }finally{await b.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
