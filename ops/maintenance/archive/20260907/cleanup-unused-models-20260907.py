import pathlib,subprocess,json,time,shutil,os
paths=['/opt/ollama/models/models','/opt/Resonance/runtime/tools/ai/huggingface-laguna/hub/models--poolside--Laguna-XS-2.1-GGUF','/opt/Resonance/runtime/tools/ai/models/Qwen2.5-7B-Instruct']
e=pathlib.Path('/opt/Resonance/docs/operations/unused-model-cleanup-20260907');e.mkdir(exist_ok=False)
start=time.time();results=[]
subprocess.run(['df','-B1','/opt'],stdout=(e/'disk-before.txt').open('w'),check=True)
for raw in paths:
    p=pathlib.Path(raw);assert p.resolve()==p and p.is_dir() and not p.is_symlink()
    if subprocess.run(['lsof','-t','+D',raw],capture_output=True,text=True).stdout.strip():
        results.append({'path':raw,'status':'SKIPPED_ACTIVE'});continue
    if raw.startswith('/opt/ollama/'):
        assert subprocess.run(['systemctl','is-active','--quiet','ollama']).returncode!=0
    key=p.name
    with (e/(key+'.manifest')).open('w') as f:
        subprocess.run(['find',raw,'-xdev','-type','f','-printf','%s %T@ %p\n'],stdout=f,check=True)
    size=int(subprocess.check_output(['du','-sb',raw],text=True).split()[0])
    # Keep small model metadata/configs; no weights, credentials, or unrelated files are copied.
    for config in p.rglob('*.json'):
        if config.is_symlink() or config.stat().st_size>1024*1024:continue
        dest=e/'metadata'/key/config.relative_to(p);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(config,dest)
    assert not subprocess.run(['lsof','-t','+D',raw],capture_output=True,text=True).stdout.strip()
    assert str(p) in paths and p.resolve()==p
    subprocess.run(['find',raw,'-xdev','-depth','-mindepth','1','-delete'],check=True)
    results.append({'path':raw,'status':'CLEANED','logical_bytes_before':size})
    (e/'progress.json').write_text(json.dumps(results,indent=2));print(json.dumps(results[-1]),flush=True)
subprocess.run(['df','-B1','/opt'],stdout=(e/'disk-after.txt').open('w'),check=True)
result={'items':results,'elapsed_seconds':round(time.time()-start,2),'completed':time.strftime('%Y-%m-%dT%H:%M:%S%z')}
(e/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
