(()=>{
  const bind=()=>{
    const model=document.querySelector('#mv'),phase=document.querySelector('#phase');
    if(!model||!phase)return;
    const play=()=>{try{model.pause();model.currentTime=0;model.play({repetitions:1});phase.textContent='재생 중 · 소재 투입 → 램 하강·압착 → 램 복귀 → 소재 배출 (시연용)';}catch(e){phase.textContent='재생 오류 · '+e.message;}};
    document.querySelector('#play')?.addEventListener('click',play);
    document.querySelector('#pause')?.addEventListener('click',()=>{model.pause();phase.textContent=`일시정지 · ${Number(model.currentTime||0).toFixed(1)}초`;});
    document.querySelector('#reset')?.addEventListener('click',()=>{model.pause();model.currentTime=0;phase.textContent='처음으로 · 대기';});
    model.addEventListener('finished',()=>phase.textContent='완료 · 데모 클립 끝');
    model.addEventListener('load',()=>{phase.textContent='모델 준비 완료 · ▶ 애니메이션 재생을 누르세요';});
    model.addEventListener('error',()=>{phase.textContent='모델을 불러오지 못했습니다. 서버 GLB 경로와 브라우저 호환성을 확인하세요.';});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
