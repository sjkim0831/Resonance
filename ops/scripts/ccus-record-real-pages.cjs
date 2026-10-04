const { chromium } = require('/opt/Resonance/projects/carbonet-frontend/source/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = '/opt/Resonance';
const qa = root + '/projects/carbonet-frontend/source/public/qa';
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = root + '/var/test-evidence/recordings/' + run;
const base = 'http://172.16.1.232';
const atomic = (file, value) => { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file+'.tmp', JSON.stringify(value,null,2)); fs.renameSync(file+'.tmp',file); };
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const start=Date.now();
  atomic(qa+'/process-preview-recorder-status.json',{status:'RUNNING',alert:true,reason:'실제 화면 녹화 중 · 기능 검증 결과와 별도',updatedAt:new Date().toISOString()});
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium-browser',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const entries=[];
  try {
    for(const [id,route,heading] of [['home','/home','지속 가능한 미래'],['certificate-verify','/home/certificate-verify','인증서 진위여부 확인'],['admin','/admin','운영 관리 대시보드']]) {
      const dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});
      const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir,size:{width:1440,height:1000}}});
      const page=await context.newPage(); const errors=[]; const responses=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()});});
      const entry={id,requestedUrl:base+route,startedAt:new Date().toISOString(),authenticated:false,actions:['실제 URL 직접 접근','화면 로딩 대기','스크린샷 및 동영상 저장'],functionalTest:'NOT_EXECUTED',processResult:'NOT_VERIFIED',errors,responses};
      try {
        const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
        await page.getByText(heading,{exact:false}).first().waitFor({timeout:15000}).catch(()=>errors.push('EXPECTED_HEADING_NOT_FOUND'));
        await page.evaluate(()=>document.fonts.ready);
        await page.waitForTimeout(2500);
        entry.finalUrl=page.url();entry.httpStatus=response?.status();
        entry.headingVisible=await page.getByText(heading,{exact:false}).first().isVisible();
        entry.captureResult=id==='admin'?'AUTHENTICATED_VALIDATION_REQUIRED':errors.length||responses.length?'REVIEW_REQUIRED':'RENDER_CAPTURED';
        if(id==='certificate-verify' && process.env.VERIFY_PDF){
          const pdf=process.env.VERIFY_PDF;
          entry.inputSha256=crypto.createHash('sha256').update(fs.readFileSync(pdf)).digest('hex');
          entry.functionalTest='RUNNING';
          await page.locator('input[type="file"]').first().setInputFiles({name:'ccus-issued-20260906.pdf',mimeType:'application/pdf',buffer:fs.readFileSync(pdf)});
          await page.getByText('진위 확인 완료: 업로드한 PDF 바이트가 발급 원본과 정확히 일치합니다.',{exact:true}).waitFor({timeout:45000});
          const body=await page.locator('body').innerText();
          if(body.split(entry.inputSha256).length-1<2)throw Error('SOURCE_UPLOAD_HASH_NOT_CONFIRMED');
          entry.actions.push('사용자 발급 PDF 업로드','원본 바이트 일치 메시지 확인','발급 및 업로드 SHA256 대조');
          entry.functionalTest='EXACT_PDF_MATCH_VERIFIED';
          entry.certificateId=(body.match(/CRN-\d{8}-[A-F0-9]+/)||[])[0];
          await page.waitForTimeout(2000);
        }
        await page.screenshot({path:path.join(dir,'screen.png'),fullPage:false});
      } catch(e) { entry.captureResult='FAILED';if(entry.functionalTest==='RUNNING')entry.functionalTest='FAILED';errors.push(e.message);await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{}); }
      const video=page.video();await context.close();
      if(video){const file=await video.path();entry.videoFile=file;entry.videoSha256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
      entry.finishedAt=new Date().toISOString();entries.push(entry);
    }
  } finally {await browser.close();}
  const receipt={version:'real-page-capture-v1',run,sourceRoot:root,startedAt:new Date(start).toISOString(),finishedAt:new Date().toISOString(),durationMs:Date.now()-start,scope:'실제 화면 녹화. VERIFY_PDF 지정 시 원본 업로드 검증 포함. 단계별 functionalTest 참조. PDF 발급 및 액터 릴레이 미실행. 설계 카드 녹화 및 PASS 대체 금지.',entries};
  atomic(out+'/receipt.json',receipt);
  atomic(qa+'/process-preview-recorder-status.json',{status:'PARTIAL',alert:true,reason:'실제 URL 3개 녹화 · 관리자 인증 및 업무 기능 검증 미완료',consecutiveFailures:0,durationMs:receipt.durationMs,updatedAt:receipt.finishedAt,evidenceRun:run,receipt:out+'/receipt.json',functionalTest:'NOT_EXECUTED'});
  console.log(JSON.stringify(receipt,null,2));
})().catch(e=>{atomic(qa+'/process-preview-recorder-status.json',{status:'FAIL',alert:true,reason:e.message,updatedAt:new Date().toISOString()});console.error(e);process.exitCode=1;});
