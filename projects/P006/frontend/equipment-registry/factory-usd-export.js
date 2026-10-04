/* Current Composer -> saved snapshot -> portable USDZ, preserving source time samples. */
(()=>{
 'use strict';
 const button=document.createElement('button');button.id='factoryUsdExport';button.className='primary';button.textContent='전체 공장 USD 저장';
 button.title='현재 화면을 DB 저장한 뒤 설비·건축·원본 애니메이션을 USDZ로 내보냅니다.';
 document.querySelector('.documentbar').append(button);
 const panel=document.createElement('dialog');panel.id='factoryUsdExportDialog';panel.style.cssText='width:min(760px,94vw);max-height:86vh;overflow:auto';
 panel.innerHTML='<div class="dialoghead"><strong>전체 공장 USD 저장</strong><button type="button" id="factoryUsdClose">닫기</button></div><p>현재 배치를 먼저 DB 저장합니다. 설비·벽·출입구·통로와 원본 USD에 기록된 애니메이션을 한 파일에 담습니다.</p><p id="factoryUsdProgress" role="status"></p><div id="factoryUsdResult"></div><p>다운로드한 <b>Factory.usdz</b>를 Omniverse의 File → Open으로 여세요. 애니메이션이 포함된 경우 타임라인을 재생하세요.</p><p><a href="factory-usd-export-design.md" target="_blank">도움말 · 설계 · QA · 다음 업무</a></p>';
 document.body.append(panel);panel.querySelector('#factoryUsdClose').onclick=()=>panel.close();
 const progress=panel.querySelector('#factoryUsdProgress'),result=panel.querySelector('#factoryUsdResult');
 function show(job){
  progress.textContent=`저장 버전 v${job.version} · ${job.state==='RUNNING'?'전체 USD 생성·검증 중':job.state==='FINISHED'?'다운로드 준비 완료':'생성 실패'}`;
  if(job.state==='FAILED'){result.textContent=job.error||'생성 또는 검증 실패';return;}
  const r=job.portableReport;if(!r)return;
  result.innerHTML=`<p>전체 객체 ${r.counts.instances}개 · 설비 ${r.counts.equipmentReferences}개 · 건축 ${r.counts.buildingObjects}개</p><p>파일 ${(r.bytes/1048576).toFixed(2)} MB · 생성·검증 ${r.seconds}초 · 외부 참조 누락 ${r.unresolvedDependencies.length}개</p><p><b>${r.sampledAttributes?`원본 시간축 속성 ${r.sampledAttributes}개 보존 · 변화하는 Transform ${r.movingTransformAttributes}개`:'애니메이션 없음: 현재 원본 USD에 시간별 동작 데이터가 없습니다.'}</b></p><p>웹 공정 실행과 작업물 이동은 이번 파일에 새 애니메이션으로 변환되지 않습니다.</p><p><a class="primary" id="factoryUsdDownload" href="${API}/stages/${job.id}/portable" download="Factory.usdz" style="display:inline-block;padding:12px;border-radius:6px">전체 공장 Factory.usdz 다운로드</a></p><p><a href="${API}/stages/${job.id}/portable-report">검증 결과 JSON</a> · <a href="${API}/stages/${job.id}/snapshot">내보낸 배치 JSON</a></p><label>동일 서버 Omniverse에서 열기<textarea readonly rows="2" style="width:100%">${esc(r.file)}</textarea></label><p>USD 재오픈·좌표·형상·시간축 검증 완료. Omniverse 화면 검수는 별도입니다.</p>`;
 }
 button.onclick=()=>guard(async()=>{
  if(!window.composerReady||busy)throw Error('공장 불러오기 또는 저장 완료 후 실행하세요.');
  if(!doc?.instances?.length)throw Error('내보낼 설비 또는 건축 객체가 없습니다.');
  panel.showModal();button.disabled=true;result.textContent='';progress.textContent='현재 화면 DB 저장 중';
  try{
   await save();if(dirty||!doc.version)throw Error('저장 중 변경사항이 있습니다. 저장 완료 후 다시 실행하세요.');
   const job=await api('/stages',{layoutId:doc.id,version:doc.version,portable:true});
   localStorage.setItem('p006-portable-stage:'+doc.id,job.id);
   for(let n=0;n<200;n++){
    const current=await api('/stages/'+job.id);show(current);
    if(current.state!=='RUNNING')return;
    await new Promise(resolve=>setTimeout(resolve,1000));
   }
   throw Error('생성 확인 시간이 초과되었습니다. 최근 전체 USD 결과에서 다시 확인하세요.');
  }catch(error){progress.textContent='전체 USD 생성 실패';result.textContent=error.message;}finally{button.disabled=false;}
 });
 const recent=document.createElement('button');recent.id='factoryUsdRecent';recent.textContent='최근 전체 USD';document.querySelector('.documentbar').append(recent);
 recent.onclick=()=>guard(async()=>{const id=localStorage.getItem('p006-portable-stage:'+doc?.id);if(!id)throw Error('이 브라우저에서 생성한 전체 USD가 없습니다.');panel.showModal();result.textContent='';show(await api('/stages/'+id));});
})();
