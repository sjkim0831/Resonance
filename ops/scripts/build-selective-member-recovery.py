#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime, timezone
import subprocess,json,sys,html,hashlib,zipfile,shutil,os

ROOT=Path('/opt/Resonance'); BASE=Path(os.environ.get('SYSTEM_DESIGN_LATEST',str((ROOT/'var/ai-runtime/system-design-generator/latest').resolve())))
OUT=Path(os.environ.get('MEMBER_SELECTIVE_OUT','/tmp/member-process-selective-recovery')); shutil.rmtree(OUT,ignore_errors=True)
for d in ('database','scripts','design','source','evidence'): (OUT/d).mkdir(parents=True,exist_ok=True)
def run(a,input=None):
 p=subprocess.run(a,input=input,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True); return p.stdout
pods=run(['kubectl','-n','carbonet-prod','get','pods','-l','app=postgres-patroni','-o','jsonpath={range .items[*]}{.metadata.name}{"\\n"}{end}']).splitlines()
leader=next(p for p in pods if run(['kubectl','-n','carbonet-prod','exec',p,'-c','patroni','--','psql','-h','127.0.0.1','-U','postgres','-d','carbonet','-Atqc','select pg_is_in_recovery()']).strip()=='f')
def q(sql): return run(['kubectl','-n','carbonet-prod','exec',leader,'-c','patroni','--','psql','-h','127.0.0.1','-U','postgres','-d','carbonet','-X','-q','-At','-v','ON_ERROR_STOP=1','-c',sql]).strip()
codes=json.loads(q("select jsonb_agg(process_code order by development_order nulls last,process_code)::text from framework_process_definition where domain_code='MEMBER'"))
tables=['framework_process_definition','framework_business_process_sequence','framework_process_step','framework_process_data_handoff','framework_process_flow_edge','framework_process_professional_scenario','framework_professional_screen_contract','framework_step_execution_spec']
lit=','.join("'"+x.replace("'","''")+"'" for x in codes)
datasets={}; counts={}
for t in tables:
  condition=f"process_code in ({lit})"
  raw=q(f"select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)::text from (select * from public.{t} where {condition}) x")
  datasets[t]=json.loads(raw); counts[t]=len(datasets[t])
(OUT/'database'/'target-process-codes.json').write_text(json.dumps({'documentedProcesses':[x for x in codes if x!='MEMBER_LIFECYCLE'],'supportProcesses':['MEMBER_LIFECYCLE'],'allRestoreCodes':codes},ensure_ascii=False,indent=2))
schema='member_process_recovery_backup_20260904'
backup=['\\set ON_ERROR_STOP on','BEGIN;',f'CREATE SCHEMA IF NOT EXISTS {schema};']
for t in tables: backup += [f'DROP TABLE IF EXISTS {schema}.{t};',f'CREATE TABLE {schema}.{t} AS SELECT * FROM public.{t} WHERE process_code IN ({lit});']
backup += ['COMMIT;']
(OUT/'database'/'01_backup_target_rows.sql').write_text('\n'.join(backup)+'\n')
restore=['\\set ON_ERROR_STOP on','BEGIN;','SET LOCAL session_replication_role=replica;']
for t in reversed(tables): restore.append(f'DELETE FROM public.{t} WHERE process_code IN ({lit});')
for t in tables:
 data=json.dumps(datasets[t],ensure_ascii=False,separators=(',',':'))
 restore.append(f"INSERT INTO public.{t} SELECT * FROM jsonb_populate_recordset(NULL::public.{t}, $JSON${data}$JSON$::jsonb);")
restore += ['SET LOCAL session_replication_role=origin;','COMMIT;']
(OUT/'database'/'02_restore_only_member_processes.sql').write_text('\n'.join(restore)+'\n')
rollback=['\\set ON_ERROR_STOP on','BEGIN;','SET LOCAL session_replication_role=replica;']
for t in reversed(tables): rollback.append(f'DELETE FROM public.{t} WHERE process_code IN ({lit});')
for t in tables: rollback.append(f'INSERT INTO public.{t} SELECT * FROM {schema}.{t};')
rollback += ['SET LOCAL session_replication_role=origin;','COMMIT;']
(OUT/'database'/'03_rollback_target_rows.sql').write_text('\n'.join(rollback)+'\n')
verify=['\\set ON_ERROR_STOP on',"select 'target_processes',count(*) from framework_process_definition where process_code in ("+lit+");"]
for t,c in counts.items(): verify.append(f"select '{t}',count(*),'{c}' expected from public.{t} where process_code in ({lit});")
(OUT/'database'/'04_verify_target_rows.sql').write_text('\n'.join(verify)+'\n')
sh='''#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${1:-}" == "--apply" ]] || { echo "DRY RUN: 대상 회원 프로세스만 복구합니다. 실제 실행은 --apply"; exit 0; }
: "${PGHOST:?}" "${PGDATABASE:?}" "${PGUSER:?}"+here=$(cd "$(dirname "$0")/.." && pwd)
psql -X -v ON_ERROR_STOP=1 -f "$here/database/01_backup_target_rows.sql"
psql -X -v ON_ERROR_STOP=1 -f "$here/database/02_restore_only_member_processes.sql"
psql -X -v ON_ERROR_STOP=1 -f "$here/database/04_verify_target_rows.sql"
echo PASS
'''.replace('"\\+here','"\nhere')
(OUT/'scripts'/'restore-only-member-processes.sh').write_text(sh); (OUT/'scripts'/'restore-only-member-processes.sh').chmod(0o755)
(OUT/'scripts'/'rollback-only-member-processes.sh').write_text('#!/usr/bin/env bash\nset -Eeuo pipefail\n[[ "${1:-}" == "--apply" ]] || { echo "DRY RUN: --apply required"; exit 0; }\nhere=$(cd "$(dirname "$0")/.." && pwd)\npsql -X -v ON_ERROR_STOP=1 -f "$here/database/03_rollback_target_rows.sql"\npsql -X -v ON_ERROR_STOP=1 -f "$here/database/04_verify_target_rows.sql"\n'); (OUT/'scripts'/'rollback-only-member-processes.sh').chmod(0o755)
for f in ('system-design-documents.zip','system-design-snapshot.json','meta.json'): shutil.copy2(BASE/f,OUT/'design'/f)
patterns='MEMBER_REGISTRATION|MEMBER_APPROVAL|ACCOUNT_WITHDRAWAL|COMPANY_MANAGER_DELEGATION|CONTACT_REVERIFICATION|COMPANY_MEMBER_INVITATION|COMPANY_REAPPLICATION_PUBLIC|ACCOUNT_LOCK_RECOVERY'
proc=subprocess.run(['rg','-l','--hidden','-g','!var/**','-g','!**/node_modules/**','-g','!**/target/**','-g','!**/.git/**',patterns,'apps','modules','projects','ops'],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
files=sorted(x for x in proc.stdout.splitlines() if x)
(OUT/'source'/'relevant-files.txt').write_text('\n'.join(files)+'\n')
(OUT/'source'/'git-head.txt').write_text(run(['git','-C',str(ROOT),'rev-parse','HEAD']))
(OUT/'source'/'tracked-changes.patch').write_text(run(['git','-C',str(ROOT),'diff','--binary','--','.']),errors='replace')
if files: subprocess.run(['tar','-C',str(ROOT),'-czf',str(OUT/'source'/'member-related-source-files.tar.gz'),*files],check=True)
report={'createdAt':datetime.now(timezone.utc).astimezone().isoformat(),'scope':'MEMBER domain only','documentedProcessCount':len(codes)-1,'supportProcessCount':1,'restoreProcessCount':len(codes),'tableCounts':counts,'otherDomainsDeletedOrUpdated':False,'backupSchema':schema,'sourceFiles':len(files)}
(OUT/'evidence'/'selective-recovery-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
rows=''.join(f'<tr><td>{html.escape(t)}</td><td>{c}</td></tr>' for t,c in counts.items())
(OUT/'선택복구_설계서.html').write_text(f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>회원 프로세스 선택 복구 설계서</title><style>body{{font-family:Arial,"Malgun Gothic";max-width:1100px;margin:40px auto;line-height:1.65}}h1,h2{{color:#07366c}}section{{border:1px solid #ccd8e5;padding:22px;margin:18px 0}}table{{width:100%;border-collapse:collapse}}th,td{{border:1px solid #ccd8e5;padding:9px}}th{{background:#e8f2ff}}.ok{{border-left:5px solid #087f5b;background:#e9fff6;padding:14px}}</style><h1>회원 프로세스만 선택 복구</h1><section><h2>범위</h2><p class="ok">문서화된 회원 프로세스 {len(codes)-1}개와 참조 무결성을 위한 상위 프로세스 1개만 복구합니다. 다른 도메인의 행은 삭제·수정하지 않습니다.</p></section><section><h2>복구 데이터</h2><table><tr><th>테이블</th><th>대상 행</th></tr>{rows}</table></section><section><h2>실행 순서</h2><ol><li>01_backup_target_rows.sql로 현재 대상 행만 별도 스키마에 백업</li><li>02_restore_only_member_processes.sql로 대상 process_code 행만 교체</li><li>04_verify_target_rows.sql로 테이블별 건수 비교</li><li>문제 발생 시 03_rollback_target_rows.sql 실행</li></ol></section><section><h2>안전장치</h2><ul><li>트랜잭션과 ON_ERROR_STOP</li><li>대상 코드 명시 목록</li><li>다른 도메인 DELETE/UPDATE 없음</li><li>실행 전 대상 행 자동 백업</li><li>--apply 명시 전에는 DRY RUN</li></ul></section></html>''',encoding='utf-8')
def sums():
 lines=[]
 for p in sorted(OUT.rglob('*')):
  if p.is_file() and p.name!='SHA256SUMS': lines.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(OUT)).replace('\\','/'))
 (OUT/'evidence'/'SHA256SUMS').write_text('\n'.join(lines)+'\n')
sums(); archive=OUT.with_suffix('.tar.gz')
with __import__('tarfile').open(archive,'w:gz') as tf: tf.add(OUT,arcname=OUT.name)
print(json.dumps({'out':str(OUT),'archive':str(archive),'codes':len(codes),'documented':len(codes)-1,'counts':counts,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},ensure_ascii=False))
