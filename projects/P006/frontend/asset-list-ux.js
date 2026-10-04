function mountAssetListUx(){
  const panel=document.querySelector('[data-factory-composer]');
  if(!panel||panel.dataset.factoryComposer!=='ready'||panel.dataset.listUx)return;
  panel.dataset.listUx='ready';panel.classList.add('composer-mode-recommend');
  const tabs=document.createElement('nav');tabs.className='composer-view-tabs';tabs.innerHTML='<button type="button" class="active" data-composer-view="recommend">추천 설비</button><button type="button" data-composer-view="catalog">전체 724개</button>';
  panel.querySelector('header')?.after(tabs);
  const activate=mode=>{panel.classList.toggle('composer-mode-recommend',mode==='recommend');panel.classList.toggle('composer-mode-catalog',mode==='catalog');tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.composerView===mode));requestAnimationFrame(()=>{const scope=mode==='recommend'?panel.querySelector('[data-recommend-grid]'):panel.querySelector('[data-catalog-grid]');scope?.querySelectorAll('img').forEach((img,index)=>{img.loading=index<8?'eager':'lazy';img.decoding='async';img.fetchPriority=index<4?'high':'low'})})};
  tabs.onclick=event=>{const button=event.target.closest('[data-composer-view]');if(button)activate(button.dataset.composerView)};
  panel.querySelector('[data-catalog-search]')?.addEventListener('focus',()=>activate('catalog'));
  activate('recommend');
}
let workspaceImageObserver;
function mountWorkspaceImageLod(){
  const root=document.querySelector('.workspace-viewport');if(!root)return;
  if(!workspaceImageObserver)workspaceImageObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{const img=entry.target;if(entry.isIntersecting){if(!img.getAttribute('src')&&img.dataset.src)img.src=img.dataset.src}else if(img.getAttribute('src')){img.dataset.src=img.getAttribute('src');img.removeAttribute('src')}}),{root,rootMargin:'240px'});
  const rr=root.getBoundingClientRect();document.querySelectorAll('#workspace .object img:not([data-lod-bound])').forEach(img=>{img.dataset.lodBound='true';img.loading='lazy';img.decoding='async';const r=img.getBoundingClientRect(),near=r.bottom>rr.top-240&&r.top<rr.bottom+240&&r.right>rr.left-240&&r.left<rr.right+240;if(!near&&img.getAttribute('src')){img.dataset.src=img.getAttribute('src');img.removeAttribute('src')}workspaceImageObserver.observe(img)})
}
let assetUxQueued=false;new MutationObserver(()=>{if(assetUxQueued)return;assetUxQueued=true;requestAnimationFrame(()=>{assetUxQueued=false;mountAssetListUx();mountWorkspaceImageLod()})}).observe(document.documentElement,{childList:true,subtree:true});mountAssetListUx();mountWorkspaceImageLod();
