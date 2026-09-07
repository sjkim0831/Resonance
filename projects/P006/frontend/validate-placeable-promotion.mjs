import {existsSync,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'catalog');
const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
const report=JSON.parse(readFileSync(join(root,'classified-placeable-promotion.json'),'utf8'));
const ids=new Set(),duplicates=[],missingPreviews=[];
for(const asset of manifest.assets){if(ids.has(asset.id))duplicates.push(asset.id);ids.add(asset.id);if(!asset.preview||!existsSync(join(root,asset.preview)))missingPreviews.push(asset.id)}
const placeable=manifest.assets.filter(asset=>['PLACEABLE','PROMOTED_MODULE'].includes(asset.compositionStatus));
const promoted=manifest.assets.filter(asset=>asset.compositionSource==='AUTO_CLASSIFICATION_PROXY');
const result={status:'PASS',registered:manifest.assets.length,placeable:placeable.length,promoted:promoted.length,referenceOnly:manifest.assets.filter(asset=>asset.compositionStatus==='REFERENCE_ONLY').length,packageComponents:manifest.assets.filter(asset=>asset.compositionStatus==='PACKAGE_COMPONENT').length,duplicates:duplicates.length,missingPreviews:missingPreviews.length,reportCount:report.promoted.length};
if(result.placeable!==574||result.promoted!==109||result.duplicates||result.missingPreviews||result.reportCount!==109)throw new Error(JSON.stringify(result));
console.log(JSON.stringify(result));
