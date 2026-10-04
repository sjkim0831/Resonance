const assert=require('node:assert/strict');
(async()=>{
 const responses=await Promise.all(Array.from({length:20},async(_,i)=>{
  const r=await fetch('http://172.16.1.232/api/frontend/session',{headers:{'X-Trace-Id':'ccus-qa-rollup-20260908','X-Request-Id':'qa-rollup-'+i}});
  assert.equal(r.status,200);assert.equal(r.headers.get('x-trace-id'),'ccus-qa-rollup-20260908');await r.arrayBuffer();return r.status;
 }));console.log(JSON.stringify({successfulSessionRequests:responses.length}));
})().catch(e=>{console.error(e.message);process.exit(1)});
