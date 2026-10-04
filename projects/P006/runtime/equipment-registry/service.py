import os,sys,json,uuid,hashlib,time,re,math,base64,unicodedata,logging
if __name__=='__main__':sys.modules['service']=sys.modules[__name__]
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
from http.cookies import SimpleCookie
import psycopg2
from psycopg2.extras import RealDictCursor,Json
ROOT=Path(__file__).parent;DATA=Path(os.environ.get('REGISTRY_DATA',str(ROOT/'data')));DATA.mkdir(exist_ok=True)
sys.path.insert(0,'/opt/Resonance/projects/P006/runtime')
from scenario_store import actor_for_session,AuthenticationRequired
CONTRACT=json.loads((ROOT/'contract.json').read_text())
def connect():
 return psycopg2.connect(host='127.0.0.1',port=35433,dbname='woosu_digital_twin',user=os.environ['SPRING_DATASOURCE_USERNAME'],password=os.environ['SPRING_DATASOURCE_PASSWORD'],options='-c search_path=p006_registry,public -c statement_timeout=10000',connect_timeout=5)
class Fault(Exception):
 def __init__(self,status,message):self.status=status;self.message=message
def rows(c,sql,args=()):
 with c.cursor(cursor_factory=RealDictCursor) as q:q.execute(sql,args);return [dict(r) for r in q.fetchall()] if q.description else []
def one(c,sql,args=()):
 r=rows(c,sql,args);return r[0] if r else None
def uid():return str(uuid.uuid4())
def validid(v):
 try:return str(uuid.UUID(str(v)))
 except Exception:raise Fault(400,'유효한 UUID가 필요합니다')
def text(v,required=False,maxlen=250):
 if v is None:v=''
 if not isinstance(v,str) or len(v)>maxlen:raise Fault(400,'문자 길이/형식 오류')
 v=v.strip()
 if required and not v:raise Fault(400,'필수 문자열 누락')
 return v or None
def norm(s):return unicodedata.normalize('NFKC',s).casefold().strip()
def admin(a):return 'PROJECT_ADMIN' in (a.get('roles') or [])
def adminonly(a):
 if not admin(a):raise Fault(403,'프로젝트 관리자만 가능합니다')
def access(c,a,customer,write=False):
 customer=validid(customer)
 if not one(c,'select id from customer where id=%s',(customer,)):raise Fault(404,'업체 없음')
 if admin(a):return customer
 grant=one(c,'select access_role from customer_access where customer_id=%s and account_id=%s',(customer,a['accountId']))
 if not grant or (write and grant['access_role']!='EDITOR'):raise Fault(403,'업체 접근 권한 없음')
 return customer
def instance(c,a,id,write=False):
 if write:rows(c,'select id from equipment_instance where id=%s for update',(validid(id),))
 r=one(c,'select * from instance_view where id=%s',(validid(id),))
 if not r:raise Fault(404,'설비 없음')
 access(c,a,r['customer_id'],write);return r
def audit(c,a,action,id,data,customer=None):rows(c,'insert into audit(account_id,customer_id,action,entity_id,detail) values(%s,%s,%s,%s,%s)',(a['accountId'],customer,action,str(id),Json(data)))
def scope(a,alias='c'):
 return ('TRUE',[]) if admin(a) else (f'EXISTS(select 1 from customer_access acl where acl.customer_id={alias}.id and acl.account_id=%s)',[a['accountId']])
def safejson(x):
 if not isinstance(x,dict) or len(json.dumps(x,allow_nan=False))>20000:raise Fault(400,'JSON 객체 크기/형식 오류')
 return x
def validate(c,a,p):
 allowed={f['key'] for f in CONTRACT['equipmentForm']}|{'version'}
 if set(p)-allowed:raise Fault(400,'허용되지 않은 등록 필드: '+','.join(set(p)-allowed))
 pro=one(c,'select p.id,f.customer_id from process p join line l on l.id=p.line_id join plant f on f.id=l.plant_id where p.id=%s',(validid(p.get('processId')),))
 if not pro:raise Fault(400,'공정을 먼저 등록하세요')
 access(c,a,pro['customer_id'],True)
 typ=text(p.get('equipmentTypeCode'),True,100)
 if not one(c,'select code from equipment_type where code=%s',(typ,)):raise Fault(400,'설비 종류 없음')
 model=validid(p['modelId']) if p.get('modelId') else None;opt=validid(p['optionId']) if p.get('optionId') else None
 if model:
  m=one(c,'select * from equipment_model where id=%s',(model,))
  if not m or m['equipment_type_code']!=typ:raise Fault(400,'모델의 설비 종류 불일치')
 if opt and (not model or not one(c,'select id from model_option where id=%s and model_id=%s',(opt,model))):raise Fault(400,'옵션/모델 불일치')
 dims=safejson(p.get('dimensionsMm',{}))
 if set(dims)-{'width','depth','height','source','unit'}:raise Fault(400,'치수 필드는 width/depth/height/source/unit')
 if dims.get('unit','mm')!='mm':raise Fault(400,'주요 치수 단위는 mm입니다')
 for k in ['width','depth','height']:
  if k in dims and (isinstance(dims[k],bool) or not isinstance(dims[k],(int,float)) or not math.isfinite(dims[k]) or not 0<dims[k]<=10000000):raise Fault(400,'치수는 유한한 양수 mm')
 install=safejson(p.get('installation',{}))
 if install and (install.get('unit') not in ['mm','m'] or not install.get('coordinateSystem')):raise Fault(400,'설치 위치에는 unit(mm/m), coordinateSystem 필요')
 return {'process_id':str(pro['id']),'equipment_type_code':typ,'code':text(p.get('code'),True,100),'name':text(p.get('name'),True),'model_id':model,'option_id':opt,'serial_number':text(p.get('serialNumber')),'management_number':text(p.get('managementNumber')),'dimensions_mm':dims,'installation':install,'workpiece':safejson(p.get('workpiece',{})),'io':safejson(p.get('io',{})),'shape_family':text(p.get('shapeFamily')),'purpose':text(p.get('purpose'),False,2000)},str(pro['customer_id'])
def match(c,e):
 typ=one(c,'select * from equipment_type where code=%s',(e['equipment_type_code'],));old=typ['legacy_mapping'];dims=e['dimensions_mm'];basic=bool(e['purpose'] and all(dims.get(x) for x in ['width','depth','height']))
 bindings=rows(c,'select b.*,a.entry_usd,a.name asset_name from model_asset b join asset a on a.id=b.asset_id where b.model_id=%s and b.option_id is not distinct from %s order by b.asset_id',(e['model_id'],e['option_id'])) if e['model_id'] else []
 reasons=[];selected=None;grade='BLOCKED';rank=[]
 ownProof={x['kind'] for x in rows(c,"select distinct kind from evidence where instance_id=%s and review_status='APPROVED'",(e['id'],))}
 for b in bindings:
  if not b['entry_usd']:continue
  review=b['review'];evIds=review.get('evidenceIds',[]);proof=rows(c,"select kind from evidence where id=any(%s::uuid[]) and review_status='APPROVED'",(evIds,));verified=review.get('approved') is True and len(proof)==len(evIds) and {'IDENTITY','GEOMETRY','DIMENSION'}<={x['kind'] for x in proof};ref=review.get('dimensionsMm',{});sameDims=all(dims.get(k) and ref.get(k) and abs(dims[k]-ref[k])/ref[k]<=.01 for k in ['width','depth','height'])
  sameShape=bool(e['shape_family'] and e['shape_family']==review.get('shapeFamily'))
  sameFlow=bool(e['io'] and e['workpiece'] and e['io']==review.get('io') and e['workpiece']==review.get('workpiece') and e['purpose']==review.get('purpose'))
  if verified and basic and sameDims and sameShape and sameFlow and {'IDENTITY','DIMENSION','PORT'}<=ownProof and (e['serial_number'] or e['management_number']):
   grade='EXACT_MATCH';selected=b['asset_id'];reasons=['제조사/모델/옵션 FK 동일','승인된 모델-자산 근거','치수 오차 1% 이내 및 형상 계열 동일','실제 설비 식별번호 있음'];break
  if basic and verified and sameShape:grade='CLOSE_MATCH';selected=b['asset_id'];reasons=['승인된 동일 모델 자산 있으나 치수/식별 차이','기존 Base/Variant 수정 검토 우선'];break
  rank.append({'assetId':b['asset_id'],'reason':'모델 등록 관계 있음; 승인/치수/형상 확인 부족'})
 if not selected:
  candidate=(old.get('recommended') or {}).get('assetId')
  if basic and candidate:
   grade='REFERENCE_MATCH';selected=candidate;reasons=['동일 Equipment Type의 검토된 기준 후보','실제 제조사/모델/형상 동등성 미검증; 종류의 CLOSE 등급 자동 상속 금지']
  elif basic and old.get('grade')=='NO_MATCH':
   newer=rows(c,"select id from asset where metadata->>'equipmentTypeCode'=%s",(e['equipment_type_code'],))
   if rank or newer:grade='BLOCKED';reasons=['기존 전수 검토 이후 추가된 후보/모델 관계를 먼저 검토해야 합니다'];rank+=[{'assetId':x['id'],'reason':'신규 등록 자산, 동일성 검증 대기'} for x in newer]
   else:grade='NO_MATCH';reasons=['종류 원장의 전체 카탈로그 검토에서 적정 전체 자산 없음','등록된 모델 매핑에도 적정 자산 없음']
  elif basic and not old:
   grade='BLOCKED';reasons=['새 설비 종류: 카탈로그 의미/형상 검토 전 NO_MATCH 단정 금지']
  else:reasons=['용도/3축 치수 누락 또는 종류 원장의 형상·역할 충돌 해소 필요']
 if selected and not one(c,'select id from asset where id=%s and entry_usd is not null',(selected,)):grade='BLOCKED';selected=None;reasons=['Entry USD 미연결']
 return {'grade':grade,'assetId':selected,'reasons':reasons,'alternatives':rank+old.get('alternatives',[]),'method':'EVIDENCE_GATED_RULES_V1','imageGeometryAutomaticallyCompared':False,'manufacturerModelNameOnlyExactForbidden':True,'reuseFirst':grade=='CLOSE_MATCH','realStatus':'UNBOUND','verificationInherited':False}
def save_match(c,e):
 result=match(c,e)
 rows(c,'update equipment_instance set match_grade=%s,matched_asset_id=%s,match_result=%s,connected_asset_id=null,updated_at=now() where id=%s',(result['grade'],result['assetId'],Json(result),e['id']))
 if result['grade']=='NO_MATCH':rows(c,"insert into new_asset_candidate(id,instance_id,reason) values(%s,%s,%s) on conflict(instance_id) do update set status='OPEN',reason=excluded.reason",(uid(),e['id'],Json(result)))
 else:rows(c,"update new_asset_candidate set status='RESOLVED_OR_REVIEW' where instance_id=%s",(e['id'],))
 return result
def create_equipment(c,a,p):
 v,customer=validate(c,a,p);id=uid();fields=list(v);args=[Json(x) if isinstance(x,dict) else x for x in v.values()]
 rows(c,'insert into equipment_instance(id,'+','.join(fields)+') values('+','.join(['%s']*(len(fields)+1))+')',[id]+args)
 e=one(c,'select * from equipment_instance where id=%s',(id,));m=save_match(c,e);audit(c,a,'EQUIPMENT_CREATE',id,{'fields':v,'match':m},customer);return {'id':id,'match':m}
def invalidate_evidence(c,a,ids):
 if not ids:return
 bindings=rows(c,"select * from model_asset where review->>'approved'='true' and (review->'evidenceIds') ?| %s",([str(x) for x in ids],))
 for b in bindings:
  rows(c,"update model_asset set review=review||%s where id=%s",(Json({'approved':False,'revokedReason':'SOURCE_EVIDENCE_CHANGED'}),b['id']))
  affected=rows(c,"update equipment_instance set connected_asset_id=null,matched_asset_id=null,match_grade='BLOCKED',match_result=%s,verification='{}',version=version+1 where model_id=%s and option_id is not distinct from %s and (connected_asset_id=%s or matched_asset_id=%s) returning id",(Json({'grade':'BLOCKED','reasons':['공유 모델 검증 근거 변경: 재검토 필요'],'realStatus':'UNBOUND'}),b['model_id'],b['option_id'],b['asset_id'],b['asset_id']))
  audit(c,a,'SHARED_EVIDENCE_REVOKED',b['id'],{'affectedCount':len(affected)})
def dispatch(c,a,method,path,p,params):
 if path=='/production-plans' or path.startswith('/production-plans/'):
  from production_plan_api import handle
  return handle(a,method,path,p)
 if path.startswith('/ai-authoring/'):
  from ai_authoring_api import handle
  return handle(a,method,path,p)
 if path.startswith('/asset-evidence/'):
  from asset_evidence_api import handle
  return handle(a,method,path,p)
 if path.startswith('/asset-versions/'):
  from asset_versions_api import handle
  return handle(c,a,method,path,p)
 if path=='/meta':
  where,args=scope(a);return {'contract':CONTRACT,'actor':{'name':a['displayName'],'admin':admin(a)},'customers':rows(c,'select c.* from customer c where '+where+' order by name',args),'hierarchy':rows(c,'select p.id,p.name,p.code,l.name line_name,f.name plant_name,c.id customer_id,c.name customer_name from process p join line l on l.id=p.line_id join plant f on f.id=l.plant_id join customer c on c.id=f.customer_id where '+where+' order by c.name,f.name,l.name,p.name',args),'plants':rows(c,'select f.* from plant f join customer c on c.id=f.customer_id where '+where,args),'lines':rows(c,'select l.* from line l join plant f on f.id=l.plant_id join customer c on c.id=f.customer_id where '+where,args),'types':rows(c,'select code,name,english_name,role from equipment_type order by code'),'manufacturers':rows(c,'select * from manufacturer order by name'),'models':rows(c,'select m.*,f.name manufacturer_name from equipment_model m join manufacturer f on f.id=m.manufacturer_id order by f.name,m.name'),'options':rows(c,'select * from model_option order by name'),'library':one(c,'select count(*) total,count(entry_usd) connected from asset')}
 if path=='/assets' and method=='GET':
  q=params.get('q',[''])[0][:100];after=params.get('after',[''])[0];limit=min(100,max(1,int(params.get('limit',['50'])[0])))
  filter_sql='true';filter_args=[]
  if q:
   filter_sql="(a.name ilike %s or a.english_name ilike %s or a.id ilike %s or exists(select 1 from model_asset ma join equipment_model m on m.id=ma.model_id join manufacturer mf on mf.id=m.manufacturer_id where ma.asset_id=a.id and mf.name ilike %s))"
   filter_args=['%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%']
  total=one(c,'select count(*) total from asset a where '+filter_sql,filter_args)['total']
  items=rows(c,"select a.id,a.name,a.english_name,a.category,a.purpose,a.entry_usd,a.base_usd,a.variant,a.image,a.seed_hash,coalesce((select string_agg(distinct mf.name, ', ' order by mf.name) from model_asset ma join equipment_model m on m.id=ma.model_id join manufacturer mf on mf.id=m.manufacturer_id where ma.asset_id=a.id),'') manufacturer_name,v.id current_version_id,v.version_no current_version_no,v.status current_version_status,v.web_glb_path current_version_web_glb_path,v.files_manifest current_version_files from asset a left join asset_version v on v.asset_id=a.id and v.is_current=true where a.id>%s and "+filter_sql+" order by a.id limit %s",[after,*filter_args,limit+1])
  has_more=len(items)>limit
  if has_more:items=items[:limit]
  return {'items':items,'total':total,'nextAfter':items[-1]['id'] if has_more and items else None,'hasMore':has_more,'limit':limit,'canManage':admin(a),'canApprove':admin(a) and 'RESULT_APPROVE' in (a.get('permissions') or [])}
 if path=='/assets' and method=='POST':
  adminonly(a);candidate=one(c,'select * from new_asset_candidate where id=%s',(validid(p.get('candidateId')),))
  if not candidate or candidate['status']!='OPEN':raise Fault(409,'OPEN NO_MATCH 후보가 필요합니다')
  e=instance(c,a,candidate['instance_id'],True)
  if match(c,e)['grade']!='NO_MATCH':raise Fault(409,'현재 NO_MATCH가 아닙니다. 기존 자산 재사용을 검토하세요')
  id=text(p.get('id'),True,100);name=text(p.get('name'),True);purpose=text(p.get('purpose'),True,2000);note=text(p.get('reviewNote'),True,2000)
  if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,99}',id):raise Fault(400,'Asset ID 형식 오류')
  if one(c,'select id from asset where lower(name)=lower(%s) and purpose=%s',(name,purpose)):raise Fault(409,'동일 이름/용도 자산을 먼저 검토하세요')
  entry=text(p.get('entryUsd'),False,2000);base=text(p.get('baseUsd'),False,2000)
  for v in [entry,base]:
   if v:
    file=Path(v).resolve();allowed=Path('/home/sjkim/OmniverseProjects').resolve()
    if not file.is_relative_to(allowed) or file.suffix.lower() not in ['.usd','.usda','.usdc','.usdz'] or not file.is_file():raise Fault(400,'프로젝트 내부에 실제 존재하는 USD 경로가 필요합니다')
  metadata={'candidateId':str(candidate['id']),'equipmentTypeCode':e['equipment_type_code'],'origin':'NO_MATCH_MANUAL_REGISTRATION','reviewNote':note,'assetReady':False,'real':'UNBOUND','entryValidation':'FILE_EXISTS_ONLY' if entry else 'USD_REQUIRED'}
  rows(c,'insert into asset(id,name,english_name,category,purpose,entry_usd,base_usd,variant,metadata,seed_hash) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',(id,name,text(p.get('englishName')),text(p.get('category'),True),purpose,entry,base,Json(safejson(p.get('variant',{}))),Json(metadata),hashlib.sha256(json.dumps(metadata,sort_keys=True).encode()).hexdigest()))
  rows(c,"update new_asset_candidate set status='ASSET_REGISTERED_REVIEW_REQUIRED' where id=%s",(candidate['id'],));audit(c,a,'SHARED_ASSET_REGISTER',id,metadata,e['customer_id']);return {'id':id,'status':'USD_CONNECTED' if entry else 'USD_REQUIRED','equipmentAutomaticallyBound':False,'ASSET_READY':False,'REAL':'UNBOUND'}
 if path=='/hierarchy' and method=='POST':
  entity=p.get('entity');code=text(p.get('code'),True,100);name=text(p.get('name'),True);id=uid();customer=None
  if entity=='customer':adminonly(a);rows(c,'insert into customer(id,code,name) values(%s,%s,%s)',(id,code,name));customer=id
  elif entity in ['plant','line','process']:
   parent=validid(p.get('parentId'))
   if entity=='plant':customer=access(c,a,parent,True);fk='customer_id'
   elif entity=='line':
    v=one(c,'select customer_id from plant where id=%s',(parent,));customer=access(c,a,v['customer_id'],True) if v else None;fk='plant_id'
   else:
    v=one(c,'select f.customer_id from line l join plant f on f.id=l.plant_id where l.id=%s',(parent,));customer=access(c,a,v['customer_id'],True) if v else None;fk='line_id'
   if not customer:raise Fault(400,'상위 계층 없음')
   rows(c,f'insert into {entity}(id,{fk},code,name) values(%s,%s,%s,%s)',(id,parent,code,name))
  else:raise Fault(400,'계층 종류 오류')
  audit(c,a,'HIERARCHY_CREATE',id,{'entity':entity,'code':code},customer);return {'id':id}
 if path=='/customer-access' and method=='POST':
  adminonly(a);customer=access(c,a,p['customerId']);account=text(p['accountId'],True,100);role=p.get('role')
  if role not in ['VIEWER','EDITOR']:raise Fault(400,'권한 형식 오류')
  rows(c,'insert into customer_access(customer_id,account_id,access_role) values(%s,%s,%s) on conflict(customer_id,account_id) do update set access_role=excluded.access_role',(customer,account,role));audit(c,a,'EXPLICIT_CUSTOMER_GRANT',account,{'role':role},customer);return {'status':'SAVED'}
 if path in ['/manufacturers','/models','/options','/types'] and method=='POST':
  adminonly(a);name=text(p.get('name'),True);id=uid()
  if path=='/manufacturers':rows(c,'insert into manufacturer(id,name,normalized_name) values(%s,%s,%s)',(id,name,norm(name)))
  elif path=='/types':
   id=text(p.get('code'),True,100);rows(c,'insert into equipment_type(code,name,english_name,role) values(%s,%s,%s,%s)',(id,name,text(p.get('englishName')),text(p.get('role'),True,2000)))
  elif path=='/models':rows(c,'insert into equipment_model(id,manufacturer_id,name,normalized_name,equipment_type_code,shape_family,specification) values(%s,%s,%s,%s,%s,%s,%s)',(id,validid(p.get('manufacturerId')),name,norm(name),text(p.get('equipmentTypeCode'),True),text(p.get('shapeFamily')),Json(safejson(p.get('specification',{})))))
  else:rows(c,'insert into model_option(id,model_id,name,parameters) values(%s,%s,%s,%s)',(id,validid(p.get('modelId')),name,Json(safejson(p.get('parameters',{})))))
  audit(c,a,'SHARED_REGISTER',id,{'entity':path,'name':name});return {'id':id}
 if path=='/equipment/import' and method=='POST':
  items=p.get('items')
  if not isinstance(items,list) or not 1<=len(items)<=500:raise Fault(400,'1~500개씩 원자적 가져오기')
  found=set()
  for item in items:
   v,customer=validate(c,a,item);key=(v['process_id'],v['code'])
   if key in found or one(c,'select id from equipment_instance where process_id=%s and code=%s',key):raise Fault(409,'중복 설비 코드: '+key[1])
   found.add(key)
  if p.get('dryRun',True):return {'validated':len(items),'dryRun':True,'saved':0}
  return {'saved':len(items),'items':[create_equipment(c,a,x) for x in items]}
 if path=='/equipment' and method=='POST':return create_equipment(c,a,p)
 if path in ['/equipment','/stats','/candidates'] and method=='GET':
  where,args=scope(a);customer=params.get('customerId',[''])[0]
  if customer:access(c,a,customer);where+=' and c.id=%s';args.append(customer)
  if path=='/stats':return {'customers':rows(c,"select c.id,c.name,count(v.id) total,count(v.connected_asset_id) connected,count(v.id) filter(where v.match_grade='EXACT_MATCH') exact_match,count(v.id) filter(where v.match_grade='CLOSE_MATCH') close_match,count(v.id) filter(where v.match_grade='REFERENCE_MATCH') reference_match,count(v.id) filter(where v.match_grade='NO_MATCH') no_match,count(v.id) filter(where v.match_grade='BLOCKED') blocked,count(v.id) filter(where v.verification->>'status'='DOCUMENT_REVIEW_COMPLETE') verified,round(100.0*count(v.connected_asset_id)/nullif(count(v.id),0),2) coverage from customer c left join instance_view v on v.customer_id=c.id where "+where+' group by c.id,c.name order by c.name',args)}
  if path=='/candidates':return {'items':rows(c,'select n.*,v.name,v.customer_name from new_asset_candidate n join instance_view v on v.id=n.instance_id join customer c on c.id=v.customer_id where '+where+' order by n.created_at desc limit 100',args)}
  q=params.get('q',[''])[0][:100];where+=' and (v.name ilike %s or v.code ilike %s)';args+=['%'+q+'%']*2
  limit=min(100,max(1,int(params.get('limit',['50'])[0])));offset=max(0,int(params.get('offset',['0'])[0]))
  total=one(c,'select count(*) n from instance_view v join customer c on c.id=v.customer_id where '+where,args)['n']
  return {'total':total,'items':rows(c,'select v.* from instance_view v join customer c on c.id=v.customer_id where '+where+' order by v.customer_name,v.plant_name,v.line_name,v.process_name,v.code,v.id limit %s offset %s',args+[limit,offset])}
 parts=path.strip('/').split('/')
 if len(parts)>=2 and parts[0]=='equipment':
  e=instance(c,a,parts[1],method!='GET');id=e['id']
  if len(parts)==2 and method=='GET':return {'equipment':e,'evidence':rows(c,'select id,kind,name,source_uri,sha256,bytes,review_status,review_note from evidence where instance_id=%s order by created_at',(id,))}
  if len(parts)==2 and method=='PATCH':
   if p.get('version')!=e['version']:raise Fault(409,'다른 사용자가 수정했습니다. 다시 조회하세요')
   v,customer=validate(c,a,p)
   if customer!=str(e['customer_id']):raise Fault(400,'업체 간 설비 이동은 별도 이관 절차 필요')
   fields=list(v);updated=rows(c,'update equipment_instance set '+','.join(k+'=%s' for k in fields)+",version=version+1,verification='{}',updated_at=now() where id=%s and version=%s returning *",[Json(x) if isinstance(x,dict) else x for x in v.values()]+[id,p['version']])
   if not updated:raise Fault(409,'수정 충돌')
   stale=rows(c,"update evidence set review_status='STALE' where instance_id=%s and review_status='APPROVED' returning id",(id,));invalidate_evidence(c,a,[x['id'] for x in stale])
   result=save_match(c,updated[0]);audit(c,a,'EQUIPMENT_UPDATE',id,{'version':e['version']+1},customer);return {'id':id,'match':result}
  if len(parts)==3 and parts[2]=='match' and method=='POST':
   result=save_match(c,e);audit(c,a,'MATCH',id,result,e['customer_id']);return result
  if len(parts)==3 and parts[2]=='bind' and method=='POST':
   requested=text(p.get('assetId'),True,100); asset=one(c,'select id,entry_usd,metadata from asset where id=%s',(requested,))
   if not asset: raise Fault(404,'assetId not found')
   source=(asset.get('metadata') or {}).get('sourceType')
   if source=='PARAMETRIC': result={'grade':'PARAMETRIC_MATCH','assetId':requested,'sourceType':'PARAMETRIC','realStatus':'UNBOUND'}
   else:
    result=match(c,e)
    if result['grade'] not in ['EXACT_MATCH','REFERENCE_MATCH'] or result['assetId']!=requested: raise Fault(409,'asset is not an accepted match')
    if result['grade']=='REFERENCE_MATCH' and p.get('acceptReference') is not True: raise Fault(400,'reference acceptance required')
   rows(c,'update equipment_instance set connected_asset_id=%s,matched_asset_id=%s,match_grade=%s,match_result=%s,version=version+1,updated_at=now() where id=%s',(requested,requested,result['grade'],Json(result),id)); audit(c,a,'BIND_PARAMETRIC' if source=='PARAMETRIC' else 'BIND_EXISTING',id,result,e['customer_id']); return {'status':'CONNECTED','grade':result['grade'],'assetId':requested,'sourceType':source or 'GLB'}
  if len(parts)==3 and parts[2]=='unbind' and method=='POST':
   result={'grade':'BLOCKED','assetId':None,'realStatus':'UNBOUND'}
   rows(c,"update equipment_instance set connected_asset_id=null,matched_asset_id=null,match_grade='BLOCKED',match_result=%s,version=version+1,updated_at=now() where id=%s",(Json(result),id)); audit(c,a,'UNBIND_ASSET',id,result,e['customer_id']); return {'status':'DISCONNECTED','assetId':None}
  if len(parts)==3 and parts[2]=='evidence' and method=='POST':
   kind=p.get('kind');name=text(p.get('name'),True);uri=text(p.get('sourceUri'),False,2000);storage=None;sha=None;size=0;mime=text(p.get('mime')) or 'application/octet-stream'
   if kind not in ['PHOTO','DRAWING','MANUAL','DIMENSION','GEOMETRY','PORT','FUNCTION','IDENTITY','OTHER']:raise Fault(400,'자료 종류 오류')
   if p.get('contentBase64'):
    try:raw=base64.b64decode(p['contentBase64'],validate=True)
    except Exception:raise Fault(400,'base64 오류')
    if len(raw)>5*1024*1024:raise Fault(413,'자료는 파일당 5MB 이하, 큰 원본은 경로 참조로 등록')
    sha=hashlib.sha256(raw).hexdigest();storage=sha;size=len(raw)
    target=DATA/storage
    if not target.exists():target.write_bytes(raw);target.chmod(0o600)
   elif not uri:raise Fault(400,'자료 파일 또는 원본 경로 필요')
   id2=uid();rows(c,'insert into evidence(id,instance_id,kind,name,source_uri,sha256,storage_name,mime,bytes,created_by) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',(id2,id,kind,name,uri,sha,storage,mime,size,a['accountId']));audit(c,a,'EVIDENCE_REGISTER',id2,{'instanceId':str(id),'sha256':sha},e['customer_id']);return {'id':id2,'status':'UNREVIEWED'}
 if len(parts)>=2 and parts[0]=='evidence':
  ev=one(c,'select * from evidence where id=%s',(validid(parts[1]),))
  if not ev:raise Fault(404,'자료 없음')
  e=instance(c,a,ev['instance_id'],method!='GET')
  if len(parts)==2 and method=='GET':
   if not ev['storage_name']:raise Fault(404,'업로드 파일 없음; 원본 경로 참조만 등록됨')
   return {'_download':str(DATA/ev['storage_name']),'name':ev['name']}
  if len(parts)==3 and parts[2]=='review' and method=='POST':
   adminonly(a)
   if 'RESULT_APPROVE' not in a.get('permissions',[]):raise Fault(403,'RESULT_APPROVE 권한 필요')
   status=p.get('status');note=text(p.get('note'),True,2000)
   if status not in ['APPROVED','REJECTED']:raise Fault(400,'검토 상태 오류')
   rows(c,'update evidence set review_status=%s,review_note=%s,reviewed_by=%s where id=%s',(status,note,a['accountId'],ev['id']));audit(c,a,'HUMAN_DOCUMENT_REVIEW',ev['id'],{'status':status,'note':note},e['customer_id'])
   if status=='REJECTED':invalidate_evidence(c,a,[ev['id']])
   kinds={x['kind'] for x in rows(c,"select distinct kind from evidence where instance_id=%s and review_status='APPROVED'",(e['id'],))};complete={'IDENTITY','GEOMETRY','DIMENSION','PORT','FUNCTION'}<=kinds
   rows(c,'update equipment_instance set verification=%s where id=%s',(Json({'status':'DOCUMENT_REVIEW_COMPLETE' if complete else 'PARTIAL_DOCUMENT_REVIEW','approvedKinds':sorted(kinds),'physicalVerified':False,'assetReady':False,'real':'UNBOUND'}),e['id']))
   return {'status':status,'documentReviewComplete':complete,'physicalVerified':False,'REAL':'UNBOUND'}
 if path=='/model-assets' and method=='POST':
  adminonly(a)
  if 'RESULT_APPROVE' not in a.get('permissions',[]):raise Fault(403,'RESULT_APPROVE 필요')
  e=instance(c,a,p.get('referenceInstanceId'),True);asset=text(p.get('assetId'),True,100)
  if not e['model_id'] or not e['shape_family'] or not all(e['dimensions_mm'].get(x) for x in ['width','depth','height']):raise Fault(400,'기준 설비의 모델/형상/치수 필요')
  if not one(c,'select id from asset where id=%s and entry_usd is not null',(asset,)):raise Fault(400,'연결 가능한 공통 자산 없음')
  evs=rows(c,"select id,kind from evidence where instance_id=%s and review_status='APPROVED' and id=any(%s::uuid[])",(e['id'],[validid(x) for x in p.get('evidenceIds',[])]))
  if not {'IDENTITY','GEOMETRY','DIMENSION'}<={x['kind'] for x in evs}:raise Fault(409,'승인된 식별/형상/치수 자료가 모두 필요')
  note=text(p.get('note'),True,2000);review={'approved':True,'method':'HUMAN_ATTESTED_MODEL_GEOMETRY_MAPPING','reviewer':a['accountId'],'evidenceIds':[str(x['id']) for x in evs],'dimensionsMm':e['dimensions_mm'],'shapeFamily':e['shape_family'],'purpose':e['purpose'],'workpiece':e['workpiece'],'io':e['io'],'referenceInstanceId':str(e['id']),'note':note}
  id=uid();rows(c,'insert into model_asset(id,model_id,asset_id,option_id,review) values(%s,%s,%s,%s,%s)',(id,e['model_id'],asset,e['option_id'],Json(review)));audit(c,a,'MODEL_ASSET_ATTESTATION',id,review,e['customer_id']);return {'id':id,'physicalVerified':False,'REAL':'UNBOUND'}
 raise Fault(404,'알 수 없는 API')
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send_json(self,status,obj):
  b=json.dumps(obj,ensure_ascii=False,default=str,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
 def do_GET(self):self.handle_api()
 def do_POST(self):self.handle_api()
 def do_PATCH(self):self.handle_api()
 def handle_api(self):
  try:
   u=urlparse(self.path);path=u.path
   if path=='/health' and self.command=='GET':return self.send_json(200,{'status':'UP','schema':1})
   if self.command!='GET':
    if self.headers.get('Origin') not in ['http://172.16.1.232','http://172.16.1.232:5174','http://127.0.0.1:5174','http://localhost:5174']:raise Fault(403,'Origin 불일치')
    if self.headers.get('X-P006-Requested-With')!='equipment-registry' or not self.headers.get('Content-Type','').startswith('application/json'):raise Fault(403,'CSRF 요청 헤더 필요')
   cookie=SimpleCookie();cookie.load(self.headers.get('Cookie',''));token=cookie.get('P006_SESSION');a=actor_for_session(token.value if token else '')
   length=int(self.headers.get('Content-Length','0'))
   if length>8*1024*1024:raise Fault(413,'요청 크기 제한 8MB')
   p=json.loads(self.rfile.read(length),parse_constant=lambda x:(_ for _ in ()).throw(ValueError('finite JSON required'))) if length else {}
   if not isinstance(p,dict):raise Fault(400,'JSON 객체 필요')
   with connect() as c:
    if self.command=='GET':c.set_session(readonly=True)
    if path.startswith('/composer/'):
     from composer_api import handle as composer_handle
     result=composer_handle(c,a,self.command,path,p,parse_qs(u.query))
    elif path=='/intake' or path.startswith('/intake/'):
     from intake_api import handle
     result=handle(c,a,self.command,path,p,parse_qs(u.query))
    else:result=dispatch(c,a,self.command,path,p,parse_qs(u.query))
   if '_download' in result:
    filename=result.get('downloadName','evidence.bin')
    if filename not in ('Factory.usda','ProductionNetwork.usda','manifest.json','verification.json','layout.snapshot.json','gui-ready.png','omniverse-viewport.png','gui-evidence.json','kit-open.json'):filename='evidence.bin'
    inline=result.get('_image') is True and filename.endswith('.png')
    body=Path(result['_download']).read_bytes();self.send_response(200);self.send_header('Content-Type','image/png' if inline else 'application/octet-stream');self.send_header('Content-Disposition',('inline' if inline else 'attachment')+'; filename="'+filename+'"');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
   else:self.send_json(200,result)
  except AuthenticationRequired:self.send_json(401,{'error':'P006 로그인 필요'})
  except Fault as e:self.send_json(e.status,{'error':e.message})
  except psycopg2.IntegrityError:self.send_json(409,{'error':'중복 코드 또는 참조 관계 오류. 저장은 취소되었습니다.'})
  except (ValueError,KeyError,TypeError):self.send_json(400,{'error':'입력 형식/필수 필드 오류'})
  except Exception:logging.exception('registry request failed');self.send_json(503,{'error':'등록 서비스 일시 오류. 저장 여부를 다시 조회하세요.'})
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',5186),Handler).serve_forever()
