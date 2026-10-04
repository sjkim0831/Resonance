'use strict';
(() => {
  const link=document.getElementById('factoryPerformanceLink');
  if(!link)return;
  const dialog=document.createElement('dialog');dialog.id='p006PerformanceDialog';
  dialog.setAttribute('aria-label','공장 성능·LOD');
  dialog.style.cssText='width:96vw;max-width:1800px;height:92vh;max-height:96vh;padding:0;border:1px solid #9fbdd0;border-radius:12px;background:#f1f6fa;box-shadow:0 12px 48px #0004';
  const head=document.createElement('div');head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:white;border-bottom:1px solid #bcd0dd';
  const title=document.createElement('div');title.innerHTML='<strong>공장 성능·LOD</strong><small style="display:block;margin-top:4px">현재 공장의 저장본을 별도 측정합니다. 닫으면 편집 화면으로 돌아갑니다.</small>';
  const close=document.createElement('button');close.id='p006PerformanceClose';close.type='button';close.textContent='닫기';
  head.append(title,close);dialog.append(head);
  const frame=document.createElement('iframe');frame.id='p006PerformanceFrame';frame.title='현재 공장 성능 측정';frame.style.cssText='width:100%;height:calc(100% - 76px);border:0';dialog.append(frame);document.body.append(dialog);
  const style=document.createElement('style');style.textContent='#p006PerformanceDialog::backdrop{background:#17344780}';document.head.append(style);
  function closePanel(){
    const cancel=frame.contentDocument?.getElementById('cancel');
    if(cancel&&!cancel.disabled){cancel.click();title.querySelector('small').textContent='측정 취소 결과를 저장하고 창을 닫는 중입니다.';
      const started=Date.now();const timer=setInterval(()=>{if(cancel.disabled||Date.now()-started>10000){clearInterval(timer);dialog.close();link.focus()}},100);return;
    }
    dialog.close();link.focus();
  }
  close.onclick=closePanel;dialog.addEventListener('cancel',e=>{e.preventDefault();closePanel()});
  link.onclick=e=>{
    e.preventDefault();
    const layout=(typeof doc!=='undefined'&&doc?.id)||new URLSearchParams(location.search).get('layout');
    const url='factory-performance.html?revision=7'+(layout?'&layout='+encodeURIComponent(layout):'');
    frame.src=url;frame.dataset.loadedUrl=url;
    title.querySelector('small').textContent='현재 공장의 저장본을 별도 측정합니다. 닫으면 편집 화면으로 돌아갑니다.';
    dialog.showModal();close.focus();
  };
})();
