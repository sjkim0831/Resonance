#!/usr/bin/env python3
"""Inventory the implemented system and produce evidence-backed trace candidates."""
from __future__ import annotations
import argparse,json,re,hashlib
from collections import Counter,defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/architecture/executable-webapp/generated'
FRONT=ROOT/'projects/carbonet-frontend/source/src'
JAVA_ROOTS=[ROOT/'apps',ROOT/'modules/resonance-common']

PATH_RE=re.compile(r'''["'`](/(?:admin|en|emission|home|monitoring|mypage|api|co2|payment|report|certificate|education|support|trade|lca|reduction|external|content|system)[^"'`\s?#]*)''',re.I)
JAVA_MAP_RE=re.compile(r'@(RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*\(([^)]*)\)',re.S)
JAVA_PATH_RE=re.compile(r'''["']([^"']+)["']''')

DOMAIN_WORDS={
 'IDENTITY':['member','login','auth','join','account','company','회원','기업','권한','인증'],
 'EMISSION':['emission','activity','factor','배출','활동자료','계수'],
 'LCA':['lca','lci','inventory','survey','전과정','물질'],
 'REDUCTION':['reduction','감축'], 'MONITORING':['monitoring','dashboard','statistics','모니터링','통계'],
 'CCUS':['ccus','capture','transport','storage','utilization','포집','수송','저장','활용'],
 'TRADE':['trade','matching','supply','demand','거래','공급','수요'],
 'PAYMENT':['payment','settlement','refund','tax','결제','정산','환불'],
 'CERTIFICATE':['certificate','verify','인증서','진위'], 'CONTENT':['content','education','board','faq','교육','게시'],
 'PLATFORM':['admin','system','menu','builder','deploy','audit','관리','시스템','메뉴'],
}

def load_json(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def read_text(path):
 try:return path.read_text(encoding='utf-8',errors='ignore')
 except OSError:return ''
def domains(text):
 t=text.lower();return sorted(d for d,words in DOMAIN_WORDS.items() if any(w.lower() in t for w in words))
def file_hash(path):
 try:return hashlib.sha256(path.read_bytes()).hexdigest()
 except OSError:return ''

def frontend_inventory():
 files=[p for p in FRONT.rglob('*') if p.is_file() and p.suffix.lower() in {'.ts','.tsx','.js','.jsx','.json'}]
 pages=[]; routes={}
 for path in files:
  rel=path.relative_to(ROOT).as_posix(); text=read_text(path)
  found=sorted(set(PATH_RE.findall(text)))
  for route in found:routes.setdefault(route,[]).append(rel)
  if path.name.endswith('Page.tsx') or path.name.endswith('Pages.tsx'):
   pages.append({'sourcePath':rel,'componentName':path.stem,'routes':found,'domains':domains(rel+' '+text[:4000]),'sha256':file_hash(path)})
 return {'fileCount':len(files),'pages':pages,'routes':[{'route':k,'sources':v} for k,v in sorted(routes.items())]}

def java_inventory():
 controllers=[]; endpoints=[]
 for root in JAVA_ROOTS:
  if not root.exists():continue
  for path in root.rglob('*.java'):
   text=read_text(path)
   if '@Controller' not in text and '@RestController' not in text:continue
   rel=path.relative_to(ROOT).as_posix(); cls=path.stem
   controllers.append({'className':cls,'sourcePath':rel,'domains':domains(rel+' '+text[:5000])})
   for match in JAVA_MAP_RE.finditer(text):
    annotation,args=match.groups(); vals=JAVA_PATH_RE.findall(args) or ['']
    for value in vals:
     if value.startswith('/') or value=='':endpoints.append({'controller':cls,'annotation':annotation,'pathFragment':value,'sourcePath':rel,'domains':domains(rel+' '+value)})
 return {'controllers':controllers,'endpoints':endpoints}

def references(path):
 rows=[]
 if not path.exists():return rows
 for line in path.read_text(encoding='utf-8-sig').splitlines():
  if line.strip():
   item=json.loads(line); item['domains']=domains(item.get('sourcePath','')); rows.append(item)
 return rows

def trace(db,front,java,refs):
 route_set={r['route'] for r in front['routes']}; api_paths={e['pathFragment'] for e in java['endpoints'] if e['pathFragment']}
 traces=[]
 for menu in db.get('menus',[]):
  url=(menu.get('url') or '').split('?')[0].rstrip('/') or '/'
  exact=url in route_set
  source_candidates=sorted({s for r in front['routes'] if r['route']==url for s in r['sources']})
  prefix_api=sorted(p for p in api_paths if p and (p.startswith(url) or url.startswith(p)))[:20]
  traces.append({'menuCode':menu.get('code'),'menuName':menu.get('name'),'menuUrl':menu.get('url'),'visible':menu.get('useAt')=='Y' and (menu.get('exposureAt') in {None,'Y'}),'routeMatch':'EXACT' if exact else 'UNRESOLVED_DYNAMIC_OR_MISSING','frontendSources':source_candidates,'apiCandidates':prefix_api,'domains':domains(f"{menu.get('name','')} {url}")})
 return traces

def report(summary,gaps,path):
 lines=['# 현행 시스템 전수조사 보고서','','> 자동 수집 시점의 구현 자산 기준입니다. 동적 라우팅과 런타임 생성 항목은 후보 연결로 분리합니다.','', '## 자산 계수','']
 for key,value in summary.items(): lines.append(f'- {key}: {value:,}' if isinstance(value,int) else f'- {key}: {value}')
 lines+=['','## 자동 판정','',f"- URL 정확 일치 메뉴: {gaps['exactMenuRoutes']:,}",f"- 동적 또는 미해결 메뉴 URL: {gaps['unresolvedMenuRoutes']:,}",f"- 라우트 미연결 페이지 컴포넌트: {gaps['pagesWithoutLiteralRoute']:,}",f"- 파일명 기준 미분류 레퍼런스: {gaps['unclassifiedReferences']:,}",'','## 주의','','미해결은 곧 미구현을 뜻하지 않습니다. DB 라우트, 동적 레지스트리, 공통 컨트롤러와 SDUI가 존재할 수 있으므로 다음 단계에서 런타임 호출과 메뉴 선택 테스트로 확정해야 합니다.','']
 path.write_text('\n'.join(lines),encoding='utf-8')

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--db',type=Path,default=OUT/'runtime-db-inventory.json');ap.add_argument('--references',type=Path,default=OUT/'reference-inventory.jsonl');ap.add_argument('--out',type=Path,default=OUT);args=ap.parse_args()
 db=load_json(args.db); front=frontend_inventory(); java=java_inventory(); refs=references(args.references); traces=trace(db,front,java,refs)
 exact=sum(t['routeMatch']=='EXACT' for t in traces); gaps={'exactMenuRoutes':exact,'unresolvedMenuRoutes':len(traces)-exact,'pagesWithoutLiteralRoute':sum(not p['routes'] for p in front['pages']),'unclassifiedReferences':sum(not r['domains'] for r in refs)}
 summary={'menus':len(db.get('menus',[])),'visibleMenus':sum(t['visible'] for t in traces),'menuProcessBindings':len(db.get('menuProcessBindings',[])),'screenBlueprints':len(db.get('screenBlueprints',[])),'dbActors':len(db.get('actors',[])),'dbProcesses':len(db.get('processes',[])),'dbSteps':len(db.get('steps',[])),'dbScenarios':len(db.get('cases',[])),'databaseTablesAndViews':len(db.get('tables',[])),'databaseColumns':len(db.get('columns',[])),'databaseRoutines':len(db.get('routines',[])),'frontendSourceFiles':front['fileCount'],'frontendPageComponents':len(front['pages']),'routeLiterals':len(front['routes']),'javaControllers':len(java['controllers']),'javaEndpointAnnotations':len(java['endpoints']),'referenceAssets':len(refs)}
 args.out.mkdir(parents=True,exist_ok=True)
 (args.out/'current-system-inventory.json').write_text(json.dumps({'summary':summary,'database':db,'frontend':front,'java':java,'references':refs},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 (args.out/'current-system-trace.json').write_text(json.dumps({'menuTraces':traces,'gaps':gaps},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 report(summary,gaps,args.out/'current-system-audit.md')
 print(json.dumps({'summary':summary,'gaps':gaps},ensure_ascii=False))
if __name__=='__main__':main()
