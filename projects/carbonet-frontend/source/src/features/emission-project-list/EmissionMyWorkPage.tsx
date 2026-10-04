import { useCallback, useEffect, useMemo, useState } from "react";
import { EmissionPageIntro } from "../emission-common/EmissionPageIntro";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type Task = {
  id: number;
  projectId: string;
  projectName: string;
  site?: string;
  name: string;
  status: string;
  dueDate?: string;
  assignee?: string;
  targetUrl?: string;
  processCode?: string;
  processName?: string;
  processStepCode?: string;
  blockedReason?: string;
  pendingPredecessors?: string;
  actionable?: boolean;
  completionRule?: string;
  workPurpose?: string;
  requiredInputs?: unknown;
  expectedOutput?: unknown;
  completionEvidence?: string;
  actorCode?: string;
  priority?: string;
};
type Body = {
  items?: Task[];
  summary?: { total?: number; completed?: number; today?: number; overdue?: number; serverDate?: string };
  message?: string;
};
type MetricFilter = "" | "READY" | "IN_PROGRESS" | "BLOCKED" | "OVERDUE";

const STATUS_KO: Record<string, string> = {
  READY: "처리 가능", IN_PROGRESS: "진행 중", WAITING: "선행 업무 대기",
  BLOCKED: "차단·보완", DONE: "완료",
};
const STATUS_EN: Record<string, string> = {
  READY: "Ready", IN_PROGRESS: "In progress", WAITING: "Waiting for prerequisite",
  BLOCKED: "Blocked / correction", DONE: "Completed",
};
const STATUS_STYLE: Record<string, string> = {
  READY: "bg-blue-50 text-blue-800", IN_PROGRESS: "bg-indigo-50 text-indigo-800",
  WAITING: "bg-slate-100 text-slate-700", BLOCKED: "bg-amber-50 text-amber-900",
  DONE: "bg-emerald-50 text-emerald-800",
};

function safeTarget(task: Task) {
  return Boolean(task.targetUrl?.startsWith("/") && task.targetUrl !== "#" && !task.targetUrl.startsWith("//") && !task.targetUrl.startsWith("/admin/"));
}
function taskHref(task: Task, en: boolean) {
  const route = safeTarget(task) ? task.targetUrl! : "/work/execution";
  const url = new URL(route, window.location.origin);
  url.searchParams.set("projectId", task.projectId);
  url.searchParams.set("taskId", String(task.id));
  if (task.processCode) url.searchParams.set("processCode", task.processCode);
  if (task.processStepCode) url.searchParams.set("stepCode", task.processStepCode);
  const path = `${url.pathname}${url.search}`;
  return buildLocalizedPath(path, `/en${path}`);
}
function kstToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function isOverdue(task: Task, today: string) {
  return task.status !== "DONE" && Boolean(task.dueDate && task.dueDate.slice(0, 10) < today);
}
function contractText(value: unknown, en: boolean) {
  if (value == null || value === "") return en ? "Not specified" : "등록된 내용 없음";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(" · ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${String(item)}`).join(" · ");
  return String(value);
}
function dateLabel(value: string | undefined, en: boolean) {
  if (!value) return en ? "No due date" : "기한 미지정";
  return value.slice(0, 10).replaceAll("-", ".");
}

export function EmissionMyWorkPage() {
  const en = isEnglish();
  const [body, setBody] = useState<Body | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [site, setSite] = useState("");
  const [stage, setStage] = useState("");
  const [due, setDue] = useState("");
  const [metric, setMetric] = useState<MetricFilter>("");
  const [tab, setTab] = useState<"OPEN" | "DONE">("OPEN");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const api = buildLocalizedPath("/home/api/emission-tasks?scope=mine&compact=true", "/en/home/api/emission-tasks?scope=mine&compact=true");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(api, { credentials: "include", headers: { Accept: "application/json" }, signal });
      if (response.status === 401) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(buildLocalizedPath(`/signin/loginView?returnUrl=${returnUrl}`, `/en/signin/loginView?returnUrl=${returnUrl}`));
        return;
      }
      const result = await response.json() as Body;
      if (!response.ok) throw new Error(result.message || (en ? "Could not load assigned tasks." : "담당 업무를 불러오지 못했습니다."));
      setBody(result);
    } catch (cause) {
      if ((cause as { name?: string })?.name !== "AbortError") setError(cause instanceof Error ? cause.message : (en ? "Request failed." : "요청 처리 중 오류가 발생했습니다."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [api, en]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const allItems = body?.items || [];
  const today = body?.summary?.serverDate?.slice(0, 10) || kstToday();
  const metrics = useMemo(() => ({
    ready: allItems.filter((task) => task.status === "READY").length,
    progress: allItems.filter((task) => task.status === "IN_PROGRESS").length,
    blocked: allItems.filter((task) => task.status === "BLOCKED" || Boolean(task.blockedReason)).length,
    overdue: allItems.filter((task) => isOverdue(task, today)).length,
  }), [allItems, today]);
  const sites = useMemo(() => [...new Set(allItems.map((task) => task.site).filter((value): value is string => Boolean(value)))].sort(), [allItems]);
  const stages = useMemo(() => [...new Set(allItems.map((task) => task.processName || task.processCode).filter((value): value is string => Boolean(value)))].sort(), [allItems]);
  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return allItems.filter((task) => {
      if (tab === "DONE" ? task.status !== "DONE" : task.status === "DONE") return false;
      if (site && task.site !== site) return false;
      if (stage && (task.processName || task.processCode) !== stage) return false;
      if (due === "OVERDUE" && !isOverdue(task, today)) return false;
      if (due === "TODAY" && (task.status === "DONE" || task.dueDate?.slice(0, 10) !== today)) return false;
      if (due === "WEEK") {
        const date = task.dueDate?.slice(0, 10);
        const delta = date ? (new Date(`${date}T00:00:00+09:00`).getTime() - new Date(`${today}T00:00:00+09:00`).getTime()) / 86400000 : Number.POSITIVE_INFINITY;
        if (task.status === "DONE" || delta < 0 || delta > 7) return false;
      }
      if (metric === "READY" && task.status !== "READY") return false;
      if (metric === "IN_PROGRESS" && task.status !== "IN_PROGRESS") return false;
      if (metric === "BLOCKED" && task.status !== "BLOCKED" && !task.blockedReason) return false;
      if (metric === "OVERDUE" && !isOverdue(task, today)) return false;
      if (normalized && ![task.name, task.projectName, task.site, task.processName, task.processCode, task.processStepCode].some((value) => String(value || "").toLocaleLowerCase().includes(normalized))) return false;
      return true;
    }).sort((left, right) => {
      const leftDue = left.dueDate ? left.dueDate.slice(0, 10) : "9999-99-99";
      const rightDue = right.dueDate ? right.dueDate.slice(0, 10) : "9999-99-99";
      return Number(isOverdue(right, today)) - Number(isOverdue(left, today)) || leftDue.localeCompare(rightDue) || left.id - right.id;
    });
  }, [allItems, due, metric, query, site, stage, tab, today]);
  const selected = visibleTasks.find((task) => task.id === selectedId) || visibleTasks[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    if (!visibleTasks.length && selectedId !== null) setSelectedId(null);
  }, [selected, selectedId, visibleTasks]);

  async function startTask(task: Task) {
    setBusyTask(task.id);
    setError("");
    try {
      const response = await fetch(buildLocalizedPath(`/home/api/emission-tasks/${task.id}/status`, `/en/home/api/emission-tasks/${task.id}/status`), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || (en ? "The task could not be started." : "업무를 시작할 수 없습니다."));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (en ? "The task could not be started." : "업무를 시작할 수 없습니다."));
    } finally {
      setBusyTask(null);
    }
  }

  function resetFilters() {
    setQuery(""); setSite(""); setStage(""); setDue(""); setMetric(""); setTab("OPEN");
  }
  const count = (filter: MetricFilter) => filter === "READY" ? metrics.ready : filter === "IN_PROGRESS" ? metrics.progress : filter === "BLOCKED" ? metrics.blocked : metrics.overdue;
  const introTitle = en ? "My assigned work" : "담당 업무";
  const statusLabel = (status: string) => (en ? STATUS_EN : STATUS_KO)[status] || status;

  return <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 lg:px-8" data-design-component="emission-my-work-container">
    <EmissionPageIntro
      category={en ? "Carbon Emission Management" : "탄소배출 관리"}
      title={introTitle}
      description={en ? "Review assigned emission tasks, check what is needed, and continue the work." : "나에게 배정된 탄소배출 업무를 확인하고 요청 내용과 완료 조건을 살펴 처리합니다."}
      actions={<a className="krds-button rounded border bg-white px-3 font-bold" href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>{en ? "Emission projects" : "배출량 프로젝트"}</a>}
    />

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={en ? "Assigned task summary" : "담당 업무 요약"}>
      {([
        ["READY", en ? "Ready to act" : "처리 가능", metrics.ready, en ? "Tasks that can be started" : "지금 시작할 수 있는 업무", ""],
        ["IN_PROGRESS", en ? "In progress" : "진행 중", metrics.progress, en ? "Tasks you have started" : "이어서 처리할 업무", ""],
        ["BLOCKED", en ? "Blocked / correction" : "차단·보완", metrics.blocked, en ? "Review the reason and prerequisite" : "차단 사유와 선행 조건 확인", ""],
        ["OVERDUE", en ? "Overdue" : "기한 경과", metrics.overdue, en ? "Due date passed and not completed" : "완료되지 않은 기한 경과 업무", "text-rose-700"],
      ] as const).map(([key, label, value, hint, color]) => <button
        aria-pressed={metric === key}
        className={`rounded-xl border p-4 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 ${metric === key ? "border-2 border-blue-700 bg-blue-50 p-[15px]" : "border-slate-200 bg-white"}`}
        key={key}
        onClick={() => { setMetric(metric === key ? "" : key); setTab("OPEN"); }}
        type="button"
      ><span className="text-sm font-bold text-slate-600">{label}</span><strong className={`mt-1 block text-3xl font-black ${color}`}>{value}<span className="ml-1 text-sm font-bold">{en ? "tasks" : "건"}</span></strong><span className="mt-1 block text-xs text-slate-500">{hint}</span></button>)}
    </section>

    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label={en ? "Search and filters" : "검색 및 필터"}>
      <div className="grid gap-3 md:grid-cols-[minmax(220px,2fr)_repeat(3,minmax(145px,1fr))_auto] md:items-end">
        <label className="text-sm font-bold">{en ? "Search work or project" : "업무·프로젝트 검색"}<input className="krds-control mt-1 w-full rounded border bg-white px-3" onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Work or project name" : "업무명 또는 프로젝트명"} value={query} /></label>
        <label className="text-sm font-bold">{en ? "Site" : "사업장"}<select className="krds-control mt-1 w-full rounded border bg-white px-3" onChange={(event) => setSite(event.target.value)} value={site}><option value="">{en ? "All sites" : "전체 사업장"}</option>{sites.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm font-bold">{en ? "Work stage" : "업무 단계"}<select className="krds-control mt-1 w-full rounded border bg-white px-3" onChange={(event) => setStage(event.target.value)} value={stage}><option value="">{en ? "All stages" : "전체 단계"}</option>{stages.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm font-bold">{en ? "Due date" : "마감"}<select className="krds-control mt-1 w-full rounded border bg-white px-3" onChange={(event) => setDue(event.target.value)} value={due}><option value="">{en ? "Any date" : "전체 기간"}</option><option value="OVERDUE">{en ? "Overdue" : "기한 경과"}</option><option value="TODAY">{en ? "Due today" : "오늘 마감"}</option><option value="WEEK">{en ? "Within 7 days" : "7일 이내"}</option></select></label>
        <button className="rounded border bg-white px-4" onClick={resetFilters} type="button">{en ? "Reset" : "초기화"}</button>
      </div>
    </section>

    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800" role="alert">{error}<button className="ml-3 underline" onClick={() => void load()} type="button">{en ? "Retry" : "다시 시도"}</button></div>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
      <section className="min-w-0" aria-labelledby="assigned-work-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black text-[#172b47]" id="assigned-work-heading">{en ? "My work queue" : "내 처리 업무"}</h2><p className="mt-1 text-sm text-slate-600">{en ? "Sorted by overdue status and due date." : "기한 경과 업무와 마감일이 가까운 순으로 표시합니다."}</p></div><div className="flex items-center gap-3"><span className="text-sm text-slate-600">{en ? "As of" : "기준일"} {today.replaceAll("-", ".")}</span><button className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold" disabled={loading} onClick={() => void load()} type="button">{loading ? (en ? "Refreshing…" : "새로고침 중…") : (en ? "Refresh" : "새로고침")}</button></div></div>
        <div className="mb-4 flex gap-5 border-b border-slate-200" role="tablist" aria-label={en ? "Completion status" : "완료 여부"}>
          <button aria-selected={tab === "OPEN"} className={`border-b-[3px] px-1 py-2 text-sm font-bold ${tab === "OPEN" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-600"}`} onClick={() => { setTab("OPEN"); setMetric(""); }} role="tab" type="button">{en ? "Open" : "미완료"} <span>{allItems.filter((task) => task.status !== "DONE").length}</span></button>
          <button aria-selected={tab === "DONE"} className={`border-b-[3px] px-1 py-2 text-sm font-bold ${tab === "DONE" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-600"}`} onClick={() => { setTab("DONE"); setMetric(""); }} role="tab" type="button">{en ? "Completed" : "완료"} <span>{body?.summary?.completed ?? allItems.filter((task) => task.status === "DONE").length}</span></button>
        </div>

        {loading && !body ? <div className="rounded-xl border border-slate-200 p-10 text-center text-slate-600" aria-live="polite">{en ? "Loading assigned tasks…" : "담당 업무를 불러오는 중입니다…"}</div> : error && !body ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-800"><h3 className="font-black">{en ? "Tasks could not be loaded" : "업무를 불러오지 못했습니다"}</h3><p className="mt-2 text-sm">{error}</p><button className="mt-4 rounded border bg-white px-4" onClick={() => void load()} type="button">{en ? "Retry" : "다시 시도"}</button></div> : !loading && !error && allItems.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><h3 className="text-lg font-black">{en ? "No assigned emission tasks" : "배정된 탄소배출 업무가 없습니다"}</h3><p className="mt-2 text-sm">{en ? "New work assigned to your account will appear here." : "계정에 업무가 배정되면 이곳에서 확인할 수 있습니다."}</p><a className="mt-5 inline-flex rounded border border-blue-700 px-4 py-2 font-bold text-blue-800" href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>{en ? "View projects" : "배출량 프로젝트 보기"}</a></div> : !loading && !error && !visibleTasks.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><h3 className="text-lg font-black">{en ? "No matching work" : "조건에 맞는 업무가 없습니다"}</h3><p className="mt-2 text-sm text-slate-600">{en ? "Change the search or filters." : "검색어와 필터를 바꿔 다시 확인하세요."}</p><button className="mt-4 rounded border px-4" onClick={resetFilters} type="button">{en ? "Clear filters" : "검색 조건 초기화"}</button></div> : <div className="space-y-3" aria-live="polite">
          {visibleTasks.map((task) => {
            const overdue = isOverdue(task, today);
            const statusText = statusLabel(task.status);
            return <article aria-current={selected?.id === task.id ? "true" : undefined} className={`cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition hover:border-blue-400 ${selected?.id === task.id ? "border-2 border-blue-700 bg-blue-50/40 p-[15px]" : "border-slate-200"}`} key={task.id} onClick={() => setSelectedId(task.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(task.id); } }} role="button" tabIndex={0}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded px-2 py-1 text-xs font-bold ${STATUS_STYLE[task.status] || STATUS_STYLE.WAITING}`}>{statusText}</span><span className={`text-sm font-bold ${overdue ? "text-rose-700" : "text-slate-600"}`}>{task.status === "DONE" ? (en ? "Completed" : "완료") : overdue ? (en ? `Overdue · ${dateLabel(task.dueDate, en)}` : `기한 경과 · ${dateLabel(task.dueDate, en)}`) : task.dueDate ? `${en ? "Due" : "마감"} ${dateLabel(task.dueDate, en)}` : (en ? "No due date" : "기한 미지정")}</span></div>
              <h3 className="mt-2 font-black text-[#172b47]">{task.name}</h3><p className="mt-1 text-sm text-slate-600">{task.projectName} · {task.site || (en ? "Site unspecified" : "사업장 미지정")}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-600">{task.processName || task.processCode || (en ? "Emission work" : "배출량 업무")} {task.processStepCode ? `· ${task.processStepCode}` : ""}</span><div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                {task.status === "READY" && <button className="rounded border px-3 py-1.5 text-sm" disabled={busyTask === task.id || loading} onClick={() => void startTask(task)} type="button">{busyTask === task.id ? (en ? "Starting…" : "시작 중…") : (en ? "Start" : "업무 시작")}</button>}
                {task.actionable !== false ? <a className="rounded bg-[#06479d] px-3 py-1.5 text-sm font-bold text-white" href={taskHref(task, en)}>{en ? "Open →" : "업무 열기 →"}</a> : <button className="rounded border px-3 py-1.5 text-sm" onClick={() => setSelectedId(task.id)} type="button">{en ? "View reason" : "상세 확인"}</button>}
              </div></div>
            </article>;
          })}
        </div>}
      </section>

      <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5" aria-label={en ? "Selected task details" : "선택 업무 상세"}>
        {selected ? <>
          <div className="border-b border-slate-200 bg-slate-50 p-5"><span className={`rounded px-2 py-1 text-xs font-bold ${STATUS_STYLE[selected.status] || STATUS_STYLE.WAITING}`}>{statusLabel(selected.status)}</span><h2 className="mt-3 text-xl font-black text-[#172b47]">{selected.name}</h2><p className="mt-1 text-sm text-slate-600">{selected.projectName}</p><dl className="mt-4 grid grid-cols-[76px_1fr] gap-x-3 gap-y-2 text-sm"><dt className="text-slate-500">{en ? "Site" : "사업장"}</dt><dd className="font-bold">{selected.site || "—"}</dd><dt className="text-slate-500">{en ? "Stage" : "업무 단계"}</dt><dd className="font-bold">{selected.processName || selected.processCode || "—"}</dd><dt className="text-slate-500">{en ? "Due date" : "마감일"}</dt><dd className={`font-bold ${isOverdue(selected, today) ? "text-rose-700" : ""}`}>{dateLabel(selected.dueDate, en)}</dd><dt className="text-slate-500">{en ? "Assignee" : "담당"}</dt><dd className="font-bold">{selected.assignee || selected.actorCode || "—"}</dd></dl></div>
          <div className="space-y-5 p-5"><section><h3 className="text-sm font-black">{en ? "Request" : "요청 내용"}</h3><p className="mt-1 text-sm text-slate-600">{selected.workPurpose || (en ? "Follow the task instructions in the linked workspace." : "업무 화면에서 요청 사항과 제출 기준을 확인하세요.")}</p></section>
            <section><h3 className="text-sm font-black">{en ? "Required inputs" : "확인·입력할 자료"}</h3><p className="mt-1 break-words text-sm text-slate-600">{contractText(selected.requiredInputs, en)}</p></section>
            <section><h3 className="text-sm font-black">{en ? "Expected output" : "기대 결과"}</h3><p className="mt-1 break-words text-sm text-slate-600">{contractText(selected.expectedOutput, en)}</p></section>
            <section><h3 className="text-sm font-black">{en ? "Completion condition" : "완료 조건"}</h3><p className="mt-1 text-sm text-slate-600">{selected.completionRule || (en ? "Complete the linked task and verify its saved status." : "연결된 업무를 처리하고 저장된 상태를 확인하세요.")}</p></section>
            {(selected.pendingPredecessors || selected.blockedReason) && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>{en ? "Prerequisite / reason" : "선행 업무·차단 사유"}</strong><p className="mt-1">{selected.blockedReason || selected.pendingPredecessors}</p></div>}
            {selected.completionEvidence && <section><h3 className="text-sm font-black">{en ? "Completion evidence" : "완료 증적"}</h3><p className="mt-1 break-words text-sm text-slate-600">{selected.completionEvidence}</p></section>}
            {selected.actionable !== false ? <a className="block w-full rounded bg-[#06479d] px-4 py-3 text-center font-black text-white" href={taskHref(selected, en)}>{en ? "Open task workspace →" : "업무 화면 열기 →"}</a> : <button className="w-full rounded border px-4 py-3 font-bold" disabled type="button">{en ? "Prerequisite required" : "선행 업무 완료 후 진행 가능"}</button>}
          </div>
        </> : <div className="p-6"><h2 className="text-lg font-black">{en ? "Task details" : "업무 상세"}</h2><p className="mt-2 text-sm text-slate-600">{en ? "Select a task to review its instructions and completion conditions." : "목록에서 업무를 선택하면 요청 내용과 완료 조건을 확인할 수 있습니다."}</p></div>}
      </aside>
    </div>

    <details className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-bold">{en ? "How to process assigned work" : "업무 처리 방법"}</summary><ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-slate-600"><li>{en ? "Select a task and review required inputs and its completion condition." : "업무를 선택하고 필요한 자료와 완료 조건을 확인합니다."}</li><li>{en ? "Open the linked workspace and complete the domain action." : "연결된 업무 화면에서 입력·제출·검토 등 실제 처리를 진행합니다."}</li><li>{en ? "Return and refresh to confirm the server-updated status." : "돌아와 새로고침한 뒤 서버에 반영된 상태를 확인합니다."}</li></ol><p className="mt-2 text-sm text-slate-600">{en ? "Read status does not mean task completion. Completion follows the saved submission, calculation, or approval result." : "완료 여부는 버튼 클릭이 아니라 자료 제출·산정·승인 등 실제 저장 결과로 반영됩니다."}</p></details>
  </div>;
}
