"""Isolated Layout editing; never mutates asset/equipment/intake verification."""
import json,math,re,hashlib
from pathlib import Path
from service import rows,one,Fault,validid,text,adminonly,uid,Json,audit
from functional_contract_service import get_connection,get_motion,upsert_connection,upsert_motion
CONTRACT=json.loads((Path(__file__).parent/'composer.contract.json').read_text())
TEMPLATES={x['id']:x for x in CONTRACT['templates']}
TYPES=CONTRACT['relationshipTypes']
STYLE_PRESETS={'DEFAULT','CONCRETE','METAL','MATTE','GLOSSY','TRANSLUCENT'}
LIGHT_PRESETS={'BRIGHT','DEFAULT','DARK'}
def validate_style(v):
 if v is None:return None
 if not isinstance(v,dict) or set(v)-{'color','opacity','materialPreset','roughness','metalness'}:raise Fault(400,'스타일 필드 오류')
 if 'color' in v and (not isinstance(v['color'],str) or not re.fullmatch(r'#[0-9A-Fa-f]{6}',v['color'])):raise Fault(400,'색상 오류')
 for k in ('opacity','roughness','metalness'):
  if k in v and (isinstance(v[k],bool) or not isinstance(v[k],(int,float)) or not 0<=v[k]<=1):raise Fault(400,k+' 범위 오류')
 if 'materialPreset' in v and v['materialPreset'] not in STYLE_PRESETS:raise Fault(400,'재질 오류')
 return v
def validate_scene_style(v):
 if v is None:return None
 if not isinstance(v,dict) or set(v)-{'ambientIntensity','directionalIntensity','directionalDirection','shadowEnabled','lightingPreset'}:raise Fault(400,'Scene 스타일 필드 오류')
 for k,hi in [('ambientIntensity',10),('directionalIntensity',20)]:
  if k in v and (isinstance(v[k],bool) or not isinstance(v[k],(int,float)) or not 0<=v[k]<=hi):raise Fault(400,k+' 범위 오류')
 if 'directionalDirection' in v and (not isinstance(v['directionalDirection'],list) or len(v['directionalDirection'])!=3 or any(not isinstance(x,(int,float)) or not math.isfinite(x) for x in v['directionalDirection'])):raise Fault(400,'조명 방향 오류')
 if 'shadowEnabled' in v and type(v['shadowEnabled']) is not bool:raise Fault(400,'shadowEnabled 오류')
 if 'lightingPreset' in v and v['lightingPreset'] not in LIGHT_PRESETS:raise Fault(400,'조명 preset 오류')
 return v

PARAMETRIC_PRIMITIVES={'BOX','CYLINDER','TANK','PIPE'}
def validate_parametric(p):
 if not isinstance(p,dict): raise Fault(400,'parametric object required')
 fields(p,['displayName','category','primitiveType','dimensions','defaultStyle'])
 name=text(p.get('displayName'),True,150); category=text(p.get('category'),True,100); primitive=p.get('primitiveType')
 if primitive not in PARAMETRIC_PRIMITIVES: raise Fault(400,'unsupported primitiveType')
 d=p.get('dimensions')
 if not isinstance(d,dict) or set(d)-{'width','depth','height','unit'}: raise Fault(400,'invalid dimensions fields')
 if d.get('unit','m')!='m': raise Fault(400,'dimensions unit must be m')
 for k in ('width','depth','height'):
  if k not in d or isinstance(d[k],bool) or not isinstance(d[k],(int,float)) or not math.isfinite(d[k]) or not 0<d[k]<=10000: raise Fault(400,'dimensions must be finite positive')
 return {'displayName':name,'category':category,'sourceType':'PARAMETRIC','primitiveType':primitive,'dimensions':{'width':d['width'],'depth':d['depth'],'height':d['height'],'unit':'m'},'defaultStyle':validate_style(p.get('defaultStyle'))}
def parametric_asset(c,p):
 v=validate_parametric(p); digest=hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest(); aid='PA-'+digest[:12]
 metadata={'sourceType':'PARAMETRIC','primitiveType':v['primitiveType'],'dimensions':v['dimensions'],'defaultStyle':v['defaultStyle'],'category':v['category'],'createdBy':'P006'}
 rows(c,"insert into asset(id,name,category,purpose,entry_usd,variant,model_xyz_m,metadata,seed_hash) values(%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(id) do update set name=excluded.name,category=excluded.category,purpose=excluded.purpose,variant=excluded.variant,model_xyz_m=excluded.model_xyz_m,metadata=excluded.metadata",(aid,v['displayName'],v['category'],'PARAMETRIC',None,Json({'sourceType':'PARAMETRIC','primitiveType':v['primitiveType']}),Json(v['dimensions']),Json(metadata),digest))
 return {'assetId':aid,**v}
def validate_composite(p):
 if not isinstance(p,dict): raise Fault(400,'composite object required')
 fields(p,['displayName','category','components'])
 name=text(p.get('displayName'),True,150); category=text(p.get('category'),True,100); comps=p.get('components')
 if not isinstance(comps,list) or not comps or len(comps)>100: raise Fault(400,'components required')
 out=[]
 for x in comps:
  fields(x,['childAssetId','relativePosition','relativeRotation','relativeScale'])
  aid=text(x.get('childAssetId'),True,100)
  out.append({'childAssetId':aid,'relativePosition':vector(x.get('relativePosition',[0,0,0]),-100000,100000),'relativeRotation':vector(x.get('relativeRotation',[0,0,0]),-360000,360000),'relativeScale':vector(x.get('relativeScale',[1,1,1]),.001,1000)})
 return {'displayName':name,'category':category,'sourceType':'COMPOSITE','components':out}
def composite_asset(c,p):
 v=validate_composite(p)
 for x in v['components']:
  if not one(c,'select id from asset where id=%s',(x['childAssetId'],)): raise Fault(404,'child asset not found')
 digest=hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest(); aid='CA-'+digest[:12]
 metadata={'sourceType':'COMPOSITE','components':v['components'],'category':v['category'],'createdBy':'P006'}
 rows(c,"insert into asset(id,name,category,purpose,entry_usd,variant,metadata,seed_hash) values(%s,%s,%s,%s,%s,%s,%s,%s) on conflict(id) do update set name=excluded.name,category=excluded.category,variant=excluded.variant,metadata=excluded.metadata",(aid,v['displayName'],v['category'],'COMPOSITE',None,Json({'sourceType':'COMPOSITE'}),Json(metadata),digest))
 return {'assetId':aid,**v}
def asset_ports(metadata):
 m=metadata or {}
 raw=m.get('portContract',m.get('ports',[])) if isinstance(m,dict) else []
 if isinstance(raw,dict): raw=raw.get('ports',raw.get('items',[]))
 return raw if isinstance(raw,list) else []
def port_key(p): return str(p.get('portId') or p.get('id') or '') if isinstance(p,dict) else ''
def port_direction(p): return str(p.get('direction') or p.get('flow') or p.get('kind') or '').upper() if isinstance(p,dict) else ''
def port_match(source_meta,target_meta):
 src=asset_ports(source_meta);tgt=asset_ports(target_meta);matches=[]
 for a in src:
  for b in tgt:
   da,db=port_direction(a),port_direction(b)
   if port_key(a) and port_key(b) and da in ('OUT','OUTPUT','OUTPUT_TO') and db in ('IN','INPUT','INPUT_FROM'):
    matches.append({'sourcePortId':port_key(a),'targetPortId':port_key(b),'direction':da+'→'+db})
 return matches
def number(v,lo,hi):
 if type(v) not in (int,float) or not math.isfinite(v) or not lo<=v<=hi:raise Fault(400,'좌표/크기 범위 오류')
 return v
def vector(v,lo,hi):
 if not isinstance(v,list) or len(v)!=3:raise Fault(400,'X/Y/Z 3개 값 필요')
 return [number(x,lo,hi) for x in v]
def fields(p,allowed):
 if not isinstance(p,dict) or set(p)-set(allowed):raise Fault(400,'알 수 없는 필드')
def settings(s):
 fields(s,['unit','coordinateSystem','grid','snap','rotationSnap','zoom','sceneStyle','processGroups','relatedSetInstanceMeta','networkDesign','networkRuntime'])
 validate_scene_style(s.get('sceneStyle'))
 groups=s.get('processGroups',[]);meta=s.get('relatedSetInstanceMeta',{})
 if not isinstance(groups,list) or len(groups)>100 or not isinstance(meta,dict) or len(meta)>10000:raise Fault(400,'공정 세트 설정 형식 오류')
 if len(json.dumps({'groups':groups,'meta':meta},ensure_ascii=False,allow_nan=False))>1000000:raise Fault(400,'공정 세트 설정 크기 초과')
 for item in meta.values():
  fields(item,['setId','generatedBy','generationStatus','settings'])
  if 'settings' in item and not isinstance(item['settings'],dict):raise Fault(400,'공정 세트 객체 설정 오류')
 design=s.get('networkDesign');runtime=s.get('networkRuntime')
 if design is not None:
  fields(design,['schema','evidenceStatus','factories','routes','product','camera','selectedFactoryId','layoutStatus','stageRefs'])
  if design.get('schema')!='P006_NETWORK_V1' or design.get('evidenceStatus') not in ('FUNCTIONAL_DEMO','EVIDENCE_CANDIDATE'):raise Fault(400,'생산망 근거 상태 오류')
  factories=design.get('factories');routes=design.get('routes')
  if not isinstance(factories,list) or not 1<=len(factories)<=100 or not isinstance(routes,list) or len(routes)>300:raise Fault(400,'생산망 공장/경로 개수 오류')
  seen=set()
  for f in factories:
   fields(f,['factoryInstanceId','layoutId','layoutVersion','name','mapPosition','locked','status'])
   fid=validid(f.get('factoryInstanceId'));validid(f.get('layoutId'))
   if fid in seen or type(f.get('layoutVersion')) is not int or f['layoutVersion']<1:raise Fault(400,'공장 참조 오류')
   seen.add(fid);vector(f.get('mapPosition'),-100000,100000)
   if type(f.get('locked')) is not bool:raise Fault(400,'공장 고정 상태 오류')
  for r in routes:
   fields(r,['routeId','fromFactoryInstanceId','toFactoryInstanceId','partId','transportSeconds','capacity','status'])
   validid(r.get('routeId'))
   if r.get('fromFactoryInstanceId') not in seen or r.get('toFactoryInstanceId') not in seen or r.get('fromFactoryInstanceId')==r.get('toFactoryInstanceId'):raise Fault(400,'공장 간 경로 참조 오류')
   number(r.get('transportSeconds'),0,86400);number(r.get('capacity'),1,100000)
  if not isinstance(design.get('product'),dict) or not isinstance(design.get('camera'),dict):raise Fault(400,'생산망 제품/카메라 형식 오류')
  if 'stageRefs' in design:
   refs=design['stageRefs']
   if not isinstance(refs,dict) or set(refs)-seen:raise Fault(400,'공장 Stage 참조 오류')
   for value in refs.values():validid(value)
  if len(json.dumps(design,ensure_ascii=False,allow_nan=False))>500000:raise Fault(400,'생산망 설계 크기 초과')
 if runtime is not None:
  fields(runtime,['schema','networkId','runId','state','step','events','inventory','workpieces','bufferCapacity','processedEventIds','factoryStates','finishedCount','mode'])
  if runtime.get('schema')!='P006_NETWORK_RUNTIME_V1':raise Fault(400,'생산망 실행 상태 형식 오류')
  validid(runtime.get('networkId'))
  if not isinstance(runtime.get('events'),list) or len(runtime['events'])>10000 or not isinstance(runtime.get('inventory'),dict) or not isinstance(runtime.get('processedEventIds'),list):raise Fault(400,'생산망 실행 상태 오류')
  if 'workpieces' in runtime and (not isinstance(runtime['workpieces'],dict) or len(runtime['workpieces'])>10000):raise Fault(400,'작업물 Lot 형식 오류')
  if 'bufferCapacity' in runtime and not isinstance(runtime['bufferCapacity'],dict):raise Fault(400,'입고 버퍼 형식 오류')
  if len(json.dumps(runtime,ensure_ascii=False,allow_nan=False))>500000:raise Fault(400,'생산망 실행 상태 크기 초과')
 if s.get('unit')!='m' or s.get('coordinateSystem')!='RIGHT_HANDED_Y_UP':raise Fault(400,'m / Y_UP 좌표계 필요')
 number(s.get('grid'),.01,100);number(s.get('rotationSnap'),1,180);number(s.get('zoom'),2,150)
 if type(s.get('snap')) is not bool:raise Fault(400,'snap boolean 필요')
 return s
def get_layout(c,id):
 l=one(c,'select * from factory_layout where id=%s',(validid(id),))
 if not l:raise Fault(404,'레이아웃 없음')
 items=rows(c,'select * from canvas_instance where layout_id=%s order by id',(id,))
 rel=rows(c,'select * from layout_relationship where layout_id=%s order by id',(id,))
 return {'id':str(l['id']),'name':l['name'],'version':l['version'],'settings':l['settings'],'sceneStyle':l.get('scene_style'),
  'instances':[{'id':str(x['id']),'assetId':x['asset_id'],'entryUsd':x['entry_usd'],'templateId':x['template_id'],'equipmentId':str(x['equipment_id']) if x['equipment_id'] else None,'intakeId':x['intake_id'],'label':x['label'],'position':x['position'],'rotation':x['rotation'],'scale':x['scale'],'parameters':x['parameters'],'style':x.get('style')} for x in items],
  'relationships':[{'id':str(x['id']),'from':str(x['from_id']),'to':str(x['to_id']),'type':x['type'],'source':x['source']} for x in rel]}
def validate(c,p):
 fields(p,['id','name','version','settings','sceneStyle','instances','relationships'])
 name=text(p.get('name'),True,150);s=settings(p.get('settings'))
 if s.get('networkDesign'):
  for f in s['networkDesign']['factories']:
   if not one(c,'select id from factory_layout where id=%s',(f['layoutId'],)):raise Fault(409,'참조 공장 레이아웃 없음')
 if s.get('networkRuntime') and not one(c,'select id from factory_layout where id=%s',(s['networkRuntime']['networkId'],)):raise Fault(409,'참조 생산망 설계 없음')
 if p.get('sceneStyle') is not None:s['sceneStyle']=validate_scene_style(p.get('sceneStyle'))
 items=p.get('instances');edges=p.get('relationships')
 if not isinstance(items,list) or len(items)>CONTRACT['maxInstances'] or not isinstance(edges,list) or len(edges)>10000:raise Fault(400,'객체/관계 개수 제한 초과')
 assets={x['id']:x for x in rows(c,'select id,entry_usd from asset')};intakes={x['id'] for x in rows(c,'select id from equipment_intake')};equips={str(x['id']) for x in rows(c,'select id from equipment_instance')}
 seen=set();out=[]
 for x in items:
  fields(x,['id','assetId','entryUsd','templateId','equipmentId','intakeId','label','position','rotation','scale','parameters','style'])
  if x.get('style') is not None and not x.get('templateId'): raise Fault(400,'Equipment style 금지')
  validate_style(x.get('style'))
  id=validid(x.get('id'))
  if id in seen:raise Fault(400,'중복 Canvas Instance ID')
  seen.add(id);asset=x.get('assetId');template=x.get('templateId');entry=x.get('entryUsd')
  if template and template not in TEMPLATES:raise Fault(400,'파라미터 유형 없음')
  if not asset and not template:raise Fault(400,'자산 또는 건축 유형 필요')
  if asset and (asset not in assets or not assets[asset]['entry_usd']):raise Fault(409,'USD 미연결 자산은 배치 불가')
  if entry!=(assets[asset]['entry_usd'] if asset else None):raise Fault(409,'Entry USD가 공통 원장과 다릅니다')
  if template and asset!=TEMPLATES[template].get('assetId'):raise Fault(400,'건축 템플릿 기준 자산 불일치')
  equip=x.get('equipmentId');intake=x.get('intakeId')
  if (equip and str(equip) not in equips) or (intake and intake not in intakes) or (equip and intake):raise Fault(400,'설비 참조 오류')
  param=x.get('parameters',{});fields(param,['width','length','height'])
  if template and set(param)!={'width','length','height'}:raise Fault(400,'건축 width/length/height 필요')
  if not template and param:raise Fault(400,'자산 치수 변환은 scale로 지정하세요')
  for v in param.values():number(v,.001,10000)
  out.append(dict(x,id=id,assetId=asset,entryUsd=entry,templateId=template,equipmentId=equip,intakeId=intake,label=text(x.get('label'),True,200),position=vector(x.get('position'),-100000,100000),rotation=vector(x.get('rotation'),-360000,360000),scale=vector(x.get('scale'),.001,1000),parameters=param))
 edgeids=set()
 for e in edges:
  fields(e,['id','from','to','type','source']);validid(e.get('id'))
  if e['id'] in edgeids or e.get('from') not in seen or e.get('to') not in seen or e['from']==e['to'] or e.get('type') not in TYPES:raise Fault(400,'관계 ID/끝점/유형 오류')
  edgeids.add(e['id']);src=e.get('source');fields(src,['method','ruleId','note','relationshipKind','evidence','verificationStatus','physicalConnectionVerified','role'])
  for k,v in src.items():
   if k=='physicalConnectionVerified':
    if type(v) is not bool:raise Fault(400,'물리 연결 검증 필드 오류')
   else:text(v,False,1000)
 return name,s,out,edges
def handle(c,a,method,path,p,params):
 # MVP: project administrators; no guessed customer attribution / new privileges.
 adminonly(a)
 suffix=path.removeprefix('/composer')
 if suffix=='/benchmarks' and method=='GET':
  layout=validid(params.get('layoutId',[''])[0])
  return {'items':rows(c,'select id::text id,layout_id::text "layoutId",layout_version "layoutVersion",status,payload,created_at "createdAt" from p006_factory_benchmark where layout_id=%s order by created_at desc limit 100',(layout,))}
 if suffix=='/benchmarks' and method=='POST':
  fields(p,['id','layoutId','layoutVersion','status','payload'])
  bid=validid(p.get('id'));layout=validid(p.get('layoutId'));version=p.get('layoutVersion');state=p.get('status');payload=p.get('payload')
  if type(version) is not int or version<1 or state not in ('PASS','FAIL','TIMEOUT','CANCELLED','PARTIAL') or not isinstance(payload,dict):raise Fault(400,'측정 결과 형식 오류')
  if len(json.dumps(payload,ensure_ascii=False))>250000:raise Fault(413,'측정 결과 크기 초과')
  found=one(c,'select version from factory_layout where id=%s',(layout,))
  if not found or found['version']!=version:raise Fault(409,'측정 대상 공장 버전 변경')
  rows(c,'insert into p006_factory_benchmark(id,layout_id,layout_version,actor_id,status,payload) values(%s,%s,%s,%s,%s,%s)',(bid,layout,version,str(a['accountId']),state,Json(payload)))
  audit(c,a,'FACTORY_BENCHMARK_SAVE',layout,{'measurementId':bid,'status':state,'version':version})
  return {'id':bid,'layoutId':layout,'layoutVersion':version,'status':state}
 if suffix=='/products' and method=='GET':
  return {'items':rows(c,'select id::text id,name,bom,source_reference "sourceReference",process_description "processDescription",evidence_status "evidenceStatus",version,updated_at "updatedAt" from p006_product_definition order by updated_at desc limit 500')}
 if suffix.startswith('/products/') and method=='GET':
  product=one(c,'select id::text id,name,bom,source_reference "sourceReference",process_description "processDescription",evidence_status "evidenceStatus",version from p006_product_definition where id=%s',(validid(suffix.rsplit('/',1)[-1]),))
  if not product:raise Fault(404,'제품 없음')
  return product
 if suffix=='/products' and method=='POST':
  fields(p,['id','name','bom','sourceReference','processDescription','version'])
  product_id=validid(p.get('id'));name=text(p.get('name'),True,150)
  source=text(p.get('sourceReference'),False,2000) or '';description=text(p.get('processDescription'),False,4000) or ''
  bom=p.get('bom');version=p.get('version')
  if not isinstance(bom,list) or len(bom)>100 or type(version) is not int or version<0:raise Fault(400,'제품 BOM/버전 오류')
  part_ids=set()
  for part in bom:
   fields(part,['partId','quantity'])
   part_id=text(part.get('partId'),True,80);quantity=part.get('quantity')
   if part_id in part_ids or type(quantity) is not int or not 1<=quantity<=100000:raise Fault(400,'부품 ID/수량 오류')
   part_ids.add(part_id)
  if version==0:
   rows(c,'insert into p006_product_definition(id,name,bom,source_reference,process_description) values(%s,%s,%s,%s,%s)',(product_id,name,Json(bom),source,description))
  else:
   updated=rows(c,'update p006_product_definition set name=%s,bom=%s,source_reference=%s,process_description=%s,version=version+1,updated_at=now() where id=%s and version=%s returning id',(name,Json(bom),source,description,product_id,version))
   if not updated:raise Fault(409,'제품 저장 버전 충돌')
  audit(c,a,'PRODUCT_DEFINITION_SAVE',product_id,{'version':version+1,'parts':len(bom),'evidenceStatus':'DESIGN_CANDIDATE'})
  return one(c,'select id::text id,name,bom,source_reference "sourceReference",process_description "processDescription",evidence_status "evidenceStatus",version from p006_product_definition where id=%s',(product_id,))
 if suffix=='/stages' or suffix.startswith('/stages/'):
  from stage_api import handle as stage_handle
  return stage_handle(c,a,method,suffix,p,params)
 if suffix=='/network-usd' or suffix.startswith('/network-usd/'):
  from network_usd_api import handle as network_usd_handle
  return network_usd_handle(c,a,method,suffix,p,params)
 if suffix=='/functional-contracts/connections' and method=='GET': return {'items':rows(c,'select asset_id "assetId",connection_status "connectionStatus",logical_ports "logicalPorts",related_asset_rules "relatedAssetRules",contract_source "contractSource",manufacturer_verified "manufacturerVerified",physical_port_verified "physicalPortVerified",version,updated_at "updatedAt" from p006_functional_connection_contract order by asset_id')}
 if suffix.startswith('/functional-contracts/connections/'):
  aid=suffix.rsplit('/',1)[-1]
  if method=='GET':
   x=get_connection(c,aid)
   if not x: raise Fault(404,'connection contract not found')
   return x
  if method=='PUT': return upsert_connection(c,p,p.get('expectedVersion'))
 if suffix=='/functional-contracts/motions' and method=='GET': return {'items':rows(c,'select asset_id "assetId",motion_type "motionType",target_node "targetNode",motion_source "motionSource",motion_ready "motionReady",kinematics_verified "kinematicsVerified",version,updated_at "updatedAt" from p006_functional_motion_contract order by asset_id')}
 if suffix.startswith('/functional-contracts/motions/'):
  aid=suffix.rsplit('/',1)[-1]
  if method=='GET':
   x=get_motion(c,aid)
   if not x: raise Fault(404,'motion contract not found')
   return x
  if method=='PUT': return upsert_motion(c,p,p.get('expectedVersion'))
 if suffix=='/catalog' and method=='GET':
  eq=rows(c,'select e.id,e.name,e.code,p.id "processId",p.code "processCode",p.name "processName" from equipment_instance e join process p on p.id=e.process_id order by e.code');return {'contract':CONTRACT,'items':rows(c,"select id,name,coalesce(english_name,metadata->'entry'->>'englishName') english_name,category,purpose,entry_usd,base_usd,variant,image,model_xyz_m,metadata->'entry'->>'imageMethod' image_method,metadata->'entry'->>'imageStatus' image_status,metadata->'entry'->>'geometryState' geometry_state,metadata->'catalog'->>'domain' domain from asset order by id"),'registry':rows(c,'select i.id,i.source_name,i.asset_id,i.grade,r.decision review_decision from equipment_intake i left join intake_matching_review r on r.intake_id=i.id order by i.id'),'equipment':eq}
 if suffix=='/composite-assets' and method=='POST': return composite_asset(c,p)
 if suffix=='/composite-assets' and method=='GET': return {'items':rows(c,"select id,name,category,metadata->'components' components from asset where metadata->>'sourceType'='COMPOSITE' order by id")}
 if suffix.startswith('/composite-assets/') and method=='GET':
  aid=suffix.rsplit('/',1)[-1]; x=one(c,"select id,name,category,metadata from asset where id=%s and metadata->>'sourceType'='COMPOSITE'",(aid,))
  if not x: raise Fault(404,'composite asset not found')
  m=x['metadata']; return {'assetId':x['id'],'displayName':x['name'],'category':x['category'],'sourceType':'COMPOSITE','components':m.get('components',[])}
 if suffix=='/parametric-assets' and method=='POST': return parametric_asset(c,p)
 if suffix=='/parametric-assets' and method=='GET': return {'items':rows(c,"select id,name,category,metadata->>'sourceType' source_type,metadata->>'primitiveType' primitive_type,model_xyz_m dimensions,metadata->'defaultStyle' default_style from asset where metadata->>'sourceType'='PARAMETRIC' order by id")}
 if suffix.startswith('/parametric-assets/') and method=='GET':
  aid=suffix.rsplit('/',1)[-1]; x=one(c,"select id,name,category,metadata from asset where id=%s and metadata->>'sourceType'='PARAMETRIC'",(aid,))
  if not x: raise Fault(404,'parametric asset not found')
  m=x['metadata']; return {'assetId':x['id'],'displayName':x['name'],'category':x['category'],'sourceType':m.get('sourceType'),'primitiveType':m.get('primitiveType'),'dimensions':m.get('dimensions'),'defaultStyle':m.get('defaultStyle')}
 if suffix=='/related' and method=='GET':
  id=params.get('assetId',[''])[0]
  source=one(c,'select id,metadata from asset where id=%s',(id,))
  if not source: raise Fault(404,'자산 없음')
  functional=one(c,'select connection_status,related_asset_rules from p006_functional_connection_contract where asset_id=%s',(id,))
  if functional and functional['connection_status']=='NOT_CONNECTABLE': return {'items':[],'status':'FUNCTIONAL_SIMULATION_NOT_CONNECTABLE'}
  if functional and functional['connection_status']=='FUNCTIONAL_SIMULATION_AUTHORED': return {'items':functional['related_asset_rules'],'status':'FUNCTIONAL_SIMULATION_CONTRACT'}
  candidates=rows(c,"select r.id rule_id,r.type,r.source,a.id,a.name,a.image,a.entry_usd,a.metadata from composer_relationship_rule r join asset a on a.id=r.target_asset_id or (r.target_domain is not null and a.metadata->'catalog'->>'domain'=r.target_domain) where r.from_asset_id=%s and a.id<>%s order by (r.target_asset_id is null),a.id,r.id",(id,id))
  items=[]
  for x in candidates:
   matches=port_match(source.get('metadata'),x.get('metadata'))
   x.pop('metadata',None);x['compatible']=bool(matches);x['ports']={'matches':matches,'sourceAssetId':id,'targetAssetId':x['id']};items.append(x)
  return {'items':items,'status':'PORT_CONTRACT_VERIFIED_FROM_ASSET_METADATA'}
 if suffix=='/layouts' and method=='GET':return {'items':rows(c,'select id,name,version,updated_at,(select count(*) from canvas_instance i where i.layout_id=l.id) count,(select count(*) from canvas_instance i where i.layout_id=l.id and i.asset_id is not null and i.template_id is null) "equipmentCount",(select count(*) from canvas_instance i where i.layout_id=l.id and i.template_id is not null) "buildingCount" from factory_layout l order by updated_at desc limit 500')}
 if suffix.startswith('/layouts/') and method=='GET':return get_layout(c,suffix.split('/')[-1])
 if suffix=='/layouts' and method=='POST':
  name,s,items,edges=validate(c,p);id=validid(p.get('id'));version=p.get('version')
  if type(version) is not int or version<0:raise Fault(400,'버전 필요')
  l=one(c,'select * from factory_layout where id=%s for update',(id,))
  if (l and l['version']!=version) or (not l and version!=0):raise Fault(409,'저장 버전 충돌. 로컬 변경을 JSON으로 내보내고 최신 DB 문서를 다시 여세요.')
  if l:
   rows(c,'update factory_layout set name=%s,settings=%s,scene_style=%s,version=version+1,updated_at=now() where id=%s',(name,Json(s),Json(s.get('sceneStyle')),id))
   rows(c,'delete from canvas_instance where layout_id=%s',(id,))
  else:rows(c,'insert into factory_layout(id,name,owner_id,settings,scene_style) values(%s,%s,%s,%s,%s)',(id,name,a['accountId'],Json(s),Json(s.get('sceneStyle'))))
  for x in items:rows(c,'insert into canvas_instance(layout_id,id,asset_id,entry_usd,template_id,equipment_id,intake_id,label,position,rotation,scale,parameters,style) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',(id,x['id'],x['assetId'],x['entryUsd'],x['templateId'],x['equipmentId'],x['intakeId'],x['label'],Json(x['position']),Json(x['rotation']),Json(x['scale']),Json(x['parameters']),Json(x.get('style'))))
  for e in edges:rows(c,'insert into layout_relationship(layout_id,id,from_id,to_id,type,source) values(%s,%s,%s,%s,%s,%s)',(id,e['id'],e['from'],e['to'],e['type'],Json(e['source'])))
  doc=get_layout(c,id);rows(c,'insert into factory_layout_revision(layout_id,version,document,actor_id) values(%s,%s,%s,%s)',(id,doc['version'],Json(doc),a['accountId']));audit(c,a,'LAYOUT_SAVE',id,{'version':doc['version'],'instances':len(items),'relationships':len(edges),'assetRegistryUnchanged':True})
  return doc
 raise Fault(404,'Composer API 없음')
