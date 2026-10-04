(() => {
  'use strict';
  function playbackGate(input = {}) {
    const sequence = Array.isArray(input.sequence) ? input.sequence : [];
    const set = new Set(Array.isArray(input.equipmentSet) ? input.equipmentSet : []);
    const supported = input.supportedAssetIds instanceof Set ? input.supportedAssetIds : new Set(input.supportedAssetIds || []);
    const factory = input.factory || null, reference = input.reference || null;
    const reasons = [];
    if (!String(input.productName || '').trim()) reasons.push('제품 미선택');
    if (!String(input.siteName || '').trim()) reasons.push('부지 이름 미입력');
    if (!factory || !reference?.exists) reasons.push('공장 설비 정보 미확인');
    if (factory && reference?.exists && reference.currentVersion !== factory.layoutVersion) reasons.push('공장 버전 불일치');
    if (sequence.length < 2) reasons.push('동일 공장 설비 2개 이상 필요');
    if (sequence.some(x => x.factoryInstanceId !== factory?.factoryInstanceId)) reasons.push('공장 간 이송 미지원');
    if (sequence.some(x => !set.has(x.instanceId))) reasons.push('설비 세트에 없는 Instance 포함');
    if (sequence.some(x => !supported.has(x.assetId))) reasons.push('Anchor 미등록 설비 포함');
    if (sequence.some(x => !reference?.instances?.some(y => y.instanceId === x.instanceId && y.assetId === x.assetId))) reasons.push('공정 Instance가 저장 Layout과 불일치');
    return { ready: reasons.length === 0, reasons };
  }
  const api = Object.freeze({ playbackGate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.P006_PRODUCTION_WORKFLOW_CORE = api;
})();
