#!/usr/bin/env python3
"""Merge professional design into implemented subprocesses without duplication."""
from __future__ import annotations
import argparse,hashlib,json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/architecture/executable-webapp/generated'

DESIGN_TO_IMPLEMENTED={
 'IDENTITY_SIGNUP':['MEMBER_SIGNUP_PUBLIC','IDENTITY_PROOF_VERIFICATION_REQUIRED','MEMBER_APPROVAL_ACTIVATION_REQUIRED','A10201'], 'IDENTITY_ACCESS':['A10201'], 'MEMBER_RECOVERY':['A10201','H10801'],
 'MEMBER_LIFECYCLE':['A10201','H10801'], 'COMPANY_ONBOARDING':['COMPANY_REGISTRATION_PUBLIC','COMPANY_REAPPLICATION_PUBLIC','A10202'], 'ROLE_ASSIGNMENT':['A10203'],
 'EMISSION_PROJECT':['H10201','A10301'], 'ACTIVITY_REQUEST':['H10202','A10302'], 'ACTIVITY_DATA':['H10202','A10302'],
 'EVIDENCE_MANAGEMENT':['H10202','A10302'], 'FACTOR_MAPPING':['H10203','A10602'], 'EMISSION_CALCULATION':['H10203','A10303'],
 'EMISSION_VALIDATION':['H10203','A10303','A10701'], 'EMISSION_APPROVAL':['H10204','A10303'], 'STATEMENT_REPORT':['H10204','A10304'],
 'LCA_PROJECT':['H10301','A10401'], 'LCA_INVENTORY':['H10302','A10402'], 'LCA_ALLOCATION':['H10302','A10402'],
 'LCA_IMPACT':['H10303','A10403'], 'LCA_REPORT':['H10304','A10403'],
 'REDUCTION_TARGET':['H10401','A10501'], 'REDUCTION_INITIATIVE':['H10402','A10501'], 'REDUCTION_PERFORMANCE':['H10403','A10501'],
 'MONITORING_ANALYSIS':['H10501','A10101'],
 'SUPPLY_DEMAND':['H10601'], 'TRADE_EXECUTION':['H10602','A10901'], 'SETTLEMENT':['A10902'],
 'CERTIFICATE_ISSUANCE':['H10604','A10903'], 'CERTIFICATE_VERIFY':['H10604','A10903'],
 'REFERENCE_DATA':['A10602','A10603'], 'EXTERNAL_INTEGRATION':['A11001'],
 'CONTENT_EDUCATION':['H10701','H10702','A10801','A10802'], 'CUSTOMER_SUPPORT':['H10703','A10803'],
 'GOVERNANCE_CHANGE':['A11101','A11102'], 'PLATFORM_OPERATION':['A10101','A11104'],
 'PRIVACY_RIGHTS':['A10201','A11103'], 'SECURITY_INCIDENT':['A11103','A11104'], 'AUDIT_EXPORT':['A11103'],
}
ACTOR_BY_ROOT={'H101':'COMPANY_MANAGER','H102':'COMPANY_MANAGER','H103':'LCA_PRACTITIONER','H104':'REDUCTION_MANAGER','H105':'VERIFIER','H106':'COMPANY_MANAGER','H107':'COMPANY_MANAGER','H108':'COMPANY_MANAGER','A101':'PLATFORM_OPERATOR','A102':'COMPANY_MANAGER','A103':'COMPANY_MANAGER','A104':'LCA_PRACTITIONER','A105':'REDUCTION_MANAGER','A106':'PLATFORM_OPERATOR','A107':'VERIFIER','A108':'PLATFORM_OPERATOR','A109':'PLATFORM_OPERATOR','A110':'SYSTEM_INTEGRATOR','A111':'PLATFORM_OPERATOR','A112':'PLATFORM_OPERATOR'}
ACTOR_BY_GROUP={'H10101':'MEMBER','H10201':'COMPANY_MANAGER','H10202':'SITE_DATA_OWNER','H10203':'CALCULATOR','H10204':'APPROVER','H10301':'LCA_PRACTITIONER','H10302':'LCA_PRACTITIONER','H10303':'LCA_PRACTITIONER','H10304':'LCA_PRACTITIONER','H10401':'REDUCTION_MANAGER','H10402':'REDUCTION_MANAGER','H10403':'REDUCTION_MANAGER','H10404':'REDUCTION_MANAGER','H10501':'VERIFIER','H10601':'TRADER','H10602':'TRADER','H10603':'AUDITOR','H10604':'CERTIFICATE_ISSUER','H10701':'CONTENT_MANAGER','H10702':'CONTENT_MANAGER','H10703':'SUPPORT_AGENT','H10801':'MEMBER','A10203':'PLATFORM_OPERATOR','A10302':'SITE_DATA_OWNER','A10303':'VERIFIER','A10304':'APPROVER','A10601':'DATA_STEWARD','A10602':'DATA_STEWARD','A10603':'DATA_STEWARD','A10604':'DATA_STEWARD','A10701':'VERIFIER','A10801':'CONTENT_MANAGER','A10802':'CONTENT_MANAGER','A10803':'SUPPORT_AGENT','A10901':'TRADER','A10902':'SETTLEMENT_OFFICER','A10903':'CERTIFICATE_ISSUER','A11001':'SYSTEM_INTEGRATOR','A11103':'SECURITY_ADMIN'}
EXTRA_PARTICIPANTS={'COMPANY_ONBOARDING':['COMPANY_REPRESENTATIVE','ORGANIZATION_MANAGER','SITE_MANAGER'],'EMISSION_VALIDATION':['EXTERNAL_VERIFIER','VERIFICATION_MANAGER'],'STATEMENT_REPORT':['REGULATOR'],'CERTIFICATE_ISSUANCE':['AUDITOR'],'PRIVACY_RIGHTS':['PRIVACY_OFFICER'],'SECURITY_INCIDENT':['PRIVACY_OFFICER','AUDITOR']}
TEST_VARIANTS={'HAPPY_PATH':['STANDARD'],'VALIDATION':['EMPTY_REQUIRED','MALFORMED','BELOW_MIN','ABOVE_MAX','UNIT_MISMATCH'],'AUTHORITY':['UNASSIGNED_ACTOR','EXPIRED_ASSIGNMENT','SEGREGATION_CONFLICT','DELEGATION_EXPIRED'],'ISOLATION':['OTHER_TENANT','OTHER_COMPANY','OTHER_SITE','OTHER_PROJECT'],'STATE':['INVALID_TRANSITION','STALE_VERSION','LOCKED_RECORD','ALREADY_COMPLETED'],'IDEMPOTENCY':['DUPLICATE_COMMAND','RETRY_AFTER_TIMEOUT'],'CONCURRENCY':['OPTIMISTIC_LOCK','PARALLEL_APPROVAL'],'DEADLINE':['DUE_SOON','OVERDUE','ESCALATED'],'INTEGRATION':['TIMEOUT','INVALID_RESPONSE','PARTIAL_SUCCESS','RETRY_EXHAUSTED'],'PRIVACY':['MASKING','PURPOSE_LIMIT','RETENTION_EXPIRED','CONSENT_WITHDRAWN'],'AUDIT':['EVIDENCE_REQUIRED','HASH_MISMATCH','MISSING_ACCESS_LOG'],'RECOVERY':['ROLLBACK','REOPEN','RESUME_FROM_CHECKPOINT'],'ACCESSIBILITY':['KEYBOARD','SCREEN_READER','MOBILE_REFLOW']}
PUBLIC_PROCESS_DEFINITIONS=[
 {'processCode':'MEMBER_SIGNUP_PUBLIC','processName':'공개 일반 회원가입','domainCode':'PUBLIC_JOIN 회원가입','ownerActorCode':'APPLICANT','participantActorCodes':['COMPANY_MANAGER','PRIVACY_OFFICER'],'modelType':'IMPLEMENTED_CANONICAL','source':'MemberJoinController + homeExperienceFamily','steps':[
  ('회원유형 선택','/join/step1','/join/api/step1','VERIFIED'),('필수 약관·개인정보·GWP 동의','/join/step2','/join/api/step2','VERIFIED'),('인증수단 선택·세션 기록','/join/step3','/join/api/step3','VERIFIED'),('회원·소속·증빙 입력 및 가입 저장','/join/step4','/join/api/step4/submit','VERIFIED'),('가입 완료 결과 표시','/join/step5','UNRESOLVED','VERIFIED')]},
 {'processCode':'IDENTITY_PROOF_VERIFICATION_REQUIRED','processName':'실명 본인·법인 인증 증적','domainCode':'PUBLIC_JOIN 회원가입','ownerActorCode':'SECURITY_ADMIN','participantActorCodes':['APPLICANT','PRIVACY_OFFICER'],'modelType':'NEW_REQUIRED_CANONICAL','source':'IMPLEMENTATION_GAP_IDENTITY_PROOF','implementationStatus':'NOT_IMPLEMENTED','steps':[
  ('인증 제공자·보증수준 선택','UNRESOLVED','UNRESOLVED','NOT_IMPLEMENTED'),('인증 요청·콜백 상관관계 발급','UNRESOLVED','UNRESOLVED','NOT_IMPLEMENTED'),('서명·nonce·만료·재사용 검증','UNRESOLVED','UNRESOLVED','NOT_IMPLEMENTED'),('최소 식별정보·인증 증적 결합','UNRESOLVED','UNRESOLVED','NOT_IMPLEMENTED'),('실패·취소·만료·재시도 처리','UNRESOLVED','UNRESOLVED','NOT_IMPLEMENTED')]},
 {'processCode':'MEMBER_APPROVAL_ACTIVATION_REQUIRED','processName':'회원 가입 승인·활성화','domainCode':'PUBLIC_JOIN 회원가입','ownerActorCode':'COMPANY_MANAGER','participantActorCodes':['APPROVER','APPLICANT','SECURITY_ADMIN'],'modelType':'NEW_REQUIRED_CANONICAL','source':'IMPLEMENTATION_GAP_APPROVAL_ACTIVATION','implementationStatus':'NOT_IMPLEMENTED','steps':[
  ('승인 대기 회원·증빙 조회','/admin/member/approve','UNRESOLVED','PARTIAL'),('회원·소속·인증 증적 검토','/admin/member/approve','UNRESOLVED','PARTIAL'),('승인·반려·보완 결정','/admin/member/approve','UNRESOLVED','PARTIAL'),('계정·역할·데이터 범위 활성화','UNRESOLVED','UNRESOLVED','NOT_IMPLEMENTED'),('결과 통지·최초 로그인 연결','UNRESOLVED','UNRESOLVED','NOT_IMPLEMENTED')]},
 {'processCode':'COMPANY_REGISTRATION_PUBLIC','processName':'공개 회원사 등록·승인','domainCode':'PUBLIC_JOIN 회원사','ownerActorCode':'COMPANY_REPRESENTATIVE','participantActorCodes':['COMPANY_MANAGER','APPROVER'],'modelType':'IMPLEMENTED_PARTIAL_CANONICAL','source':'MemberJoinController companyRegister','steps':[
  ('회원사 중복 검색·유형 확인','/join/companyRegister','/join/searchCompany','VERIFIED'),('법인·대표·담당자 정보 입력','/join/companyRegister','/join/api/company-register','VERIFIED'),('사업자 증빙 업로드','/join/companyRegister','/join/api/company-register','VERIFIED'),('가입 신청 저장','/join/companyRegister','/join/api/company-register','VERIFIED'),('가입 상태 조회','/join/companyJoinStatusSearch','/join/api/company-status/detail','VERIFIED'),('관리자 검토·승인·반려','/admin/member/company-approve','UNRESOLVED','PARTIAL'),('승인 결과·활성화 통지','/join/companyJoinStatusDetail','/join/api/company-status/detail','PARTIAL')]},
 {'processCode':'COMPANY_REAPPLICATION_PUBLIC','processName':'회원사 반려·보완·재신청','domainCode':'PUBLIC_JOIN 회원사','ownerActorCode':'COMPANY_REPRESENTATIVE','participantActorCodes':['COMPANY_MANAGER','APPROVER'],'modelType':'IMPLEMENTED_CANONICAL','source':'MemberJoinController companyReapply','steps':[
  ('신청 건·대표자 식별','/join/companyJoinStatusSearch','/join/api/company-status/detail','VERIFIED'),('반려 상태·사유 확인','/join/companyJoinStatusDetail','/join/api/company-status/detail','VERIFIED'),('기존 정보·증빙 불러오기','/join/companyReapply','/join/api/company-reapply/page','VERIFIED'),('정보·증빙 보완','/join/companyReapply','/join/api/company-reapply','VERIFIED'),('재신청 저장·상태 전환','/join/companyReapply','/join/api/company-reapply','VERIFIED'),('재심사 결과 확인','/join/companyJoinStatusDetail','/join/api/company-status/detail','VERIFIED')]}
]
MERGE_INTO={'A10103':'A10101','A10104':'A10101','A10105':'A10101','A10106':'A10101','A10107':'A10101','A10108':'A10101','A10109':'A10101','A10604':'A10603','A10704':'A10701','A10804':'A10803'}

def normalize_steps(process):
 for i,step in enumerate(process['steps'],1):
  step['stepOrder']=i;step['fromState']='READY' if i==1 else f'S{i-1:02d}_DONE';step['toState']=f'S{i:02d}_DONE'

def archive_category(step):
 value=(step.get('screenCode','')+' '+step.get('stepName','')).lower()
 if '/member/' in value:return 'MEMBER'
 if '/emission/' in value:return 'EMISSION_LCA'
 if any(x in value for x in ['/trade/','/payment/','/certificate/']):return 'TRADE_PAYMENT_CERT'
 if '/content/' in value:return 'CONTENT'
 if '/external/' in value:return 'EXTERNAL'
 if any(x in value for x in ['security','blocklist','ip_whitelist','audit']):return 'SYSTEM_SECURITY'
 if any(x in value for x in ['backup','restore','db-','db_','monitoring','git-','build','performance','infra','cron','batch','version','package']):return 'SYSTEM_OPERATION'
 return 'SYSTEM_GOVERNANCE'

def balanced_chunks(items,maximum=10):
 count=max(1,(len(items)+maximum-1)//maximum);base,extra=divmod(len(items),count);out=[];start=0
 for i in range(count):
  size=base+(1 if i<extra else 0);out.append(items[start:start+size]);start+=size
 return out

def compact_evidence(cap):
 graph=cap.get('implementationEvidence') or {};coverage=graph.get('coverage',{})
 return {'menuCode':cap.get('sourceMenuCode') or cap['menuCode'],'routeMatch':cap.get('routeTrace',{}).get('routeMatch','NONE'),'bindingCount':len(cap.get('bindings') or []),'blueprintCount':len(cap.get('screenBlueprints') or []),'traceStatus':graph.get('traceStatus','UNRESOLVED'),'coverage':coverage,'screenSources':[x.get('sourcePath') for x in graph.get('screenEvidence',[])][:5],'apiEndpoints':[x.get('path') for x in graph.get('apiEvidence',[])][:10],'databaseObjects':graph.get('databaseEvidence',[])[:20],'authorities':graph.get('authorityEvidence',[])[:20],'testSources':[x.get('sourcePath') for x in graph.get('testEvidence',[])][:10]}

def lock_implemented_process(process):
 process['readOnly']=True;process['mutationPolicy']='SOURCE_OF_TRUTH_REGENERATION_ONLY';process['lockReason']='기개발 구현은 설계 병합이나 빌더에서 수정할 수 없습니다. 실제 소스 또는 DB 변경 후 자동 재수집으로만 갱신합니다.'
 for step in process['steps']:
  step['readOnly']=True;step['mutationPolicy']='SOURCE_OF_TRUTH_REGENERATION_ONLY'
 semantic={'processCode':process['processCode'],'processName':process['processName'],'domainCode':process['domainCode'],'steps':[{k:s.get(k) for k in ('stepCode','stepOrder','stepName','actorCode','screenCode','apiCode','implementationStatus')} for s in process['steps']]}
 process['sourceFingerprint']='sha256:'+hashlib.sha256(json.dumps(semantic,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--implemented',type=Path,default=OUT/'implemented-process-model.json');ap.add_argument('--design',type=Path,default=OUT/'processes.json');ap.add_argument('--design-actors',type=Path,default=OUT/'actors.json');ap.add_argument('--runtime-db',type=Path,default=OUT/'runtime-db-inventory.json');ap.add_argument('--design-tests',type=Path,default=OUT/'test-scenarios.jsonl');ap.add_argument('--out',type=Path,default=OUT);args=ap.parse_args()
 implemented=json.loads(args.implemented.read_text(encoding='utf-8-sig'));designed=json.loads(args.design.read_text(encoding='utf-8-sig'))
 designed_actors=json.loads(args.design_actors.read_text(encoding='utf-8-sig'));runtime_db=json.loads(args.runtime_db.read_text(encoding='utf-8-sig'))
 tests=[json.loads(x) for x in args.design_tests.read_text(encoding='utf-8-sig').splitlines() if x.strip()]
 groups={g['menuCode']:g for g in implemented['subprocesses']};caps={c['menuCode']:c for c in implemented['capabilities']};roots={r['menuCode']:r for r in implemented['domains']}
 processes=[];all_steps=[]
 for group in implemented['subprocesses']:
  steps=[]
  for i,code in enumerate(group['capabilityCodes'],1):
   cap=caps[code];binding=(cap.get('bindings') or [{}])[0];bp=(cap.get('screenBlueprints') or [{}])[0];actor=binding.get('actor_code') or ACTOR_BY_GROUP.get(group['menuCode']) or ACTOR_BY_ROOT.get(group['parentCode'],'PLATFORM_OPERATOR');route=cap.get('url') or '';evidence=compact_evidence(cap);status='VERIFIED' if evidence['coverage'].get('screen') and evidence['coverage'].get('api') else ('PARTIAL' if route or cap.get('bindings') or any(evidence['coverage'].values()) else 'UNRESOLVED')
   steps.append({'stepCode':cap['menuCode'],'stepOrder':i,'stepName':cap['name'],'actorCode':actor,'fromState':'READY' if i==1 else f'S{i-1:02d}_DONE','toState':f'S{i:02d}_DONE','commandCode':f"OPEN_{cap['menuCode']}",'screenCode':bp.get('page_id') or route or 'UNRESOLVED','apiCode':binding.get('api_contract') or (evidence['apiEndpoints'][0] if evidence['apiEndpoints'] else 'UNRESOLVED'),'implementationStatus':status,'implementationEvidence':evidence,'completionRules':['routeResolved','businessActionVerified','auditEvidenceProduced'],'failureTransitions':['ROUTE_MISSING','AUTHORITY_DENIED','CONTRACT_MISSING'],'rollbackCommand':f"RETURN_{cap['menuCode']}"})
  processes.append({'processCode':group['menuCode'],'processName':group['name'],'domainCode':f"{group['parentCode']} {roots.get(group['parentCode'],{}).get('name','')}",'ownerActorCode':ACTOR_BY_GROUP.get(group['menuCode']) or ACTOR_BY_ROOT.get(group['parentCode'],'PLATFORM_OPERATOR'),'participantActorCodes':[],'modelType':'IMPLEMENTED_CANONICAL','source':'CURRENT_SYSTEM_DB_MENU','steps':steps})
  all_steps.extend(steps)
 for definition in PUBLIC_PROCESS_DEFINITIONS:
  steps=[]
  for i,(name,screen,api,status) in enumerate(definition['steps'],1):
   code=f"{definition['processCode']}_{i:02d}"
   steps.append({'stepCode':code,'stepOrder':i,'stepName':name,'actorCode':definition['ownerActorCode'],'fromState':'READY' if i==1 else f'S{i-1:02d}_DONE','toState':f'S{i:02d}_DONE','commandCode':f'EXECUTE_{code}','screenCode':screen,'apiCode':api,'implementationStatus':status,'implementationEvidence':{'source':definition['source'],'screenPath':screen,'apiPath':api},'completionRules':['requiredInputValid','stateTransitionCommitted','evidencePersisted'],'failureTransitions':['VALIDATION_FAILED','SESSION_EXPIRED','DUPLICATE','AUTHORITY_DENIED'],'rollbackCommand':f'ROLLBACK_{code}'})
  processes.append({**{k:v for k,v in definition.items() if k!='steps'},'steps':steps});all_steps.extend(steps)
 process_map={p['processCode']:p for p in processes}
 for source,target in MERGE_INTO.items():
  if source in process_map and target in process_map:
   existing={(s['stepName'],s['screenCode']) for s in process_map[target]['steps']}
   process_map[target]['steps'].extend(s for s in process_map[source]['steps'] if (s['stepName'],s['screenCode']) not in existing);process_map[source]['mergedInto']=target
 processes=[p for p in processes if 'mergedInto' not in p]
 for p in processes:normalize_steps(p)
 archive=next((p for p in processes if p['processCode']=='A11201'),None)
 if archive:
  processes.remove(archive);buckets={}
  for step in archive['steps']:buckets.setdefault(archive_category(step),[]).append(step)
  for category,steps in sorted(buckets.items()):
   chunks=balanced_chunks(steps)
   for chunk_index,chunk in enumerate(chunks,1):
    suffix=f'_{chunk_index}' if len(chunks)>1 else ''
    item={'processCode':f'A112_{category}{suffix}','processName':f"기존 화면 보관 · {category.replace('_',' ')}{suffix}",'domainCode':archive['domainCode'],'ownerActorCode':archive['ownerActorCode'],'modelType':'IMPLEMENTED_CANONICAL_SPLIT','source':'CURRENT_SYSTEM_DB_MENU_COMPLEXITY_SPLIT','steps':chunk};normalize_steps(item);processes.append(item)
 existing_codes={s['stepCode'] for p in processes for s in p['steps']}
 orphan_caps=[caps[code] for code in sorted(set(caps)-existing_codes)]
 governance_targets=[p for p in processes if p['processCode'].startswith('A112_SYSTEM_GOVERNANCE')]
 for cap in orphan_caps:
  target=min(governance_targets,key=lambda p:len(p['steps']));binding=(cap.get('bindings') or [{}])[0];bp=(cap.get('screenBlueprints') or [{}])[0];route=cap.get('url') or ''
  evidence=compact_evidence(cap);target['steps'].append({'stepCode':cap['menuCode'],'stepOrder':0,'stepName':cap['name'],'actorCode':binding.get('actor_code') or 'PLATFORM_OPERATOR','fromState':'','toState':'','commandCode':f"OPEN_{cap['menuCode']}",'screenCode':bp.get('page_id') or route or 'UNRESOLVED','apiCode':binding.get('api_contract') or (evidence['apiEndpoints'][0] if evidence['apiEndpoints'] else 'UNRESOLVED'),'implementationStatus':'VERIFIED' if evidence['coverage'].get('screen') and evidence['coverage'].get('api') else 'PARTIAL','implementationEvidence':evidence,'completionRules':['routeResolved','businessActionVerified','auditEvidenceProduced'],'failureTransitions':['ROUTE_MISSING','AUTHORITY_DENIED'],'rollbackCommand':f"RETURN_{cap['menuCode']}"});normalize_steps(target)
 design_codes={p['processCode'] for p in designed};mapped=set(DESIGN_TO_IMPLEMENTED);missing_mapping=sorted(design_codes-mapped)
 special_codes={p['processCode'] for p in processes if p.get('modelType','').startswith('IMPLEMENTED_PARTIAL') or p.get('domainCode','').startswith('PUBLIC_JOIN')}
 unresolved_targets=sorted({target for vals in DESIGN_TO_IMPLEMENTED.values() for target in vals if target not in groups and target not in special_codes})
 additions=[]
 for proc in designed:
  if proc['processCode'] in DESIGN_TO_IMPLEMENTED:continue
  copy={**proc,'modelType':'NEW_REQUIRED_CANONICAL','source':'LEGAL_AND_DOMAIN_GAP','implementationStatus':'NOT_IMPLEMENTED'};additions.append(copy);processes.append(copy);all_steps.extend(copy['steps'])
 canonical_by_code={p['processCode']:p for p in processes};design_by_code={p['processCode']:p for p in designed}
 for design_code,targets in DESIGN_TO_IMPLEMENTED.items():
  participants=[design_by_code[design_code]['ownerActorCode'],*EXTRA_PARTICIPANTS.get(design_code,[])]
  for target in targets:
   target=MERGE_INTO.get(target,target);item=canonical_by_code.get(target)
   if item:
    item.setdefault('designProcessCodes',[]).append(design_code);item['participantActorCodes']=sorted(set(item.get('participantActorCodes',[])+participants+[item['ownerActorCode']]))
 capability_to_process={s['stepCode']:p['processCode'] for p in processes for s in p['steps']}
 canonical_tests=[]
 for test in implemented['scenarioCandidates']:
  copy=dict(test);copy['processCode']=capability_to_process.get(test.get('capabilityCode'),test['processCode']);canonical_tests.append(copy)
 for process in processes:
  if not process.get('domainCode','').startswith('PUBLIC_JOIN'):continue
  for step in process['steps']:
   for family,variants in TEST_VARIANTS.items():
    for variant in variants:
     canonical_tests.append({'caseCode':f"TC_{step['stepCode']}_{family}_{variant}",'processCode':process['processCode'],'stepCode':step['stepCode'],'caseType':family,'variant':variant,'severity':'CRITICAL' if family in {'AUTHORITY','ISOLATION','PRIVACY','AUDIT'} else 'MAJOR','given':['publicJoinSession',f"state={step['fromState']}",f"variant={variant}"],'when':{'commandCode':step['commandCode'],'screenCode':step['screenCode'],'apiCode':step['apiCode']},'then':['expectedStateOrControlledFailure','noPartialWrite','auditEvidenceProduced'],'status':'IMPLEMENTED_TEST_REQUIRED'})
 canonical_tests += [t for t in tests if t['processCode'] in {p['processCode'] for p in additions}]
 for process in processes:
  if process.get('modelType','').startswith('IMPLEMENTED') or process.get('source','').startswith('CURRENT_SYSTEM'):
   lock_implemented_process(process)
 duplicate_codes=sorted({p['processCode'] for p in processes if sum(x['processCode']==p['processCode'] for x in processes)>1})
 empty=sorted(p['processCode'] for p in processes if not p['steps'])
 all_steps=[s for p in processes for s in p['steps']]
 too_small=sorted(p['processCode'] for p in processes if len(p['steps'])<3);too_large=sorted(p['processCode'] for p in processes if len(p['steps'])>12)
 added_codes={p['processCode'] for p in additions};unmapped_not_added=sorted(set(missing_mapping)-added_codes)
 new_required=[p for p in processes if p.get('modelType')=='NEW_REQUIRED_CANONICAL'];implemented_capability_codes={c['menuCode'] for c in implemented['capabilities']};canonical_implemented_codes={s['stepCode'] for p in processes for s in p['steps'] if p.get('source','').startswith('CURRENT_SYSTEM')}|{f'{source}_SELF' for source in MERGE_INTO};missing_implemented=sorted(implemented_capability_codes-canonical_implemented_codes)
 implemented_steps=[s for p in processes if p.get('source','').startswith('CURRENT_SYSTEM') for s in p['steps']]
 coverage_keys=('screen','api','database','authority','test')
 evidence_counts={f"implementedStepsWith{key.title()}Evidence":sum(bool(s.get('implementationEvidence',{}).get('coverage',{}).get(key)) for s in implemented_steps) for key in coverage_keys}
 immutable_processes=[p for p in processes if p.get('readOnly')]
 unlocked_implemented=[p['processCode'] for p in processes if (p.get('modelType','').startswith('IMPLEMENTED') or p.get('source','').startswith('CURRENT_SYSTEM')) and not p.get('readOnly')]
 unlocked_implemented_steps=[s['stepCode'] for p in immutable_processes for s in p['steps'] if not s.get('readOnly')]
 stats={'canonicalProcesses':len(processes),'implementedProcesses':len(implemented['subprocesses']),'newRequiredProcesses':len(new_required),'canonicalSteps':len(all_steps),'canonicalScenarios':len(canonical_tests),'designProcessesReusedThroughExisting':len(mapped & design_codes),'designProcessesAddedAsNew':len(added_codes),'unmappedDesignProcesses':len(unmapped_not_added),'unresolvedMappingTargets':len(unresolved_targets),'duplicateProcessCodes':len(duplicate_codes),'emptyProcesses':len(empty),'processesBelowComplexityFloor':len(too_small),'processesAboveComplexityCeiling':len(too_large),'preservedImplementedCapabilities':len(canonical_implemented_codes),'immutableImplementedProcesses':len(immutable_processes),'immutableImplementedSteps':sum(len(p['steps']) for p in immutable_processes),**evidence_counts}
 validation={'duplicateProcessCodes':duplicate_codes,'emptyProcesses':empty,'unmappedDesignProcesses':unmapped_not_added,'unresolvedMappingTargets':unresolved_targets,'processesBelowComplexityFloor':too_small,'processesAboveComplexityCeiling':too_large,'missingImplementedCapabilityCodes':missing_implemented,'unlockedImplementedProcessCodes':unlocked_implemented,'unlockedImplementedStepCodes':unlocked_implemented_steps}
 validation['status']='PASSED' if not any(validation.values()) else 'FAILED'
 actor_map={a['actorCode']:a for a in designed_actors}
 for row in runtime_db.get('actors',[]):
  code=row['actor_code'];actor_map.setdefault(code,{'actorCode':code,'actorName':row['actor_name'],'actorType':row['actor_type'],'purpose':row['purpose'],'source':'CURRENT_SYSTEM_DB'})
 used_actors={p['ownerActorCode'] for p in processes}|{a for p in processes for a in p.get('participantActorCodes',[])}|{s['actorCode'] for p in processes for s in p['steps']}
 validation.pop('status',None);validation['unknownActorCodes']=sorted(used_actors-set(actor_map));validation['unusedDesignedActorCodes']=sorted(set(actor_map)-used_actors);validation['status']='PASSED' if not any(validation.values()) else 'FAILED'
 stats['canonicalActors']=len(actor_map);stats['usedActors']=len(used_actors);stats['unusedActors']=len(validation['unusedDesignedActorCodes'])
 model={'precedencePolicy':'IMPLEMENTED_FIRST; REQUIRED_GAPS_ARE_SEPARATE_NEW_PROCESSES','implementedMutationPolicy':'READ_ONLY; SOURCE_OF_TRUTH_REGENERATION_ONLY','stats':stats,'actors':list(actor_map.values()),'processes':processes,'tests':canonical_tests,'designTrace':DESIGN_TO_IMPLEMENTED,'newProcessCodes':[p['processCode'] for p in new_required],'validation':validation}
 (args.out/'canonical-process-model.json').write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 (args.out/'canonical-process-summary.json').write_text(json.dumps({'precedencePolicy':model['precedencePolicy'],'stats':stats,'validation':validation},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 lines=['# 기개발 우선 정규 프로세스 모델','','기개발 중메뉴 프로세스를 기준으로 유지하고 신규 전문 설계는 기존 프로세스에 추적 연결합니다. 대응 프로세스가 없는 업무만 같은 레벨로 신규 추가합니다.','','## 검증']+[f'- {k}: {v:,}' for k,v in stats.items()]+['',f"- status: {model['validation']['status']}",'','## 신규 필요 프로세스']+[f"- {p['processCode']}: {p['processName']}" for p in additions]
 (args.out/'canonical-process-model.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 print(json.dumps({'stats':stats,'validation':model['validation']},ensure_ascii=False))
if __name__=='__main__':main()
