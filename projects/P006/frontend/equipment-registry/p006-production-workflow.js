(() => {
  'use strict';
  const titles = ['제품·부품', '공정 순서', '부지·공장', '설비 배치', '작업물·운송', '설비 동작', '실행·저장 검증'];
  const key = 'p006-production-workflow-draft-v1';
  let step = 0, draft = null, loadedId = null;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaults = () => ({schema:'P006_PRODUCTION_WORKFLOW_V1', productId:'DEMO_TWO_PART_ASSEMBLY', productName:'2부품 나사 체결 시연', productSource:'', bom:[{partId:'DEMO_PART_A',quantity:1},{partId:'DEMO_PART_B',quantity:1}], sequence:'부품 A 처리 → 공장 C 입고\n부품 B 처리 → 공장 C 입고\nBOM 확인 → 조립 → 검사 → 출고',factorySteps:[], siteName:'', siteWidth:25, siteLength:20, siteSource:'USER_CONFIGURED', equipmentNotes:'', transportNotes:'', motionAssetId:'', motionNode:'', motionAxis:'', motionSource:'', evidenceStatus:'FUNCTIONAL_DEMO', verificationStatus:'NOT_VERIFIED'});
  function input(name,label,value,type='text') {return `<label style="display:block;margin:8px 0">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0.01" max="100000" step="0.01"':''} style="display:block;width:100%;max-width:680px"></label>`;}
  function area(name,label,value) {return `<label style="display:block;margin:8px 0">${label}<textarea name="${name}" rows="3" style="display:block;width:100%;max-width:900px;padding:8px">${esc(value)}</textarea></label>`;}
  function state() {return window.P006_WORKFLOW?.read() || {};}
  function collect() {
    if (!draft) return;
    document.querySelectorAll('#workflowFields [name]').forEach(el => {
      if (el.name === 'bom') return;
      draft[el.name] = el.type==='number' ? Number(el.value) : el.value;
    });
    const bomRows=[...document.querySelectorAll('#workflowFields [data-bom-row]')];
    if (bomRows.length) {
      const parsed=bomRows.map(row=>({partId:row.querySelector('[data-bom-part]').value.trim(),quantity:Number(row.querySelector('[data-bom-quantity]').value)}));
      if (parsed.some(x=>!x.partId||!Number.isInteger(x.quantity)||x.quantity<1) || new Set(parsed.map(x=>x.partId)).size!==parsed.length) throw Error('부품 ID를 중복 없이 입력하고 수량은 1 이상 정수로 지정하세요.');
      draft.bom=parsed;
    }
    if (![draft.siteWidth,draft.siteLength].every(x=>Number.isFinite(x)&&x>0&&x<=100000)) throw Error('부지 폭·길이는 0보다 크고 100,000m 이하로 입력하세요.');
    localStorage.setItem(key+':'+loadedId,JSON.stringify(draft));
  }
  function statusList(s) {return [draft.productSource?'자료 등록·검토 대기':'실제 제품 자료 필요',draft.sequence?'순서 입력됨':'순서 필요',draft.siteName?'부지 설정됨':'부지 이름 필요',s.design?`공장 ${s.design.factories.length}개 참조`:'공장 선택 필요',draft.transportNotes?'계획 입력·연결 미검증':'운송 계획 필요',draft.motionNode&&draft.motionSource?'동작 근거 검토 대기':'동작 근거 필요',s.executionBlocker || (s.runtime?.finishedCount?'기능 시연 완료·실제 생산 미검증':'기능 시연 가능·실제 생산 미검증')];}
  function bomTable(){return `<div class="bom-table"><div class="bom-heading"><b>부품 ID</b><b>수량</b></div>${draft.bom.map((item,i)=>`<div data-bom-row><input data-bom-part aria-label="부품 ${i+1} ID" value="${esc(item.partId)}"><input data-bom-quantity aria-label="부품 ${i+1} 수량" type="number" min="1" step="1" value="${esc(item.quantity)}"><button type="button" data-workflow-action="remove-part" data-index="${i}">삭제</button></div>`).join('')}</div><button type="button" data-workflow-action="add-part">부품 추가</button>`;}
  function render(preserve=false) {
    const s=state(), id=s.networkId || 'draft';
    if (preserve && loadedId===id && document.querySelector('#workflowFields')) {
      if (document.activeElement?.closest('#workflowFields')) return;
      try { collect(); } catch { return; }
    }
    if (!draft || loadedId!==id) {
      const initialDraft=loadedId==='draft'?draft:null;
      let cached;try{cached=JSON.parse(localStorage.getItem(key+':'+id)||'null');}catch{}
      draft=structuredClone(s.design?.product?.workflow || cached || initialDraft || defaults());loadedId=id;
    }
    const statuses=statusList(s);
    const fields=[
      () => `<label>제품 선택<select name="productId"><option value="NEW_PRODUCT" ${draft.productId==='NEW_PRODUCT'?'selected':''}>+ 새 제품 직접 추가</option>${(window.P006_WORKFLOW?.products()||[]).map(c=>`<option value="${esc(c.id)}" ${draft.productId===c.id?'selected':''}>${esc(c.name)} · ${esc(c.status)}</option>`).join('')}</select></label>`+input('productName','완제품 이름',draft.productName)+input('productSource','제품 도면·BOM 원본·제품 자료 경로 또는 URL',draft.productSource)+`<p>부품 목록과 수량</p>`+bomTable()+'<button type="button" data-workflow-action="register-product">제품 원장에 등록</button><p>등록 제품은 설계 후보입니다. 실제 제품·가동 검증은 별도입니다.</p>',
      () => area('sequence','부품별 가공·조립·검사 순서',draft.sequence)+`<section class="workflow-factory-add"><h3>공정에 공장 추가</h3><label>저장된 공장<select id="workflowFactoryLayout"><option value="">공장 선택</option>${(window.P006_WORKFLOW?.layouts()||[]).map(l=>`<option value="${esc(l.id)}">${esc(l.name)} · 설비 ${l.count}개 · v${l.version}</option>`).join('')}</select></label><label>공장 담당 공정<input id="workflowFactoryTask" placeholder="예: 부품 가공 또는 최종 검사"></label><button type="button" data-workflow-action="add-factory">공장 추가</button><ol>${(s.design?.factories||[]).map((f,i)=>`<li>${esc(f.name)} — ${esc(draft.factorySteps?.find(x=>x.factoryInstanceId===f.factoryInstanceId)?.taskName||'공정 미지정')} · 연결 미검증</li>`).join('')}</ol></section><p>공장 추가는 저장된 설계 참조만 만듭니다. 운송 연결·동작은 별도 검증 전까지 차단합니다.</p>`,
      () => input('siteName','부지 이름',draft.siteName)+input('siteWidth','부지 폭 (m) · 사용자 설계값',draft.siteWidth,'number')+input('siteLength','부지 길이 (m) · 사용자 설계값',draft.siteLength,'number')+`<p>설계 면적 ${(draft.siteWidth*draft.siteLength).toFixed(2)}m². 공장 ${s.design?.factories.length||0}개 참조. 부지 치수는 설계 조건이며 실제 지적·충돌 검증은 별도입니다.</p><button type="button" data-workflow-action="factories">공장 선택으로 이동</button>`,
      () => area('equipmentNotes','공장별 설비·담당 작업·고정 조건',draft.equipmentNotes)+'<button type="button" data-workflow-action="composer">선택 공장 설비 편집</button><p>기존 Composer에서 설비를 추가하고 자동 배치할 수 있습니다. 미검증 관계는 기존 차단 상태를 유지합니다.</p>',
      () => area('transportNotes','작업물 모델·투입/배출 위치·거치 높이·운송 장치',draft.transportNotes)+'<p>높이 차이를 해결할 운송 장치와 경로를 확인해야 합니다. 현재 Pilot 작업물 Lot은 실제 3D 제품 모델이 없는 기능 시연 데이터입니다.</p>',
      () => input('motionAssetId','설비 Asset ID',draft.motionAssetId)+input('motionNode','실제 가동부 Prim / Node 경로',draft.motionNode)+input('motionAxis','축·피벗 근거',draft.motionAxis)+input('motionSource','제품 기능·동작 근거 자료',draft.motionSource)+'<p>동작 설정 검토 요청으로 저장합니다. 실제 Node·피벗·자료 대응과 연속 영상 검증 전에는 애니메이션 완료로 표시하지 않습니다.</p>',
      () => `<ul>${statuses.map((x,i)=>`<li>${i+1}. ${titles[i]}: ${esc(x)}</li>`).join('')}</ul><p>DB 설계: ${s.saved?'저장됨':'미저장 또는 변경 있음'} · 실행 이벤트: ${s.runtime?.events?.length||0}개 · 실제 생산 검증: 미완료</p><button type="button" data-workflow-action="run">기능 시연 제어로 이동</button><a href="P006-PRODUCTION-WORKFLOW-DESIGN.md" style="margin-left:12px">설계·검증·다음 작업</a>`
    ];
    document.querySelector('#productionWorkflow').innerHTML=`<h2>제품부터 생산 검증까지 · ${step+1}/7</h2><nav aria-label="생산 설계 단계" style="display:flex;gap:6px;flex-wrap:wrap">${titles.map((t,i)=>`<button type="button" data-workflow-step="${i}" aria-current="${i===step?'step':'false'}" class="${i===step?'primary':''}">${i+1}. ${t}</button>`).join('')}</nav><form id="workflowFields">${fields[step]()}</form><p id="workflowMessage" role="status">${esc(statuses[step])}</p><div style="display:flex;gap:8px"><button type="button" data-workflow-action="previous" ${step===0?'disabled':''}>이전</button><button type="button" data-workflow-action="next" ${step===6?'disabled':''}>입력 보관 후 다음</button><button type="button" data-workflow-action="save" class="primary">생산 설계 DB 저장</button></div>`;
  }
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-workflow-step],[data-workflow-action]');if(!button)return;
    try {
      collect();
      if(button.dataset.workflowStep!==undefined){step=Number(button.dataset.workflowStep);render();return;}
      const action=button.dataset.workflowAction;
      if(action==='add-part'){draft.bom.push({partId:'',quantity:1});render();return;}
      if(action==='register-product'){if(!draft.productName.trim())throw Error('제품 이름을 입력하세요.');const saved=await window.P006_WORKFLOW.saveProduct(draft);draft.productId=saved.id;draft.evidenceStatus='DESIGN_CANDIDATE';render();document.querySelector('#workflowMessage').textContent='제품 원장 DB 등록 완료 · 실제 제품 검증은 미완료';return;}
      if(action==='add-factory'){const layoutId=document.querySelector('#workflowFactoryLayout').value,task=document.querySelector('#workflowFactoryTask').value.trim();if(!layoutId||!task)throw Error('저장 공장과 담당 공정을 선택하세요.');const added=await window.P006_WORKFLOW.addFactory(layoutId,task,draft);draft.factorySteps=[...(draft.factorySteps||[]),{factoryInstanceId:added.factoryInstanceId,taskName:task,order:(draft.factorySteps||[]).length+1}];render();return;}
      if(action==='remove-part'){draft.bom.splice(Number(button.dataset.index),1);render();return;}
      if(action==='next'||action==='previous'){step+=action==='next'?1:-1;render();}
      if(action==='save'){window.P006_WORKFLOW.apply(draft);await window.P006_WORKFLOW.save();document.querySelector('#workflowMessage').textContent='생산 설계 DB 저장 완료 · 제품/동작 검증 상태는 미검증으로 유지됩니다.';}
      if(action==='factories')document.querySelector('#factoryA').scrollIntoView({behavior:'smooth',block:'center'});
      if(action==='composer')window.P006_WORKFLOW.openFactory();
      if(action==='run')document.querySelector('#runStart').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){document.querySelector('#workflowMessage').textContent=error.message;}
  });
  document.addEventListener('change',e=>{
    if(e.target.name!=='productId'||!e.target.closest('#productionWorkflow'))return;
    try {
      collect();
      const candidate=window.P006_WORKFLOW.products().find(x=>x.id===draft.productId);
      if(candidate){draft.productName=candidate.name;draft.bom=structuredClone(candidate.bom);window.P006_WORKFLOW.setCandidate(candidate.id);}
      else if(draft.productId==='NEW_PRODUCT'){draft.productName='';draft.productSource='';draft.bom=[];draft.evidenceStatus='DESIGN_CANDIDATE';}
      render();
    }catch(error){document.querySelector('#workflowMessage').textContent=error.message;}
  });
  document.addEventListener('submit',e=>{if(e.target.id==='workflowFields')e.preventDefault();});
  window.P006ProductionWorkflow={render:()=>render(true),choose(id){try{collect();const candidate=window.P006_WORKFLOW.products().find(x=>x.id===id);if(!candidate)return;draft.productId=id;draft.productName=candidate.name;draft.bom=structuredClone(candidate.bom);step=0;render();}catch(error){document.querySelector('#workflowMessage').textContent=error.message;}}};
})();
