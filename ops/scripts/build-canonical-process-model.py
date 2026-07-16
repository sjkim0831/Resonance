#!/usr/bin/env python3
"""Merge professional design into implemented subprocesses without duplication."""
from __future__ import annotations
import argparse,json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/architecture/executable-webapp/generated'

DESIGN_TO_IMPLEMENTED={
 'IDENTITY_SIGNUP':['A10201','A10202'], 'IDENTITY_ACCESS':['A10201'], 'MEMBER_RECOVERY':['A10201','H10801'],
 'MEMBER_LIFECYCLE':['A10201','H10801'], 'COMPANY_ONBOARDING':['A10202'], 'ROLE_ASSIGNMENT':['A10203'],
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
   cap=caps[code];binding=(cap.get('bindings') or [{}])[0];bp=(cap.get('screenBlueprints') or [{}])[0];actor=binding.get('actor_code') or ACTOR_BY_GROUP.get(group['menuCode']) or ACTOR_BY_ROOT.get(group['parentCode'],'PLATFORM_OPERATOR');route=cap.get('url') or '';route_exact=cap.get('routeTrace',{}).get('routeMatch')=='EXACT';status='VERIFIED' if route_exact and cap.get('bindings') and cap.get('screenBlueprints') else ('PARTIAL' if route or cap.get('bindings') else 'UNRESOLVED')
   steps.append({'stepCode':cap['menuCode'],'stepOrder':i,'stepName':cap['name'],'actorCode':actor,'fromState':'READY' if i==1 else f'S{i-1:02d}_DONE','toState':f'S{i:02d}_DONE','commandCode':f"OPEN_{cap['menuCode']}",'screenCode':bp.get('page_id') or route or 'UNRESOLVED','apiCode':binding.get('api_contract') or 'UNRESOLVED','implementationStatus':status,'implementationEvidence':{'menuCode':cap.get('sourceMenuCode') or cap['menuCode'],'routeMatch':cap.get('routeTrace',{}).get('routeMatch','NONE'),'bindingCount':len(cap.get('bindings') or []),'blueprintCount':len(cap.get('screenBlueprints') or [])},'completionRules':['routeResolved','businessActionVerified','auditEvidenceProduced'],'failureTransitions':['ROUTE_MISSING','AUTHORITY_DENIED','CONTRACT_MISSING'],'rollbackCommand':f"RETURN_{cap['menuCode']}"})
  processes.append({'processCode':group['menuCode'],'processName':group['name'],'domainCode':f"{group['parentCode']} {roots.get(group['parentCode'],{}).get('name','')}",'ownerActorCode':ACTOR_BY_GROUP.get(group['menuCode']) or ACTOR_BY_ROOT.get(group['parentCode'],'PLATFORM_OPERATOR'),'participantActorCodes':[],'modelType':'IMPLEMENTED_CANONICAL','source':'CURRENT_SYSTEM_DB_MENU','steps':steps})
  all_steps.extend(steps)
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
 design_codes={p['processCode'] for p in designed};mapped=set(DESIGN_TO_IMPLEMENTED);missing_mapping=sorted(design_codes-mapped)
 unresolved_targets=sorted({target for vals in DESIGN_TO_IMPLEMENTED.values() for target in vals if target not in groups})
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
 canonical_tests += [t for t in tests if t['processCode'] in {p['processCode'] for p in additions}]
 duplicate_codes=sorted({p['processCode'] for p in processes if sum(x['processCode']==p['processCode'] for x in processes)>1})
 empty=sorted(p['processCode'] for p in processes if not p['steps'])
 all_steps=[s for p in processes for s in p['steps']]
 too_small=sorted(p['processCode'] for p in processes if len(p['steps'])<3);too_large=sorted(p['processCode'] for p in processes if len(p['steps'])>12)
 added_codes={p['processCode'] for p in additions};unmapped_not_added=sorted(set(missing_mapping)-added_codes)
 stats={'canonicalProcesses':len(processes),'implementedProcesses':len(implemented['subprocesses']),'newRequiredProcesses':len(additions),'canonicalSteps':len(all_steps),'canonicalScenarios':len(canonical_tests),'designProcessesReusedThroughExisting':len(mapped & design_codes),'designProcessesAddedAsNew':len(added_codes),'unmappedDesignProcesses':len(unmapped_not_added),'unresolvedMappingTargets':len(unresolved_targets),'duplicateProcessCodes':len(duplicate_codes),'emptyProcesses':len(empty),'processesBelowComplexityFloor':len(too_small),'processesAboveComplexityCeiling':len(too_large)}
 validation={'duplicateProcessCodes':duplicate_codes,'emptyProcesses':empty,'unmappedDesignProcesses':unmapped_not_added,'unresolvedMappingTargets':unresolved_targets,'processesBelowComplexityFloor':too_small,'processesAboveComplexityCeiling':too_large}
 validation['status']='PASSED' if not any(validation.values()) else 'FAILED'
 actor_map={a['actorCode']:a for a in designed_actors}
 for row in runtime_db.get('actors',[]):
  code=row['actor_code'];actor_map.setdefault(code,{'actorCode':code,'actorName':row['actor_name'],'actorType':row['actor_type'],'purpose':row['purpose'],'source':'CURRENT_SYSTEM_DB'})
 used_actors={p['ownerActorCode'] for p in processes}|{a for p in processes for a in p.get('participantActorCodes',[])}|{s['actorCode'] for p in processes for s in p['steps']}
 validation.pop('status',None);validation['unknownActorCodes']=sorted(used_actors-set(actor_map));validation['unusedDesignedActorCodes']=sorted(set(actor_map)-used_actors);validation['status']='PASSED' if not any(validation.values()) else 'FAILED'
 stats['canonicalActors']=len(actor_map);stats['usedActors']=len(used_actors);stats['unusedActors']=len(validation['unusedDesignedActorCodes'])
 model={'stats':stats,'actors':list(actor_map.values()),'processes':processes,'tests':canonical_tests,'designTrace':DESIGN_TO_IMPLEMENTED,'newProcessCodes':[p['processCode'] for p in additions],'validation':validation}
 (args.out/'canonical-process-model.json').write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 lines=['# 기개발 우선 정규 프로세스 모델','','기개발 중메뉴 프로세스를 기준으로 유지하고 신규 전문 설계는 기존 프로세스에 추적 연결합니다. 대응 프로세스가 없는 업무만 같은 레벨로 신규 추가합니다.','','## 검증']+[f'- {k}: {v:,}' for k,v in stats.items()]+['',f"- status: {model['validation']['status']}",'','## 신규 필요 프로세스']+[f"- {p['processCode']}: {p['processName']}" for p in additions]
 (args.out/'canonical-process-model.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 print(json.dumps({'stats':stats,'validation':model['validation']},ensure_ascii=False))
if __name__=='__main__':main()
