def handle(c,a,method,path,p,params):
 from service import adminonly,rows,one,Fault,validid,text,audit,Json,access
 # Pending ownership has no customer ACL: project administrators only.
 adminonly(a)
 if path=='/intake' and method=='GET':
  data=rows(c,"""select i.*,coalesce(c.name,'UNKNOWN') customer_name,coalesce(f.name,'UNKNOWN') plant_name,
   coalesce(l.name,'UNKNOWN') line_name,coalesce(pr.name,'UNKNOWN') process_name,
   a.name asset_name,a.entry_usd,a.image,a.base_usd,a.variant,
   rev.decision review_decision,rev.review blocked_review,rev.candidate_asset_id review_asset_id,
   ra.name review_asset_name,ra.entry_usd review_entry_usd,ra.image review_image
   from equipment_intake i left join process pr on pr.id=i.process_id left join line l on l.id=pr.line_id
   left join plant f on f.id=l.plant_id left join customer c on c.id=f.customer_id left join asset a on a.id=i.asset_id
   left join intake_matching_review rev on rev.intake_id=i.id left join asset ra on ra.id=rev.candidate_asset_id order by i.id""")
  stats={'total':len(data),'recommended':sum(bool(x['asset_id'] and x['entry_usd']) for x in data),'acceptedConnections':0,'ownershipPending':sum(x['attribution_status']=='UNCONFIRMED' for x in data),'grades':{g:sum(x['grade']==g for x in data) for g in ['EXACT_MATCH','CLOSE_MATCH','REFERENCE_MATCH','NO_MATCH','BLOCKED']}}
  stats['recommendationCoverage']=round(100*stats['recommended']/stats['total'],2) if stats['total'] else 0
  stats['blockedReview']={k:sum(x['review_decision']==k for x in data) for k in ['REFERENCE_MATCH_POSSIBLE','EXISTING_ASSET_MODIFICATION','EXISTING_ASSET_COMBINATION','NEW_ASSET_REQUIRED','EQUIPMENT_INFO_REQUIRED']}
  if params.get('attribution',[''])[0]=='UNCONFIRMED':data=[x for x in data if x['attribution_status']=='UNCONFIRMED']
  return {'items':data,'stats':stats,'status':'LEDGER_CANDIDATES_NOT_INSTALLATION_VERIFIED','library':one(c,'select count(*) total,count(entry_usd) connected from asset')}
 if path=='/intake/attribution' and method=='POST':
  targets=p.get('items');note=text(p.get('evidence'),True,4000);process=validid(p.get('processId'))
  if len(note)<11:raise Fault(400,'귀속 확정 근거를 11자 이상 기록하세요')
  if not isinstance(targets,list) or not 1<=len(targets)<=500:raise Fault(400,'1~500개 대상 필요')
  ids=[text(x.get('id'),True,100) for x in targets]
  if len(set(ids))!=len(ids):raise Fault(400,'중복 대상')
  pro=one(c,'select f.customer_id from process pr join line l on l.id=pr.line_id join plant f on f.id=l.plant_id where pr.id=%s',(process,))
  if not pro:raise Fault(400,'실제 등록된 업체/공장/라인/공정을 선택하세요')
  access(c,a,pro['customer_id'],True)
  current=rows(c,'select * from equipment_intake where id=any(%s) order by id for update',(ids,))
  if len(current)!=len(targets):raise Fault(404,'원장 후보 없음')
  versions={x['id']:x.get('version') for x in targets}
  if any(type(versions[x['id']]) is not int or x['version']!=versions[x['id']] for x in current):raise Fault(409,'변경된 자료가 있습니다. 새로고침 후 다시 선택하세요')
  for x in current:
   rows(c,"update equipment_intake set process_id=%s,attribution_status='CONFIRMED',attribution_evidence=%s,version=version+1,updated_at=now() where id=%s",(process,note,x['id']))
   audit(c,a,'INTAKE_ATTRIBUTION_CONFIRMED',x['id'],{'before':{'processId':str(x['process_id']) if x['process_id'] else None,'status':x['attribution_status']},'processId':process,'evidence':note,'sourcePreserved':True},pro['customer_id'])
  return {'updated':len(current),'mappingChanged':False,'installationVerified':False}
 raise Fault(404,'원장 후보 API 없음')
