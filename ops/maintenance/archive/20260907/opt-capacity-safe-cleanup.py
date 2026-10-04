import pathlib,subprocess,os,json,time,hashlib
e=pathlib.Path('/opt/Resonance/docs/operations/opt-capacity-20260907');e.mkdir(parents=True,exist_ok=True)
result={'started':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'cache_cleaned':[],'backup_samples':[]}
for raw in ['/opt/Resonance/runtime/platform-data/cache/gradle/java-fast-dev/caches','/opt/Resonance/runtime/platform-data/cache/gradle/java-fast-dev/.tmp']:
    p=pathlib.Path(raw)
    assert p.resolve()==p and p.is_dir() and not p.is_symlink()
    active=subprocess.run(['lsof','-t','+D',raw],capture_output=True,text=True)
    if active.stdout.strip():continue
    size=int(subprocess.check_output(['du','-sb',raw],text=True).split()[0])
    subprocess.run(['find',raw,'-xdev','-depth','-mindepth','1','-delete'],check=True)
    result['cache_cleaned'].append({'path':raw,'logical_bytes_before':size}); print('CACHE_CLEANED',raw,flush=True)
for a,b in [('/opt/Resonance/runtime/platform-data/backups/postgres/base/carbonet_base_20260906_022700.tar.gz','/opt/Resonance/runtime/platform-data/backups/postgres/base-mirror/carbonet_base_20260906_022700.tar.gz'),('/opt/Resonance/runtime/platform-data/backups/postgres/primary/daily/carbonet_20260906_031700.dump','/opt/Resonance/runtime/platform-data/backups/postgres/mirror/daily/carbonet_20260906_031700.dump')]:
    hashes=[]
    for f in [a,b]:
        with open(f,'rb') as stream: hashes.append(hashlib.file_digest(stream,'sha256').hexdigest())
    result['backup_samples'].append({'first':a,'second':b,'equal':hashes[0]==hashes[1],'sha256':hashes})
    print('BACKUP_SAMPLE',a,hashes[0]==hashes[1],flush=True)
result['completed']=time.strftime('%Y-%m-%dT%H:%M:%S%z')
(e/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
