(() => {
  'use strict';
  const Core = window.P006NetworkCore;
  const API = '/projects/P006/registry-api/composer';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let layouts = [], productCatalog = [], designDoc = null, runtimeDoc = null, design = null, runtime = null;
  let selectedCandidate = Core.PRODUCT_CANDIDATES[0].id, selectedFactoryId = null;
  let referenceVersions = {}, equipmentGapReport = null, mode = 'select', dragging = null, undo = [], redo = [], timer = null, runtimeBusy = false;
  let dirty = false;
  const clone = value => JSON.parse(JSON.stringify(value));
  function message(value, error = false) { $('#notice').textContent = value; $('#notice').classList.toggle('error', error); }
  async function api(path, payload) {
    const response = await fetch(API + path, { credentials: 'same-origin', method: payload === undefined ? 'GET' : 'POST', headers: payload === undefined ? {} : { 'Content-Type': 'application/json', 'X-P006-Requested-With': 'equipment-registry' }, body: payload === undefined ? undefined : JSON.stringify(payload), cache: 'no-store' });
    let data;
    try { data = await response.json(); } catch { throw Error(`API HTTP ${response.status} · JSON 응답 없음`); }
    if (!response.ok) throw Error(data.error || `API HTTP ${response.status}`);
    return data;
  }
  async function assetById(id){
    const response=await fetch('/projects/P006/registry-api/assets?q='+encodeURIComponent(id)+'&limit=100',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw Error(`자산 원장 HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data.items))throw Error('자산 원장 응답 구조 오류');
    return data.items.find(x=>x.id===id)||null;
  }
  function guard(action) { Promise.resolve().then(action).catch(error => message(error.message || String(error), true)); }
  function setDirty() { dirty = true; $('#saveState').textContent = `미저장 · DB v${designDoc?.version || 0}`; }
  function checkpoint(previous) { undo.push(clone(previous)); if (undo.length > 50) undo.shift(); redo = []; }
  function selectedFactory() { return design?.factories.find(f => f.factoryInstanceId === selectedFactoryId); }
  function candidates() { return [...Core.PRODUCT_CANDIDATES, ...productCatalog.map(p => ({ id:p.id, name:p.name, status:p.evidenceStatus, assets:[], bom:p.bom, missing:['제품·공정·애니메이션 검증 대기'], demoScope:p.processDescription || '제품 설계 등록됨' }))]; }
  function setCandidate(id) { selectedCandidate = id; renderCandidates(); $('#createPilot').disabled = id !== Core.PRODUCT; }
  function renderCandidates() {
    $('#productCandidates').innerHTML = candidates().map(c => `<article class="candidate ${selectedCandidate === c.id ? 'selected' : ''}" data-candidate="${esc(c.id)}" tabindex="0"><b>${esc(c.name)}</b><small>${c.assets.length?`설비 후보: ${esc(c.assets.join(', '))}`:'등록 제품 · 설비 미매핑'}</small><small>시연: ${esc(c.demoScope)}</small><small>부족: ${esc(c.missing.join(' · '))}</small><span class="tag">${esc(c.status)}</span></article>`).join('');
  }
  async function refreshProducts() { const result=await api('/products'); productCatalog=result.items || []; renderCandidates(); window.P006ProductionWorkflow?.render(); }
  async function saveProduct(draft) {
    const existing=productCatalog.find(p=>p.id===draft.productId);
    const doc={id:existing?.id || Core.uuid(),version:existing?.version || 0,name:draft.productName,bom:draft.bom,sourceReference:draft.productSource || '',processDescription:draft.sequence || ''};
    const saved=await api('/products',doc);
    await refreshProducts();setCandidate(saved.id);
    return saved;
  }
  async function addFactory(layoutId, taskName, workflow) {
    const layout=layouts.find(x=>x.id===layoutId && x.count>0);
    if(!layout) throw Error('설비가 있는 저장 공장을 선택하세요.');
    if(!design) {
      design={schema:Core.SCHEMA,evidenceStatus:'EVIDENCE_CANDIDATE',factories:[],routes:[],product:{productId:workflow.productId,name:workflow.productName,bom:clone(workflow.bom),evidenceStatus:'DESIGN_CANDIDATE',actualProductModel:null,mechanicalAnimationVerified:false,workflow:clone(workflow)},camera:{x:0,y:0,zoom:1},stageRefs:{},layoutStatus:'DRAFT'};
      designDoc=Core.layoutDocument('생산망 · '+($('#networkName').value.trim()||'새 생산망'),{networkDesign:design});
    } else checkpoint(design);
    const id=Core.uuid(), maxX=design.factories.length?Math.max(...design.factories.map(f=>f.mapPosition[0])):0;
    const factory={factoryInstanceId:id,layoutId:layout.id,layoutVersion:layout.version,name:`공장 ${design.factories.length+1} · ${layout.name}`,mapPosition:[maxX+(design.factories.length?7:0),0,0],locked:false,status:'DESIGN_CANDIDATE'};
    design.factories.push(factory);
    design.product.workflow=clone(workflow);
    design.product.productId=workflow.productId;design.product.name=workflow.productName;design.product.bom=clone(workflow.bom);
    if(workflow.productId!==Core.PRODUCT)design.product.evidenceStatus='DESIGN_CANDIDATE';
    design.product.workflow.factorySteps=[...(workflow.factorySteps||[]),{factoryInstanceId:id,taskName:taskName.trim(),order:design.factories.length}];
    selectedFactoryId=id;setDirty();await inspectReferences();render();
    message(`${factory.name} 추가 · 공정 연결·애니메이션 미검증 · DB 저장 필요`);
    return factory;
  }
  async function refreshLayouts() {
    const response = await api('/layouts'); layouts = response.items || [];
    const factoryOptions = '<option value="">저장된 공장 선택</option>' + layouts.filter(x => x.count > 0).map(x => `<option value="${esc(x.id)}">${esc(x.name)} · ${x.count}개 · v${x.version}</option>`).join('');
    for (const id of ['factoryA', 'factoryB', 'factoryC']) { const prior = $('#' + id).value; $('#' + id).innerHTML = factoryOptions; if (prior) $('#' + id).value = prior; }
    if (design?.factories.length===3) ['factoryA','factoryB','factoryC'].forEach((id,index)=>{ $('#'+id).value=design.factories[index].layoutId; });
    $('#savedNetworks').innerHTML = '<option value="">저장된 생산망</option>' + layouts.filter(x => x.name.startsWith('생산망 · ')).map(x => `<option value="${esc(x.id)}">${esc(x.name)} · v${x.version}</option>`).join('');
  }
  function selectPilotFactories() {
    const ids = ['factoryA', 'factoryB', 'factoryC'].map(id => $('#' + id).value);
    if (ids.some(id => !id) || new Set(ids).size !== 3) throw Error('서로 다른 저장 공장 3개를 선택하세요.');
    const refs = ids.map(id => layouts.find(x => x.id === id));
    design = Core.makeDesign(refs); designDoc = Core.layoutDocument('생산망 · ' + $('#networkName').value.trim(), { networkDesign: design });
    runtimeDoc = null; runtime = null; selectedFactoryId = design.factories[2].factoryInstanceId; undo = []; redo = []; setDirty(); render(); message('3개 공장 기능 시연 구성 완료 · 공장과 작업물 근거는 화면에서 검토하세요.');
  }
  async function saveDesign() {
    if (!design) throw Error('먼저 공장 3개를 선택해 생산망을 구성하세요.');
    design.camera = currentCamera(); design.selectedFactoryId = selectedFactoryId;
    designDoc.name = '생산망 · ' + ($('#networkName').value.trim() || '이름 없는 생산망');
    designDoc.settings.networkDesign = clone(design);
    const saved = await api('/layouts', designDoc); designDoc = saved; design = clone(saved.settings.networkDesign); dirty = false;
    $('#saveState').textContent = `DB v${saved.version} · 저장 완료`;
    history.replaceState(null, '', '?network=' + saved.id);
    await refreshLayouts(); $('#savedNetworks').value = saved.id; $('#exportStage').disabled = false;
    await inspectReferences(); render(); message(`생산망 DB 저장 완료 · 공장 ${design.factories.length}개 · 관계 ${design.routes.length}개 · ${design.evidenceStatus}`);
  }
  async function loadNetwork(id) {
    const loaded = await api('/layouts/' + id);
    if (loaded.settings?.networkDesign?.schema !== Core.SCHEMA) throw Error('생산망 설계 문서가 아닙니다.');
    designDoc = loaded; design = clone(loaded.settings.networkDesign); runtimeDoc = null; runtime = null; undo = []; redo = []; dirty = false;
    if (design.factories.length===3) ['factoryA','factoryB','factoryC'].forEach((field,index)=>{ $('#'+field).value=design.factories[index].layoutId; });
    if (design.product?.workflow?.productId) setCandidate(design.product.workflow.productId);
    selectedFactoryId = design.selectedFactoryId || design.factories[0]?.factoryInstanceId || null;
    $('#networkName').value = loaded.name.replace(/^생산망 · /, ''); $('#saveState').textContent = `DB v${loaded.version} · 복원 완료`;
    history.replaceState(null, '', '?network=' + loaded.id);
    const run = layouts.find(x => x.name.startsWith('실행 · ' + id + ' ·'));
    if (run) { const doc = await api('/layouts/' + run.id); if (doc.settings?.networkRuntime?.networkId === id) { runtimeDoc = doc; runtime = clone(doc.settings.networkRuntime); } }
    await inspectReferences(); render(); message(`생산망 DB 복원 완료 · 공장 ${design.factories.length}개 · 실행 기록 ${runtime?.events.length || 0}건`);
  }
  async function inspectReferences() {
    referenceVersions = {};
    if (!design) return;
    const results = await Promise.all(design.factories.map(async f => { try { const doc = await api('/layouts/' + f.layoutId); const instances=doc.instances.filter(x=>!x.templateId&&x.assetId&&x.id).map(x=>({instanceId:x.id,assetId:x.assetId,label:x.label||x.equipmentName||x.displayName||x.name||x.assetId})); return [f.factoryInstanceId, { exists: true, currentVersion: doc.version, instanceCount: doc.instances.length, assetIds: instances.map(x=>x.assetId), instances, processGroups: doc.settings?.processGroups?.length || 0 }]; } catch { return [f.factoryInstanceId, { exists: false }]; } }));
    referenceVersions = Object.fromEntries(results);
    $('#qaStatus').textContent = `QA: 공장 참조 ${results.filter(x => x[1].exists).length}/${results.length} · 버전 갱신 필요 ${design.factories.filter(f => referenceVersions[f.factoryInstanceId]?.currentVersion !== f.layoutVersion).length}개`;
    await refreshEquipmentGaps();
  }
  async function refreshEquipmentGaps(workflowOverride){
    if(!design){equipmentGapReport=null;return null;}
    const workflow=workflowOverride||design.product?.workflow||{productId:design.product?.productId,bom:design.product?.bom,factorySteps:[]};
    const groups=window.P006EquipmentGap.requirements(design,workflow);
    const ids=[...new Set(groups.flatMap(x=>x.requiredAssetIds))];
    try{
      const found=await Promise.all(ids.map(assetById));
      equipmentGapReport=window.P006EquipmentGap.evaluate(design,workflow,referenceVersions,found.filter(Boolean));
      equipmentGapReport.lookupStatus='PASS';
    }catch(error){equipmentGapReport={items:[],missing:0,blocked:0,unresolved:0,lookupStatus:'ERROR',error:error.message};}
    window.P006ProductionWorkflow?.render();
    return equipmentGapReport;
  }
  async function exportStages() {
    if (!designDoc?.version || dirty) throw Error('먼저 현재 생산망 설계를 DB에 저장하세요.');
    await inspectReferences();
    if (design.factories.some(f => !referenceVersions[f.factoryInstanceId]?.exists || referenceVersions[f.factoryInstanceId].currentVersion !== f.layoutVersion)) throw Error('참조 공장 버전이 변경되었거나 누락되었습니다. 공장 설계를 확인하세요.');
    const refs = { ...(design.stageRefs || {}) };
    for (const f of design.factories) {
      if (refs[f.factoryInstanceId]) continue;
      message(`${f.name} · 독립 USD Stage 생성 중`);
      const job = await api('/stages', { layoutId: f.layoutId, version: f.layoutVersion });
      let result;
      for (let attempt = 0; attempt < 110; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1800));
        result = await api('/stages/' + job.id);
        if (result.state === 'FINISHED' || result.state === 'FAILED') break;
      }
      if (result?.state !== 'FINISHED') throw Error(`${f.name} USD Stage 실패: ${result?.error || '시간 초과'}`);
      refs[f.factoryInstanceId] = job.id;
    }
    design.stageRefs = refs;
    await saveDesign();
    const networkStage = await api('/network-usd', { networkId: designDoc.id });
    $('#stageResult').innerHTML = `<a href="${esc(networkStage.usdUrl)}">ProductionNetwork.usda 다운로드</a><p>공장 Reference ${networkStage.factoryCount}개 · 생산 실행과 기계 애니메이션 검증은 별도</p>`;
    message(`생산망 USD 생성 완료 · 공장 Reference ${networkStage.factoryCount}개`);
  }
  function currentCamera() { return design?.camera ? clone(design.camera) : { x: 0, y: 0, zoom: 1 }; }
  function selectFactory(id) { selectedFactoryId = id; if (design) design.selectedFactoryId = id; render(); }
  function stageLabel(f, index) { const task=design?.product?.workflow?.factorySteps?.find(x=>x.factoryInstanceId===f.factoryInstanceId)?.taskName; return `${f.name} · ${task || (index === 0 ? '부품 A 처리 후보' : index === 1 ? '부품 B 처리 후보' : index === 2 ? '입고·조립·검사 후보' : '공정 설계 후보')}`; }
  function renderMap() {
    if (!design) { $('#factoryLayer').replaceChildren(); $('#routeLayer').replaceChildren(); $('#miniMap').replaceChildren(); return; }
    const camera = design.camera || { x: 0, y: 0, zoom: 1 };
    $('#mapWorld').style.transform = `translate(-50%, -50%) translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    $('#zoom').value = String(camera.zoom);
    const cx = f => 1100 + f.mapPosition[0] * 65, cy = f => 700 + f.mapPosition[2] * 65;
    $('#factoryLayer').innerHTML = design.factories.map((f, index) => { const version = referenceVersions[f.factoryInstanceId], state = runtime?.factoryStates?.[['A', 'B', 'C'][index]] || 'IDLE'; return `<article class="factory ${f.factoryInstanceId === selectedFactoryId ? 'selected' : ''} ${f.locked ? 'locked' : ''}" data-factory-id="${esc(f.factoryInstanceId)}" style="left:${cx(f) - 95}px;top:${cy(f) - 48}px"><b>${esc(f.name)}</b><small>${esc(stageLabel(f, index).split(' · ')[1])}</small><small>Layout v${f.layoutVersion} · ${version?.exists ? version.currentVersion === f.layoutVersion ? '참조 일치' : '갱신 필요' : '참조 누락'}</small><span class="state">${esc(state)}</span></article>`; }).join('');
    const byId = new Map(design.factories.map(f => [f.factoryInstanceId, f]));
    const routes = design.routes.map(r => { const a = byId.get(r.fromFactoryInstanceId), b = byId.get(r.toFactoryInstanceId); if (!a || !b) return ''; const x1 = cx(a) + 95, y1 = cy(a), x2 = cx(b) - 95, y2 = cy(b); const midX = (x1 + x2) / 2; const moving = runtime && ((r.partId === Core.PART_A && runtime.step === 3) || (r.partId === Core.PART_B && runtime.step === 5)); return `<path class="route-path" d="M ${x1} ${y1} L ${x2} ${y2}"/><path class="route-arrow" d="M ${x2} ${y2} l -12 -6 l 0 12 z"/><text class="route-label" x="${midX}" y="${(y1 + y2) / 2 - 12}">${esc(r.partId)} · 이송 후보</text>${moving ? `<circle class="part-marker" cx="${midX}" cy="${(y1 + y2) / 2}" r="11"/><text class="part-label" x="${midX + 14}" y="${(y1 + y2) / 2 + 4}">운송 중</text>` : ''}`; }).join('');
    const site=design.product?.workflow;
    const siteOutline=site?.siteName && Number.isFinite(site.siteWidth) && Number.isFinite(site.siteLength) ? `<rect x="${1100-site.siteWidth*32.5}" y="${700-site.siteLength*32.5}" width="${site.siteWidth*65}" height="${site.siteLength*65}" fill="#42a98b12" stroke="#26866d" stroke-width="3" stroke-dasharray="10 6"/><text x="${1100-site.siteWidth*32.5+12}" y="${700-site.siteLength*32.5+22}" fill="#12664f" font-size="15">${esc(site.siteName)} · 계획 영역 ${site.siteWidth}×${site.siteLength}m</text>` : '';
    $('#routeLayer').setAttribute('viewBox', '0 0 2200 1400'); $('#routeLayer').innerHTML = siteOutline+routes;
    $('#miniMap').innerHTML = `<svg viewBox="0 0 2200 1400" aria-hidden="true">${design.routes.map(r => { const a = byId.get(r.fromFactoryInstanceId), b = byId.get(r.toFactoryInstanceId); return a && b ? `<line x1="${cx(a)}" y1="${cy(a)}" x2="${cx(b)}" y2="${cy(b)}" stroke="#1689ad" stroke-width="20"/>` : ''; }).join('')}${design.factories.map(f => `<rect x="${cx(f) - 65}" y="${cy(f) - 45}" width="130" height="90" rx="15" fill="${f.factoryInstanceId === selectedFactoryId ? '#ed9216' : '#2d758b'}"/>`).join('')}</svg>`;
  }
  function render() {
    renderMap();
    window.P006ProductionWorkflow?.render();
    $('#factoryList').innerHTML = design ? design.factories.filter(f => !$('#factorySearch').value || (f.name + f.layoutId).toLowerCase().includes($('#factorySearch').value.toLowerCase())).map(f => `<button class="factory-list-button" data-select-factory="${esc(f.factoryInstanceId)}">${esc(f.name)} · v${f.layoutVersion}${referenceVersions[f.factoryInstanceId]?.currentVersion !== f.layoutVersion ? ' · 갱신 필요' : ''}</button>`).join('') : '<p class="hint">저장된 공장 3개를 선택하세요.</p>';
    const f = selectedFactory(), v = f && referenceVersions[f.factoryInstanceId];
    $('#factoryDetails').innerHTML = f ? `<p><b>${esc(f.name)}</b> · ${esc(f.status)}</p><p>Layout ID: <code>${esc(f.layoutId)}</code><br>참조 버전: v${f.layoutVersion}<br>현재 버전: ${v?.currentVersion ?? '조회 불가'}<br>Instance: ${v?.instanceCount ?? '?'}</p><p>지도 위치: X ${f.mapPosition[0].toFixed(2)} / Z ${f.mapPosition[2].toFixed(2)} m</p><button id="openFactory" type="button">공장 내부 보기</button><button id="openCell" type="button">공정 셀 3D 보기</button><button id="toggleLock" type="button">${f.locked ? '위치 고정 해제' : '위치 고정'}</button>` : '공장을 선택하세요.';
    $('#routeDetails').innerHTML = design ? `<div class="summary"><span>공장 <b>${design.factories.length}</b></span><span>공장 간 경로 <b>${design.routes.length}</b></span><span>완제품 <b>${runtime?.finishedCount || 0}</b></span><span>근거 <b>${esc(design.evidenceStatus)}</b></span></div><p>경로는 작업물 전달 설계 후보입니다. 설비 간 직접 연결과 기계 애니메이션은 미검증입니다.</p><p class="warn">BOM: ${esc(design.product.bom.map(x => `${x.partId} ${x.quantity}개`).join(' + '))}</p><p>공장 C 입고 재고: A ${runtime?.inventory?.C?.[Core.PART_A] || 0}개 / B ${runtime?.inventory?.C?.[Core.PART_B] || 0}개</p><p>작업물 Lot: ${Object.keys(runtime?.workpieces || {}).length}개 · 실제 제품 모델 미확인</p>` : '<p>생산망을 구성하세요.</p>';
    $('#breadcrumbCurrent').textContent = f ? `› ${f.name} › 공정 셀` : '';
    $('#eventLog').innerHTML = runtime?.events.length ? runtime.events.map((e, index) => `<li>${index + 1}. ${esc(e.type)} · 입력 ${esc(JSON.stringify(e.input))} → 출력 ${esc(JSON.stringify(e.output))} · ${esc(e.evidenceStatus)}</li>`).join('') : '<li>실행 기록 없음</li>';
    $('#runState').textContent = runtime ? `${runtime.state} · ${runtime.step}/${Core.EVENT_TYPES.length}단계 · 완제품 ${runtime.finishedCount}` : '설계 DB 저장 후 실행 가능';
    const runBlocker=simulationEligibility();
    for (const id of ['runStart','runStep','runResume']) $('#'+id).disabled=!!runBlocker;
    $('#runGate').textContent=runBlocker || '현재 2부품 기능 시연 조건 확인됨';
    $('#exportStage').disabled = !designDoc?.version;
  }
  function openFactory(view3d = false) { const f = selectedFactory(); if (!f) return; if (design) localStorage.setItem('p006NetworkCamera:' + (designDoc?.id || 'draft'), JSON.stringify(design.camera)); location.href = 'composer.html?layout=' + encodeURIComponent(f.layoutId) + (view3d ? '&view=3d' : '') + (designDoc?.id ? '&returnNetwork=' + encodeURIComponent(designDoc.id) : ''); }
  function openProcessPreview(workflow) {
    const sequence=workflow?.processSequence||[];
    if(sequence.length<2)throw Error('같은 공장 안의 설비를 2개 이상 공정 순서에 추가하세요.');
    const factoryId=sequence[0].factoryInstanceId;
    if(sequence.some(x=>x.factoryInstanceId!==factoryId))throw Error('공장 간 운송은 아직 공정 셀 미리보기에서 지원하지 않습니다. 한 공장 공정만 선택하세요.');
    const factory=design?.factories?.find(x=>x.factoryInstanceId===factoryId),ref=referenceVersions[factoryId];
    if(!factory||!ref?.exists)throw Error('저장된 공장 참조를 읽지 못했습니다. 공장을 다시 선택하거나 참조 상태를 새로고침하세요.');
    if(ref.currentVersion!==factory.layoutVersion)throw Error(`저장 공장 버전 불일치: 생산망 v${factory.layoutVersion}, 현재 v${ref.currentVersion}. 먼저 공장 참조를 갱신하세요.`);
    const allowed=new Set(['E001','E034','E053']),unknown=sequence.filter(x=>!allowed.has(x.assetId));
    if(unknown.length)throw Error(`3D 시연 Anchor 미등록 자산: ${[...new Set(unknown.map(x=>x.assetId))].join(', ')}. 임의 경로나 높이를 만들지 않았습니다.`);
    for(const x of sequence){const actual=ref.instances.find(y=>y.instanceId===x.instanceId);if(!actual||actual.assetId!==x.assetId)throw Error(`공정 순서의 설비 ${x.label}이 현재 저장 공장에 없습니다. 순서를 다시 선택하세요.`);}
    const token=Core.uuid(),payload={schema:'P006_PROCESS_CELL_PREVIEW_V1',mode:'FUNCTIONAL_DEMO',networkId:designDoc?.id||null,layoutId:factory.layoutId,layoutVersion:factory.layoutVersion,factoryInstanceId:factoryId,factoryName:factory.name,productName:workflow.productName,sequence:sequence.map((x,index)=>({order:index+1,instanceId:x.instanceId,assetId:x.assetId,label:x.label,role:x.role})),connectionStatus:'UNVERIFIED',machineAnimationStatus:'UNVERIFIED',workpieceModelStatus:'DEMO_PROXY',createdAt:new Date().toISOString()};
    localStorage.setItem('p006ProcessCellPreview:'+token,JSON.stringify(payload));
    if(design)localStorage.setItem('p006NetworkCamera:'+(designDoc?.id||'draft'),JSON.stringify(design.camera));
    location.href='composer.html?layout='+encodeURIComponent(factory.layoutId)+'&view=3d&processPreview='+encodeURIComponent(token)+(designDoc?.id?'&returnNetwork='+encodeURIComponent(designDoc.id):'');
  }
  function fitMap() {
    if (!design?.factories.length) return;
    const viewport = $('#mapViewport');
    const xs = design.factories.map(f => f.mapPosition[0] * 65), ys = design.factories.map(f => f.mapPosition[2] * 65);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const zoom = Math.max(.45, Math.min(1.5, (viewport.clientWidth - 230) / Math.max(190, maxX - minX), (viewport.clientHeight - 155) / Math.max(100, maxY - minY)));
    checkpoint(design);
    design.camera = { x: -((minX + maxX) / 2) * zoom, y: -((minY + maxY) / 2) * zoom, zoom: Math.round(zoom * 20) / 20 };
    setDirty(); render();
  }
  async function persistRuntime(proposed) {
    if (!designDoc?.version) throw Error('먼저 생산망 설계를 DB에 저장하세요.');
    const current = runtimeDoc || Core.layoutDocument('실행 · ' + designDoc.id + ' · 기능 시연', {});
    current.settings.networkRuntime = clone(proposed);
    const saved = await api('/layouts', current); runtimeDoc = saved; runtime = clone(saved.settings.networkRuntime); render();
  }
  function simulationEligibility() {
    if (!designDoc?.version || dirty) return '먼저 현재 생산 설계를 DB에 저장하세요.';
    if (design.factories.length !== 3 || design.routes.length !== 2) return '이 기능 시연은 공장 3개와 A/B 운송 경로 2개가 필요합니다.';
    const workflow = design.product.workflow;
    if (workflow && ((workflow.productId && workflow.productId !== Core.PRODUCT) || JSON.stringify(workflow.bom) !== JSON.stringify(Core.PRODUCT_CANDIDATES[0].bom))) return '선택 제품·BOM이 2부품 기능 시연 설정과 다릅니다. 제품별 실행 규칙 검증이 필요합니다.';
    const required = [['E001'], ['A410'], ['A203', 'E122', 'E053']];
    for (let i = 0; i < 3; i++) {
      const f = design.factories[i], ref = referenceVersions[f.factoryInstanceId];
      if (!ref?.exists || ref.currentVersion !== f.layoutVersion) return `${f.name} 참조 버전이 다릅니다. 공장 설계를 다시 확인하세요.`;
      const missing = required[i].filter(id => !ref.assetIds?.includes(id));
      if (missing.length) return `${f.name}에 기능 시연 설비 ${missing.join(', ')}가 없습니다.`;
    }
    return null;
  }
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }
  async function stepRun() {
    if (runtimeBusy) return;
    const blocked = simulationEligibility(); if (blocked) throw Error(blocked);
    runtimeBusy = true;
    try {
      const current = runtime || Core.initialRuntime(designDoc.id); current.state = 'RUNNING';
      const outcome = Core.advance(current);
      if (!outcome.applied) { stopTimer(); message('실행 대기: ' + outcome.reason, true); return; }
      await persistRuntime(outcome.runtime);
      message(`기능 시연 ${runtime.step}/${Core.EVENT_TYPES.length}단계 · ${runtime.events.at(-1).type} · DB 실행 상태 저장 완료`);
      if (runtime.state === 'COMPLETE') stopTimer();
    } finally { runtimeBusy = false; }
  }
  async function setRunState(next) {
    if (!designDoc?.version) throw Error('먼저 생산망 설계를 DB에 저장하세요.');
    if (next === 'STOP') { stopTimer(); await persistRuntime(Core.initialRuntime(designDoc.id)); message('기능 시연 초기화 · 실행 상태 별도 저장 완료'); return; }
    const blocked = simulationEligibility(); if (blocked) throw Error(blocked);
    if (next === 'PAUSED') stopTimer();
    const proposed = clone(runtime || Core.initialRuntime(designDoc.id)); proposed.state = next;
    await persistRuntime(proposed);
    if (next === 'RUNNING') { stopTimer(); timer = setInterval(() => guard(stepRun), 900); }
  }
  function bindMap() {
    const viewport = $('#mapViewport');
    viewport.addEventListener('pointerdown', e => {
      if (!design) return;
      const card = e.target.closest('[data-factory-id]');
      if (card) selectFactory(card.dataset.factoryId);
      const f = card && design.factories.find(x => x.factoryInstanceId === card.dataset.factoryId);
      const kind = mode === 'select' && f && !f.locked ? 'factory' : 'pan';
      dragging = { kind, id: f?.factoryInstanceId, x: e.clientX, y: e.clientY, before: clone(design) };
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', e => {
      if (!dragging || !design) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (dragging.kind === 'factory') { const f = design.factories.find(x => x.factoryInstanceId === dragging.id); f.mapPosition[0] = Math.round((dragging.before.factories.find(x => x.factoryInstanceId === f.factoryInstanceId).mapPosition[0] + dx / (65 * design.camera.zoom)) * 4) / 4; f.mapPosition[2] = Math.round((dragging.before.factories.find(x => x.factoryInstanceId === f.factoryInstanceId).mapPosition[2] + dy / (65 * design.camera.zoom)) * 4) / 4; }
      else { design.camera.x = dragging.before.camera.x + dx; design.camera.y = dragging.before.camera.y + dy; }
      renderMap();
    });
    viewport.addEventListener('pointerup', e => { if (!dragging || !design) return; const moved = Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) > 3; if (moved) { checkpoint(dragging.before); setDirty(); render(); } dragging = null; });
    viewport.addEventListener('wheel', e => { if (!design) return; e.preventDefault(); const before = clone(design); design.camera.zoom = Math.max(.45, Math.min(2, Math.round((design.camera.zoom + (e.deltaY < 0 ? .1 : -.1)) * 20) / 20)); if (design.camera.zoom !== before.camera.zoom) { checkpoint(before); setDirty(); renderMap(); } }, { passive: false });
    viewport.addEventListener('dblclick', e => { if (e.target.closest('[data-factory-id]')) openFactory(false); });
  }
  function bind() {
    $('#productCandidates').onclick = e => { const card = e.target.closest('[data-candidate]'); if (card) { setCandidate(card.dataset.candidate); window.P006ProductionWorkflow?.choose(card.dataset.candidate); } };
    $('#createPilot').onclick = () => guard(selectPilotFactories);
    $('#saveNetwork').onclick = () => guard(saveDesign);
    $('#loadNetwork').onclick = () => guard(() => loadNetwork($('#savedNetworks').value));
    $('#factoryList').onclick = e => { const b = e.target.closest('[data-select-factory]'); if (b) selectFactory(b.dataset.selectFactory); };
    $('#factorySearch').oninput = render;
    $('#factoryDetails').onclick = e => { if (e.target.id === 'openFactory') openFactory(false); if (e.target.id === 'openCell') openFactory(true); if (e.target.id === 'toggleLock') { const f = selectedFactory(); if (!f) return; checkpoint(design); f.locked = !f.locked; setDirty(); render(); } };
    $('#modeSelect').onclick = () => { mode = 'select'; $('#modeSelect').classList.add('active'); $('#modePan').classList.remove('active'); $('#mapViewport').classList.add('mode-select'); };
    $('#modePan').onclick = () => { mode = 'pan'; $('#modePan').classList.add('active'); $('#modeSelect').classList.remove('active'); $('#mapViewport').classList.remove('mode-select'); };
    $('#fit').onclick = fitMap;
    $('#zoom').oninput = e => { if (!design) return; design.camera.zoom = Number(e.target.value); setDirty(); renderMap(); };
    $('#undo').onclick = () => { if (!undo.length || !design) return; redo.push(clone(design)); design = undo.pop(); setDirty(); render(); };
    $('#redo').onclick = () => { if (!redo.length || !design) return; undo.push(clone(design)); design = redo.pop(); setDirty(); render(); };
    $('#runStart').onclick = () => guard(() => setRunState('RUNNING'));
    $('#runStep').onclick = () => guard(stepRun);
    $('#runPause').onclick = () => guard(() => setRunState('PAUSED'));
    $('#runResume').onclick = () => guard(() => setRunState('RUNNING'));
    $('#runStop').onclick = () => guard(() => setRunState('STOP'));
    $('#exportStage').onclick = () => guard(exportStages);
    $('#networkName').oninput = setDirty;
    $('#breadcrumbNetwork').onclick = () => { if (design) { selectedFactoryId = null; render(); } };
    bindMap();
  }
  async function init() {
    bind(); renderCandidates(); $('#mapViewport').classList.add('mode-select'); window.P006ProductionWorkflow?.render();
    try { await Promise.all([refreshLayouts(),refreshProducts()]); const id = new URLSearchParams(location.search).get('network'); if (id) await loadNetwork(id); else { render(); message(`저장 레이아웃 ${layouts.length}개 조회 완료 · 제품과 공장을 선택하세요.`); } }
    catch (error) { message(error.message, true); }
  }
  window.P006_NETWORK_DEBUG = { getDesign: () => clone(design), getRuntime: () => clone(runtime), getDesignDocument: () => clone(designDoc), getRuntimeDocument: () => clone(runtimeDoc), getReferenceVersions: () => clone(referenceVersions) };
  window.P006_WORKFLOW = {
    read: () => ({ networkId: designDoc?.id || null, design: clone(design), runtime: clone(runtime), saved: !dirty && !!designDoc?.version, references: clone(referenceVersions), recommendations:clone(equipmentGapReport), executionBlocker: simulationEligibility() }),
    apply: workflow => { if (!design) throw Error('2. 공정 순서에서 저장 공장을 1개 이상 추가하세요. 입력 내용은 이 브라우저에 임시 보관됩니다.'); checkpoint(design); design.product.workflow = clone(workflow);design.product.productId=workflow.productId;design.product.name=workflow.productName;design.product.bom=clone(workflow.bom);if(workflow.productId!==Core.PRODUCT)design.product.evidenceStatus='DESIGN_CANDIDATE'; setDirty();render();guard(()=>refreshEquipmentGaps(workflow)); },
    save: saveDesign,
    openFactory: () => { if (!selectedFactoryId && design) selectedFactoryId = design.factories[0]?.factoryInstanceId; openFactory(false); },
    openProcessPreview,
    setCandidate
    ,products:candidates
    ,layouts:()=>layouts.filter(x=>x.count>0)
    ,saveProduct
    ,addFactory
    ,recommendEquipment:refreshEquipmentGaps
  };
  init();
})();
