const {chromium}=require('/opt/Resonance/projects/carbonet-frontend/source/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium-browser',args:['--no-sandbox']});
for(const mode of ['success','passwordFailure','mfa','providerFailure','cancel','unknownLoginStatus']){
 const p=await b.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:1100}});let verified=false,logins=0,loggedIn=false;const alerts=[];
 p.on('dialog',async d=>{alerts.push(d.message());await d.dismiss()});
 await p.addInitScript(mode=>{window.PortOne={requestIdentityVerification:async o=>mode==='cancel'?{code:'CANCELLED'}:{identityVerificationId:o.identityVerificationId}}},mode);
 await p.route('**/api/frontend/session*',r=>r.fulfill({json:{authenticated:loggedIn,canEnterAdminConsole:false}}));
 await p.route('**/api/identity/portone-test/start',r=>r.fulfill({json:{storeId:'test',channelKey:'test',identityVerificationId:'test-id',csrf:'test'}}));
 await p.route('**/api/identity/portone-test/complete',r=>{verified=mode!=='providerFailure';return r.fulfill({status:verified?200:400,json:verified?{verified:true}:{message:'검증 실패'}})});
 await p.route('**/signin/actionLogin',r=>{logins++;if(!verified)throw Error('password submitted before verification');const payload=r.request().postDataJSON();if(payload.userPw!=='fixture-password')throw Error('missing password');const status=mode==='passwordFailure'?'loginFailure':mode==='mfa'?'mfaRequired':mode==='unknownLoginStatus'?'serviceUnavailable':'loginSuccess';loggedIn=status==='loginSuccess';return r.fulfill({json:{status,userId:'fixture',userSe:'ENT',certified:true,challengeId:'fixture-mfa',destinationMasked:'***',errors:status==='loginFailure'?'비밀번호 실패':''}})});
 await p.goto('https://production.172.16.1.232.nip.io/signin/loginView');await p.locator('input[type=password]').first().waitFor();await p.locator('#userId').fill('fixture');await p.locator('input[type=password]').first().fill('fixture-password');await p.getByTestId('portone-login').getByRole('button').click();
 if(mode==='success')await p.waitForURL('**/home');else await p.waitForFunction(()=>!document.body.textContent.includes('인증 진행 중…'));
 if(['providerFailure','cancel'].includes(mode)&&logins!==0)throw Error('failed verification logged in');
 if(mode==='success'&&logins!==1)throw Error('login missing');
 if(mode!=='success'&&!p.url().includes('/signin/loginView'))throw Error('unexpected login navigation');
 if(mode==='mfa'&&!await p.getByText(/추가 인증|MFA|인증번호/).count())throw Error('MFA missing');
 console.log(JSON.stringify({mode,logins,alerts,result:'PASS_MOCK'}));
 if(mode==='passwordFailure'){await p.getByTestId('portone-login').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/portone-dual-login.png'});}
 await p.close();
}await b.close()})().catch(e=>{console.error(e);process.exit(1)});
