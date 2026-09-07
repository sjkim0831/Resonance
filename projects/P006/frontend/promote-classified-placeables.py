#!/usr/bin/env python3
import argparse,datetime,json,pathlib

root=pathlib.Path(__file__).parent/'catalog'
manifest_path=root/'manifest.json'
classification_path=root/'equipment-classification.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
classification=json.loads(classification_path.read_text(encoding='utf-8'))
classified={row['assetId']:row for row in classification['classifications']}
blocked_tokens=('manual','메뉴얼','매뉴얼','목차','표지','license','readme')
candidates=[]
for asset in manifest['assets']:
 row=classified.get(asset['id'])
 if asset.get('compositionStatus')!='REFERENCE_ONLY' or not row:continue
 name=str(asset.get('name','')).lower()
 if row.get('status')!='AUTO_APPROVED' or float(row.get('confidence',0))<.85:continue
 if not asset.get('preview') or any(token in name for token in blocked_tokens):continue
 candidates.append((asset,row))

parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
before=sum(a.get('compositionStatus') in ('PLACEABLE','PROMOTED_MODULE') for a in manifest['assets'])
promoted=[]
if args.apply:
 for asset,row in candidates:
  asset.update(compositionStatus='PROMOTED_MODULE',placeable=True,assetCode=row['equipmentCode'],compositionConfidence=float(row['confidence']),compositionSource='AUTO_CLASSIFICATION_PROXY',partRole='ASSEMBLY',dimensionEvidence=asset.get('dimensionEvidence') or 'IMAGE_SCALE_REQUIRED')
  promoted.append({'assetId':asset['id'],'name':asset['name'],'equipmentCode':row['equipmentCode'],'confidence':row['confidence'],'preview':asset['preview']})
 counts={key:sum(a.get('compositionStatus')==key for a in manifest['assets']) for key in ('PLACEABLE','PROMOTED_MODULE','REFERENCE_ONLY','PACKAGE_COMPONENT')}
 manifest['composition']={'placeable':counts['PLACEABLE'],'promotedModules':counts['PROMOTED_MODULE'],'review':0,'packageComponents':counts['PACKAGE_COMPONENT'],'referenceOnly':counts['REFERENCE_ONLY']}
 manifest['classifiedPlaceablePromotion']={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'policy':'AUTO_APPROVED confidence >= 0.85 preview required manuals excluded','beforePlaceable':before,'promotedCount':len(promoted),'afterPlaceable':before+len(promoted)}
 manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 (root/'classified-placeable-promotion.json').write_text(json.dumps({'status':'PASS','promoted':promoted,'summary':manifest['classifiedPlaceablePromotion']},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'PASS','mode':'APPLY' if args.apply else 'DRY_RUN','beforePlaceable':before,'candidateCount':len(candidates),'afterPlaceable':before+len(candidates),'candidateIds':[a['id'] for a,_ in candidates]},ensure_ascii=False))
