import subprocess,pathlib
pid=subprocess.check_output(['systemctl','show','carbonet-production-direct.service','-p','MainPID','--value'],text=True).strip()
env=dict(x.split(b'=',1) for x in pathlib.Path('/proc/'+pid+'/environ').read_bytes().split(b'\0') if b'=' in x)
user=env.get(b'SPRING_DATASOURCE_USERNAME') or env.get(b'DB_USERNAME')
if not user: raise SystemExit('Runtime DB role not found; no permission assumption made')
role=user.decode().replace('"','""')
sql='BEGIN READ ONLY; SET LOCAL statement_timeout=\'10s\'; SET LOCAL ROLE "'+role+'"; SET LOCAL search_path=public,pg_catalog;\n'+pathlib.Path('/tmp/recorder-list-query.sql').read_text()+'\nROLLBACK;'
r=subprocess.run(['sudo','-n','-u','postgres','psql','-h','/opt/Resonance/runtime/postgresql16/socket','-p','35433','-d','carbonet','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
print('runtimeRoleQueryPass='+str(r.returncode==0))
if r.returncode: print('Query failed; inspect database role permissions without disclosing credentials')
raise SystemExit(r.returncode)
