(()=> {
  const root=document.querySelector('#aiEquipmentWorkflow');
  if(!root)return;
  const steps={
    references:{label:'참고자료 수집',needs:[]},
    concepts:{label:'3D 시안 5개',needs:['references']},
    usd:{label:'USD 제작',needs:['concepts']},
    motion:{label:'가동 정보 수집',needs:['references']},
    animation:{label:'애니메이션 제작',needs:['usd','motion']}
  };
  const $=selector=>root.querySelector(selector);
  const preview=document.querySelector('#preview'),form=document.querySelector('#equipmentForm');
  let targetKey='',records={},studioContext=window.P006_STUDIO_PROCESS_CONTEXT||null;
  const info=()=>{
    const context=studioContext;
    const id=context
      ?(context.assetId||'')
      :((preview&&preview.dataset.asset)||new URLSearchParams(location.search).get('asset')||'');
    const formName=form&&form.elements.name&&form.elements.name.value.trim();
    const fallbackName=document.querySelector('#formTitle')?.textContent||'';
    return{
      id,
      name:formName||(context?.equipmentName||(!id&&context?.processName?context.processName+' · 설비 미배정':fallbackName)),
      code:(form&&form.elements.code&&form.elements.code.value.trim())||'',
      processId:context?.processId||'',processName:context?.processName||'',productName:context?.productName||'',
      planId:context?.planId||'',equipmentId:context?.equipmentId||null,
      manufacturerName:context?.manufacturerName||'',modelName:context?.modelName||'',
      processKind:context?.processKind||'',reviewStatus:context?.reviewStatus||''
    };
  };
  const keyFor=current=>current.id||((current.planId&&current.processId)?`process:${current.planId}:${current.processId}`:'unsaved');
  const storageKey=key=>'p006-ai-authoring-v1:'+key;
  const load=()=>{try{records=JSON.parse(localStorage.getItem(storageKey(targetKey))||'{}');}catch{records={};}};
  const links=()=>[...document.querySelectorAll('#assetReferenceMaterials a')].map(a=>({title:a.textContent.trim(),url:a.href}));
  const evidence=()=>[...document.querySelectorAll('#assetUploadedEvidence .evidence-item,#evidenceList .evidence-item')].map(row=>({name:row.querySelector('b')?.textContent||row.textContent.trim(),kind:row.querySelector('span')?.textContent||''}));
  function refresh(){
    const current=info(),nextKey=keyFor(current),hasTarget=!!(current.id||current.processId);
    if(nextKey!==targetKey){targetKey=nextKey;load();}
    const process=form&&form.elements.processId&&form.elements.processId.value
      ?form.elements.processId.selectedOptions[0].textContent
      :(current.processName||document.querySelector('.equipment-card.active small')?.textContent||'');
    $('#aiTargetLabel').textContent=current.id
      ?`${current.name} · ${current.id}${process?' · '+process:''}`
      :current.processId
        ?`${current.productName} / ${current.processName} · 설비 미배정 · AI 신규 제작 대상`
        :'설비를 선택하거나 제품 공정 대상을 지정하세요.';
    $('#aiEvidenceSummary').textContent='등록 자료 '+evidence().length+'개 · 참고 링크 '+links().length+'개';
    for(const [id,step] of Object.entries(steps)){
      const card=root.querySelector('[data-ai-stage="'+id+'"]');
      const button=card.querySelector('.ai-action');
      const output=card.querySelector('.ai-stage-result');
      if(records[id]){
        card.dataset.state='prepared';button.dataset.state='prepared';
        button.textContent=step.label+' · 요청서 준비됨';
        const when=new Date(records[id].preparedAt).toLocaleString('ko-KR',{hour12:false});
        output.innerHTML='<b>요청서 준비 · '+when+'</b><span>Codex 6.1 Sol API 연결 대기 · 산출물은 아직 생성되지 않았습니다.</span>';
      }else{
        card.dataset.state='pending';button.removeAttribute('data-state');
        button.textContent=step.label+' 요청';
      }
      button.disabled=!hasTarget;
      button.title=hasTarget?'':'제품 공정 또는 설비를 먼저 선택하세요.';
    }
    $('#downloadAiRequest').disabled=!Object.keys(records).length;
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-ai-action]');
    if(button){
      refresh();
      const current=info(),hasTarget=!!(current.id||current.processId);
      if(!hasTarget){$('#aiWorkflowMessage').textContent='먼저 설비를 선택하거나 상단에서 제품과 공정을 지정하세요.';return;}
      const id=button.dataset.aiAction,step=steps[id];
      const missing=step.needs.find(name=>!records[name]);
      if(missing){
        $('#aiWorkflowMessage').textContent='순서 확인: 먼저 “'+steps[missing].label+'” 요청서를 준비하세요.';
        root.querySelector('[data-ai-stage="'+missing+'"]').scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      const outputs={
        references:['manufacturer/model candidates','source','title','url','verified facts','missing evidence'],
        concepts:['five thumbnail candidates','source traceability','differences'],
        usd:['usd file','glb preview','thumbnail'],
        motion:['moving parts','axis','direction','distance','speed','sequence','evidence'],
        animation:['animation file','preview','process binding']
      };
      const targetKind=current.id?'EQUIPMENT_ASSET':'PRODUCT_PROCESS';
      const payload={
        schema:'p006-equipment-authoring-request/v2',provider:'codex-6.1-sol',providerConnection:'pending',
        target:{kind:targetKind,id:current.id||`${current.planId}:${current.processId}`,planId:current.planId||null,productName:current.productName||null,processId:current.processId||null,processName:current.processName||null,processKind:current.processKind||null},
        asset:{id:current.id||null,name:current.name,code:current.code,existingEquipmentId:current.equipmentId,manufacturerName:current.manufacturerName||null,modelName:current.modelName||null,reviewStatus:current.reviewStatus||null},
        task:id,taskLabel:step.label,referenceLinks:links(),registeredEvidence:evidence(),
        previousRequests:Object.fromEntries(step.needs.map(name=>[name,records[name]?.requestId||null])),
        expectedOutput:outputs[id],preparedAt:new Date().toISOString()
      };
      payload.requestId=`${targetKey}-${id}-${Date.now()}`;
      records[id]={requestId:payload.requestId,preparedAt:payload.preparedAt,payload:payload};
      try{localStorage.setItem(storageKey(targetKey),JSON.stringify(records));}
      catch(error){$('#aiWorkflowMessage').textContent='요청서 임시 저장 실패: '+error.message;return;}
      window.dispatchEvent(new CustomEvent('p006:equipment-authoring:request',{detail:payload}));
      $('#aiWorkflowMessage').textContent=`${current.productName?current.productName+' / ':''}${current.processName||current.name} · ${step.label} 요청서가 브라우저에 임시 저장되었습니다. Codex 6.1 Sol 생성 연결은 별도 확인이 필요하며 아직 파일을 생성하지 않았습니다.`;
      refresh();return;
    }
    if(event.target.closest('#downloadAiRequest')){
      refresh();
      const current=info();
      const payload={schema:'p006-equipment-authoring-batch/v2',targetKey,assetId:current.id||null,planId:current.planId||null,processId:current.processId||null,provider:'codex-6.1-sol',providerConnection:'pending',requests:Object.values(records).map(row=>row.payload)};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=(current.id||current.processId||'equipment')+'-authoring-requests.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      $('#aiWorkflowMessage').textContent='선택 대상의 단계별 요청서 JSON을 내려받았습니다. 파일에는 요청 명세만 있고 AI 생성 결과물은 없습니다.';
    }
  });
  const observer=new MutationObserver(refresh);
  if(preview)observer.observe(preview,{attributes:true,attributeFilter:['data-asset']});
  const list=document.querySelector('#equipmentList');
  if(list)observer.observe(list,{attributes:true,subtree:true,attributeFilter:['class']});
  if(form){form.addEventListener('input',refresh);form.addEventListener('change',refresh);}
  document.addEventListener('p006:studio-process-context',event=>{studioContext=event.detail||null;refresh();});
  document.addEventListener('p006:asset-evidence-count',refresh);
  document.addEventListener('click',event=>{if(event.target.closest('.equipment-card'))setTimeout(refresh,50);});
  refresh();
})();
