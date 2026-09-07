const {chromium}=require('/opt/Resonance/projects/carbonet-frontend/source/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium-browser',args:['--no-sandbox']});
for(const route of ['/signin/loginView','/admin/login/loginView','/en/signin/loginView','/en/admin/login/loginView']){
 const p=await b.newPage({viewport:{width:1440,height:1200}});let calls=0;
 p.on('request',r=>{if(r.url().includes('/api/identity/portone-test/'))calls++});
 await p.goto('http://172.16.1.232'+route);const card=p.getByTestId('portone-login-preparing');await card.waitFor({timeout:30000});
 const button=card.getByRole('button');if(!await button.isDisabled())throw Error('PortOne must be disabled');
 if(!await p.locator('input[type=password]').first().isVisible())throw Error('existing password login missing');
 if(calls!==0)throw Error('unexpected authentication request');
 if(route==='/signin/loginView'){await card.scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/portone-login-preparing.png'});await p.setViewportSize({width:390,height:844});await card.scrollIntoViewIfNeeded();if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile overflow');await p.screenshot({path:'/tmp/portone-login-preparing-mobile.png'});}
 console.log(JSON.stringify({route,disabled:true,passwordPresent:true,portoneRequests:calls,result:'PASS'}));await p.close();
}await b.close();})().catch(e=>{console.error(e);process.exit(1)});
