let referenceCount = 0, registeredCount = 0;
function updateCount() {
  const count = document.querySelector('#evidenceCount');
  if (!count) return;
  const match = count.textContent.match(/^자료\s*(\d+)/);
  if (match) registeredCount = Number(match[1]);
  const text = `조사 ${referenceCount}개 · 등록 ${registeredCount + Number(count.dataset.assetEvidenceCount || 0)}개`;
  if (count.textContent !== text) count.textContent = text;
}
const sources = {
  N076: [
    ['제조사 제품·사진', 'MATSUKI MAH 시리즈 · 유압 딥드로잉 프레스', 'https://www.matsuki.co.th/products/hydraulic-press-machine-and-hydraulic-system/253-hydraulic-deep-draqing-press-1-000-25-000kn-mah-series', '프레임·작업대·램 형상 및 MAH-500 사양 비교용. N076 제조사·실측 사양은 미확인입니다.'],
    ['구조·기능 참고', 'EBR Metal · 유압 딥드로잉 프레스', 'https://www.ebrmetal.com/products/hydraulic-presses/hydraulic-deep-drawing-presses/', '용접 프레임·제어·주문 제작 구성 참고. 해당 설비와의 동일성은 미확인입니다.'],
    ['비교 제품', 'ASAI · 유압 프레스 제품군', 'https://asai-corp.co.jp/englishydraulic/', '딥드로잉 프레스 형상·제품군 비교 자료입니다.'],
    ['현재 모델', 'N076 카탈로그 이미지', '/projects/P006/assets/visual-catalog/images/N076.png', '품질 개선 전후 비교 기준인 현재 프로젝트 렌더입니다.']
  ],
  E096: [
    ['매뉴얼', 'Dake 10/20톤 유틸리티 프레스 매뉴얼', 'https://dakecorp.com/wp-content/uploads/2023/10/10-20-ton-bench-floor-utility-press-manual-2024-v1.pdf', '실린더·스트로크·작업 공간 참고. 문서의 수치는 Dake 모델 기준입니다.'],
    ['조립 안내', 'Dake B-10 조립·구조 안내', 'https://blog.dakecorp.com/en-us/how-to-assemble-the-dake-b-10-utility-press', '헤드·테이블·핸드 펌프·복귀 구조 참고.'],
    ['제품 안내', 'Dake 유압 프레스 가이드', 'https://blog.dakecorp.com/en-us/the-handy-guide-to-dake-hydraulic-presses', '소형 유압 프레스의 종류와 사용 범위 참고.'],
    ['개선 모델', 'E096 개선 GLB · 동작 시연 포함', '/projects/P006/assets/3d-derived/equipment-studio/E096-reference-v1.glb', '가상 시각화 후보 · 기존 모델과 비교 검토할 제작 산출물.']
  ]
};
export function renderReferenceMaterials(assetId) {
  let box = document.querySelector('#assetReferenceMaterials');
  if (!box) {
    const list = document.querySelector('#evidenceList');
    if (!list) return;
    box = document.createElement('section');
    box.id = 'assetReferenceMaterials';
    box.style.cssText = 'margin:12px 0;padding:16px;border:1px solid #cadce5;border-radius:10px;background:#f6fafc';
    list.before(box);
  }
  box.replaceChildren();
  const title = document.createElement('h4');
  title.textContent = assetId ? `${assetId} · 참고 자료 및 개선 모델` : '참고 자료 및 개선 모델';
  box.append(title);
  const rows = sources[assetId] || [];
  referenceCount = rows.length;
  updateCount();
  const caption = document.createElement('p');
  caption.textContent = rows.length ? `자료 ${rows.length}개 · 제조사 참고 자료와 제작 후보입니다. ${assetId} 실물 모델과의 동일성은 미확인입니다.` : '이 설비에 연결된 조사 자료가 없습니다. 아래 자료 등록에서 보유 자료를 추가하세요.';
  box.append(caption);
  rows.forEach(([kind, name, url, note]) => {
    const row = document.createElement('article');
    row.style.cssText = 'padding:12px 0;border-top:1px solid #dce7ed';
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = `${kind} · ${name} ↗`;
    const detail = document.createElement('p');
    detail.style.cssText = 'margin:5px 0 0;color:#526c80;font-size:13px';
    detail.textContent = note;
    row.append(a, detail); box.append(row);
  });
  if (assetId === 'E096') {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '이 화면에서 개선 모델·애니메이션 확인';
    summary.style.cssText = 'cursor:pointer;padding:12px 0;font-weight:700;color:#007f8c';
    details.append(summary);
    details.addEventListener('toggle', () => {
      if (!details.open || details.querySelector('iframe')) return;
      const frame = document.createElement('iframe');
      frame.title = 'E096 개선 모델과 애니메이션 검토';
      frame.src = './E096-reference-review.html?rev=studio-materials-1';
      frame.style.cssText = 'width:100%;height:660px;border:1px solid #dce7ed;border-radius:8px';
      details.append(frame);
    });
    box.append(details);
  }
}
const preview = document.querySelector('#preview');
const count = document.querySelector('#evidenceCount');
document.addEventListener('p006-asset-evidence-count',updateCount);
if (count) new MutationObserver(updateCount).observe(count,{childList:true,characterData:true,subtree:true});
if (preview) new MutationObserver(() => renderReferenceMaterials(preview.dataset.asset)).observe(preview, {attributes:true,attributeFilter:['data-asset']});
renderReferenceMaterials(new URLSearchParams(location.search).get('asset'));
document.querySelector('#newEquipment')?.addEventListener('click', () => renderReferenceMaterials(null));
