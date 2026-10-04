'use strict';
// E001 pilot: display LOD only. Source GLB and engineering geometry remain unchanged.
(() => {
  const ASSET='E001', ROOT='/projects/P006/assets/3d-derived/';
  const urls={ORIGINAL:ROOT+'E001.glb',LOD1:ROOT+'LOD/E001-lod1.glb',LOD2:ROOT+'LOD/E001-lod2.glb'};
  const hashes={ORIGINAL:'4f450810d8b0ad638f5005175f895337abf7302ec360329abb57deac3d888024',LOD1:'e7f944149511f7f4fd9cc1ccbe6f1a7b54b963eb898d664d154273b65aa31fa7',LOD2:'7ee3f81a5fb511e7ed62c769988833632883f3416d219ba10055379de204ebda'};
  const saved=new Map();let mode=['ORIGINAL','LOD1','LOD2','AUTO'].includes(new URLSearchParams(location.search).get('lod'))?new URLSearchParams(location.search).get('lod'):'ORIGINAL',active='ORIGINAL',lastDistance=null,unavailable='ONLY_E001_PILOT';
  const oldRender=renderThreeScene;
  function distance(){
    const i=doc?.instances?.find(x=>x.assetId===ASSET);
    if(!i||!threeState.camera)return null;
    const p=new threeState.THREE.Vector3(...i.position),d=threeState.camera.position.distanceTo(p);
    return Number.isFinite(d)?d:null;
  }
  function desired(){
    if(mode!=='AUTO')return mode;
    if((doc?.instances||[]).some(x=>x.assetId===ASSET&&selected.has(x.id)))return 'ORIGINAL';
    const d=distance();lastDistance=d;if(d===null)return 'ORIGINAL';
    if(active==='ORIGINAL')return d>20?'LOD1':'ORIGINAL';
    if(active==='LOD1')return d<16?'ORIGINAL':d>40?'LOD2':'LOD1';
    return d<34?'LOD1':'LOD2';
  }
  function sync(){
    const row=threeState.manifest?.get(ASSET);if(!row)return;
    const want=desired();if(want===active&&row.glbPath===urls[want])return;
    if(threeState.pending.has(ASSET))return;
    if(threeState.cache.has(ASSET))saved.set(active,threeState.cache.get(ASSET));
    active=want;threeState.manifest.set(ASSET,{...row,glbPath:urls[active],lodLevel:active});
    if(saved.has(active))threeState.cache.set(ASSET,saved.get(active));else threeState.cache.delete(ASSET);
  }
  renderThreeScene=function(...args){if(threeState.ready)sync();return oldRender.apply(this,args)};
  function setMode(next){if(!['ORIGINAL','LOD1','LOD2','AUTO'].includes(next))throw Error('LOD 모드 오류');mode=next;if(threeState.ready)renderThreeScene();update();return getState()}
  function getState(){return {mode,active,activeSha256:hashes[active],sourceSha256:hashes.ORIGINAL,distanceM:lastDistance,supportedAssets:[ASSET],unsupportedAssetReason:unavailable,geometrySource:'DISPLAY_ONLY',selectedKeepsOriginal:mode==='AUTO',hysteresisM:{originalToLod1:20,lod1ToOriginal:16,lod1ToLod2:40,lod2ToLod1:34},pilotLimit:'E001 GLB has no embedded animation clips; motion preservation is unverified'}}
  function update(){const el=document.getElementById('p006LodMode');if(el)el.value=mode;const info=document.getElementById('p006LodInfo');if(info)info.textContent=active+' · E001만 최적화 모델 적용';}
  window.P006_LOD={setMode,getState};
  const bar=document.querySelector('.documentbar');if(bar){
    // The performance entry is rendered in composer.html independently of LOD initialization.
    const label=document.createElement('label');label.style.cssText='display:inline-flex;align-items:center;gap:5px;font-size:12px';label.textContent='LOD 표시';
    const select=document.createElement('select');select.id='p006LodMode';select.setAttribute('aria-label','LOD 표시 단계');
    for(const [value,name] of [['ORIGINAL','원본'],['LOD1','E001 단계 1'],['LOD2','E001 단계 2'],['AUTO','자동']]){const o=document.createElement('option');o.value=value;o.textContent=name;select.append(o)}
    select.onchange=()=>setMode(select.value);label.append(select);bar.append(label);
    const info=document.createElement('small');info.id='p006LodInfo';bar.append(info);update();
  }
  const guide=document.getElementById('helpDialog');if(guide){const section=document.createElement('section');section.innerHTML='<h3>초기 로딩 시간</h3><p>메인 화면의 초기 로딩 결과 → 현재 공장 로딩 측정 5회 → 저장 결과 확인.</p><a href="factory-performance-design.md">계측 기준·화면 설계·QA·다음 업무</a>';guide.append(section)}
})();
