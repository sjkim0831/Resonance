#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only canonical endpoint release coordinator. Database overlay creation,
# cryptographic verification, code generation and atomic publication remain
# separate trust boundaries. Temporary files are outside the checkout.

ROOT="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ORIGINAL_ARGS=("$@")
RELEASE_ID=""; PROCESS_CODE=""; WORKERS="${CANONICAL_UPGRADE_WORKERS:-4}"
LIMIT="${CANONICAL_UPGRADE_LIMIT:-5000}"; CHECK_ONLY=false; EXPORT_FILE=""
MAX_SECONDS="${CANONICAL_UPGRADE_MAX_SECONDS:-540}"
PUBLISH_SECONDS="${CANONICAL_UPGRADE_PUBLISH_SECONDS:-60}"

usage() {
  echo 'usage: run-canonical-endpoint-upgrade-release.sh --release-id ID [--process CODE] [--workers 1..16] [--limit 1..5000] [--check] [--export-file FILE]' >&2
}
while (($#)); do
  case "$1" in
    --release-id) [[ $# -ge 2 ]] || { usage; exit 2; }; RELEASE_ID="$2"; shift 2 ;;
    --process) [[ $# -ge 2 ]] || { usage; exit 2; }; PROCESS_CODE="$2"; shift 2 ;;
    --workers) [[ $# -ge 2 ]] || { usage; exit 2; }; WORKERS="$2"; shift 2 ;;
    --limit) [[ $# -ge 2 ]] || { usage; exit 2; }; LIMIT="$2"; shift 2 ;;
    --check) CHECK_ONLY=true; shift ;;
    --export-file) [[ $# -ge 2 ]] || { usage; exit 2; }; EXPORT_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ "$RELEASE_ID" =~ ^[1-9][0-9]*$ ]] || { echo '[canonical-upgrade] release id must be positive' >&2; exit 2; }
[[ -z "$PROCESS_CODE" || "$PROCESS_CODE" =~ ^[A-Z][A-Z0-9_]{1,79}$ ]] || { echo '[canonical-upgrade] invalid process code' >&2; exit 2; }
[[ "$WORKERS" =~ ^[0-9]+$ ]] && ((WORKERS >= 1 && WORKERS <= 16)) || { echo '[canonical-upgrade] workers must be between 1 and 16' >&2; exit 2; }
[[ "$LIMIT" =~ ^[0-9]+$ ]] && ((LIMIT >= 1 && LIMIT <= 5000)) || { echo '[canonical-upgrade] limit must be between 1 and 5000' >&2; exit 2; }
[[ "$MAX_SECONDS" =~ ^[0-9]+$ ]] && ((MAX_SECONDS >= 1 && MAX_SECONDS < 600)) || { echo '[canonical-upgrade] duration bound must be below 600 seconds' >&2; exit 2; }
[[ "$PUBLISH_SECONDS" =~ ^[0-9]+$ ]] && ((PUBLISH_SECONDS >= 1 && PUBLISH_SECONDS <= 60)) || { echo '[canonical-upgrade] publication bound must be between 1 and 60 seconds' >&2; exit 2; }
if [[ "${CANONICAL_UPGRADE_DEADLINE_ACTIVE:-}" != 1 ]]; then
  command -v timeout >/dev/null || { echo '[canonical-upgrade] timeout command is required' >&2; exit 1; }
  exec env CANONICAL_UPGRADE_DEADLINE_ACTIVE=1 timeout --signal=TERM --kill-after=5s "${MAX_SECONDS}s" "$0" "${ORIGINAL_ARGS[@]}"
fi

# Reject a primary checkout before the first database/file export.
git_dir="$(git -C "$ROOT" rev-parse --absolute-git-dir 2>/dev/null || true)"
git_common="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
[[ -n "$git_dir" && -n "$git_common" && "$git_dir" != "$git_common" && "$git_dir" == "$git_common"/worktrees/* ]] || {
  echo '[canonical-upgrade] isolated linked git worktree required' >&2; exit 1;
}
[[ -z "$(git -C "$ROOT" status --porcelain=v1 --untracked-files=all)" ]] || { echo '[canonical-upgrade] source worktree must be clean' >&2; exit 1; }
SOURCE_TREE="$(git -C "$ROOT" rev-parse 'HEAD^{tree}')"
source_fingerprint() {
  python3 - "$ROOT" <<'PY'
import hashlib,os,subprocess,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
allowed=(
 'projects/carbonet-backend-metadata/process-runtime/generated/',
 'projects/carbonet-backend-metadata/process-runtime/design-preview/',
 'projects/carbonet-backend-metadata/process-runtime/generated-endpoints/',
)
raw=subprocess.check_output(['git','-C',str(root),'ls-files','-z','--cached','--others','--exclude-standard'])
paths=sorted({x.decode('utf-8') for x in raw.split(b'\0') if x and not x.decode('utf-8').startswith(allowed)})
digest=hashlib.sha256()
for relative in paths:
    path=root/relative; digest.update(relative.encode()); digest.update(b'\0')
    if path.is_symlink() or not path.is_file(): raise SystemExit('unsafe or missing source path')
    digest.update(hashlib.sha256(path.read_bytes()).digest())
print(digest.hexdigest())
PY
}
SOURCE_FINGERPRINT="$(source_fingerprint)"
assert_source_immutable() {
  [[ "$(git -C "$ROOT" rev-parse 'HEAD^{tree}')" == "$SOURCE_TREE" ]] || return 1
  [[ "$(source_fingerprint)" == "$SOURCE_FINGERPRINT" ]] || return 1
}
STARTED_SECONDS=$SECONDS
STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/canonical-endpoint-upgrade.XXXXXX")"
trap 'rm -rf -- "$STAGE_ROOT"' EXIT
EXPORT="$STAGE_ROOT/export.json"; VERIFICATION="$STAGE_ROOT/verification.json"

db_export() {
  local destination="$1"
  if [[ -n "$EXPORT_FILE" ]]; then
    [[ -f "$EXPORT_FILE" && ! -L "$EXPORT_FILE" ]] || return 1
    cp -- "$EXPORT_FILE" "$destination"
  elif [[ -n "${CANONICAL_ENDPOINT_UPGRADE_EXPORT_COMMAND:-}" ]]; then
    [[ -x "$CANONICAL_ENDPOINT_UPGRADE_EXPORT_COMMAND" ]] || return 1
    "$CANONICAL_ENDPOINT_UPGRADE_EXPORT_COMMAND" "$RELEASE_ID" "$LIMIT" "${PROCESS_CODE:-NULL}" >"$destination"
  else
    : "${PGDATABASE:?PGDATABASE is required}"; : "${PGUSER:?PGUSER is required}"
    local namespace="${K8S_NAMESPACE:-carbonet-prod}" pod="" candidate selector=NULL
    [[ -z "$PROCESS_CODE" ]] || selector="'$PROCESS_CODE'"
    while IFS= read -r candidate; do
      [[ -n "$candidate" ]] || continue
      if [[ "$(kubectl -n "$namespace" exec "$candidate" -c patroni -- psql -h 127.0.0.1 -U "$PGUSER" -d "$PGDATABASE" -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]]; then pod="$candidate"; break; fi
    done < <(kubectl -n "$namespace" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
    [[ -n "$pod" ]] || return 1
    kubectl -n "$namespace" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$PGUSER" -d "$PGDATABASE" -X -q -v ON_ERROR_STOP=1 -At \
      -c "BEGIN READ ONLY; SELECT public.framework_canonical_endpoint_upgrade_export($RELEASE_ID,$LIMIT,$selector)::text; COMMIT;" >"$destination"
  fi
}

db_export "$EXPORT" || { echo '[canonical-upgrade] immutable release export failed' >&2; exit 1; }
[[ -s "$EXPORT" ]] || { echo '[canonical-upgrade] empty release export' >&2; exit 1; }
EXPORT_HASH="$(sha256sum "$EXPORT" | awk '{print $1}')"
assert_source_immutable || { echo '[canonical-upgrade] source mutated during export' >&2; exit 1; }

# The independent verifier alone interprets/re-hashes producer bytes.
VERIFIER="${CANONICAL_ENDPOINT_UPGRADE_VERIFIER:-$ROOT/ops/scripts/verify-canonical-endpoint-upgrade-release.py}"
[[ -x "$VERIFIER" ]] || { echo '[canonical-upgrade] independent release verifier missing' >&2; exit 1; }
"$VERIFIER" --check "$EXPORT" >/dev/null
"$VERIFIER" --emit-normalized "$EXPORT" >"$VERIFICATION"
[[ -s "$VERIFICATION" && "$(sha256sum "$EXPORT" | awk '{print $1}')" == "$EXPORT_HASH" ]] || { echo '[canonical-upgrade] release drifted during verification' >&2; exit 1; }

# Validate orchestration invariants independently of verifier internals and
# split exact process catalogs for bounded parallel generator preflight.
python3 - "$EXPORT" "$STAGE_ROOT" "$RELEASE_ID" "$PROCESS_CODE" "$VERIFICATION" <<'PY'
import hashlib,json,re,sys
from pathlib import Path
source=Path(sys.argv[1]); stage=Path(sys.argv[2]); expected_id=int(sys.argv[3]); selected=sys.argv[4]
verification=json.loads(Path(sys.argv[5]).read_text(encoding='utf-8'))
v=json.loads(source.read_text(encoding='utf-8'))
if set(v)!={'schemaVersion','source','coverage','members','catalog','proposals','validations','release'} or v['schemaVersion']!='canonical-endpoint-upgrade-release/v1':
    raise SystemExit('normalized envelope keys are not exact')
sha=re.compile(r'[0-9a-f]{64}'); code=re.compile(r'[A-Z][A-Z0-9_]{1,79}')
r=v['release']
release_keys={'releaseId','status','coverageStatus','memberCount','proposalHash','validationHash','sourceDesignCatalogHash','sourceDesignCatalogTextHash','projectedDesignCatalogHash','endpointCatalogHash','proposalCatalogHash','coverageHash','releaseHash','evidence','eligibility'}
required_hashes=('proposalHash','validationHash','sourceDesignCatalogHash','sourceDesignCatalogTextHash','projectedDesignCatalogHash','endpointCatalogHash','proposalCatalogHash','coverageHash','releaseHash')
if set(r)!=release_keys or r.get('releaseId')!=expected_id or any(not isinstance(r.get(k),str) or not sha.fullmatch(r[k]) for k in required_hashes):
    raise SystemExit('release identity/hash binding is invalid')
c=v['coverage']
coverage_keys={'status','sourceDesignCount','memberCount','missingContractCount','duplicateBlueprintCount','duplicateContractCount','incompleteLaneCount','blockerCount','coverageHash'}
if set(c)!=coverage_keys or c['status'] not in {'PARTIAL','COMPLETE'}:
    raise SystemExit('coverage keys/status are invalid')
count_keys=('sourceDesignCount','memberCount','missingContractCount','duplicateBlueprintCount','duplicateContractCount','incompleteLaneCount','blockerCount')
if any(type(c[k]) is not int or c[k]<0 for k in count_keys) or c['sourceDesignCount']<=0 or c['memberCount']<=0:
    raise SystemExit('coverage counts are invalid')
if c['sourceDesignCount']!=c['memberCount']+c['blockerCount'] or c['blockerCount']!=sum(c[k] for k in ('missingContractCount','duplicateBlueprintCount','duplicateContractCount','incompleteLaneCount')):
    raise SystemExit('coverage exclusion mismatch')
if c['status']=='COMPLETE' and c['blockerCount']!=0: raise SystemExit('COMPLETE coverage overstatement')
if c['status']=='PARTIAL' and c['blockerCount']==0: raise SystemExit('PARTIAL coverage contradiction')
if not sha.fullmatch(c['coverageHash']) or r['coverageHash']!=c['coverageHash']:
    raise SystemExit('coverage hash binding mismatch')
if r['coverageStatus']!=c['status'] or r['memberCount']!=c['memberCount'] or r['status'] not in {'PUBLISHED','ACTIVE'}:
    raise SystemExit('release state/coverage binding mismatch')
members=v['members']
if not isinstance(members,list) or len(members)!=c['memberCount']: raise SystemExit('member/coverage mismatch')
if any(type(x.get('ordinal')) is not int or x['ordinal']<1 or not isinstance(x.get('screenKey'),str) for x in members) or members!=sorted(members,key=lambda x:x['ordinal']) or len({x['ordinal'] for x in members})!=len(members):
    raise SystemExit('member ordinal/order is invalid')
processes=sorted({x.get('processCode') for x in members},key=str.casefold)
if any(not isinstance(x,str) or not code.fullmatch(x) for x in processes): raise SystemExit('invalid process member')
if selected and processes!=[selected]: raise SystemExit('process exclusion mismatch')
catalog=v['catalog']
if set(catalog)!={'memberCount','memberHashes','catalogHash','design','endpoint'} or catalog['memberCount']!=len(members):
    raise SystemExit('catalog membership mismatch')
if not sha.fullmatch(catalog['catalogHash']) or not isinstance(catalog['memberHashes'],list) or len(catalog['memberHashes'])!=len(members) or any(not isinstance(x,str) or not sha.fullmatch(x) for x in catalog['memberHashes']):
    raise SystemExit('catalog hashes are invalid')
source_value=v['source']
source_keys={'scopeProcess','sourceDesignCatalogText','sourceDesignCatalogTextHash','sourceDesignCatalogHash','sourceDesignCount','policyText','policyHash'}
if not isinstance(source_value,dict) or set(source_value)!=source_keys or source_value.get('sourceDesignCatalogHash')!=r['sourceDesignCatalogHash']:
    raise SystemExit('source design catalog hash mismatch')
if not isinstance(source_value['sourceDesignCatalogText'],str) or hashlib.sha256(source_value['sourceDesignCatalogText'].encode()).hexdigest()!=source_value['sourceDesignCatalogTextHash'] or source_value['sourceDesignCatalogTextHash']!=r['sourceDesignCatalogTextHash']:
    raise SystemExit('source design catalog text hash mismatch')
for slot,hash_key in (('design','projectedDesignCatalogHash'),('endpoint','endpointCatalogHash')):
    item=catalog.get(slot)
    if not isinstance(item,dict) or item.get('catalogHash')!=r[hash_key]: raise SystemExit(f'{slot} catalog hash mismatch')
endpoint=catalog['endpoint']; rows=endpoint.get('endpoints')
if endpoint.get('schema')!='carbonet.canonical-endpoint-catalog/v1' or not isinstance(rows,list) or len(rows)!=len(members):
    raise SystemExit('endpoint catalog membership mismatch')
by_screen={x.get('screenKey'):x for x in rows}
if len(by_screen)!=len(rows): raise SystemExit('duplicate endpoint screen')
stage.joinpath('processes.txt').write_text('\n'.join(processes)+'\n')
for process in processes:
    process_members=[x for x in members if x.get('processCode')==process]
    selected_rows=[by_screen.get(x['screenKey']) for x in process_members]
    if any(x is None or x.get('endpointContract',{}).get('operations',[{}])[0].get('processCode')!=process for x in selected_rows):
        raise SystemExit('endpoint/member process binding mismatch')
    if not selected_rows: raise SystemExit('empty process endpoint catalog')
    value='\n'.join(x['screenKey']+'\x1f'+x['endpointHash'] for x in selected_rows)
    out={'schema':'carbonet.canonical-endpoint-catalog/v1','catalogHash':hashlib.sha256(value.encode()).hexdigest(),'endpoints':selected_rows}
    stage.joinpath(process+'.endpoint.json').write_text(json.dumps(out,ensure_ascii=False,sort_keys=True,separators=(',',':')))
evidence=r['evidence']
required=('accountRelay','businessE2E','visualQA')
evidence_complete=isinstance(evidence,dict) and set(evidence)==set(required) and all(isinstance(evidence[x],dict) and set(evidence[x])=={'status','evidenceHash'} and evidence[x]['status']=='VERIFIED' and isinstance(evidence[x]['evidenceHash'],str) and sha.fullmatch(evidence[x]['evidenceHash']) for x in required)
if not isinstance(evidence,dict) or set(evidence)!=set(required) or any(not isinstance(evidence[x],dict) or set(evidence[x])!={'status','evidenceHash'} or evidence[x].get('status') not in {'ABSENT','VERIFIED'} or (evidence[x].get('evidenceHash') is not None if evidence[x].get('status')=='ABSENT' else not isinstance(evidence[x].get('evidenceHash'),str) or not sha.fullmatch(evidence[x]['evidenceHash'])) for x in required):
    raise SystemExit('invalid release evidence slots')
eligibility=r['eligibility']
if eligibility not in {'VALIDATED_ONLY','PUBLISHABLE'}: raise SystemExit('invalid release eligibility')
if eligibility=='PUBLISHABLE' and (c['status']!='COMPLETE' or not evidence_complete): raise SystemExit('release eligibility overstatement')
verification_keys={'schemaVersion','releaseId','releaseHash','status','coverageStatus','memberCount','blockerCount','eligibility','codePublicationEligible','sourceDesignCatalogHash','sourceDesignCatalogTextHash','projectedDesignCatalogHash','endpointCatalogHash','proposalCatalogHash'}
if set(verification)!=verification_keys or verification['schemaVersion']!='canonical-endpoint-upgrade-release/v1':
    raise SystemExit('independent verification summary is invalid')
summary_links={'releaseId':r['releaseId'],'releaseHash':r['releaseHash'],'status':r['status'],
 'coverageStatus':r['coverageStatus'],'memberCount':r['memberCount'],'blockerCount':c['blockerCount'],
 'eligibility':r['eligibility'],'codePublicationEligible':r['status']=='ACTIVE' and r['eligibility']=='PUBLISHABLE',
 'sourceDesignCatalogHash':r['sourceDesignCatalogHash'],'sourceDesignCatalogTextHash':r['sourceDesignCatalogTextHash'],'projectedDesignCatalogHash':r['projectedDesignCatalogHash'],
 'endpointCatalogHash':r['endpointCatalogHash'],'proposalCatalogHash':r['proposalCatalogHash']}
if any(verification[k]!=value for k,value in summary_links.items()):
    raise SystemExit('independent verification summary cross-link mismatch')
stage.joinpath('meta').write_text('\n'.join([c['status'],'true' if evidence_complete else 'false',eligibility,r['status']]+[r[x] for x in required_hashes])+'\n')
PY
mapfile -t PROCESS_CODES <"$STAGE_ROOT/processes.txt"
mapfile -t META <"$STAGE_ROOT/meta"
(( ${#PROCESS_CODES[@]} >= 1 && ${#META[@]} == 13 )) || { echo '[canonical-upgrade] normalized release is incomplete' >&2; exit 1; }
COVERAGE_STATUS="${META[0]}"; EVIDENCE_COMPLETE="${META[1]}"; ELIGIBILITY="${META[2]}"; RELEASE_STATUS="${META[3]}"

GENERATOR="${CANONICAL_ENDPOINT_UPGRADE_GENERATOR:-$ROOT/ops/scripts/generate-spring-api-from-design.py}"
[[ -x "$GENERATOR" ]] || { echo '[canonical-upgrade] Spring generator missing' >&2; exit 1; }
export GENERATOR WORKERS STAGE_ROOT
printf '%s\0' "${PROCESS_CODES[@]}" | xargs -0 -P "$WORKERS" -n 1 bash -c '
  set -Eeuo pipefail
  process="$1"
  "$GENERATOR" "$STAGE_ROOT/$process.endpoint.json" --out "$STAGE_ROOT/$process/endpoints" --workers 1 --check >"$STAGE_ROOT/$process.check.json"
  jq -e ".success==true and .check==true and ((.files|type)==\"number\") and .files>0 and .filesChanged==0" "$STAGE_ROOT/$process.check.json" >/dev/null
' _

assert_release_immutable() {
  local second="$STAGE_ROOT/export-second.json"
  assert_source_immutable || return 1
  db_export "$second" || return 1
  [[ "$(sha256sum "$second" | awk '{print $1}')" == "$EXPORT_HASH" ]] || return 1
  "$VERIFIER" --check "$second" >/dev/null || return 1
}
assert_release_immutable || { echo '[canonical-upgrade] source or release drifted during staging' >&2; exit 1; }
(( SECONDS - STARTED_SECONDS < MAX_SECONDS )) || { echo '[canonical-upgrade] ten-minute release bound exceeded' >&2; exit 1; }

# Missing pilot relay/business/visual evidence, PARTIAL coverage, --check, and
# multi-process releases are validated only. Never misreport PUBLISHED_CODE.
publishable=true
[[ "$CHECK_ONLY" == false && "$RELEASE_STATUS" == ACTIVE && "$COVERAGE_STATUS" == COMPLETE && "$EVIDENCE_COMPLETE" == true && "$ELIGIBILITY" == PUBLISHABLE && ${#PROCESS_CODES[@]} -eq 1 ]] || publishable=false
if [[ "$publishable" == false ]]; then
  jq -cn --argjson releaseId "$RELEASE_ID" --arg state VALIDATED_ONLY --arg coverage "$COVERAGE_STATUS" --argjson check "$CHECK_ONLY" \
    --argjson processCount "${#PROCESS_CODES[@]}" --arg proposalHash "${META[4]}" --arg validationHash "${META[5]}" \
    --arg sourceDesignCatalogHash "${META[6]}" --arg sourceDesignCatalogTextHash "${META[7]}" --arg projectedDesignCatalogHash "${META[8]}" --arg endpointCatalogHash "${META[9]}" --arg releaseHash "${META[12]}" \
    '{schemaVersion:"canonical-endpoint-upgrade-result/v1",state:$state,releaseId:$releaseId,coverage:$coverage,check:$check,processCount:$processCount,proposalHash:$proposalHash,validationHash:$validationHash,sourceDesignCatalogHash:$sourceDesignCatalogHash,sourceDesignCatalogTextHash:$sourceDesignCatalogTextHash,projectedDesignCatalogHash:$projectedDesignCatalogHash,endpointCatalogHash:$endpointCatalogHash,releaseHash:$releaseHash,published:false}'
  exit 0
fi

# A validated overlay is not effective runtime input until an append-only
# activation event rebinds the canonical compiler. Pin that DB binding before
# handing anything to the existing atomic publisher.
process="${PROCESS_CODES[0]}"; catalog="$STAGE_ROOT/$process.endpoint.json"
EFFECTIVE="$STAGE_ROOT/effective-binding.json"
if [[ -n "${CANONICAL_ENDPOINT_UPGRADE_EFFECTIVE_BINDING_COMMAND:-}" ]]; then
  [[ -x "$CANONICAL_ENDPOINT_UPGRADE_EFFECTIVE_BINDING_COMMAND" ]] || { echo '[canonical-upgrade] effective binding command is invalid' >&2; exit 1; }
  "$CANONICAL_ENDPOINT_UPGRADE_EFFECTIVE_BINDING_COMMAND" "$process" "$RELEASE_ID" >"$EFFECTIVE"
else
  : "${PGDATABASE:?PGDATABASE is required}"; : "${PGUSER:?PGUSER is required}"
  namespace="${K8S_NAMESPACE:-carbonet-prod}"; pod=""
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    if [[ "$(kubectl -n "$namespace" exec "$candidate" -c patroni -- psql -h 127.0.0.1 -U "$PGUSER" -d "$PGDATABASE" -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]]; then pod="$candidate"; break; fi
  done < <(kubectl -n "$namespace" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
  [[ -n "$pod" ]] || { echo '[canonical-upgrade] PostgreSQL leader not found for effective binding' >&2; exit 1; }
  kubectl -n "$namespace" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$PGUSER" -d "$PGDATABASE" -X -q -v ON_ERROR_STOP=1 -At \
    -c "BEGIN READ ONLY; SELECT public.framework_canonical_endpoint_effective_binding('$process')::text; COMMIT;" >"$EFFECTIVE"
fi
python3 - "$EFFECTIVE" "$process" "$RELEASE_ID" "${META[8]}" "${META[9]}" <<'PY'
import json,re,sys
v=json.load(open(sys.argv[1],encoding='utf-8'))
keys={'status','processCode','releaseId','endpointCatalogHash','designCatalogHash','coverageStatus','eligibility'}
if set(v)!=keys or v.get('status')!='ACTIVE' or v.get('processCode')!=sys.argv[2] or v.get('releaseId')!=int(sys.argv[3]):
    raise SystemExit('canonical endpoint effective binding is not the requested ACTIVE release')
if v.get('designCatalogHash')!=sys.argv[4] or v.get('endpointCatalogHash')!=sys.argv[5]:
    raise SystemExit('canonical endpoint effective binding hash mismatch')
if v.get('coverageStatus')!='COMPLETE' or v.get('eligibility')!='PUBLISHABLE':
    raise SystemExit('canonical endpoint effective binding is not publishable')
PY
assert_release_immutable || { echo '[canonical-upgrade] source or release drifted after effective binding' >&2; exit 1; }

# The existing full-stack shell re-reads authoritative DB state, rechecks the
# external catalog hash, stages runtime/preview/endpoint artifacts, compiles
# Spring sources, then atomically swaps the three process directories.
PUBLISHER="${CANONICAL_ENDPOINT_UPGRADE_PUBLISHER:-$ROOT/ops/scripts/generate-full-stack-design-packages.sh}"
[[ -x "$PUBLISHER" ]] || { echo '[canonical-upgrade] atomic full-stack publisher missing' >&2; exit 1; }
PUBLISHED_ENDPOINT_ROOT="${CANONICAL_ENDPOINT_OUT:-$ROOT/projects/carbonet-backend-metadata/process-runtime/generated-endpoints}"
PUBLISHED_RELEASE="$PUBLISHED_ENDPOINT_ROOT/$process/full-stack-release.json"
publish_started="$SECONDS"
timeout --signal=TERM --kill-after=5s "${PUBLISH_SECONDS}s" env \
  CANONICAL_ENDPOINT_CATALOG="$catalog" CANONICAL_ENDPOINT_AUTODETECT=false \
  CANONICAL_GENERATOR_WORKERS="$WORKERS" CANONICAL_ENDPOINT_OUT="$PUBLISHED_ENDPOINT_ROOT" \
  "$PUBLISHER" "$ROOT" "$process" | tee "$STAGE_ROOT/publisher.log" >&2
(( SECONDS - publish_started <= PUBLISH_SECONDS )) || { echo '[canonical-upgrade] atomic publication exceeded 60 seconds' >&2; exit 1; }
python3 - "$STAGE_ROOT/publisher.log" "$process" "$PUBLISHED_RELEASE" "${META[8]}" "${META[9]}" <<'PY'
import hashlib,json,re,sys
events=[]
for line in open(sys.argv[1],encoding='utf-8'):
    try: value=json.loads(line)
    except json.JSONDecodeError: continue
    if value.get('event')=='CANONICAL_RELEASE_READY': events.append(value)
if len(events)!=1 or set(events[0])!={'event','boundary','processCode','releaseHash'} or events[0].get('boundary')!='GIT_COMMIT' or events[0].get('processCode')!=sys.argv[2]:
    raise SystemExit('atomic publisher completion evidence missing')
with open(sys.argv[3],encoding='utf-8') as stream: marker=json.load(stream)
keys={'schema','lanes','designCatalogHash','endpointCatalogHash','designHashes','packageManifestHash','endpointBundleHash','releaseHash'}
if set(marker)!=keys or marker.get('schema')!='carbonet.canonical-full-stack-release/v1' or marker.get('designCatalogHash')!=sys.argv[4] or marker.get('endpointCatalogHash')!=sys.argv[5]:
    raise SystemExit('atomic publisher release marker cross-link mismatch')
claimed=marker.pop('releaseHash',None)
actual=hashlib.sha256(json.dumps(marker,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
if not isinstance(claimed,str) or not re.fullmatch('[0-9a-f]{64}',claimed) or claimed!=actual or events[0].get('releaseHash')!=claimed:
    raise SystemExit('atomic publisher release hash evidence mismatch')
PY
EFFECTIVE_AFTER="$STAGE_ROOT/effective-binding-after.json"
if [[ -n "${CANONICAL_ENDPOINT_UPGRADE_EFFECTIVE_BINDING_COMMAND:-}" ]]; then
  "$CANONICAL_ENDPOINT_UPGRADE_EFFECTIVE_BINDING_COMMAND" "$process" "$RELEASE_ID" >"$EFFECTIVE_AFTER"
else
  kubectl -n "$namespace" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$PGUSER" -d "$PGDATABASE" -X -q -v ON_ERROR_STOP=1 -At \
    -c "BEGIN READ ONLY; SELECT public.framework_canonical_endpoint_effective_binding('$process')::text; COMMIT;" >"$EFFECTIVE_AFTER"
fi
cmp -s "$EFFECTIVE" "$EFFECTIVE_AFTER" || { echo '[canonical-upgrade] effective binding drifted during atomic publication' >&2; exit 1; }
assert_release_immutable || { echo '[canonical-upgrade] source or release drifted at publication boundary' >&2; exit 1; }
jq -cn --argjson releaseId "$RELEASE_ID" --arg state PUBLISHED_CODE --arg coverage COMPLETE \
  --arg proposalHash "${META[4]}" --arg validationHash "${META[5]}" --arg sourceDesignCatalogHash "${META[6]}" \
  --arg sourceDesignCatalogTextHash "${META[7]}" --arg projectedDesignCatalogHash "${META[8]}" \
  --arg endpointCatalogHash "${META[9]}" --arg releaseHash "${META[12]}" \
  '{schemaVersion:"canonical-endpoint-upgrade-result/v1",state:$state,releaseId:$releaseId,coverage:$coverage,processCount:1,proposalHash:$proposalHash,validationHash:$validationHash,sourceDesignCatalogHash:$sourceDesignCatalogHash,sourceDesignCatalogTextHash:$sourceDesignCatalogTextHash,projectedDesignCatalogHash:$projectedDesignCatalogHash,endpointCatalogHash:$endpointCatalogHash,releaseHash:$releaseHash,published:true}'
