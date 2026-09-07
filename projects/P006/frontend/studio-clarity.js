const clarityRoot=document.documentElement;
function mountStudioClarity(){
  if(!location.pathname.endsWith('/factory-studio'))return;
  const toolbar=document.querySelector('[data-workbench-toolbar]'),studio=document.querySelector('.studio');
  if(toolbar&&studio&&!document.querySelector('[data-studio-guide]')){
    const guide=document.createElement('section');
    guide.className='studio-quick-guide';
    guide.dataset.studioGuide='true';
    guide.innerHTML='<div><b>1</b><span><strong>자산 선택</strong><small>왼쪽 사진을 끌어 놓기</small></span></div><i>→</i><div><b>2</b><span><strong>배치·편집</strong><small>이동·회전·크기·복제</small></span></div><i>→</i><div><b>3</b><span><strong>저장·검증</strong><small>충돌 확인 후 저장</small></span></div><i>→</i><div><b>4</b><span><strong>RTX 확인</strong><small>현재 DB 배치로 새 USD</small></span></div><nav><button type="button" data-asset-width>자산 목록 넓게</button><button type="button" data-jump-canvas>캔버스 보기</button><button type="button" data-open-qa>상세·QA 보기</button></nav>';
    toolbar.after(guide);
    guide.querySelector('[data-asset-width]').onclick=event=>{const expanded=clarityRoot.classList.toggle('asset-panel-expanded');event.currentTarget.textContent=expanded?'자산 목록 기본 폭':'자산 목록 넓게'};
    guide.querySelector('[data-jump-canvas]').onclick=()=>document.querySelector('.workspace-viewport')?.scrollIntoView({block:'start',behavior:'smooth'});
    guide.querySelector('[data-open-qa]').onclick=()=>toolbar.querySelector('[data-workbench="details"]')?.click();
  }
  document.querySelectorAll('#viewer.rtx-preview-modal [data-version]').forEach(button=>{
    let sentinel=button.querySelector(':scope > [data-layout-downloads]');
    if(!sentinel){sentinel=document.createElement('span');sentinel.dataset.layoutDownloads='true';button.append(sentinel)}
    sentinel.replaceChildren();sentinel.hidden=true;
  });
}
let clarityQueued=false;
new MutationObserver(()=>{if(clarityQueued)return;clarityQueued=true;requestAnimationFrame(()=>{clarityQueued=false;mountStudioClarity()})}).observe(document.documentElement,{childList:true,subtree:true});
mountStudioClarity();
