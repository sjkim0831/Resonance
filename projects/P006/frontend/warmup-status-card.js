let warmupCardBusy=false;
async function mountWarmupCard(){
 const host=document.querySelector('.p006-kit-benchmark-table header');if(!host||host.querySelector('.p006-warmup-ready')||warmupCardBusy)return;warmupCardBusy=true;
 try{const response=await fetch('/projects/P006/digital-twin/api/mapped-performance-benchmark',{credentials:'include',cache:'no-store'}),data=await response.json(),warmup=data.warmup;if(!response.ok||!warmup)throw new Error(`HTTP ${response.status}`);const row=document.createElement('p');row.className='p006-warmup-ready';row.textContent=`워밍업 ${warmup.status} · 300개 ${(warmup.durationMs/1000).toFixed(2)}초 · 첫 프레임 ${warmup.firstFrameMs}ms`;host.querySelector('div')?.append(row)}catch(error){document.body.dataset.warmupCardError=error.message}finally{warmupCardBusy=false}
}
new MutationObserver(()=>mountWarmupCard()).observe(document.documentElement,{childList:true,subtree:true});mountWarmupCard();setInterval(mountWarmupCard,5000);
