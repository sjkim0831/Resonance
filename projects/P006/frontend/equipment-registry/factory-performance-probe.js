'use strict';
// Loaded after Composer. The benchmark iframe observes the real Composer scene.
(() => {
  if (new URLSearchParams(location.search).get('benchmark') !== '1') return;
  const started = performance.now();
  const state = {started, firstGeometryAt:null, initialReadyAt:null, interactiveAt:null, renderCpuMs:[], probeOverheadMs:[], parseMs:[], errors:[],cancelled:false};
  const originalRender = renderThreeScene;
  renderThreeScene = function(...args) {
    if (threeState.loader && !threeState.loader.__p006Measured) {
      const loader=threeState.loader,oldParse=loader.parse;
      loader.parse=function(data,path,onLoad,onError){const began=performance.now();return oldParse.call(this,data,path,(g)=>{state.parseMs.push(performance.now()-began);onLoad(g)},onError)};
      loader.__p006Measured=true;
    }
    const t = performance.now();
    const result = originalRender.apply(this,args);
    const elapsed = performance.now()-t;
    state.renderCpuMs.push(elapsed);
    if (state.renderCpuMs.length>2000) state.renderCpuMs.shift();
    const meshes = threeState.group?.children?.reduce((n,o) => {o.traverse(x=>{if(x.isMesh)n++});return n},0)||0;
    if (meshes>0 && viewMode==='3d') {
      const now = performance.now();
      if (state.firstGeometryAt===null) state.firstGeometryAt=now;
      const target = new Set((doc?.instances||[]).filter(x=>x.assetId&&!x.templateId).map(x=>x.assetId));
      const known = [...target].every(id=>threeState.cache.has(id) || (!threeState.pending.has(id) && window.P006_3D_DEBUG.fallbackReason));
      if (known && state.initialReadyAt===null) state.initialReadyAt=now;
    }
    state.probeOverheadMs.push(Math.max(0,performance.now()-t-elapsed));
    if(state.probeOverheadMs.length>2000)state.probeOverheadMs.shift();
    return result;
  };
  function environment() {
    let gpu=null;
    try {const gl=threeState.renderer?.getContext(),e=gl?.getExtension('WEBGL_debug_renderer_info');gpu=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null}catch{}
    return {browser:navigator.userAgent,viewport:[innerWidth,innerHeight],devicePixelRatio,renderer:'Three.js WebGL',gpu:gpu||'UNAVAILABLE',jsHeapBytes:performance.memory?.usedJSHeapSize??null,visibility:document.visibilityState,screenRefreshHz:null,gpuFrameTimeMs:null};
  }
  function resources() {
    const entries=performance.getEntriesByType('resource');
    const model=entries.filter(x=>/\.glb(?:\?|$)/i.test(x.name));
    const numeric=x=>Number.isFinite(x)&&x>0?x:null;
    return {requestCount:entries.length,glbRequests:model.length,knownTransferBytes:entries.reduce((n,x)=>n+(numeric(x.transferSize)||0),0),modelKnownTransferBytes:model.reduce((n,x)=>n+(numeric(x.transferSize)||0),0),unknownTransferCount:entries.filter(x=>!numeric(x.transferSize)).length,cacheState:model.length&&model.every(x=>x.deliveryType==='cache')?'WARM_OBSERVED':'CACHE_UNKNOWN',models:model.map(x=>({url:x.name,durationMs:x.duration,transferBytes:numeric(x.transferSize),encodedBytes:numeric(x.encodedBodySize),cacheDelivery:x.deliveryType||null}))};
  }
  function snapshot() {
    const target=(doc?.instances||[]).filter(x=>x.assetId&&!x.templateId),ids=new Set(target.map(x=>x.assetId));
    const children=threeState.group?.children||[];
    let meshes=0,visible=0;for(const o of children){if(o.userData?.assetId&&!o.userData?.structureType)visible++;o.traverse(x=>{if(x.isMesh)meshes++})}
    const r=resources();const layout=performance.getEntriesByType('resource').find(x=>x.name.includes('/composer/layouts/'+doc?.id));
    const loads=[...ids].filter(id=>threeState.cache.has(id)).length;
    return {layoutId:doc?.id||null,layoutVersion:doc?.version??null,counts:{equipment:target.length,building:(doc?.instances||[]).filter(x=>x.templateId&&!x.testOnly).length,uniqueAssets:ids.size,repeatedInstances:target.length-ids.size,initialTarget:target.length,loadedInstances:visible,unloadedInstances:Math.max(0,target.length-visible),loadedUniqueAssets:loads,missingUniqueAssets:Math.max(0,ids.size-loads),visibleMeshes:meshes,drawCalls:threeState.renderer?.info.render.calls??null,triangles:threeState.renderer?.info.render.triangles??null},times:{navigationStartMs:0,layoutDataResponseMs:layout?.responseEnd??null,modelParseMs:state.parseMs.reduce((n,x)=>n+x,0),parseCalls:state.parseMs.length,firstGeometryMs:state.firstGeometryAt,initialReadyMs:state.initialReadyAt,interactiveMs:state.interactiveAt,renderCpuMedianMs:median(state.renderCpuMs),probeOverheadMedianMs:median(state.probeOverheadMs)},resources:r,environment:environment(),fallback:window.P006_3D_DEBUG.fallbackReason||null,errors:state.errors.slice(),lod:window.P006_LOD?.getState?.()||null,animationAvailable:(window.P006_3D_DEBUG.assetMotion||[]).some(x=>x.clipCount>0)};
  }
  function median(a){if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]}
  async function waitReady(timeoutMs=30000) {
    const until=performance.now()+timeoutMs;
    while(performance.now()<until){
      if(state.cancelled)throw Error('CANCELLED');
      if(window.composerReady&&threeState.ready&&state.firstGeometryAt!==null&&state.initialReadyAt!==null){
        const canvas=document.querySelector('#glCanvas'),before=threeState.camera.position.clone();
        // Verify camera and selection handlers are installed without mutating the layout.
        const camera=typeof document.querySelector('#viewport3d')?.onwheel==='function';
        const selection=typeof document.querySelector('#viewport3d')?.onpointerdown==='function';
        if(camera&&selection&&canvas?.clientWidth>0&&canvas?.clientHeight>0){state.interactiveAt=performance.now();return snapshot()}
        threeState.camera.position.copy(before);
      }
      if(window.composerReady&&threeState.ready&&window.P006_3D_DEBUG.fallbackReason&&!threeState.pending.size){state.interactiveAt=performance.now();return snapshot()}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error('INITIAL_RENDER_TIMEOUT');
  }
  async function fps({scenario='STATIC',warmupSeconds=5,durationSeconds=30,frameBudgetMs=33.33}={}) {
    if(!threeState.ready||!threeState.group?.children.length)throw Error('3D_SCENE_NOT_READY');
    const start=performance.now(),frames=[],cpu=[],camera=threeState.camera,base=camera.position.clone(),target=new threeState.THREE.Vector3(...(window.P006_3D_DEBUG.cameraTarget||[0,0,0]));
    let last=null,hidden=false,frame=0,renderStart;
    const end=start+(warmupSeconds+durationSeconds)*1000;
    while(performance.now()<end){
      if(state.cancelled)throw Error('CANCELLED');
      await new Promise(resolve=>requestAnimationFrame(now=>{hidden ||= document.visibilityState!=='visible';if(now>=start+warmupSeconds*1000&&last!==null)frames.push(now-last);last=now;
        if(scenario==='CAMERA'){const q=(now-start)/1000*.72;camera.position.set(base.x+Math.sin(q)*1.5,base.y+Math.sin(q*.5)*.4,base.z+Math.cos(q)*1.5);camera.lookAt(target)}
        if(scenario==='ANIMATION'){window.P006_FUNCTIONAL_SIM?.tick?.(1/60)}
        renderStart=performance.now();threeState.renderer.render(threeState.scene,camera);if(now>=start+warmupSeconds*1000)cpu.push(performance.now()-renderStart);frame++;resolve()}));
    }
    camera.position.copy(base);camera.lookAt(target);
    const ordered=[...frames].sort((a,b)=>a-b),pct=p=>ordered.length?ordered[Math.min(ordered.length-1,Math.ceil(p*ordered.length)-1)]:null;
    const actualMs=frames.reduce((n,x)=>n+x,0);
    return {scenario,mode:window.P006_LOD?.getState?.().mode||'ORIGINAL',warmupSeconds,durationSeconds,actualMeasurementMs:actualMs,frameCount:frames.length,meanFps:actualMs>0?1000*frames.length/actualMs:null,frameMs:{median:pct(.5),p95:pct(.95),p99:pct(.99),max:ordered.at(-1)||null,overBudget:frames.filter(x=>x>frameBudgetMs).length},renderCpuMedianMs:median(cpu),renderer:{drawCalls:threeState.renderer.info.render.calls,triangles:threeState.renderer.info.render.triangles},runningProcessCount:flowState?.playing?(doc?.settings?.processGroups?.length||0):0,workpieceCount:(doc?.instances||[]).filter(x=>x.templateId==='workpiece').length,hiddenDuringMeasurement:hidden,visibility:document.visibilityState,gpuFrameTimeMs:null,animationEvidence:scenario==='ANIMATION'?'FUNCTIONAL_CONTRACT_RUNTIME':'NOT_APPLICABLE'};
  }
  window.P006_PERF_PROBE={snapshot,waitReady,fps,started,state,cancel(){state.cancelled=true}};
  const activate=setInterval(()=>{if(!window.composerReady)return;clearInterval(activate);if(viewMode!=='3d')setView('3d')},80);
  addEventListener('error',e=>state.errors.push(String(e.message||e.error)));
  addEventListener('unhandledrejection',e=>state.errors.push(String(e.reason)));
})();
