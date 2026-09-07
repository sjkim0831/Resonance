import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createPortOneTestHandler } from './portone-test-handler.mjs';
const config={mode:'test',storeId:'store-test',channelKey:'channel-test'};
function call(handler, action, input={}, options={}) { return new Promise(resolve=>{
  const req=Readable.from([JSON.stringify(input)]);
  Object.assign(req,{url:'/api/identity/portone-test/'+action,method:'POST',socket:{encrypted:true,remoteAddress:'127.0.0.1'},headers:{host:'ccus.test',origin:'https://ccus.test','content-type':'application/json',...options.headers},...options.request});
  const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(value){resolve({status:this.status,headers:this.headers,body:JSON.parse(value)});}};
  handler(req,res);
});}
const setup=(extra={})=>createPortOneTestHandler({loadConfig:async()=>config,verify:async()=>({verified:true,loginEnabled:false,accountUpdated:false}),...extra});
async function start(handler){const r=await call(handler,'start',{consent:true});assert.equal(r.status,200);return {data:{identityVerificationId:r.body.identityVerificationId,csrf:r.body.csrf},cookie:r.headers['set-cookie'].split(';')[0]};}
test('consent required',async()=>assert.equal((await call(setup(),'start')).status,400));
test('foreign origin blocked',async()=>assert.equal((await call(setup(),'start',{consent:true},{headers:{origin:'https://evil.test'}})).status,403));
test('HTTP blocked',async()=>assert.equal((await call(setup(),'start',{}, {request:{socket:{encrypted:false}}})).status,403));
test('live config cannot activate test endpoint',async()=>assert.equal((await call(setup({loadConfig:async()=>({...config,mode:'live'})}),'start',{consent:true})).status,409));
test('complete needs originating browser',async()=>{const h=setup(),p=await start(h);assert.equal((await call(h,'complete',p.data)).status,400);});
test('complete needs csrf',async()=>{const h=setup(),p=await start(h);assert.equal((await call(h,'complete',{...p.data,csrf:'other'},{headers:{cookie:p.cookie}})).status,400);});
test('success does not login and replay fails',async()=>{const h=setup(),p=await start(h);const r=await call(h,'complete',p.data,{headers:{cookie:p.cookie}});assert.equal(r.body.verified,true);assert.equal(r.body.loginEnabled,false);assert.equal((await call(h,'complete',p.data,{headers:{cookie:p.cookie}})).status,400);});
test('concurrent complete calls provider once',async()=>{let count=0;const h=setup({verify:async()=>{count++;await new Promise(r=>setTimeout(r,20));return {verified:true};}}),p=await start(h);const results=await Promise.all([call(h,'complete',p.data,{headers:{cookie:p.cookie}}),call(h,'complete',p.data,{headers:{cookie:p.cookie}})]);assert.equal(count,1);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);});
test('expired attempt fails',async()=>{let time=0;const h=setup({now:()=>time}),p=await start(h);time=600001;assert.equal((await call(h,'complete',p.data,{headers:{cookie:p.cookie}})).status,400);});
test('provider error hides secret',async()=>{const h=setup({verify:async()=>{throw new Error('private-ci-secret');}}),p=await start(h);const r=await call(h,'complete',p.data,{headers:{cookie:p.cookie}});assert.equal(r.status,400);assert.ok(!JSON.stringify(r).includes('private-ci-secret'));});
test('rate limited after five starts',async()=>{const h=setup();for(let i=0;i<5;i++)await start(h);assert.equal((await call(h,'start',{consent:true})).status,429);});
