async function mountPlcActivation(){
 if(!location.pathname.endsWith('/plc-admin'))return;
 const form=document.querySelector('#plc-admin-form');
 if(!form||form.querySelector('#plc-activation'))return;
 const data=await fetch('/projects/P006/plc-tags',{credentials:'include'}).then(r=>r.json());
 const configured=Number(data.configuredCount??data.configuredcount??0),state=data.profile?.status||'NOT_CONFIGURED';
 const box=document.createElement('section');box.id='plc-activation';box.className='plc-activation';
 box.innerHTML=`<b>수집기 전환</b><p>현재 상태: <strong id="plc-state">${state}</strong> · 주소 ${configured}/80개</p><div class="plc-form-actions"><button class="btn" data-action="approve" ${configured!==80||!['DRAFT','ROLLED_BACK'].includes(state)?'disabled':''}>1. 운영 승인</button><button class="btn primary" data-action="activate" ${state!=='APPROVED_DISABLED'?'disabled':''}>2. PLC 활성화</button><button class="btn danger" data-action="rollback" ${!['ACTIVE','APPROVED_DISABLED'].includes(state)?'disabled':''}>3. 시뮬레이터 복귀</button></div><small>활성화 전까지 PLC 쓰기 명령은 전송되지 않습니다.</small>`;
 form.append(box);
 box.onclick=async e=>{const action=e.target.dataset.action;if(!action)return;e.target.disabled=true;const response=await fetch(`/projects/P006/plc-tags/${action}`,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:'{}'}),result=await response.json();const status=document.querySelector('#plc-admin-status');status.textContent=response.ok?`${result.status} · ${result.collectorMode} 모드`:`전환 실패 · ${result.message}`;if(response.ok)setTimeout(()=>location.reload(),500);else e.target.disabled=false};
}
new MutationObserver(()=>mountPlcActivation().catch(console.error)).observe(document.documentElement,{childList:true,subtree:true});
mountPlcActivation().catch(console.error);
