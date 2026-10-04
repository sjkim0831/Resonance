const detailEsc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const detailNames={melting_furnace:'용해로',holding_furnace:'보온로',casting_machine:'주조기',spray_ladler:'스프레이 로봇·래들',release_agent:'이형제 장치',vacuum_unit:'진공장치',mold_cooling:'금형 고압냉각장비',cooling_unit:'냉각장비',takeout_robot:'취출 로봇',trimming_machine:'트리밍',punching_press:'펀칭 프레스',casting_filter:'주조기 필터',turntable_furnace:'턴테이블로',ladler:'래들러',robot_panel:'로봇 제어반',main_panel:'전체 제어반'};
const detailStatusMeta={RUNNING:{label:'가동 중',tone:'ok'},IDLE:{label:'대기',tone:'idle'},FAULT:{label:'고장',tone:'fault'},MAINTENANCE:{label:'정비',tone:'maint'},STOPPED:{label:'정지',tone:'stop'},OFFLINE:{label:'오프라인',tone:'stop'}};
const detailState={code:'',objectId:'',loading:false,panel:null,timer:null};
let detailMaster=null,detailCatalog=null;
async function detailLoadMaster(){if(detailMaster)return detailMaster;try{const r=await fetch('/projects/P006/assets/equipment-master.json',{cache:'no-store'});detailMaster=r.ok?await r.json():{equipment:[]}}catch{detailMaster={equipment:[]}}return detailMaster}
async function detailLoadCatalog(){if(detailCatalog)return detailCatalog;try{const r=await fetch('/projects/P006/assets/catalog/manifest.json',{cache:'no-store'});detailCatalog=r.ok?await r.json():{assets:[]}}catch{detailCatalog={assets:[]}}return detailCatalog}
async function detailCatalogName(code){if(!code||!code.startsWith('catalog_'))return null;const cat=await detailLoadCatalog();const id=code.slice(8).toUpperCase();const a=(cat.assets||[]).find(x=>x.id===id);return a?.name||null}
function detailPanelEl(){if(detailState.panel&&document.body.contains(detailState.panel))return detailState.panel;const panel=document.createElement('aside');panel.className='equipment-detail';panel.dataset.equipmentDetail='true';panel.setAttribute('aria-label','설비 상세정보');panel.innerHTML='<header><div><small>EQUIPMENT DETAIL</small><h2 data-detail-title>설비 상세</h2></div><button type="button" data-detail-close aria-label="상세 닫기">×</button></header><div data-detail-body><p class="detail-hint">설비를 클릭하면 상세정보가 표시됩니다.</p></div>';document.body.append(panel);detailState.panel=panel;panel.querySelector('[data-detail-close]').onclick=()=>{panel.classList.remove('open');detailState.code='';detailState.objectId='';if(detailState.timer){clearInterval(detailState.timer);detailState.timer=null}};return panel}
function detailStatusChip(state){const meta=detailStatusMeta[state]||{label:state||'확인 중',tone:'idle'};return `<span class="detail-status tone-${meta.tone}">${detailEsc(meta.label)}</span>`}
function detailMetric(label,value,unit=''){return `<div class="detail-metric"><dt>${detailEsc(label)}</dt><dd>${detailEsc(value)}${unit?`<small>${detailEsc(unit)}</small>`:''}</dd></div>`}
async function detailFetchStatus(code){try{const r=await fetch('/projects/P006/equipment-status',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const body=await r.json();return body.states?.[code]||null}catch{return null}}
async function detailFetchTelemetry(code){try{const r=await fetch(`/projects/P006/equipment-telemetry/${encodeURIComponent(code)}`,{credentials:'include',cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}
async function detailRender(code,objectId){const panel=detailPanelEl();const body=panel.querySelector('[data-detail-body]');const master=await detailLoadMaster();const masterItem=(master.equipment||[]).find(x=>x.code===code);const catName=await detailCatalogName(code);const name=masterItem?.name||detailNames[code]||catName||code;panel.querySelector('[data-detail-title]').textContent=name;detailState.code=code;detailState.objectId=objectId;panel.classList.add('open');body.innerHTML=`<div class="detail-loading"><span class="detail-spinner"></span>상세정보 불러오는 중…</div>`;
  const [status,telemetry]=await Promise.all([detailFetchStatus(code),detailFetchTelemetry(code)]);
  if(detailState.code!==code)return;
  const rows=[];
  rows.push(`<div class="detail-head">${masterItem?`<img src="/projects/P006/assets/equipment/${encodeURIComponent(masterItem.image)}" alt="${detailEsc(name)}">`:''}<div><strong>${detailEsc(name)}</strong><small>${detailEsc(code)}</small>${detailStatusChip(status)}</div></div>`);
  const t=telemetry||{};
  const metrics=[];
  if(t.temperature!=null)metrics.push(detailMetric('온도',Number(t.temperature).toFixed(1),'°C'));
  if(t.pressure!=null)metrics.push(detailMetric('압력',Number(t.pressure).toFixed(2),'MPa'));
  if(t.vibration!=null)metrics.push(detailMetric('진동',Number(t.vibration).toFixed(2),'mm/s'));
  if(t.current!=null)metrics.push(detailMetric('전류',Number(t.current).toFixed(1),'A'));
  if(t.power!=null)metrics.push(detailMetric('전력',Number(t.power).toFixed(1),'kW'));
  if(t.cycleSeconds!=null)metrics.push(detailMetric('사이클',Number(t.cycleSeconds).toFixed(0),'초'));
  if(t.uptime!=null)metrics.push(detailMetric('가동률',Number(t.uptime).toFixed(1),'%'));
  if(t.lastSeenAt)metrics.push(detailMetric('마지막 수신',new Date(t.lastSeenAt).toLocaleTimeString('ko-KR'),''));
  rows.push(metrics.length?`<dl class="detail-metrics">${metrics.join('')}</dl>`:`<p class="detail-empty">실시간 지표가 아직 수집되지 않았습니다. 수집기 상태: ${detailEsc(t.status||'확인 중')}</p>`);
  if(t.source)rows.push(`<p class="detail-source">데이터 출처 · ${detailEsc(t.source)}</p>`);
  rows.push(`<div class="detail-actions"><button type="button" data-detail-focus>3D 뷰어에서 보기</button><button type="button" data-detail-close2>닫기</button></div>`);
  body.innerHTML=rows.join('');
  panel.querySelector('[data-detail-focus]')?.addEventListener('click',()=>{const payload={action:'focus',equipmentCode:code,rtxSlot:1,isolate:false,previewFresh:true,objects:detailState.objectId?[{objectId:detailState.objectId,assetCode:code}]:[],source:'WEB_EQUIPMENT_DETAIL',requestedAt:new Date().toISOString()};fetch('/projects/P006/stage-focus',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{})});
  panel.querySelector('[data-detail-close2]')?.addEventListener('click',()=>{panel.classList.remove('open');detailState.code='';if(detailState.timer){clearInterval(detailState.timer);detailState.timer=null}});
  if(detailState.timer)clearInterval(detailState.timer);
  detailState.timer=setInterval(async()=>{if(!detailState.code||!document.body.contains(panel))return;const [s,tl]=await Promise.all([detailFetchStatus(detailState.code),detailFetchTelemetry(detailState.code)]);if(detailState.code!==code)return;const chip=panel.querySelector('.detail-status');if(chip&&s){const meta=detailStatusMeta[s]||{label:s,tone:'idle'};chip.textContent=meta.label;chip.className=`detail-status tone-${meta.tone}`}},5000);
}
let detailMounted=false;
function detailMount(){if(detailMounted)return;detailMounted=true;const marker=document.createElement('span');marker.dataset.detailObserver='true';marker.className='detail-observer-marker';document.body.append(marker);
  const onSelection=()=>{try{const selAttr=document.documentElement.dataset.factoryEditorSelection||'';const firstId=selAttr.split(',')[0].trim();if(!firstId){detailState.panel?.classList.remove('open');detailState.code='';return}const ws=document.querySelector('#workspace');const obj=ws?.querySelector(`[data-id="${CSS.escape(firstId)}"]`);const code=obj?.dataset.asset||'';if(!code){detailState.panel?.classList.remove('open');detailState.code='';return}if(code===detailState.code&&firstId===detailState.objectId)return;void detailRender(code,firstId)}catch(e){console.error('detail onSelection error',e)}};
  const observer=new MutationObserver(onSelection);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-factory-editor-selection']});
  const wsObserver=new MutationObserver(onSelection);wsObserver.observe(document.querySelector('#workspace')||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('click',e=>{if(e.target.closest('[data-equipment-detail]'))return;const obj=e.target.closest('#workspace .object[data-asset]');if(obj)onSelection()});
  marker.dataset.detailMount='done';
}
window.p006DetailRender=detailRender;window.p006DetailState=detailState;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',detailMount);else detailMount();
