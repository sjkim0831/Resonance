import json,pathlib,urllib.request,urllib.error,hashlib,sys,concurrent.futures,time
E=pathlib.Path('/opt/Resonance/docs/operations/registry-migration-20260907')
p=json.loads((E/'plan.json').read_text()); port=sys.argv[1]
base='http://127.0.0.1:'+port+'/v2/'
accept=', '.join(['application/vnd.oci.image.index.v1+json','application/vnd.oci.image.manifest.v1+json','application/vnd.docker.distribution.manifest.list.v2+json','application/vnd.docker.distribution.manifest.v2+json'])
jobs=[]
for r,tags in p['selected_tags'].items():
    for t in tags:jobs.append((r,t,p['tag_snapshot'][r+'/_manifests/tags/'+t+'/current/link'].strip()))
    for d in p['manifest_digests'][r]:jobs.append((r,d,d))
def check(job):
    r,ref,expected=job
    req=urllib.request.Request(base+r+'/manifests/'+ref,headers={'Accept':accept})
    with urllib.request.urlopen(req,timeout=15) as response:
        content=response.read();assert 'sha256:'+hashlib.sha256(content).hexdigest()==expected
    m=json.loads(content)
    for x in m.get('layers',[])+([m['config']] if 'config' in m else []):
        with urllib.request.urlopen(urllib.request.Request(base+r+'/blobs/'+x['digest'],method='HEAD'),timeout=15) as response:
            assert int(response.headers['Content-Length'])==x['size']
    return 1
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:count=sum(pool.map(check,jobs))
result={'port':port,'manifest_and_tag_checks':count,'all_passed':True,'completed':time.strftime('%Y-%m-%dT%H:%M:%S%z')}
(E/('api-verify-'+port+'.json')).write_text(json.dumps(result));print(json.dumps(result))
