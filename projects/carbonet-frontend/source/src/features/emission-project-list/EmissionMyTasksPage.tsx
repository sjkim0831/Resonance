import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HomeInlineStyles,
} from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
type Task = {
  id: number;
  projectId: string;
  projectName: string;
  site: string;
  name: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  dueDate: string;
  targetUrl: string;
  processCode?: string;
  processStepCode?: string;
  actorCode?: string;
  completionRule?: string;
  blockedReason?: string;
  pendingPredecessors?: string;
  actionable?: boolean;
};
type Data = {
  items: Task[];
  actorId: string;
  allVisible: boolean;
  summary: {
    total: number;
    completed: number;
    today: number;
    overdue: number;
    approval: number;
  };
};
export function EmissionMyTasksPage() {
  const en = isEnglish(),
    content = LOCALIZED_CONTENT[en ? "en" : "ko"],
    home = useAsyncValue(() => fetchHomePayload(), [en]);
  const [data, setData] = useState<Data | null>(null),
    [period, setPeriod] = useState(""),
    [status, setStatus] = useState(""),
    [message, setMessage] = useState("");
  const api = buildLocalizedPath(
    "/home/api/emission-tasks",
    "/en/home/api/emission-tasks",
  );
  async function load() {
    const r = await fetch(`${api}?status=${status}&period=${period}`, {
      credentials: "include",
    });
    if (r.status === 401) {
      const returnUrl = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.href = buildLocalizedPath(
        `/signin/loginView?returnUrl=${returnUrl}`,
        `/en/signin/loginView?returnUrl=${returnUrl}`,
      );
      return;
    }
    const b = await r.json();
    if (!r.ok) throw new Error(b.message);
    setData(b);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [status, period]);
  async function update(id: number, next: string) {
    const r = await fetch(`${api}/${id}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      }),
      b = await r.json();
    if (!r.ok) throw new Error(b.message);
    await load();
  }
  function href(t: Task) {
    const glue = t.targetUrl.includes("?") ? "&" : "?";
    return buildLocalizedPath(
      `${t.targetUrl}${glue}projectId=${t.projectId}`,
      `/en${t.targetUrl}${glue}projectId=${t.projectId}`,
    );
  }
  return (
    <>
      <HomeInlineStyles en={en} />
      <div className="min-h-screen bg-[#f5f7fa]">
        <header className="border-b-2 border-[#001e40] bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 lg:px-8">
            <HeaderBrand content={content} en={en} />
            <HeaderDesktopNav en={en} homeMenu={home.value?.homeMenu || []} />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <p className="font-bold text-blue-700">
            {en ? "Carbon Emission Management" : "탄소배출 관리"}
          </p>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-black text-[#052b57]">
                {en ? "My Tasks" : "내 업무"}
              </h1>
              <p className="mt-2 text-slate-600">
                {data?.allVisible
                  ? en
                    ? "Webmaster view: all assigned tasks"
                    : "관리자 권한으로 전체 담당 업무를 표시합니다."
                  : en
                    ? `Tasks assigned to ${data?.actorId || "me"}`
                    : `${data?.actorId || "내게"} 배정된 업무입니다.`}
              </p>
            </div>
            <div className="flex gap-2">
              <select
                className="h-11 rounded-lg border bg-white px-3"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="">{en ? "All dates" : "전체 일정"}</option>
                <option value="TODAY">{en ? "Due today" : "오늘 마감"}</option>
                <option value="WEEK">{en ? "This week" : "이번 주"}</option>
                <option value="OVERDUE">{en ? "Overdue" : "지연"}</option>
              </select>
              <select
                className="h-11 rounded-lg border bg-white px-3"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{en ? "All statuses" : "전체 상태"}</option>
                <option value="READY">{en ? "Ready" : "실행 가능"}</option>
                <option value="WAITING">{en ? "Waiting" : "대기"}</option>
                <option value="IN_PROGRESS">
                  {en ? "In progress" : "진행 중"}
                </option>
                <option value="BLOCKED">{en ? "Blocked" : "차단"}</option>
                <option value="DONE">{en ? "Done" : "완료"}</option>
              </select>
            </div>
          </div>
          {message && (
            <p className="mt-4 rounded bg-red-50 p-3 font-bold text-red-700">
              {message}
            </p>
          )}
          <section className="mt-6 rounded-2xl border border-blue-200 bg-gradient-to-r from-[#edf5ff] to-white p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <p className="text-sm font-bold text-blue-700">
                  {en ? "Recommended workflow" : "권장 업무 흐름"}
                </p>
                <h2 className="mt-1 text-xl font-black text-[#052b57]">
                  {en
                    ? "Select a task, verify its data, then submit it for review"
                    : "업무 선택 → 활동자료 입력 → 품질검사 → 제출·검토"}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {en
                    ? "The next action is calculated from the project task state and due date."
                    : "프로젝트 단계와 마감일을 기준으로 지금 처리할 업무를 우선순위대로 제공합니다."}
                </p>
              </div>
              <a
                className="inline-flex h-11 items-center justify-center rounded-lg border border-blue-600 bg-white px-5 font-bold text-blue-700"
                href={buildLocalizedPath(
                  "/emission/project_list",
                  "/en/emission/project_list",
                )}
              >
                {en ? "View all projects" : "전체 프로젝트 보기"}
              </a>
            </div>
          </section>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              [en ? "Total" : "전체", data?.summary.total || 0],
              [en ? "Due today" : "오늘 마감", data?.summary.today || 0],
              [en ? "Overdue" : "지연", data?.summary.overdue || 0],
              [en ? "Approval" : "승인 대기", data?.summary.approval || 0],
              [en ? "Completed" : "완료", data?.summary.completed || 0],
            ].map(([l, v]) => (
              <div className="rounded-xl border bg-white p-5" key={l}>
                <p className="text-sm font-bold text-slate-500">{l}</p>
                <strong className="mt-2 block text-3xl text-[#052b57]">
                  {v}
                </strong>
              </div>
            ))}
          </section>
          <section className="mt-5 overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-slate-100">
                <tr>
                  {(en
                    ? [
                        "Priority",
                        "Task / Project",
                        "Site",
                        "Assignee",
                        "Due",
                        "Status",
                        "Action",
                      ]
                    : [
                        "우선순위",
                        "업무·프로젝트",
                        "사업장",
                        "담당자",
                        "마감일",
                        "상태",
                        "처리",
                      ]
                  ).map((x) => (
                    <th className="p-4" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((t) => (
                  <tr className="border-b" key={t.id}>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-black ${t.priority === "URGENT" ? "bg-red-100 text-red-700" : t.priority === "HIGH" ? "bg-orange-100 text-orange-700" : "bg-slate-100"}`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <strong>{t.name}</strong>
                      <span className="mt-1 block text-xs font-bold text-slate-500">
                        {t.actorCode || t.type}
                      </span>
                      <a
                        className="block text-sm text-blue-700"
                        href={buildLocalizedPath(
                          `/emission/project/detail?id=${t.projectId}`,
                          `/en/emission/project/detail?id=${t.projectId}`,
                        )}
                      >
                        {t.projectName}
                      </a>
                    </td>
                    <td>{t.site}</td>
                    <td>{t.assignee}</td>
                    <td
                      className={
                        new Date(t.dueDate) < new Date() && t.status !== "DONE"
                          ? "font-bold text-red-700"
                          : ""
                      }
                    >
                      {t.dueDate}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-black ${t.status === "DONE" ? "bg-green-100 text-green-800" : t.actionable ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-700"}`}>
                        {t.status}
                      </span>
                      {(t.blockedReason || t.pendingPredecessors) && (
                        <p className="mt-2 max-w-48 text-xs leading-5 text-red-700">
                          {t.pendingPredecessors || t.blockedReason}
                        </p>
                      )}
                    </td>
                    <td>
                      {t.actionable ? <div className="flex flex-col gap-2">
                        {t.status === "READY" && <button className="rounded-lg border border-[#246beb] bg-white px-4 py-2 font-bold text-[#246beb]" onClick={() => update(t.id,"IN_PROGRESS").catch(err=>setMessage(err.message))}>{en ? "Start" : "업무 시작"}</button>}
                        <a className="inline-flex justify-center rounded-lg bg-[#246beb] px-4 py-2 font-bold text-white" href={href(t)}>{en ? "Open" : "업무 열기"}</a>
                      </div> : <span className="text-xs font-bold text-slate-500">{t.status === "DONE" ? (en ? "Completed by workflow" : "프로세스로 완료") : (en ? "Complete prerequisites first" : "선행 업무 완료 필요")}</span>}
                    </td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr>
                    <td className="p-10 text-center text-slate-500" colSpan={7}>
                      {en
                        ? "No tasks match the filters."
                        : "조건에 맞는 업무가 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </>
  );
}
