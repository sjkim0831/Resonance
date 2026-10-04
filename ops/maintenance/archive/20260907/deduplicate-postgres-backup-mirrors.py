import os,stat,json,time,hashlib,subprocess,concurrent.futures
from pathlib import Path
root=Path('/opt/Resonance/runtime/platform-data/backups/postgres')
e=Path('/opt/Resonance/docs/operations/postgres-mirror-dedup-20260907')
e.mkdir(exist_ok=False)
start=time.time()
counts=dict(pairs=0,linked=0,already_linked=0,different=0,attributes_different=0,active_skipped=0,bytes_released=0,verified=0)
def digest(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def identity(s):return (s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
def attrs(p):return {k:os.getxattr(p,k) for k in os.listxattr(p)}
def meta(s):return (s.st_mode,s.st_uid,s.st_gid)
subprocess.run(['df','-B1','/opt'],stdout=(e/'disk-before.txt').open('w'),check=True)
(e/'started.txt').write_text(time.strftime('%Y-%m-%dT%H:%M:%S%z'))
with (e/'links.jsonl').open('x') as log,(e/'skipped.jsonl').open('x') as skipped,concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for first,second in [('base','base-mirror'),('primary','mirror')]:
    a=root/first;b=root/second
    assert a.resolve()==a and b.resolve()==b
    for base,dirs,files in os.walk(b,followlinks=False):
      dirs[:]=[d for d in dirs if not Path(base,d).is_symlink()]
      for name in sorted(files):
        q=Path(base,name);p=a/q.relative_to(b)
        if p.is_symlink() or q.is_symlink() or not p.is_file():continue
        assert p.resolve()==p and q.resolve()==q
        s=p.stat();t=q.stat();counts['pairs']+=1
        if not stat.S_ISREG(s.st_mode) or not stat.S_ISREG(t.st_mode):continue
        if (s.st_dev,s.st_ino)==(t.st_dev,t.st_ino):counts['already_linked']+=1;continue
        if s.st_dev!=t.st_dev:raise RuntimeError('Different filesystems')
        reason=None
        if s.st_size!=t.st_size:reason='size';counts['different']+=1
        elif meta(s)!=meta(t) or attrs(p)!=attrs(q):reason='attributes';counts['attributes_different']+=1
        if reason:
          skipped.write(json.dumps({'path':str(q),'reason':reason})+'\n');continue
        active=subprocess.run(['lsof','-t','--',str(p),str(q)],capture_output=True,text=True)
        if active.stdout.strip():counts['active_skipped']+=1;continue
        hashes=list(pool.map(digest,[p,q]))
        if hashes[0]!=hashes[1]:counts['different']+=1;continue
        if identity(p.stat())!=identity(s) or identity(q.stat())!=identity(t):raise RuntimeError('Concurrent change')
        active=subprocess.run(['lsof','-t','--',str(p),str(q)],capture_output=True,text=True)
        if active.stdout.strip():counts['active_skipped']+=1;continue
        record={'first':str(p),'second':str(q),'sha256':hashes[0],'size':s.st_size,'mode':s.st_mode,'uid':s.st_uid,'gid':s.st_gid,'first_mtime_ns':s.st_mtime_ns,'second_original_mtime_ns':t.st_mtime_ns}
        log.write(json.dumps(record)+'\n');log.flush();os.fsync(log.fileno())
        temp=q.with_name(q.name+'.ccus-link-tmp')
        assert not temp.exists() and not temp.is_symlink()
        os.link(p,temp);os.replace(temp,q)
        assert p.stat().st_ino==q.stat().st_ino and meta(q.stat())==meta(s)
        counts['linked']+=1
        if t.st_nlink==1:counts['bytes_released']+=t.st_blocks*512
        # Read the final shared inode and compare against pre-change hash.
        assert digest(q)==hashes[0]
        counts['verified']+=1
        if s.st_size>1024**3:print(json.dumps({'file':name,**counts}),flush=True)
        (e/'progress.json').write_text(json.dumps(counts))
result={**counts,'elapsed_seconds':round(time.time()-start,2),'completed':time.strftime('%Y-%m-%dT%H:%M:%S%z')}
(e/'result.json').write_text(json.dumps(result,indent=2))
subprocess.run(['df','-B1','/opt'],stdout=(e/'disk-after.txt').open('w'),check=True)
print(json.dumps(result),flush=True)
