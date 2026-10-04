(() => {
  'use strict';
  const root=document.getElementById('siteCameras');
  let plan=null,schedule=null,cards=[],signature='',lastPaint=0;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function cardMarkup({scope,id,siteId,name,sub}){
    const key=`${scope}:${id}`;
    return `<article class="pp-camera-card" data-camera-scope="${scope}" data-camera-id="${esc(id)}" data-site="${esc(siteId)}"><header><strong>${esc(name)}</strong><span>${sub}</span></header><p class="pp-camera-equipment-status" aria-live="polite">설비 배정 현황 계산 중</p><p class="pp-camera-demo" aria-live="polite"></p><div class="pp-camera-modes" role="group" aria-label="${esc(name)} 카메라 표시 대상"><button type="button" class="pp-button pp-secondary pp-camera-mode" data-camera-mode="equipment" aria-pressed="false">설비 보기</button><button type="button" class="pp-button pp-secondary pp-camera-mode" data-camera-mode="all" aria-pressed="true">설비·작업물</button><button type="button" class="pp-button pp-secondary pp-camera-mode" data-camera-mode="workpieces" aria-pressed="false">작업물 보기</button></div><p class="pp-camera-mode-summary" aria-live="polite">이 위치의 설비와 현재 작업물을 함께 표시합니다.</p><canvas width="560" height="300" aria-label="${esc(name)} 독립 3D 카메라" hidden></canvas><p class="pp-camera-empty">연결된 GLB를 불러오면 여기에 표시됩니다.</p><p class="pp-camera-time"></p><div class="pp-camera-work"></div><footer><button type="button" class="pp-button pp-secondary" data-reset>카메라 초기화</button><small>드래그 회전 · Alt+드래그 이동 · 휠 확대</small></footer></article>`;
  }
  function configure(p,s){
    plan=p;schedule=s;
    const key=JSON.stringify([p.id,p.sites,p.factories,p.processes.map(x=>[x.id,x.factoryId,x.equipmentModel?.assetId,x.equipmentModel?.glbPath])]);
    if(key===signature)return;
    signature=key;
    root.innerHTML=(p.sites||[]).map(site=>{
      const factories=(p.factories||[]).filter(f=>f.siteId===site.id);
      const siteCard=cardMarkup({scope:'site',id:site.id,siteId:site.id,name:site.name,sub:site.kind==='REAL'?'등록 부지':'계획 부지'});
      const factoryCards=factories.map(factory=>cardMarkup({scope:'factory',id:factory.id,siteId:site.id,name:factory.name,sub:`공장 · ${site.name}`})).join('');
      return `<section class="pp-camera-site-group" data-site-group="${esc(site.id)}"><header class="pp-camera-site-heading"><strong>${esc(site.name)}</strong><span>부지 전체 카메라 · 공장 ${factories.length}개</span></header><div class="pp-camera-site-card">${siteCard}</div>${factoryCards?`<div class="pp-camera-factory-grid">${factoryCards}</div>`:'<p class="pp-camera-empty-note">등록된 공장이 없습니다.</p>'}</section>`;
    }).join('')||'<p>부지·공장 단계에서 부지와 공장을 추가하세요.</p>';
    cards=[...root.querySelectorAll('.pp-camera-card')].map(el=>({el,id:el.dataset.cameraId,scope:el.dataset.cameraScope,siteId:el.dataset.site,canvas:el.querySelector('canvas'),yaw:.65,pitch:.8,zoom:1,panX:0,panY:0,pointer:null,mode:'all'}));
    for(const c of cards){
      c.el.querySelector('[data-reset]').onclick=()=>{c.yaw=.65;c.pitch=.8;c.zoom=1;c.panX=0;c.panY=0;redraw();};
      c.el.querySelectorAll('[data-camera-mode]').forEach(button=>button.onclick=()=>{c.mode=button.dataset.cameraMode;c.el.querySelectorAll('[data-camera-mode]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));const summary=c.el.querySelector('.pp-camera-mode-summary');if(summary)summary.textContent=c.mode==='equipment'?'이 위치의 설비만 표시합니다.':c.mode==='workpieces'?'이 위치의 현재 작업물·완제품만 표시합니다.':'이 위치의 설비와 현재 작업물을 함께 표시합니다.';redraw();});
      c.canvas.onpointerdown=e=>{c.pointer={x:e.clientX,y:e.clientY,mode:e.altKey?'pan':'orbit'};c.canvas.setPointerCapture(e.pointerId);};
      c.canvas.onpointermove=e=>{if(!c.pointer)return;const dx=e.clientX-c.pointer.x,dy=e.clientY-c.pointer.y;if(c.pointer.mode==='pan'){c.panX+=dx;c.panY+=dy;}else{c.yaw+=dx*.01;c.pitch=Math.max(.1,Math.min(1.5,c.pitch+dy*.01));}c.pointer={...c.pointer,x:e.clientX,y:e.clientY};redraw();};
      c.canvas.onpointerup=c.canvas.onpointercancel=()=>c.pointer=null;
      c.canvas.onwheel=e=>{e.preventDefault();c.zoom=Math.max(.2,Math.min(8,c.zoom*Math.exp(e.deltaY*.001)));redraw();};
    }
  }
  function cardFactoryIds(c){return c.scope==='factory'?new Set([c.id]):new Set((plan?.factories||[]).filter(f=>f.siteId===c.siteId).map(f=>f.id));}
  function redraw(){lastPaint=0;capture();}
  function update(run,p,v){
    if(p)plan=p;if(!plan)return;if(performance.now()-(update.last||0)<250)return;update.last=performance.now();
    const time=run?.time||0,done=new Set(run?.processed||[]);
    for(const c of cards){
      const ids=cardFactoryIds(c),equipment=plan.processes.filter(proc=>proc.kind!=='DISPATCH'&&ids.has(proc.factoryId)),linked=equipment.filter(proc=>proc.equipmentModel?.assetId&&proc.equipmentModel?.glbPath),rendered=(v?.entries||[]).filter(entry=>entry.row.scope==='processes'&&equipment.some(proc=>proc.id===entry.row.id)),missing=equipment.filter(proc=>!proc.equipmentModel?.glbPath).map(proc=>proc.name);
      const status=c.el.querySelector('.pp-camera-equipment-status');if(status){const st=shared()?.stats(),text=st?'전체 보기와 동일한 장면 · 공유 GLB '+st.loaded+'/'+st.expected+' · 추가 모델 로딩 없음':'전체 보기의 공통 장면 준비 중';if(status.textContent!==text)status.textContent=text;}
      const tasks=(schedule?.tasks||[]).filter(t=>ids.has(t.factoryId)||ids.has(t.fromFactoryId)),active=tasks.filter(t=>done.has(t.id+':start')&&!done.has(t.id+':end'));
      c.el.querySelector('.pp-camera-time').textContent=`공통 시간 ${time.toFixed(1)}분 · 진행 ${active.length} · 완료 ${tasks.filter(t=>done.has(t.id+':end')).length}/${tasks.length}`;
      c.el.querySelector('.pp-camera-work').textContent=active.map(t=>t.name).join(' · ')||(run?.state==='COMPLETE'?'완료':!schedule?.ok?'공정 조건 확인 필요':'작업 대기');
      const demo=(v?.demoEntries||[]).filter(e=>(e.factoryIds||[e.factoryId]).some(id=>ids.has(id))||ids.has(e.part?.factoryId)),demoHere=demo.filter(e=>e.group.visible),demoLabel=c.el.querySelector('.pp-camera-demo');if(demoLabel)demoLabel.textContent=demoHere.length?`가상 시연 모듈 ${demoHere.length}종 표시 · 제품/치수 검증 전`:demo.length?`시연 모듈 ${demo.length}종 · 제작/입고 후 표시 (FUNCTIONAL_DEMO)`:'';
      c.el.classList.toggle('is-running',active.length>0);
      if(plan.animationEnabled===false){c.canvas.hidden=true;c.el.querySelector('.pp-camera-empty').hidden=false;c.el.querySelector('.pp-camera-empty').textContent='애니메이션 표시 꺼짐 · 공정 상태는 계속 표시됩니다.';}
    }
  }
  function clear(){lastPaint=0;for(const c of cards){c.canvas.hidden=true;c.el.querySelector('.pp-camera-empty').hidden=false;c.el.querySelector('.pp-camera-empty').textContent='연결 모델 미로딩';}}
  function selectObjects(objects,ids,mode){return objects.filter(item=>item.factoryIds.some(id=>ids.has(id))&&item.visible&&(mode==='equipment'?item.kind==='equipment':mode==='workpieces'?item.kind!=='equipment':true));}
  function shared(){return window.ProductPlannerProductionSceneCameras||document.getElementById('productionSceneFrame')?.contentWindow?.ProductionSceneCameras;}
  const metrics={renders:0,visible:0,source:'production-scene-shared'};
  const sharedText='전체 보기와 동일한 부지·공장·설비·운송 장면을 공유합니다. 보이는 카메라만 최대 30fps로 갱신하며 모델은 중복 로딩하지 않습니다.';
  function capture(){
    if(!plan||plan.animationEnabled===false||root.closest('[hidden]')||document.hidden||(window.ProductPlannerSceneRoot?window.ProductionSceneRecordingActive:document.getElementById('productionSceneFrame')?.contentWindow?.ProductionSceneRecordingActive))return;
    if(performance.now()-lastPaint<32)return;lastPaint=performance.now();
    const api=shared();if(!api)return;metrics.visible=0;
    const notice=document.getElementById('siteCameraNotice');if(notice&&notice.textContent!==sharedText)notice.textContent=sharedText;
    const visibleCards=cards.filter(c=>{const r=c.el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});
    const ratio=Math.min(2,parent.devicePixelRatio||1),maxWidth=Math.max(0,...visibleCards.map(c=>c.canvas.clientWidth*ratio)),maxHeight=Math.max(0,...visibleCards.map(c=>c.canvas.clientHeight*ratio));
    api.prepareResolution?.(maxWidth,maxHeight);
    for(const c of visibleCards){
      metrics.visible++;
      c.canvas.hidden=false;if(api.render(c)){c.el.querySelector('.pp-camera-empty').hidden=true;c.canvas.dataset.sceneSource='production-scene-shared';metrics.renders++;}else c.canvas.hidden=true;
      const stats=api.stats(),status='전체 보기와 동일한 장면 · 공유 GLB '+stats.loaded+'/'+stats.expected+' · 추가 모델 로딩 없음',label=c.el.querySelector('.pp-camera-equipment-status');if(label.textContent!==status)label.textContent=status;
    }
  }
  setInterval(capture,33);
  document.getElementById('loadSiteCameras')?.addEventListener('click',e=>{e.stopImmediatePropagation();redraw();},true);
  window.ProductPlannerMultiView={configure,update,capture,clear,metrics,__test:{selectObjects,cardFactoryIds}};
})();
