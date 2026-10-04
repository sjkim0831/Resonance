export function processContext(){
 const token=new URLSearchParams(location.search).get('handoff');if(!token)return null;
 const context=JSON.parse(localStorage.getItem('p006-studio-handoff:'+token)||'null');if(!context)return null;
 const key='p006-product-plans-v1',store=JSON.parse(localStorage.getItem(key)||'{}'),plan=store.plans?.find(p=>p.id===context.planId),proc=plan?.processes.find(p=>p.id===context.processId);if(!proc)return null;
 let revision=plan.revision,model=proc.equipmentModel||{};
 const banner=document.createElement('section');banner.id='process-edit-context';banner.className='process-context-strip';
 banner.innerHTML=`<strong>현재 제품 공정</strong><span></span><a></a>`;
 const editor=document.querySelector('.editor');editor?.prepend(banner);
 const note=document.createElement('p');note.id='process-apply-status';note.className='process-apply-status';note.setAttribute('role','status');
 const form=document.querySelector('#equipmentForm');
 const details=document.createElement('details');details.id='process-model-paths';details.className='process-model-paths';
 details.innerHTML='<summary>현재 공정의 3D 모델 정보</summary><p>변경 내용은 선택한 공정에만 저장됩니다. GLB 경로는 같은 서버의 실제 GLB 파일이어야 합니다.</p><div class="fields"><label>원본 USD 경로<input name="processUsdPath" type="text"></label><label>웹 GLB 경로<input name="processGlbPath" type="text"></label><label class="full">자료·수정 근거<input name="processSource" type="text"></label></div>';
 form?.querySelector('.form-actions')?.before(details,note);
 const apply=document.createElement('button');apply.type='button';apply.id='applyProcessEdit';apply.className='primary';apply.textContent='현재 공정에 적용';
 const back=document.createElement('a');back.id='returnToPlanner';back.className='button-link';back.textContent='3D로 돌아가기';back.href='product-planner.html?rev=studio-handoff-1&handoff='+encodeURIComponent(token)+'#run';back.target='p006-planner';
 const actions=form?.querySelector('.form-actions');if(actions){const save=form.querySelector('#saveEquipment');if(save)save.hidden=true;const clear=form.querySelector('#clearForm');if(clear)clear.hidden=true;actions.append(apply,back);}
 function identify(){const latest=JSON.parse(localStorage.getItem(key)||'{}'),p=latest.plans?.find(x=>x.id===context.planId),pr=p?.processes.find(x=>x.id===context.processId);return {latest,p,pr};}
 function attach(selected){
  const {p,pr}=identify();if(!p||!pr)return;model=pr.equipmentModel||{};
  const title=`${p.productName} / ${pr.name} / ${model.assetId||'Asset 미연결'} · 이 공정에만 적용`;
  banner.querySelector('span').textContent=title;banner.querySelector('a').textContent='3D로 돌아가기';banner.querySelector('a').href=back.href;
  const f=form?.elements; if(f?.name)f.name.value=model.equipmentName||selected?.name||model.assetId||pr.name;
  if(f?.processUsdPath)f.processUsdPath.value=model.usdPath||model.usd||model.sourceUsd||'';
  if(f?.processGlbPath)f.processGlbPath.value=model.glbPath||selected?.glbPath||'';
  if(f?.processSource)f.processSource.value=model.source||'';
  document.querySelector('#formTitle').textContent=`${pr.name} · 공정 설비 편집`;
  document.querySelector('#recordState').textContent='선택 제품의 이 공정에만 적용됩니다. 공통 Asset 원본은 유지됩니다.';
 }
 apply.onclick=async()=>{apply.disabled=true;try{
  const {latest,p,pr}=identify();if(!pr)throw Error('선택 공정이 삭제됐습니다.');
  if(p.revision!==revision)throw Error('계획이 변경됐습니다. 화면을 새로고침해 최신 정보를 확인하세요.');
  const f=form.elements,path=f.processGlbPath.value.trim(),url=new URL(path,location.href);
  if(!path||url.origin!==location.origin||!/^https?:$/.test(url.protocol))throw Error('웹 GLB 경로는 같은 서버에서 지정하세요.');
  const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw Error('GLB 요청 실패: '+response.status);
  const bytes=await response.arrayBuffer();if(bytes.byteLength<12||new DataView(bytes).getUint32(0,true)!==0x46546c67)throw Error('유효한 GLB 파일이 아닙니다.');
  pr.equipmentModel={...pr.equipmentModel,equipmentName:f.name.value.trim()||pr.name,usdPath:f.processUsdPath.value.trim(),glbPath:path,source:f.processSource.value.trim(),reviewStatus:'UNREVIEWED_DRAFT',sourceAssetId:model.sourceAssetId||model.assetId};
  p.revision=(p.revision||0)+1;p.updatedAt=new Date().toISOString();latest.activeId=p.id;localStorage.setItem(key,JSON.stringify(latest));revision=p.revision;
  note.textContent=`${p.productName} / ${pr.name}에 적용 완료 · v${revision} · 3D로 돌아가 반영하세요.`;
 }catch(e){note.textContent=e.message;}finally{apply.disabled=false;}};
 const style=document.createElement('style');style.textContent='.process-context-strip{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px;margin-bottom:12px;border-left:4px solid #008895;background:#eef6f8;border-radius:6px}.process-context-strip strong{color:#123b59}.process-context-strip span{flex:1}.process-context-strip a{white-space:nowrap}.process-model-paths{margin:16px 0;padding:12px;border:1px solid #d2e0e8;border-radius:8px;background:#f8fbfc}.process-model-paths summary{cursor:pointer;font-weight:700}.process-model-paths p,.process-apply-status{color:#526b7c}.process-apply-status{min-height:1.2em}';document.head.append(style);
 attach(null);
 return {model,context,attach,prefill(){for(const id of ['draftPlanTarget','approvedPlanTarget']){const e=document.getElementById(id);if(e)e.value=context.planId+'::'+context.processId;}}};
}
