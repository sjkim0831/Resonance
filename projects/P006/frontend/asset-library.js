const P006_LIBRARY_BASE='/projects/P006/assets/catalog/';
const P006_PLACEABLE=new Set(['equipment-module','part-jig']);
const p006Escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

async function mountP006AssetLibrary(){
  const host=document.querySelector('.assets');
  if(!host||host.querySelector('.p006-asset-library')||host.dataset.assetLibraryMounting)return;
  host.dataset.assetLibraryMounting='true';
  const readJson=async url=>{const response=await fetch(url,{cache:'no-store'}),type=response.headers.get('content-type')||'';if(!response.ok)throw new Error(`자산 응답 오류 HTTP ${response.status}`);if(!type.includes('json')&&!type.includes('octet-stream'))throw new Error(`자산 JSON 대신 ${type||'알 수 없는 응답'} 수신`);return response.json()};
  const [manifest,classification]=await Promise.all([
    readJson(`${P006_LIBRARY_BASE}manifest.json`),
    fetch(`${P006_LIBRARY_BASE}equipment-classification.json`,{cache:'no-store'}).then(r=>r.ok?r.json():({classifications:[]})).catch(()=>({classifications:[]}))
  ]);
  const classified=new Map((classification.classifications||[]).map(row=>[row.assetId,row]));
  const rows=manifest.assets.map(asset=>({...asset,placementCode:`catalog_${asset.id.toLowerCase()}`,equipmentCode:classified.get(asset.id)?.equipmentCode||asset.assetCode||'',placeable:['PLACEABLE','PROMOTED_MODULE'].includes(asset.compositionStatus)}));
  const counts={placeable:rows.filter(x=>x.placeable).length,promoted:rows.filter(x=>x.compositionStatus==='PROMOTED_MODULE').length,review:rows.filter(x=>x.compositionStatus==='REVIEW_FOR_COMPOSITION').length,package:rows.filter(x=>x.compositionStatus==='PACKAGE_COMPONENT').length,reference:rows.filter(x=>x.compositionStatus==='REFERENCE_ONLY').length};
  const section=document.createElement('section');section.className='p006-asset-library card';
  section.innerHTML=`<header><div><small>ASSET LIBRARY · DRAG & DROP</small><h2>전체 설비 자산</h2><p>대표 설비 16종 아래의 실제 이미지·부품 모델을 작업공간으로 끌어 놓으세요.</p></div><strong>${rows.length}개</strong></header>
    <p class="p006-dimension-audit">실측 치수 승인 ${manifest.dimensionAudit?.approvedCount||0}개 · 보정 대기 ${manifest.dimensionAudit?.pendingCount||counts.placeable}개</p>
    <nav class="p006-library-tabs" aria-label="자산 구분"><button class="active" data-mode="placeable">조합 가능 ${counts.placeable}개</button><button data-mode="promoted">자동 승격 ${counts.promoted}개</button><button data-mode="review">관리자 검토 ${counts.review}개</button><button data-mode="package">Unity 구성 ${counts.package}개</button><button data-mode="reference">참고 전용 ${counts.reference}개</button><button data-mode="all">전체 ${rows.length}개</button></nav>
    <div class="p006-library-tools"><label>자산 검색<input type="search" placeholder="설비·부품·도면 이름 검색"></label><label>설비 그룹<select><option value="">전체 16종</option></select></label></div>
    <p class="p006-library-result" aria-live="polite"></p><div class="p006-library-grid"></div><button type="button" class="p006-library-more" hidden>자산 더 보기</button>`;
  host.querySelector('.catalog')?.before(section)||host.append(section);host.dataset.assetLibraryMounting='done';
  const grid=section.querySelector('.p006-library-grid'),result=section.querySelector('.p006-library-result'),search=section.querySelector('input'),select=section.querySelector('select');
  const master=await fetch('/projects/P006/assets/equipment-master.json',{cache:'no-store'}).then(r=>r.json()).catch(()=>({equipment:[]}));
  select.insertAdjacentHTML('beforeend',(master.equipment||[]).map(e=>`<option value="${p006Escape(e.code)}">${p006Escape(e.name)}</option>`).join(''));
  let mode='placeable',limit=60;
  const render=()=>{
    const query=search.value.trim().toLocaleLowerCase('ko');
    const modeStatus={promoted:'PROMOTED_MODULE',review:'REVIEW_FOR_COMPOSITION',package:'PACKAGE_COMPONENT',reference:'REFERENCE_ONLY'}[mode],filtered=rows.filter(row=>(mode==='all'||(mode==='placeable'?row.placeable:row.compositionStatus===modeStatus))&&(!select.value||row.equipmentCode===select.value)&&(!query||`${row.name} ${row.relativePath} ${row.comment}`.toLocaleLowerCase('ko').includes(query)));
    const visible=filtered.slice(0,limit),more=section.querySelector('.p006-library-more');result.textContent=`검색 ${filtered.length}개 · 현재 ${visible.length}개 표시 · 드래그 가능 ${filtered.filter(x=>x.placeable).length}개`;
    grid.innerHTML=visible.map(row=>`<article class="p006-library-card ${row.placeable?'is-placeable':'is-reference'}" ${row.placeable?'draggable="true"':''} data-asset="${row.placementCode}" data-composition="${row.compositionStatus}"><img loading="eager" decoding="async" src="${P006_LIBRARY_BASE}thumbnails/${encodeURIComponent(row.id)}.jpg" onerror="this.onerror=null;this.src='${P006_LIBRARY_BASE}${encodeURI(row.preview)}'" alt="${p006Escape(row.name)}"><div><strong>${p006Escape(row.name)}</strong><span>${p006Escape(row.category)}</span><small>${row.compositionStatus==='PROMOTED_MODULE'?`자동 승격 · ${Math.round((row.compositionConfidence||0)*100)}% · ${row.partRole==='ASSEMBLY'?'조립체':'구성 부품'} · ${row.dimensionEvidence==='LINKED_DRAWING'?'도면 치수 연결':'스케일 보정 필요'}`:row.placeable?'작업공간 즉시 조합 · 치수 근거 미분류':row.compositionStatus==='REVIEW_FOR_COMPOSITION'?'관리자 확인 후 조합':row.compositionStatus==='PACKAGE_COMPONENT'?'Unity 실행 패키지 구성요소':'도면·문서 참고 전용'}</small></div></article>`).join('');
    more.hidden=visible.length>=filtered.length;more.textContent=`자산 더 보기 (${visible.length}/${filtered.length})`;
    grid.querySelectorAll('[draggable=true]').forEach(card=>card.addEventListener('dragstart',event=>{event.dataTransfer.effectAllowed='copyMove';event.dataTransfer.setData('application/json',JSON.stringify({assetCode:card.dataset.asset}))}));
  };
  section.querySelector('.p006-library-more').onclick=()=>{limit+=60;render()};
  section.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;limit=60;section.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===button));render()});
  search.oninput=()=>{limit=60;render()};select.onchange=()=>{limit=60;render()};render();
  const legacy=host.querySelector('.catalog details');if(legacy){legacy.open=false;legacy.querySelector('summary strong').textContent='자료 상세·다운로드 및 기존 분류 보기'}
}
const reportAssetLibraryError=error=>{const host=document.querySelector('.assets');if(host){host.dataset.assetLibraryMounting='error';host.insertAdjacentHTML('afterbegin',`<p class="notice danger p006-library-error">자산 불러오기 실패: ${p006Escape(error.message)} · 새로고침 후 다시 시도하세요.</p>`)}console.error(error)};
new MutationObserver(()=>mountP006AssetLibrary().catch(reportAssetLibraryError)).observe(document.querySelector('#app'),{childList:true,subtree:true});
mountP006AssetLibrary().catch(reportAssetLibraryError);
