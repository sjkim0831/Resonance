/* Additive, backwards-compatible quantity details for process material flows. */
(() => {
  const bridge = window.P006WorkspaceFlowBridge;
  if (!bridge) throw new Error('P006 workspace flow bridge is missing');
  const getPlan = () => bridge.getPlan();
  const esc = bridge.esc;
  const uid = bridge.uid;
  const roles = {
    inputIds: { key: 'inputs', label: '투입' },
    outputIds: { key: 'outputs', label: '산출' },
    byproductIds: { key: 'byproducts', label: '부산물' }
  };
  const basisOptions = [
    ['UNKNOWN', '기준 미확정'],
    ['PER_UNIT', '제품 1개당'],
    ['PER_BATCH', '배치당']
  ];
  const provenanceOptions = [
    ['UNKNOWN', '근거 미확인'],
    ['ESTIMATED', '추정값']
  ];

  function specFor(row, role, itemId) {
    const group = roles[role]?.key;
    return group ? row?.flowSpecs?.[group]?.find(flow => flow.itemId === itemId) : null;
  }

  function defaultSpec(itemId) {
    const item = getPlan().parts.find(part => part.id === itemId);
    return {
      id: `FLOW-${uid()}`,
      itemId,
      quantityPerCycle: null,
      quantityBasis: 'UNKNOWN',
      unit: item?.unit || '개',
      provenance: { status: 'UNKNOWN', note: '' }
    };
  }

  function syncSpecs(row) {
    row.flowSpecs ||= {};
    for (const [legacyKey, role] of Object.entries(roles)) {
      const group = role.key;
      const ids = row[legacyKey] || [];
      const byItem = new Map((row.flowSpecs[group] || []).map(flow => [flow.itemId, flow]));
      row.flowSpecs[group] = ids.map(itemId => byItem.get(itemId) || defaultSpec(itemId));
    }
  }

  function specFields(index, role, item, flow) {
    const basis = flow.quantityBasis || 'UNKNOWN';
    const provenance = flow.provenance?.status || 'UNKNOWN';
    return `<div class="flow-quantity-grid" aria-label="${roles[role].label} 수량 명세">
      <label>수량 / 공정 1회<input type="number" min="0.000001" step="any" inputmode="decimal" placeholder="미입력" value="${flow.quantityPerCycle ?? ''}" data-flow-value="quantityPerCycle" data-flow-role="${role}" data-flow-process-index="${index}" data-flow-item-id="${esc(item.id)}"></label>
      <label>산정 기준<select data-flow-value="quantityBasis" data-flow-role="${role}" data-flow-process-index="${index}" data-flow-item-id="${esc(item.id)}">${basisOptions.map(([value, label]) => `<option value="${value}" ${basis === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>단위<input type="text" maxlength="40" value="${esc(flow.unit || item.unit || '개')}" data-flow-value="unit" data-flow-role="${role}" data-flow-process-index="${index}" data-flow-item-id="${esc(item.id)}"></label>
      <label>근거 상태<select data-flow-value="provenance.status" data-flow-role="${role}" data-flow-process-index="${index}" data-flow-item-id="${esc(item.id)}">${provenanceOptions.map(([value, label]) => `<option value="${value}" ${provenance === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="flow-note">메모 / 근거 설명<input type="text" maxlength="500" placeholder="출처·실측 확인 전이면 비워두세요" value="${esc(flow.provenance?.note || '')}" data-flow-value="provenance.note" data-flow-role="${role}" data-flow-process-index="${index}" data-flow-item-id="${esc(item.id)}"></label>
      <small>계획값입니다. 확인 전 수량은 검증값으로 취급하지 않습니다.</small>
    </div>`;
  }

  bridge.setFlowChecklist(function(index, key, title) {
    const p = getPlan();
    const row = p.processes[index];
    const selected = new Set(row[key] || []);
    return `<section class="flow-group"><h4>${title}</h4>${p.parts.map(item => {
      const flow = specFor(row, key, item.id);
      return `<div class="flow-choice-wrap"><label class="flow-choice"><input type="checkbox" data-flow-toggle="${key}" data-process-index="${index}" data-item-id="${esc(item.id)}" ${selected.has(item.id) ? 'checked' : ''}><span>${esc(item.name)}<small>${esc(item.kind || '부품')} · 카탈로그 기본 ${esc(item.quantity || 1)} ${esc(item.unit || '개')} · ${item.model ? '3D 경로 연결' : '3D 자산 미연결'}</small></span></label>${selected.has(item.id) ? specFields(index, key, item, flow || defaultSpec(item.id)) : ''}</div>`;
    }).join('') || '<small>품목을 먼저 등록하세요.</small>'}</section>`;
  });

  const originalProcessFlowPanel = bridge.getProcessFlowPanel();
  bridge.setProcessFlowPanel(function() {
    const p = getPlan();
    const selected = p.processes.flatMap(row => Object.entries(roles).flatMap(([legacyKey, role]) =>
      (row[legacyKey] || []).map(itemId => ({ row, role, itemId }))));
    const missingQuantity = selected.filter(({ row, role, itemId }) => specFor(row, Object.keys(roles).find(key => roles[key] === role), itemId)?.quantityPerCycle == null).length;
    const unknownBasis = selected.filter(({ row, role, itemId }) => !specFor(row, Object.keys(roles).find(key => roles[key] === role), itemId)?.quantityBasis || specFor(row, Object.keys(roles).find(key => roles[key] === role), itemId)?.quantityBasis === 'UNKNOWN').length;
    const unknownEvidence = selected.filter(({ row, role, itemId }) => (specFor(row, Object.keys(roles).find(key => roles[key] === role), itemId)?.provenance?.status || 'UNKNOWN') === 'UNKNOWN').length;
    const analysis = analyze(p);
    const note = `<div class="notice flow-quantity-summary"><b>수량 명세 상태</b> · 연결 ${selected.length}건 · 수량 미입력 ${missingQuantity}건 · 기준 미확정 ${unknownBasis}건 · 근거 미확인 ${unknownEvidence}건<br><small>계획 수량 계산만 표시합니다. 수율·스크랩·단위 변환·실행 재고에는 반영하지 않습니다.</small></div>`;
    return originalProcessFlowPanel().replace('<div class="notice flow-alert">', note + '<div class="notice flow-alert">') + calculationPanel(p, analysis);
  });

  function finitePositive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
  function allFlows(row, plan) {
    return Object.entries(roles).flatMap(([legacyKey, role]) => (row[legacyKey] || []).map(itemId => ({
      role: legacyKey,
      itemId,
      spec: specFor(row, legacyKey, itemId),
      item: plan.parts.find(part => part.id === itemId)
    })));
  }
  function calculateFlow(flow, plan) {
    const spec = flow.spec;
    if (!spec || !finitePositive(spec.quantityPerCycle)) return { ...flow, state: 'MISSING_QUANTITY' };
    const basis = spec.quantityBasis || 'UNKNOWN';
    let multiplier;
    if (basis === 'PER_UNIT') multiplier = Number(plan.quantity);
    else if (basis === 'PER_BATCH') multiplier = Number(plan.batchCount);
    else return { ...flow, state: 'UNKNOWN_BASIS' };
    if (!finitePositive(multiplier) || (basis === 'PER_BATCH' && !Number.isInteger(multiplier))) return { ...flow, state: basis === 'PER_BATCH' ? 'MISSING_BATCH_COUNT' : 'MISSING_PLAN_QUANTITY' };
    return { ...flow, state: 'CALCULATED', total: Number(spec.quantityPerCycle) * multiplier, multiplier, unit: (spec.unit || flow.item?.unit || '').trim(), basis };
  }
  function analyze(plan) {
    const flowRows = plan.processes.flatMap((process, processIndex) => allFlows(process, plan).map(flow => ({
      processId: process.id, processName: process.name || `공정 ${processIndex + 1}`, processIndex, ...calculateFlow(flow, plan)
    })));
    const comparisons = [];
    const predecessorIds = process => [...new Set(String(process.predecessor || '').split(',').map(value => value.trim()).filter(Boolean))];
    const inputsFor = (processId, itemId) => flowRows.filter(flow => flow.processId === processId && flow.role === 'inputIds' && flow.itemId === itemId);
    const outputsFor = (processId, itemId) => flowRows.filter(flow => flow.processId === processId && flow.role === 'outputIds' && flow.itemId === itemId);
    const successorsFor = (processId, itemId) => plan.processes.filter(process => predecessorIds(process).includes(processId) && inputsFor(process.id, itemId).length);
    const compareSet = ({ upstream, downstream, item, scope, producedFlows, requiredFlows, reason }) => {
      const base = { upstream, downstream, item, scope };
      if (reason || !producedFlows.length || !requiredFlows.length || [...producedFlows, ...requiredFlows].some(flow => flow.state !== 'CALCULATED')) {
        comparisons.push({ ...base, state: 'WAIT', reason: reason || '수량·기준·배치 수 확인 필요' });
        return;
      }
      const units = new Set([...producedFlows.map(flow => flow.unit), ...requiredFlows.map(flow => flow.unit)]);
      if (units.size !== 1 || units.has('')) {
        comparisons.push({ ...base, state: 'UNIT_MISMATCH', producedUnit: [...new Set(producedFlows.map(flow => flow.unit || '미입력'))].join(', '), requiredUnit: [...new Set(requiredFlows.map(flow => flow.unit || '미입력'))].join(', ') });
        return;
      }
      const produced = producedFlows.reduce((sum, flow) => sum + flow.total, 0);
      const required = requiredFlows.reduce((sum, flow) => sum + flow.total, 0);
      const delta = produced - required;
      const epsilon = Math.max(1, Math.abs(produced), Math.abs(required)) * 1e-9;
      comparisons.push({ ...base, state: Math.abs(delta) <= epsilon ? 'BALANCED' : delta < 0 ? 'SHORTAGE' : 'SURPLUS', produced, required, unit: [...units][0], delta });
    };
    const handledBranches = new Set();
    for (const downstream of plan.processes) {
      const upstreams = predecessorIds(downstream).map(id => plan.processes.find(process => process.id === id)).filter(Boolean);
      const downstreamInputs = flowRows.filter(flow => flow.processId === downstream.id && flow.role === 'inputIds');
      for (const itemId of new Set(downstreamInputs.map(flow => flow.itemId))) {
        const requiredFlows = inputsFor(downstream.id, itemId);
        if (!requiredFlows.length) continue;
        const supplyingProcesses = upstreams.filter(process => outputsFor(process.id, itemId).length);
        if (!supplyingProcesses.length) continue;
        const producedFlows = supplyingProcesses.flatMap(process => outputsFor(process.id, itemId));
        const itemName = producedFlows[0]?.item?.name || requiredFlows[0]?.item?.name || itemId;
        if (supplyingProcesses.length > 1) {
          const hasOverlappingBranches = supplyingProcesses.some(process => successorsFor(process.id, itemId).length > 1);
          compareSet({ upstream: supplyingProcesses.map(process => process.name).join(' + '), downstream: downstream.name, item: itemName, scope: 'MERGE', producedFlows, requiredFlows,
            reason: hasOverlappingBranches ? '분기와 합류가 겹쳐 경로별 배분 규칙 필요' : '' });
          continue;
        }
        const upstream = supplyingProcesses[0];
        const branchKey = `${upstream.id}\u0000${itemId}`;
        if (handledBranches.has(branchKey)) continue;
        const consumers = successorsFor(upstream.id, itemId);
        if (consumers.length > 1) {
          handledBranches.add(branchKey);
          const overlappingMerge = consumers.some(consumer => predecessorIds(consumer).filter(id => outputsFor(id, itemId).length).length > 1);
          compareSet({ upstream: upstream.name, downstream: consumers.map(process => process.name).join(' + '), item: itemName, scope: 'BRANCH', producedFlows: outputsFor(upstream.id, itemId),
            requiredFlows: consumers.flatMap(process => inputsFor(process.id, itemId)), reason: overlappingMerge ? '분기 경로에 복수 공급 공정이 있어 경로별 배분 규칙 필요' : '' });
        } else {
          compareSet({ upstream: upstream.name, downstream: downstream.name, item: itemName, scope: 'EDGE', producedFlows, requiredFlows });
        }
      }
    }
    return { flowRows, comparisons };
  }
  function calculationPanel(plan, analysis) {
    const calculated = analysis.flowRows.filter(flow => flow.state === 'CALCULATED').length;
    const waiting = analysis.flowRows.length - calculated;
    const labels = { MISSING_QUANTITY: '수량 미입력', UNKNOWN_BASIS: '기준 미확정', MISSING_BATCH_COUNT: '배치 수 미입력', MISSING_PLAN_QUANTITY: '생산 수량 미입력' };
    const comparisonLabel = { BALANCED: '일치', SHORTAGE: '후행 공정 투입 부족', SURPLUS: '후행 공정 투입보다 많음', UNIT_MISMATCH: '단위 불일치', WAIT: '계산 대기' };
    const rows = analysis.flowRows.map(flow => `<tr><td>${esc(flow.processName)}</td><td>${esc(roles[flow.role]?.label || flow.role)}</td><td>${esc(flow.item?.name || flow.itemId)}</td><td>${flow.state === 'CALCULATED' ? `${esc(flow.spec.quantityPerCycle)} ${esc(flow.unit)} × ${esc(flow.multiplier)} = <b>${esc(flow.total)}</b> ${esc(flow.unit)} <span class="badge ${flow.spec.provenance?.status === 'ESTIMATED' ? 'warn' : ''}">${flow.spec.provenance?.status === 'UNKNOWN' ? '근거 미확인' : flow.spec.provenance?.status === 'ESTIMATED' ? '추정값' : '확인 상태 별도'}</span>` : `<span class="badge warn">${labels[flow.state] || '확인 필요'}</span>`}</td></tr>`).join('');
    const checks = analysis.comparisons.map(check => `<li class="flow-balance ${check.state.toLowerCase()} ${check.scope.toLowerCase()}"><b>${esc(check.upstream)} → ${esc(check.downstream)}</b> <span class="flow-scope">${check.scope === 'BRANCH' ? '분기 총량' : check.scope === 'MERGE' ? '합류 총량' : '직접 연결'}</span> · ${esc(check.item)} · ${comparisonLabel[check.state]}${check.state === 'WAIT' ? ` · ${esc(check.reason)}` : ` · ${esc(check.produced)} ${esc(check.producedUnit || check.unit)} 생산 / ${esc(check.required)} ${esc(check.requiredUnit || check.unit)} 투입`}</li>`).join('');
    return `<section class="panel flow-calculation" id="flow-calculation-panel"><div class="panel-head"><div><p class="eyebrow">PLAN QUANTITY CHECK · 계산 전용</p><h2>공정별 계획 소요량 · 흐름 검증</h2><small>수율·스크랩·손실을 가정하지 않는 단순 수량 계산입니다.</small></div><span class="badge">계산 ${calculated} · 대기 ${waiting}</span></div><div class="flow-batch-setting"><label>계획 배치 수<input type="number" min="1" step="1" inputmode="numeric" value="${plan.batchCount ?? ''}" placeholder="배치 기준 흐름이 있으면 입력" data-flow-batch-count></label><span>‘배치당’ 수량을 총량으로 환산할 때만 사용합니다. 제품 생산 개수에서 배치 수를 추정하지 않습니다.</span></div>${analysis.flowRows.length ? `<div class="flow-table-wrap"><table class="flow-calc-table"><thead><tr><th>공정</th><th>역할</th><th>품목</th><th>계획 계산식 · 결과</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">계산할 투입·산출·부산물 연결이 없습니다.</div>'}<h3>선행 산출 ↔ 후행 투입 대조</h3>${checks ? `<ul class="flow-balance-list">${checks}</ul>` : '<p class="muted">직접 연결된 선행·후행 공정 간 동일 품목 대조가 없습니다. 먼저 품목과 공정 선행 관계를 연결하세요.</p>'}<div class="notice flow-calc-boundary"><b>검증 범위:</b> 단일 공급은 직접 대조하고, 한 공정 산출이 여러 공정으로 나뉘면 후행 투입을 합산해 분기 총량을 대조하며, 여러 선행 산출이 한 공정으로 모이면 공급량을 합산해 합류 총량을 대조합니다. 분기와 합류가 겹치는 경로는 배분 규칙이 정해질 때까지 계산 대기입니다. 운송 적재량·차량 용량·수율/스크랩은 별도 근거가 필요합니다. 근거 미확인·추정값은 별도 배지로 유지하며, 이 표는 실행 애니메이션 재고나 생산량을 변경하지 않습니다.</div></section>`;
  }

  const originalHelp = bridge.getHelp();
  bridge.setHelp(function() {
    originalHelp();
    document.querySelector('#drawer-body')?.insertAdjacentHTML('afterbegin', '<div class="notice flow-quantity-summary"><b>공정별 수량 입력·검증:</b> 품목을 투입/산출/부산물 목록에서 체크한 뒤 공정 1회 수량·단위·제품 1개당/배치당 기준을 입력합니다. 배치당 계산은 정수 배치 수를 직접 지정하세요. 동일 품목·단위의 직접 연결 공정만 대조하며, 근거가 없으면 미확인으로 남깁니다. 계산표는 계획 검증용이고 실행 애니메이션의 재고·생산량·수율에는 연결되지 않습니다.</div>');
  });

  const originalJourneyPills = bridge.getJourneyItemPills();
  let activeJourneyFlow = null;
  bridge.setJourneyItemPills(function(ids, empty) {
    const context = activeJourneyFlow?.shift();
    if (!context) return originalJourneyPills(ids, empty);
    const p = getPlan();
    const row = context.row;
    const specs = context.role ? row.flowSpecs?.[roles[context.role].key] || [] : [];
    const rows = (ids || []).map(id => ({ item: p.parts.find(item => item.id === id), flow: specs.find(spec => spec.itemId === id) })).filter(entry => entry.item);
    return rows.length ? `<div class="journey-pills">${rows.map(({ item, flow }) => {
      const quantity = flow?.quantityPerCycle;
      const basis = basisOptions.find(([value]) => value === (flow?.quantityBasis || 'UNKNOWN'))?.[1] || '기준 미확정';
      const provenance = provenanceOptions.find(([value]) => value === (flow?.provenance?.status || 'UNKNOWN'))?.[1] || '근거 미확인';
      return `<span class="journey-item">${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : '<i>3D</i>'}<b>${esc(item.name)}</b><small>${quantity == null ? '수량 미입력' : esc(quantity)} ${esc(flow?.unit || item.unit || '개')} · ${basis} · ${provenance}</small><small>${esc(item.kind || '품목')} · ${item.model ? 'GLB 경로 있음' : '모델 미연결'}</small></span>`;
    }).join('')}</div>` : `<div class="journey-empty">${empty}</div>`;
  });

  const originalProcessJourneyPanel = bridge.getProcessJourneyPanel();
  bridge.setProcessJourneyPanel(function() {
    const p = getPlan();
    const sc = bridge.schedule();
    const ordered = p.processes.map((row, index) => ({ row, index, timing: sc.processes[row.id] || { start: 0, end: 0 } }))
      .sort((a, b) => a.timing.start - b.timing.start || a.index - b.index);
    activeJourneyFlow = [];
    for (const { row } of ordered) {
      activeJourneyFlow.push({ row, role: 'inputIds' }, { row, role: 'outputIds' });
      if ((row.byproductIds || []).length) activeJourneyFlow.push({ row, role: 'byproductIds' });
    }
    try { return originalProcessJourneyPanel(); }
    finally { activeJourneyFlow = null; }
  });

  document.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('[data-flow-batch-count]')) {
      const p = getPlan();
      const value = target.value === '' ? null : Number(target.value);
      if (value !== null && (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0)) {
        target.setCustomValidity('1 이상의 정수 배치 수를 입력하거나 비워두세요.');
        target.reportValidity();
        return;
      }
      target.setCustomValidity('');
      bridge.checkpoint();
      p.batchCount = value;
      p.processFlowSpecVersion = 1;
      bridge.mark();
      bridge.render();
      return;
    }
    if (target.matches('[data-flow-toggle]')) {
      const p = getPlan();
      const row = p.processes[Number(target.dataset.processIndex)];
      if (!row) return;
      // The existing listener has already synchronized legacy ID arrays. Keep their values intact.
      syncSpecs(row);
      p.processFlowSpecVersion = 1;
      bridge.mark();
      bridge.render();
      return;
    }
    if (!target.matches('[data-flow-value]')) return;
    const p = getPlan();
    const row = p.processes[Number(target.dataset.flowProcessIndex)];
    if (!row) return;
    const role = target.dataset.flowRole;
    if (!specFor(row, role, target.dataset.flowItemId)) syncSpecs(row);
    const flow = specFor(row, role, target.dataset.flowItemId);
    if (!flow) return;
    const path = target.dataset.flowValue;
    let value = target.value;
    if (path === 'quantityPerCycle') {
      if (value === '') value = null;
      else {
        value = Number(value);
        if (!Number.isFinite(value) || value <= 0) {
          target.setCustomValidity('0보다 큰 수량을 입력하거나 비워두세요.');
          target.reportValidity();
          return;
        }
        target.setCustomValidity('');
      }
    }
    bridge.checkpoint();
    if (path === 'provenance.status' || path === 'provenance.note') {
      flow.provenance ||= { status: 'UNKNOWN', note: '' };
      flow.provenance[path.split('.')[1]] = value;
    } else flow[path] = value;
    p.processFlowSpecVersion = 1;
    bridge.mark();
    bridge.render();
  }, true);

  const style = document.createElement('style');
  style.textContent = `.flow-choice-wrap{border:1px solid var(--line);border-radius:8px;padding:8px;margin:7px 0;background:#fff}.flow-choice-wrap .flow-choice{border:0;margin:0;padding:2px}.flow-quantity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:9px 0 0 26px;padding:9px;background:#f5f9fa;border-radius:6px}.flow-quantity-grid label{display:flex;flex-direction:column;gap:4px;font-size:11px;min-width:0}.flow-quantity-grid input,.flow-quantity-grid select{box-sizing:border-box;width:100%;min-width:0;padding:6px;border:1px solid var(--line);border-radius:5px;background:#fff;color:inherit}.flow-quantity-grid .flow-note{grid-column:1/-1}.flow-quantity-grid>small{grid-column:1/-1;color:var(--muted);line-height:1.45}.flow-quantity-summary{border-left:4px solid #c58a1b}.flow-quantity-summary small{display:block;margin-top:4px;line-height:1.5}.journey-item small{display:block;white-space:normal;overflow-wrap:anywhere}.flow-batch-setting{display:flex;align-items:end;gap:14px;padding:10px;background:#f2f7f8;border-radius:7px;margin:10px 0}.flow-batch-setting label{display:grid;gap:4px;font-size:11px;min-width:210px}.flow-batch-setting input{padding:7px;border:1px solid var(--line);border-radius:5px}.flow-batch-setting span,.flow-calc-boundary{font-size:11px;line-height:1.5;color:var(--muted)}.flow-table-wrap{overflow:auto}.flow-calc-table{width:100%;border-collapse:collapse;font-size:12px}.flow-calc-table th,.flow-calc-table td{text-align:left;padding:8px;border-bottom:1px solid var(--line);vertical-align:top}.flow-balance-list{list-style:none;padding:0;display:grid;gap:6px}.flow-balance{padding:9px;border:1px solid var(--line);border-radius:6px;font-size:12px}.flow-balance.balanced{border-color:#86c9a5;background:#eff9f2}.flow-balance.shortage,.flow-balance.unit_mismatch{border-color:#e49c79;background:#fff5ef}.flow-balance.surplus{border-color:#e7cf85;background:#fffaf0}.flow-calc-boundary{margin-top:12px}@media(max-width:700px){.flow-quantity-grid{grid-template-columns:1fr;margin-left:0}.flow-quantity-grid .flow-note,.flow-quantity-grid>small{grid-column:auto}.flow-batch-setting{align-items:stretch;flex-direction:column}.flow-batch-setting label{min-width:0}}`;
  style.textContent += '.flow-scope{display:inline-block;padding:2px 6px;border-radius:999px;background:#eaf3f5;color:#17666e;font-size:10px;font-weight:700;white-space:nowrap}';
  document.head.append(style);

  // Additive model stays beside legacy IDs so existing simulation consumers keep working.
  window.P006ProcessFlowQuantities = {
    version: 1,
    analyze,
    project(plan = getPlan()) {
      return plan.processes.map(row => ({
        processId: row.id,
        flows: Object.fromEntries(Object.entries(roles).map(([legacyKey, role]) => [
          role.key,
          (row.flowSpecs?.[role.key] || []).map(flow => ({ ...flow, quantityPerCycle: flow.quantityPerCycle ?? null,
            quantityBasis: flow.quantityBasis || 'UNKNOWN', unit: flow.unit || plan.parts.find(item => item.id === flow.itemId)?.unit || '개',
            provenance: { status: flow.provenance?.status || 'UNKNOWN', note: flow.provenance?.note || '' } }))
        ]))
      }));
    }
  };

  // Keep the global work matrix aligned with the implemented (and deliberately bounded) calculation scope.
  try {
    const quantityFeature = FEATURES.find(entry => entry.id === 'E-03');
    if (quantityFeature) quantityFeature.acceptance = 'PER_UNIT/PER_BATCH 총량 계산, 직접 연결은 단일 대조, 분기 소비량·합류 공급량 합산; 분기와 합류가 겹치는 경로는 배분 규칙 확정 전 대기. 수율·운송은 별도 계약';
  } catch (_) { /* Standalone embeds without the work-matrix shell remain supported. */ }

  bridge.render();
})();
