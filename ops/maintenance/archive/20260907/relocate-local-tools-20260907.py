import pathlib,subprocess,os,time,json,shutil,hashlib
src=pathlib.Path('/home/sjkim/.local');dst=pathlib.Path('/opt/Resonance/runtime/host-data/user-local')
e=pathlib.Path('/opt/Resonance/docs/operations/local-tools-relocation-20260907');e.mkdir(exist_ok=False)
start=time.time();moved=[];skipped=[]
rels=['lib/node_modules','lib/resonance.before-ccus-20260906-210928']
rels+=['share/'+n for n in ['kotlin','k9s','bash-completion','uv','pyapp','pnpm','metaflow','tirith','pipx','man','opencode','opentui','xyzservices','jupyter','doc','zsh']]
rels+=['etc','testing','include','node_modules','nvim','package.json','package-lock.json','bin']
checks=[['/home/sjkim/.local/bin/pnpm','--version'],['/home/sjkim/.local/bin/python3.11','--version'],['/home/sjkim/.local/bin/python3.12','--version'],['/home/sjkim/.local/bin/nvim','--version']]
def smoke():
    out=[]
    for c in checks:
        r=subprocess.run(['sudo','-u','sjkim',*c],capture_output=True,text=True,timeout=30)
        out.append({'command':c,'code':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
    return out
before=smoke();(e/'before.json').write_text(json.dumps(before,indent=2));assert all(r['code']==0 for r in before)
links={str(p.relative_to(src)):p.resolve() for p in (src/'bin').iterdir() if p.is_symlink() and p.exists()}
subprocess.run(['df','-h','/opt','/'],stdout=(e/'disk-before.txt').open('w'))
def diff(p,q):
    args=['rsync','-aHAXnc','--numeric-ids','--delete','--itemize-changes',str(p)+'/',str(q)+'/'] if p.is_dir() else ['rsync','-aHAXnc','--numeric-ids','--itemize-changes',str(p),str(q)]
    return subprocess.check_output(args,text=True)
for rel in rels:
    p=src/rel;q=dst/rel
    if not p.exists() or p.is_symlink():continue
    assert p.resolve()==p and not q.exists() and not q.is_symlink()
    active=subprocess.run(['lsof','-t',*(['+D',str(p)] if p.is_dir() else ['--',str(p)])],capture_output=True,text=True)
    if active.stdout.strip():skipped.append(rel);continue
    q.parent.mkdir(parents=True,exist_ok=True)
    if p.is_dir():
        q.mkdir();subprocess.run(['rsync','-aHAX','--numeric-ids',str(p)+'/',str(q)+'/'],check=True)
    else:subprocess.run(['rsync','-aHAX','--numeric-ids',str(p),str(q)],check=True)
    assert diff(p,q)=='','Checksum mismatch '+rel
    active=subprocess.run(['lsof','-t',*(['+D',str(p)] if p.is_dir() else ['--',str(p)])],capture_output=True,text=True)
    if active.stdout.strip():skipped.append(rel);continue
    retired=p.with_name(p.name+'.retired-20260907-tools');assert not retired.exists()
    p.rename(retired);p.symlink_to(q,target_is_directory=q.is_dir())
    assert diff(retired,q)=='','Post-switch checksum mismatch '+rel
    moved.append(rel)
    (e/'progress.json').write_text(json.dumps({'moved':moved,'skipped':skipped}))
    print('MOVED_VERIFIED',rel,flush=True)
after=smoke();(e/'after.json').write_text(json.dumps(after,indent=2));assert before==after,'Smoke results differ; originals retained'
assert all((src/rel).exists() for rel in links),'Broken executable symlink'
for rel in moved:
    p=src/rel;retired=p.with_name(p.name+'.retired-20260907-tools')
    assert p.is_symlink() and p.resolve()==dst/rel and retired.resolve()==retired
    active=subprocess.run(['lsof','-t',*(['+D',str(retired)] if retired.is_dir() else ['--',str(retired)])],capture_output=True,text=True)
    if active.stdout.strip():continue
    if retired.is_dir():shutil.rmtree(retired)
    else:retired.unlink()
result={'moved':moved,'skipped':skipped,'smoke_checks':len(checks),'symlink_checks':len(links),'elapsed_seconds':round(time.time()-start,2),'completed':time.strftime('%Y-%m-%dT%H:%M:%S%z')}
(e/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
