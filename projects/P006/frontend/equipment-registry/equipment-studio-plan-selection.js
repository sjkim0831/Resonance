(() => {
  'use strict';

  const PLAN_KEY = 'p006-product-plans-v1';
  const CONTEXT_KEY = 'p006-studio-process-selection';
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const planSelect = $('#studioPlanSelect');
  if (!planSelect) return;
  const processSelect = $('#studioProcessSelect');
  const status = $('#studioPlanStatus');

  function readStore() {
    try {
      const store = JSON.parse(localStorage.getItem(PLAN_KEY) || '{}');
      return store && Array.isArray(store.plans) ? store : { plans: [], activeId: '' };
    } catch {
      return { plans: [], activeId: '' };
    }
  }

  function handoff() {
    try {
      const token = new URLSearchParams(location.search).get('handoff');
      return token ? JSON.parse(localStorage.getItem(`p006-studio-handoff:${token}`) || 'null') : null;
    } catch {
      return null;
    }
  }

  function planById(id) {
    return readStore().plans.find((plan) => String(plan.id) === String(id));
  }

  function showStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
    status.setAttribute('role', error ? 'alert' : 'status');
  }

  function selectedProcess() {
    const plan = planById(planSelect.value);
    const process = plan?.processes?.find((item) => String(item.id) === String(processSelect.value));
    return { plan, process };
  }

  function publishContext() {
    const { plan, process } = selectedProcess();
    if (!plan || !process) {
      window.P006_STUDIO_PROCESS_CONTEXT = null;
      document.dispatchEvent(new CustomEvent('p006:studio-process-context', { detail: null }));
      $('#studioAssignment').innerHTML = '<b>공정을 선택하세요</b><span>제품 계획의 공정이 AI 설비 작업 대상이 됩니다. 공정·모델 정보를 임의로 수정하지 않습니다.</span>';
      $('#studioAssignment').innerHTML = '<b>공정 선택</b><span>제품 계획에서 공정을 선택하면 해당 설비와 썸네일이 왼쪽 목록에 표시됩니다.</span>';
      document.querySelectorAll('#equipmentList [data-library-kind="process"]').forEach((card) => card.classList.remove('context-selected'));
      showStatus(plan ? '공정 선택만 대상 지정에 사용됩니다. 설비·제품 계획에는 변경 사항을 저장하지 않습니다.' : '저장 계획이 없습니다. Product Planner에서 제품과 공정을 먼저 저장하세요.');
      return;
    }

    const model = window.P006_STUDIO_RESOLVE_PROCESS?.(plan.id, process.id) || process.equipmentModel || {};
    const context = {
      planId: plan.id,
      productName: plan.productName || plan.name || plan.id,
      processId: process.id,
      processName: process.name || process.id,
      processKind: process.kind || '',
      equipmentId: model.equipmentInstanceId || model.equipmentId || null,
      equipmentName: model.equipmentName || '',
      manufacturerName: model.manufacturerName || model.manufacturer || '',
      modelName: model.modelName || model.model || '',
      assetId: model.assetId || null,
      glbPath: model.glbPath || null,
      usdPath: model.usdPath || null,
      reviewStatus: model.reviewStatus || (model.previewOnly ? 'REFERENCE_MODEL' : 'UNASSIGNED'),
      previewOnly: !!model.previewOnly
    };
    window.P006_STUDIO_PROCESS_CONTEXT = context;
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({ planId: plan.id, processId: process.id }));
    document.dispatchEvent(new CustomEvent('p006:studio-process-context', { detail: context }));

    const hasEquipment = !!(context.equipmentName || context.equipmentId || context.assetId);
    const modelSummary = hasEquipment
      ? `<span>${context.previewOnly?'전체 3D 참고 설비':'연결 설비'}: ${esc(context.equipmentName || context.assetId || context.equipmentId)} · ${esc(context.manufacturerName || '제조사 미확인')} ${esc(context.modelName)}</span><small>${esc(context.assetId ? `Asset ${context.assetId}` : 'Asset 미연결')} · ${esc(context.glbPath ? '3D 경로 등록됨' : '3D 경로 미등록')} · ${esc(context.previewOnly?'참고 모델 · 공정 배정 전':context.reviewStatus)}</small>`
      : '<span>설비 미배정 · 연결된 설비 모델 없음</span><small>썸네일을 임의로 만들거나 다른 설비를 대신 표시하지 않습니다. 이 공정을 AI 자료 조사·신규 설비 제작 대상으로 선택했습니다.</small>';
    $('#studioAssignment').innerHTML = `<b>${esc(context.productName)} / ${esc(context.processName)}</b>${modelSummary}`;
    document.querySelectorAll('#equipmentList [data-library-kind="process"]').forEach((card) => {
      card.classList.toggle('context-selected', String(card.dataset.libraryId) === String(context.processId));
    });
    showStatus(hasEquipment
      ? '선택 공정의 기존 설비를 AI 작업 대상으로 지정했습니다. 공정 연결 정보는 변경하지 않았습니다.'
      : '미배정 공정을 AI 작업 대상으로 지정했습니다. 제품 계획은 수정하지 않았습니다.');
  }

  function renderProcesses(keepId = '') {
    const plan = planById(planSelect.value);
    if (!plan) {
      processSelect.innerHTML = '<option value="">제품 계획을 먼저 선택하세요</option>';
      document.dispatchEvent(new CustomEvent('p006:studio-plan-selection-change', { detail: null }));
      publishContext();
      return;
    }
    const processes = (plan.processes || []).filter((process) => process.kind !== 'DISPATCH');
    processSelect.innerHTML = '<option value="">전체 공정</option>' + processes.map((process) =>
      `<option value="${esc(process.id)}">${esc(process.name || process.id)}</option>`).join('');
    processSelect.value = processes.some((process) => String(process.id) === String(keepId)) ? keepId : '';
    document.dispatchEvent(new CustomEvent('p006:studio-plan-selection-change', { detail: { planId: plan.id } }));
    publishContext();
  }

  function renderPlans(keepPlan = '', keepProcess = '') {
    const store = readStore();
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || '{}'); } catch { return {}; } })();
    const fromHandoff = handoff();
    const plans = store.plans.filter((plan) => Array.isArray(plan.processes));
    planSelect.innerHTML = '<option value="">제품 계획을 선택하세요</option>' + plans.map((plan) =>
      `<option value="${esc(plan.id)}">${esc(plan.productName || plan.name || '이름 없는 제품')} · ${esc(plan.id)}</option>`).join('');
    const desiredPlan = keepPlan || fromHandoff?.planId || saved.planId || store.activeId || '';
    const selectedPlan = plans.some((plan) => String(plan.id) === String(desiredPlan)) ? desiredPlan : '';
    planSelect.value = selectedPlan;
    const desiredProcess = keepProcess || fromHandoff?.processId || saved.processId || '';
    renderProcesses(desiredProcess);
    if (!plans.length) showStatus('같은 브라우저·프로필에 저장된 제품 계획이 없습니다. Product Planner에서 계획을 저장한 뒤 다시 불러오세요.');
  }

  planSelect.addEventListener('change', () => {
    sessionStorage.removeItem(CONTEXT_KEY);
    renderProcesses();
  });
  processSelect.addEventListener('change', publishContext);
  document.addEventListener('p006:studio-models-ready', publishContext);
  $('#reloadStudioPlans').addEventListener('click', () => renderPlans(planSelect.value, processSelect.value));
  window.addEventListener('storage', (event) => { if (!event.key || event.key === PLAN_KEY) renderPlans(planSelect.value, processSelect.value); });
  document.addEventListener('click', (event) => {
    const card = event.target.closest('#equipmentList [data-library-kind="process"]');
    if (!card) return;
    const plan = planById(planSelect.value);
    if (!plan || !plan.processes?.some((process) => String(process.id) === String(card.dataset.libraryId))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    processSelect.value = card.dataset.libraryId;
    publishContext();
  }, true);

  renderPlans();
})();
