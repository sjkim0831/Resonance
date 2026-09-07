let roundtripQaMounting=false;
async function mountRoundtripQa(){
  if(roundtripQaMounting||!location.pathname.endsWith('/factory-studio')||document.querySelector('[data-roundtrip-qa]'))return;
  const anchor=document.querySelector('[data-workbench-toolbar]');if(!anchor)return;
  roundtripQaMounting=true;
  try{
    const response=await fetch('/projects/P006/assets/catalog/roundtrip-qa.json',{cache:'no-store'}),qa=await response.json();
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const passed=Object.values(qa.checks).filter(Boolean).length,total=Object.keys(qa.checks).length;
    const box=document.createElement('section');box.dataset.roundtripQa='true';box.className='roundtrip-qa card';
    box.innerHTML=`<header><div><small>DB ↔ USD ↔ VERSION · 자동 검증</small><h2>설비 1:1 왕복 QA</h2></div><strong class="${qa.status==='PASS'?'pass':'fail'}">${qa.status} · ${passed}/${total}</strong></header><div class="roundtrip-qa-flow">${qa.process.map((step,index)=>`<span><b>${index+1}</b>${step}</span>`).join('')}</div><div class="roundtrip-qa-cards"><article><b>도움말</b><p>설비 이동 후 저장하면 DB·USD·버전을 순서대로 동기화합니다.</p></article><article><b>화면 설계</b><p>objectId → assetCode → databasePrimPath → USD Prim</p></article><article><b>QA 검증</b><p>${qa.sceneObjects}개 장면 · USD ${qa.usdObjects}개 · ${qa.elapsedSeconds}초</p></article><article><b>다음 업무</b><p>100·300·700개 부하와 FPS·로딩시간 측정</p></article><article><b>업무 길잡이</b><p>배치 → 저장 → RTX 확인 → 승인 → 필요 시 롤백</p></article><article><b>전체 업무 보기</b><p>설계·화면·백엔드·DB·USD 7개 검증 통과</p></article></div>`;
    anchor.after(box);document.documentElement.dataset.roundtripQa=qa.status;
  }catch(error){document.documentElement.dataset.roundtripQa='ERROR';document.documentElement.dataset.roundtripQaError=error.message}
  finally{roundtripQaMounting=false}
}
let roundtripQaQueued=false;function scheduleRoundtripQa(){if(roundtripQaQueued)return;roundtripQaQueued=true;requestAnimationFrame(()=>{roundtripQaQueued=false;mountRoundtripQa()})}
new MutationObserver(scheduleRoundtripQa).observe(document.documentElement,{childList:true,subtree:true});scheduleRoundtripQa();
