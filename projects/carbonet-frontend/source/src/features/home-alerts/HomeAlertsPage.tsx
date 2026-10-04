import { useCallback, useEffect, useMemo, useState } from "react";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { alertCatalog } from "./alertCatalog";
import "./HomeAlertsPage.css";

type Task = { id: number; projectId: string; projectName?: string; site?: string; dueDate?: string; priority?: string; actorCode?: string; domainCode?: string; status?: string };
type Notice = { id: number; projectId: string; taskId?: number; eventType: string; title: string; message: string; targetUrl: string; readAt?: string | null; createdAt: string; workTypeName?: string };
type Inbox = { items: Task[]; notifications: Notice[]; unreadNotificationCount: number };
type Filter = "all" | "action" | "urgent" | "info";
const endpoint = (path: string) => buildLocalizedPath(path, `/en${path}`);
const dateLabel = (value?: string) => {
  const date = value ? new Date(value) : null;
  return !date || Number.isNaN(date.getTime()) ? "미등록" : date.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};
function targetPath(value: string, projectId: string) {
  const fallback = `/emission/project_list?projectId=${encodeURIComponent(projectId)}`;
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  const url = new URL(value, window.location.origin);
  if (projectId && !url.searchParams.has("projectId")) url.searchParams.set("projectId", projectId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function HomeAlertsPage() {
  const [data, setData] = useState<Inbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [view, setView] = useState("inbox");
  const [area, setArea] = useState("");
  const [read, setRead] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError(""); setAuthRequired(false);
    try {
      const response = await fetch(endpoint("/home/api/emission-tasks?compact=true&scope=mine"), { credentials: "include", headers: { Accept: "application/json" } });
      setAuthRequired(response.status === 401);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || `조회 오류 (${response.status})`);
      if (!Array.isArray(body.notifications)) throw new Error("알림 응답을 확인할 수 없습니다. 다시 시도해 주세요.");
      setData({ items: Array.isArray(body.items) ? body.items : [], notifications: body.notifications, unreadNotificationCount: Number(body.unreadNotificationCount || 0) });
      setChecked(new Set());
    } catch (cause) { setData(null); setError(cause instanceof Error ? cause.message : "알림 조회에 실패했습니다."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (data?.notifications || []).map(notice => {
    const task = data?.items.find(item => item.id === notice.taskId);
    const result = /(?:COMPLETED|APPROVED|REJECTED|RESULT|RESOLVED|ACCEPTED)$/.test(notice.eventType);
    const due = task?.dueDate ? new Date(`${task.dueDate.slice(0, 10)}T23:59:59`) : null;
    const late = Boolean(due && due.getTime() < Date.now() && task?.status !== "DONE" && !result);
    const urgent = task?.priority === "URGENT" || late;
    const domain = notice.workTypeName || (task?.domainCode === "LCA" ? "제품 LCA" : /DATA_|CORRECTION|BOUNDARY|EMISSION/.test(notice.eventType) ? "탄소배출" : "공통 업무");
    return { ...notice, area: domain, priority: urgent ? "긴급" : task?.priority === "HIGH" ? "높음" : "보통", status: result ? "처리 결과" : late ? "기한 경과" : "조치 필요", project: task?.projectName || notice.projectId || "대상 정보 없음", site: task?.site, owner: task?.actorCode || "현재 수신 계정", due: task?.dueDate || "지정된 기한 없음", unread: !notice.readAt, urgent, result };
  }), [data]);
  const visible = useMemo(() => rows.filter(row => (!area || row.area === area) && (!read || row.unread === (read === "unread")) && (!search || `${row.title} ${row.message} ${row.project} ${row.site || ""}`.toLowerCase().includes(search.toLowerCase())) && (filter === "all" || filter === "action" && !row.result || filter === "urgent" && row.urgent || filter === "info" && row.result)).sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.createdAt.localeCompare(a.createdAt)), [rows, area, read, search, filter]);
  const active = visible.find(row => row.id === selected) || visible[0];
  async function markRead(ids: number[]) {
    const targets = rows.filter(row => ids.includes(row.id) && row.unread);
    if (!targets.length) { setFeedback("읽음 처리할 안 읽은 알림을 선택하세요."); return; }
    setSaving(true); setFeedback("");
    const successes: number[] = [];
    try {
      for (const notice of targets) {
        const response = await fetch(endpoint(`/home/api/emission-task-notifications/${notice.id}/read`), { method: "POST", credentials: "include", headers: { Accept: "application/json" } });
        const body = await response.json();
        if (!response.ok || body.success !== true) throw new Error(body.message || "읽음 상태를 저장하지 못했습니다.");
        successes.push(notice.id);
      }
      setFeedback(`${successes.length}건을 읽음으로 저장했습니다. 업무 상태는 유지됩니다.`);
    } catch (cause) { setFeedback(`${successes.length}건 저장됨 · ${cause instanceof Error ? cause.message : "저장 실패"}`); }
    finally {
      setData(current => current ? { ...current, notifications: current.notifications.map(item => successes.includes(item.id) ? { ...item, readAt: new Date().toISOString() } : item), unreadNotificationCount: Math.max(0, current.unreadNotificationCount - successes.length) } : current);
      setChecked(current => new Set([...current].filter(id => !successes.includes(id)))); setSaving(false);
    }
  }
  return <div className="alerts-design">
    <div className="heading"><div><h1>주요 알림</h1><p className="sub">나에게 도착한 요청과 변경사항을 확인하고 관련 업무를 이어갑니다.</p></div><a className="button" href={endpoint("/mypage/notification")}>알림 수신 설정 ↗</a></div>
    <div className="tabs" role="tablist" aria-label="알림 화면"><button className={view === "inbox" ? "active" : ""} role="tab" aria-selected={view === "inbox"} onClick={() => setView("inbox")}>수신 알림</button><button className={view === "catalog" ? "active" : ""} role="tab" aria-selected={view === "catalog"} onClick={() => setView("catalog")}>알림 설계 목록 {alertCatalog.length}</button></div>
    {view === "inbox" ? <section aria-label="수신 알림">
      <div className="filters"><label>업무 영역<select value={area} onChange={event => setArea(event.target.value)}><option value="">전체 업무</option>{[...new Set([...alertCatalog.map(item => item.area), ...rows.map(item => item.area)])].map(value => <option key={value}>{value}</option>)}</select></label><label>읽음 상태<select value={read} onChange={event => setRead(event.target.value)}><option value="">전체</option><option value="unread">안 읽음</option><option value="read">읽음</option></select></label><label>알림 검색<input placeholder="알림 내용, 프로젝트, 사업장" type="search" value={search} onChange={event => setSearch(event.target.value)} /></label><button onClick={() => { setArea(""); setRead(""); setSearch(""); setFilter("all"); }}>초기화</button></div>
      <div className="toolbar"><div className="chips" aria-label="알림 분류">{([['all', '전체'], ['action', '조치 필요'], ['urgent', '긴급·기한 경과'], ['info', '처리 결과']] as const).map(([value, title]) => <button key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{title}</button>)}</div><button onClick={() => void markRead([...checked])} disabled={saving || !checked.size}>선택 알림 읽음</button></div>
      {feedback && <p className="callout" role="status">{feedback}</p>}
      {error && <div className="sample error-notice" role="alert"><strong>{authRequired ? "로그인이 필요합니다" : "알림을 불러오지 못했습니다"}</strong><p>{authRequired ? "로그인 상태를 확인한 후 다시 조회해 주세요." : error}</p>{authRequired && <a className="button" href={endpoint("/signin/loginView")}>로그인</a>} <button onClick={() => void load()}>다시 시도</button></div>}
      <div className="workspace"><div><div className="count" aria-live="polite">{loading ? "알림을 불러오는 중입니다." : data ? `검색 결과 ${visible.length}건 · 조회 내 안 읽음 ${visible.filter(row => row.unread).length}건 · 전체 안 읽음 ${data.unreadNotificationCount}건` : "알림 미조회"}</div><div className="list">
        {visible.map(row => <article key={row.id} className={`row ${active?.id === row.id ? "selected" : ""}`}><input type="checkbox" aria-label={`${row.title} 선택`} checked={checked.has(row.id)} onChange={event => setChecked(current => { const next = new Set(current); if (event.target.checked) next.add(row.id); else next.delete(row.id); return next; })} /><div><div className="badges"><span className={`badge ${row.urgent ? "urgent" : row.result ? "done" : "action"}`}>{row.status}</span><span className="meta">{row.area}</span></div><button className="rowtitle" aria-pressed={active?.id === row.id} onClick={() => setSelected(row.id)}>{row.unread && <span className="dot" aria-label="안 읽음" />}{row.title}</button><p className="meta">{row.project}{row.site ? ` · ${row.site}` : ""}</p></div><div className="date">{dateLabel(row.createdAt)}<br />{row.unread ? "안 읽음" : "읽음"}</div></article>)}
        {!loading && !error && !visible.length && <div className="empty"><h2>{rows.length ? "조건에 맞는 알림이 없습니다" : "도착한 알림이 없습니다"}</h2><p className="sub">{rows.length ? "업무 영역이나 읽음 상태를 변경해 주세요." : "새로운 업무 요청과 변경사항이 도착하면 표시됩니다."}</p></div>}
      </div><p className="footnote">읽음은 알림 확인 여부입니다. 업무 완료 여부는 연결된 업무 화면의 처리 결과를 따릅니다.</p><button style={{ marginTop: 12 }} disabled={loading} onClick={() => void load()}>새로고침</button></div>
      <aside className="detail" aria-label="알림 상세">{active ? <><span className={`badge ${active.urgent ? "urgent" : "action"}`}>{active.priority}</span><h2>{active.title}</h2><p className="sub">{active.message}</p><dl><dt>대상 업무</dt><dd>{active.project}</dd><dt>수신 역할</dt><dd>{active.owner}</dd><dt>처리 기한</dt><dd>{active.due}</dd><dt>발생 시각</dt><dd>{dateLabel(active.createdAt)}</dd><dt>현재 상태</dt><dd>{active.status}</dd></dl><div className="callout"><strong>다음 행동</strong><br />연결된 업무에서 요청 내용과 현재 처리 상태를 확인하세요.</div><a className="button primary" href={endpoint(targetPath(active.targetUrl, active.projectId))}>관련 업무 열기 ↗</a><button onClick={() => void markRead([active.id])} disabled={saving || !active.unread}>{active.unread ? "읽음으로 표시" : "읽음 처리됨"}</button><p className="footnote">읽음 상태는 저장됩니다. 관련 업무에서 현재 권한과 처리 가능 여부를 확인합니다.</p></> : <><h2>알림 상세</h2><p className="sub">목록에서 알림을 선택하세요.</p></>}</aside></div>
    </section> : <section aria-label="알림 설계 목록"><h2>메뉴를 기준으로 도출한 필수 알림</h2><p className="sub">발생 조건과 수신 대상을 먼저 정의한 설계 제안입니다. 아래 알림의 서버 이벤트 구현 여부는 별도 확인이 필요합니다.</p><div className="rules"><article><h3>01　나에게 필요한 알림</h3><p>해당 프로젝트·사업장에 접근 가능한 담당자, 요청자, 검토자에게만 전달합니다. 역할 변경 후 목록과 링크 권한을 다시 검사합니다.</p></article><article><h3>02　사건마다 1건으로 묶기</h3><p>대상 ID + 사건 유형 + 버전 + 수신자로 중복을 막습니다. 마감 예고는 제안 기준 D-3·D-1, 기한 경과는 최초 1회 후 담당 규칙에 따라 재통지합니다.</p></article><article><h3>03　읽음과 처리를 분리</h3><p>읽어도 승인·접수·보완 완료로 바뀌지 않습니다. 원업무가 완료·취소되면 알림의 조치 상태를 동기화하고 이력을 보존합니다.</p></article></div><div className="catalogwrap"><table><thead><tr><th>ID / 영역</th><th>알림 / 발생 조건</th><th>수신 대상</th><th>우선순위 / 해제 조건</th><th>연결 메뉴</th></tr></thead><tbody>{alertCatalog.map(item => <tr key={item.id}><td><strong>{item.id}</strong><br />{item.area}</td><td><strong>{item.name}</strong><br />{item.trigger}</td><td>{item.recipient}</td><td>{item.priority}<br />{item.resolve}</td><td><a href={endpoint(item.url)}>{item.menu} ↗</a></td></tr>)}</tbody></table></div><details><summary>화면·데이터·권한 설계</summary><ul><li>수신자 본인 범위에서 최근 20건을 조회합니다. 전체 안 읽은 건수는 조회된 목록 건수와 다를 수 있습니다.</li><li>알림 선택 → 상세 확인 → 관련 업무 열기 → 업무 처리. 읽음 처리는 업무 완료 상태를 바꾸지 않습니다.</li><li>개별·선택 읽음은 서버 저장 성공 건만 반영합니다. 오류가 나면 저장된 건수와 실패 메시지를 표시합니다.</li><li>설계 목록 30개는 제안 규칙입니다. 모든 업무 이벤트가 구현되었다는 의미는 아닙니다.</li></ul></details><details><summary>페이지·프로세스 QA와 완료 기준</summary><ol><li>자료 제출 요청 → 해당 담당자 수신 → 알림 상세 → 원업무 이동.</li><li>읽음 처리 → 새로고침 후 읽음 상태 유지 → 원업무 상태 유지.</li><li>타 계정의 알림 목록·읽음 처리 권한 차단.</li><li>검색·분류·선택 읽음·빈 상태·조회 실패·모바일 표시 확인.</li></ol></details></section>}
  </div>;
}
