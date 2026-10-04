const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch({headless:true,args:['--no-sandbox']});try{
const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const r=await p.goto('http://172.16.1.232/home',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2000);
await p.screenshot({path:'/tmp/ccus-rollup-home-20260908.png'});console.log(JSON.stringify({http:r.status(),title:await p.title(),errors}));
if(r.status()!==200||errors.length)process.exitCode=1;
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exit(1)});
