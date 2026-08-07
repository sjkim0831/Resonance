#!/usr/bin/env node
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root=path.resolve(process.env.RESONANCE_ROOT||path.join(import.meta.dirname,"../.."));
const require=createRequire(path.join(root,"projects/carbonet-frontend/source/package.json"));
const {chromium}=require("@playwright/test");
const base=String(process.env.CARBONET_BROWSER_BASE_URL||process.env.CARBONET_RUNTIME_BASE_URL||"http://127.0.0.1").replace(/\/$/,"");
const casesFile=process.env.CARBONET_REAPPLICATION_BROWSER_CASES_FILE;
if(!casesFile||!existsSync(casesFile))throw new Error("CARBONET_REAPPLICATION_BROWSER_CASES_FILE is required");
const cases=JSON.parse(readFileSync(casesFile,"utf8"));
if(!Array.isArray(cases)||cases.length!==2||!cases.some(item=>item.viewport==="desktop")||!cases.some(item=>item.viewport==="mobile")){
  throw new Error("exactly one desktop and one mobile business journey fixture are required");
}
const viewportDefinitions=[
  {name:"desktop",width:1440,height:1000},
  {name:"mobile",width:390,height:844},
];
const executablePath=[process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,"/snap/bin/chromium","/usr/bin/chromium","/usr/bin/chromium-browser","/usr/bin/google-chrome"].find(value=>value&&existsSync(value));
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:["--no-sandbox"]});
const routeSamples=[];
const journeys=[];
const suiteStartedAt=Date.now();

async function waitForMountedPage(page){
  await page.waitForFunction(()=>{
    const loading=document.querySelector("#shell-loading");
    return window.__CARBONET_REACT_APP_MOUNTED__===true
      && Boolean(document.querySelector("#lookup-bizNo"))
      && (loading===null||loading.hasAttribute("hidden"));
  },undefined,{timeout:15000});
}

async function inspectPage(page){
  return page.evaluate(()=>{
    const visible=(node)=>node instanceof HTMLElement&&node.offsetParent!==null;
    const controls=[...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter(visible);
    const actions=[...document.querySelectorAll("button,a[href]")].filter(visible);
    const named=(node)=>Boolean((node.getAttribute("aria-label")||node.getAttribute("title")||node.textContent||"").trim());
    const controlNamed=(node)=>Boolean(node.getAttribute("aria-label")||node.getAttribute("aria-labelledby")||node.id&&document.querySelector(`label[for="${CSS.escape(node.id)}"]`));
    return {
      title:document.title,
      lang:document.documentElement.lang,
      headingCount:document.querySelectorAll("h1,h2,[role=heading]").length,
      controls:controls.length,
      unnamedControls:controls.filter(node=>!controlNamed(node)).length,
      actions:actions.length,
      unnamedActions:actions.filter(node=>!named(node)).length,
      missingAlt:[...document.images].filter(image=>!image.hasAttribute("alt")).length,
      duplicateIds:[...document.querySelectorAll("[id]")].filter((node,index,all)=>all.findIndex(candidate=>candidate.id===node.id)!==index).length,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
      overflowElements:[...document.querySelectorAll("body *")].filter(node=>{
        const rect=node.getBoundingClientRect();
        return rect.right>window.innerWidth+2||rect.left< -2;
      }).slice(0,8).map(node=>({
        tag:node.tagName,
        className:String(node.className||"").slice(0,160),
        left:Math.round(node.getBoundingClientRect().left),
        right:Math.round(node.getBoundingClientRect().right),
        width:Math.round(node.getBoundingClientRect().width),
      })),
      fatal:/React app did not mount|Bootstrap loaded|페이지 처리 중 오류|unexpected error/i.test(document.body?.innerText||""),
    };
  });
}

function assertPageContract(viewport,response,errors,state){
  if((response?.status()||0)>=400||errors.length||state.fatal||state.overflow||!state.lang||!state.title||
      state.headingCount<1||state.controls<3||state.actions<1||state.unnamedControls||
      state.unnamedActions||state.missingAlt||state.duplicateIds){
    throw new Error(`${viewport} browser contract failed ${JSON.stringify({status:response?.status(),errors,state})}`);
  }
}

async function sampleViewport(viewport){
  const context=await browser.newContext({viewport,ignoreHTTPSErrors:true});
  try{
    const warmup=await context.newPage();
    await warmup.goto(`${base}/join/companyReapply`,{waitUntil:"domcontentloaded",timeout:15000});
    await waitForMountedPage(warmup);
    await warmup.close();
    for(let sample=1;sample<=10;sample+=1){
      const page=await context.newPage();
      const errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      const started=Date.now();
      const response=await page.goto(`${base}/join/companyReapply`,{waitUntil:"domcontentloaded",timeout:15000});
      await waitForMountedPage(page);
      const durationMs=Date.now()-started;
      const state=await inspectPage(page);
      assertPageContract(viewport.name,response,errors,state);
      routeSamples.push({viewport:viewport.name,sample,durationMs,status:response?.status(),overflow:false,accessibility:true});
      await page.close();
    }
  }finally{
    await context.close();
  }
}

async function runBusinessJourney(testCase){
  const viewport=viewportDefinitions.find(item=>item.name===testCase.viewport);
  const context=await browser.newContext({viewport,ignoreHTTPSErrors:true});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  try{
    const response=await page.goto(`${base}/join/companyReapply`,{waitUntil:"domcontentloaded",timeout:15000});
    await waitForMountedPage(page);
    assertPageContract(viewport.name,response,errors,await inspectPage(page));

    await page.locator("#lookup-bizNo").fill(testCase.bizNo);
    await page.locator("#lookup-repName").fill(testCase.repName);
    await page.locator("#lookup-registeredContact").fill(testCase.registeredContact);
    const [lookupResponse]=await Promise.all([
      page.waitForResponse(candidate=>candidate.url().includes("/join/api/company-reapply/page")&&candidate.request().method()==="POST",{timeout:15000}),
      page.getByRole("button",{name:"재신청 대상 조회",exact:true}).click(),
    ]);
    if(lookupResponse.status()!==200)throw new Error(`${viewport.name} lookup failed status=${lookupResponse.status()}`);
    await page.locator("#charger-name").waitFor({state:"visible",timeout:10000});

    await page.locator("#charger-name").fill(testCase.chargerName);
    await page.locator("#charger-email").fill(testCase.chargerEmail);
    await page.locator("#charger-tel").fill(testCase.chargerTel);
    const submittedRepName=String(testCase.updatedRepName||testCase.repName);
    await page.locator("#rep-name").fill(submittedRepName);
    await page.locator("#company-address-detail").fill(testCase.detailAddress);
    const uploadBuffer=readFileSync(testCase.pdfPath);
    if(uploadBuffer.length<=0)throw new Error(`${viewport.name} browser fixture is empty`);
    await page.locator("input.file-input").first().setInputFiles({
      name:testCase.fileName,
      mimeType:"application/pdf",
      buffer:uploadBuffer,
    });
    await page.waitForFunction(()=>{
      const hasValue=(selector)=>Boolean(String(document.querySelector(selector)?.value||"").trim());
      const fileInput=document.querySelector("input.file-input");
      const submit=[...document.querySelectorAll("button")].find(node=>node.textContent?.trim()==="재신청 완료");
      return ["#charger-name","#charger-email","#charger-tel","#company-name","#rep-name","#zip-code","#company-address"]
        .every(hasValue)&&fileInput?.files?.length===1&&fileInput.files[0].size>0
        &&submit instanceof HTMLButtonElement&&!submit.disabled;
    },undefined,{timeout:5000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

    const submitButton=page.getByRole("button",{name:"재신청 완료",exact:true});
    let submitResponse;
    try{
      [submitResponse]=await Promise.all([
        page.waitForResponse(candidate=>candidate.url().endsWith("/join/api/company-reapply")&&candidate.request().method()==="POST",{timeout:20000}),
        viewport.name==="desktop"?submitButton.press("Enter"):submitButton.click(),
      ]);
    }catch(error){
      const diagnostic=await page.evaluate(()=>{
        const hasValue=(selector)=>Boolean(String(document.querySelector(selector)?.value||"").trim());
        const submit=[...document.querySelectorAll("button")].find(node=>node.textContent?.trim()==="재신청 완료");
        const visible=(node)=>node instanceof HTMLElement&&node.offsetParent!==null;
        const file=document.querySelector("input.file-input")?.files?.[0];
        return {
          submitDisabled:Boolean(submit?.disabled),
          submitVisible:visible(submit),
          submitFocused:document.activeElement===submit,
          activeElementId:String(document.activeElement?.id||""),
          requiredValues:{
            chargerName:hasValue("#charger-name"),
            chargerEmail:hasValue("#charger-email"),
            chargerTel:hasValue("#charger-tel"),
            agencyName:hasValue("#company-name"),
            representativeName:hasValue("#rep-name"),
            zipCode:hasValue("#zip-code"),
            companyAddress:hasValue("#company-address"),
          },
          fileCount:file?1:0,
          fileTypeAllowed:Boolean(file&&/\.(pdf|jpe?g|png)$/i.test(file.name)),
          fileSizeBucket:!file?"none":file.size<=0?"empty":file.size<=10*1024*1024?"accepted":"oversize",
          visibleAlertCount:[...document.querySelectorAll('[role="alert"]')].filter(visible).length,
          invalidFieldIds:[...document.querySelectorAll('[aria-invalid="true"]')].map(node=>node.id).filter(Boolean).slice(0,10),
        };
      });
      const reason=error instanceof Error?error.message:String(error);
      throw new Error(`${viewport.name} submit did not issue POST ${JSON.stringify(diagnostic)} cause=${reason}`);
    }
    if(submitResponse.status()!==200)throw new Error(`${viewport.name} submit failed status=${submitResponse.status()}`);

    await page.getByRole("heading",{name:"재신청 접수 완료",exact:true}).waitFor({state:"visible",timeout:10000});
    await page.getByText("승인 검토 대기",{exact:true}).waitFor({state:"visible",timeout:10000});
    await page.locator('[data-help-id="join-company-reapply-status"][role="status"]').waitFor({state:"visible",timeout:10000});
    const statusButton=page.getByRole("button",{name:"승인 상태 조회",exact:true});
    await statusButton.waitFor({state:"visible",timeout:10000});
    const [statusDetailResponse]=await Promise.all([
      page.waitForResponse(candidate=>candidate.url().endsWith("/join/api/company-status/detail")&&candidate.request().method()==="POST",{timeout:15000}),
      page.waitForURL(url=>url.pathname==="/join/companyJoinStatusDetail",{timeout:15000}),
      statusButton.click(),
    ]);
    if(statusDetailResponse.status()!==200)throw new Error(`${viewport.name} status detail failed status=${statusDetailResponse.status()}`);
    await page.getByRole("heading",{name:"회원사 가입 현황 상세",exact:true}).waitFor({state:"visible",timeout:10000});
    await page.getByText("운영자 검토 중",{exact:true}).waitFor({state:"visible",timeout:10000});
    await page.locator('[data-help-id="join-company-status-detail-summary"]').getByText(submittedRepName,{exact:true}).waitFor({state:"visible",timeout:10000});
    const fileName=page.getByText(testCase.fileName,{exact:true});
    await fileName.waitFor({state:"visible",timeout:10000});
    const fileRow=page.getByRole("listitem").filter({has:fileName});
    if(await fileRow.count()!==1)throw new Error(`${viewport.name} uploaded evidence row is not unique`);
    const downloadLink=fileRow.getByRole("link",{name:"다운로드",exact:true});
    await downloadLink.waitFor({state:"visible",timeout:10000});
    const downloadHref=await downloadLink.getAttribute("href");
    const downloadUrl=new URL(String(downloadHref||""),page.url());
    if(downloadUrl.pathname!=="/join/downloadInsttFile"||!downloadUrl.searchParams.get("downloadToken")){
      throw new Error(`${viewport.name} evidence download link contract failed`);
    }
    const [download]=await Promise.all([
      page.waitForEvent("download",{timeout:15000}),
      downloadLink.click(),
    ]);
    const downloadStream=await download.createReadStream();
    if(!downloadStream)throw new Error(`${viewport.name} evidence download stream is unavailable`);
    const downloadedChunks=[];
    for await(const chunk of downloadStream)downloadedChunks.push(Buffer.from(chunk));
    const downloadedBuffer=Buffer.concat(downloadedChunks);
    const fixtureSha=createHash("sha256").update(uploadBuffer).digest("hex");
    const downloadedSha=createHash("sha256").update(downloadedBuffer).digest("hex");
    if(!downloadedBuffer.equals(uploadBuffer)||downloadedSha!==fixtureSha){
      throw new Error(`${viewport.name} evidence download bytes do not match the uploaded fixture`);
    }
    if(errors.length)throw new Error(`${viewport.name} page errors ${JSON.stringify(errors)}`);
    journeys.push({
      caseId:testCase.caseId,
      viewport:viewport.name,
      lookupStatus:lookupResponse.status(),
      submitStatus:submitResponse.status(),
      completionVisible:true,
      statusDetailVisible:true,
      evidenceVisible:true,
      downloadVerified:true,
      representativeUpdated:Boolean(testCase.updatedRepName),
      keyboardSubmit:viewport.name==="desktop",
    });
  }finally{
    await context.close();
  }
}

try{
  for(const viewport of viewportDefinitions)await sampleViewport(viewport);
  for(const testCase of cases)await runBusinessJourney(testCase);
}finally{
  await browser.close();
}

if(routeSamples.length<20)throw new Error(`at least 20 browser latency samples are required, got ${routeSamples.length}`);
if(journeys.length!==2||!journeys.some(item=>item.viewport==="desktop")||!journeys.some(item=>item.viewport==="mobile")
    ||!journeys.every(item=>item.downloadVerified)||!journeys.some(item=>item.representativeUpdated)){
  throw new Error(`desktop and mobile business journeys are required, got ${journeys.length}`);
}
const durations=routeSamples.map(result=>result.durationMs).sort((a,b)=>a-b);
const p95Index=Math.max(0,Math.ceil(durations.length*0.95)-1);
console.log(JSON.stringify({
  responsive:1,
  accessibility:1,
  desktop:1,
  mobile:1,
  browserJourney:1,
  downloadVerified:journeys.every(item=>item.downloadVerified)?1:0,
  representativeUpdateVerified:journeys.some(item=>item.representativeUpdated)?1:0,
  businessJourneyCount:journeys.length,
  businessJourneyDesktop:journeys.some(item=>item.viewport==="desktop")?1:0,
  businessJourneyMobile:journeys.some(item=>item.viewport==="mobile")?1:0,
  browserRoutes:routeSamples,
  browserJourneys:journeys,
  performanceSampleCount:durations.length,
  performanceP95Ms:durations[p95Index],
  suiteDurationMs:Date.now()-suiteStartedAt,
}));
