const labels={
  'equipment-module':'완성 설비·모듈','part-jig':'부품·치공구','drawing':'기계·전기 도면',
  'list-check':'목록·일정·점검표','manual-design':'매뉴얼·설계자료',
  'technical-reference':'기타 기술자료','unity-simulator':'Unity 시뮬레이터'
};
const base='/projects/P006/assets/catalog/';
const equipmentRules=[
  ['금형 고압냉각','mold_cooling'],['로봇제어반','robot_panel'],['스프레이','spray_ladler'],['턴테이블','turntable_furnace'],
  ['주조기 필터','casting_filter'],['주조기필터','casting_filter'],['취출','takeout_robot'],['펀칭','punching_press'],
  ['트리밍','trimming_machine'],['진공','vacuum_unit'],['냉각장비','cooling_unit'],['이형제','release_agent'],
  ['보온로','holding_furnace'],['용해로','melting_furnace'],['래들러','ladler'],['주조기','casting_machine'],['제어반','main_panel']
];
const inferAssetCode=a=>a.assetCode||equipmentRules.find(([word])=>a.name.includes(word))?.[1]||null;
const physicalCategories=new Set(['equipment-module','part-jig']);
let catalogByPlacement=new Map();
const coreEquipment=[['casting_machine','주조기'],['holding_furnace','보온로'],['turntable_furnace','턴테이블로'],['trimming_machine','트리밍'],['cooling_unit','냉각장비'],['robot_panel','로봇 제어반'],['spray_ladler','스프레이 로봇·래들'],['release_agent','이형제 장치'],['main_panel','전체 제어반'],['vacuum_unit','진공장치'],['casting_filter','주조기 필터'],['melting_furnace','용해로'],['takeout_robot','취출 로봇'],['punching_press','펀칭 프레스'],['ladler','래들러'],['mold_cooling','금형 고압냉각장비']];
const dimensions={release_agent:{size:'1,065 × 2,023 × 1,600mm',status:'PDF 치수 확인'},turntable_furnace:{size:'치수 검토 필요',status:'DWG 연결'},vacuum_unit:{size:'치수 검토 필요',status:'DWG 연결'}};
const formatSize=n=>n>1e9?`${(n/1e9).toFixed(1)} GB`:n>1e6?`${(n/1e6).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1e3))} KB`;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function mountCatalog(){
  const host=document.querySelector('.assets');
  if(!host||host.querySelector('.catalog')||host.dataset.catalogMounting)return;
  host.dataset.catalogMounting='true';
  const response=await fetch('/projects/P006/assets/entry-catalog/entries.json?version=724',{cache:'no-store'});
  if(!response.ok)throw new Error(`카탈로그 HTTP ${response.status}`);
  const canonical=await response.json();
  const manifest={assets:(Array.isArray(canonical)?canonical:canonical.entries||[]).map(a=>({...a,category:'equipment-module',extension:'USD',relativePath:a.entryFile||a.id+'.usda',preview:a.image,download:a.entryPath,assetCode:a.id,placeable:true,compositionStatus:'PLACEABLE',comment:a.imageStatus||'USD_CONNECTED'})),registeredAssetCount:(Array.isArray(canonical)?canonical:canonical.entries||[]).length,sourceFileCount:(Array.isArray(canonical)?canonical:canonical.entries||[]).length,categoryCount:new Set((Array.isArray(canonical)?canonical:canonical.entries||[]).map(a=>a.category)).size};
  const [meshMap,reviewQueue]=await Promise.all([
    fetch('/projects/P006/catalog-mappings',{credentials:'include',cache:'no-store'}).then(r=>r.ok?r.json():fetch(`${base}mesh-map.json`,{cache:'no-store'}).then(x=>x.json())).catch(()=>({mappings:[]})),
    fetch(`${base}equipment-review-queue.json`,{cache:'no-store'}).then(r=>r.ok?r.json():({count:0,items:[]})).catch(()=>({count:0,items:[]}))
  ]);
  const meshByPlacement=new Map(meshMap.mappings.map(row=>[row.placementCode,row]));
  manifest.assets.forEach(a=>{a.referenceAssetCode=inferAssetCode(a);a.placementCode=`catalog_${a.id.toLowerCase()}`;a.placeable=physicalCategories.has(a.category);a.mesh3d=meshByPlacement.get(a.placementCode)});
  catalogByPlacement=new Map(manifest.assets.filter(a=>a.placeable).map(a=>[a.placementCode,a]));
  let selectedEquipment='',viewMode='placeable';
  const section=document.createElement('section');
  section.className='catalog';
  section.innerHTML=`<details open><summary><strong>전체 자산 카탈로그</strong><span>${manifest.registeredAssetCount}개</span></summary>
    <p class="catalog-summary">원본 ${manifest.sourceFileCount}개 · 등록 ${manifest.registeredAssetCount}개 · 분류 ${manifest.categoryCount}개</p>
    <h3 class="equipment-group-title">대표 설비 그룹 16종</h3><div class="equipment-groups">${coreEquipment.map(([code,name])=>{const refs=manifest.assets.filter(a=>a.referenceAssetCode===code);const d=dimensions[code];return `<button type="button" data-equipment="${code}"><strong>${name}</strong><span>연결 자료 ${refs.length}개</span><small>${d?`${d.status} · ${d.size}`:'기준 치수 미등록'}</small></button>`}).join('')}</div>
    <nav class="catalog-tabs" aria-label="자산 보기"><button type="button" class="active" data-view="placeable">배치 자산 <b>${manifest.assets.filter(a=>a.placeable).length}</b></button><button type="button" data-view="reference">참고자료 <b>${manifest.assets.filter(a=>!a.placeable).length}</b></button><button type="button" data-view="all">전체 <b>${manifest.assets.length}</b></button><button type="button" data-view="review">검토 필요 <b>${reviewQueue.count||0}</b></button></nav>
    <div class="catalog-tools"><label>자산 검색<input class="catalog-search" type="search" placeholder="설비·도면 이름 검색"></label>
    <label>분류<select class="catalog-filter"><option value="">전체 분류</option>${manifest.categories.map(c=>`<option value="${c.name}">${labels[c.name]||c.name} (${c.count})</option>`).join('')}</select></label></div>
    <p class="catalog-result" aria-live="polite"></p><div class="catalog-grid"></div></details>`;
  host.append(section);
  host.dataset.catalogMounting='done';
  const grid=section.querySelector('.catalog-grid'),search=section.querySelector('.catalog-search'),filter=section.querySelector('.catalog-filter'),result=section.querySelector('.catalog-result');
  const render=()=>{
    const q=search.value.trim().toLocaleLowerCase('ko');
    const reviewIds=new Set((reviewQueue.items||[]).map(x=>x.assetId));
    const rows=manifest.assets.filter(a=>(viewMode==='all'||viewMode==='placeable'&&a.placeable||viewMode==='reference'&&!a.placeable||viewMode==='review'&&reviewIds.has(a.id))&&(!selectedEquipment||a.referenceAssetCode===selectedEquipment)&&(!filter.value||a.category===filter.value)&&(!q||`${a.name} ${a.relativePath} ${labels[a.category]}`.toLocaleLowerCase('ko').includes(q)));
    result.textContent=`${viewMode==='placeable'?'드래그 가능한 실제 배치 자산':viewMode==='reference'?'도면·매뉴얼 참고자료':viewMode==='review'?'관리자 분류 검토 대상':'전체 등록 자산'} ${rows.length}개 · 조립 배치 가능 ${rows.filter(a=>a.placeable).length}개`;
    grid.innerHTML=rows.map(a=>`<article class="catalog-card ${a.placeable?'is-placeable':''}" ${a.placeable?'draggable="true"':''} data-asset="${escapeHtml(a.placementCode)}">
      <img loading="lazy" src="${base}${encodeURI(a.preview)}" alt="${escapeHtml(a.name)} 미리보기">
      <div><strong title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</strong><span>${labels[a.category]||a.category}${a.mesh3d?` · 3D ${escapeHtml(a.mesh3d.bundleCode)}`:''}</span><small>${a.extension} · ${formatSize(a.size)} · ${a.mesh3d?`실제 Unity Mesh · 신뢰도 ${Math.round(a.mesh3d.confidence*100)}%`:a.placeable?'조립 배치 가능':'참고 자산'}</small>
      ${a.download?`<nav class="catalog-actions" aria-label="${escapeHtml(a.name)} 파일 작업"><a href="${base}${a.download}" target="_blank" rel="noopener">열기</a><a href="${base}${a.download}" download="${escapeHtml(a.name)}.${a.extension.toLowerCase()}">다운로드</a></nav>`:''}</div></article>`).join('');
    grid.querySelectorAll('[draggable=true]').forEach(card=>card.addEventListener('dragstart',e=>e.dataTransfer.setData('application/json',JSON.stringify({assetCode:card.dataset.asset}))));
  };
  section.querySelectorAll('[data-equipment]').forEach(button=>button.addEventListener('click',()=>{selectedEquipment=selectedEquipment===button.dataset.equipment?'':button.dataset.equipment;section.querySelectorAll('[data-equipment]').forEach(x=>x.classList.toggle('active',x.dataset.equipment===selectedEquipment));render()}));
  section.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{viewMode=button.dataset.view;selectedEquipment='';section.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===button));section.querySelectorAll('[data-equipment]').forEach(x=>x.classList.remove('active'));render()}));
  search.addEventListener('input',render);filter.addEventListener('change',render);render();
}

function decorateCatalogObjects(){
  document.querySelectorAll('.workspace .object[data-asset^="catalog_"]').forEach(object=>{
    const asset=catalogByPlacement.get(object.dataset.asset);if(!asset||object.dataset.catalogDecorated)return;
    object.dataset.catalogDecorated='true';object.classList.add('catalog-object');
    const image=document.createElement('img');image.src=`${base}${encodeURI(asset.preview)}`;image.alt='';
    object.prepend(image);const label=object.querySelector('span');if(label)label.textContent=asset.name;
  });
}

const observer=new MutationObserver(()=>{decorateCatalogObjects();mountCatalog().catch(error=>{
  const host=document.querySelector('.assets');
  if(host&&!host.querySelector('.catalog-error'))host.insertAdjacentHTML('beforeend',`<p class="catalog-error">전체 자산을 불러오지 못했습니다: ${escapeHtml(error.message)}</p>`);
})});
observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
mountCatalog();
