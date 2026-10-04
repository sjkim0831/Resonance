/* Full-product-first process workbench; augments the existing process screen without replacing its editors or 3D preview. */
(() => {
  'use strict';

  const STYLE_ID = 'p006-flow-workbench-style';
  const READY_ID = 'p006-flow-workbench';

  const css = `
    .flow-workbench{display:grid;grid-template-columns:minmax(205px,230px) minmax(460px,1fr) minmax(245px,285px);gap:14px;align-items:start;margin:0 0 16px}
    .flow-workbench-target,.flow-workbench-side{border:1px solid #cbdbe8;border-radius:12px;background:#fff;box-shadow:0 2px 8px #0c29400a}
    .flow-workbench-target{display:grid;grid-template-columns:minmax(220px,1fr) auto;align-items:center;gap:12px;padding:14px 18px;margin-bottom:12px;border-left:4px solid #008b95}
    .flow-workbench-target label{display:flex;align-items:center;gap:12px;min-width:0;font-weight:700;color:#17344a}
    .flow-workbench-target select{min-width:230px;max-width:100%;height:40px;border:1px solid #b8cede;border-radius:7px;padding:0 10px;background:white;color:#18354a}
    .flow-workbench-target .fw-target-note{font-size:12px;color:#637e92;font-weight:400}
    .flow-workbench-side{padding:14px;min-width:0}
    .flow-workbench-side h2{font-size:16px;margin:2px 0 7px;color:#17344a}
    .flow-workbench-side .eyebrow{margin:0 0 5px;color:#008493;font-size:10px;letter-spacing:.13em;font-weight:800}
    .fw-process-list{display:grid;gap:7px;max-height:440px;overflow:auto;padding-right:3px;margin-top:12px}
    .fw-process-item{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 8px;border:1px solid #d8e4ec;border-radius:9px;background:#fbfdfe}
    .fw-process-item button{border:0;background:transparent;text-align:left;min-width:0;padding:0;color:#17344a;cursor:pointer}
    .fw-process-item button:hover{text-decoration:underline;color:#007d88}
    .fw-process-item b,.fw-process-item small{display:block;overflow-wrap:anywhere}
    .fw-process-item b{font-size:12px;line-height:1.35}
    .fw-process-item small{font-size:10px;color:#698398;margin-top:3px;line-height:1.35}
    .fw-process-number{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#e8f4f5;color:#007d88;font-size:10px;font-weight:800}
    .fw-process-state{font-size:10px;color:#607b8f;white-space:nowrap}
    .fw-process-state.is-missing{color:#a15a00}
    .fw-summary{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:12px 0}
    .fw-metric{border-radius:8px;background:#f1f6f8;padding:9px 10px;color:#60798d;font-size:10px}
    .fw-metric b{display:block;color:#17344a;font-size:16px;margin-top:3px}
    .fw-audit-list{display:grid;gap:8px;margin-top:10px}
    .fw-audit{border:1px solid #d7e2e9;border-radius:9px;padding:10px;background:#fff}
    .fw-audit.is-warn{border-color:#edc995;background:#fffaf2}
    .fw-audit.is-ok{border-color:#b6ddce;background:#f4fbf8}
    .fw-audit-head{display:flex;justify-content:space-between;gap:8px;align-items:center}
    .fw-audit-head b{font-size:12px;color:#17344a}
    .fw-audit-head span{font-size:10px;color:#637c90;white-space:nowrap}
    .fw-audit p{font-size:10px;line-height:1.5;color:#647e91;margin:6px 0 8px}
    .fw-audit button,.flow-workbench-target button{font-size:11px}
    .fw-audit button{border:1px solid #bfd1df;background:#fff;border-radius:6px;padding:6px 8px;color:#17344a;cursor:pointer}
    .fw-audit button:hover{border-color:#008b95;color:#007d88}
    .fw-ai-note{padding:10px;border-radius:8px;background:#eef6f7;border-left:3px solid #008b95;font-size:10px;line-height:1.55;color:#44677c;margin-top:10px}
    .flow-workbench-main{min-width:0}
    .flow-workbench-main>.journey-panel{margin:0;min-width:0}
    .flow-workbench-main .journey-node-content{min-width:0}
    .fw-empty{padding:12px;border:1px dashed #c9d8e2;border-radius:8px;color:#647e91;font-size:11px;line-height:1.5}
    @media(max-width:1280px){.flow-workbench{grid-template-columns:minmax(180px,205px) minmax(390px,1fr) minmax(220px,250px);gap:10px}.flow-workbench-side{padding:11px}}
    @media(max-width:1050px){.flow-workbench{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.flow-workbench-main{grid-column:1/-1;grid-row:2}.flow-workbench-target{grid-template-columns:1fr}.flow-workbench-target label{align-items:flex-start;flex-direction:column;gap:6px}}
    @media(max-width:680px){.flow-workbench{grid-template-columns:1fr}.flow-workbench-main{grid-column:auto;grid-row:auto}.fw-process-list{max-height:280px}.flow-workbench-target select{min-width:0;width:100%}.flow-workbench-main .journey-metrics{grid-template-columns:1fr 1fr}}
  `;

  const esc = (value) => window.P006WorkspaceFlowBridge.esc(String(value ?? ''));
  const itemName = (id, plan) => plan.parts.find(item => item.id === id)?.name || '연결 항목 확인';

  function orderedProcesses(plan, bridge) {
    const timing = bridge.schedule();
    return plan.processes.map((row, index) => ({
      row,
      index,
      timing: timing.processes[row.id] || { start: 0, end: 0 },
      equipment: plan.equipment.find(item => item.id === row.equipmentId)
    })).sort((a, b) => a.timing.start - b.timing.start || a.index - b.index);
  }

  function audits(plan, ordered) {
    const unassigned = ordered.filter(item => !item.equipment).length;
    const noFlow = ordered.filter(({ row }) => !(row.inputIds || []).length && !(row.outputIds || []).length && !(row.byproductIds || []).length).length;
    const badItemRefs = ordered.reduce((sum, { row }) => sum + ['inputIds', 'outputIds', 'byproductIds'].reduce((n, key) => n + (row[key] || []).filter(id => !plan.parts.some(part => part.id === id)).length, 0), 0);
    const unplacedEquipment = plan.equipment.filter(item => !item.factoryId || !plan.factories.some(factory => factory.id === item.factoryId)).length;
    const disconnectedTransport = plan.transports.filter(row => !row.itemId || !plan.parts.some(item => item.id === row.itemId) || !row.from || !row.to || !row.toProcessId || !plan.processes.some(proc => proc.id === row.toProcessId)).length;
    const missingModels = plan.parts.filter(item => !item.model && !item.assetRef?.assetId).length;
    const finishItems = plan.parts.filter(item => item.kind === '완제품');
    let targetId = plan.flowTargetProductId || '';
    if (!finishItems.some(item => item.id === targetId) && finishItems.length) {
      targetId = (finishItems.find(item => plan.processes.some(row => (row.outputIds || []).includes(item.id))) || finishItems.at(-1)).id;
      plan.flowTargetProductId = targetId;
    }
    const targetValid = finishItems.some(item => item.id === targetId);
    const targetProducerCount = targetValid ? plan.processes.filter(row => (row.outputIds || []).includes(targetId)).length : 0;
    return { unassigned, noFlow, badItemRefs, unplacedEquipment, disconnectedTransport, missingModels, finishItems, targetId, targetValid, targetProducerCount };
  }

  function auditCard(title, count, description, action, severity = 'warn') {
    return `<article class="fw-audit ${count ? `is-${severity}` : 'is-ok'}"><div class="fw-audit-head"><b>${esc(title)}</b><span>${count ? `${count}건 확인` : '현재 이상 없음'}</span></div><p>${esc(description)}</p>${count ? `<button type="button" data-fw-action="${esc(action)}">해당 입력 열기</button>` : ''}</article>`;
  }

  function targetSelector(plan, review) {
    if (!review.finishItems.length) return '<div class="fw-empty">완제품이 아직 등록되지 않았습니다. 제품·품목 탭에서 완제품을 등록하면 여기서 선택할 수 있습니다.</div>';
    const selected = review.targetId;
    return `<label><span>시뮬레이션 목표 완제품</span><select data-fw-target-product aria-label="시뮬레이션 목표 완제품">${review.finishItems.map(item => `<option value="${esc(item.id)}" ${item.id === selected ? 'selected' : ''}>${esc(item.name)} · ${esc(item.code || item.id)}</option>`).join('')}</select></label><span class="fw-target-note">목표 선택은 검토 기준입니다. 실행은 공정별 입·출력/운송 연결대로 재생합니다. ${review.targetProducerCount ? `산출 연결 공정 ${review.targetProducerCount}개` : '아직 산출 공정에 연결되지 않음'} · 제품/품목 연결은 제품 탭에서 편집</span>`;
  }

  function compose(baseHtml, bridge) {
    const plan = bridge.getPlan();
    const ordered = orderedProcesses(plan, bridge);
    const review = audits(plan, ordered);
    const processRows = ordered.map(({ row, index, timing, equipment }, position) => {
      const outputs = [...(row.outputIds || []), ...(row.byproductIds || [])].map(id => itemName(id, plan));
      const status = equipment ? (equipment.factoryId ? equipment.name : `${equipment.name} · 공장 미지정`) : '설비 미배정';
      const targetTag = review.targetValid && (row.outputIds || []).includes(review.targetId) ? ' · 목표 완제품' : '';
      return `<div class="fw-process-item"><span class="fw-process-number">${String(position + 1).padStart(2, '0')}</span><button type="button" data-fw-action="focus-process" data-process-index="${index}" aria-label="${esc(row.name)} 공정 편집"><b>${esc(row.name)}</b><small>${outputs.length ? `산출: ${esc(outputs.join(', '))}` : '산출 품목 미연결'}${esc(targetTag)} · ${timing.start.toFixed(1)}–${timing.end.toFixed(1)}분</small></button><span class="fw-process-state ${equipment ? '' : 'is-missing'}">${esc(status)}</span></div>`;
    }).join('');

    const itemCount = plan.parts.length;
    const linkedCount = ordered.filter(({ row }) => (row.inputIds || []).length + (row.outputIds || []).length + (row.byproductIds || []).length).length;
    const recommendationCards = [
      auditCard('담당 설비 미배정', review.unassigned, '공정별 설비를 확인합니다. 빈 설비를 자동 배정하지는 않습니다.', 'open-process'),
      auditCard('공정 입·출력 미연결', review.noFlow, '원자재·중간품·완제품·부산물 연결을 검토합니다.', 'open-flow'),
      auditCard('운송 연결 검토', review.disconnectedTransport, '운반 품목·출발/도착 공장·도착 공정 연결을 확인합니다.', 'open-transport'),
      auditCard('설비 공간 미지정', review.unplacedEquipment, '공장 소속이 없는 설비가 있는지 확인합니다.', 'open-layout'),
      auditCard('목표 완제품 산출 연결', review.targetValid && review.targetProducerCount ? 0 : 1, review.targetProducerCount ? `선택 목표를 산출하는 공정 ${review.targetProducerCount}개가 있습니다.` : '선택된 목표 완제품이 공정 산출 품목으로 연결되지 않았습니다. 실행은 연결된 공정 품목을 기준으로 재생됩니다.', 'open-flow'),
      auditCard('품목 3D 자산 미연결', review.missingModels, '모델이 없는 품목은 실행 화면에서 프록시/빈 상태가 표시될 수 있습니다.', 'open-product', 'warn'),
      auditCard('잘못된 품목 참조', review.badItemRefs, '공정이 존재하지 않는 품목 ID를 참조하는지 확인합니다.', 'open-flow')
    ].join('');

    return `<section class="flow-workbench-target" id="${READY_ID}"><div><p class="eyebrow">OUTPUT FIRST · 계획 데이터 기반</p><h2 style="margin:0 0 8px;font-size:16px">먼저 만들 제품을 정하고, 공정 흐름을 확인하세요</h2>${targetSelector(plan, review)}</div><div><button type="button" data-tab="run" class="primary">선택 제품 흐름 미리보기 →</button></div></section><section class="flow-workbench" aria-label="제품 기준 공정 흐름 작업대"><aside class="flow-workbench-side"><p class="eyebrow">01 · ROUTE</p><h2>제품까지 공정 순서</h2><p class="muted" style="font-size:11px;line-height:1.5;margin:0">공정 카드를 눌러 해당 단계 편집으로 이동합니다. 번호는 계산된 시작 시각 순입니다.</p><div class="fw-summary"><div class="fw-metric">공정<b>${plan.processes.length}</b></div><div class="fw-metric">품목<b>${itemCount}</b></div><div class="fw-metric">입출력 연결<b>${linkedCount}/${plan.processes.length}</b></div><div class="fw-metric">목표 완제품<b>${review.finishItems.length ? (review.targetValid ? '선택됨' : '자동 후보') : '미등록'}</b></div></div><div class="fw-process-list">${processRows || '<div class="fw-empty">공정을 추가하면 순서가 표시됩니다.</div>'}</div><button type="button" data-fw-action="open-process" style="margin-top:10px">공정·운송 상세 입력 ↓</button></aside><main class="flow-workbench-main">${baseHtml}</main><aside class="flow-workbench-side"><p class="eyebrow">02 · PLAN CHECK</p><h2>빠진 연결 점검</h2><p class="muted" style="font-size:11px;line-height:1.5;margin:0">현재 저장 계획에 있는 값을 검사합니다. 권장 설비나 인프라를 AI가 생성한 결과는 아닙니다.</p><div class="fw-audit-list">${recommendationCards}</div><div class="fw-ai-note"><b>자동 추천 상태</b><br>공정·설비·품목·운송의 데이터 기반 누락 확인만 표시합니다. 외부 카탈로그 검색, 배관/유틸리티 자동 추천, AI 호출은 연결되지 않았습니다.</div><button type="button" data-fw-action="open-run" style="margin-top:10px">현재 계획 3D 실행 화면 →</button></aside></section>`;
  }

  function openTab(name) {
    const button = [...document.querySelectorAll('[data-tab]')].find(node => node.dataset.tab === name);
    button?.click();
  }

  function install() {
    const bridge = window.P006WorkspaceFlowBridge;
    if (!bridge?.getProcessJourneyPanel || !bridge?.setProcessJourneyPanel || window.__p006FlowWorkbenchInstalled) return false;
    const base = bridge.getProcessJourneyPanel();
    const wrapped = function () { return compose(base(), bridge); };
    bridge.setProcessJourneyPanel(wrapped);
    window.__p006FlowWorkbenchInstalled = true;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = css;
      document.head.append(style);
    }

    const originalHelp = bridge.getHelp?.();
    if (originalHelp && bridge.setHelp) {
      bridge.setHelp(function () {
        originalHelp();
        const content = document.querySelector('#help-body, #drawer-body, .help-content');
        if (content && !content.querySelector('[data-flow-workbench-help]')) content.insertAdjacentHTML('afterbegin', '<div data-flow-workbench-help class="notice"><b>공정 흐름 작업대</b> · 상단에서 완제품을 선택하고, 왼쪽 순서 목록에서 단계를 편집합니다. 오른쪽은 현재 계획 데이터만으로 미연결 항목을 점검하며 자동 설비·배관 추천은 수행하지 않습니다.</div>');
      });
    }

    document.addEventListener('change', event => {
      const select = event.target.closest('[data-fw-target-product]');
      if (!select) return;
      const plan = bridge.getPlan();
      bridge.checkpoint();
      plan.flowTargetProductId = select.value || '';
      bridge.mark();
      bridge.render();
    });

    document.addEventListener('click', event => {
      const action = event.target.closest('[data-fw-action]');
      if (!action) return;
      const name = action.dataset.fwAction;
      if (name === 'focus-process') {
        document.querySelector(`[data-action="focus-journey-process"][data-process-index="${action.dataset.processIndex}"]`)?.click();
        return;
      }
      if (name === 'open-process') {
        document.querySelector('#process-order-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (name === 'open-flow') {
        document.querySelector('#process-flow-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (name === 'open-transport') {
        document.querySelector('#process-transport-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (name === 'open-layout') { openTab('layout'); return; }
      if (name === 'open-product') { openTab('product'); return; }
      if (name === 'open-run') { openTab('run'); return; }
    });

    // The app's original module can render before this additive module finishes loading.
    // Re-render only when this route is already showing the process tab.
    if (document.querySelector('[data-tab].active')?.dataset.tab === 'process') bridge.render();

    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 100) window.clearInterval(timer);
  }, 50);
  install();
})();
