(() => {
  'use strict';
  const API = '/projects/P006/registry-api/production-plans';
  const bar = document.querySelector('.server-plan-bar');
  const select = document.getElementById('server-plan-select');
  if (!bar || !select || document.getElementById('migration-preview-button')) return;

  const style = document.createElement('style');
  style.textContent = `
    .migration-preview-panel{display:none;flex-basis:100%;margin-top:4px;padding:16px;border:1px solid #b8d5df;border-radius:8px;background:#f5fafb;color:#17324a}
    .migration-preview-panel[data-open="true"]{display:block}
    .migration-preview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
    .migration-preview-head h2{font-size:16px;margin:0 0 5px}
    .migration-preview-head p,.migration-preview-note{font-size:12px;line-height:1.6;color:#536d80;margin:0}
    .migration-preview-counts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
    .migration-preview-counts span{padding:6px 9px;border-radius:6px;background:#e6f0f3;font-size:12px}
    .migration-preview-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .migration-preview-columns section{min-width:0;padding:12px;border:1px solid #d5e2e8;border-radius:7px;background:#fff}
    .migration-preview-columns h3{font-size:13px;margin:0 0 8px}
    .migration-preview-list{margin:0;padding-left:19px;font-size:12px;line-height:1.65;overflow-wrap:anywhere}
    .migration-preview-problems{margin-top:12px;padding:10px;border-left:3px solid #d39125;background:#fff8e9;font-size:12px;line-height:1.6}
    .migration-preview-problems[data-errors="true"]{border-color:#b74740;background:#fff2f0}
    @media(max-width:760px){.migration-preview-columns{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const button = document.createElement('button');
  button.id = 'migration-preview-button';
  button.type = 'button';
  button.textContent = '이관 미리보기';
  button.setAttribute('aria-controls', 'migration-preview-panel');
  button.setAttribute('aria-expanded', 'false');
  const actions = bar.querySelector('.actions');
  actions?.insertBefore(button, actions.querySelector('[data-action="save-server-plan"]'));

  const panel = document.createElement('section');
  panel.id = 'migration-preview-panel';
  panel.className = 'migration-preview-panel';
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-label', '레거시 계획 이관 미리보기');
  panel.innerHTML = '<div class="migration-preview-head"><div><h2>레거시 계획 → 품목·공정 흐름 v2</h2><p>현재 서버 계획을 읽기 전용으로 변환해 구조와 미확정 항목을 확인합니다. 원본은 변경하지 않습니다.</p></div><span class="migration-preview-note">미리보기 전용 · 저장/적용 없음</span></div><p data-migration-status class="migration-preview-note" style="margin-top:10px">서버 계획을 선택하고 미리보기를 실행하세요.</p><div data-migration-result></div>';
  bar.append(panel);
  const status = panel.querySelector('[data-migration-status]');
  const resultHost = panel.querySelector('[data-migration-result]');
  let busy = false;

  function safe(value) {
    const node = document.createElement('span');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  }
  function showFailure(message) {
    status.textContent = message;
    status.dataset.state = 'error';
    resultHost.replaceChildren();
  }
  function renderPreview(data) {
    const counts = data.counts || {};
    const items = data.previewPlan?.items || [];
    const stages = data.previewPlan?.processGraph?.stages || [];
    const itemRows = items.length ? items.map(row => `<li><b>${safe(row.name)}</b> · ${safe(row.kind)} · ${safe(row.unit)}${row.plannedQuantity == null ? ' · 수량 미확인' : ` · ${safe(row.plannedQuantity)} ${safe(row.unit)}`} · 자산 미연결</li>`).join('') : '<li>변환 대상 품목이 없습니다.</li>';
    const stageRows = stages.length ? stages.map(row => `<li><b>${safe(row.sequence + 1)}. ${safe(row.name)}</b> · 설비 ${safe(row.equipmentInstanceIds?.join(', ') || '미연결')} · ${row.duration?.value == null ? '시간 미확인' : `${safe(row.duration.value)}분(기준 미확인)`} · 선행 ${safe(row.predecessorIds?.map(id => stages.find(s => s.id === id)?.name || id).join(', ') || '없음')}</li>`).join('') : '<li>변환 대상 공정이 없습니다.</li>';
    const conflictRows = (data.conflicts || []).map(row => `<li><b>${safe(row.code)}</b> · ${safe(row.path)} · ${safe(row.message)}</li>`).join('');
    const warningRows = (data.warnings || []).map(row => `<li>${safe(row)}</li>`).join('');
    resultHost.innerHTML = `<div class="migration-preview-counts"><span>상태: ${safe(data.status)}</span><span>원본 ${safe(counts.legacyParts || 0)} 품목 → 미리보기 ${safe(counts.previewItems || 0)}</span><span>원본 ${safe(counts.legacyProcesses || 0)} 공정 → 미리보기 ${safe(counts.previewStages || 0)}</span><span>충돌 ${safe(counts.conflicts || 0)} · 안내 ${safe(counts.warnings || 0)}</span></div><div class="migration-preview-columns"><section><h3>품목 매핑 결과</h3><ul class="migration-preview-list">${itemRows}</ul></section><section><h3>공정 단계 매핑 결과</h3><ul class="migration-preview-list">${stageRows}</ul></section></div><div class="migration-preview-problems" data-errors="${conflictRows ? 'true' : 'false'}"><b>${conflictRows ? '검토 충돌' : '미확정·주의 사항'}</b><ul class="migration-preview-list">${conflictRows || warningRows || '<li>확인할 항목이 없습니다.</li>'}</ul>${conflictRows && warningRows ? `<b>주의</b><ul class="migration-preview-list">${warningRows}</ul>` : ''}</div><p class="migration-preview-note" style="margin-top:10px">품목 종류, 공정 투입·산출, 자산 연결은 원본에 근거가 없는 경우 자동으로 만들지 않았습니다. SHA-256 원본 지문: ${safe(data.sourceHash || '미제공')}</p>`;
  }

  button.addEventListener('click', async () => {
    const open = panel.dataset.open !== 'true';
    panel.dataset.open = String(open);
    button.setAttribute('aria-expanded', String(open));
    if (!open || busy) return;
    const id = select.value;
    if (!id) return showFailure('먼저 로그인 계정 서버 계획을 선택하세요.');
    busy = true;
    button.disabled = true;
    status.textContent = '서버 계획 버전 확인 중…';
    status.dataset.state = 'loading';
    resultHost.replaceChildren();
    try {
      const headers = { Accept: 'application/json', 'X-P006-Requested-With': 'equipment-registry' };
      const read = await fetch(`${API}/${encodeURIComponent(id)}`, { credentials: 'same-origin', headers });
      const source = await read.json().catch(() => ({}));
      if (!read.ok) throw new Error(read.status === 401 ? '로그인이 만료됐습니다. 로그인한 뒤 다시 시도하세요.' : source.error || `서버 계획 조회 실패 (${read.status})`);
      if (!source.plan || source.plan.id !== id || !Number.isInteger(source.version)) throw new Error('서버 계획 또는 버전 정보를 확인할 수 없습니다.');
      status.textContent = `원본 계획 v${source.version} 확인 · 미리보기 변환 요청 중…`;
      const response = await fetch(`${API}/${encodeURIComponent(id)}/migration-preview`, {
        method: 'POST', credentials: 'same-origin', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseVersion: source.version })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) throw new Error('미리보기 도중 서버 계획이 바뀌었습니다. 서버 목록을 새로고침한 뒤 다시 하세요.');
      if (!response.ok) throw new Error(response.status === 401 ? '로그인이 만료됐습니다. 로그인한 뒤 다시 시도하세요.' : data.error || `변환 미리보기 실패 (${response.status})`);
      renderPreview(data);
      status.textContent = `완료 · ${data.status} · 서버 계획 v${data.serverVersion} · 원본은 그대로 보존됨`;
      status.dataset.state = data.status === 'NEEDS_REVIEW' ? 'error' : 'ok';
    } catch (error) {
      showFailure(error.message || '변환 미리보기를 완료하지 못했습니다.');
    } finally {
      busy = false;
      button.disabled = false;
    }
  });
})();
