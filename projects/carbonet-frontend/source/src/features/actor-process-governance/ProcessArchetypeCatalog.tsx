import { useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Props = {
  archetypes: Row[];
  bindings: Row[];
  blueprints: Row[];
  busy: boolean;
  onBind: (body: Record<string, unknown>) => Promise<void>;
};

const text = (row: Row | undefined, key: string) => String(row?.[key] ?? "");
const routeKey = (route: string) => route.split("?")[0].replace(/\/+$/, "") || "/";
const categoryNames: Record<string,string> = {
  IDENTITY:"계정·권한", PROJECT:"프로젝트", DATA:"자료 수집", QUALITY:"검증·품질",
  CALCULATION:"산정", COLLABORATION:"협업", APPROVAL:"검토·승인", REPORT:"보고",
  CERTIFICATE:"인증", OPERATIONS:"운영·복구",
};

export function ProcessArchetypeCatalog({ archetypes, bindings, blueprints, busy, onBind }: Props) {
  const [category, setCategory] = useState("ALL");
  const [selectedCode, setSelectedCode] = useState(text(archetypes[0],"archetypeCode"));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [role, setRole] = useState("PRIMARY");
  const pageSize = 50;
  const categories = useMemo(() => [...new Set(archetypes.map(row=>text(row,"categoryCode")).filter(Boolean))], [archetypes]);
  const filteredArchetypes = useMemo(() => archetypes.filter(row => category==="ALL" || text(row,"categoryCode")===category), [archetypes,category]);
  const selected = archetypes.find(row=>text(row,"archetypeCode")===selectedCode) ?? filteredArchetypes[0];
  const screens = useMemo(() => {
    const needle=query.trim().toLocaleLowerCase("ko-KR");
    const unique=new Map<string,Row>();
    blueprints.forEach(row=>{
      const route=routeKey(text(row,"routePath"));
      if(route!=="/"&&!unique.has(route))unique.set(route,row);
    });
    return [...unique.entries()].filter(([route,row])=>!needle||`${route} ${text(row,"pageName")} ${text(row,"processCode")}`.toLocaleLowerCase("ko-KR").includes(needle));
  },[blueprints,query]);
  const pageCount=Math.max(1,Math.ceil(screens.length/pageSize));
  const pageRows=screens.slice(page*pageSize,(page+1)*pageSize);
  const bindingMap=useMemo(()=>{
    const map=new Map<string,Row[]>();
    bindings.forEach(row=>{const route=routeKey(text(row,"routePath"));const rows=map.get(route)??[];rows.push(row);map.set(route,rows);});
    return map;
  },[bindings]);
  const primaryCount=new Set(bindings.filter(row=>text(row,"bindingRole")==="PRIMARY").map(row=>routeKey(text(row,"routePath")))).size;
  const mappedCount=new Set(bindings.map(row=>routeKey(text(row,"routePath"))).size;

  return <div className="space-y-4">
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-black tracking-[.12em] text-blue-700">PROCESS ARCHETYPE CATALOG</p>
      <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="text-2xl font-black text-[#052b57]">60개 원형으로 전체 화면의 업무 구조를 통제합니다</h2><p className="mt-2 text-sm text-slate-600">화면마다 주 원형 1개와 공통·예외·서브프로세스 원형을 추가로 연결할 수 있습니다.</p></div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["원형",archetypes.length],["매핑 화면",mappedCount],["주 원형",primaryCount]].map(([label,count])=><div className="min-w-24 rounded-xl bg-slate-50 p-3" key={String(label)}><span className="block text-xs font-bold text-slate-500">{label}</span><strong className="text-xl text-[#052b57]">{count}</strong></div>)}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button className={`min-h-11 rounded-lg px-4 font-bold ${category==="ALL"?"bg-[#052b57] text-white":"border bg-white"}`} onClick={()=>setCategory("ALL")} type="button">전체 60</button>{categories.map(code=><button className={`min-h-11 rounded-lg px-4 font-bold ${category===code?"bg-[#052b57] text-white":"border bg-white"}`} key={code} onClick={()=>setCategory(code)} type="button">{categoryNames[code]??code} · {archetypes.filter(row=>text(row,"categoryCode")===code).length}</button>)}</div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,.75fr)]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredArchetypes.map(row=>{const code=text(row,"archetypeCode"),active=code===text(selected,"archetypeCode");return <button className={`rounded-xl border p-4 text-left transition ${active?"border-blue-500 bg-blue-50 ring-2 ring-blue-100":"bg-white hover:border-blue-300"}`} key={code} onClick={()=>setSelectedCode(code)} type="button"><span className="text-[10px] font-black text-blue-700">{categoryNames[text(row,"categoryCode")]??text(row,"categoryCode")}</span><strong className="mt-1 block text-base text-[#052b57]">{text(row,"archetypeName")}</strong><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{text(row,"purpose")}</p><span className="mt-3 block text-xs font-bold text-slate-500">화면 {text(row,"screenCount")} · 프로세스 {text(row,"processCount")} · 액터 {text(row,"actorCount")}</span></button>})}</div>
      {selected&&<aside className="self-start rounded-2xl border border-blue-200 bg-white p-5 shadow-sm xl:sticky xl:top-4"><p className="text-xs font-black text-blue-700">{text(selected,"archetypeCode")}</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{text(selected,"archetypeName")}</h3><p className="mt-2 text-sm leading-6 text-slate-700">{text(selected,"purpose")}</p><Contract title="입력 계약" value={text(selected,"inputContract")}/><Contract title="출력 계약" value={text(selected,"outputContract")}/><Contract title="명령 계약" value={text(selected,"commandContract")}/><Contract title="상태·예외" value={`${text(selected,"stateContract")} ${text(selected,"exceptionContract")}`}/><Contract title="테스트" value={text(selected,"testContract")}/><Contract title="권장 화면 원형" value={text(selected,"recommendedScreenTypes")}/></aside>}
    </section>

    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <header className="border-b p-5"><h3 className="text-xl font-black text-[#052b57]">화면별 원형 선택</h3><p className="mt-1 text-sm text-slate-600">주 원형 변경은 기존 주 원형을 비활성화하고 새 원형을 한 트랜잭션으로 적용합니다.</p><div className="mt-4 grid gap-2 md:grid-cols-[1fr_13rem_auto]"><input className="h-11 rounded-lg border px-3" onChange={event=>{setQuery(event.target.value);setPage(0)}} placeholder="화면명·경로·프로세스 검색" value={query}/><select className="h-11 rounded-lg border bg-white px-3" onChange={event=>setRole(event.target.value)} value={role}><option value="PRIMARY">주 원형</option><option value="SUBPROCESS">서브프로세스</option><option value="COMMON">공통 프로세스</option><option value="EXCEPTION">예외 프로세스</option></select><span className="flex h-11 items-center rounded-lg bg-slate-100 px-4 text-sm font-bold">{screens.length}개 화면</span></div></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-slate-100"><tr>{["화면","프로세스·단계","현재 원형","선택 원형","적용"].map(head=><th className="px-4 py-3 font-bold text-slate-700" key={head}>{head}</th>)}</tr></thead><tbody>{pageRows.map(([route,row])=>{const current=bindingMap.get(route)??[],primary=current.find(binding=>text(binding,"bindingRole")==="PRIMARY");return <ScreenBindingRow archetypes={archetypes} busy={busy} current={current} defaultCode={text(primary,"archetypeCode")||text(selected,"archetypeCode")} key={route} onBind={onBind} role={role} route={route} row={row}/>})}</tbody></table></div>
      <footer className="flex items-center justify-between border-t p-4"><span className="text-sm text-slate-500">{page+1}/{pageCount} 페이지</span><div className="flex gap-2"><button className="min-h-10 rounded-lg border px-4 font-bold disabled:opacity-40" disabled={page===0} onClick={()=>setPage(value=>Math.max(0,value-1))} type="button">이전</button><button className="min-h-10 rounded-lg border px-4 font-bold disabled:opacity-40" disabled={page>=pageCount-1} onClick={()=>setPage(value=>Math.min(pageCount-1,value+1))} type="button">다음</button></div></footer>
    </section>
  </div>;
}

function ScreenBindingRow({ archetypes,busy,current,defaultCode,onBind,role,route,row }:{archetypes:Row[];busy:boolean;current:Row[];defaultCode:string;onBind:(body:Record<string,unknown>)=>Promise<void>;role:string;route:string;row:Row}) {
  const [code,setCode]=useState(defaultCode);
  return <tr className="border-t align-top"><td className="px-4 py-4"><b className="text-[#052b57]">{text(row,"pageName")}</b><a className="mt-1 block font-mono text-xs text-blue-700 hover:underline" href={route}>{route}</a></td><td className="px-4 py-4"><b>{text(row,"processCode")}</b><span className="block text-xs text-slate-500">{text(row,"stepCode")} · {text(row,"actorCode")}</span></td><td className="max-w-[280px] px-4 py-4">{current.length?current.map(binding=><span className="mb-1 mr-1 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-bold" key={text(binding,"bindingId")}>{text(binding,"bindingRole")} · {text(binding,"archetypeCode")}</span>):<span className="font-bold text-amber-700">미매핑</span>}</td><td className="px-4 py-4"><select aria-label={`${text(row,"pageName")} 원형`} className="h-11 w-full min-w-64 rounded-lg border bg-white px-3" onChange={event=>setCode(event.target.value)} value={code}>{archetypes.map(archetype=><option key={text(archetype,"archetypeCode")} value={text(archetype,"archetypeCode")}>{categoryNames[text(archetype,"categoryCode")]??text(archetype,"categoryCode")} · {text(archetype,"archetypeName")}</option>)}</select></td><td className="px-4 py-4"><button className="min-h-11 rounded-lg bg-[#246beb] px-4 font-bold text-white disabled:opacity-40" disabled={busy||!code} onClick={()=>onBind({routePath:route,archetypeCode:code,bindingRole:role,processCode:text(row,"processCode"),stepCode:text(row,"stepCode"),actorCode:text(row,"actorCode")})} type="button">저장</button></td></tr>;
}

function Contract({title,value}:{title:string;value:string}) {
  return <div className="mt-4"><h4 className="text-xs font-black text-slate-500">{title}</h4><p className="mt-1 break-words rounded-lg bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-700">{value||"[]"}</p></div>;
}
