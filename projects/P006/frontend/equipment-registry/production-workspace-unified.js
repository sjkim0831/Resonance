/* One-page production workbench. Uses the existing app state, renderer and actions. */
(() => {
  if (!Array.isArray(window.__p006UnifiedLoaded)) window.__p006UnifiedLoaded = [];
  window.__p006UnifiedLoaded.push('2026-10-04-v1');
  tabs.unshift(['workbench', '00 통합 작업대', '품목·공정·설비·배치·실행을 한 화면에서 연결합니다.']);
  let wbProcessId = p.processes[0]?.id || '';
  let wbKindFilter = 'all';
  let wbPending = null;
  const originalRender = render;
  const originalUpdateCards = updateCards;
  const style = document.createElement('style');
  style.textContent = `.wb-page{max-width:1900px;margin:auto}.wb-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:18px}.wb-heading p:not(.eyebrow){color:var(--muted);margin:5px 0}.wb-steps{display:grid;grid-template-columns:repeat(6,minmax(125px,1fr));gap:8px;margin:14px 0}.wb-steps button{white-space:normal;text-align:left;display:flex;flex-direction:column;gap:5px;padding:10px}.wb-steps button.active{background:var(--soft);border-color:#70adb2;color:var(--primary)}.wb-steps small{font-size:10px}.wb-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#eaf4f4;border-left:3px solid var(--primary);padding:11px 14px;border-radius:6px;margin-bottom:14px;font-size:12px}.wb-summary .warn{color:#936016}.wb-grid{display:grid;grid-template-columns:235px minmax(440px,1fr) 250px;align-items:start;gap:14px}.wb-left,.wb-right{position:sticky;top:10px;max-height:calc(100vh - 20px);overflow:auto}.wb-left .panel-head,.wb-right .panel-head{align-items:flex-start}.wb-left .field{margin-bottom:10px}.wb-filter{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 14px}.wb-filter button{font-size:10px;padding:4px 7px;min-height:28px}.wb-filter button.active{background:var(--soft);border-color:#7eb7ba;color:var(--primary)}.wb-palette-list{display:grid;gap:6px;max-height:245px;overflow:auto;margin:6px 0 15px}.wb-equip-list{max-height:225px}.wb-palette-item{display:flex;gap:8px;align-items:center;padding:7px;border:1px solid var(--line);border-radius:7px;background:#fff;cursor:grab;min-width:0}.wb-palette-item:active{cursor:grabbing}.wb-palette-item b,.wb-palette-item small{display:block;overflow-wrap:anywhere}.wb-palette-item b{font-size:11px}.wb-palette-item small{font-size:9px;margin-top:3px}.wb-thumb{width:38px;height:38px;flex:0 0 38px;border-radius:5px;background:#edf4f6;color:var(--primary);display:grid;place-items:center;font-size:12px}.wb-thumb img{max-width:100%;max-height:100%;object-fit:contain}.wb-full{width:100%;white-space:normal}.wb-center>.panel{margin-bottom:12px}.wb-scene{height:clamp(360px,48vh,620px);min-height:340px}.wb-runbar{margin-top:10px}.wb-runbar b{font-size:12px}.wb-scene-legend{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.wb-scene-legend span{font-size:10px;background:#f0f5f7;border-radius:4px;padding:4px 7px;color:var(--muted)}.wb-process-list{display:grid;gap:8px}.wb-stage{border:1px solid var(--line);border-radius:8px;padding:10px;background:#fff}.wb-stage.selected{border-color:var(--primary);box-shadow:0 0 0 1px #006b7420}.wb-stage-top{display:flex;align-items:center;gap:9px}.wb-stage-top>div{flex:1;min-width:0}.wb-stage-top b,.wb-stage-top small{display:block;overflow-wrap:anywhere}.wb-stage-top small{margin-top:3px}.wb-num{width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:var(--soft);color:var(--primary);font-weight:700;font-size:11px}.wb-stage-top button,.wb-stage-bottom button{font-size:10px;min-height:29px;padding:4px 8px}.wb-assignment{display:grid;grid-template-columns:45px minmax(0,1fr);gap:2px 7px;margin:8px 0;padding:8px;background:#f5f8fa;border-radius:5px;font-size:11px}.wb-assignment small{grid-column:2}.wb-drop-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.wb-drop-row>div{min-height:54px;padding:7px;border:1px dashed #a9bdc9;border-radius:5px;background:#f9fbfc}.wb-drop-row>div b,.wb-drop-row>div small{display:block;overflow-wrap:anywhere}.wb-drop-row>div b{font-size:10px}.wb-drop-row>div small{font-size:9px;margin-top:4px}.wb-drop-row [data-wb-drop-kind].drop-ready,.wb-drop-row [data-wb-drop-kind].drop-armed{background:#e5f5f3;border-color:var(--primary);box-shadow:inset 0 0 0 1px var(--primary)}.wb-stage-bottom{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:7px}.wb-stage-bottom span{font-size:10px;color:var(--muted);margin-right:auto}.wb-stage-bottom [data-wb-drop-kind=equipment]{border-style:dashed}.wb-stage-bottom [data-wb-drop-kind=equipment].drop-armed{background:#e5f5f3;border-color:var(--primary)}.wb-detail{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--line);padding:9px 0;font-size:11px}.wb-detail span{color:var(--muted)}.wb-actions{display:grid;margin-top:12px}.wb-actions button{white-space:normal}.wb-transport{display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;border-bottom:1px solid var(--line);padding:9px 0;font-size:11px}.wb-transport>b,.wb-transport small{grid-column:1/-1}.wb-transport span,.wb-transport small{color:var(--muted)}.wb-help{padding:15px}.wb-help ol{line-height:1.9;color:var(--muted);font-size:12px}@media(max-width:1250px){.wb-grid{grid-template-columns:210px minmax(360px,1fr)}.wb-right{grid-column:1/-1;position:static;max-height:none;display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.wb-right .panel-head{grid-column:1/-1}}@media(max-width:850px){.wb-heading{display:block}.wb-heading .actions{margin-top:10px}.wb-steps{grid-template-columns:repeat(3,minmax(0,1fr))}.wb-grid{grid-template-columns:1fr}.wb-left,.wb-right{position:static;max-height:none}.wb-right{display:block}.wb-palette-list{max-height:180px}.wb-scene{height:400px}.wb-summary{align-items:flex-start;flex-direction:column}.wb-drop-row{grid-template-columns:1fr}.wb-drop-row>div{min-height:42px}}`;
  document.head.append(style);

  function wbStepTabs() {
    const captions={product:'제품·품목',process:'공정 순서·투입/산출·운송',layout:'부지·공장·설비 배치',studio:'제조사·모델·참고자료',run:'전체 흐름 3D 실행',qa:'검토·누락 확인·저장'};
    return `<div class="wb-steps" aria-label="생산 설계 순서">${tabs.filter(([id]) => id !== 'workbench').map(([id, title], i) => `<button data-tab="${id}" class="${tab === id ? 'active' : ''}"><b>0${i + 1} · ${esc(title.replace(/^\d+\s*/, ''))}</b><small>${captions[id]||''}</small></button>`).join('')}</div>`;
  }
  function wbMaterialRows() {
    const q = ($('wb-search')?.value || '').trim().toLowerCase();
    return p.parts.filter(x => wbKindFilter === 'all' || (x.kind || '부품') === wbKindFilter)
      .filter(x => !q || `${x.name} ${x.kind || ''} ${x.model || ''}`.toLowerCase().includes(q));
  }
  function wbPalette() {
    const materials = wbMaterialRows();
    const q = ($('wb-search')?.value || '').trim().toLowerCase();
    const equipment = p.equipment.filter(x => !q || `${x.name} ${x.asset || ''} ${x.manufacturer || ''} ${x.model || ''}`.toLowerCase().includes(q));
    return `<label class="field">검색<input id="wb-search" placeholder="품목·설비명, 자산 코드" value="${esc($('wb-search')?.value || '')}"></label>
      <div class="wb-filter">${['all','부품','중간품','완제품','부산물'].map(k => `<button data-wb-filter="${k}" class="${wbKindFilter === k ? 'active' : ''}">${k === 'all' ? '전체' : k}</button>`).join('')}</div>
      <h3>제품·공정 품목 <span class="badge">${materials.length}/${p.parts.length}</span></h3>
      <div class="wb-palette-list">${materials.map(x => `<article class="wb-palette-item" draggable="true" data-wb-drag-kind="part" data-wb-id="${esc(x.id)}"><span class="wb-thumb">${x.thumbnail ? `<img src="${esc(x.thumbnail)}" alt="">` : '3D'}</span><span><b>${esc(x.name)}</b><small>${esc(x.kind || '부품')} · ${esc(x.quantity || 1)} ${esc(x.unit || '개')}</small><small>${x.model ? '모델 경로 기록' : '모델 미연결'}</small></span></article>`).join('') || '<div class="empty">검색 결과가 없습니다.</div>'}</div>
      <h3>계획 설비 <span class="badge">${equipment.length}/${p.equipment.length}</span></h3>
      <div class="wb-palette-list wb-equip-list">${equipment.map(x => `<article class="wb-palette-item" draggable="true" data-wb-drag-kind="equipment" data-wb-id="${esc(x.id)}"><span class="wb-thumb">⚙</span><span><b>${esc(x.name)}</b><small>${esc(x.asset || '자산 코드 없음')} · ${esc(x.manufacturer || '제조사 미확인')}</small><small>${esc(x.model || '모델 미확인')}</small></span></article>`).join('') || '<div class="empty">검색 결과가 없습니다.</div>'}</div>
      <button data-tab="studio" class="wb-full">700+ 공통 카탈로그 검색·연결 →</button>`;
  }
  function wbStageCards() {
    const sc = schedule();
    return p.processes.map((r, i) => {
      const selected = r.id === wbProcessId, e = p.equipment.find(x => x.id === r.equipmentId);
      const timing = sc.processes[r.id] || {start: 0, end: 0};
      const linked = (r.inputIds || []).length + (r.outputIds || []).length + (r.byproductIds || []).length;
      const status = time >= timing.end ? '완료' : time >= timing.start ? '진행 중' : '대기';
      return `<article class="wb-stage ${selected ? 'selected' : ''}" data-wb-select-process="${esc(r.id)}">
        <div class="wb-stage-top"><span class="wb-num">${String(i + 1).padStart(2, '0')}</span><div><b>${esc(r.name)}</b><small>${timing.start.toFixed(1)}–${timing.end.toFixed(1)}분 · ${status}</small></div><button data-wb-pick-process="${esc(r.id)}" aria-label="${esc(r.name)} 선택">선택</button></div>
        <div class="wb-assignment"><span>설비</span><b>${esc(e?.name || '미배정')}</b><small>${esc(e?.asset || '코드 없음')} · ${esc(p.factories.find(f => f.id === e?.factoryId)?.name || '공장 미지정')}</small></div>
        <div class="wb-drop-row"><div data-wb-drop-kind="input" data-wb-process="${esc(r.id)}"><b>투입</b><small>${(r.inputIds || []).map(itemName).map(esc).join(' · ') || '품목을 끌어놓기'}</small></div><div data-wb-drop-kind="output" data-wb-process="${esc(r.id)}"><b>산출</b><small>${(r.outputIds || []).map(itemName).map(esc).join(' · ') || '중간품·완제품 놓기'}</small></div><div data-wb-drop-kind="byproduct" data-wb-process="${esc(r.id)}"><b>부산물</b><small>${(r.byproductIds || []).map(itemName).map(esc).join(' · ') || '해당 시 놓기'}</small></div></div>
        <div class="wb-stage-bottom"><span>${linked}개 품목 연결</span><button data-wb-drop-kind="equipment" data-wb-process="${esc(r.id)}">설비 놓기 / 변경</button><button data-tab="process">공정 상세 편집</button></div>
      </article>`;
    }).join('');
  }
  function wbSelectedDetails() {
    const row = p.processes.find(x => x.id === wbProcessId) || p.processes[0];
    if (!row) return '<div class="empty">공정을 추가하세요.</div>';
    const eqRow = p.equipment.find(x => x.id === row.equipmentId), site = p.sites.find(x => x.id === p.factories.find(f => f.id === eqRow?.factoryId)?.siteId);
    return `<p class="eyebrow">SELECTED OPERATION</p><h2>${esc(row.name)}</h2><p class="muted">공정 ${p.processes.indexOf(row) + 1}/${p.processes.length} · ${esc(row.kind || '종류 미지정')}</p>
      <label class="field">담당 설비<select id="wb-equipment-select"><option value="">미배정</option>${listOpts(p.equipment, row.equipmentId)}</select></label>
      <div class="wb-detail"><span>부지</span><b>${esc(site?.name || '미지정')}</b></div><div class="wb-detail"><span>공장</span><b>${esc(p.factories.find(f => f.id === eqRow?.factoryId)?.name || '미지정')}</b></div>
      <div class="wb-detail"><span>투입</span><b>${(row.inputIds || []).length} 품목</b></div><div class="wb-detail"><span>산출 · 부산물</span><b>${(row.outputIds || []).length} · ${(row.byproductIds || []).length}</b></div>
      <div class="wb-detail"><span>실제 GLB 연결</span><b>${eqRow?.glb ? '경로 지정 · 로드 검증 별도' : '미연결'}</b></div>
      <div class="actions wb-actions"><button data-tab="process">공정·품목 상세 연결 →</button><button data-tab="layout">부지·공장·설비 배치 →</button><button data-tab="studio">제조사·모델·참고자료 →</button></div>
      <p class="notice warn">품목은 공정에 연결되어도 현재 3D 재생에서는 개별 품목 GLB의 공정별 생성·소멸 표현이 연결되지 않을 수 있습니다. 계획별 실제 모델 연결 상태를 확인하세요.</p>`;
  }
  function workbenchHtml() {
    const errors = schedule().errors, linked = p.processes.filter(r => (r.inputIds || []).length + (r.outputIds || []).length + (r.byproductIds || []).length > 0).length;
    return `<section class="wb-page"><div class="wb-heading"><div><p class="eyebrow">PRODUCTION WORKBENCH · ${esc(p.code)}</p><h1>제품부터 공정 실행까지 한 화면에서 설계</h1><p>품목·공정·설비·공장 위치를 연결하고, 동일 계획의 3D와 시뮬레이션을 확인합니다.</p></div><div class="actions"><button data-action="validate">계획 검사</button><button data-action="save-server-plan" class="primary">계획 저장</button></div></div>
      ${wbStepTabs()}
      <div class="wb-summary"><span><b>${esc(p.name)}</b> · ${esc(p.code)}</span><span>품목 ${p.parts.length} · 공정 ${p.processes.length} · 설비 ${p.equipment.length} · 부지 ${p.sites.length} / 공장 ${p.factories.length}</span><span class="${errors.length ? 'warn' : ''}">${errors.length ? `검토 필요 ${errors.length}건` : `품목 연결 ${linked}/${p.processes.length} 공정`}</span></div>
      <div class="wb-grid"><aside class="panel wb-left"><div class="panel-head"><div><p class="eyebrow">ASSET PALETTE</p><h2>품목·설비 팔레트</h2></div><button data-tab="product">＋ 품목</button></div><p class="muted">항목을 끌어놓으세요. 터치 환경은 항목을 누른 뒤 대상 칸을 누르면 연결됩니다.</p><div id="wb-palette-content">${wbPalette()}</div></aside>
        <section class="wb-center"><div class="panel wb-view-panel"><div class="panel-head"><div><p class="eyebrow">LIVE 3D · SAME PLAN</p><h2>부지 · 공장 · 설비 · 운송 경로</h2></div><span class="badge" id="wb-model-status">3D 준비 중</span></div><div id="equipment-preview" class="scene wb-scene"><span class="scene-label">현재 계획 전체 보기 · 드래그 회전 · 휠 확대</span></div><div class="runbar wb-runbar"><button data-action="play" class="primary">▶ 재생</button><button data-action="pause">Ⅱ 일시정지</button><button data-action="reset">↺ 초기화</button><button data-action="next">다음 단계</button><select id="speed" aria-label="재생 배속">${[1,10,60,600].map(n => `<option value="${n}" ${speed === n ? 'selected' : ''}>${n}×</option>`).join('')}</select><b id="clock">${time.toFixed(1)} / ${schedule().end.toFixed(1)}분</b></div><input class="timeline" id="timeline" aria-label="공통 실행 시간" type="range" min="0" max="${schedule().end}" step=".01" value="${time}"><div class="wb-scene-legend"><span>부지·공장 배치</span><span>공정 설비</span><span>운송 경로·차량</span><span>작업물 형상은 가상 시연</span></div></div>
          <section class="panel wb-process-panel"><div class="panel-head"><div><p class="eyebrow">ORDERED PROCESS + ITEM LINKS</p><h2>공정 순서와 품목·설비 연결</h2><small>드롭 변경은 기존 계획 데이터에 반영되며 취소·저장·검토 기능을 그대로 사용합니다.</small></div><button data-tab="process" class="primary">전체 공정 편집 →</button></div><div class="wb-process-list">${wbStageCards() || '<div class="empty">공정을 추가하면 단계가 표시됩니다.</div>'}</div></section>
          <section class="panel"><div class="panel-head"><div><p class="eyebrow">TRANSPORT + INFRASTRUCTURE</p><h2>운송·출입 경로 요약</h2></div><button data-tab="process">운송 경로 상세 →</button></div>${p.transports.map(t => `<div class="wb-transport"><b>${esc(t.name || '운송')}</b><span>${esc(itemName(t.itemId))} · ${esc(t.vehicle || '차량 미지정')}</span><span>${esc(p.factories.find(f => f.id === t.from)?.name || '출발 미지정')} → ${esc(p.factories.find(f => f.id === t.to)?.name || '도착 미지정')}</span><small>거리 ${Number.isFinite(routeLength(t)) ? routeLength(t).toFixed(1) + 'm' : '미확인'} · 입출구·도로 경로는 계획 설정 기준</small></div>`).join('') || '<div class="empty">운송 구간이 없습니다. 공정·운송에서 추가하세요.</div>'}</section></section>
        <aside class="panel wb-right"><div class="panel-head"><div><p class="eyebrow">INSPECTOR</p><h2>선택 공정</h2></div><span class="badge">속성</span></div>${wbSelectedDetails()}<hr><h3>전체 계획 QA</h3><div class="wb-detail"><span>일정 오류</span><b>${errors.length}</b></div><div class="wb-detail"><span>저장 상태</span><b id="save-state-inline">${dirty ? '미저장 변경' : '브라우저 초안'}</b></div><div class="actions wb-actions"><button data-tab="qa">검토·누락 확인 →</button><button data-tab="run">전체 실행 화면 →</button></div><p class="muted">저장 대상·권한은 선택한 계정 세션에 따릅니다. 브라우저 초안과 서버 저장은 구분됩니다.</p></aside></div>
      <details class="panel wb-help"><summary>화면 도움말 · 작업 순서 · 현재 한계</summary><ol><li>제품·품목에서 완제품, BOM 부품, 중간품·부산물과 모델 경로를 등록합니다.</li><li>부지·공장·배치에서 공간 크기·방향·입출구·설비 위치를 조정합니다.</li><li>공정 카드에 품목과 담당 설비를 끌어 놓고, 선행 관계와 운송 정보를 확인합니다.</li><li>설비 스튜디오에서 제조사·모델·참고자료·가동 정보를 검토합니다.</li><li>재생 후 검토에서 계획 오류를 확인하고 서버 저장 또는 JSON 내보내기를 합니다.</li></ol><p class="notice warn">프론트에서 연결하는 기능입니다. 실물 적합성 승인, USD 직접 웹 렌더링, 품목별 완성도 높은 3D 생성·소멸 애니메이션, 인증된 저장 왕복은 별도 확인 게이트이며 자동으로 완료된 것으로 간주하지 않습니다.</p></details></section>`;
  }
  render = function () {
    if (tab !== 'workbench') return originalRender();
    const intended = tab;
    tab = 'layout';
    originalRender(); // Reuse the production renderer; no iframe or second WebGL instance.
    tab = intended;
    $('content').innerHTML = workbenchHtml();
    $('nav').innerHTML = tabs.map(([id, name], i) => `<button data-tab="${id}" class="${id === 'workbench' ? 'active' : ''}" aria-current="${id === 'workbench' ? 'page' : 'false'}"><span>${String(i).padStart(2, '0')}</span>${esc(name)}</button>`).join('');
    document.querySelectorAll('[data-action="undo"]').forEach(b => b.disabled = !history.length);
    document.querySelectorAll('[data-action="redo"]').forEach(b => b.disabled = !future.length);
    const select = $('wb-equipment-select');
    if (select) select.addEventListener('change', () => { const row = p.processes.find(x => x.id === wbProcessId); if (!row) return; checkpoint(); row.equipmentId = select.value; mark(); render(); });
  };
  updateCards = function () { originalUpdateCards(); if (tab !== 'workbench') return; const sc = schedule(); if ($('clock')) $('clock').textContent = `${time.toFixed(1)} / ${sc.end.toFixed(1)}분`; if ($('timeline')) $('timeline').value = time; document.querySelectorAll('[data-wb-select-process]').forEach(card => { const r = p.processes.find(x => x.id === card.dataset.wbSelectProcess), timing = r && sc.processes[r.id]; if (timing) { const label = card.querySelector('.wb-stage-top small'); if (label) label.textContent = `${timing.start.toFixed(1)}–${timing.end.toFixed(1)}분 · ${time >= timing.end ? '완료' : time >= timing.start ? '진행 중' : '대기'}`; } }); };

  function wbApplyPalette(payload, zone) {
    const row=p.processes.find(x=>x.id===zone.dataset.wbProcess); if(!row)return;
    checkpoint();
    if(payload.kind==='equipment'&&zone.dataset.wbDropKind==='equipment'){const asset=p.equipment.find(x=>x.id===payload.id);if(!asset){p006History.pop();return;}row.equipmentId=asset.id;}
    else if(payload.kind==='part'&&['input','output','byproduct'].includes(zone.dataset.wbDropKind)){const key={input:'inputIds',output:'outputIds',byproduct:'byproductIds'}[zone.dataset.wbDropKind],part=p.parts.find(x=>x.id===payload.id);if(!part){p006History.pop();return;}row[key]||=[];if(!row[key].includes(part.id))row[key].push(part.id);}
    else {p006History.pop();return;}
    wbProcessId=row.id;mark();render();msg('현재 계획에 연결했습니다. 저장 전 검토를 확인하세요.');
  }
  document.addEventListener('click', e => {
    const palette=e.target.closest('[data-wb-drag-kind]');
    if(palette&&tab==='workbench'){wbPending={kind:palette.dataset.wbDragKind,id:palette.dataset.wbId};document.querySelectorAll('[data-wb-drop-kind]').forEach(x=>x.classList.add('drop-armed'));msg('선택됨 · 연결할 공정의 투입/산출/부산물 또는 설비 칸을 누르세요.');return;}
    const armed=e.target.closest('[data-wb-drop-kind]');
    if(armed&&wbPending&&tab==='workbench'){e.preventDefault();e.stopImmediatePropagation();const pending=wbPending;wbPending=null;wbApplyPalette(pending,armed);return;}
    const filter = e.target.closest('[data-wb-filter]');
    if (filter && tab === 'workbench') { wbKindFilter = filter.dataset.wbFilter; render(); return; }
    const pick = e.target.closest('[data-wb-pick-process]');
    if (pick && tab === 'workbench') { wbProcessId = pick.dataset.wbPickProcess; document.querySelectorAll('[data-wb-select-process]').forEach(x => x.classList.toggle('selected', x.dataset.wbSelectProcess === wbProcessId)); const right = document.querySelector('.wb-right'); if (right) right.innerHTML = `<div class="panel-head"><div><p class="eyebrow">INSPECTOR</p><h2>선택 공정</h2></div></div>${wbSelectedDetails()}<hr><h3>전체 계획 QA</h3><div class="wb-detail"><span>일정 오류</span><b>${schedule().errors.length}</b></div><div class="actions wb-actions"><button data-tab="qa">검토·누락 확인 →</button><button data-tab="run">전체 실행 화면 →</button></div>`; const s = $('wb-equipment-select'); if (s) s.addEventListener('change', () => {const row=p.processes.find(x=>x.id===wbProcessId);if(row){checkpoint();row.equipmentId=s.value;mark();render();}}); }
  }, true);
  document.addEventListener('input', e => { if (e.target.id === 'wb-search' && tab === 'workbench') { const input=e.target, value=input.value, start=input.selectionStart, end=input.selectionEnd, host=$('wb-palette-content'); if(host)host.innerHTML=wbPalette(); const next=$('wb-search'); if(next){next.focus();next.setSelectionRange(start,end);} } });
  document.addEventListener('dragstart', e => { const item = e.target.closest('[data-wb-drag-kind]'); if (!item || tab !== 'workbench') return; const payload=JSON.stringify({kind:item.dataset.wbDragKind,id:item.dataset.wbId}); e.dataTransfer.setData('application/x-p006-palette', payload); e.dataTransfer.setData('text/plain', payload); e.dataTransfer.effectAllowed='copy'; });
  document.addEventListener('dragover', e => { const zone=e.target.closest('[data-wb-drop-kind]'); if(zone&&tab==='workbench'){e.preventDefault();zone.classList.add('drop-ready');} });
  document.addEventListener('dragleave', e => { const zone=e.target.closest('[data-wb-drop-kind]'); if(zone)zone.classList.remove('drop-ready'); });
  document.addEventListener('drop', e => {
    const zone=e.target.closest('[data-wb-drop-kind]'); if(!zone||tab!=='workbench')return; e.preventDefault(); zone.classList.remove('drop-ready');
    let payload;try{payload=JSON.parse(e.dataTransfer.getData('application/x-p006-palette')||e.dataTransfer.getData('text/plain'));}catch{return;}
    wbApplyPalette(payload,zone);
  });
  document.addEventListener('input', e => { if(e.target.id==='timeline'&&tab==='workbench'){time=Number(e.target.value);playing=false;drawInvalid=true;updateCards();} });
  const originalEngineStatus = setInterval(() => { const source=$('model-status'),target=$('wb-model-status'); if(target&&tab==='workbench')target.textContent=source?.textContent||`공유 3D · GLB ${loadCount}/${p.equipment.filter(x=>x.glb).length} · 실패 ${[...loadErrors].length}`; },500);
  window.addEventListener('beforeunload',()=>clearInterval(originalEngineStatus),{once:true});
  if (location.hash === '#workbench') { tab='workbench'; render(); }
})();
