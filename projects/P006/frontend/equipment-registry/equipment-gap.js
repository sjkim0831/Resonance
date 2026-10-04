(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.P006EquipmentGap=api;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const PILOT_PRODUCT='DEMO_TWO_PART_ASSEMBLY';
  const PILOT_BOM=[{partId:'DEMO_PART_A',quantity:1},{partId:'DEMO_PART_B',quantity:1}];
  const PILOT_REQUIREMENTS=[['E001'],['A410'],['A203','E122','E053']];
  function requirements(design,workflow){
    if(!design?.factories?.length)return [];
    const pilot=design.factories.length===3&&workflow?.productId===PILOT_PRODUCT&&JSON.stringify(workflow.bom)===JSON.stringify(PILOT_BOM);
    return design.factories.map((factory,index)=>{
      const step=workflow?.factorySteps?.find(x=>x.factoryInstanceId===factory.factoryInstanceId);
      const explicit=Array.isArray(step?.requiredAssetIds)?step.requiredAssetIds.filter(Boolean):[];
      const ids=explicit.length?explicit:(pilot?PILOT_REQUIREMENTS[index]:[]);
      return {factoryInstanceId:factory.factoryInstanceId,factoryName:factory.name,layoutId:factory.layoutId,taskName:step?.taskName||'',source:explicit.length?'USER_SPECIFIED':pilot?'FUNCTIONAL_DEMO_CONTRACT':'UNSPECIFIED',requiredAssetIds:[...new Set(ids)]};
    });
  }
  function evaluate(design,workflow,references,catalog){
    const byId=new Map((catalog||[]).map(x=>[x.id,x]));
    const items=[];
    for(const group of requirements(design,workflow)){
      const ref=references?.[group.factoryInstanceId];
      if(!group.requiredAssetIds.length){items.push({...group,assetId:null,status:'REQUIREMENT_UNRESOLVED',reason:'필수 설비 ID 근거가 없어 자동 추천 불가'});continue;}
      for(const assetId of group.requiredAssetIds){
        const asset=byId.get(assetId),present=ref?.assetIds?.includes(assetId);
        const status=!ref?.exists?'LAYOUT_UNAVAILABLE':present?'PRESENT':!asset?'REGISTRY_UNRESOLVED':!asset.entry_usd?'MISSING_USD_BLOCKED':'MISSING_CANDIDATE';
        items.push({...group,assetId,assetName:asset?.name||null,usdConnected:!!asset?.entry_usd,status,reason:status==='MISSING_CANDIDATE'?'필수 설비 ID가 공장 배치에 없음':status==='PRESENT'?'해당 공장에 배치됨':status==='MISSING_USD_BLOCKED'?'자산 원장에 있으나 USD 연결 없음':status==='REGISTRY_UNRESOLVED'?'자산 원장 확인 불가':status==='LAYOUT_UNAVAILABLE'?'저장 공장 참조 조회 실패':''});
      }
    }
    return {items,missing:items.filter(x=>x.status==='MISSING_CANDIDATE').length,blocked:items.filter(x=>x.status==='MISSING_USD_BLOCKED'||x.status==='REGISTRY_UNRESOLVED'||x.status==='LAYOUT_UNAVAILABLE').length,unresolved:items.filter(x=>x.status==='REQUIREMENT_UNRESOLVED').length};
  }
  return {requirements,evaluate};
});
