#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import json, html, re, sys, zipfile, hashlib

snap_path=Path(sys.argv[1]); out=Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
snap=json.loads(snap_path.read_text(encoding='utf-8'))
def rows(name):
    result=[]
    for item in snap.get('asset_rows',{}).get(name,[]):
        raw=item.get('row_json',item) if isinstance(item,dict) else item
        try: result.append(json.loads(raw) if isinstance(raw,str) else raw)
        except: pass
    return result
defs=[x for x in rows('framework_process_definition') if x.get('domain_code')=='MEMBER' and x.get('process_code')!='MEMBER_LIFECYCLE']
defs.sort(key=lambda x:(x.get('development_order') or 9999,x.get('process_code','')))
steps=rows('framework_process_step'); edges=rows('framework_process_flow_edge'); tasks=rows('framework_task_definition'); handoffs=rows('framework_process_data_handoff')
contracts=[]
for x in snap.get('screen_contracts',[]):
    raw=x.get('row_json',x) if isinstance(x,dict) else x
    try: contracts.append(json.loads(raw) if isinstance(raw,str) else raw)
    except: pass
def esc(v): return html.escape('' if v is None else str(v))
def table(items,cols=None):
    if not items:return '<p class="empty">현재 원장에 등록된 항목이 없습니다. 후속 설계 시 등록 및 검증이 필요합니다.</p>'
    cols=cols or list(dict.fromkeys(k for r in items for k in r))[:10]
    return '<table><thead><tr>'+''.join(f'<th>{esc(c)}</th>' for c in cols)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{esc(r.get(c,""))}</td>' for c in cols)+'</tr>' for r in items)+'</tbody></table>'
def raw(v): return '<pre>'+esc(json.dumps(v,ensure_ascii=False,indent=2,default=str))+'</pre>'
chapters=[('overview','설계 개요'),('requirements','요구사항 추적'),('actors','액터 정의'),('usecases','유즈케이스 명세'),('bpmn','BPMN 업무흐름'),('scenarios','시나리오 명세'),('rules','비즈니스 규칙'),('conceptual','개념 데이터'),('logical','논리 데이터'),('physical','물리 데이터'),('tables','테이블 정의'),('screens','화면 목록'),('wireframes','화면 구조'),('ui','UI 상세'),('flow','화면 흐름'),('api','API 설계'),('security','보안·권한'),('tests','테스트 계획'),('results','테스트 결과'),('recovery','배포·복구')]
generated=[]
for idx,d in enumerate(defs,1):
    code=d['process_code']; name=d['process_name']; ps=[x for x in steps if x.get('process_code')==code]; ps.sort(key=lambda x:(x.get('step_order') or 9999,x.get('step_code','')))
    pe=[x for x in edges if x.get('process_code')==code]; pt=[x for x in tasks if x.get('process_code')==code]; ph=[x for x in handoffs if x.get('process_code')==code]
    pc=[x for x in contracts if x.get('process_code')==code or x.get('processCode')==code]
    route_keys=['route_path','routePath','user_route','admin_route']; routes=[]
    for c in pc:
        for k in route_keys:
            if c.get(k) and c[k] not in routes: routes.append(c[k])
    flow='<div class="flow">'+''.join(f'<div><b>{i+1}. {esc(s.get("step_name") or s.get("step_code"))}</b><small>{esc(s.get("step_code"))}</small></div><i>→</i>' for i,s in enumerate(ps))+'<div class="done">완료</div></div>'
    common=f'<p><b>프로세스:</b> {esc(name)} ({esc(code)})</p><p><b>작성 기준:</b> {esc(snap.get("captured_at"))} 실서버 설계 원장 · 단계 {len(ps)}개 · 화면 계약 {len(pc)}개 · 라우트 {len(routes)}개</p>'
    body={
      'overview':common+table([d]),
      'requirements':common+f'<ul><li>목표: {esc(d.get("goal"))}</li><li>시작 조건: {esc(d.get("start_condition"))}</li><li>완료 조건: {esc(d.get("completion_condition"))}</li><li>상태: {esc(d.get("process_status"))}</li><li>위험도/SLA: {esc(d.get("risk_level"))} / {esc(d.get("sla_hours"))}시간</li></ul>',
      'actors':common+table(ps,['step_code','step_name','owner_actor_code','required_actor_code','requires_user_page','requires_admin_page']),
      'usecases':common+table(ps,['step_order','step_code','step_name','purpose','completion_rule','next_step_code']),
      'bpmn':common+flow+table(pe),
      'scenarios':common+table(pt)+raw([x for x in ps if x.get('test_contract')]),
      'rules':common+raw([{'step':x.get('step_code'),'completion':x.get('completion_rule'),'business':x.get('business_rules')} for x in ps]),
      'conceptual':common+'<div class="er"><b>회원·기관</b><i>1:N</i><b>프로세스</b><i>1:N</i><b>단계·업무·증빙</b></div>'+table(ph),
      'logical':common+table(ph)+raw([{'process':code,'steps':[x.get('step_code') for x in ps],'tasks':[x.get('task_code') for x in pt]}]),
      'physical':common+raw([{'step':x.get('step_code'),'persistence':x.get('persistence_contract'),'input':x.get('input_contract'),'output':x.get('output_contract')} for x in ps]),
      'tables':common+table(ph)+raw({'candidate_tables':[x for x in snap.get('candidate_tables',[]) if any(t in str(x).lower() for t in ('member','user','company','authority'))][:30]}),
      'screens':common+table(pc,['contract_id','step_code','screen_name','route_path','actor_code','audience','readiness_status']),
      'wireframes':common+'<div class="wire"><header>KRDS 공통 헤더</header><aside>업무 길잡이</aside><main>제목·검색/입력·결과 표·처리 버튼</main><footer>도움말 · 화면 설계 · QA · 다음 업무</footer></div>'+table([{'route':r,'purpose':'해당 단계 업무 수행','responsive':'360/768/1440'} for r in routes]),
      'ui':common+raw(pc),
      'flow':common+flow+table(pe),
      'api':common+raw([{'step':x.get('step_code'),'api':x.get('api_contract'),'command':x.get('command_contract')} for x in ps]),
      'security':common+raw([{'step':x.get('step_code'),'actor':x.get('actor_contract'),'authority':x.get('authority_contract'),'data_scope':x.get('data_scope')} for x in ps]),
      'tests':common+table([{'번호':f'TC-{i+1:03}','단계':x.get('step_code'),'유형':'정상·예외·권한·격리·복구','검증':'화면→API→DB→다음 액터','판정기준':'기대 출력 및 상태 일치'} for i,x in enumerate(ps)]),
      'results':common+'<p class="warn">이 문서는 설계 원장 기준 자동 산출물입니다. 실제 브라우저·API·DB 릴레이 증거가 없는 항목은 PASS로 간주하지 않습니다.</p>'+raw([{'step':x.get('step_code'),'status':x.get('validation_status'),'evidence':x.get('evidence_ref')} for x in ps]),
      'recovery':common+'<ol><li>현재 설계·DB·화면 자산 체크섬 백업</li><li>설계 원장 변경 및 생성기 실행</li><li>목차·본문·라우트·ZIP 무결성 검사</li><li>페이지/API/DB/액터 릴레이 회귀시험</li><li>실패 시 최신 정상본과 백업 SQL로 복구</li></ol>'+raw({'source_snapshot':str(snap_path),'process_version':d.get('process_version'),'definition_locked':d.get('definition_locked')})
    }
    toc=''.join(f'<li><a href="#{k}">{i+1:02}. {esc(t)}</a></li>' for i,(k,t) in enumerate(chapters))
    sections=''.join(f'<section id="{k}"><h2>{i+1:02}. {esc(t)}</h2>{body[k]}<p><a href="#top">목차로</a></p></section>' for i,(k,t) in enumerate(chapters))
    css='''body{font-family:Arial,"Malgun Gothic";margin:0;background:#f3f6f9;color:#172b4d;line-height:1.55;overflow-x:hidden}header.cover{background:#07366c;color:#fff;padding:42px 6%}.layout{max-width:1380px;margin:auto;padding:24px;min-width:0}.toc,section{background:#fff;border:1px solid #cfdae6;border-radius:10px;padding:26px;margin:22px 0;min-width:0;overflow:hidden}.toc ol{columns:2}.toc a{color:#075bc8}h2{border-bottom:3px solid #1769d2;padding-bottom:10px;color:#07366c}table{width:100%;max-width:100%;border-collapse:collapse;font-size:13px;display:block;overflow-x:auto}th,td{border:1px solid #c8d5e2;padding:8px;vertical-align:top;overflow-wrap:anywhere}th{background:#e8f2ff}pre{white-space:pre-wrap;word-break:break-word;background:#f6f8fa;padding:14px;max-height:520px;max-width:100%;overflow:auto}.flow{display:flex;gap:8px;align-items:center;max-width:100%;overflow-x:auto}.flow div{min-width:160px;border:1px solid #1670df;background:#eaf3ff;padding:14px}.flow small{display:block}.done{border-color:#009b68!important}.er{display:flex;justify-content:center;gap:20px;padding:30px;background:#eef5fc}.wire{display:grid;grid-template-columns:1fr 3fr;gap:8px;border:2px solid #456;padding:12px}.wire header,.wire footer{grid-column:1/-1}.wire>*{border:1px solid #9fb2c5;padding:20px}.warn{border-left:5px solid #d92d20;background:#fff1f0;padding:16px}@media(max-width:700px){.layout{padding:10px}.toc ol{columns:1}.flow,.er{display:block}.wire{grid-template-columns:1fr}}'''
    doc=f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>{esc(name)} 상세설계서</title><style>{css}</style></head><body id="top"><header class="cover"><h1>{idx:02}. {esc(name)}</h1><p>{esc(code)} · 자동 생성 통합 상세설계서</p></header><main class="layout"><nav class="toc"><h2>목차 20종</h2><ol>{toc}</ol></nav>{sections}</main></body></html>'
    fn=f'{idx:02}_{re.sub(r"[^0-9A-Za-z가-힣_-]+","_",name)}_{code}.html'; (out/fn).write_text(doc,encoding='utf-8'); generated.append({'order':idx,'code':code,'name':name,'file':fn,'steps':len(ps),'screens':len(pc),'routes':len(routes)})
index='<html lang="ko"><meta charset="utf-8"><title>회원 도메인 프로세스 설계</title><style>body{font-family:Arial,"Malgun Gothic";max-width:1200px;margin:40px auto}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:10px}th{background:#e8f2ff}</style><h1>회원 도메인 프로세스 통합 설계 목록</h1><p>상위 묶음 MEMBER_LIFECYCLE를 제외한 상세 프로세스 전수입니다.</p>'+table(generated,['order','code','name','steps','screens','routes','file']).replace('<td>','<td>',1)+'<ul>'+''.join(f'<li><a href="{esc(x["file"])}">{x["order"]:02}. {esc(x["name"])}</a></li>' for x in generated)+'</ul></html>'
(out/'00_index.html').write_text(index,encoding='utf-8')
manifest={'generatedAt':datetime.now().astimezone().isoformat(),'sourceSnapshot':str(snap_path),'processCount':len(generated),'chapterCountPerProcess':20,'documents':generated}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
zip_path=out.parent/(out.name+'.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    for p in out.rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(out.parent))
with zipfile.ZipFile(zip_path) as z: assert z.testzip() is None
assert len(generated)==len(defs) and all(x['steps']>0 for x in generated)
print(json.dumps({'processes':len(generated),'html':len(list(out.glob('*.html'))),'zip':str(zip_path),'bytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest()},ensure_ascii=False))
