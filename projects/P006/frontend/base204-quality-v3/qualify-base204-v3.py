"""Exhaust current shared-base qualification evidence without inventing design authority."""
import json,time,hashlib,collections,copy,sys,math
from pathlib import Path
from pxr import Usd,UsdGeom
R=Path(sys.argv[1]);start=time.time()
def read(p):return json.loads(Path(p).read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(n,v):(R/n).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf8')
a=read(R/'usd-audit.json');resolver=read(R/'resolver.json');prior=read(R/'quality-v2.json');catalog={r['id']:r for r in read(R/'catalog-analysis.json')['rows']};current={r['id']:r for r in a['rows']};rr={r['id']:r for r in resolver}
vmap={v['key']:v for v in a['variants']};build={r['id']:r for n in ['build176.json','build294.json'] for r in read(R/n)['assets']};control=read(R/'control-coverage-spec.json');cs={r['id']:r for r in control['assets']}
root=Path('/home/sjkim/OmniverseProjects');ref=root/'p006-reference-factory-v1';design=read(ref/'design.json');core={r['id']:r for r in design['core']};oldverified={r['id']:r['qualificationV2'] for r in prior['trackB'] if r.get('qualificationV2')}
assert len(a['bases'])==204 and len(current)==666 and len(oldverified)==10
protected={p:sha(p) for p in a['sourceHashes']};assert protected==a['sourceHashes']
baselineAudit=read(root/'p006-two-track-quality-v1/usd-audit.json')
assert protected==baselineAudit['sourceHashes'],'Source USD drift since preserved baseline'
live=Path('/opt/Resonance/projects/P006/frontend/coverage666/resolver.json');resolverhash=sha(live);assert read(live)==resolver
originalA=hashlib.sha256(json.dumps(prior['trackA'],sort_keys=True).encode()).hexdigest()
stages={};rows=[];tests=[];baseRows=[];timestamp=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
for r in a['rows']:
 aid=r['id'];cat=catalog[aid];v=vmap[r['variantKey']];path=r['path'];s=stages.setdefault(path,Usd.Stage.Open(path)) if path not in stages else stages[path];p=s.GetPrimAtPath(r['primPath'])
 geom=[x for x in Usd.PrimRange(p) if x.IsA(UsdGeom.Boundable)]
 inventory=[{'path':str(x.GetPath()),'type':x.GetTypeName()} for x in geom]
 identity=p.GetAttribute('catalog:id').Get() if p.GetAttribute('catalog:id') else None
 attrs=r['attributes'];evidenceSource=[]
 spec=build.get(aid);c=cs.get(aid);ev=oldverified.get(aid)
 checks={'composed':not r['compositionErrors'],'nonempty':r['bounds']['finiteNonempty'],'unit':r['units']==1,'upAxis':r['upAxis']=='Y','rootTransform':r['rootTransformValid'],'specificReference':r['primPath']!='/Catalog','identity':identity==aid,'floor':r['floorWithin1mm'],'technicalGeometry':v['technicalPass']}
 if spec:
  checks['referenceEnvelope']=max(abs(x-y) for x,y in zip(r['bounds']['sizeMeters'],spec['size']))<.001
  evidenceSource.append({'file':'build294.json' if 'p006-coverage666-v1' in path else 'build176.json','recordId':aid,'scope':spec['scope'],'missing':spec.get('missing'),'independentCoreDesign':False})
 if c:
  names={x.GetName() for x in geom};required={'Body','RearMount'}|{'Connector'+str(i) for i in range(c['ports'])}
  if c['display']:required.add('Display')
  required|={'din':{'MountClip'},'rack':{'Ear0','Ear1'},'panel':{'Bezel'},'drive':{'Fin'+str(i) for i in range(8)}}[c['form']]
  checks.update(referenceEnvelope=max(abs(x-y) for x,y in zip(r['bounds']['sizeMeters'],c['size']))<1e-6,configuration=p.GetVariantSets().GetVariantSet('form').GetVariantSelection()==c['form'],enclosureParts=names==required,orientation=attrs.get('orientation:forward')=='+Z')
  assert all(checks.values()),(aid,checks)
  evidenceSource.append({'file':'control-coverage-spec.json','sha256':sha(R/'control-coverage-spec.json'),'recordId':aid,'scope':control['scope'],'confirmed':'DIN/rack/panel/drive enclosure, display and illustrative connector layout','missing':'No asset-type-specific core layout establishing that generic enclosure is the named PLC/server/measurement apparatus. Envelope and connector count alone insufficient.','independentCoreDesign':False})
  tests.append({'id':aid,'test':'category2_design_comparison','result':'TECHNICAL_PASS_SEMANTIC_HOLD','checks':checks})
 if ev:
  sp=core[aid];names={x.GetName() for x in s.GetPrimAtPath('/Asset/Geometry').GetChildren()}
  checks.update(subjectHash=sha(path)==ev['subjectSha256'],designHash=sha(ev['source'])==ev['sourceSha256'],dependencyHashes=all(sha(f)==h for f,h in ev['dependencies'].items()),coreParts=names==set(ev['coreParts']),equipmentType=p.GetAttribute('readiness:equipmentType').Get()==sp['role'],referenceEnvelope=max(abs(x-y) for x,y in zip(r['bounds']['sizeMeters'],sp['dimensions']))<.0002,configuration=p.GetVariantSets().GetVariantSet('configuration').GetVariantSelection()==sp['variant'],orientation=attrs.get('reference:forwardAxis')=='+X')
  assert all(checks.values()),(aid,checks)
  evidenceSource.append({'file':ev['source'],'sha256':ev['sourceSha256'],'recordId':aid,'scope':ev['scope'],'independentCoreDesign':True,'review':ev['reviewer'],'visualEvidence':'../quality-v2/factory-preview.png'})
  tests.append({'id':aid,'test':'category1_full_requalification','result':'PASS','checks':checks})
 # Full geometry evidence cannot be inferred from a generated envelope, hooks or shared mesh.
 proof=bool(ev) and all(checks.values())
 assert not proof or aid in oldverified
 external=aid in {'E001','E002','E003','E004','E005','E006'}
 classification=1 if ev else 2 if c else 3 if spec else 5 if external else 4
 missing=[] if ev else ['TYPE_SPECIFIC_CORE_DESIGN'] if c else ['TYPE_SPECIFIC_CORE_DESIGN','QUALIFIED_DIMENSION_DATUM_BASIS']
 if not checks['identity']:missing.append('ASSET_ID_TO_SOURCE_PRIM_BINDING_EVIDENCE')
 if external:missing+=['SUPPORT_PLANE_VS_UNDERGROUND_PART_IDENTITY','EQUIPMENT_IDENTIFICATION']
 row={'id':aid,'name':r['name'],'baseKey':r['baseKey'],'variantKey':r['variantKey'],'path':path,'primPath':r['primPath'],'classification':classification,'classificationMeaning':{1:'현재 내부 근거로 즉시 검증 가능',2:'기존 설계와 추가 대조 대상',3:'Variant/구성별 개별 확인 필요',4:'치수/받침면/핵심 구성 근거 부족',5:'외부 장비 자료 필요'}[classification], 'checks':checks,'geometryState':'GEOMETRY_VERIFIED' if proof else 'USD_CONNECTED','nextVerificationPossibleNow':False,'externalEvidenceRequired':external,'evidenceSources':evidenceSource,'catalogRequirement':{'source':'catalog-analysis.json','id':aid,'structure':cat.get('structure'),'function':cat.get('assetSpecificFunction'),'remaining':cat.get('remaining'),'reviewLimit':cat.get('reviewLimit')},'missingEvidence':missing,'coreInventory':inventory,'geometryInheritance':'NONE; per-asset envelope, placement, identity and semantic design review required','variantSelection':v['selection'],'localShapeOverrides':r['localShapeOverrideCount'],'linkedIndependentStageCandidates':{'PHYSICAL':{'source':'usd-audit.json#variants/'+r['variantKey'],'schemas':v['physics'],'joints':v['joints'],'status':'CANDIDATE_NOT_PROOF'},'FUNCTION':{'source':'catalog-analysis.json#'+aid,'requirement':cat.get('assetSpecificFunction'),'usdTimeSamples':v['timeSamples'],'status':'REQUIREMENT_NOT_EXECUTION_EVIDENCE'},'PORT':{'source':'usd-audit.json#rows/'+aid,'definitions':r['ports'],'status':'ANCHORS_NOT_COMPATIBILITY_EVIDENCE'}},'PHYSICAL_VERIFIED':False,'FUNCTION_VERIFIED':False,'PORT_VERIFIED':False,'ASSET_READY':False,'REAL_VERIFIED':False}
 if ev:row['preservedQualification']=ev
 rows.append(row)
byid={r['id']:r for r in rows}
for b in a['bases']:
 members=[byid[x] for x in b['members']];classes={r['classification'] for r in members};assert len(classes)==1
 c=next(iter(classes));done=all(r['geometryState']=='GEOMETRY_VERIFIED' for r in members)
 outcome='VERIFIED' if done else 'PARTIAL_VERIFICATION' if c in [2,3] else 'EXTERNAL_EVIDENCE_REQUIRED' if c==5 else 'INTERNAL_EVIDENCE_INSUFFICIENT'
 signatures=collections.defaultdict(list)
 for r in members:signatures[r['variantKey']].append(r['id'])
 # Exact signatures allow only technical topology test reuse, not semantic type promotion.
 inheritance=[{'signature':k,'members':ids,'technicalReuseOnly':True,'geometryPromotionInherited':False,'reason':'Same structural signature does not prove same asset kind or approved design'} for k,ids in signatures.items()]
 baseRows.append({'key':b['key'],'path':b['path'],'sha256':b['sha256'],'members':b['members'],'names':[r['name'] for r in members],'configurationCount':len(signatures),'classification':c,'classificationMeaning':members[0]['classificationMeaning'],'outcome':outcome,'geometryVerified':sum(r['geometryState']=='GEOMETRY_VERIFIED' for r in members),'partialScope':'USD technical checks and reference envelope only; not partial GEOMETRY status' if outcome=='PARTIAL_VERIFICATION' else None,'missingEvidence':sorted({x for r in members for x in r['missingEvidence']}),'evidenceSourceIds':[r['id'] for r in members if r['evidenceSources']],'inheritanceDecisions':inheritance,'stageEvidenceLinked':True})
counts=collections.Counter(b['outcome'] for b in baseRows);classcounts=collections.Counter(b['classification'] for b in baseRows)
metrics={'baseTotal':204,'baseOutcomes':dict(counts),'baseClassifications':dict(classcounts),'assetsTotal':666,'GEOMETRY_VERIFIED':sum(r['geometryState']=='GEOMETRY_VERIFIED' for r in rows),'geometryUnverified':sum(r['geometryState']!='GEOMETRY_VERIFIED' for r in rows),'nextVerificationPossibleNow':sum(r['nextVerificationPossibleNow'] for r in rows),'externalEvidenceRequired':sum(r['externalEvidenceRequired'] for r in rows),'internalDesignNeeded':sum(r['geometryState']!='GEOMETRY_VERIFIED' and not r['externalEvidenceRequired'] for r in rows),'newPromotions':0,'preservedPromotions':10,'allConfigurationsChecked':len(a['variants']),'category2AssetsCompared':20,'technicalReuseOnly':666-len(a['variants']),'PHYSICAL_VERIFIED':0,'FUNCTION_VERIFIED':0,'PORT_VERIFIED':0,'ASSET_READY':0,'REAL_VERIFIED':0,'seconds':round(time.time()-start,3),'trackABlocked':58,'totalCatalog':724,'connected':666,'commonBottleneck':'자산 종류별 핵심 구성·기준 치수·받침면을 USD 구성에 대응시키는 추적 가능한 기준 설계가 부족함. 모델 생성 파라미터와 외피 유사성은 그 증거를 대체하지 않음.'}
assert metrics['GEOMETRY_VERIFIED']==10 and sum(counts.values())==204
assert len({r['id'] for r in rows})==666
assert len({b['key'] for b in baseRows})==204
assert sorted(x for b in baseRows for x in b['members'])==sorted(byid)
assert all(r['primPath']!='/Catalog' for r in rows)
for aid in cs:assert rr[aid]['primPath']=='/Catalog/'+aid
for row in rows:
 assert not any(row[k] for k in ['PHYSICAL_VERIFIED','FUNCTION_VERIFIED','PORT_VERIFIED','ASSET_READY','REAL_VERIFIED'])
tests.extend([{'test':'204_unique_bases_666_unique_assets_no_omissions','result':'PASS'}, {'test':'20_corrected_references_preserved','result':'PASS'}, {'test':'226_source_dependency_hashes_match_v1_baseline','result':'PASS'}, {'test':'no_function_physics_port_inheritance','result':'PASS'}])
assert all(sha(p)==h for p,h in protected.items()) and sha(live)==resolverhash
assert originalA==hashlib.sha256(json.dumps(prior['trackA'],sort_keys=True).encode()).hexdigest()
for name,value in [('all204.json',baseRows),('all666.json',rows),('metrics.json',metrics),('tests.json',tests)]:write(name,value)
write('preservation.json',{'sourceHashes':protected,'resolverSha256':resolverhash,'trackASha256':originalA,'baselinePromotions':list(oldverified),'sourceWrites':0,'resolverWrites':0,'stateDemotions':0,'deviceWrites':0,'externalRequestsSent':0,'internalOriginalDocumentRescan':False})
print(json.dumps(metrics,ensure_ascii=False,indent=2))
