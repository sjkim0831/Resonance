async function synchronizeEquipmentMaster(){
 const response=await fetch('/projects/P006/assets/equipment-master.json',{cache:'no-store'});if(!response.ok)return;
 const master=await response.json(),rows=master.equipment||[],count=rows.length;
 const apply=()=>{
  document.querySelectorAll('.assets h2').forEach(x=>{const value=`실제 설비 자산 ${count}종`;if(/설비 자산/.test(x.textContent)&&x.textContent!==value)x.textContent=value});
  document.querySelectorAll('.equipment-group-title').forEach(x=>{const value=`통합 설비 ${count}종`;if(x.textContent!==value)x.textContent=value});
  document.querySelectorAll('.grid.cards article').forEach(card=>{const h=card.querySelector('h2'),value=`${count}종`;if(card.querySelector('b')?.textContent.trim()==='설비'&&h&&h.textContent!==value)h.textContent=value});
  const grid=document.querySelector('.asset-grid');if(grid){const existing=new Set([...grid.querySelectorAll('[data-asset]')].map(x=>x.dataset.asset));for(const row of rows)if(!existing.has(row.code)){const button=document.createElement('button');button.className='asset-card';button.draggable=true;button.dataset.asset=row.code;button.title=row.name;button.innerHTML=`<img src="/projects/P006/assets/equipment/${row.image}" alt="${row.name}"><span>${row.name}</span>`;grid.append(button)}}
 };
 let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})});apply();observer.observe(document.documentElement,{childList:true,subtree:true});
}
synchronizeEquipmentMaster().catch(console.error);
