import importlib.util,pathlib,datetime as dt,json
spec=importlib.util.spec_from_file_location('collector','/tmp/ccus-runtime-alert-collector.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
conn=m.connect_runtime()
import subprocess
role=conn.get_dsn_parameters()['user'].replace('"','""')
psql=['sudo','-n','-u','postgres','psql','-h','/opt/Resonance/runtime/postgresql16/socket','-p','35433','-d','carbonet','-v','ON_ERROR_STOP=1']
subprocess.run(psql,input='CREATE SCHEMA ccus_collector_test AUTHORIZATION "'+role+'";',text=True,check=True,capture_output=True)
class Scoped:
 def __init__(self,c):self.c=c
 def execute(self,q,p=None):return self.c.execute(q.replace('public.process_preview','ccus_collector_test.process_preview'),p)
 def fetchone(self):return self.c.fetchone()
try:
 with conn.cursor() as c:
  c.execute('SET LOCAL search_path=ccus_collector_test,pg_catalog')
  c.execute(pathlib.Path('/tmp/recorder-audit-schema.sql').read_text())
  cur=Scoped(c);now=dt.datetime.now(dt.timezone.utc)
  event=dict(sourceCode='API_HTTP_500',occurredAt=now.isoformat(),statusCode=500,pathname='/api/qa?secret=excluded',reasonCode='QA_FIXTURE')
  assert m.store_event(cur,event,now)=='inserted';print('PASS new failure persisted')
  assert m.store_event(cur,event,now)=='duplicate';print('PASS retry deduplicated')
  c.execute('SELECT count(*) FROM ccus_collector_test.process_preview_recording_audit_transition');assert c.fetchone()[0]==2;print('PASS two atomic transitions')
  c.execute('SELECT occurred_at,payload::text FROM ccus_collector_test.process_preview_recording_audit');row=c.fetchone();assert row[0]==now and 'secret' not in row[1];print('PASS original timestamp and query redaction')
  assert m.store_event(cur,{**event,'occurredAt':(now-dt.timedelta(days=2)).isoformat()},now)=='historical';print('PASS stale event not reclassified as current')
  assert m.store_event(cur,{**event,'sourceCode':'UNRECOGNIZED'},now)=='ignored';print('PASS unsupported source rejected')
  c.execute('SELECT count(*) FROM ccus_collector_test.process_preview_runtime_alert_delivery');assert c.fetchone()[0]==0;print('PASS no external delivery ledger')
finally:
 conn.rollback();conn.close()
 subprocess.run(psql,input='DROP SCHEMA ccus_collector_test;',text=True,check=True,capture_output=True)
