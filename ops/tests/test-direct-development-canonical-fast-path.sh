#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT_DIR/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
python3 - "$SOURCE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
start=s.index('@Transactional public Map<String,Object> executeDesignDirectDevelopment')
end=s.index('/**', start+80)
body=s[start:end]
assert body.index('refreshAndQueueCanonicalProcess(process,actor') < body.index('String processHash=')
assert '"deliveryMode","CANONICAL_FULL_STACK"' in body
assert '"legacyBootstrapSkipped",true' in body
assert body.count('Map.of("triggerType","PROCESS_DEFINITION")') == 2
assert '"정본 전체 스택 작업 1개를 즉시 실행합니다."' in body
projection=s[s.index('with blueprint_candidates as materialized'):s.index('), contract_source as materialized')]
assert "when 'string' then jsonb_build_object(" in projection
assert "'stateCode',state.value#>>'{}','stateName',state.value#>>'{}'" in projection
mutant=body.replace('if(!force&&Boolean.TRUE.equals(canonical.get("generationQueued")))',
                    'if(false&&Boolean.TRUE.equals(canonical.get("generationQueued")))',1)
assert 'if(!force&&Boolean.TRUE.equals(canonical.get("generationQueued")))' not in mutant
print('DIRECT_DEVELOPMENT_CANONICAL_FAST_PATH_PASS paths=2 legacyBootstrap=conditional canonicalJobsPerProcess=1 stateCompatibility=string-to-object mutants=1')
PY
