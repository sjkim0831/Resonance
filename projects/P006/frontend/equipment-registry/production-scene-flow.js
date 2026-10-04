// Presentation motion only. Does not alter schedule, inventory or evidence.
export function finishedPose(schedule,layout,factories,time){
 const tasks=schedule.tasks,join=tasks.filter(t=>t.type==='ASSEMBLE').sort((a,b)=>b.end-a.end)[0];
 if(!join||time<join.end)return null;
 const point=t=>{const p=layout.points.get(t.processId),f=factories.get(t.factoryId);return p&&f?{x:f.x+p.x,z:f.z+(p.localZ||0)+Math.min(4,Math.max(1.8,layout.pitch*.12))}:null;};
 const origin=point(join);if(!origin)return null;let current=origin,phase='조립 완료';
 const following=tasks.filter(t=>t.processId&&!t.partId&&t.start>=join.end&&t.id!==join.id).sort((a,b)=>a.start-b.start);
 for(const t of following){if(time<t.start)break;const f=factories.get(t.factoryId),destination=t.type==='DISPATCH'?f?.ship:point(t);if(!destination)continue;
 const travel=t.type==='DISPATCH'?Math.max(.001,t.duration):Math.max(.001,t.duration*.2);
 const progress=Math.max(0,Math.min(1,(time-t.start)/travel));
 current={x:current.x+(destination.x-current.x)*progress,z:current.z+(destination.z-current.z)*progress};
 phase=t.type==='DISPATCH'?(time>=t.end?'출고 완료':'출고장 이동'):progress<1?'검사 위치로 이동':time<t.end?'완제품 기능 검사':'검사 완료';
 if(time<t.end)break;
 }
 return {dx:current.x-origin.x,dz:current.z-origin.z,x:current.x,z:current.z,phase};
}
export function equipmentPanel(plan,schedule,focus){
 let panel=document.getElementById('equipment-panel');if(!panel){panel=document.createElement('section');panel.id='equipment-panel';document.querySelector('footer').before(panel);}panel.replaceChildren();
 const title=document.createElement('h2');title.textContent='설비 안내 · 공정 및 제품 현황';const strip=document.createElement('div');strip.className='equipment-strip';panel.append(title,strip);const rows=[];
 for(const p of plan.processes.filter(p=>p.kind!=='DISPATCH')){const t=schedule.tasks.find(t=>t.processId===p.id);if(!t)continue;const card=document.createElement('article');card.className='equipment-card';const name=document.createElement('strong');name.textContent='설비 '+(p.equipmentModel?.assetId||'미배정');const process=document.createElement('div');process.textContent=p.name;const product=document.createElement('div');product.textContent='제품: '+(plan.parts.find(x=>x.id===p.partId)?.name||plan.productName);const basis=document.createElement('small');basis.textContent=p.equipmentModel?.previewOnly?'참고 후보 · 적합성 미검증':p.equipmentModel?.glbPath?'계획 연결 · 가동부 동작 미검증':'모델 미연결';const status=document.createElement('div');const button=document.createElement('button');button.textContent='설비·제품 보기';button.onclick=()=>focus(p);card.append(name,process,product,basis,status,button);strip.append(card);rows.push({p,t,name,status,card});}
 fetch('/projects/P006/assets/entry-catalog/entries.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{const names=new Map(data.map(x=>[x.id,x.name||x.englishName]));for(const row of rows){const id=row.p.equipmentModel?.assetId;row.name.textContent=(names.get(id)||'설비명 미확인')+' · '+(id||'미배정');}}).catch(()=>{});
 let last=-1;return time=>{const tick=Math.floor(time*10);if(tick===last)return;last=tick;for(const {p,t,status,card} of rows){const state=time<t.start?'예정':time<t.end?'진행 중':'완료';card.dataset.state=state;const cell=plan.cells?.find(c=>c.id===p.cellId),zone=plan.zones?.find(z=>z.id===cell?.zoneId);status.textContent=`${state} · ${t.start}–${t.end}분 · 경과 ${Math.max(0,Math.min(t.duration,time-t.start)).toFixed(1)}/${t.duration}분 · ${zone?.name||''} / ${cell?.name||''} · 셀 대기 ${t.cellWaitMinutes||0}분`;}};
}
