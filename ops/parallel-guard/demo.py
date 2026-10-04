"""Four independent design fragments, validated together without live changes."""
import json
from pathlib import Path
import sys
import time
from parallel_guard import prepare, verify

run = Path(sys.argv[1]).resolve()
source = run / 'fixture-source'
source.mkdir(parents=True)
(source / 'fragments').mkdir()
for name in ['design', 'ui', 'api', 'qa']:
    (source / 'fragments' / (name + '.json')).write_text(json.dumps({'id': name, 'version': 1, 'process': 'DEMO-001'}))
check = "import json,pathlib,sys; p=pathlib.Path('fragments')/(sys.argv[1]+'.json'); d=json.loads(p.read_text()); assert d['id']==sys.argv[1] and d['version']==2 and d['process']=='DEMO-001'"
integration = "import json,pathlib; a=[json.loads(p.read_text()) for p in pathlib.Path('fragments').glob('*.json')]; assert len(a)==4 and len({d['id'] for d in a})==4 and {d['version'] for d in a}=={2} and {d['process'] for d in a}=={'DEMO-001'}"
plan = {'workers': 4, 'tasks': [{'id': name, 'writes': ['fragments/'+name+'.json'],
        'checks': [['python3', '-c', check, name]]} for name in ['design', 'ui', 'api', 'qa']],
        'integration_checks': [['python3', '-c', integration]]}
manifest = run / 'demo-plan.json'
manifest.write_text(json.dumps(plan, indent=2))
start = time.monotonic()
prepared = prepare(source, manifest, run / 'session')
for task in plan['tasks']:
    p = run / 'session/tasks' / task['id'] / task['writes'][0]
    d = json.loads(p.read_text()); d['version'] = 2; p.write_text(json.dumps(d))
report = verify(run / 'session')
print(json.dumps({'prepare': prepared, 'verify': report, 'total_seconds': round(time.monotonic()-start,3)}, indent=2))
raise SystemExit(report['status'] != 'PASS')
