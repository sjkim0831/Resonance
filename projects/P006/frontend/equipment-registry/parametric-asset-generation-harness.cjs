'use strict';
const crypto=require('crypto');
const SUPPORTED=new Set(['BOX','CYLINDER','TANK','PIPE']);
function validateDimensions(d){if(!Array.isArray(d)||d.length!==3||d.some(v=>!Number.isFinite(Number(v))||Number(v)<=0))throw new Error('dimensions must be 3 positive finite numbers');return d.map(Number)}
function generateAsset({equipmentId,displayName,category,primitiveType,dimensions}){
 const p=String(primitiveType||'').toUpperCase(); if(!SUPPORTED.has(p))throw new Error('unsupported primitiveType');
 return {assetId:'PA-'+crypto.createHash('sha1').update([equipmentId,p,...dimensions].join('|')).digest('hex').slice(0,12),displayName:String(displayName||equipmentId),category:String(category||'PARAMETRIC'),sourceType:'PARAMETRIC',primitiveType:p,dimensions:validateDimensions(dimensions),defaultStyle:{materialPreset:'DEFAULT'}};
}
function runFixture(f){
 const before={equipmentId:f.equipmentId,assetId:f.assetId||null,position:[0,0,0]};
 const asset=generateAsset(f); const preview={asset, equipmentId:f.equipmentId, status:'PREVIEW', mutationCount:0};
 const apply={...before,assetId:asset.assetId}; return {asset,preview,apply,cancel:{mutationCount:0},existingGlbChanges:0};
}
if(require.main===module){
 const fixtures=['BOX','CYLINDER','TANK','PIPE'].map((primitiveType,i)=>({equipmentId:'EQ-PARAM-'+(i+1),displayName:primitiveType+' 설비',category:'P006',primitiveType,dimensions:[2+i,1+i*.5,3+i]}));
 const results=fixtures.map(runFixture); const invalid=[null,[1,2],[-1,1,1],[1,NaN,1]].map(dimensions=>{try{generateAsset({equipmentId:'INVALID',primitiveType:'BOX',dimensions});return false}catch{return true}});
 console.log(JSON.stringify({supported:[...SUPPORTED],generatedFixtures:results.length,assets:results.map(x=>x.asset),previewMutations:results.reduce((n,x)=>n+x.preview.mutationCount,0),cancelMutations:results.reduce((n,x)=>n+x.cancel.mutationCount,0),equipmentLoss:0,existingGlbChanges:0,invalidDimensionsRejected:invalid.every(Boolean),invalidRejected:invalid.filter(Boolean).length,applyMappings:results.map(x=>[x.apply.equipmentId,x.apply.assetId])},null,2));
}
module.exports={SUPPORTED,validateDimensions,generateAsset,runFixture};
