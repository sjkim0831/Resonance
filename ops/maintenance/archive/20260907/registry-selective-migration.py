import os,json,subprocess,pathlib,time,shutil,hashlib
ROOT=pathlib.Path('/var/lib/docker/volumes/88e501cd85ae2e9848fa7e5972b3a3f9a39a8a882813634fc3b404e98572b4d4/_data')
V2=ROOT/'docker/registry/v2'
E=pathlib.Path('/opt/Resonance/docs/operations/registry-migration-20260907')
E.mkdir(parents=True,exist_ok=True)
def blob(d):
    algo,h=d.split(':'); assert algo=='sha256' and len(h)==64
    return V2/'blobs'/algo/h[:2]/h/'data'
repos={str(p.parent.relative_to(V2/'repositories')):p.parent for p in (V2/'repositories').rglob('_manifests')}
data=json.loads(subprocess.check_output(['sudo','-u','sjkim','kubectl','get','pods,deployments,statefulsets,daemonsets,jobs,cronjobs,replicasets,replicationcontrollers','-A','-o','json']))
refs=set()
def walk(v):
    if isinstance(v,dict):
        for k,x in v.items():
            if k in ('image','imageID') and isinstance(x,str): refs.add(x.replace('docker-pullable://',''))
            else: walk(x)
    elif isinstance(v,list):
        for x in v:walk(x)
walk(data)
used={r:set() for r in repos}; digests={r:set() for r in repos}; unresolved=[]
for ref in sorted(refs):
    if ':5000/' not in ref:continue
    suffix=ref.split(':5000/',1)[1]
    if '@' in suffix:r,d=suffix.split('@',1); t=None
    elif ':' in suffix:r,t=suffix.rsplit(':',1);d=None
    else:r,t,d=suffix,'latest',None
    if r not in repos:unresolved.append(ref);continue
    if d:digests[r].add(d)
    else:used[r].add(t)
if unresolved: raise RuntimeError('Unresolved local registry references: '+repr(unresolved))
selected={}; alltags={}; reasons={}; revisions={}; reachable=set(); preexisting_missing=[]
def visit(d,seen):
    if d in seen:return
    seen.add(d); reachable.add(d)
    p=blob(d)
    m=json.loads(p.read_bytes())
    if 'fsLayers' in m:raise RuntimeError('Schema1 needs explicit support')
    for x in m.get('manifests',[]):visit(x['digest'],seen)
    for x in m.get('layers',[])+([m['config']] if 'config' in m else []):
        reachable.add(x['digest']); assert blob(x['digest']).is_file()
for r,p in repos.items():
    tags={t.name:t for t in (p/'_manifests/tags').iterdir() if (t/'current/link').exists()}
    alltags[r]=list(tags)
    missing=used[r]-tags.keys()
    if missing:
        preexisting_missing.extend(r+':'+t for t in missing)
        used[r] -= missing
    absent={d for d in digests[r] if not blob(d).exists()}
    preexisting_missing.extend(r+'@'+d for d in absent)
    digests[r] -= absent
    newest=sorted(tags,key=lambda t:(tags[t]/'current/link').stat().st_mtime,reverse=True)[:20]
    keep=set(tags) if r not in ('carbonet-runtime','carbonet-web','resonance-backstage') else set(newest)|used[r]|{t for t in tags if t in ('latest','stable','production')}
    selected[r]=sorted(keep)
    reasons[r]={'referenced_tags':sorted(used[r]),'referenced_digests':sorted(digests[r]),'newest_20':newest}
    ds=set(digests[r])|{(tags[t]/'current/link').read_text().strip() for t in keep}
    seen=set()
    for d in ds:visit(d,seen)
    revisions[r]=sorted(seen)
sizes={d:blob(d).stat().st_size for d in reachable}
plan={'created':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'source':str(ROOT),'selected_tags':selected,'all_tags':alltags,'reasons':reasons,'manifest_digests':revisions,'blobs':sorted(reachable),'bytes':sum(sizes.values()),'preexisting_missing':preexisting_missing,'local_image_refs':sorted(x for x in refs if ':5000/' in x)}
plan['tag_snapshot']={str(p.relative_to(V2/'repositories')):p.read_text() for p in (V2/'repositories').glob('**/_manifests/tags/*/current/link')}
(E/'plan.json').write_text(json.dumps(plan,indent=2))
print(json.dumps({'repos':{r:{'total':len(alltags[r]),'keep':len(selected[r]),'referenced_tags':len(used[r]),'referenced_digests':len(digests[r])} for r in repos},'required_bytes':plan['bytes'],'free_bytes':shutil.disk_usage('/opt').free,'local_refs':len(plan['local_image_refs']),'preexisting_missing':preexisting_missing},indent=2))
