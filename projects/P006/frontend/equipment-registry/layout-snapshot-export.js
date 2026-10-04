(function(){
  const install=()=>{
    if(!window.composerReady||!window.P006_GET_LAYOUT)return false;
    window.P006_EXPORT_LAYOUT_SNAPSHOT=()=>{
      const layout=JSON.parse(JSON.stringify(window.P006_GET_LAYOUT()));
      return {snapshotVersion:'p006-layout-snapshot-1',capturedAt:new Date().toISOString(),source:'PRODUCTION_COMPOSER_MEMORY',layout};
    };
    if(!document.querySelector('#exportLayoutSnapshot')){
      const b=document.createElement('button'); b.id='exportLayoutSnapshot'; b.type='button'; b.textContent='현재 레이아웃 Snapshot';
      b.title='현재 메모리에 로드된 레이아웃을 JSON으로 내보냅니다. DB를 변경하지 않습니다.';
      b.onclick=()=>{const data=window.P006_EXPORT_LAYOUT_SNAPSHOT();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='layout-snapshot-'+data.layout.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
      (document.querySelector('#export')?.parentElement||document.body).appendChild(b);
    }
    return true;
  };
  const t=setInterval(()=>{if(install())clearInterval(t)},50); setTimeout(()=>clearInterval(t),30000);
})();
