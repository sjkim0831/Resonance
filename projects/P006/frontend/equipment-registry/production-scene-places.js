// Versioned placement schema. Coordinates are factory-local metres, rendering scale is illustrative.
export function seedPlaces(plan){
 const copy=JSON.parse(JSON.stringify(plan));copy.placementVersion=1;copy.zones||=[];copy.cells||=[];
 for(const f of copy.factories){const ps=copy.processes.filter(p=>p.factoryId===f.id&&p.kind!=='DISPATCH');
  let zone=copy.zones.find(z=>z.factoryId===f.id);if(!zone){zone={id:'zone-'+f.id,factoryId:f.id,name:'기본 작업 구역',x:0,z:0,width:Math.max(22,ps.length*10+2),depth:20};copy.zones.push(zone);}
  ps.forEach((p,i)=>{if(p.cellId)return;const cell={id:'cell-'+p.id,zoneId:zone.id,name:p.name+' 셀',x:6+i*10,z:6,yaw:0};copy.cells.push(cell);p.cellId=cell.id;});
 }return copy;
}
export function validatePlaces(p){
 const errors=[],fs=new Set(p.factories.map(f=>f.id)),zs=new Map(),cs=new Map();
 for(const z of p.zones||[]){if(zs.has(z.id))errors.push('구역 ID 중복: '+z.id);zs.set(z.id,z);if(!fs.has(z.factoryId)||!z.name?.trim())errors.push('구역의 공장/이름 확인');if(!['x','z','width','depth'].every(k=>Number.isFinite(z[k]))||z.x<0||z.z<0||z.width<8||z.depth<8)errors.push(z.name+': 좌표는 0 이상, 폭·깊이는 8m 이상');}
 for(const c of p.cells||[]){if(cs.has(c.id))errors.push('셀 ID 중복: '+c.id);cs.set(c.id,c);const z=zs.get(c.zoneId);if(!z||!c.name?.trim())errors.push('셀의 구역/이름 확인');if(!['x','z','yaw'].every(k=>Number.isFinite(c[k])))errors.push(c.name+': 위치·방향 숫자 확인');if(z&&(c.x<3||c.z<3||c.x>z.width-3||c.z>z.depth-3))errors.push(c.name+': 셀 중심을 구역 경계에서 3m 이상 안쪽에 배치하세요.');}
 for(const proc of p.processes.filter(p=>p.kind!=='DISPATCH')){const c=cs.get(proc.cellId),z=c&&zs.get(c.zoneId);if(!z||z.factoryId!==proc.factoryId)errors.push(proc.name+': 같은 공장 내부 셀을 배정하세요.');}
 const zones=[...zs.values()];for(let i=0;i<zones.length;i++)for(let j=i+1;j<zones.length;j++){const a=zones[i],b=zones[j];if(a.factoryId===b.factoryId&&a.x<b.x+b.width&&b.x<a.x+a.width&&a.z<b.z+b.depth&&b.z<a.z+a.depth)errors.push(a.name+' / '+b.name+': 구역 겹침');}
 const cells=[...cs.values()];for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){const a=cells[i],b=cells[j];if(a.zoneId===b.zoneId&&Math.abs(a.x-b.x)<6&&Math.abs(a.z-b.z)<6)errors.push(a.name+' / '+b.name+': 셀 6×6m 표시 영역 겹침');}
 return [...new Set(errors)];
}
export function placeLayout(plan,layout){const zones=new Map(plan.zones.map(z=>[z.id,z])),cells=new Map(plan.cells.map(c=>[c.id,c]));for(const proc of plan.processes){const point=layout.points.get(proc.id),cell=cells.get(proc.cellId),zone=cell&&zones.get(cell.zoneId);if(point&&zone){point.x=zone.x+cell.x;point.localZ=zone.z+cell.z;point.z=(layout.factoryIndex.get(proc.factoryId)||0)*layout.laneGap+point.localZ;point.yaw=cell.yaw;point.cellId=cell.id;point.zoneId=zone.id;}}return layout;}
export function cellRuntime(core,plan){const r=core.createRuntime(plan),byProc=new Map(plan.processes.map(p=>[p.id,p])),available=new Map(),byId=new Map();
 const tasks=r.schedule.tasks.map((t,index)=>({...t,index})).sort((a,b)=>a.start-b.start||a.index-b.index);
 for(const t of tasks){const cell=byProc.get(t.processId)?.cellId,previous=cell&&available.get(cell),deps=t.deps.map(id=>byId.get(id));if(deps.some(t=>!t))throw Error('공정 의존 순서 오류');const baseline=Math.max(0,...deps.map(t=>t.end));t.start=Math.max(baseline,previous?.end||0);t.cellWaitMinutes=t.start-baseline;t.end=t.start+t.duration;if(previous&&!t.deps.includes(previous.id))t.deps=[...t.deps,previous.id];if(cell)available.set(cell,t);byId.set(t.id,t);}
 r.schedule.tasks=tasks;r.schedule.totalMinutes=Math.max(0,...tasks.map(t=>t.end));return r;
}
export function placesEditor(api){
 const details=document.createElement('details');details.id='places-editor';const summary=document.createElement('summary');summary.textContent='작업 장소 설정 · 구역·셀·공정 배정';details.append(summary);const body=document.createElement('div');details.append(body);document.querySelector('main').before(details);let draft;
 const make=(tag,text,parent)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(parent)parent.append(e);return e;};
 function input(parent,obj,key,label,type='text'){const e=make('input','',parent);e.type=type;e.value=obj[key];e.setAttribute('aria-label',label);if(type==='number')e.step='any';e.oninput=()=>obj[key]=type==='number'?e.valueAsNumber:e.value;return e;}
 function select(parent,items,value,label,change){const e=make('select','',parent);e.setAttribute('aria-label',label);for(const [id,name]of items)e.add(new Option(name,id));e.value=value;e.onchange=()=>change(e.value);return e;}
 function table(title,headers){make('h3',title,body);const wrap=make('div','',body);wrap.className='places-table';const t=make('table','',wrap),head=make('tr','',make('thead','',t));headers.forEach(h=>make('th',h,head));return make('tbody','',t);}
 function render(){body.replaceChildren();make('p','같은 공장에 여러 구역·셀을 추가합니다. 셀 위치는 구역 기준 m, 방향은 °입니다. 셀은 한 번에 1개 공정을 처리합니다. 공장간 재배정은 기존 제품·공정 편집에서 운송 조건과 함께 설정하세요.',body);
  const zb=table('1. 공장 내부 구역',['소속 부지 / 공장','구역 이름','X(m)','Z(m)','폭(m)','깊이(m)']);for(const z of draft.zones){const row=make('tr','',zb),f=draft.factories.find(f=>f.id===z.factoryId);make('td',(draft.sites.find(s=>s.id===f?.siteId)?.name||'부지 미확인')+' / '+f?.name,row);for(const key of ['name','x','z','width','depth'])input(make('td','',row),z,key,z.id+' '+key,key==='name'?'text':'number');}
  const addZone=make('button','+ 구역 추가',body),fz=make('span','',body);let selectedFactory=draft.factories[0]?.id;select(fz,draft.factories.map(f=>[f.id,f.name]),selectedFactory,'새 구역의 공장',v=>selectedFactory=v);addZone.onclick=()=>{if(!selectedFactory)return;const own=draft.zones.filter(z=>z.factoryId===selectedFactory);draft.zones.push({id:'zone-'+Date.now(),factoryId:selectedFactory,name:'새 작업 구역',x:0,z:Math.max(0,...own.map(z=>z.z+z.depth))+4,width:32,depth:20});render();};
  const cb=table('2. 구역 내부 셀',['구역','셀 이름','X(m)','Z(m)','방향(°)']);for(const c of draft.cells){const row=make('tr','',cb);select(make('td','',row),draft.zones.map(z=>[z.id,(draft.factories.find(f=>f.id===z.factoryId)?.name||'')+' / '+z.name]),c.zoneId,c.id+' 구역',v=>{c.zoneId=v;render();});for(const key of ['name','x','z','yaw'])input(make('td','',row),c,key,c.id+' '+key,key==='name'?'text':'number');}
  let selectedZone=draft.zones[0]?.id;const addCell=make('button','+ 셀 추가',body),cz=make('span','',body);select(cz,draft.zones.map(z=>[z.id,(draft.factories.find(f=>f.id===z.factoryId)?.name||'')+' / '+z.name]),selectedZone,'새 셀의 구역',v=>selectedZone=v);addCell.onclick=()=>{draft.cells.push({id:'cell-'+Date.now(),zoneId:selectedZone,name:'새 공정 셀',x:6,z:6,yaw:0});render();};
  const pb=table('3. 공정별 작업 장소 배정',['공정','소속 공장','구역 / 셀','공정 시간(분)','공유']);for(const p of draft.processes.filter(p=>p.kind!=='DISPATCH')){const row=make('tr','',pb);make('td',p.name,row);make('td',draft.factories.find(f=>f.id===p.factoryId)?.name,row);const eligible=draft.cells.filter(c=>draft.zones.find(z=>z.id===c.zoneId)?.factoryId===p.factoryId);select(make('td','',row),eligible.map(c=>[c.id,draft.zones.find(z=>z.id===c.zoneId).name+' / '+c.name]),p.cellId,p.id+' 작업 셀',v=>{p.cellId=v;render();});input(make('td','',row),p,'durationMinutes',p.id+' 소요시간','number');make('td',draft.processes.filter(x=>x.cellId===p.cellId).length+'개 공정',row);}
  const msg=make('p','미저장 · 3D 적용 후 변경본을 저장하세요.',body);msg.id='places-status';msg.setAttribute('role','status');const preview=make('button','3D에 적용 · 시간표 재계산',body);preview.id='places-preview';const save=make('button','변경본 별도 저장',body);save.id='places-save';
  function act(persist){if(api.busy()){msg.textContent='녹화 종료 후 변경하세요.';return;}const errors=validatePlaces(draft);if(errors.length){msg.textContent=errors.join(' / ');return;}try{const r=cellRuntime(api.core,draft);api.apply(JSON.parse(JSON.stringify(draft)),persist);msg.textContent=(persist?'브라우저에 변경본 저장 · 원본 보존':'3D 적용 · 아직 미저장')+' · 전체 '+r.schedule.totalMinutes+'분 · 셀 대기 합계 '+r.schedule.tasks.reduce((n,t)=>n+(t.cellWaitMinutes||0),0)+'분';}catch(e){msg.textContent=e.message;}}
  preview.onclick=()=>act(false);save.onclick=()=>act(true);
 }
 return {set(p){draft=seedPlaces(p);render();},element:details};
}
