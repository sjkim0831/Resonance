import pathlib,json,subprocess,urllib.request,urllib.parse,time,hashlib
E=pathlib.Path('/opt/Resonance/docs/operations/registry-migration-20260907')
p=json.loads((E/'plan.json').read_text());root=pathlib.Path(p['source'])/'docker/registry/v2/repositories'
def cmd(*args):return subprocess.check_output(args,text=True).strip()
assert json.loads((E/'api-verify-15000.json').read_text())['all_passed']
old=json.loads(cmd('docker','inspect','local-registry'))[0]
(E/'original-container.json').write_text(json.dumps(old,indent=2));(E/'original-container.json').chmod(0o600)
assert old['HostConfig']['NetworkMode']=='bridge'
assert old['Mounts'][0]['Source']==p['source']
def check_snapshot():
    current={str(f.relative_to(root)):f.read_text() for f in root.glob('**/_manifests/tags/*/current/link')}
    assert current==p['tag_snapshot'],'Registry tags changed since snapshot; abort'
check_snapshot()
data=json.loads(cmd('sudo','-u','sjkim','kubectl','get','pods,deployments,statefulsets,daemonsets,jobs,cronjobs,replicasets,replicationcontrollers','-A','-o','json'))
refs=set()
def walk(v):
    if isinstance(v,dict):
        for k,x in v.items():
            if k in ('image','imageID') and isinstance(x,str) and ':5000/' in x:refs.add(x.replace('docker-pullable://',''))
            else:walk(x)
    elif isinstance(v,list):
        for x in v:walk(x)
walk(data)
assert refs<=set(p['local_image_refs']),'New workload image references; abort'
backup='local-registry-preopt-20260907'
start=time.time()
cmd('docker','stop','local-registry')
try:
    check_snapshot()
except:
    cmd('docker','start','local-registry');raise
cmd('docker','rename','local-registry',backup)
cmd('docker','update','--restart=no',backup)
try:
    args=['docker','run','-d','--name','local-registry','--restart','always','--network','bridge','-p','0.0.0.0:5000:5000','-v','/opt/registry/data:/var/lib/registry']
    for env in old['Config'].get('Env',[]):args+=['-e',env]
    for k,v in (old['Config'].get('Labels') or {}).items():args+=['--label',k+'='+v]
    args+=[old['Image']]+old['Config']['Cmd']
    cmd(*args)
    for _ in range(30):
        try:
            urllib.request.urlopen('http://127.0.0.1:5000/v2/',timeout=2).close();break
        except:time.sleep(.2)
    available=time.time()
    subprocess.run(['python3','/tmp/registry-verify-selected.py','5000'],check=True)
    # Small registry-probe blob: verifies writable /opt storage, no production tag changes.
    base='http://127.0.0.1:5000'
    with urllib.request.urlopen(urllib.request.Request(base+'/v2/resonance-registry-probe/blobs/uploads/',data=b'',method='POST')) as r:loc=r.headers['Location']
    u=urllib.parse.urlsplit(loc);url=base+u.path+('?'+u.query if u.query else '')
    content=b'CCUS opt registry migration 20260907';digest='sha256:'+hashlib.sha256(content).hexdigest()
    url+=('&' if '?' in url else '?')+'digest='+digest
    with urllib.request.urlopen(urllib.request.Request(url,data=content,method='PUT',headers={'Content-Type':'application/octet-stream'})) as r:assert r.status==201
    with urllib.request.urlopen(base+'/v2/resonance-registry-probe/blobs/'+digest) as r:assert r.read()==content
    (E/'cutover-result.json').write_text(json.dumps({'completed':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'unavailable_seconds_upper_bound':round(available-start,2),'read_checks':163,'write_read_probe':True,'old_container_retained':backup}))
    print((E/'cutover-result.json').read_text())
except:
    subprocess.run(['docker','rm','-f','local-registry'],stdout=subprocess.DEVNULL)
    cmd('docker','rename',backup,'local-registry');cmd('docker','update','--restart=always','local-registry');cmd('docker','start','local-registry')
    raise
