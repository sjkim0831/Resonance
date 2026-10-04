import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CommonContentCard,
  CommonDataTable,
  CommonPageContainer,
  CommonStatusBadge,
} from "../../components/common-design/CommonDesignPrimitives";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import type { HomePayload } from "../home-entry/homeEntryTypes";
import { EmissionWorkSidebar, emissionWorkSidebarStyles } from "./EmissionWorkSidebar";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type Task = {
  id: number;
  taskCode?: string;
  stepOrder?: number;
  projectId: string;
  projectName: string;
  site: string;
  name: string;
  type?: string;
  status: string;
  priority?: string;
  assignee: string;
  dueDate: string;
  targetUrl: string;
  processCode?: string;
  processName?: string;
  processStepCode?: string;
  workPurpose?: string;
  completionRule?: string;
  completionEvidence?: string;
  blockedReason?: string;
  pendingPredecessors?: string;
  actionable?: boolean;
  updatedAt?: string;
};

type TaskPayload = { items?: Task[]; message?: string; summary?: { serverDate?: string } };
type Bucket = "ALL" | "OVERDUE" | "TODAY" | "WEEK" | "UNSCHEDULED";
type Tab = "OPEN" | "DONE";

const PAGE_SIZE = 20;
const DONE_STATUS = "DONE";
const kstDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (key: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === key)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const dayDistance = (dateKey: string, todayKey: string) =>
  Math.round((Date.parse(`${dateKey.slice(0, 10)}T00:00:00+09:00`) - Date.parse(`${todayKey}T00:00:00+09:00`)) / 86_400_000);
const taskBucket = (task: Task, todayKey: string): Bucket => {
  if (!task.dueDate) return "UNSCHEDULED";
  const distance = dayDistance(task.dueDate, todayKey);
  if (distance < 0) return "OVERDUE";
  if (distance === 0) return "TODAY";
  if (distance <= 7) return "WEEK";
  return "ALL";
};
const taskStage = (task: Task) => task.processStepCode || task.taskCode || task.type || task.processName || "";

export function EmissionDeadlineStatusPage() {
  const en = isEnglish();
  const emptyHome = useMemo<HomePayload>(() => ({ isLoggedIn: false, isEn: en, homeMenu: [] }), [en]);
  const home = useAsyncValue<HomePayload>(() => fetchHomePayload(), [en], { initialValue: emptyHome, onError: () => undefined });
  const api = buildLocalizedPath("/home/api/emission-tasks?compact=false", "/en/home/api/emission-tasks?compact=false");
  const [items, setItems] = useState<Task[]>([]);
  const [bucket, setBucket] = useState<Bucket>("ALL");
  const [tab, setTab] = useState<Tab>("OPEN");
  const [site, setSite] = useState("");
  const [stage, setStage] = useState("");
  const [assignee, setAssignee] = useState("");
  const [query, setQuery] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [sort, setSort] = useState<"DUE_ASC" | "OVERDUE_DESC">("DUE_ASC");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asOf, setAsOf] = useState(kstDateKey());
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(api, { credentials: "include", signal: nextController.signal });
      if (response.status === 401) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = buildLocalizedPath(`/signin/loginView?returnUrl=${returnUrl}`, `/en/signin/loginView?returnUrl=${returnUrl}`);
        return;
      }
      const body = await response.json() as TaskPayload;
      if (!response.ok) throw new Error(body.message || (en ? "Could not load deadline tasks." : "마감 업무를 불러오지 못했습니다."));
      if (!Array.isArray(body.items)) throw new Error(en ? "The server response is missing the task list." : "서버 응답에 업무 목록이 없습니다.");
      if (currentRequest === requestId.current && !nextController.signal.aborted) {
        setItems(body.items);
        setAsOf(body.summary?.serverDate?.slice(0, 10) || kstDateKey());
        setSelectedId((current) => body.items?.some((task) => task.id === current) ? current : body.items?.[0]?.id ?? null);
      }
    } catch (cause) {
      if ((cause as { name?: string })?.name !== "AbortError" && currentRequest === requestId.current) {
        setError(cause instanceof Error ? cause.message : (en ? "An unknown error occurred." : "알 수 없는 오류가 발생했습니다."));
      }
    } finally {
      if (currentRequest === requestId.current && !nextController.signal.aborted) setLoading(false);
    }
  }, [api, en]);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);

  const todayKey = asOf || kstDateKey();
  const openItems = useMemo(() => items.filter((task) => task.status !== DONE_STATUS), [items]);
  const doneItems = useMemo(() => items.filter((task) => task.status === DONE_STATUS), [items]);
  const counts = useMemo(() => ({
    overdue: openItems.filter((task) => taskBucket(task, todayKey) === "OVERDUE").length,
    today: openItems.filter((task) => taskBucket(task, todayKey) === "TODAY").length,
    week: openItems.filter((task) => taskBucket(task, todayKey) === "WEEK").length,
    unscheduled: openItems.filter((task) => taskBucket(task, todayKey) === "UNSCHEDULED").length,
  }), [openItems, todayKey]);
  const sites = useMemo(() => [...new Set(items.map((task) => task.site).filter(Boolean))].sort(), [items]);
  const stages = useMemo(() => [...new Set(items.map(taskStage).filter(Boolean))].sort(), [items]);
  const assignees = useMemo(() => [...new Set(items.map((task) => task.assignee).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    const source = tab === "DONE" ? doneItems : openItems;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return source.filter((task) => {
      if (tab === "OPEN" && bucket !== "ALL" && taskBucket(task, todayKey) !== bucket) return false;
      if (site && task.site !== site) return false;
      if (stage && taskStage(task) !== stage) return false;
      if (assignee && task.assignee !== assignee) return false;
      if (unassignedOnly && task.assignee) return false;
      if (normalizedQuery && !`${task.name} ${task.projectName} ${task.site} ${task.assignee} ${task.processName || ""} ${taskStage(task)}`.toLocaleLowerCase().includes(normalizedQuery)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === "OVERDUE_DESC" && tab === "OPEN") {
        const aDays = a.dueDate ? dayDistance(a.dueDate, todayKey) : Number.POSITIVE_INFINITY;
        const bDays = b.dueDate ? dayDistance(b.dueDate, todayKey) : Number.POSITIVE_INFINITY;
        if (aDays !== bDays) return aDays - bDays;
      }
      return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") || a.id - b.id;
    });
  }, [assignee, bucket, doneItems, openItems, query, site, sort, stage, tab, todayKey, unassignedOnly]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = filtered.find((task) => task.id === selectedId) || pageItems[0] || null;

  useEffect(() => { setPage(1); }, [assignee, bucket, query, site, stage, tab, unassignedOnly, sort]);
  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id); }, [selected, selectedId]);

  const copyLabel = {
    eyebrow: en ? "Carbon Emission Management" : "탄소배출 관리",
    title: en ? "Deadline & Delay Status" : "마감·지연 현황",
    desc: en ? "Find overdue and upcoming work across projects you can access." : "접근 권한이 있는 프로젝트의 마감 업무를 확인하고 필요한 업무로 이동합니다.",
  };
  const statusLabel = (value: string) => {
    if (en) return ({ READY: "Ready", IN_PROGRESS: "In progress", WAITING: "Waiting", BLOCKED: "Blocked", DONE: "Completed" } as Record<string, string>)[value] || value;
    return ({ READY: "처리 가능", IN_PROGRESS: "진행 중", WAITING: "대기", BLOCKED: "차단", DONE: "완료" } as Record<string, string>)[value] || value;
  };
  const bucketLabel = (task: Task) => {
    if (!task.dueDate) return en ? "No deadline" : "마감일 미지정";
    const distance = dayDistance(task.dueDate, todayKey);
    if (task.status === DONE_STATUS) return distance < 0 ? (en ? "Completed late" : "지연 완료") : (en ? "Completed" : "완료");
    if (distance < 0) return en ? `${Math.abs(distance)}d overdue` : `${Math.abs(distance)}일 지연`;
    if (distance === 0) return en ? "Due today" : "오늘 마감";
    if (distance <= 7) return `D-${distance}`;
    return en ? "Scheduled" : "예정";
  };
  const bucketStyle = (task: Task) => {
    if (!task.dueDate) return "bg-slate-100 text-slate-700";
    if (task.status === DONE_STATUS) return dayDistance(task.dueDate, todayKey) < 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
    const distance = dayDistance(task.dueDate, todayKey);
    if (distance < 0) return "bg-rose-100 text-rose-800";
    if (distance === 0) return "bg-amber-100 text-amber-800";
    if (distance <= 7) return "bg-blue-100 text-blue-800";
    return "bg-slate-100 text-slate-700";
  };
  const resetFilters = () => { setSite(""); setStage(""); setAssignee(""); setQuery(""); setUnassignedOnly(false); setBucket("ALL"); setTab("OPEN"); setSort("DUE_ASC"); setPage(1); };
  const openTask = (task: Task) => {
    const candidate = task.targetUrl || "/emission/project/detail";
    const internalPath = candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\") ? candidate : "/emission/project/detail";
    const target = new URL(internalPath, window.location.origin);
    if (task.projectId) target.searchParams.set("projectId", task.projectId);
    window.location.href = buildLocalizedPath(`${target.pathname}${target.search}`, `/en${target.pathname}${target.search}`);
  };
  const exportCsv = () => {
    const headers = en ? ["Deadline status", "Task", "Project", "Site", "Stage", "Assignee", "Due date", "Workflow status"] : ["마감 상태", "업무", "프로젝트", "사업장", "단계", "담당자", "마감일", "진행 상태"];
    const safeCell = (value: unknown) => {
      const text = String(value ?? "");
      const formulaSafe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${formulaSafe.replaceAll('"', '""')}"`;
    };
    const lines = [headers, ...filtered.map((task) => [bucketLabel(task), task.name, task.projectName, task.site, taskStage(task), task.assignee || (en ? "Unassigned" : "담당자 미지정"), task.dueDate, statusLabel(task.status)])];
    const blob = new Blob(["\ufeff", lines.map((line) => line.map(safeCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `deadline-status-${todayKey}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const cardData: Array<{ key: Bucket; label: string; value: number; tone: string }> = [
    { key: "OVERDUE", label: en ? "Overdue" : "기한 경과", value: counts.overdue, tone: "text-rose-700" },
    { key: "TODAY", label: en ? "Due today" : "오늘 마감", value: counts.today, tone: "text-amber-700" },
    { key: "WEEK", label: en ? "Within 7 days" : "7일 이내 마감", value: counts.week, tone: "text-blue-700" },
    { key: "UNSCHEDULED", label: en ? "No deadline" : "마감일 미지정", value: counts.unscheduled, tone: "text-slate-700" },
  ];

  return <CommonPageContainer contentClassName="!max-w-none">
    <style>{emissionWorkSidebarStyles}</style>
    <div className="ew-work-layout">
      <EmissionWorkSidebar homeMenu={home.value?.homeMenu || []} currentPath={window.location.pathname} />
      <div className="mx-auto min-w-0 w-full max-w-[1336px]">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-black tracking-tight text-slate-900">{copyLabel.title}</h1><p className="mt-1 text-slate-600">{en ? "Review work that is overdue or approaching its deadline, then continue the required action." : "마감이 임박하거나 지연된 업무를 확인하고 필요한 조치를 진행하세요."}</p></div>
      <a href={buildLocalizedPath("/emission/my-tasks", "/en/emission/my-tasks")} className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-[#074b9f] no-underline hover:bg-slate-50">{en ? "My assigned work" : "담당 업무 보기"}</a>
    </header>
    <CommonContentCard className="mb-3 grid items-end gap-3 rounded-lg bg-slate-50 p-4 shadow-none sm:grid-cols-2 xl:grid-cols-[1fr_1.8fr_1fr_1fr_auto]">
        <label className="block text-sm font-bold text-slate-700">{en ? "Site" : "사업장"}<select value={site} onChange={(event) => setSite(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal"><option value="">{en ? "All sites" : "전체 사업장"}</option>{sites.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="block text-sm font-bold text-slate-700">{en ? "Search" : "프로젝트·업무 검색"}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Project or task name" : "프로젝트명 또는 업무명"} className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 font-normal" /></label>
        <label className="block text-sm font-bold text-slate-700">{en ? "Stage" : "업무 단계"}<select value={stage} onChange={(event) => setStage(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal"><option value="">{en ? "All stages" : "전체 단계"}</option>{stages.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="block text-sm font-bold text-slate-700">{en ? "Assignee" : "담당자"}<select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal"><option value="">{en ? "All assignees" : "전체 담당자"}</option>{assignees.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <div className="flex items-end gap-2"><button type="button" onClick={resetFilters} className="h-11 rounded-md border border-slate-300 px-3 text-sm font-bold">{en ? "Reset" : "초기화"}</button><button type="button" onClick={() => void load()} disabled={loading} className="h-11 rounded-md bg-[#074b9f] px-4 text-sm font-bold text-white disabled:opacity-50">{en ? "Search" : "조회"}</button></div>
    </CommonContentCard>

    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>{en ? "Scope: projects available to your account" : "조회 범위: 로그인 계정에 허용된 프로젝트"}</span>
      <span>{en ? "As of" : "기준일"} {todayKey.replaceAll("-", ".")} · {loading ? (en ? "Refreshing…" : "조회 중…") : (en ? "Current data" : "서버 업무 데이터")}</span>
    </div>

    <section aria-label={en ? "Deadline summary" : "마감 요약"} className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cardData.map((card) => <button key={card.key} type="button" aria-pressed={tab === "OPEN" && bucket === card.key} onClick={() => { setTab("OPEN"); setBucket((current) => current === card.key ? "ALL" : card.key); }} className={`rounded-lg border p-4 text-left transition hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${tab === "OPEN" && bucket === card.key ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}>
        <span className="text-sm font-bold text-slate-600">{card.label}</span><strong className={`mt-1 block text-3xl leading-relaxed ${card.tone}`}>{loading ? "—" : card.value}<span className="ml-1 text-sm font-normal text-slate-500">{en ? "tasks" : "건"}</span></strong><span className="block text-xs text-slate-500">{card.key === "OVERDUE" ? (en ? "Incomplete work past due" : "지연된 미완료 업무") : card.key === "TODAY" ? (en ? "Work due today" : "오늘 안에 처리할 업무") : card.key === "WEEK" ? (en ? "Due within the next 7 days" : "내일부터 7일 이내 마감") : (en ? "Work that needs a deadline" : "일정 확인이 필요한 업무")}</span>
      </button>)}
    </section>

    {error && <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><strong>{en ? "Could not load deadline status." : "마감 현황을 불러오지 못했습니다."}</strong><p className="mt-1">{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded border border-rose-300 bg-white px-3 py-1.5 font-bold">{en ? "Try again" : "다시 시도"}</button></div>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section aria-label={en ? "Deadline work list" : "마감 업무 목록"} className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <h2 className="text-xl font-black">{en ? "Work deadline status" : "업무별 마감 현황"}</h2>
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">{en ? "Download list" : "목록 다운로드"}</button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3">
          <div className="flex gap-5" role="tablist" aria-label={en ? "Task status" : "업무 상태"}>
            <button role="tab" aria-selected={tab === "OPEN"} type="button" onClick={() => setTab("OPEN")} className={`border-b-2 px-1 pb-3 text-sm font-bold ${tab === "OPEN" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500"}`}>{en ? `Incomplete (${openItems.length})` : `미완료 ${openItems.length}건`}</button>
            <button role="tab" aria-selected={tab === "DONE"} type="button" onClick={() => { setTab("DONE"); setBucket("ALL"); }} className={`border-b-2 px-1 pb-3 text-sm font-bold ${tab === "DONE" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500"}`}>{en ? `Completed (${doneItems.length})` : `완료 ${doneItems.length}건`}</button>
          </div>
          <p className="pb-3 text-xs text-slate-600" aria-live="polite">{en ? `${filtered.length} matching tasks` : `조회 결과 ${filtered.length}건`}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-slate-600">
          <label className="flex items-center gap-2"><input type="checkbox" checked={unassignedOnly} onChange={(event) => setUnassignedOnly(event.target.checked)} className="h-4 w-4 accent-blue-700" />{en ? "Unassigned only" : "담당자 미지정"}</label>
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setBucket("ALL"); setTab("OPEN"); }} className="border-0 bg-transparent px-2 py-1 text-[#074b9f]">{en ? "All schedule" : "전체 일정"}</button><select aria-label={en ? "Sort tasks" : "목록 정렬"} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-9 rounded-md border border-slate-300 bg-white px-2"><option value="DUE_ASC">{en ? "Due date: earliest" : "마감일 빠른 순"}</option><option value="OVERDUE_DESC">{en ? "Most overdue first" : "지연 일수 큰 순"}</option></select><button type="button" onClick={() => void load()} disabled={loading} aria-label={en ? "Refresh task list" : "목록 새로고침"} className="rounded-md border border-slate-300 bg-white px-3 py-2 disabled:opacity-50">↻</button></div>
        </div>
        <CommonDataTable label={en ? "Deadline and delay task list" : "마감·지연 업무 목록"}>
          <thead className="bg-slate-50 text-xs font-bold text-slate-600"><tr>{(en ? ["Deadline", "Task / project", "Site / assignee", "Due date", "Status"] : ["마감 상태", "업무 / 프로젝트", "사업장 / 담당자", "마감일", "진행 상태"]).map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3">{heading}</th>)}</tr></thead>
          <tbody>{pageItems.map((task) => <tr key={task.id} className={`border-t border-slate-200 ${selected?.id === task.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
            <td className="whitespace-nowrap px-4 py-4"><CommonStatusBadge className={bucketStyle(task)}>{bucketLabel(task)}</CommonStatusBadge></td>
            <td className="min-w-[230px] px-4 py-4"><button type="button" onClick={() => setSelectedId(task.id)} aria-pressed={selected?.id === task.id} className="text-left font-bold text-blue-800 underline-offset-2 hover:underline">{task.name || (en ? "Untitled task" : "업무명 없음")}</button><span className="mt-1 block text-xs text-slate-600">{task.projectName || task.projectId}</span><span className="mt-1 block text-xs text-slate-500">{task.processName || task.processCode || taskStage(task) || "—"}</span></td>
            <td className="whitespace-nowrap px-4 py-4">{task.site || "—"}<span className="mt-1 block text-xs text-slate-600">{task.assignee || (en ? "Unassigned" : "담당자 미지정")}</span></td>
            <td className="whitespace-nowrap px-4 py-4 font-semibold">{task.dueDate?.slice(0, 10) || "—"}</td>
            <td className="whitespace-nowrap px-4 py-4"><CommonStatusBadge className={task.status === "BLOCKED" ? "bg-rose-100 text-rose-800" : task.status === "DONE" ? "bg-emerald-100 text-emerald-800" : task.status === "IN_PROGRESS" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-700"}>{statusLabel(task.status)}</CommonStatusBadge></td>
          </tr>)}</tbody>
        </CommonDataTable>
        {!loading && !error && filtered.length === 0 && <div className="px-6 py-14 text-center"><p className="font-bold text-slate-800">{en ? "No matching tasks" : "조건에 맞는 업무가 없습니다."}</p><p className="mt-2 text-sm text-slate-600">{en ? "Change filters or clear them to see other tasks." : "검색 조건을 바꾸거나 초기화해 다른 업무를 확인하세요."}</p><button type="button" onClick={resetFilters} className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-bold">{en ? "Clear filters" : "조건 초기화"}</button></div>}
        {loading && <p role="status" className="px-6 py-12 text-center text-sm text-slate-600">{en ? "Loading tasks…" : "업무 데이터를 불러오는 중입니다…"}</p>}
        {!loading && !error && filtered.length > 0 && <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm"><span>{en ? `Page ${currentPage} of ${pageCount}` : `${currentPage} / ${pageCount} 페이지`}</span><div className="flex gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">{en ? "Previous" : "이전"}</button><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">{en ? "Next" : "다음"}</button></div></div>}
      </section>

      <CommonContentCard aria-label={en ? "Selected task details" : "선택 업무 상세"} className="rounded-lg shadow-none xl:sticky xl:top-5">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><p className="text-xs font-bold text-blue-800">{en ? "TASK DETAILS" : "업무 상세"}</p><h2 className="mt-2 text-lg font-black">{selected?.name || (en ? "Select a task" : "업무를 선택하세요")}</h2><p className="mt-1 text-sm text-slate-600">{selected?.projectName || ""}</p></div>
        {selected ? <div className="space-y-4 p-5">
          <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-3 text-sm"><dt className="text-slate-500">{en ? "Site" : "사업장"}</dt><dd className="m-0 font-bold">{selected.site || "—"}</dd><dt className="text-slate-500">{en ? "Assignee" : "담당자"}</dt><dd className="m-0 font-bold">{selected.assignee || (en ? "Unassigned" : "미지정")}</dd><dt className="text-slate-500">{en ? "Stage" : "업무 단계"}</dt><dd className="m-0 font-bold">{selected.processName || taskStage(selected) || "—"}</dd><dt className="text-slate-500">{en ? "Due date" : "마감일"}</dt><dd className="m-0 font-bold">{selected.dueDate?.slice(0, 10) || (en ? "Not set" : "미지정")}</dd><dt className="text-slate-500">{en ? "Status" : "진행 상태"}</dt><dd className="m-0 font-bold">{statusLabel(selected.status)}</dd></dl>
          {selected.blockedReason && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"><strong>{en ? "Blocked reason" : "차단 사유"}</strong><p className="mt-1 text-slate-700">{selected.blockedReason}</p></div>}
          {selected.pendingPredecessors && <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"><strong>{en ? "Pending prerequisites" : "선행 조건"}</strong><p className="mt-1 text-slate-700">{selected.pendingPredecessors}</p></div>}
          {(selected.workPurpose || selected.completionRule || selected.completionEvidence) && <div><h3 className="text-sm font-bold">{en ? "Purpose and completion criteria" : "업무 목적·완료 조건"}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.workPurpose || selected.completionRule || selected.completionEvidence}</p></div>}
          <button type="button" disabled={selected.actionable === false} onClick={() => openTask(selected)} className="w-full rounded-md bg-[#074b9f] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{en ? "Open task" : "업무 열기"}　→</button>
          {selected.actionable === false && <p className="text-xs text-slate-600">{en ? "This task is not actionable for the current account." : "현재 계정에서 이 업무를 처리할 권한이 없습니다."}</p>}
        </div> : <div className="p-5 text-sm text-slate-600">{en ? "Task details will appear here after a task is selected." : "목록에서 업무를 선택하면 서버에 저장된 상세 내용이 표시됩니다."}</div>}
      </CommonContentCard>
    </div>
    <details className="mt-5 rounded-md border border-slate-200 bg-white p-4 text-sm"><summary className="cursor-pointer font-bold">{en ? "Deadline rules and data scope" : "마감 판정·조회 기준"}</summary><p className="mt-3 text-slate-600">{en ? "Deadlines are classified using the Asia/Seoul calendar date. Completed work is excluded from open counts. Tasks without a due date are shown separately. Scope follows the tasks returned by the server for the signed-in account." : "한국시간 기준 날짜로 마감 상태를 표시합니다. 완료 업무는 미완료 요약에서 제외하고, 마감일이 없는 업무는 별도로 표시합니다. 조회 범위는 로그인 계정에 대해 서버가 반환한 업무로 제한됩니다."}</p></details>
      </div>
    </div>
  </CommonPageContainer>;
}
