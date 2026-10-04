(() => {
  'use strict';
  const host=document.getElementById('productionSceneDirectHost');
  if(!host)return;
  window.ProductPlannerReadScenePlan=()=>{
    const provider=window.ProductPlannerPlayback;
    const current=provider?.getPlan?.();
    if(current)return current;
    try{
      const saved=JSON.parse(localStorage.getItem('p006-product-plans-v1')||'null');
      const id=provider?.snapshot?.()?.planId||saved?.activeId;
      return saved?.plans?.find(plan=>plan.id===id)||null;
    }catch{return null;}
  };
  const showError=message=>{host.textContent='생산 현장 3D를 준비하지 못했습니다: '+message;};
  (async()=>{
    try{
      const response=await fetch('production-scene.html?rev=direct-scene-3',{cache:'no-store'});
      if(!response.ok)throw new Error('생산 현장 화면 요청 실패 (HTTP '+response.status+')');
      const source=new DOMParser().parseFromString(await response.text(),'text/html');
      const shadow=host.attachShadow({mode:'open'});
      window.ProductPlannerSceneRoot=shadow;
      const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='production-scene.css?v=direct-scene-3';shadow.append(stylesheet);
      const shell=document.createElement('div');shell.className='native-production-scene';
      source.querySelectorAll('style').forEach(style=>shell.append(style.cloneNode(true)));
      for(const selector of ['.toolbar','#process-focus','main','footer']){
        const node=source.querySelector(selector);
        if(!node)throw new Error('생산 현장 구성 요소를 찾지 못했습니다: '+selector);
        shell.append(node.cloneNode(true));
      }
      const localStyle=document.createElement('style');
      localStyle.textContent=`:host{display:block;width:100%;height:100%;overflow:hidden;color:#17364d;font:14px 'Malgun Gothic',sans-serif}*,*::before,*::after{box-sizing:border-box}.native-production-scene{height:100%;min-height:0;overflow:hidden;background:#eef4f7}.toolbar{display:flex!important;min-height:34px;padding:4px 10px!important;border:0!important}.toolbar>*:not(#notice){display:none!important}#notice{display:inline-block!important;font-size:12px;color:#365870}#process-focus{margin:4px 8px!important;padding:6px 10px!important}#focus-cards{max-height:100px}.focus-card{padding:5px 8px!important}main{height:calc(100% - 158px)!important;min-height:360px!important;margin:0 8px!important;padding:0 0 6px!important;grid-template-columns:minmax(150px,17%) minmax(300px,1fr) minmax(170px,18%)!important;gap:8px!important}.scene{min-height:0!important}#canvas{height:calc(100% - 65px)!important}footer{display:none!important}@media(max-width:900px){main{height:auto!important;min-height:65vh!important;grid-template-columns:1fr!important}.scene{height:55vh!important;min-height:360px!important}main>aside:last-child{grid-column:auto!important;max-height:220px}}`;
      shell.prepend(localStyle);shadow.append(shell);
      const module=document.createElement('script');module.type='module';module.src='production-scene-integrated.js?v=direct-plan-sync-4';module.onerror=()=>{const n=window.ProductPlannerSceneRoot?.querySelector('#notice');if(n)n.textContent='3D 렌더러 스크립트를 불러오지 못했습니다.';};
      document.head.append(module);
      let lastKey='';
      const syncPlan=()=>{
        const api=window.ProductPlannerProductionScene,provider=window.ProductPlannerPlayback;
        if(!api||!provider)return;
        const plan=window.ProductPlannerReadScenePlan();if(!plan)return;
        const key=[plan.id,plan.revision,plan.updatedAt].join('|');
        if(key!==lastKey){lastKey=key;api.setPlan(plan);}
      };
      window.addEventListener('p006:plan-changed',syncPlan);
      const timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return;}syncPlan();},250);
    }catch(error){showError(error?.message||String(error));}
  })();
})();
