(()=>{
 const root=document.querySelector('#aiEquipmentWorkflow');if(!root)return;
 const $=s=>root.querySelector(s),preview=document.querySelector('#preview'),form=document.querySelector('#equipmentForm');
 const labels={references:'참고자료 수집',concepts:'3D 시안 5개',usd:'USD 제작',motion:'가동 정보 수집',animation:'애니메이션 제작'};
 let asset='',jobs=[],config=null,apiError='',generation=0,posting=false,checking=false,timer,elapsedTimer;
 const defaults=new Map([...root.querySelectorAll('[data-ai-stage]')].map(c=>[c.dataset.aiStage,c.querySelector('.ai-stage-result').innerHTML]));
 const result=document.createElement('section');result.className='ai-research-report';result.hidden=true;result.id='aiResearchReport';root.append(result);
 const live=document.createElement('details');live.className='ai-live-activity';live.id='aiLiveActivity';live.open=true;live.innerHTML='<summary><span>실시간 작업 내역</span><small id="aiLiveSummary">작업을 시작하면 세션 이벤트와 중간 응답을 표시합니다.</small><a href="ai-live-session-design.html">업무 절차 · 화면 설계 · QA · 다음 작업 ↗</a></summary><div class="ai-live-meta" id="aiLiveMeta"></div><ol class="ai-live-log" id="aiLiveLog" role="log" aria-live="polite"></ol><details class="ai-live-response" id="aiLiveResponse" hidden><summary>중간 응답 전문</summary><pre></pre></details>';result.before(live);
 const liveMeta=live.querySelector('#aiLiveMeta'),liveLog=live.querySelector('#aiLiveLog'),liveSummary=live.querySelector('#aiLiveSummary'),partial=live.querySelector('#aiLiveResponse');
 const recheck=document.createElement('button');recheck.type='button';recheck.className='secondary';recheck.textContent='연결 상태 확인';recheck.id='aiRecheck';$('.ai-workflow-footer').append(recheck);
 const login=document.createElement('a');login.className='ai-login-link';login.textContent='로그인하고 작업 계속하기 ↗';login.hidden=true;login.href='/projects/P006/assets/equipment-registry/p006-login.html?returnTo='+encodeURIComponent(location.pathname+location.search+location.hash);$('.ai-workflow-footer').append(login);
 async function request(path,body){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);try{const r=await fetch('/projects/P006/registry-api/ai-authoring/'+path,{credentials:'same-origin',cache:'no-store',signal:controller.signal,method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-P006-Requested-With':'equipment-registry'}:{},body:body?JSON.stringify(body):undefined});const type=r.headers.get('content-type')||'';if(!type.includes('application/json'))throw Error('서버가 JSON 대신 '+(type||'빈 응답')+'을 반환했습니다. 로그인 상태와 페이지 경로를 확인하세요.');const d=await r.json();if(r.status===401)throw Error('로그인이 만료됐습니다. 로그인 후 다시 확인하세요.');if(!r.ok)throw Error(d.error||'요청 실패 ('+r.status+')');return d;}catch(e){if(e.name==='AbortError')throw Error('서버 응답이 10초 안에 오지 않았습니다. 연결을 확인하고 다시 시도하세요.');throw e;}finally{clearTimeout(timeout);}}
 function info(){
  const selected=window.P006_STUDIO_PROCESS_CONTEXT||null;
  const rawId=selected?(selected.assetId||''):(preview?.dataset.asset||new URLSearchParams(location.search).get('asset')||'');
  const processCode=selected?`PROC-${String(selected.planId||'PLAN').toUpperCase().replace(/[^A-Z0-9_.-]/g,'-').slice(0,34)}-${String(selected.processId||'PROCESS').toUpperCase().replace(/[^A-Z0-9_.-]/g,'-').slice(0,45)}`:'';
  const id=rawId||processCode;
  if(selected){return{id,assetId:rawId||null,targetKind:rawId?'EQUIPMENT_ASSET':'PRODUCT_PROCESS',name:selected.equipmentName||selected.assetId||`${selected.processName} · 설비 미배정`,process:selected.processName||'',processId:selected.processId||'',processKind:selected.processKind||'',planId:selected.planId||'',productName:selected.productName||'',manufacturerName:selected.manufacturerName||'',modelName:selected.modelName||'',equipmentId:selected.equipmentId||null,reviewStatus:selected.reviewStatus||'UNASSIGNED'};}
  let context=null;try{const token=new URLSearchParams(location.search).get('handoff'),c=JSON.parse(localStorage.getItem('p006-studio-handoff:'+token)||'null'),store=JSON.parse(localStorage.getItem('p006-product-plans-v1')||'{}'),p=store.plans?.find(x=>x.id===c?.planId),pr=p?.processes?.find(x=>x.id===c?.processId);if(pr?.equipmentModel?.assetId===rawId)context={plan:p,process:pr};}catch{}
  const catalog=[...document.querySelectorAll('#catalogAssetOptions option')].find(x=>x.value.startsWith(rawId+' · '))?.value.slice(rawId.length+3)||'';
  const formName=form?.elements.name?.value.trim(),picker=document.querySelector('#catalogAssetInput')?.value||'';
  const name=context?.process.equipmentModel.equipmentName||catalog||(picker.startsWith(rawId+' · ')?picker.slice(rawId.length+3):'')||(formName&&formName!==rawId?formName:'')||rawId;
  const process=context?.process.name||(form?.elements.processId?.value?form.elements.processId.selectedOptions[0].textContent:'');
  return{id,assetId:rawId||null,targetKind:'EQUIPMENT_ASSET',name,process,planId:context?.plan.id||'',processId:context?.process.id||'',productName:context?.plan.productName||''};
 }
 function links(){return [...document.querySelectorAll('#assetReferenceMaterials a,#assetUploadedEvidence .evidence-item a')].filter(a=>/^https?:/.test(a.href)&&!a.href.includes('/registry-api/')).map(a=>({title:a.textContent.trim(),url:a.href})).slice(0,20);}
 function evidence(){return [...document.querySelectorAll('#assetUploadedEvidence .evidence-item,#evidenceList .evidence-item')].map(x=>({name:x.querySelector('b')?.textContent||'',kind:x.querySelector('span')?.textContent||''})).slice(0,20);}
 function say(text){$('#aiWorkflowMessage').textContent=text;}
 function clock(value){if(!value)return '—';return new Date(value*1000).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
 function elapsed(job){const start=Number(job?.startedAt||job?.createdAt),end=Number(job?.finishedAt)||Date.now()/1000;return start?Math.max(0,Math.floor(end-start))+'초':'접수 대기';}
 function renderLive(){
  const job=jobs.find(j=>['queued','running'].includes(j.status))||jobs[0];
  if(!job){liveSummary.textContent='작업을 시작하면 세션 이벤트와 중간 응답을 표시합니다.';liveMeta.replaceChildren();liveLog.replaceChildren();partial.hidden=true;clearInterval(elapsedTimer);return;}
  const running=['queued','running'].includes(job.status);liveSummary.textContent=(job.stage==='references'?'참고자료 수집':job.stage==='motion'?'가동 정보 수집':labels[job.stage]||job.stage)+' · '+({queued:'접수됨',running:'실행 중',completed:'완료',failed:'실패'}[job.status]||job.status)+' · '+elapsed(job);
  liveMeta.textContent='작업 ID '+job.id+' · 시작 '+clock(job.startedAt||job.createdAt)+' · 최근 갱신 '+clock(job.updatedAt||job.finishedAt||job.startedAt||job.createdAt)+(job.finishedAt?' · 종료 '+clock(job.finishedAt):'');
  const entries=Array.isArray(job.activity)?job.activity:[];liveLog.replaceChildren();
  for(const entry of entries.slice(-60)){const li=document.createElement('li'),time=document.createElement('time');time.textContent=clock(entry.at);li.dataset.type=entry.type||'status';li.append(time,document.createTextNode(entry.message||''));if(entry.url){const a=document.createElement('a');a.href=entry.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='자료 열기 ↗';li.append(a);}liveLog.append(li);}
  if(!entries.length)liveLog.innerHTML='<li class="ai-live-empty">서버에 저장된 세션 이벤트를 기다리고 있습니다.</li>';
  const text=job.partialResponse||'';partial.hidden=!text;if(text)partial.querySelector('pre').textContent=text;
  if(running){clearInterval(elapsedTimer);elapsedTimer=setInterval(()=>{if(!document.hidden)liveSummary.textContent=(job.stage==='references'?'참고자료 수집':job.stage==='motion'?'가동 정보 수집':labels[job.stage]||job.stage)+' · 실행 중 · '+elapsed(job);},1000);}else clearInterval(elapsedTimer);
 }
 function render(){
  const target=info();$('#aiTargetLabel').textContent=target.targetKind==='PRODUCT_PROCESS'?`${target.productName} / ${target.process} · 설비 미배정 · AI 조사 대상`:target.name+(target.id?' · '+target.id:'')+(target.process?' · '+target.process:'');
  $('#aiEvidenceSummary').textContent='등록 자료 '+evidence().length+'개 · 참고 링크 '+links().length+'개';
  const badge=$('.ai-provider-state');badge.querySelector('b').textContent=checking?'연결 확인 중…':apiError?'연결 확인 필요':!config?'상태 확인 중':config.configured?'조사 요청 가능':'서버 키 설정 필요';
  badge.querySelector('small').textContent=apiError||'서버 Kilo · ChatGPT 구독 로그인';
  login.hidden=!apiError.includes('로그인');
  if(config&&!config.configured)badge.querySelector('b').textContent='서버 Kilo 로그인 필요';
  for(const [stage,label] of Object.entries(labels)){
    const card=$('[data-ai-stage="'+stage+'"]'),button=card.querySelector('button'),out=card.querySelector('.ai-stage-result'),job=jobs.find(j=>j.stage===stage),enabled=config?.enabledStages?.includes(stage)??false,busy=job&&['queued','running'].includes(job.status),connected=!!config?.configured;
   card.dataset.state=job?.status||'pending';out.innerHTML=defaults.get(stage);
   button.disabled=!target.id||posting||busy||!config||!connected||!enabled;button.textContent=!config?(apiError.includes('로그인')?'로그인 후 상태 확인':'연결 상태 확인 중…'):!connected?'Kilo 로그인 필요':!enabled?'기능 미연결':busy?'조사 진행 중…':job?.status==='completed'?'다시 요청':job?.status==='failed'?'다시 요청':label+' 시작';
   if(!enabled){out.replaceChildren();const note=document.createElement('span');note.textContent=config?(stage==='concepts'||stage==='usd'||stage==='animation'?'이 단계는 아직 생성 기능이 연결되지 않았습니다.':'서버에서 이 단계를 지원하지 않습니다.'):apiError||'연결 상태를 확인하고 있습니다.';out.append(note);}
   if(job){out.replaceChildren();const title=document.createElement('b'),detail=document.createElement('span');title.textContent={queued:'접수됨',running:'웹 자료 조사 중',completed:'완료 · 서버 저장됨',failed:'실패'+(job.failureCode?' · '+job.failureCode:'')}[job.status]||job.status;detail.textContent=job.error||(job.status==='completed'?(job.providerWarning||job.result?.providerWarning?'완료 응답 복구 저장 · ':'')+'출처 '+(job.result?.sources?.length||0)+'개 · '+Math.round((job.finishedAt||Date.now()/1000)-(job.startedAt||job.createdAt))+'초':'작업 ID '+job.id.slice(0,8));out.append(title,detail);if(job.failureCode&&['credit_balance_exhausted','insufficient_quota','usage_limit_exceeded','project_spend_limit_exceeded','organization_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(job.failureCode)){const link=document.createElement('a');link.href='https://platform.openai.com/settings/organization/billing/overview';link.target='_blank';link.rel='noopener noreferrer';link.textContent='OpenAI 결제·사용 한도 확인 ↗';out.append(link);}}
  }
  const active=jobs.find(j=>['queued','running'].includes(j.status)&&j.provider==='kilo-cli');
  if(active)say((active.progressMessages||['서버 Kilo 접수됨']).slice(-4).join(' → '));
  renderLive();
  $('#downloadAiRequest').disabled=!jobs.length;$('#downloadAiRequest').textContent='작업 결과 JSON 내려받기';
  const done=jobs.find(j=>j.status==='completed');result.hidden=!done;
  if(done&&result.dataset.job!==done.id){result.dataset.job=done.id;result.replaceChildren();const h=document.createElement('h3');h.textContent=labels[done.stage]+' 결과 · '+done.result.asset.name;const warning=done.providerWarning||done.result?.providerWarning;if(warning){const note=document.createElement('p');note.className='ai-provider-warning';note.textContent=warning;result.append(h,note);}else result.append(h);const saved=done.saved||{};const counts=document.createElement('p');counts.className='ai-evidence-counts';counts.textContent=`새 출처 ${saved.sourceRecordsAdded||0}개 · 기존 중복 ${saved.duplicateSources||0}개 · 보고서 보관 완료`;result.append(counts);const pre=document.createElement('div');pre.className='ai-report-text';pre.textContent=done.result.report;const list=document.createElement('ol');for(const s of done.result.sources){const li=document.createElement('li'),a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=s.title;li.append(a);list.append(li);}result.append(pre,list);}
 }
 async function sync(){
  const id=info().id;if(id!==asset){asset=id;jobs=[];result.dataset.job='';render();}
  const rev=++generation;clearTimeout(timer);checking=true;render();
  try{const [status,data]=await Promise.all([request('status'),id?request(encodeURIComponent(id)):Promise.resolve({jobs:[]})]);if(rev!==generation)return;config=status;jobs=data.jobs||[];apiError='';render();if(!status.configured)say('서버 Kilo의 ChatGPT 로그인이 필요합니다. 로그인 후 연결 상태 확인을 누르세요.');}
  catch(e){if(rev!==generation)return;apiError=e.message;say(e.message);render();}
  finally{if(rev===generation){checking=false;render();}}
  if(jobs.some(j=>['queued','running'].includes(j.status)))timer=setTimeout(poll,3000);
 }
 async function poll(){const before=jobs.filter(j=>j.status==='completed').map(j=>j.id);await sync();if(jobs.some(j=>j.status==='completed'&&!before.includes(j.id))){document.dispatchEvent(new CustomEvent('p006-ai-evidence-saved',{detail:{assetId:asset}}));say(asset+' · 조사 결과와 출처가 참고 자료 목록에 저장되었습니다.');}}
 root.addEventListener('click',async e=>{
  const b=e.target.closest('[data-ai-action]');if(b){
   if(posting)return;const target=info(),stage=b.dataset.aiAction;posting=true;render();
   try{const job=await request(encodeURIComponent(target.id),{stage,requestId:crypto.randomUUID?.()||'job_'+Date.now()+'_'+Math.random().toString(36).slice(2),asset:target,target:{kind:target.targetKind,planId:target.planId||null,productName:target.productName||null,processId:target.processId||null,processName:target.process||null,processKind:target.processKind||null},referenceLinks:links(),registeredEvidence:evidence()});if(target.id===info().id){jobs=[job,...jobs.filter(x=>x.id!==job.id)];say((target.productName?target.productName+' / ':'')+(target.process||target.name)+' · 서버 접수 완료. 웹 조사 후 출처와 보고서를 저장합니다.');clearTimeout(timer);timer=setTimeout(poll,1500);}}
   catch(err){say(err.message);}finally{posting=false;render();}return;
  }
  if(e.target.closest('#aiRecheck')){if(checking)return;await sync();if(config?.configured&&!apiError)say('서버 Kilo의 ChatGPT 로그인이 확인됐습니다. 버튼을 누르면 구독 한도로 조사합니다. API 키 자동 대체 호출 없음.');return;}
  if(e.target.closest('#downloadAiRequest')){const url=URL.createObjectURL(new Blob([JSON.stringify({assetId:asset,jobs},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=asset+'-research-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 });
 if(preview)new MutationObserver(()=>{if(info().id!==asset)sync();else render();}).observe(preview,{attributes:true,attributeFilter:['data-asset']});
 const options=document.querySelector('#catalogAssetOptions');if(options)new MutationObserver(render).observe(options,{childList:true});
 form?.addEventListener('input',render);form?.addEventListener('change',render);document.addEventListener('p006:studio-process-context',()=>{if(info().id!==asset)sync();else render();});document.addEventListener('p006-asset-evidence-count',()=>queueMicrotask(render));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
 sync();
})();
