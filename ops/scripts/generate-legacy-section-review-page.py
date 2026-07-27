#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    records = payload.get("items", [])
    embedded = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    cards = []
    for item in records:
        source_family = item.get("sourceFamily", item.get("source_family", ""))
        language_code = item.get("languageCode", item.get("language_code", "ko"))
        screen_name = item.get("screenName", item.get("screen_name", ""))
        source_path = item.get("sourcePath", item.get("source_path", ""))
        proposed_decision = item.get(
            "proposedDecision", item.get("proposed_decision", "")
        )
        match_score = item.get("matchScore", item.get("match_score", 0))
        route = item.get("currentRoute", item.get("current_route", "")) or ""
        current_name = item.get(
            "currentScreenName", item.get("current_screen_name", "")
        )
        reference_id = item.get("referenceId", item.get("reference_id", ""))
        sections = item.get("sections") or []
        badges = "".join(
            f'<div class="section-row"><span class="badge">{html.escape(section["sectionName"])} '
            f'<b>{float(section["confidence"]):.0%}</b></span>'
            f'<button data-review="APPROVE" data-ref="{html.escape(reference_id)}" '
            f'data-section="{html.escape(section["sectionId"])}">승인</button>'
            f'<button data-review="REJECT" data-ref="{html.escape(reference_id)}" '
            f'data-section="{html.escape(section["sectionId"])}">반려</button></div>'
            for section in sections
        )
        cards.append(
            f"""
            <article class="card" data-family="{html.escape(source_family)}"
              data-status="{html.escape(proposed_decision)}">
              <div class="meta">
                <span>{html.escape(source_family)}</span>
                <span>{html.escape(language_code.upper())}</span>
                <span>화면 유사도 {float(match_score):.1%}</span>
              </div>
              <h2>{html.escape(screen_name)}</h2>
              <p class="path">{html.escape(source_path)}</p>
              <div class="target">
                <strong>현재 후보 화면</strong>
                <a href="{html.escape(route)}">{html.escape(current_name)} · {html.escape(route)}</a>
              </div>
              <div class="badges">{badges}</div>
              <label>검토 사유<input class="reason" placeholder="승인·반려 사유를 입력하세요"></label>
              <div class="actions">
                <button data-copy="{html.escape(reference_id)}">참조 ID 복사</button>
                <span>승인 시 설계 연결만 생성 · 실제 화면 적용 안 함</span>
              </div>
            </article>
            """
        )

    document = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>과거 홈페이지 공통 섹션 검토</title>
<style>
:root{{--krds-primary:#246beb;--text:#1d1d1d;--muted:#555;--line:#d8dce5;--bg:#f4f6f8}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bg);color:var(--text);
font-family:"Pretendard GOV","Noto Sans KR",sans-serif;font-size:16px;line-height:1.55}}
header{{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--line);
padding:20px clamp(16px,4vw,48px)}} header h1{{margin:0;font-size:clamp(24px,3vw,36px)}}
header p{{margin:6px 0 0;color:var(--muted)}} .toolbar{{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}}
input,select,button{{min-height:44px;border:1px solid #9ca3af;border-radius:8px;background:#fff;padding:0 12px;font:inherit}}
input{{flex:1;min-width:220px}} main{{max-width:1440px;margin:auto;padding:24px clamp(16px,4vw,48px)}}
.summary{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}}
.metric,.card{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px}}
.metric b{{display:block;font-size:26px;color:#123b72}} .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}}
.meta,.badges,.actions{{display:flex;gap:8px;flex-wrap:wrap;align-items:center}} .meta span,.badge{{background:#edf3ff;border-radius:999px;padding:5px 9px;font-size:13px}}
.badges{{display:grid}} .section-row{{display:flex;gap:8px;align-items:center;flex-wrap:wrap}} label{{display:grid;gap:4px;margin-top:12px}}
.card h2{{font-size:20px;margin:14px 0 4px}} .path{{font-size:13px;color:var(--muted);overflow-wrap:anywhere}}
.target{{display:grid;gap:4px;border-left:4px solid var(--krds-primary);padding:10px 12px;margin:14px 0;background:#f7faff}}
a{{color:#174ea6;overflow-wrap:anywhere}} .actions{{margin-top:16px;justify-content:space-between}} .actions span{{font-size:13px;color:var(--muted)}}
button{{cursor:pointer}} button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{{outline:3px solid #ffbf47;outline-offset:2px}}
@media(max-width:640px){{.grid{{grid-template-columns:1fr}} header{{position:static}} .actions{{align-items:stretch}} .actions button{{width:100%}}}}
</style>
</head>
<body>
<header><h1>과거 홈페이지 공통 섹션 검토</h1>
<p>현재 화면을 변경하지 않는 1차 설계 연결 검토입니다.</p>
<div class="toolbar"><input id="query" aria-label="화면 검색" placeholder="화면명·경로 검색">
<select id="family" aria-label="화면 분류"><option value="">전체 분류</option></select></div></header>
<main><section class="summary" aria-label="검토 현황">
<div class="metric"><span>참고 화면</span><b>{len(records)}</b></div>
<div class="metric"><span>섹션 후보</span><b>{payload.get("sectionCandidateCount",0)}</b></div>
<div class="metric"><span>승인</span><b>{payload.get("approvedCount",0)}</b></div>
<div class="metric"><span>실제 적용</span><b>{payload.get("appliedCount",0)}</b></div>
</section><section class="grid" id="grid">{"".join(cards)}</section></main>
<script type="application/json" id="review-data">{embedded}</script>
<script>
const cards=[...document.querySelectorAll('.card')],q=document.querySelector('#query'),f=document.querySelector('#family');
[...new Set(cards.map(x=>x.dataset.family))].sort().forEach(x=>f.add(new Option(x,x)));
function filter(){{const s=q.value.toLowerCase();cards.forEach(x=>x.hidden=!((!f.value||x.dataset.family===f.value)&&x.textContent.toLowerCase().includes(s)))}}
q.addEventListener('input',filter);f.addEventListener('change',filter);
document.addEventListener('click',async e=>{{const v=e.target.dataset.copy;if(!v)return;await navigator.clipboard.writeText(v);e.target.textContent='복사됨';}});
document.addEventListener('click',async e=>{{if(!e.target.dataset.review)return;const card=e.target.closest('.card'),reason=card.querySelector('.reason').value.trim();
if(reason.length<5){{alert('검토 사유를 5자 이상 입력하세요.');return}}e.target.disabled=true;
try{{const r=await fetch(`/api/admin/legacy-section-review/${{encodeURIComponent(e.target.dataset.ref)}}/${{encodeURIComponent(e.target.dataset.section)}}`,{{method:'POST',credentials:'same-origin',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{action:e.target.dataset.review,reason}})}});const j=await r.json();if(!r.ok)throw new Error(j.message||'처리 실패');e.target.parentElement.dataset.status=j.resultingStatus;e.target.textContent=j.resultingStatus;}}catch(err){{alert(err.message);e.target.disabled=false}}}});
</script></body></html>"""
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(document, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
