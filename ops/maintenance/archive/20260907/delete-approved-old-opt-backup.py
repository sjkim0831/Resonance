import pathlib,subprocess,json,time
p=pathlib.Path('/opt/opt.backup_before_cleanup_20260627')
e=pathlib.Path('/opt/Resonance/docs/operations/old-opt-backup-removal-20260907');e.mkdir(exist_ok=False)
git_result=json.loads(pathlib.Path('/opt/Resonance/docs/operations/git-cleanup-20260907/result.json').read_text())
assert git_result['remote_matches']
assert p.resolve()==p and p.is_dir() and not p.is_symlink()
assert pathlib.Path('/opt/Resonance/.git').is_dir() and pathlib.Path('/opt/cubrid').exists()
active=subprocess.run(['lsof','-t','+D',str(p)],capture_output=True,text=True)
assert not active.stdout.strip(),'Backup is in use'
size=int(subprocess.check_output(['du','-sb',str(p)],text=True).split()[0]);start=time.time()
with (e/'removed-files.manifest').open('w') as f:subprocess.run(['find',str(p),'-xdev','-type','f','-printf','%s %T@ %p\n'],stdout=f,check=True)
subprocess.run(['find',str(p),'-xdev','-depth','-delete'],check=True)
assert not p.exists()
result={'deleted':str(p),'logical_bytes_before':size,'elapsed_seconds':round(time.time()-start,2),'completed':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'source_commit':git_result['commit']}
(e/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
