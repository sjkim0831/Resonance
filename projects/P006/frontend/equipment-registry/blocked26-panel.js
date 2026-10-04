// Separate analysis overlay; never mutates the 62 source rows or original matching grades.
const reviewLabels={REFERENCE_MATCH_POSSIBLE:'무수정 기준 추천 가능',EXISTING_ASSET_MODIFICATION:'기존 자산 수정 필요',EXISTING_ASSET_COMBINATION:'기존 자산 조합 가능',NEW_ASSET_REQUIRED:'신규 자산 필요 확정',EQUIPMENT_INFO_REQUIRED:'설비 정보 필요'};
const reviewBox=document.createElement('section');reviewBox.id='blocked26Summary';reviewBox.innerHTML='<h2>BLOCKED 26개 · 연결 불가 원인 전수 판정</h2><p>기존 REFERENCE 36개와 BLOCKED 26개의 매칭 등급은 보존합니다. 아래는 후속 해결 방식 판정이며 연결 완료 수가 아닙니다.</p><div id="reviewCounts" class="metrics"></div><p id="reviewExplanation">수정 후보는 기존 베이스를 검토하도록 연결한 것이며 무수정 기준 형상이나 실제 설비 이미지가 아닙니다. 20개는 실측 수치보다 먼저 장비 방식/구조/도면 적용 관계가 필요합니다.</p><a href="blocked26-design.md">26개 판정 설계·업무 절차</a> · <a href="blocked26-qa.json">보존·API 검증</a> · <a href="blocked26-browser-qa.json">화면 검증</a>';
$('#metrics').after(reviewBox);
const filterLabel=document.createElement('label');filterLabel.innerHTML='후속 판정 <select id="reviewFilter"><option value="">전체 62개</option><option value="BASELINE_REFERENCE">기존 REFERENCE 36개</option>'+Object.entries(reviewLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')+'</select>';$('.toolbar').append(filterLabel);
const th=document.createElement('th');th.id='reviewHeading';th.textContent='후속 판정 · 필요한 추가 정보';$('thead tr').append(th);
const baselineRender=render;
render=function(){const allRows=data,f=$('#reviewFilter').value;data=allRows.filter(x=>!f||(f==='BASELINE_REFERENCE'?x.grade==='REFERENCE_MATCH':x.review_decision===f));baselineRender();data=allRows;
 $('#shown').textContent=`표시 ${visible.length} / 전체 ${data.length} · 선택 ${selected.size}`;
 $('#reviewCounts').innerHTML=Object.entries(reviewLabels).map(([k,v])=>`<article>${v}<b>${data.filter(x=>x.review_decision===k).length}</b></article>`).join('');
 [...$('#rows').rows].forEach((tr,i)=>{const x=visible[i],v=x.blocked_review,td=tr.insertCell();td.className='reviewCell';td.style.minWidth='260px';
  if(!v){td.innerHTML='<b>기존 REFERENCE 유지</b><p>실물 도면·규격·방향·포트 확인 후 연결 수용 검토. 이번 26개 분석의 승격/삭제 대상 아님.</p>';return;}
  td.innerHTML=`<b>${esc(reviewLabels[x.review_decision])}</b><small>${esc(x.review_decision)}</small><p>${esc(v.reason)}</p><strong>필요한 추가 정보</strong><ul>${v.additionalInformation.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><details><summary>9개 기준 전수 판정</summary><dl>${Object.entries(v.assessment).map(([k,s])=>`<dt><b>${esc(k)}</b></dt><dd>${esc(s)}</dd>`).join('')}</dl></details><details><summary>추가 원본 근거와 한계</summary><pre>${esc(JSON.stringify(v.sources,null,2))}</pre><p>${esc(v.dimensionsPolicy)}</p></details><details><summary>대체/조합 대상 검토</summary><pre>${esc(JSON.stringify(v.candidates,null,2))}</pre></details><b>${esc(v.finalConnectionStatus)}</b>`;
  if(x.review_asset_id){tr.cells[4].innerHTML=`<img loading="lazy" src="${esc(x.review_image)}" data-image="${esc(x.review_image)}" data-caption="${esc(x.review_asset_name)} 수정용 베이스 · 현재 설비의 추천/연결 이미지 아님" alt="수정 검토 베이스 ${esc(x.review_asset_name)}"><small>수정용 베이스 / 현재 형상과 다름</small>`;
   tr.cells[5].innerHTML=`<b>${esc(x.review_asset_name)}</b><small>수정 후보 ${esc(x.review_asset_id)} · 매칭 미수용</small><code>${esc(x.review_entry_usd)}</code><p>기존 매칭: BLOCKED 유지</p>`;}
 });
};$('#reviewFilter').onchange=()=>render();
// Existing handlers held the original function reference; all filters must use the enriched renderer.
for(const id of ['search','ownership','grade'])$('#'+id).oninput=()=>render();
if(data.length)render();
