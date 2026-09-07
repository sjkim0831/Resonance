const streamStatusPath='/projects/P006/digital-twin/api/stream-operations-status';
const streamStatusTime=value=>value?new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value)):'없음';

function streamStatusCard(){
  const section=document.createElement('section');
  section.className='stream-operations-status';
  section.setAttribute('aria-label','Omniverse 스트림 운영 상태');
  section.innerHTML=`<header><div><span class="stream-eyebrow">SYSTEM · DIGITAL TWIN</span><h2>Omniverse 스트림 운영</h2><p>3개 RTX 슬롯과 30초 자동복구 상태입니다.</p></div><button type="button" data-stream-refresh>지금 새로고침</button></header><div class="stream-summary" role="status">상태를 확인하고 있습니다.</div><div class="stream-slot-grid"></div><footer><span data-stream-checked>최근 점검: -</span><span data-stream-next>다음 점검: -</span><span data-stream-recovery>자동복구: 0회</span></footer>`;
  section.querySelector('[data-stream-refresh]').onclick=()=>refreshStreamStatus(section,true);
  return section;
}

async function refreshStreamStatus(section,manual=false){
  if(section.dataset.loading==='true')return;
  section.dataset.loading='true';
  const summary=section.querySelector('.stream-summary'),button=section.querySelector('[data-stream-refresh]');
  if(manual)button.textContent='확인 중…';
  try{
    const response=await fetch(streamStatusPath,{credentials:'include',cache:'no-store'}),data=await response.json();
    if(!response.ok)throw new Error(data.message||`HTTP ${response.status}`);
    const healthy=data.status==='HEALTHY';
    section.dataset.health=healthy?'healthy':'degraded';
    summary.innerHTML=`<strong>${healthy?'정상 운영':'장애 감지'}</strong><span>${data.healthySlots}/${data.totalSlots} 슬롯 사용 가능</span>`;
    section.querySelector('.stream-slot-grid').innerHTML=data.slots.map(item=>`<article class="${item.healthy?'healthy':'danger'}"><div><span class="stream-dot" aria-hidden="true"></span><strong>RTX 슬롯 ${item.slot}</strong><em>${item.healthy?'정상':'복구 중'}</em></div><dl><div><dt>신호 포트</dt><dd>${item.port} · ${item.portUp?'UP':'DOWN'}</dd></div><div><dt>프로세스</dt><dd>PID ${item.pid||'-'}</dd></div><div><dt>서비스 재시작</dt><dd>${item.restartCount}회</dd></div></dl></article>`).join('');
    section.querySelector('[data-stream-checked]').textContent=`최근 점검: ${streamStatusTime(data.watchdog.checkedAt)}`;
    section.querySelector('[data-stream-next]').textContent=`다음 점검: ${streamStatusTime(data.watchdog.nextCheckAt)}`;
    section.querySelector('[data-stream-recovery]').textContent=`자동복구: ${data.watchdog.recoveryCount||0}회 · 최근 ${streamStatusTime(data.watchdog.lastRecoveredAt)}`;
  }catch(error){section.dataset.health='degraded';summary.innerHTML=`<strong>상태 확인 실패</strong><span>${error.message}</span>`}
  finally{section.dataset.loading='false';button.textContent='지금 새로고침'}
}

let streamStatusTimer=0;
function mountStreamOperationsStatus(){
  if(!location.pathname.endsWith('/factory-studio'))return;
  const main=document.querySelector('main');
  if(!main||main.querySelector('h1')?.textContent?.includes('로그인')||document.querySelector('.stream-operations-status'))return;
  const section=streamStatusCard();main.prepend(section);refreshStreamStatus(section);
  clearInterval(streamStatusTimer);streamStatusTimer=setInterval(()=>document.contains(section)&&refreshStreamStatus(section),30000);
}
new MutationObserver(mountStreamOperationsStatus).observe(document.documentElement,{childList:true,subtree:true});
mountStreamOperationsStatus();
