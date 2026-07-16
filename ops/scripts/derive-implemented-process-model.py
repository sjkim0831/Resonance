#!/usr/bin/env python3
"""Derive the implemented domain/subprocess/capability hierarchy from DB menus."""
from __future__ import annotations
import argparse,json
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/architecture/executable-webapp/generated'
TEST_FAMILIES=['HAPPY_PATH','VALIDATION','AUTHORITY','ISOLATION','STATE','IDEMPOTENCY','CONCURRENCY','DEADLINE','INTEGRATION','PRIVACY','AUDIT','RECOVERY','ACCESSIBILITY']

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--db',type=Path,default=OUT/'runtime-db-inventory.json');ap.add_argument('--trace',type=Path,default=OUT/'current-system-trace.json');ap.add_argument('--out',type=Path,default=OUT);args=ap.parse_args()
 db=json.loads(args.db.read_text(encoding='utf-8-sig')); trace=json.loads(args.trace.read_text(encoding='utf-8-sig'))
 route_trace={x['menuCode']:x for x in trace['menuTraces']}; orders={x['menu_code']:x['sort_ordr'] for x in db.get('menuOrders',[])}
 bindings=defaultdict(list)
 for row in db.get('menuProcessBindings',[]):bindings[row['menu_code']].append(row)
 blueprints=defaultdict(list)
 for row in db.get('screenBlueprints',[]):blueprints[row.get('route_path') or ''].append(row)
 menus={m['code']:m for m in db['menus'] if m.get('useAt')=='Y'}
 roots=[]; groups=[]; capabilities=[]; orphans=[]
 for code,menu in sorted(menus.items(),key=lambda kv:(orders.get(kv[0],999999999),kv[0])):
  rec={'menuCode':code,'name':menu.get('name'),'url':menu.get('url'),'visible':menu.get('exposureAt') in {None,'Y'},'sortOrder':orders.get(code),'bindings':bindings.get(code,[]),'routeTrace':route_trace.get(code,{}),'screenBlueprints':blueprints.get(menu.get('url') or '',[])}
  if len(code)==4:roots.append(rec)
  elif len(code)==6:
   rec['parentCode']=code[:4];groups.append(rec)
   if code[:4] not in menus:orphans.append({'type':'GROUP_WITHOUT_ROOT','code':code})
  else:
   parent=code[:6] if len(code)>=8 else code[:4];rec['parentCode']=parent;capabilities.append(rec)
   if parent not in menus:orphans.append({'type':'CAPABILITY_WITHOUT_GROUP','code':code,'expectedParent':parent})
 root_map={r['menuCode']:r for r in roots};group_map={g['menuCode']:g for g in groups}
 for r in roots:r['subprocessCodes']=[]
 for g in groups:
  g['capabilityCodes']=[]
  if g['parentCode'] in root_map:root_map[g['parentCode']]['subprocessCodes'].append(g['menuCode'])
 for c in capabilities:
  if c['parentCode'] in group_map:group_map[c['parentCode']]['capabilityCodes'].append(c['menuCode'])
 for g in groups:
  if not g['capabilityCodes']:
   self_code=g['menuCode']+'_SELF'
   capabilities.append({'menuCode':self_code,'sourceMenuCode':g['menuCode'],'name':g['name'],'url':g['url'],'visible':g['visible'],'sortOrder':g['sortOrder'],'bindings':g['bindings'],'routeTrace':g['routeTrace'],'screenBlueprints':g['screenBlueprints'],'parentCode':g['menuCode'],'derivedReason':'MID_MENU_IS_EXECUTABLE_LEAF'})
   g['capabilityCodes'].append(self_code)
 scenario_candidates=[]
 for cap in capabilities:
  for family in TEST_FAMILIES:
   scenario_candidates.append({'caseCode':f"TC_IMPL_{cap['menuCode']}_{family}",'processCode':cap['parentCode'],'capabilityCode':cap['menuCode'],'caseType':family,'variant':'IMPLEMENTATION_AUDIT','severity':'CRITICAL' if family in {'AUTHORITY','ISOLATION','PRIVACY','AUDIT'} else 'MAJOR','status':'CANDIDATE_REQUIRES_CONTRACT_BINDING','given':['implementedMenuAndRoute','syntheticTenantProjectActorContext'],'when':{'menuUrl':cap.get('url'),'menuCode':cap['menuCode']},'then':['routeAndScreenResolve','authorizedDataScopeOnly','businessActionTraceable','auditEvidenceProduced']})
 stats={'implementedDomains':len(roots),'implementedSubprocesses':len(groups),'implementedCapabilities':len(capabilities),'visibleCapabilities':sum(c['visible'] for c in capabilities),'boundCapabilities':sum(bool(c['bindings']) for c in capabilities),'exactRouteCapabilities':sum(c['routeTrace'].get('routeMatch')=='EXACT' for c in capabilities),'blueprintedCapabilities':sum(bool(c['screenBlueprints']) for c in capabilities),'scenarioCandidates':len(scenario_candidates),'orphanHierarchyNodes':len(orphans)}
 model={'stats':stats,'domains':roots,'subprocesses':groups,'capabilities':capabilities,'scenarioCandidates':scenario_candidates,'hierarchyGaps':orphans}
 (args.out/'implemented-process-model.json').write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 lines=['# 기개발 시스템 업무 모델','','메뉴를 구현 증거로 사용하여 대메뉴=업무영역, 중메뉴=서브프로세스, 소메뉴=업무 기능 후보로 도출했습니다. 화면·API·DB 연결 확정 전에는 프로세스 완료로 간주하지 않습니다.','','## 계수','']+[f'- {k}: {v:,}' for k,v in stats.items()]+['','## 업무 영역과 서브프로세스','']
 for root in roots:
  lines.append(f"### {root['name']} (`{root['menuCode']}`)")
  for code in root['subprocessCodes']:
   group=group_map[code];lines.append(f"- {group['name']} (`{code}`): 기능 {len(group['capabilityCodes'])}개")
  lines.append('')
 (args.out/'implemented-process-model.md').write_text('\n'.join(lines),encoding='utf-8')
 print(json.dumps(stats,ensure_ascii=False))
if __name__=='__main__':main()
