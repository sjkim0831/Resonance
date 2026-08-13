#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="$ROOT/ops/scripts/run-canonical-endpoint-upgrade-release.sh"

bash -n "$TARGET"
python3 - "$ROOT" "$TARGET" <<'PY'
from __future__ import annotations
import copy,hashlib,importlib.util,json,os,shlex,shutil,stat,subprocess,sys,tempfile
from pathlib import Path

real=Path(sys.argv[1]); target=Path(sys.argv[2])
text=target.read_text(encoding='utf-8')
required=(
 'framework_canonical_endpoint_upgrade_export($RELEASE_ID,$LIMIT,$selector)',
 'BEGIN READ ONLY;', 'isolated linked git worktree required',
 'verify-canonical-endpoint-upgrade-release.py', '"$VERIFIER" --check "$EXPORT"',
 '"$VERIFIER" --emit-normalized "$EXPORT"',
 'generate-spring-api-from-design.py', '--workers 1 --check',
 'xargs -0 -P "$WORKERS"', 'source or release drifted during staging',
 'coverage exclusion mismatch', 'COMPLETE coverage overstatement',
 'process exclusion mismatch', 'VALIDATED_ONLY', 'PUBLISHED_CODE',
 'CANONICAL_ENDPOINT_CATALOG="$catalog"', 'generate-full-stack-design-packages.sh',
 'framework_canonical_endpoint_effective_binding',
 'CANONICAL_RELEASE_READY', 'accountRelay', 'businessE2E', 'visualQA',
 'CANONICAL_UPGRADE_PUBLISH_SECONDS', 'atomic publisher release marker cross-link mismatch',
 'timeout --signal=TERM --kill-after=5s',
)
for token in required:
    if token not in text: raise AssertionError(f'orchestrator token missing: {token}')
if not text.index('"$VERIFIER" --check "$EXPORT"') < text.index('--workers 1 --check') < text.index('CANONICAL_ENDPOINT_CATALOG="$catalog"'):
    raise AssertionError('verify/generator-check/publish order is unsafe')

def sha(value):
    if not isinstance(value,bytes): value=value.encode()
    return hashlib.sha256(value).hexdigest()
def stable(value): return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def executable(path, content):
    path.write_text(content,encoding='utf-8'); path.chmod(path.stat().st_mode|stat.S_IXUSR)

spec=importlib.util.spec_from_file_location('fixture',real/'ops/scripts/test-generate-spring-api-from-design.py')
fixture=importlib.util.module_from_spec(spec); spec.loader.exec_module(fixture)

def pilot_endpoint():
    source=fixture.catalog()['endpoints'][0]
    rows=[]
    for audience,actor,suffix in [('ADMIN','BOUNDARY_ADMIN','Admin'),('USER','BOUNDARY_USER','User')]:
        row=copy.deepcopy(source); route=f'/organizational-boundary/s4/{audience.lower()}'
        screen_key=f'ORGANIZATIONAL_BOUNDARY|ORGANIZATIONAL_BOUNDARY_S4|{audience}|{route}'
        canonical=json.loads(row['canonicalText']); identity=canonical['identity']
        identity.update(screenKey=screen_key,blueprintCode=f'ORGANIZATIONAL_BOUNDARY_S4_{audience}',
                        processCode='ORGANIZATIONAL_BOUNDARY',stepCode='ORGANIZATIONAL_BOUNDARY_S4',
                        audience=audience,routePath=route,pageId=f'organizational-boundary-s4-{audience.lower()}',actorCode=actor)
        row.update(screenKey=screen_key,routePath=route,audience=audience,canonicalText=stable(canonical))
        row['designHash']=sha(row['canonicalText']); contract=row['endpointContract']
        contract.update(screenKey=screen_key,routePath=route,audience=audience)
        contract['source']['designHash']=row['designHash']; operation=contract['operations'][0]
        operation.update(operationId=f'CompleteOrganizationalBoundary{suffix}',
                         path=f'/api/generated/organizational-boundary/{audience.lower()}/{{executionId}}/complete',
                         processCode='ORGANIZATIONAL_BOUNDARY',stepCode='ORGANIZATIONAL_BOUNDARY_S4')
        operation['authority'].update(audience=audience,actorCodes=[actor])
        row['endpointText']=stable(contract); row['endpointHash']=sha(row['endpointText']); rows.append(row)
    rows.sort(key=lambda x:x['screenKey'])
    return {'schema':'carbonet.canonical-endpoint-catalog/v1',
            'catalogHash':sha('\n'.join(x['screenKey']+'\x1f'+x['endpointHash'] for x in rows)),
            'endpoints':rows}

def envelope(partial=True, evidence=False):
    endpoint=pilot_endpoint()
    screens=[{'screenKey':x['screenKey'],'processCode':'ORGANIZATIONAL_BOUNDARY',
              'stepCode':'ORGANIZATIONAL_BOUNDARY_S4','designHash':x['designHash'],
              'canonicalText':x['canonicalText']} for x in endpoint['endpoints']]
    design={'schema':'carbonet.canonical-design/v1','screenCount':2,'screens':screens}
    design['catalogHash']=sha('\n'.join(x['screenKey']+'\x1f'+x['designHash'] for x in screens))
    blockers=301 if partial else 0
    coverage={'status':'PARTIAL' if partial else 'COMPLETE','sourceDesignCount':2+blockers,
              'memberCount':2,'missingContractCount':blockers,'duplicateBlueprintCount':0,
              'duplicateContractCount':0,'incompleteLaneCount':0,'blockerCount':blockers}
    coverage['coverageHash']=sha(stable(coverage))
    members=[]
    for n,row in enumerate(endpoint['endpoints'],1):
        member_hash=sha(f'member-{n}')
        members.append({'ordinal':n,'processCode':'ORGANIZATIONAL_BOUNDARY','screenKey':row['screenKey'],'memberHash':member_hash})
    evidence_value={name:{'status':'VERIFIED' if evidence else 'ABSENT','evidenceHash':sha(name) if evidence else None}
                    for name in ('accountRelay','businessE2E','visualQA')}
    release={'releaseId':41,'status':'ACTIVE','coverageStatus':coverage['status'],'memberCount':2,
             'proposalHash':sha('proposal'),'validationHash':sha('validation'),
             'sourceDesignCatalogHash':sha('source-design'),'sourceDesignCatalogTextHash':sha('{}'),'projectedDesignCatalogHash':design['catalogHash'],
             'endpointCatalogHash':endpoint['catalogHash'],'proposalCatalogHash':sha('proposal-catalog'),
             'coverageHash':coverage['coverageHash'],'releaseHash':sha('release'),
             'evidence':evidence_value,'eligibility':'PUBLISHABLE' if evidence and not partial else 'VALIDATED_ONLY'}
    return {'schemaVersion':'canonical-endpoint-upgrade-release/v1',
            'source':{'scopeProcess':'ORGANIZATIONAL_BOUNDARY','sourceDesignCatalogText':'{}',
                      'sourceDesignCatalogTextHash':release['sourceDesignCatalogTextHash'],'sourceDesignCatalogHash':release['sourceDesignCatalogHash'],'sourceDesignCount':2+blockers,
                      'policyText':'{}','policyHash':sha('{}')},
            'coverage':coverage,'members':members,
            'catalog':{'memberCount':2,'memberHashes':[x['memberHash'] for x in members],
                       'catalogHash':sha('members'),'design':design,'endpoint':endpoint},
            'proposals':[{'proposalId':1}],'validations':[{'proposalId':1}], 'release':release}

with tempfile.TemporaryDirectory() as td:
    temp=Path(td); primary=temp/'primary'; linked=temp/'linked'; tools=temp/'tools'
    primary.mkdir(); tools.mkdir()
    subprocess.run(['git','init','-q',str(primary)],check=True)
    subprocess.run(['git','-C',str(primary),'config','user.email','test@example.invalid'],check=True)
    subprocess.run(['git','-C',str(primary),'config','user.name','test'],check=True)
    (primary/'marker').write_text('clean\n'); subprocess.run(['git','-C',str(primary),'add','marker'],check=True)
    subprocess.run(['git','-C',str(primary),'commit','-qm','fixture'],check=True)
    subprocess.run(['git','-C',str(primary),'worktree','add','-qb','linked',str(linked)],check=True)

    verifier=tools/'verifier.py'; real_verifier=tools/'real-verifier.sh'; exporter=tools/'exporter.py'; effective=tools/'effective.py'; authoritative=tools/'authoritative.py'; publisher=tools/'publisher.sh'; failing=tools/'failing.sh'; mutator=tools/'mutator.sh'
    executable(verifier,"""#!/usr/bin/env python3
import json,os,sys
if os.getenv('FAKE_VERIFIER_FAIL'): raise SystemExit(7)
mode,path=sys.argv[1:3]; value=json.load(open(path)); r=value['release']; c=value['coverage']
if mode=='--emit-normalized':
 print(json.dumps({'schemaVersion':value['schemaVersion'],'releaseId':r['releaseId'],'releaseHash':r['releaseHash'],
  'status':r['status'],'coverageStatus':r['coverageStatus'],'memberCount':r['memberCount'],'blockerCount':c['blockerCount'],
  'eligibility':r['eligibility'],'codePublicationEligible':r['status']=='ACTIVE' and r['eligibility']=='PUBLISHABLE',
  'sourceDesignCatalogHash':r['sourceDesignCatalogHash'],'sourceDesignCatalogTextHash':r['sourceDesignCatalogTextHash'],'projectedDesignCatalogHash':r['projectedDesignCatalogHash'],
  'endpointCatalogHash':r['endpointCatalogHash'],'proposalCatalogHash':r['proposalCatalogHash']},separators=(',',':')))
elif mode!='--check': raise SystemExit(2)
""")
    executable(real_verifier,"#!/usr/bin/env bash\nexec python3 "+shlex.quote(str(real/'ops/scripts/verify-canonical-endpoint-upgrade-release.py'))+' "$@"\n')
    executable(exporter,"""#!/usr/bin/env python3
import os,sys
count=os.environ['FAKE_EXPORT_COUNT']; n=int(open(count).read()) if os.path.exists(count) else 0
open(count,'w').write(str(n+1)); source=os.environ.get('FAKE_EXPORT_SECOND') if n else None
print(open(source or os.environ['FAKE_EXPORT']).read(),end='')
""")
    executable(effective,"""#!/usr/bin/env python3
import os,sys
print(open(os.environ['FAKE_EFFECTIVE']).read(),end='')
""")
    executable(authoritative,"""#!/usr/bin/env python3
import json,os,sys
value=json.load(open(os.environ['FAKE_AUTHORITATIVE_EXPORT']))
print(json.dumps(value['catalog']['endpoint'],sort_keys=True,separators=(',',':')))
""")
    executable(publisher,"""#!/usr/bin/env bash
set -eu
[[ -s "$CANONICAL_ENDPOINT_CATALOG" && "$CANONICAL_ENDPOINT_AUTODETECT" == false ]]
[[ -z "${FAKE_PUBLISH_SLEEP:-}" ]] || sleep "$FAKE_PUBLISH_SLEEP"
binding="$($CANONICAL_ENDPOINT_UPGRADE_EFFECTIVE_BINDING_COMMAND "$2" 41)"
authoritative="$($FAKE_AUTHORITATIVE_CATALOG_COMMAND "$2")"
[[ "$(jq -r .status <<<"$binding")" == ACTIVE ]]
[[ "$(jq -r .endpointCatalogHash <<<"$binding")" == "$(jq -r .catalogHash "$CANONICAL_ENDPOINT_CATALOG")" ]]
[[ "$(jq -r .catalogHash <<<"$authoritative")" == "$(jq -r .catalogHash "$CANONICAL_ENDPOINT_CATALOG")" ]]
echo call >>"$FAKE_PUBLISH_LOG"
release_dir="$CANONICAL_ENDPOINT_OUT/$2"; mkdir -p "$release_dir"
python3 - "$release_dir/full-stack-release.json" "$CANONICAL_ENDPOINT_CATALOG" "$binding" <<'PY2'
import hashlib,json,sys
catalog=json.load(open(sys.argv[2])); binding=json.loads(sys.argv[3])
value={'schema':'carbonet.canonical-full-stack-release/v1','lanes':['FRONTEND','API','DATABASE','HELP','CARDS'],
       'designCatalogHash':binding['designCatalogHash'],'endpointCatalogHash':catalog['catalogHash'],
       'designHashes':sorted({x['designHash'] for x in catalog['endpoints']}),
       'packageManifestHash':hashlib.sha256(b'package').hexdigest(),'endpointBundleHash':hashlib.sha256(b'bundle').hexdigest()}
value['releaseHash']=hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
open(sys.argv[1],'w').write(json.dumps(value,sort_keys=True,separators=(',',':')))
PY2
release_hash="$(jq -r .releaseHash "$release_dir/full-stack-release.json")"
boundary="${FAKE_PUBLISH_BOUNDARY:-GIT_COMMIT}"; [[ -z "${FAKE_PUBLISH_HASH:-}" ]] || release_hash="$FAKE_PUBLISH_HASH"
printf '{"event":"CANONICAL_RELEASE_READY","boundary":"%s","processCode":"%s","releaseHash":"%s"}\n' "$boundary" "$2" "$release_hash"
""")
    executable(failing,'#!/usr/bin/env bash\nexit 9\n')
    executable(mutator,'#!/usr/bin/env bash\necho drift >>"$FAKE_MUTATE_FILE"\nprintf \'{"success":true,"check":true,"files":1,"filesChanged":0}\\n\'\n')

    fixtures=temp/'fixtures'; fixtures.mkdir(); published_root=temp/'published-endpoints'
    partial=fixtures/'partial.json'; complete=fixtures/'complete.json'
    partial.write_text(stable(envelope(True,False))); complete.write_text(stable(envelope(False,True)))
    verifier_fixture_spec=importlib.util.spec_from_file_location('verifier_fixture',real/'ops/scripts/test-verify-canonical-endpoint-upgrade-release.py')
    verifier_fixture=importlib.util.module_from_spec(verifier_fixture_spec); verifier_fixture_spec.loader.exec_module(verifier_fixture)
    real_envelope=fixtures/'real-verifier.json'; real_envelope.write_text(stable(verifier_fixture.make_fixture(2,active=True)))
    effective_active=fixtures/'effective-active.json'; effective_source=fixtures/'effective-source.json'; effective_mismatch=fixtures/'effective-mismatch.json'
    complete_value=envelope(False,True)
    binding={'status':'ACTIVE','processCode':'ORGANIZATIONAL_BOUNDARY','releaseId':41,
             'endpointCatalogHash':complete_value['release']['endpointCatalogHash'],
             'designCatalogHash':complete_value['release']['projectedDesignCatalogHash'],
             'coverageStatus':'COMPLETE','eligibility':'PUBLISHABLE'}
    effective_active.write_text(stable(binding))
    effective_source.write_text(stable({**binding,'status':'SOURCE','releaseId':None,'eligibility':'VALIDATED_ONLY'}))
    effective_mismatch.write_text(stable({**binding,'endpointCatalogHash':'f'*64}))

    def run(source=partial,args=(),extra=None,root=linked,generator=None,process='ORGANIZATIONAL_BOUNDARY',verifier_command=None,release_id=41):
        count=temp/f'count-{len(list(temp.glob("count-*")))}'; log=temp/f'publish-{len(list(temp.glob("publish-*")))}'
        env=os.environ.copy(); env.update({'ROOT_DIR':str(root),'CANONICAL_UPGRADE_DEADLINE_ACTIVE':'1',
            'CANONICAL_ENDPOINT_UPGRADE_EXPORT_COMMAND':str(exporter),'CANONICAL_ENDPOINT_UPGRADE_VERIFIER':str(verifier_command or verifier),
            'CANONICAL_ENDPOINT_UPGRADE_GENERATOR':str(generator or real/'ops/scripts/generate-spring-api-from-design.py'),
            'CANONICAL_ENDPOINT_UPGRADE_PUBLISHER':str(publisher),'FAKE_EXPORT':str(source),
            'CANONICAL_ENDPOINT_OUT':str(published_root),
            'CANONICAL_ENDPOINT_UPGRADE_EFFECTIVE_BINDING_COMMAND':str(effective),
            'FAKE_EFFECTIVE':str(effective_active),'FAKE_AUTHORITATIVE_CATALOG_COMMAND':str(authoritative),
            'FAKE_AUTHORITATIVE_EXPORT':str(source),'FAKE_EXPORT_COUNT':str(count),'FAKE_PUBLISH_LOG':str(log)})
        if extra: env.update(extra)
        cp=subprocess.run(['bash',str(target),'--release-id',str(release_id),'--process',process,'--workers','2',*args],env=env,text=True,capture_output=True)
        return cp,log,count

    # Pilot: two real ADMIN/USER operations pass the real generator --check,
    # but PARTIAL coverage and absent evidence can only be VALIDATED_ONLY.
    cp,log,_=run(); assert cp.returncode==0,cp.stder
    try: result=json.loads(cp.stdout)
    except json.JSONDecodeError as exc: raise AssertionError((cp.stdout,cp.stderr)) from exc
    assert result['state']=='VALIDATED_ONLY' and result['coverage']=='PARTIAL' and result['processCount']==1 and not result['published']
    assert not log.exists(); assert subprocess.check_output(['git','-C',str(linked),'status','--porcelain'],text=True)==''
    assert {x['audience'] for x in envelope()['catalog']['endpoint']['endpoints']}=={'ADMIN','USER'}

    # A DB-published but not activated release remains validated-only.
    published=copy.deepcopy(envelope(False,True)); published['release']['status']='PUBLISHED'
    published_path=fixtures/'published.json'; published_path.write_text(stable(published))
    normalized=json.loads(subprocess.check_output([str(verifier),'--emit-normalized',str(published_path)],text=True))
    assert normalized['codePublicationEligible'] is False
    cp,log,_=run(published_path); assert cp.returncode==0 and json.loads(cp.stdout)['state']=='VALIDATED_ONLY' and not log.exists()

    # --check is write-zero even when a release is otherwise publishable.
    cp,log,_=run(complete,args=('--check',)); assert cp.returncode==0 and json.loads(cp.stdout)['state']=='VALIDATED_ONLY'; assert not log.exists()
    # Real independent verifier summary binds to the full producer envelope.
    cp,log,_=run(real_envelope,args=('--check',),process='P0001',verifier_command=real_verifier,release_id=9001)
    assert cp.returncode==0,cp.stderr; assert json.loads(cp.stdout)['state']=='VALIDATED_ONLY' and not log.exists()
    # Exact COMPLETE + all evidence delegates once to the atomic full-stack publisher.
    cp,log,_=run(complete); assert cp.returncode==0,cp.stderr; assert json.loads(cp.stdout)['state']=='PUBLISHED_CODE'; assert log.read_text().count('call')==1
    cp,log,_=run(complete,extra={'FAKE_PUBLISH_BOUNDARY':'WORKTREE'}); assert cp.returncode!=0 and 'completion evidence missing' in cp.stderr
    cp,log,_=run(complete,extra={'FAKE_PUBLISH_HASH':'f'*64}); assert cp.returncode!=0 and 'release hash evidence mismatch' in cp.stderr
    cp,log,_=run(complete,extra={'CANONICAL_UPGRADE_PUBLISH_SECONDS':'1','FAKE_PUBLISH_SLEEP':'2'}); assert cp.returncode!=0 and not log.exists()
    # SOURCE fallback and ACTIVE hash mismatch never reach the publisher.
    cp,log,_=run(complete,extra={'FAKE_EFFECTIVE':str(effective_source)}); assert cp.returncode!=0 and 'not the requested ACTIVE release' in cp.stderr and not log.exists()
    cp,log,_=run(complete,extra={'FAKE_EFFECTIVE':str(effective_mismatch)}); assert cp.returncode!=0 and 'binding hash mismatch' in cp.stderr and not log.exists()

    # Primary checkout rejection occurs before exporter invocation.
    cp,log,count=run(root=primary); assert cp.returncode!=0 and 'linked git worktree' in cp.stderr and not count.exists() and not log.exists()
    # Worker bounds, verifier failure, generator failure all publish zero.
    cp,log,_=run(args=('--workers','17')); assert cp.returncode!=0 and not log.exists()
    cp,log,_=run(extra={'FAKE_VERIFIER_FAIL':'1'}); assert cp.returncode!=0 and not log.exists()
    cp,log,_=run(generator=failing); assert cp.returncode!=0 and not log.exists()

    # 301 exclusions cannot be hidden by a mismatched source/member total.
    bad=copy.deepcopy(envelope(True,False)); bad['coverage']['sourceDesignCount']=302
    bad_path=fixtures/'bad-coverage.json'; bad_path.write_text(stable(bad))
    cp,log,_=run(bad_path); assert cp.returncode!=0 and 'coverage exclusion mismatch' in cp.stderr and not log.exists()
    # Catalog/release cross-hash mismatch is fail-closed.
    bad=copy.deepcopy(envelope(True,False)); bad['release']['endpointCatalogHash']='f'*64
    bad_path=fixtures/'bad-hash.json'; bad_path.write_text(stable(bad))
    cp,log,_=run(bad_path); assert cp.returncode!=0 and 'endpoint catalog hash mismatch' in cp.stderr and not log.exists()
    # A second immutable export with different bytes is release drift.
    drift=fixtures/'drift.json'; drift.write_text(stable({**envelope(True,False),'release':{**envelope(True,False)['release'],'releaseHash':'e'*64}}))
    cp,log,_=run(extra={'FAKE_EXPORT_SECOND':str(drift)}); assert cp.returncode!=0 and 'release drifted' in cp.stderr and not log.exists()
    # A generator that mutates tracked source is detected before publication.
    cp,log,_=run(generator=mutator,extra={'FAKE_MUTATE_FILE':str(linked/'marker')}); assert cp.returncode!=0 and 'source or release drifted' in cp.stderr and not log.exists()
    subprocess.run(['git','-C',str(linked),'checkout','--','marker'],check=True)

print(json.dumps({'success':True,'pilotOperations':2,'partialExcluded':301,'dynamicCases':17,'realVerifierRuns':1,'workersMax':16,'publishableCalls':1,'liveWrites':0},separators=(',',':')))
PY
