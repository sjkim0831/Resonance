import pathlib,subprocess,json,re,hashlib,shutil,time
root=pathlib.Path('/opt/Resonance');e=root/'docs/operations/server-organization-20260907';e.mkdir(exist_ok=False)
archive=root/'ops/maintenance/archive/20260907';archive.mkdir(parents=True,exist_ok=True)
def run(*a):return subprocess.check_output(a,text=True).strip()
units=run('systemctl','list-units','--failed','--no-legend','--plain').splitlines()
failed=[];cleared=[]
for line in units:
    name=line.split()[0]
    props=run('systemctl','show',name,'-p','ActiveState','-p','SubState','-p','Transient','-p','MainPID','-p','Result','-p','ExecMainStatus','-p','InactiveEnterTimestamp','-p','FragmentPath')
    data=dict(x.split('=',1) for x in props.splitlines() if '=' in x);data['unit']=name;failed.append(data)
(e/'failed-before.json').write_text(json.dumps(failed,indent=2))
for d in failed:
    if re.fullmatch(r'carbonet-auto-deploy-retry-\d+\.service',d['unit']) and d.get('Transient')=='yes' and d.get('ActiveState')=='failed' and d.get('MainPID')=='0':
        subprocess.run(['systemctl','reset-failed',d['unit']],check=True);cleared.append(d['unit'])
names=['move-opt-residue-20260907.sh','relocate-local-resources-20260907.sh','cleanup-outside-opt-20260907.sh','registry-tag-inventory-20260907.py','registry-selective-migration.py','registry-copy-selected.py','registry-verify-selected.py','registry-cutover-selected.py','opt-capacity-safe-cleanup.py','deduplicate-postgres-backup-mirrors.py','relocate-local-tools-20260907.py','cleanup-unused-models-20260907.py','git-model-preflight.py','prepare-source-commit-20260907.py','commit-source-safely-20260907.py','delete-approved-old-opt-backup.py']
moved=[]
for name in names:
    p=pathlib.Path('/tmp')/name;q=archive/name
    if not p.is_file() or p.is_symlink():continue
    active=subprocess.run(['lsof','-t','--',str(p)],capture_output=True,text=True)
    if active.stdout.strip():continue
    if not q.exists():shutil.copy2(p,q)
    assert hashlib.sha256(p.read_bytes()).digest()==hashlib.sha256(q.read_bytes()).digest()
    p.unlink();moved.append(name)
services={}
for name in ['carbonet-production-direct','ccus-postgresql-native','carbonet-frontend-fast-dev','carbonet-dev-proxy','resonance-p006-web','resonance-shadow-gemma4-e4b','resonance-shadow-qwen05','resonance-shadow-qwen15','resonance-shadow-qwen7']:
    props=run('systemctl','show',name,'-p','ActiveState','-p','MainPID','-p','WorkingDirectory','-p','FragmentPath');services[name]=dict(x.split('=',1) for x in props.splitlines())
remaining=run('systemctl','list-units','--failed','--no-legend','--plain')
(e/'failed-remaining-names.txt').write_text('\n'.join(x.split()[0] for x in remaining.splitlines()))
(e/'services.json').write_text(json.dumps(services,indent=2))
result={'completed':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'failed_before':len(failed),'transient_history_cleared':len(cleared),'failed_remaining':len(remaining.splitlines()),'archived_scripts':moved,'protected':['/opt/reference','/opt/Resonance','/opt/ccus-postgresql16','/opt/registry/data','running models'],'note':'Clearing historical failed state is not service repair. No start/stop/restart executed.'}
(e/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
