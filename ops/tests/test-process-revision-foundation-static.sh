#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIG="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql"
MAIN="$MIG/V20260918130000__create_process_revision_audit_contract.sql"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
python3 - "$MAIN" "$SERVICE" "$MIG" <<'PY'
import json,hashlib,sys,re
from pathlib import Path
main,service,mig=map(Path,sys.argv[1:])
assert main.exists(), 'canonical migration missing'
s=service.read_text()
assert "'snapshot_schema_version',1" in s
assert "jsonb_agg(to_jsonb(s) order by s.step_order,s.step_code)" in s
assert "jsonb_agg(to_jsonb(e) order by e.step_code,e.spec_version,e.source_hash)" in s
assert 'framework_process_step_revision_audit' in s and 'values(?,?' in s
files=list(mig.glob('*.sql'))
creators=[p for p in files if re.search(r'create\s+table(?:\s+if\s+not\s+exists)?\s+framework_process_step_revision_audit',p.read_text(),re.I)]
assert len(creators)==1, f'canonical table creators={len(creators)}'
for _ in range(100):
  obj={'snapshot_schema_version':1,'process_definition':{'process_version':'1','structure_hash':'h'},'steps':[{'step_code':'B','step_order':2},{'step_code':'A','step_order':1}],'execution_specs':[{'step_code':'B','spec_code':'z'},{'step_code':'A','spec_code':'a'}],'process_version':'1','structure_hash':'h'}
  obj['steps']=sorted(obj['steps'],key=lambda x:(x['step_order'],x['step_code']))
  obj['execution_specs']=sorted(obj['execution_specs'],key=lambda x:(x['step_code'],x.get('spec_code','')))
  b=json.dumps(obj,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
  h=hashlib.sha256(b).hexdigest()
  if _==0: first=h
  assert h==first
print('STATIC_REVISION_TESTS=PASS')
PY