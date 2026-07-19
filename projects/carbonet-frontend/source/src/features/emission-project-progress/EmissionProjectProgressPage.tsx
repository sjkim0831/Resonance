import { useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { HeaderBrand, HeaderDesktopNav, HomeInlineStyles } from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";

type Task = { code: string; name: string; order: number; status: string; weight: number; dueDate: string };
type Detail = {
  id: string;
  name: string;
  site: string;
  period: string;
  scope: string;
  owner: string;
  progress: number;
  step: string;
  dueDate: string;
  status: string;
  tasks: Task[];
  members: { name: string; role: string }[];
};

const stages = [
  { code: "SETUP", ko: "기본정보 확정", en: "Project Setup", actor: "기업 책임자", path: "/emission/project/create", rule: "조직·사업장·기간·Scope·담당자·마감 확정" },
  { code: "COLLECT", ko: "활동자료·증빙", en: "Data & Evidence", actor: "자료 담당자", path: "/emission/data_input", rule: "필수값·단위·증빙 누락 0건" },
  { code: "CALCULATE", ko: "매핑·산정", en: "Map & Calculate", actor: "산정 담당자", path: "/emission/calculation", rule: "계수·환산·계산근거 연결 완료" },
  { code: "VALIDATE", ko: "검증", en: "Validation", actor: "검증 담당자", path: "/emission/validate", rule: "검증 오류 0건 또는 보완 요청" },
  { code: "CORRECT", ko: "보완·재산정", en: "Correction", actor: "자료·산정 담당자", path: "/emission/data_input?mode=correction", rule: "보완 사유·변경 이력·재산정 기록" },
  { code: "APPROVE", ko: "검토·승인", en: "Approval", actor: "승인권자", path: "/emission/validate?tab=approval", rule: "승인 의견과 결과 버전 확정" },
  { code: "REPORT", ko: "보고·제출", en: "Report & Submit", actor: "기업 책임자", path: "/emission/report_submit", rule: "보고서 생성·제출·진위검증 가능" },
];

const stepStatusMap: Record<string, string> = {
  BASIC_INFO: "SETUP",
  ACTIVITY_DATA: "COLLECT",
  CALCULATION: "CALCULATE",
  VERIFICATION: "VALIDATE",
  CORRECTION: "CORRECT",
  APPROVAL: "APPROVE",
  REPORT: "REPORT",
};

function getTaskStatus(code: string, tasks: Task[]): string {
  const task = tasks.find((t) => t.code === code);
  return task?.status ?? "WAITING";
}

function statusTone(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case "DONE":
      return { bg: "bg-emerald-100", text: "text-emerald-700", label: "완료" };
    case "IN_PROGRESS":
      return { bg: "bg-blue-100", text: "text-blue-700", label: "진행중" };
    case "READY":
      return { bg: "bg-amber-100", text: "text-amber-700", label: "대기" };
    case "BLOCKED":
      return { bg: "bg-red-100", text: "text-red-700", label: "차단" };
    default:
      return { bg: "bg-slate-100", text: "text-slate-600", label: "대기" };
  }
}

export function EmissionProjectProgressPage() {
  const en = isEnglish();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const home = useAsyncValue(() => fetchHomePayload(), [en]);

  const id = new URLSearchParams(location.search).get("id") ?? "";
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  const api = buildLocalizedPath(
    `/home/api/emission-projects/${encodeURIComponent(id)}`,
    `/en/home/api/emission-projects/${encodeURIComponent(id)}`
  );

  useEffect(() => {
    if (!id) {
      setError(en ? "Select a project first." : "프로젝트를 먼저 선택해 주세요.");
      return;
    }
    fetch(api, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error(en ? "Project not found." : "프로젝트를 찾을 수 없습니다.");
        return response.json();
      })
      .then(setData)
      .catch((reason) => setError(String(reason?.message ?? reason)));
  }, [api, en, id]);

  const completed = useMemo(
    () => data?.tasks?.filter((task) => task.status === "DONE").length ?? 0,
    [data]
  );

  const currentStageIndex = useMemo(() => {
    if (!data?.step) return -1;
    const current = stages.findIndex(
      (s) => s.code === stepStatusMap[data.step] || data.step.includes(s.code)
    );
    return current;
  }, [data?.step]);

  const pathFor = (path: string) => {
    const localized = buildLocalizedPath(path, path.startsWith("/en") ? path : `/en${path}`);
    return `${localized}${path.includes("?") ? "&" : "?"}projectId=${encodeURIComponent(id)}`;
  };

  return (
    <>
      <HomeInlineStyles en={en} />
      <div className="min-h-screen bg-[#f5f7fa]">
        <header className="border-b-2 border-[#001e40] bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 lg:px-8">
            <HeaderBrand content={content} en={en} />
            <HeaderDesktopNav en={en} homeMenu={home.value?.homeMenu ?? []} />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <nav className="text-sm text-slate-500">
            <a href={buildLocalizedPath("/emission/project_list", "/en/emission/project_list")}>
              {en ? "Emission Projects" : "배출량 프로젝트"}
            </a>
            <span className="mx-2">/</span>
            <span>{en ? "Process Progress" : "프로세스 진행"}</span>
          </nav>

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-700">
              {error}
            </div>
          )}

          {!data && !error && <p className="mt-8">{en ? "Loading..." : "불러오는 중..."}</p>}

          {data && (
            <>
              <section className="mt-5 rounded-2xl bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                  <div>
                    <div className="text-sm font-bold text-blue-200">
                      {data.id} · {data.status}
                    </div>
                    <h1 className="mt-2 text-3xl font-black">{data.name}</h1>
                    <p className="mt-2 text-blue-100">
                      {data.site} · {data.period} · {data.scope}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a
                      className="rounded-lg bg-white px-4 py-3 font-bold text-blue-800"
                      href={buildLocalizedPath(
                        "/admin/system/actor-process?process=EMISSION_PROJECT",
                        "/en/admin/system/actor-process?process=EMISSION_PROJECT"
                      )}
                    >
                      {en ? "Simulation Contract" : "시뮬레이션 계약"}
                    </a>
                    <a
                      className="rounded-lg border border-white/50 px-4 py-3 font-bold"
                      href={pathFor("/emission/project/detail")}
                    >
                      {en ? "Project Detail →" : "상세 페이지 →"}
                    </a>
                  </div>
                </div>
              </section>

              <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [en ? "Progress" : "진행률", `${data.progress}%`],
                  [en ? "Current Step" : "현재 단계", data.step],
                  [en ? "Owner" : "책임자", data.owner],
                  [en ? "Due Date" : "마감일", data.dueDate],
                ].map(([label, val]) => (
                  <div className="rounded-xl border bg-white p-5" key={label as string}>
                    <p className="text-sm font-bold text-slate-500">{label as string}</p>
                    <strong className="mt-2 block text-xl text-[#052b57]">{val as string || "-"}</strong>
                  </div>
                ))}
              </section>

              <section className="mt-5 rounded-2xl border bg-white p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-[#052b57]">
                      {en ? "Process Workflow" : "프로세스 워크플로우"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {en
                        ? "7-step process with actors and completion rules."
                        : "액터와 완료 조건이 지정된 7단계 프로세스입니다."}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-blue-700">
                    {completed} / {data.tasks?.length ?? 0}{" "}
                    {en ? "tasks complete" : "태스크 완료"}
                  </span>
                </div>

                <div className="mt-6 relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
                  <div className="space-y-4">
                    {stages.map((stage, index) => {
                      const taskStatus = getTaskStatus(stage.code, data.tasks ?? []);
                      const tone = statusTone(taskStatus);
                      const isCurrent = index === currentStageIndex;
                      const isPast = index < currentStageIndex;
                      const isFuture = index > currentStageIndex;

                      return (
                        <div key={stage.code} className="relative flex gap-4">
                          <div
                            className={`relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-black ${
                              isPast
                                ? "bg-emerald-500 text-white"
                                : isCurrent
                                ? "bg-blue-600 text-white ring-4 ring-blue-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div
                            className={`flex-1 rounded-xl border p-4 transition ${
                              isPast
                                ? "border-emerald-200 bg-emerald-50"
                                : isCurrent
                                ? "border-blue-300 bg-blue-50"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-blue-700">
                                    STEP {index + 1} · {stage.code}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone.bg} ${tone.text}`}
                                  >
                                    {tone.label}
                                  </span>
                                </div>
                                <strong
                                  className={`mt-1 block text-lg ${
                                    isFuture ? "text-slate-400" : "text-[#052b57]"
                                  }`}
                                >
                                  {en ? stage.en : stage.ko}
                                </strong>
                                <p className="mt-1 text-sm text-slate-500">
                                  <span className="font-bold">{stage.actor}</span> ·{" "}
                                  {stage.rule}
                                </p>
                              </div>
                              {!isFuture && (
                                <a
                                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                                    isPast
                                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                      : "bg-blue-600 text-white hover:bg-blue-700"
                                  }`}
                                  href={pathFor(stage.path)}
                                >
                                  {isPast
                                    ? en
                                      ? "View →"
                                      : "보기 →"
                                    : isCurrent
                                    ? en
                                      ? "Work →"
                                      : "작업 →"
                                    : ""}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="mt-5 rounded-2xl border bg-white p-6">
                <h2 className="text-xl font-black text-[#052b57]">
                  {en ? "Assigned Actors" : "배정된 액터"}
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.members?.length ? (
                    data.members.map((member, index) => (
                      <div
                        key={`${member.name}-${index}`}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#052b57] text-sm font-black text-white">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <strong className="text-[#052b57]">{member.name}</strong>
                          <p className="text-sm text-slate-500">{member.role}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-amber-700">
                      {en
                        ? "Assign project actors before data collection."
                        : "자료수집 전에 프로젝트 액터를 배정해야 합니다."}
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
