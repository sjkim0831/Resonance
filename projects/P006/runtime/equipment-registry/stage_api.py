"""Saved layout only; no registry/layout UPDATE. Durable isolated export jobs."""
import json,uuid,subprocess,os,time
from pathlib import Path
from service import Fault,adminonly,validid,one
ROOT=Path('/home/sjkim/OmniverseProjects/factory-layouts')
HERE=Path(__file__).resolve().parent
PYTHON='/home/sjkim/.venvs/usd-tools/bin/python'
def handle(c,a,method,suffix,p,params):
 adminonly(a)
 if suffix=='/stages' and method=='POST':
  started=time.perf_counter()
  from composer_api import get_layout,validate
  if set(p)-{'layoutId','version','previousStageId','portable'} or not {'layoutId','version'}<=set(p):raise Fault(400,'저장된 layoutId/version 및 선택 previousStageId/portable만 지정하세요')
  if 'portable' in p and type(p['portable']) is not bool:raise Fault(400,'portable은 true/false 값이어야 합니다')
  portable=p.get('portable',False)
  if portable and p.get('previousStageId'):raise Fault(400,'전체 패키지는 증분 Stage를 사용하지 않습니다')
  layout_id=validid(p['layoutId'])
  one(c,'select version from factory_layout where id=%s for share',(layout_id,))
  doc=get_layout(c,layout_id)
  revision=one(c,'select document from factory_layout_revision where layout_id=%s and version=%s',(layout_id,doc['version']))
  if not revision or revision['document']!=doc:raise Fault(409,'저장된 Revision과 Layout 불일치. 내보내기 보류')
  if doc['version']!=p['version']:raise Fault(409,'Layout 버전 변경. 최신 문서를 다시 여세요')
  readMs=(time.perf_counter()-started)*1000;tick=time.perf_counter();validate(c,doc);lookupMs=(time.perf_counter()-tick)*1000
  previous=None
  if p.get('previousStageId'):
   previous=ROOT/validid(p['previousStageId'])
   if not (previous/'verification.json').is_file():raise Fault(409,'이전 Stage 검증 완료 후 증분 생성 가능합니다')
   prev=json.loads((previous/'job.json').read_text())
   if prev['layoutId']!=doc['id']:raise Fault(409,'다른 Layout의 Stage는 증분 기반으로 사용할 수 없습니다')
  if not doc['instances']:raise Fault(400,'빈 Layout은 내보낼 수 없습니다')
  # Global file lock belongs to worker; survives HTTP/service restarts without duplicate workers.
  ROOT.mkdir(parents=True,exist_ok=True)
  import fcntl
  lock=open(ROOT/'.export.lock','a')
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:lock.close();raise Fault(409,'다른 Stage 생성 중입니다. 완료 후 다시 실행하세요')
  id=str(uuid.uuid4());out=ROOT/id;out.mkdir(mode=0o750)
  (out/'layout.snapshot.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2))
  (out/'job.json').write_text(json.dumps({'id':id,'layoutId':doc['id'],'version':doc['version'],'portable':portable,'actorId':str(a['accountId']),'createdAt':time.time(),'state':'RUNNING','apiTimingsMs':{'dbLayoutRead':round(readMs,3),'assetLookupValidation':round(lookupMs,3)}}))
  with open(out/'worker.log','wb') as log:
   process=subprocess.Popen(['/usr/bin/timeout','180',PYTHON,str(HERE/('factory_portable_exporter.py' if portable else 'stage_exporter.py')),str(out/'layout.snapshot.json')]+([str(previous)] if previous else []),stdout=log,stderr=subprocess.STDOUT,start_new_session=True,pass_fds=(lock.fileno(),))
  (out/'pid').write_text(str(process.pid));lock.close()
  return {'id':id,'state':'RUNNING','layoutId':doc['id'],'version':doc['version']}
 parts=suffix.strip('/').split('/')
 if len(parts)>=2 and parts[0]=='stages' and method=='GET':
  id=validid(parts[1]);out=ROOT/id
  if not (out/'job.json').is_file():raise Fault(404,'Stage 작업 없음')
  job=json.loads((out/'job.json').read_text())
  if len(parts)==3:
   allowed={'usd':'Factory.usda','portable':'Factory.usdz','portable-report':'portable-report.json','report':'verification.json','snapshot':'layout.snapshot.json','gui':'gui-ready.png','viewport':'omniverse-viewport.png','gui-evidence':'gui-evidence.json','kit-evidence':'kit-open.json'}
   if parts[2] not in allowed:raise Fault(404,'산출물 없음')
   target=out/allowed[parts[2]]
   if not target.is_file():raise Fault(409,'산출물 생성 전')
   if parts[2]=='portable':
    verification=out/'portable-report.json'
    if not verification.is_file() or json.loads(verification.read_text()).get('result')!='PASS':raise Fault(409,'전체 USD 패키지 검증 미완료')
   return {'_download':str(target),'downloadName':target.name,'_image':parts[2] in ('gui','viewport')}
  if len(parts)!=2:raise Fault(404,'Stage API 없음')
  if job.get('portable'):
   if (out/'portable-report.json').is_file():
    portable_report=json.loads((out/'portable-report.json').read_text())
    return dict(job,state='FINISHED' if portable_report.get('result')=='PASS' else 'FAILED',portableReport=portable_report,error=' / '.join(portable_report.get('errors',[])))
   if time.time()-job['createdAt']>190:return dict(job,state='FAILED',error='180초 제한 초과. 다시 생성하세요.')
   return job
  if (out/'verification.json').is_file():
   report=json.loads((out/'verification.json').read_text())
   if (out/'gui-evidence.json').is_file():
    ev=json.loads((out/'gui-evidence.json').read_text())
    if ev.get('reviewed') is True and ev.get('stageSha256')==report.get('stageSha256'):
     import hashlib
     valid=all((out/name).is_file() and hashlib.sha256((out/name).read_bytes()).hexdigest()==sha for name,sha in ev.get('evidenceHashes',{}).items())
     if valid and ev.get('evidenceHashes'):
      report['guiEvidence']=ev
      report['states']['OMNIVERSE_VERIFIED']=ev.get('OMNIVERSE_VERIFIED') is True
      report['states']['RTX_VERIFIED']=ev.get('RTX_VERIFIED') is True
   return dict(job,state='FINISHED',report=report)
  if time.time()-job['createdAt']>190:return dict(job,state='FAILED',error='180초 제한 초과 또는 worker 중단. 기존 Layout은 보존됩니다. 새 작업으로 재시도하세요.')
  return job
 raise Fault(404,'Stage API 없음')
