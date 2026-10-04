const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync(process.argv[2], 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const eventContext={exports:{},URL,require:()=>({getTraceContext:()=>({})})};
const eventSource=fs.readFileSync(require('node:path').join(require('node:path').dirname(process.argv[2]),'events.ts'),'utf8');
vm.runInNewContext(ts.transpileModule(eventSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,eventContext);
async function scenario(mode) {
  const listeners = {}, timers = new Map(); let id=0, now=0, posts=0, sessionCalls=0, cleanup;
  const batches=[];
  const window={
    navigator:{webdriver:false},
    crypto:require('node:crypto').webcrypto,
    setTimeout(fn){timers.set(++id,fn);return id}, clearTimeout(id){timers.delete(id)},
    addEventListener(name,fn){listeners[name]=fn},removeEventListener(name){delete listeners[name]},
    async fetch(url, options){
      if(url.includes('/session')) {sessionCalls++;if(mode==='csrf'&&sessionCalls===1)throw new Error('session unavailable');return {ok:true,json:async()=>({csrfToken:mode==='tokenless'?'':'token',csrfHeaderName:'X-CSRF'})}}
      posts++; batches.push(JSON.parse(options.body).events);
      if(posts===1&&mode==='network')throw new Error('offline');
      if(mode==='id_partial')return {ok:true,json:async()=>({success:posts>1,acceptedCount:1,acceptedEventIds:[batches.at(-1)[0].eventId]})};
      return {ok:!(posts===1&&mode==='http'),status:500,json:async()=>({success:true,acceptedCount:posts===1&&mode==='partial'?0:batches.at(-1).length})};
    }
  };
  const document={addEventListener(){},removeEventListener(){},visibilityState:'visible'};
  const context={exports:{},console,window,document,Date:{now:()=>now},require(name){
    if(name==='react')return {useRef:value=>({current:value}),useEffect:fn=>{cleanup=fn()}};
    if(name==='./events')return eventContext.exports;
    return {getCsrfMeta:()=>({token:'',headerName:'X-CSRF'})};
  }};
  vm.runInNewContext(js,context);context.exports.useTelemetryTransport();
  listeners['carbonet:telemetry']({detail:{traceId:'test',type:'ui_action'}});
  if(mode==='id_partial')listeners['carbonet:telemetry']({detail:{traceId:'test',type:'page_view'}});
  async function tick(){now+=120000;const f=timers.values().next().value;timers.clear();if(f)f();for(let i=0;i<20;i++)await Promise.resolve()}
  await tick(); await tick(); await tick();
  assert.equal(batches.at(-1).length,1,mode);
  assert.equal(posts, ['success','csrf','tokenless'].includes(mode)?1:2,mode);
  if(posts>1)assert.equal(batches.at(-1)[0].eventId,batches[0][mode==='id_partial'?1:0].eventId,'stable retry identity');
  if(mode==='id_partial')assert.equal(batches[0].length,2,'partial ACK retains only unacknowledged event');
  assert.equal(timers.size,0,mode);
  cleanup(); assert.equal(timers.size,0);
  console.log('PASS',mode);
}
(async()=>{
 for(const mode of ['success','csrf','tokenless','network','http','partial','id_partial'])await scenario(mode);
 const classify=eventContext.exports.classifyTelemetryEvent;
 const checks=[
  ['QA marker',classify({type:'page_view',actionId:'QA_TEST'},false).origin==='QA'],
  ['test payload',classify({type:'page_view',payloadSummary:{test:true}},false).analyticsEligible===false],
  ['automation hint',classify({type:'ui_action'},true).origin==='AUTOMATION'],
  ['human not asserted',classify({type:'ui_action'},false).origin==='USER_CANDIDATE'],
  ['explicit polling',classify({type:'api_request',payloadSummary:{polling:true}},false).activity==='POLLING'],
  ['technical read',classify({type:'api_request',payloadSummary:{url:'/api/frontend/session?check=1'}},false).analyticsEligible===false],
  ['QA error retained',classify({type:'ui_error',actionId:'QA_TEST'},true).attention==='ERROR_OR_SECURITY'],
  ['polling failure retained',classify({type:'api_response',payloadSummary:{polling:true,status:500}},false).attention==='ERROR_OR_SECURITY']
 ];
 for(const [name,ok] of checks){assert.ok(ok,name);console.log('PASS',name)}
})().catch(e=>{console.error(e);process.exit(1)});
