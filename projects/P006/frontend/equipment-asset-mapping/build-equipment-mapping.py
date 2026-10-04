"""Generate an evidence-scoped equipment mapping. Does not change live resolver, USD, DB, or quality state."""
from pathlib import Path
import json,hashlib,collections,time,datetime,shutil
t=time.monotonic(); root=Path('/opt/Resonance/projects/P006/frontend'); project=Path('/home/sjkim/OmniverseProjects'); here=Path(__file__).parent
out=root/'equipment-asset-mapping';out.mkdir(exist_ok=True)
def load(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(n,x):(out/n).write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
paths={'equipment':root/'equipment-master.json','catalog724':root/'catalog-expansion700/independent-catalog.json','entries666':root/'entry-catalog/entries.json','images666':root/'visual-catalog/catalog.json','dimensions':project/'equipment-dimension-profiles.json','legacy':root/'catalog/manifest.json','stations':Path('/opt/Resonance/projects/P006/runtime/casting-contract.json'),'quality':root/'base204-quality-v3/all666.json'}
before={str(p):digest(p) for p in paths.values()}
eq=load(paths['equipment'])['equipment'];cat=load(paths['catalog724'])['assets'];entries=load(paths['entries666']); dims=load(paths['dimensions'])['profiles']; legacy=load(paths['legacy'])['assets'];station=load(paths['stations']);rules=load(here/'equipment-mapping-rules.json')['rules']
assert len(eq)==16 and len(cat)==724 and len(entries)==666
ci={a['id']:a for a in cat}; ei={a['id']:a for a in entries}; li={a['id']:a for a in legacy}; codes={x['code'] for x in eq}
assert {r['code'] for r in rules}==codes and len(rules)==len(codes)
db={n:load('/tmp/p006-map-'+n+'.json') for n in ['dt_scene','dt_scene_object','dt_simulation_scenario']}
scenarioCodes={p['code'] for s in db['dt_simulation_scenario'] for p in s['parameters_json']['processes']}
assert scenarioCodes==codes
for a in entries:
 for key in ['entryPath','sourceUsd']:
  p=Path(a[key]);assert p.is_file(),str(p);before.setdefault(str(p),digest(p))
 assert digest(a['entryPath'])==a['entrySha256'],a['id']
 assert digest(a['sourceUsd'])==a['sourceSha256'],a['id']
def candidate(id):
 a=ci[id];e=ei.get(id)
 return {'assetId':id,'name':a['name'],'englishName':e.get('englishName') if e else a.get('englishName'),'purpose':a['purpose'],'kind':a['kind'],'processConnections':a.get('connections',[]),'entryUsd':e.get('entryPath') if e else None,'sourceUsd':e.get('sourceUsd') if e else None,'sourcePrim':e.get('sourcePrim') if e else None,'baseUsd':e.get('basePath') if e else None,'variant':e.get('variantInfo',{}) if e else {},'baseMembers':e.get('baseMembers') if e else None,'image':'../visual-catalog/images/'+id+'.png' if e else None,'usdConnected':bool(e),'modelXYZMeters':e.get('dimensions') if e else None,'geometryState':e.get('geometryState') if e else 'BLOCKED','qualificationInherited':False}
rows=[]
for r in rules:
 m=next(x for x in eq if x['code']==r['code']);a=candidate(r['asset']) if r['asset'] else None
 alts=[dict(candidate(id),candidateState=state,reason=why) for id,state,why in r['alternatives']]
 prof=dims[r['code']]
 evidence=[{'type':'EQUIPMENT_MASTER','source':str(paths['equipment']),'locator':r['code']},{'type':'DB_SCENARIO_CODE','source':'woosu_digital_twin.dt_simulation_scenario','locator':r['code']},{'type':'REPRESENTATIVE_RENDER_VISUALLY_REVIEWED','source':str(root/'equipment'/m['image']),'note':'기존 프로젝트 대표 렌더 이미지. 현장 사진·실제 설치/모델 증거로 간주하지 않음'},{'type':'PRIOR_DIMENSION_RECORD_NOT_REAUDITED','source':str(paths['dimensions']),'record':prof}]
 if a:evidence.append({'type':'USD_RENDER_VISUALLY_REVIEWED','source':str(root/'visual-catalog/images'/str(r['asset']+'.png')),'note':r['visual']})
 rejectedIds=[z['assetId'] for z in alts if z['candidateState']=='REJECTED']
 row=dict(r,equipmentName=m['name'],equipmentTypeCode=r['code'],installedEquipmentId=None,manufacturer=None,model=None,identityState='UNBOUND',representativeImage='../equipment/'+m['image'],recommended=a,alternatives=alts,evidence=evidence,dimensionsRecord=prof,ports={'direction':'UNVERIFIED','location':None,'count':None,'source':'NOT_APPROVED','workpieceIn':r['flowIn'],'workpieceOut':r['flowOut'],'note':'역할 기반 논리 설명이며 실제 포트/좌표가 아니다'},transform={'translation':None,'rotation':None,'scale':None,'status':'NOT_CALIBRATED'},confidenceMeaning='수동 근거 기반 추천 적합도 /100. 실물 일치 확률이나 검증 점수 아님; 미선정은 null',modificationRequired=True,connectionStatus={'EXACT_MATCH':'PENDING_IDENTITY_GATE','CLOSE_MATCH':'MODIFICATION_REQUIRED','REFERENCE_MATCH':'REFERENCE_ONLY_PENDING_ACCEPTANCE','NO_MATCH':'UNASSIGNED','BLOCKED':'EVIDENCE_BLOCKED'}[r['grade']],connectionCompleted=False,assignmentPersisted=bool(a),catalogScope=724,rejectedIds=rejectedIds,reviewStatus='REVIEWED',runtimeApplied=False,assetReadyPromoted=False,realPromoted=False)
 rows.append(row)
counts={k:sum(r['grade']==k for r in rows) for k in ['EXACT_MATCH','CLOSE_MATCH','REFERENCE_MATCH','NO_MATCH','BLOCKED']}
assert sum(counts.values())==16
instances=[]
for obj in db['dt_scene_object']:
 oldId=obj['asset_code'].removeprefix('catalog_').upper();old=li.get(oldId);code=old.get('assetCode') if old else None; match=next((r for r in rows if r['code']==code),None)
 instances.append({'objectId':obj['object_id'],'legacyAssetCode':obj['asset_code'],'legacyAssetId':oldId,'legacyName':old.get('name') if old else None,'equipmentCode':code,'primPath':obj['prim_path'],'savedTransform':obj['transform_json'],'matchingGrade':match['grade'] if match else 'BLOCKED','recommendedAssetId':match['asset'] if match else None,'linkageSource':'legacy catalog assetCode; NAME_PATH_RULE provenance; installed identity NOT verified','runtimeApplied':False})
st=[]
for s in station['stations']:
 id=s['auditId'];c=candidate(id) if id in ci else None
 status='BLOCKED' if id=='E001' or not c else 'REFERENCE_MATCH'
 st.append({'stationId':s['id'],'name':s['name'],'sourceMode':station['mode'],'oldAssetId':id,'candidate':c,'grade':status,'reason':'독립 724종 밖의 불완전 기반 자산; 주조 본체 대체 금지' if not c else '트리밍/펀칭 식별 충돌로 확정 보류' if id=='E001' else 'SIMULATOR 스테이션의 기능 기준 자산; 실제 설치 여부 미확인','countedAsInstalledEquipment':False,'logicalPorts':s['ports'],'portVerified':False,'runtimeApplied':False})
metrics={'catalog':724,'usdConnected':666,'catalogBlocked':58,'equipmentTypes':16,'identifiedInstalledEquipment':0,'savedSceneObjects':len(instances),'simulatedStations':len(st),'mappingReviewed':16,'recommendedEntryAssignments':sum(bool(r['recommended']) for r in rows),'recommendationCoveragePercent':round(100*sum(bool(r['recommended']) for r in rows)/16,2),'connectionCompleted':0,'connectionCompletedPercent':0,'referenceOnlyRecommendations':counts['REFERENCE_MATCH'],'runtimeWrites':0,'businessWrites':0,'deviceWrites':0,**counts}
scope={'canonicalLedger':'equipment-master.json + active DB scenario code equality','frozenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PROJECT_EQUIPMENT_TYPE_LEDGER_CONFIRMED','countBasis':'16 unique equipment codes, not 16 installed machine serial numbers','sources':{k:str(p) for k,p in paths.items()},'database':'woosu_digital_twin at 127.0.0.1:35433, read-only transaction','dbTablesInspected':['dt_scene','dt_scene_object','dt_simulation_scenario'],'physicalIdentityLedgerFound':False,'boundaries':['기존 원본 자료 심층조사는 재실행하지 않음; 축적된 증거/대표 이미지/현재 연결 상태 대조','계정·PLC·이벤트·설비 상태 데이터 변경 없음','저장 객체 2개는 설비 종류 수에 더하지 않음','시뮬레이터 스테이션 6개는 설치 장비 수에 더하지 않음','724종은 자산 종류이지 실제 설비 목록이 아님','현재 DB에서 별도 설치 장비 대장 테이블을 발견하지 못함; 현장 전체 설치 대수는 미확정']}
save('mapping.json',{'version':'P006-EQUIPMENT-MAPPING-1','metrics':metrics,'scope':scope,'equipment':rows,'sceneInstances':instances,'simulationStations':st})
save('equipment-ledger.json',{'scope':scope,'equipment':eq,'scenarioCodes':sorted(scenarioCodes),'sceneInstances':instances})
save('sources.json',{'paths':scope['sources'],'hashes':before,'dbReadSnapshot':db})
save('catalog-screening.json',{'count':724,'scope':'NAME_PURPOSE_ROLE_PROCESS_METADATA_SCREENING_NOT_ALL_GEOMETRY_VERIFIED','assets':[{'id':a['id'],'name':a['name'],'purpose':a['purpose'],'connections':a.get('connections',[]),'inEntryCatalog':a['id'] in ei,'selectedFor':[r['code'] for r in rows if r['asset']==a['id']],'shortlistedFor':[r['code'] for r in rows if any(z['assetId']==a['id'] for z in r['alternatives'])]} for a in cat]})
save('tests.json',{'status':'PASS','equipmentLedgerUnique':len(codes),'scenarioSetEqualsMaster':True,'reviewed':len(rows),'catalogScreened':len(ci),'gradeSum':sum(counts.values()),'allRecommendationsHaveEntry':all(Path(r['recommended']['entryUsd']).is_file() for r in rows if r['recommended']),'noBlockedForcedMapping':all(not r['recommended'] for r in rows if r['grade'] in ['BLOCKED','NO_MATCH']),'noExactWithoutIdentity':counts['EXACT_MATCH']==0,'eachHasReasonAndSources':all(r['reason'] and r['evidence'] for r in rows),'sourceImageCount':16,'candidateRenderImagesInspected':12,'promotionWrites':0,'deviceWrites':0,'businessWrites':0})
doc='''# P006 설비 기준 3D 매핑 설계·QA\n\n원씽: 현재 설비 코드 원장 전체를 기준으로 자산 추천을 영속 저장하고 미확정 연결을 분리한다.\n\n## 범위 및 근거\n16개 설비 코드가 equipment-master와 현재 DB의 ACTIVE 시나리오에서 일치. 제조사/모델/일련번호 장비 원장은 없음. 설치 장비 16대로 선언하지 않는다. 저장 객체 2개와 SIMULATOR 스테이션 6개는 별도 표시. 724종 카탈로그의 이름/용도/역할/공정 메타데이터를 검토했으며 모든 724개 형상을 실물과 대조한 것은 아니다. 대표 렌더 16장과 12개 주요 후보 렌더를 시각 비교했다.\n\n## 판정 및 데이터 모델\n설계 입력 equipment-mapping-rules.json → build-equipment-mapping.py → mapping.json / 원장 / 증거 / 화면. EXACT는 실물 식별·구성·치수·포트의 직접 근거 필요. CLOSE는 수정 대기, REFERENCE는 기준 표현 추천이며 사용자 수용 전 연결 완료 아님. NO_MATCH는 확인된 역할에 대응하는 적정 전체 자산 없음, BLOCKED는 대상 경계/기능/형상 충돌을 풀기 전 판정 불가. 신뢰도는 수동 적합도이며 실물 일치 확률이 아니다. 점수로 검증 상태를 승격하지 않는다.\n\n## 화면·공정·액터\n프로젝트 검토자/설계자: 원장 범위 확인 → 공정/등급 검색 → 대표 렌더와 후보 비교 → Entry/Base/Variant 확인 → 수정/근거 부족 확인. 한 페이지에서 16개 전수 결과·저장 인스턴스·시뮬레이터 스테이션을 분리한다. 공개된 기존 자산 정적 경로를 재사용하는 읽기 전용 화면이며 계정 정보 없음. 실제 장비 설치 정보가 추가되면 해당 식별 필드는 인증/권한 보호 API로 이관해야 한다.\n\n## KPI 및 연결 정책\n추천 Entry 경로 연결 수와 실제 연결 완료 수를 분리. 수정/스케일/TCP/포트가 미확정인 CLOSE/REFERENCE 추천을 생산용 연결 완료로 집계하지 않는다. 현재 실행 중인 resolver/DB scene/724·666·58 기준선/READY/REAL을 변경하지 않는다. 논리 입출력 역할은 설명이며 실제 방향/좌표는 UNVERIFIED와 null. 제어반/냉각/진공은 직렬 작업물 공정으로 강제하지 않는다.\n\n## 다음 병목\n설비 코드 → 설치 장비 ID 식별 부재, 트리밍/펀칭 원본 명칭 충돌, 냉각/고압/필터 역할 미확정. 우선 E005/E004/E001의 치수/지지대/설비 식별을 해소해 CLOSE 후보를 검증한다. 새 자산 추가나 기존 USD 임의 스케일 변경은 수행하지 않는다.\n\n## 자동 검증\n16 코드 집합·ACTIVE 시나리오 일치, 724/666 기준선, 666 Entry와 원본 SHA, 모든 매핑의 근거/경로, BLOCKED 무강제 연결, 미검증 무승격. 브라우저 검색/필터/이미지 확대/단일 설비 상세/Base/Variant/모바일/실제 이미지 디코딩은 browser-qa.json에 별도 기록.\n'''
(out/'design-qa.md').write_text(doc,encoding='utf-8')
shutil.copy2(here/'equipment-mapping-page.html',out/'index.html')
for n in ['equipment-mapping-rules.json','build-equipment-mapping.py']:shutil.copy2(here/n,out/n)
assert all(digest(p)==h for p,h in before.items()),'SOURCE_CHANGED'
save('preservation.json',{'status':'PASS','unchangedFileCount':len(before),'hashes':before,'USDMutations':0,'resolverMutations':0,'DBWrites':0,'qualificationPromotions':0})
(out/'process-test.md').write_text('# 설비별 매핑 검토 절차\n\n검토 계정/액터: 공개 읽기 전용 프로젝트 검토자. 인증된 승인/운영 쓰기 테스트가 아님.\n\n'+ '\n\n'.join(f"{i+1}. 공정 {r['process']} → 설비 {r['equipmentName']}\n   입력: {r['code']} → 기능: 대표 이미지/추천 렌더/근거/Entry 조회 → 출력: {r['grade']} / {r['asset'] or '미선정'}\n   검증: 고유 코드·근거·경로 존재 확인. 실제 연결 완료: 아니오.\n   다음 조건: {r['need']}" for i,r in enumerate(rows))+'\n\n브라우저 동작 결과: browser-qa.json 참고. 업무 DB 쓰기 0, PLC 쓰기 0.\n',encoding='utf-8')
save('deployment.json',{'seconds':round(time.monotonic()-t,3),'bytes':sum(p.stat().st_size for p in out.iterdir() if p.is_file()),'url':'http://172.16.1.232/projects/P006/assets/equipment-asset-mapping/index.html'})
print(json.dumps(metrics,ensure_ascii=False));print('seconds',round(time.monotonic()-t,3))
