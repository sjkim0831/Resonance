#!/usr/bin/env python3
"""Native PostgreSQL collector. No schema creation, recovery claims or delivery."""
import datetime as dt, fcntl, json, os, pathlib, subprocess, sys
from urllib.parse import urlparse, unquote
import psycopg2

ROOT=pathlib.Path('/opt/Resonance')
EVENT=ROOT/'runtime/platform-data/dev-worktrees/certificate-verification/var/dev-design-sync/runtime-alert-events.jsonl'
STATE=ROOT/'var/dev-design-sync/native-alert-collector'
ALLOWED={'PDF_ISSUANCE_FAILURE','API_HTTP_500','PAGE_HTTP_404','LOGIN_AUTHENTICATION_FAILURE'}

def connect_runtime():
    pid=subprocess.check_output(['systemctl','show','carbonet-production-direct.service','-p','MainPID','--value'],text=True).strip()
    if not pid.isdigit() or int(pid)<1: raise RuntimeError('CCUS runtime is not active')
    env=dict(x.split(b'=',1) for x in pathlib.Path('/proc/'+pid+'/environ').read_bytes().split(b'\0') if b'=' in x)
    def get(*keys):
        return next((env[k.encode()].decode() for k in keys if env.get(k.encode())),None)
    url=get('SPRING_DATASOURCE_URL','DB_URL')
    if not url or not url.startswith('jdbc:postgresql://'): raise RuntimeError('Unsupported runtime datasource')
    parsed=urlparse(url[5:])
    return psycopg2.connect(host=parsed.hostname,port=parsed.port or 5432,dbname=unquote(parsed.path.lstrip('/')),user=get('SPRING_DATASOURCE_USERNAME','DB_USERNAME'),password=get('SPRING_DATASOURCE_PASSWORD','DB_PASSWORD'),connect_timeout=5,options='-c statement_timeout=10000 -c lock_timeout=3000')

def store_event(cur,event,now):
    source=event.get('sourceCode')
    if source not in ALLOWED: return 'ignored'
    when=dt.datetime.fromisoformat(str(event.get('occurredAt','')).replace('Z','+00:00'))
    if when.tzinfo is None: raise ValueError('Missing timestamp timezone')
    if when>now+dt.timedelta(minutes=2): raise ValueError('Future timestamp')
    if when<now-dt.timedelta(minutes=15): return 'historical'
    status=int(event.get('statusCode',0))
    path=str(event.get('pathname','/')).split('?',1)[0][:240]
    reason=f"{source}:{str(event.get('reasonCode','RUNTIME_FAILURE'))[:100]}:HTTP_{status}:{path}"
    actor,severity,minutes={'PDF_ISSUANCE_FAILURE':('REPORT_ADMIN','CRITICAL',15),'API_HTTP_500':('SYSTEM_OPERATOR','CRITICAL',10),'PAGE_HTTP_404':('WEB_ADMIN','HIGH',30),'LOGIN_AUTHENTICATION_FAILURE':('SECURITY_ADMIN','MEDIUM',60)}[source]
    payload={k:event.get(k) for k in ('schemaVersion','occurredAt','sourceCode','statusCode','method','reasonCode')}
    payload['pathname']=path
    cur.execute('''INSERT INTO public.process_preview_recording_audit
      (event_type,status,alert,reason,process_code,payload,occurred_at,source_code,severity,assigned_actor,due_at,workflow_status,acknowledgement_status,consecutive_failures)
      VALUES ('FAILURE','FAILED_FINAL',true,%s,NULL,%s::jsonb,%s,%s,%s,%s,%s,'ASSIGNED','UNACKNOWLEDGED',1)
      ON CONFLICT DO NOTHING RETURNING id''',(reason,json.dumps(payload),when,source,severity,actor,when+dt.timedelta(minutes=minutes)))
    row=cur.fetchone()
    if not row:return 'duplicate'
    cur.execute('''INSERT INTO public.process_preview_recording_audit_transition(audit_id,from_status,to_status,actor,detail,occurred_at)
      VALUES (%s,NULL,'DETECTED','SYSTEM','native collector: original event timestamp retained',%s),
      (%s,'DETECTED','ASSIGNED','SYSTEM',%s,%s)''',(row[0],when,row[0],f'actor={actor}; severity={severity}',when))
    return 'inserted'

def atomic(path,value):
    tmp=path.with_suffix('.tmp')
    with open(tmp,'w') as out:json.dump(value,out);out.flush();os.fsync(out.fileno())
    os.replace(tmp,path)

def main():
    STATE.mkdir(parents=True,exist_ok=True)
    with open(STATE/'lock','w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return
        if not EVENT.exists():print('collector: no event file');return
        with open(EVENT,'rb') as stream:
            stat=os.fstat(stream.fileno());checkpoint=STATE/'checkpoint.json'
            if checkpoint.exists():old=json.loads(checkpoint.read_text())
            else:old={'inode':stat.st_ino,'offset':stat.st_size}
            offset=old['offset'] if old['inode']==stat.st_ino and old['offset']<=stat.st_size else 0
            if not checkpoint.exists():
                atomic(checkpoint,old);print('collector: baseline saved; historical file retained, not replayed');return
            stream.seek(offset);data=stream.read(1024*1024)
            end=data.rfind(b'\n')+1
            if not end:print('collector: no complete new events');return
            counts={};now=dt.datetime.now(dt.timezone.utc)
            with connect_runtime() as conn:
                with conn.cursor() as cur:
                    for raw in data[:end].splitlines():
                        try:
                            event=json.loads(raw)
                            if not isinstance(event,dict):raise ValueError('Event is not an object')
                            result=store_event(cur,event,now)
                        except (ValueError,TypeError,OverflowError):result='invalid_retained_in_source'
                        counts[result]=counts.get(result,0)+1
            atomic(checkpoint,{'inode':stat.st_ino,'offset':offset+end})
            atomic(STATE/'last-result.json',{'checkedAt':now.isoformat(),'counts':counts,'externalDelivery':False})
            print(json.dumps(counts))

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('collector failed; checkpoint not advanced: '+type(exc).__name__,file=sys.stderr);sys.exit(1)
