import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SrTicketRow, SrTicketDetailPayload } from "../../lib/api/platformTypes";
import * as api from "./workbenchApi";
import type { WorkContext, DevelopmentCapabilities } from "./workbenchApi";

const button = "rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-900 disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${button} !bg-blue-700 !text-white`;
const input = "mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal";
const running = (s: string) => /RUNNING|QUEUED/.test(s || "");
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
const statuses: Record<string,string> = { READY_FOR_APPROVAL:"승인 대기", APPROVED_READY:"계획 준비", PLAN_RUNNING:"개발 계획 중", PLAN_COMPLETED:"계획 완료", RUNNING_CODEX:"코드·테스트 실행 중", CODEX_COMPLETED:"실행 종료 · 업무 검증 별도", COMPLETED:"실행 종료 · 업무 검증 별도", RUNNER_ERROR:"실행 오류", CODEX_DISABLED:"실행기 미연결" };

export function DevelopmentWorkbench({ context, onEdit, studio = false }: { context: WorkContext; onEdit: () => void; studio?: boolean }) {
  const [actionHost, setActionHost] = useState<HTMLElement | null>(null);
  useEffect(() => { if (studio) { const host = document.getElementById('studio-primary-actions'); setActionHost(previous => previous === host ? previous : host); } });
  const [capability, setCapability] = useState<DevelopmentCapabilities | null>(null);
  const [tickets, setTickets] = useState<SrTicketRow[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<SrTicketDetailPayload | null>(null);
  const [dialog, setDialog] = useState<"create" | "debug" | "tests" | null>(null);
  const [summary, setSummary] = useState("");
  const [instruction, setInstruction] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [artifact, setArtifact] = useState("");
  const [artifactLabel, setArtifactLabel] = useState("");
  const lock = useRef(false);
  const mounted = useRef(true);
  const epoch = useRef(0);
  const refresh = async () => {
    const result = await api.fetchSrWorkbenchPage("work-implementation");
    const rows = (result.tickets || []).filter(t => {
      const saved = api.ticketContext(t.technicalContext);
      return saved.processCode === context.processCode && saved.stepCode === context.stepCode;
    });
    if (mounted.current) setTickets(rows);
    return rows;
  };
  useEffect(() => {
    mounted.current = true;
    api.fetchDevelopmentCapabilities().then(c => { if (mounted.current) setCapability(c); }).catch(e => { if (mounted.current) setError(`실행 환경 확인 실패: ${errorText(e)}`); });
    refresh().catch(e => { if (mounted.current) setError(`작업 목록 조회 실패: ${errorText(e)}`); });
    return () => { mounted.current = false; epoch.current++; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const load = async () => {
      try { const d = await api.fetchCodexSrTicketDetail(selected); if (alive) setDetail(d); }
      catch(e) { if (alive) setError(`작업 재조회 실패: ${errorText(e)}`); }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [selected]);
  const ticket = detail?.ticket?.ticketId === selected ? detail.ticket : tickets.find(t => t.ticketId === selected);
  const evidenceValid = ticket ? api.currentEvidence(ticket.technicalContext, context) : false;
  const environmentReady = !!capability?.developmentOnly && capability.deploymentEnabled === false;
  const taskBusy = !!ticket && running(ticket.executionStatus);
  async function action(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await work(); } catch(e) { if (mounted.current) setError(errorText(e)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const create = () => action(async () => {
    if (!summary.trim() || !instruction.trim() || !acceptance.trim() || !confirmed || !context.processVersion) throw new Error("요청 내용·완료 기준·설계 버전과 개발 범위를 확인해 주세요.");
    const technicalContext = JSON.stringify({ ...context, source:"work-implementation", acceptance:acceptance.trim(), environment:"DEVELOPMENT", deploymentAllowed:false });
    const result = await api.createSrTicket({ pageId:"work-implementation", pageLabel:context.stepName, routePath:api.safeRoute(context.routePath), menuCode:"", menuLookupUrl:"", surfaceId:context.stepCode, surfaceLabel:context.stepName, eventId:"development-request", eventLabel:"개발 요청", targetId:context.processCode, targetLabel:context.stepName, summary:summary.trim(), instruction:instruction.trim(), technicalContext,
      generatedDirection:`개발환경 한정. 운영 배포·DB 변경 금지. 대상 ${context.processCode}/${context.stepCode}, 설계 버전 ${context.processVersion}. 완료 기준: ${acceptance.trim()}`,
      commandPrompt:`선택한 절차만 구현하고 기존 변경을 보존하세요. 운영 배포와 DB 변경은 하지 마세요.\n${technicalContext}\n${instruction.trim()}` });
    if (!result.success || !result.ticket?.ticketId) throw new Error(result.message || "서버에서 작업 ID를 반환하지 않았습니다.");
    if (!mounted.current) return;
    setSelected(result.ticket.ticketId); setDialog(null); setNotice(`작업 ${result.ticket.ticketId} 저장됨. 실행 승인과 개발 계획은 별도 단계입니다.`);
    await refresh();
  });
  const run = (mode: "plan" | "execute") => action(async () => {
    if (!ticket || !evidenceValid || !environmentReady || !(mode === "plan" ? capability?.planEnabled : capability?.executeEnabled)) throw new Error("현재 설계 버전과 개발 전용 실행 환경을 확인해 주세요.");
    const result = await api.runDevelopmentAction(ticket.ticketId, mode);
    if (!result.success) throw new Error(result.message || "실행이 거부되었습니다.");
    if (!mounted.current) return;
    setDetail(await api.fetchCodexSrTicketDetail(ticket.ticketId)); await refresh(); setNotice("서버 실행 결과를 다시 조회했습니다. 업무 완료 여부는 별도 검증합니다.");
  });
  const readArtifact = (type: string) => action(async () => {
    if (!ticket) return;
    const requestEpoch = ++epoch.current;
    setArtifact(""); setArtifactLabel("불러오는 중");
    const result = await api.fetchCodexSrTicketArtifact(ticket.ticketId, type);
    if (!mounted.current || requestEpoch !== epoch.current) return;
    if (!result.success || !result.available) throw new Error(result.message || "결과 파일이 없습니다.");
    setArtifactLabel(result.label + (result.truncated ? " · 일부 표시" : "")); setArtifact(result.content);
  });
  const approve = () => action(async () => {
    if (!ticket || !evidenceValid) return;
    const result = await api.approveSrTicket(ticket.ticketId,"APPROVE","통합 작업실에서 선택한 개발 요청 승인. 운영 반영 제외.");
    if (!result.success) throw new Error(result.message || "승인 실패");
    if (mounted.current) { setDetail(await api.fetchCodexSrTicketDetail(ticket.ticketId)); await refresh(); }
  });
  const open = (mode: "create" | "debug" | "tests") => { setDialog(mode); setError(""); setArtifact(""); setArtifactLabel(""); if(mode === "create") setConfirmed(false); };
  const resultText = (code: number | null | undefined) => !evidenceValid ? "재검증 필요" : code == null ? "미검증" : code === 0 ? "명령 통과 · 로그 확인 필요" : `실패 (exit ${code})`;
  const stage = !ticket ? -1 : /ERROR|FAILED/.test(ticket.executionStatus || '') ? -1 : /COMPLETED/.test(ticket.executionStatus || '') && ticket.executionStatus !== 'PLAN_COMPLETED' ? 3 : /RUNNING_CODEX/.test(ticket.executionStatus || '') ? 2 : /PLAN/.test(ticket.executionStatus || '') ? 1 : 0;
  const runnerReady = environmentReady && !!capability?.planEnabled && !!capability?.executeEnabled;
  const studioActions = <div className="studio-primary-actions"><button onClick={onEdit}>① 설계 수정</button><button onClick={() => {setSummary('기능 추가');open('create');}}>② 기능 추가</button><button className="primary" disabled={!context.processVersion} onClick={() => open('create')}>③ 개발 시작</button><button onClick={() => open('tests')}>④ 테스트 확인</button></div>;
  return <section className="rounded-xl border border-blue-200 bg-white p-5" aria-label="개발 통합 작업실">
    {studio && actionHost && createPortal(studioActions, actionHost)}
    {studio && <div className="studio-run-stages" aria-label="실제 개발 단계">{['요청','계획','코드·테스트','결과 확인','업무 검증'].map((label,index)=><span key={label} aria-current={stage === index ? 'step' : undefined}>{index+1}<small>{label}</small></span>)}</div>}
    {studio && <p className="studio-run-status">{capability ? runnerReady ? '개발 실행기 연결 확인 · 배포 차단' : '실행 조건 미충족 · 요청 저장과 설계 편집은 가능' : '서버 실행 환경 확인 중'}</p>}
    <header className="flex flex-wrap justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">설계 → 개발 → 변경 검토 → 테스트 → 업무 검증</p><h2 className="mt-1 text-xl font-black">개발 통합 작업실</h2><p className="mt-1 text-sm text-slate-600">{context.stepName} · {context.processCode} / {context.stepCode} · 설계 v{context.processVersion || "미확인"}</p></div><span className="self-start rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900">운영 배포 없음</span></header>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4"><div className="flex flex-wrap gap-2"><button className={button} onClick={onEdit}>설계 수정</button><button className={button} onClick={() => {setSummary("기능 추가");open("create");}}>기능 추가 요청</button><button className={primary} disabled={!context.stepCode || !context.processVersion} onClick={() => open("create")}>개발 요청</button><button className={button} disabled={!ticket} onClick={() => open("debug")}>디버깅·변경 코드</button><button className={button} disabled={!ticket} onClick={() => open("tests")}>테스트·검증 결과</button>{api.safeRoute(context.routePath) && <a className={button} href={api.safeRoute(context.routePath)} target="_blank" rel="noreferrer">실제 화면 열기 ↗</a>}</div>
        <div className="rounded-lg bg-slate-50 p-4 text-sm"><strong>업무 완료 조건</strong><p className="mt-2 whitespace-pre-wrap">{context.completionRule || "정의되지 않았습니다. 먼저 완료 조건을 저장해 주세요."}</p><p className="mt-3 text-slate-500">기능 추가 요청은 작업 지시입니다. 정본 설계는 공식 Revision으로 별도 저장하며 요청 등록만으로 기능이 구현되지 않습니다.</p></div>
        <div><div className="flex justify-between"><h3 className="font-bold">저장된 개발 작업</h3><button className={button} disabled={busy} onClick={() => void action(async () => {await refresh();})}>작업 새로고침</button></div><ul className="mt-2 max-h-64 space-y-2 overflow-auto">{tickets.map(t => <li key={t.ticketId}><button className={`w-full rounded-lg border p-3 text-left ${selected === t.ticketId ? "border-blue-600 bg-blue-50" : ""}`} onClick={() => {setSelected(t.ticketId);setDetail(null);setArtifact("");epoch.current++;}}><strong className="block text-sm">{t.summary}</strong><span className="text-xs text-slate-500">{t.ticketId} · {statuses[t.executionStatus] || t.executionStatus || "미실행"} · {api.currentEvidence(t.technicalContext,context) ? "현재 설계" : "이전 설계 · 재검증 필요"}</span></button></li>)}</ul>{tickets.length === 0 && <p className="py-5 text-sm text-slate-500">이 절차에 저장된 개발 작업이 없습니다.</p>}</div>
      </div>
      <aside className="rounded-xl border bg-slate-50 p-4" aria-label="개발 진행 상황"><h3 className="font-bold">개발 진행 상황</h3><p className="mt-2 text-sm text-amber-900">{capability?.reason || (!capability ? "개발 전용 실행 환경 확인 전입니다." : "개발 전용 실행 · 배포 미연결")}</p>{ticket ? <><p className="mt-4 font-bold">{statuses[ticket.executionStatus] || ticket.executionStatus || "미실행"}</p><p className="mt-1 text-sm">{ticket.executionComment || "서버 실행 기록이 아직 없습니다."}</p><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><dt>작업 ID</dt><dd>{ticket.ticketId}</dd><dt>최근 갱신</dt><dd>{ticket.updatedAt || "—"}</dd><dt>변경 파일</dt><dd className="break-all">{ticket.executionChangedFiles || "아직 없음"}</dd><dt>업무 실행 검증</dt><dd>미확인 · 자동 완료 처리하지 않음</dd></dl>{!evidenceValid && <p role="status" className="mt-3 text-sm text-amber-800">설계 버전이 달라 기존 결과를 완료 근거로 사용하지 않습니다.</p>}<div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={busy || taskBusy || ticket.status !== "OPEN" || !evidenceValid} onClick={() => void approve()}>요청 승인</button><button className={button} disabled={busy || taskBusy || ticket.status !== "APPROVED" || !evidenceValid || !environmentReady || !capability?.planEnabled} onClick={() => void run("plan")}>개발 계획 실행</button><button className={primary} disabled={busy || taskBusy || ticket.executionStatus !== "PLAN_COMPLETED" || !evidenceValid || !environmentReady || !capability?.executeEnabled} onClick={() => void run("execute")}>코드·테스트 실행</button></div><p className="mt-3 text-xs text-slate-500">5초마다 서버 결과를 조회합니다. 일시정지·취소 API는 아직 연결되지 않았습니다.</p></> : <p className="mt-6 text-sm text-slate-500">작업을 선택하면 진행 상태와 결과가 표시됩니다.</p>}</aside>
    </div>
    {notice && <p role="status" className="mt-3 rounded bg-blue-50 p-3 text-sm">{notice}</p>}{error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {dialog && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" onKeyDown={e => {if(e.key === "Escape" && !busy) setDialog(null);}}><section role="dialog" aria-modal="true" aria-label={dialog === "create" ? "개발 요청 작성" : dialog === "debug" ? "디버깅 작업실" : "테스트·업무 검증"} className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"><header className="flex justify-between"><h2 className="text-xl font-black">{dialog === "create" ? "개발 요청 작성" : dialog === "debug" ? "디버깅 작업실" : "테스트·업무 검증"}</h2><button className={button} disabled={busy} onClick={() => {setDialog(null);epoch.current++;}}>닫기</button></header>
      {dialog === "create" ? <form className="mt-4 space-y-4" onSubmit={e => {e.preventDefault();void create();}}><p className="rounded bg-blue-50 p-3 text-sm">{context.stepName} · 설계 v{context.processVersion} · {context.routePath || "화면 미연결"}</p><label className="block font-bold">요청 제목<input autoFocus required className={input} value={summary} maxLength={200} onChange={e => setSummary(e.target.value)} /></label><label className="block font-bold">개발 내용<textarea required className={input} rows={4} value={instruction} maxLength={10000} onChange={e => setInstruction(e.target.value)} /></label><label className="block font-bold">완료·인수 기준<textarea required className={input} rows={3} value={acceptance} maxLength={5000} onChange={e => setAcceptance(e.target.value)} placeholder="어떤 입력을 저장하고 무엇을 재조회하면 완료인지 작성" /></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />선택한 절차만 변경하며 운영 배포·DB 변경은 포함하지 않습니다.</label><p className="text-xs text-slate-500">공식 개발 티켓 API에 저장합니다. 이 버튼은 코드 실행이나 운영 반영을 즉시 수행하지 않습니다.</p><button className={primary} disabled={busy || !confirmed || !summary.trim() || !instruction.trim() || !acceptance.trim()}>{busy ? "저장 중…" : "개발 요청 저장"}</button></form> : <div className="mt-4 space-y-4">{dialog === "tests" && <><table className="w-full text-left text-sm"><thead><tr><th className="p-2">검증 범위</th><th>현재 설계 기준 결과</th></tr></thead><tbody>{[["Frontend 검증",resultText(ticket?.frontendVerifyExitCode)],["Backend 검증",resultText(ticket?.backendVerifyExitCode)],["DB 통합","별도 증거 필요"],["실제 브라우저","별도 증거 필요"],["담당자 간 업무 인계","미확인"]].map(([name,result]) => <tr className="border-t" key={name}><td className="p-2">{name}</td><td>{result}</td></tr>)}</tbody></table><p className="text-sm text-amber-900">명령 종료코드 0은 해당 명령의 성공입니다. 테스트 개수·DB 저장·업무 완료를 대신 증명하지 않습니다.</p></>}<div className="flex flex-wrap gap-2">{detail?.availableArtifacts?.map(a => <button key={a.artifactType} className={button} disabled={busy || !a.available} onClick={() => void readArtifact(a.artifactType)}>{a.label}</button>)}</div>{!detail?.availableArtifacts?.length && <p className="text-sm text-slate-500">서버에 등록된 실행 결과 파일이 없습니다.</p>}<h3 className="font-bold">{artifactLabel || "로그·변경 파일을 선택하세요"}</h3><pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{artifact || "결과를 임의로 생성하지 않습니다."}</pre><button className={button} onClick={() => {setSummary(`수정: ${ticket?.summary || context.stepName}`);setDialog("create");setConfirmed(false);}}>수정·재검증 요청 작성</button></div>}
      {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
    </section></div>}
  </section>;
}
