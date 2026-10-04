import pathlib,json,shutil,hashlib,time
E=pathlib.Path('/opt/Resonance/docs/operations/registry-migration-20260907')
p=json.loads((E/'plan.json').read_text())
src=pathlib.Path(p['source'])/'docker/registry/v2'
dest=pathlib.Path('/opt/registry/data')
assert not dest.exists(), 'Do not overwrite existing registry'
assert shutil.disk_usage('/opt').free > p['bytes']+15*1024**3
dst=dest/'docker/registry/v2'
dst.mkdir(parents=True)
shutil.copytree(src/'repositories',E/'original-repository-metadata')
def bp(root,d):
    a,h=d.split(':');assert a=='sha256' and len(h)==64
    return root/'blobs'/a/h[:2]/h/'data'
for i,d in enumerate(p['blobs']):
    out=bp(dst,d);out.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(bp(src,d),out)
    with out.open('rb') as f: actual=hashlib.file_digest(f,'sha256').hexdigest()
    assert actual==d.split(':')[1],d
    if i%100==0:print('verified_blobs',i,flush=True)
def link(path,d):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(d)
for repo,tags in p['selected_tags'].items():
    r=dst/'repositories'/repo
    for tag in tags:
        d=p['tag_snapshot'][repo+'/_manifests/tags/'+tag+'/current/link'].strip()
        link(r/'_manifests/tags'/tag/'current/link',d)
        link(r/'_manifests/tags'/tag/'index/sha256'/d.split(':')[1]/'link',d)
    layers=set()
    for d in p['manifest_digests'][repo]:
        link(r/'_manifests/revisions/sha256'/d.split(':')[1]/'link',d)
        m=json.loads(bp(src,d).read_bytes())
        for item in m.get('layers',[])+([m['config']] if 'config' in m else []):layers.add(item['digest'])
    for d in layers:link(r/'_layers/sha256'/d.split(':')[1]/'link',d)
(E/'copy-result.json').write_text(json.dumps({'verified_blobs':len(p['blobs']),'bytes':p['bytes'],'completed':time.strftime('%Y-%m-%dT%H:%M:%S%z')}))
print((E/'copy-result.json').read_text(),flush=True)
