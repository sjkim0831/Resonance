async function mountClassificationStatus(){
 const data=await fetch('/projects/P006/assets/catalog/equipment-classification.json',{cache:'no-store'}).then(r=>r.json());
 const apply=()=>{const host=document.querySelector('.catalog');if(!host||host.querySelector('.classification-status'))return;host.insertAdjacentHTML('afterbegin',`<article class="classification-status"><b>설비 자료 자동 분류</b><span>자동 승인 ${data.autoApprovedCount}개</span><span>관리자 검토 ${data.reviewRequiredCount}개</span><small>확신도 85% 미만 또는 중복 후보만 승인함으로 분리됩니다.</small></article>`)};
 apply();new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
}
mountClassificationStatus().catch(console.error);
