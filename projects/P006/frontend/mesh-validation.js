async function mountMeshValidation(){
 const data=await fetch('/projects/P006/assets/catalog/mesh-validation.json',{cache:'no-store'}).then(r=>r.json());
 const apply=()=>{const tabs=document.querySelector('.catalog-tabs');if(!tabs||document.querySelector('.mesh-validation'))return;tabs.insertAdjacentHTML('beforebegin',`<article class="mesh-validation ${data.status==='PASS'?'pass':'fail'}"><b>Unity/USD 고유 부분조립체</b><strong>${data.validatedAssets}/${data.physicalAssets}</strong><span>${data.conversionRate}% · 고유 형상 prim ${data.uniqueGeometryPrims||0}개 · 원본 번들 ${data.usdBundles}종 · 누락 ${data.failedAssets}개</span></article>`)};
 apply();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}).observe(document.documentElement,{childList:true,subtree:true});
}
mountMeshValidation().catch(console.error);
