// Operational evidence belongs in QA, never in the end-user workflow guide.
(() => {
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.style.cssText = 'padding:20px;margin:18px 0';
  panel.innerHTML = '<h2>녹화·테스트 실행 상태</h2><p>개발·QA 참고 정보입니다. 업무 처리 결과나 인증서 진위 판정이 아닙니다. 정기 자동 실행은 중지되어 있으며 수동 실행 결과를 표시합니다.</p><dl id="recorder-status-details"></dl><p>PARTIAL은 일부 미검증, 연속 실패는 녹화 작업 실패 횟수, 미확인 건수는 감사 확인 대기 건수입니다.</p>';
  const wrap = document.querySelector('.wrap') || document.body;
  const header = wrap.querySelector('header');
  if (header) header.after(panel); else wrap.prepend(panel);
  const details = panel.querySelector('dl');
  async function load() {
    try {
      const response = await fetch('/qa/process-preview-recorder-status.json', {cache:'no-store'});
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error('상태 JSON 조회 실패');
      const value = await response.json();
      details.replaceChildren();
      for (const [label, text] of [['상태',value.status],['설명',value.reason],['최종 실행',value.updatedAt],['소요 시간(ms)',value.durationMs],['연속 실패',value.consecutiveFailures]]) {
        const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(text ?? '정보 없음');details.append(dt,dd);
      }
    } catch(error) { details.textContent = '조회 실패: '+error.message; }
  }
  load();
})();
