import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import {
  isEnglishLocale,
  localizedPath,
} from "../../lib/navigation/localePath";
import { CommonPageContainer } from "../../components/common-design/CommonDesignPrimitives";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import {
  AdminSelect,
  AdminTable,
  MemberButton,
  MemberSectionToolbar,
} from "../member/common";

type Project = { projectId: string; projectName: string };
type Account = { accountId: string; accountName: string; department?: string };
type AssignedTask = {
  taskId?: number;
  assignmentKey: string;
  sourceType: "PROJECT_TASK" | "ACTIVITY_REQUEST" | "WORK_DRAFT";
  projectId?: string;
  projectName?: string;
  taskName: string;
  status: string;
  targetUrl?: string;
  processCode?: string;
  processName: string;
  workTypeCode: string;
  workTypeName: string;
  stepCode?: string;
  stepName?: string;
};
type Delegation = {
  delegationId: string;
  projectId: string;
  predecessorAccountId: string;
  successorAccountId: string;
  reason: string;
  status: string;
  requestedBy?: string;
  requestedAt?: string;
};
type Workspace = {
  canRequest: boolean;
  canApprove: boolean;
  projects: Project[];
  accounts: Account[];
  assignees: Account[];
  selectedAccount?: string;
  assignedTasks: AssignedTask[];
  assignmentCoverage?: {
    projectTaskCount: number;
    activityRequestCount: number;
    workDraftCount: number;
    returnedCount: number;
    verified: boolean;
    sourceCount?: number;
  };
  items: Delegation[];
};

const STATUS: Record<string, string> = {
  REQUESTED: "승인 대기",
  APPROVED: "인계 대기",
  COMPLETED: "인계 완료",
  REJECTED: "반려",
  CANCELLED: "취소",
};

export function CompanyManagerDelegationPage() {
  const en = isEnglishLocale();
  const isAdmin = location.pathname.includes("/admin/");
  const session = useFrontendSession();
  const initialProject =
    new URLSearchParams(location.search).get("projectId") || "";
  const requestedStep =
    new URLSearchParams(location.search).get("step")?.toLowerCase() ||
    new URLSearchParams(location.search).get("stepCode")?.toLowerCase() ||
    "cmd_request";
  const isHandoverStep = requestedStep.includes("handover");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projectId, setProjectId] = useState(initialProject);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [successor, setSuccessor] = useState("");
  const [successorKeyword, setSuccessorKeyword] = useState("");
  const [reason, setReason] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [workTypeFilter, setWorkTypeFilter] = useState("");
  const [processFilter, setProcessFilter] = useState("");
  const [stepFilter, setStepFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const csrf = useMemo(
    () =>
      session.value?.csrfHeaderName && session.value.csrfToken
        ? { [session.value.csrfHeaderName]: session.value.csrfToken }
        : {},
    [session.value],
  );

  function redirectToAdminLogin() {
    window.sessionStorage.removeItem("adminSessionExpireAt");
    const loginPath = localizedPath(
      "/admin/login/loginView",
      "/en/admin/login/loginView",
    );
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function json(response: Response) {
    const text = await response.text();
    if (!text.trim())
      throw new Error(
        response.ok
          ? "서버 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요."
          : `업무 정보를 불러오지 못했습니다. (HTTP ${response.status})`,
      );
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(
        `올바르지 않은 서버 응답입니다. (HTTP ${response.status})`,
      );
    }
    const authenticationRequired =
      response.status === 401 ||
      body?.code === "AUTHENTICATION_REQUIRED" ||
      body?.error === "AUTHENTICATION_REQUIRED" ||
      body?.message === "AUTHENTICATION_REQUIRED";
    if (authenticationRequired && isAdmin) {
      redirectToAdminLogin();
      throw new Error("AUTHENTICATION_REDIRECT");
    }
    if (!response.ok)
      throw new Error(body?.message || `HTTP ${response.status}`);
    return body;
  }
  async function fetchWorkspace(query: string) {
    const url = `${localizedPath("/home/api/company-manager-delegations", "/en/home/api/company-manager-delegations")}${query}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return (await json(
          await fetch(url, {
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "Cache-Control": "no-cache",
            },
          }),
        )) as Workspace;
      } catch (error) {
        if (error instanceof Error && error.message === "AUTHENTICATION_REDIRECT")
          throw error;
        if (attempt === 2) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 400 * (attempt + 1)),
        );
      }
    }
    throw new Error("업무 정보를 불러오지 못했습니다.");
  }
  async function load(next = projectId, nextAccount = selectedAccount) {
    const params = new URLSearchParams();
    if (next) params.set("projectId", next);
    if (nextAccount) params.set("accountId", nextAccount);
    const query = params.size ? `?${params.toString()}` : "";
    const body = await fetchWorkspace(query);
    const selected = next || body.projects?.[0]?.projectId || "";
    setWorkspace(body);
    setProjectId(selected);
    setSelectedAccount(nextAccount || body.selectedAccount || "");
    setSelectedTaskIds([]);
    if (isAdmin && !next && selected) {
      await load(selected, "");
      return;
    }
    if (body.canApprove && !nextAccount && body.assignees?.[0]?.accountId)
      await load(selected, body.assignees[0].accountId);
  }
  useEffect(() => {
    void load().catch((error) => setMessage(String(error.message || error)));
  }, []);

  async function command(url: string, body?: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await json(
        await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...csrf,
          },
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
      await load();
      setMessage(
        en
          ? "The workflow state was saved."
          : "업무 상태와 감사 이력을 저장했습니다.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  const base = localizedPath(
    "/home/api/company-manager-delegations",
    "/en/home/api/company-manager-delegations",
  );
  const request = () =>
    command(base, {
      projectId:
        workspace?.assignedTasks.find((task) =>
          selectedTaskIds.includes(task.assignmentKey),
        )?.projectId || projectId,
      successorAccountId: successor,
      reason,
      taskRefs: selectedTaskIds,
      idempotencyKey: crypto.randomUUID(),
    });
  const workTypes = useMemo(
    () =>
      Array.from(
        new Map(
          (workspace?.assignedTasks || []).map((task) => [
            task.workTypeCode,
            task.workTypeName,
          ]),
        ).entries(),
      ),
    [workspace?.assignedTasks],
  );
  const processes = useMemo(
    () =>
      Array.from(
        new Map(
          (workspace?.assignedTasks || [])
            .filter(
              (task) => !workTypeFilter || task.workTypeCode === workTypeFilter,
            )
            .map((task) => [
              task.processCode || task.processName,
              task.processName,
            ]),
        ).entries(),
      ),
    [workspace?.assignedTasks, workTypeFilter],
  );
  const steps = useMemo(
    () =>
      Array.from(
        new Map(
          (workspace?.assignedTasks || [])
            .filter(
              (task) =>
                (!workTypeFilter || task.workTypeCode === workTypeFilter) &&
                (!processFilter ||
                  (task.processCode || task.processName) === processFilter),
            )
            .map((task) => [
              task.stepCode || task.assignmentKey,
              task.stepName || task.taskName,
            ]),
        ).entries(),
      ),
    [workspace?.assignedTasks, workTypeFilter, processFilter],
  );
  const filteredTasks = useMemo(
    () =>
      (workspace?.assignedTasks || []).filter(
        (task) =>
          (!workTypeFilter || task.workTypeCode === workTypeFilter) &&
          (!processFilter ||
            (task.processCode || task.processName) === processFilter) &&
          (!stepFilter ||
            (task.stepCode || task.assignmentKey) === stepFilter),
      ),
    [workspace?.assignedTasks, workTypeFilter, processFilter, stepFilter],
  );
  const toggleTask = (taskId: string) => {
    const task = workspace?.assignedTasks.find(
      (candidate) => candidate.assignmentKey === taskId,
    );
    setSelectedTaskIds((current) => {
      if (current.includes(taskId)) {
        return current.filter((id) => id !== taskId);
      }
      const selectedProject = workspace?.assignedTasks.find((candidate) =>
        current.includes(candidate.assignmentKey),
      )?.projectId;
      if (selectedProject && task && selectedProject !== task.projectId) {
        setMessage("한 번의 위임 요청에는 같은 프로젝트의 업무만 선택할 수 있습니다.");
        return current;
      }
      setMessage("");
      return [...current, taskId];
    });
  };

  const selectFilteredTasks = () => {
    const selectedProject = filteredTasks[0]?.projectId;
    const sameProjectTasks = filteredTasks.filter(
      (task) => task.projectId === selectedProject,
    );
    setSelectedTaskIds(sameProjectTasks.map((task) => task.assignmentKey));
    setMessage(
      sameProjectTasks.length < filteredTasks.length
        ? "한 번의 위임 요청 단위에 맞춰 첫 번째 프로젝트의 업무만 선택했습니다."
        : "",
    );
  };

  const content = (
    <>
      {!isAdmin ? (
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-black text-[#246beb]">
            {isAdmin ? "회원·권한 관리" : en ? "MY PAGE" : "마이페이지"}
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#052b57]">
            {isAdmin
              ? "관리자 위임·승계 검토"
              : en
                ? "Company manager delegation"
                : isHandoverStep
                  ? "미결업무 인계·통지·종결"
                  : "회원사 관리자 위임·승계 신청"}
          </h1>
          <p className="mt-2 text-slate-600">
            {isAdmin
              ? "담당 업무와 위임 신청을 검토하고 권한 변경을 승인하거나 반려합니다."
              : en
                ? "Select assigned work and a successor, then request delegation approval."
                : isHandoverStep
                  ? "승인된 위임의 미결업무를 후임자에게 인계하고 양쪽 통지와 종결 상태를 확인합니다."
                  : "내 담당 업무를 선택하고 후임 관리자를 지정하여 승계 승인을 요청합니다."}
          </p>
        </header>
      ) : null}

      {isAdmin ? (
        <section
          className={
            isAdmin
              ? "gov-card mb-8 overflow-hidden"
              : "mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          }
        >
          <div
            className={
              isAdmin
                ? "border-b border-[var(--kr-gov-border-light)] px-6 py-5"
                : ""
            }
          >
            {isAdmin ? (
              <MemberSectionToolbar
                meta="프로젝트와 기존 담당자를 선택하여 위임 검토 범위를 조회합니다."
                title="검색 조건"
              />
            ) : null}
            <h2
              className={
                isAdmin
                  ? "text-lg font-black text-[#052b57]"
                  : "text-xl font-black text-[#052b57]"
              }
            >
              {isAdmin ? "" : en ? "Delegation scope" : "위임 대상 업무"}
            </h2>
            <p className={isAdmin ? "hidden" : "mt-1 text-sm text-slate-600"}>
              {isAdmin
                ? "프로젝트와 기존 담당자를 선택하여 배정 업무와 위임 범위를 확인하세요."
                : en
                  ? "Choose the project whose manager responsibilities will be transferred."
                  : "관리 책임과 진행 중인 업무를 인계할 프로젝트를 선택하세요."}
            </p>
          </div>
          <div
            className={
              isAdmin
                ? "grid gap-6 px-6 py-6 md:grid-cols-2"
                : "mt-5 grid gap-4 md:grid-cols-2"
            }
          >
            <label className="block text-sm font-black text-[#052b57]">
              {en ? "Project" : "인계 대상 프로젝트"}
              {isAdmin ? (
                <AdminSelect
                  id="delegation-project"
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setSelectedAccount("");
                    void load(event.target.value, "");
                  }}
                >
                  <option value="">프로젝트 선택</option>
                  {(workspace?.projects || []).map((item) => (
                    <option key={item.projectId} value={item.projectId}>
                      {item.projectName}
                    </option>
                  ))}
                </AdminSelect>
              ) : (
                <select
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3"
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setSelectedAccount("");
                    void load(event.target.value, "");
                  }}
                >
                  <option value="">
                    {en ? "Select a project" : "프로젝트 선택"}
                  </option>
                  {(workspace?.projects || []).map((item) => (
                    <option key={item.projectId} value={item.projectId}>
                      {item.projectName}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {workspace?.canApprove ? (
              <label className="block text-sm font-black text-[#052b57]">
                담당자
                {isAdmin ? (
                  <AdminSelect
                    id="delegation-assignee"
                    value={selectedAccount}
                    onChange={(event) => {
                      setSelectedAccount(event.target.value);
                      void load(projectId, event.target.value);
                    }}
                  >
                    <option value="">담당자 선택</option>
                    {(workspace.assignees || []).map((item) => (
                      <option key={item.accountId} value={item.accountId}>
                        {item.accountName} · {item.accountId}
                      </option>
                    ))}
                  </AdminSelect>
                ) : (
                  <select
                    className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3"
                    value={selectedAccount}
                    onChange={(event) => {
                      setSelectedAccount(event.target.value);
                      void load(projectId, event.target.value);
                    }}
                  >
                    <option value="">담당자 선택</option>
                    {(workspace.assignees || []).map((item) => (
                      <option key={item.accountId} value={item.accountId}>
                        {item.accountName} · {item.accountId}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ) : null}
          </div>
        </section>
      ) : null}

      {workspace ? (
        <section
          className={
            isAdmin
              ? "gov-card p-0 overflow-hidden"
              : "mt-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          }
        >
          <div
            className={
              isAdmin
                ? "border-b border-[var(--kr-gov-border-light)] px-6 py-5"
                : "flex flex-wrap items-start justify-between gap-4"
            }
          >
            {isAdmin ? (
              <MemberSectionToolbar
                actions={
                  <span className="text-sm font-bold text-slate-600">
                    총 {filteredTasks.length}건
                  </span>
                }
                meta="업무 종류, 프로세스, 업무 절차를 조합해 담당 업무를 확인합니다."
                title="담당 업무 조회 결과"
              />
            ) : null}
            <div>
              <h2
                className={
                  isAdmin ? "hidden" : "text-xl font-black text-[#052b57]"
                }
              >
                {isAdmin
                  ? "담당 업무 조회 결과"
                  : en
                    ? "Assigned work"
                    : "승계할 담당 업무 선택"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                업무 종류·프로세스·업무 절차로 분류하거나 전체 업무를 한 번에
                확인할 수 있습니다.
              </p>
            </div>
            {workspace.canRequest && !isAdmin ? (
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-[#246beb] px-4 py-2 text-sm font-black text-[#246beb]"
                  onClick={selectFilteredTasks}
                  type="button"
                >
                  조회 결과 전체 선택
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-black text-slate-600"
                  onClick={() => setSelectedTaskIds([])}
                  type="button"
                >
                  선택 해제
                </button>
              </div>
            ) : null}
          </div>
          <div
            className={
              isAdmin
                ? "grid gap-4 border-b border-slate-200 px-6 py-5 md:grid-cols-3"
                : "mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-3"
            }
          >
            <label className="text-sm font-black text-[#052b57]">
              업무 종류
              <select
                className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3"
                value={workTypeFilter}
                onChange={(event) => {
                  setWorkTypeFilter(event.target.value);
                  setProcessFilter("");
                  setStepFilter("");
                }}
              >
                <option value="">전체 업무 종류</option>
                {workTypes.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-black text-[#052b57]">
              프로세스
              <select
                className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3"
                value={processFilter}
                onChange={(event) => {
                  setProcessFilter(event.target.value);
                  setStepFilter("");
                }}
              >
                <option value="">전체 프로세스</option>
                {processes.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-black text-[#052b57]">
              업무 절차
              <select
                className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3"
                value={stepFilter}
                onChange={(event) => setStepFilter(event.target.value)}
              >
                <option value="">전체 업무 절차</option>
                {steps.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className={
              isAdmin
                ? "overflow-hidden"
                : "mt-5 overflow-hidden rounded-xl border border-slate-200"
            }
          >
            <div className="overflow-x-auto">
              {isAdmin ? (
                <AdminTable>
                  <thead>
                    <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                      <th className="px-6 py-4">업무 종류</th>
                      <th className="px-6 py-4">프로세스</th>
                      <th className="px-6 py-4">업무 절차</th>
                      <th className="px-6 py-4 text-center">상태</th>
                      <th className="px-6 py-4 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTasks.map((task) => (
                      <tr
                        className="hover:bg-gray-50/50 transition-colors"
                        key={task.assignmentKey}
                      >
                        <td className="px-6 py-4">{task.workTypeName}</td>
                        <td className="px-6 py-4 font-bold text-[var(--kr-gov-text-primary)]">
                          {task.processName}
                        </td>
                        <td className="px-6 py-4">
                          {task.stepName || task.taskName}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0755b5]">
                            {STATUS[task.status] || task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {task.targetUrl ? (
                            <a
                              className="font-black text-[#246beb] underline"
                              href={task.targetUrl}
                            >
                              화면 열기
                            </a>
                          ) : (
                            <span className="text-slate-400">연결 없음</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!filteredTasks.length ? (
                      <tr>
                        <td
                          className="px-6 py-10 text-center text-slate-500"
                          colSpan={5}
                        >
                          조건에 해당하는 미완료 담당 업무가 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </AdminTable>
              ) : (
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <thead className="bg-[#f3f7fc] text-[#052b57]">
                    <tr>
                      {workspace.canRequest && !isAdmin ? (
                        <th className="w-14 px-4 py-3">선택</th>
                      ) : null}
                      <th className="px-4 py-3">업무 종류</th>
                      <th className="px-4 py-3">프로세스</th>
                      <th className="px-4 py-3">업무 절차</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="w-36 px-4 py-3">업무 화면</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr
                        className="border-t border-slate-200 hover:bg-blue-50/40"
                        key={task.assignmentKey}
                      >
                        {workspace.canRequest && !isAdmin ? (
                          <td className="px-4 py-4">
                            <input
                              aria-label={`${task.taskName} 선택`}
                              checked={selectedTaskIds.includes(task.assignmentKey)}
                              className="size-5 accent-[#246beb]"
                              onChange={() => toggleTask(task.assignmentKey)}
                              type="checkbox"
                            />
                          </td>
                        ) : null}
                        <td className="px-4 py-4">{task.workTypeName}</td>
                        <td className="px-4 py-4 font-bold text-[#052b57]">
                          {task.processName}
                        </td>
                        <td className="px-4 py-4">
                          {task.stepName || task.taskName}
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-[#0755b5]">
                            {STATUS[task.status] || task.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {task.targetUrl ? (
                            <a
                              className="font-black text-[#246beb] underline"
                              href={task.targetUrl}
                            >
                              화면 열기 →
                            </a>
                          ) : (
                            <span className="text-slate-400">연결 없음</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!filteredTasks.length ? (
                      <tr>
                        <td
                          className="px-5 py-10 text-center text-slate-500"
                          colSpan={workspace.canRequest && !isAdmin ? 6 : 5}
                        >
                          조건에 해당하는 미완료 담당 업무가 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <p
            className={
              isAdmin
                ? "border-t border-slate-200 bg-slate-50 px-6 py-3 text-right text-sm font-black text-[#246beb]"
                : "mt-4 text-right text-sm font-black text-[#246beb]"
            }
          >
            조회 {filteredTasks.length}건 / 전체{" "}
            {workspace.assignedTasks?.length || 0}건
            {workspace.assignmentCoverage
              ? ` · 프로젝트 업무 ${workspace.assignmentCoverage.projectTaskCount} · 활동자료 요청 ${workspace.assignmentCoverage.activityRequestCount} · 작성 중 업무 ${workspace.assignmentCoverage.workDraftCount || 0} · ${workspace.assignmentCoverage.verified ? "등록 원천 대조 완료" : "원천 대조 필요"}`
              : ""}
            {workspace.canRequest && !isAdmin
              ? ` · 선택 ${selectedTaskIds.length}건`
              : ""}
          </p>
        </section>
      ) : null}

      {workspace?.canRequest && !isAdmin ? (
        <section className="mt-5 rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-[#052b57]">
            {en ? "Request delegation" : "위임 요청 정보"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {en
              ? "Only an active account in the same company can be selected."
              : "같은 회원사의 활성 계정만 후임 관리자로 지정할 수 있습니다."}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-bold">
              후임 관리자
              <input
                className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3"
                placeholder="회사 내 계정 이름 또는 아이디 검색"
                value={successorKeyword}
                onChange={(event) => setSuccessorKeyword(event.target.value)}
              />
              <select
                className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3"
                value={successor}
                onChange={(event) => setSuccessor(event.target.value)}
              >
                <option value="">후임자 선택</option>
                {(workspace.accounts || [])
                  .filter((item) => {
                    const keyword = successorKeyword.trim().toLowerCase();
                    return (
                      !keyword ||
                      `${item.accountName} ${item.accountId} ${item.department || ""}`
                        .toLowerCase()
                        .includes(keyword)
                    );
                  })
                  .map((item) => (
                    <option key={item.accountId} value={item.accountId}>
                      {item.accountName} · {item.accountId}
                      {item.department ? ` · ${item.department}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              위임 사유
              <textarea
                className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3"
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200 pt-5">
            <p className="text-sm text-slate-500">
              {en
                ? "The request is applied only after independent approval."
                : "선택한 업무만 권한 관리자의 독립 승인 후 후임자에게 인계됩니다."}
            </p>
            <button
              className="min-h-12 shrink-0 rounded-lg bg-[#0755b5] px-6 font-black text-white disabled:bg-slate-300"
              disabled={
                busy ||
                !projectId ||
                !successor ||
                !reason.trim() ||
                selectedTaskIds.length === 0
              }
              onClick={request}
              type="button"
            >
              {busy
                ? "처리 중..."
                : `선택 ${selectedTaskIds.length}건 승인 요청`}
            </button>
          </div>
        </section>
      ) : !isAdmin && workspace ? (
        <section
          className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5"
          role="status"
        >
          <h2 className="font-black text-amber-900">
            {en
              ? "Delegation request unavailable"
              : "위임 요청 권한이 없습니다."}
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            {en
              ? "Only the current company manager can submit a delegation request."
              : "현재 회원사 관리자 계정만 위임 요청을 등록할 수 있습니다. 이 계정은 진행 현황만 조회할 수 있습니다."}
          </p>
        </section>
      ) : null}

      <section
        className={
          isAdmin
            ? "gov-card mt-8 p-0 overflow-hidden"
            : "mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        }
      >
        <div
          className={
            isAdmin
              ? "border-b border-[var(--kr-gov-border-light)] px-6 py-5"
              : "flex items-center justify-between border-b border-slate-300 bg-[#f3f7fc] px-6 py-4"
          }
        >
          {isAdmin ? (
            <MemberSectionToolbar
              actions={
                <span className="text-sm font-bold text-slate-600">
                  총 {workspace?.items?.length || 0}건
                </span>
              }
              meta="접수된 위임 신청을 확인하고 승인 또는 반려합니다."
              title="위임 신청 검토"
            />
          ) : null}
          <h2 className="text-xl font-black text-[#052b57]">
            {isAdmin ? "" : "내 위임 신청 현황"}
          </h2>
          <span className="text-sm font-bold text-slate-500">
            총 {workspace?.items?.length || 0}건
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[64rem] w-full text-left text-sm">
            <thead className="bg-[#f3f7fc] text-[#052b57]">
              <tr>
                {[
                  "상태",
                  "선임 관리자",
                  "후임 관리자",
                  "요청 일시",
                  "요청 사유",
                  "처리",
                ].map((value) => (
                  <th className="px-4 py-3" key={value}>
                    {value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(workspace?.items || []).map((item) => (
                <tr className="border-t" key={item.delegationId}>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-blue-50 px-3 py-1 font-black text-[#0755b5]">
                      {STATUS[item.status] || item.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">{item.predecessorAccountId}</td>
                  <td className="px-4 py-4">{item.successorAccountId}</td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {item.requestedAt
                      ? new Intl.DateTimeFormat(en ? "en-US" : "ko-KR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.requestedAt))
                      : "-"}
                  </td>
                  <td className="max-w-xs px-4 py-4">{item.reason}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {workspace?.canApprove && item.status === "REQUESTED" ? (
                        <>
                          <button
                            className="rounded-lg bg-[#0755b5] px-4 py-2 font-bold text-white"
                            disabled={busy}
                            onClick={() =>
                              command(`${base}/${item.delegationId}/decision`, {
                                decision: "APPROVE",
                              })
                            }
                          >
                            승인
                          </button>
                          <button
                            className="rounded-lg border border-rose-300 px-4 py-2 font-bold text-rose-700"
                            disabled={busy}
                            onClick={() =>
                              command(`${base}/${item.delegationId}/decision`, {
                                decision: "REJECT",
                                reason: "권한 충돌 또는 증빙 보완 필요",
                              })
                            }
                          >
                            반려
                          </button>
                        </>
                      ) : null}
                      {workspace?.canRequest && item.status === "APPROVED" ? (
                        <button
                          className="rounded-lg bg-[#0755b5] px-4 py-2 font-bold text-white"
                          disabled={busy}
                          onClick={() =>
                            command(`${base}/${item.delegationId}/complete`)
                          }
                        >
                          인계 완료
                        </button>
                      ) : null}
                      {!workspace?.canApprove && item.status === "REQUESTED" ? (
                        <span className="text-slate-500">승인 대기</span>
                      ) : null}
                      {!["REQUESTED", "APPROVED"].includes(item.status) ? (
                        <span className="text-slate-500">처리 완료</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {workspace && !workspace.items?.length ? (
                <tr>
                  <td
                    className="px-5 py-10 text-center text-slate-500"
                    colSpan={6}
                  >
                    등록된 위임 요청이 없습니다.
                  </td>
                </tr>
              ) : null}
              {!workspace ? (
                <tr>
                  <td
                    className="px-5 py-10 text-center text-slate-500"
                    colSpan={6}
                  >
                    업무 정보를 불러오는 중입니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      {message ? (
        <p
          className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-900"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </>
  );
  if (isAdmin)
    return (
      <AdminPageShell
        breadcrumbs={[
          { label: "관리자 홈", href: en ? "/en/admin/" : "/admin/" },
          { label: "회원·권한 관리" },
          { label: "관리자 위임·승계 검토" },
        ]}
        subtitle="담당 업무와 위임 신청을 검토하고 권한 변경을 승인하거나 반려합니다."
        title="관리자 위임·승계 검토"
      >
        <div className="w-full text-slate-900">{content}</div>
      </AdminPageShell>
    );
  return (
    <CommonPageContainer
      className="text-slate-900"
      contentClassName="max-w-6xl"
    >
      {content}
    </CommonPageContainer>
  );
}
