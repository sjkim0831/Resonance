import base64,hashlib,json,os,re,threading,time,uuid
from pathlib import Path
from service import DATA,Fault
LOCK=threading.Lock()
def handle(a,method,path,p):
 parts=path.strip('/').split('/');asset=parts[1].upper() if len(parts)>1 else ''
 if not re.fullmatch(r'[A-Z0-9][A-Z0-9_.-]{0,99}',asset):raise Fault(400,'자산 코드가 필요합니다')
 owner=hashlib.sha256(str(a['accountId']).encode()).hexdigest()
 folder=DATA/'asset-evidence'/owner/asset;folder.mkdir(parents=True,exist_ok=True)
 index=folder/'index.json'
 with LOCK:
  records=json.loads(index.read_text(encoding='utf-8')) if index.exists() else []
  if method=='GET' and len(parts)==2:
   visible=[x for x in records if not x.get('deletedAt')]
   return {'assetId':asset,'evidence':[{k:v for k,v in x.items() if k!='storage'} for x in visible]}
  if method=='GET' and len(parts)==3:
   item=next((x for x in records if x['id']==parts[2]),None)
   if not item or item.get('deletedAt') or not item.get('storage'):raise Fault(404,'업로드 파일이 없습니다')
   return {'_download':str(folder/item['storage']),'downloadName':item['name']}
  if method=='DELETE' and len(parts)==3:
   item=next((x for x in records if x.get('id')==parts[2] and not x.get('deletedAt')),None)
   if not item:raise Fault(404,'삭제할 자료를 찾을 수 없습니다')
   item['deletedAt']=time.time();item['deletedBy']=hashlib.sha256(str(a['accountId']).encode()).hexdigest()
   temp=folder/(str(uuid.uuid4())+'.tmp');temp.write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8');os.replace(temp,index)
   return {'id':item['id'],'status':'DELETED','assetId':asset}
  if method!='POST' or len(parts)!=2:raise Fault(405,'허용되지 않은 요청')
  kind=p.get('kind');name=p.get('name');uri=p.get('sourceUri') or ''
  if kind not in ['PHOTO','DRAWING','MANUAL','DIMENSION','GEOMETRY','PORT','FUNCTION','IDENTITY','OTHER','MODEL_3D','PACK_REFERENCE']:raise Fault(400,'자료 유형 오류')
  if not isinstance(name,str) or not name.strip() or len(name)>250:raise Fault(400,'자료 이름 오류')
  if not isinstance(uri,str) or len(uri)>2000:raise Fault(400,'원본 경로 오류')
  if re.match(r'^(javascript|data|vbscript):',uri,re.I):raise Fault(400,'허용되지 않은 URL')
  if not isinstance(uri,str) or len(uri)>2000:raise Fault(400,'출처 URL 형식 오류')
  if uri.strip() and not re.match(r'^https?://[^\s]+$',uri,re.I):raise Fault(400,'출처 URL은 http 또는 https만 허용됩니다')
  metadata=p.get('metadata') or {}
  if not isinstance(metadata,dict) or len(json.dumps(metadata,ensure_ascii=False))>8000:raise Fault(400,'에셋 부가정보 형식/크기 오류')
  allowed_meta={'provider','packId','format','manufacturer','model','targetName','targetAssetCode','license','fileName'}
  if set(metadata)-allowed_meta:raise Fault(400,'허용되지 않은 에셋 부가정보입니다')
  metadata={k:v.strip() for k,v in metadata.items() if isinstance(v,str) and len(v)<=500}
  if kind=='MODEL_3D' and metadata.get('format') not in ['USD','USDA','USDC','USDZ','GLB','GLTF']:raise Fault(400,'3D 파일 형식 오류')
  raw=None;sha=None
  if p.get('contentBase64'):
   try:raw=base64.b64decode(p['contentBase64'],validate=True)
   except Exception:raise Fault(400,'파일 데이터 오류')
   if len(raw)>5*1024*1024:raise Fault(413,'파일당 5MB 이하로 등록하세요')
   sha=hashlib.sha256(raw).hexdigest()
  elif not uri.strip():raise Fault(400,'파일 또는 URL을 입력하세요')
  id=str(uuid.uuid4());item={'id':id,'assetId':asset,'kind':kind,'name':name.strip(),'source_uri':uri.strip(),'sha256':sha,'bytes':len(raw) if raw else 0,'mime':p.get('mime') or 'application/octet-stream','review_status':'UNREVIEWED','storage':id if raw is not None else None,'metadata':metadata}
  if raw is not None:(folder/id).write_bytes(raw)
  records.append(item);temp=folder/(str(uuid.uuid4())+'.tmp');temp.write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8');os.replace(temp,index)
  return {'id':id,'status':'UNREVIEWED','assetId':asset}
