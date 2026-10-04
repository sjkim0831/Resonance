const assert=require('node:assert/strict');
(async()=>{
const marker='ccus-qa-ledger-20260908-v1';
const responses=await Promise.all(Array.from({length:20},async(_,i)=>{
const r=await fetch('http://172.16.1.232/api/frontend/session',{redirect:'manual',headers:{'X-Trace-Id':marker,'X-Request-Id':'qa-ledger-'+i}});
assert.equal(r.status,200);assert.equal(r.headers.get('x-trace-id'),marker);await r.arrayBuffer();return r.status;
}));console.log(JSON.stringify({successfulSessionRequests:responses.length,marker}));
})().catch(e=>{console.error(e.message);process.exit(1)});
