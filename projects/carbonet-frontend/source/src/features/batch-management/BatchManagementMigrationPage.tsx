import { useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchBatchManagementPage } from "../../lib/api/ops";
import type { BatchManagementPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard, WarningPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberButton, MemberLinkButton } from "../member/common";

type BatchCloseoutItem = {
  label: string;
  value: string;
  ready: boolean;
  detail: string;
};

function stringOf(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!row) {
    return "";
  }
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function parseCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readyBadgeClass(ready: boolean) {
  return ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
}

function BatchCloseoutPanel({
  actionItems,
  en,
  items
}: {
  actionItems: Array<{ label: string; description: string }>;
  en: boolean;
  items: BatchCloseoutItem[];
}) {
  return (
    <section className="gov-card" data-help-id="batch-management-closeout-gate">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Route Closeout Gate" : "라우트 완료 게이트"}</p>
          <h2 className="mt-1 text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? "Batch Execution Readiness" : "배치 실행 준비 상태"}</h2>
          <p className="mt-2 max-w-4xl text-sm text-[var(--kr-gov-text-secondary)]">
            {en
              ? "This screen can inspect jobs, queues, worker nodes, and recent runs. Pause, resume, retry, queue drain, and audit mutations remain blocked until named backend endpoints and feature codes are connected."
              : "현재 이 화면은 잡, 큐, 워커 노드, 최근 실행 이력 점검은 가능합니다. 일시중지, 재개, 재시도, 큐 drain, 감사 변경 이력은 명명된 백엔드 엔드포인트와 기능 코드가 연결될 때까지 차단 상태로 표시합니다."}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
          {en ? "PARTIAL" : "부분 완료"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <article key={item.label} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.label}</h3>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${readyBadgeClass(item.ready)}`}>
                {item.ready ? (en ? "READY" : "준비됨") : (en ? "BLOCKED" : "차단")}
              </span>
            </div>
            <p className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{item.value}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-dashed border-amber-300 bg-amber-50 p-4" data-help-id="batch-management-action-contract">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-sm font-black text-amber-900">{en ? "Action Contract Preview" : "실행 계약 미리보기"}</h3>
            <p className="mt-1 text-sm text-amber-900">
              {en
                ? "Buttons are disabled because read-only telemetry cannot prove batch mutations, rollback safety, or audit evidence."
                : "읽기 전용 관측 데이터만으로는 배치 변경, 롤백 안전성, 감사 증적을 증명할 수 없으므로 버튼은 비활성화했습니다."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actionItems.map((item) => (
              <button
                key={item.label}
                className="gov-btn gov-btn-outline opacity-60"
                disabled
                title={item.description}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function BatchManagementMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<BatchManagementPagePayload>(fetchBatchManagementPage, [], {});
  const page = pageState.value;
  const jobs = ((page?.batchJobRows || []) as Array<Record<string, string>>);
  const queues = ((page?.batchQueueRows || []) as Array<Record<string, string>>);
  const nodes = ((page?.batchNodeRows || []) as Array<Record<string, string>>);
  const executions = ((page?.batchExecutionRows || []) as Array<Record<string, string>>);
  const runbooks = ((page?.batchRunbooks || []) as Array<Record<string, string>>);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [jobStatus, setJobStatus] = useState("ALL");
  const [nodeStatus, setNodeStatus] = useState("ALL");

  const keyword = searchKeyword.trim().toLowerCase();
  const filteredJobs = useMemo(() => jobs.filter((row) => {
    const matchesKeyword = !keyword || [
      stringOf(row, "jobId"),
      stringOf(row, "jobName"),
      stringOf(row, "queueName"),
      stringOf(row, "owner"),
      stringOf(row, "note")
    ].join(" ").toLowerCase().includes(keyword);
    const matchesStatus = jobStatus === "ALL" || stringOf(row, "jobStatus").toUpperCase() === jobStatus;
    return matchesKeyword && matchesStatus;
  }), [jobStatus, jobs, keyword]);
  const filteredQueues = useMemo(() => queues.filter((row) => !keyword || [
    stringOf(row, "queueId"),
    stringOf(row, "queueName"),
    stringOf(row, "consumerNode"),
    stringOf(row, "status")
  ].join(" ").toLowerCase().includes(keyword)), [keyword, queues]);
  const filteredNodes = useMemo(() => nodes.filter((row) => {
    const matchesKeyword = !keyword || [
      stringOf(row, "nodeId"),
      stringOf(row, "role"),
      stringOf(row, "affinity")
    ].join(" ").toLowerCase().includes(keyword);
    const matchesStatus = nodeStatus === "ALL" || stringOf(row, "status").toUpperCase() === nodeStatus;
    return matchesKeyword && matchesStatus;
  }), [keyword, nodeStatus, nodes]);
  const filteredExecutions = useMemo(() => executions.filter((row) => !keyword || [
    stringOf(row, "executedAt"),
    stringOf(row, "jobId"),
    stringOf(row, "result"),
    stringOf(row, "message")
  ].join(" ").toLowerCase().includes(keyword)), [executions, keyword]);

  const summary = useMemo(() => ([
    {
      title: en ? "Visible Jobs" : "조회 잡 수",
      value: String(filteredJobs.length),
      description: en ? "Jobs matching the current filter." : "현재 조건에 맞는 배치 잡 수입니다."
    },
    {
      title: en ? "Queue Backlog" : "큐 적체",
      value: String(filteredQueues.reduce((total, row) => total + parseCount(stringOf(row, "backlogCount")), 0)),
      description: en ? "Pending messages across visible queues." : "표시 중인 큐의 대기 메시지 합계입니다."
    },
    {
      title: en ? "Healthy / Standby Nodes" : "정상/대기 노드",
      value: String(filteredNodes.filter((row) => ["HEALTHY", "STANDBY"].includes(stringOf(row, "status").toUpperCase())).length),
      description: en ? "Nodes ready to accept new workloads." : "새 작업을 받을 수 있는 노드 수입니다."
    },
    {
      title: en ? "Failed / Review Runs" : "실패/재검토 실행",
      value: String(filteredExecutions.filter((row) => ["FAILED", "REVIEW"].includes(stringOf(row, "result").toUpperCase())).length),
      description: en ? "Recent executions that still need operator follow-up." : "운영자 후속 조치가 남은 최근 실행 건수입니다."
    }
  ]), [en, filteredExecutions, filteredJobs, filteredNodes, filteredQueues]);

  const closeoutItems = useMemo<BatchCloseoutItem[]>(() => {
    const schedulableJobs = jobs.filter((row) => Boolean(stringOf(row, "jobId") && stringOf(row, "nextRunAt") && stringOf(row, "jobStatus")));
    const observableQueues = queues.filter((row) => Boolean(stringOf(row, "queueId") && stringOf(row, "backlogCount") && stringOf(row, "consumerNode")));
    const healthyLinkedNodes = nodes.filter((row) => Boolean(stringOf(row, "nodeId") && stringOf(row, "status") && stringOf(row, "heartbeatAt")));
    const failureRows = executions.filter((row) => ["FAILED", "REVIEW"].includes(stringOf(row, "result").toUpperCase()));
    return [
      {
        label: en ? "Job Schedule" : "잡 스케줄",
        value: `${schedulableJobs.length}/${jobs.length}`,
        ready: jobs.length > 0 && schedulableJobs.length === jobs.length,
        detail: en ? "Job id, next run, and status are visible before action." : "실행 전 잡 ID, 다음 실행, 상태를 확인할 수 있습니다."
      },
      {
        label: en ? "Queue Backlog" : "큐 적체",
        value: `${observableQueues.length}/${queues.length}`,
        ready: queues.length > 0 && observableQueues.length === queues.length,
        detail: en ? "Queue backlog and consumer ownership are visible." : "큐 적체량과 소비 노드 소유권을 표시합니다."
      },
      {
        label: en ? "Worker Health" : "워커 상태",
        value: `${healthyLinkedNodes.length}/${nodes.length}`,
        ready: nodes.length > 0 && healthyLinkedNodes.length === nodes.length,
        detail: en ? "Worker status and heartbeat are available before reruns." : "재실행 전 워커 상태와 heartbeat를 확인할 수 있습니다."
      },
      {
        label: en ? "Mutation Audit" : "변경 감사",
        value: failureRows.length > 0 ? (en ? `${failureRows.length} review runs` : `검토 ${failureRows.length}건`) : (en ? "API pending" : "API 대기"),
        ready: false,
        detail: en ? "Pause, resume, retry, drain, and failure-detail actions need backend endpoints and audit events." : "일시중지, 재개, 재시도, drain, 실패 상세 액션에는 백엔드 엔드포인트와 감사 이벤트가 필요합니다."
      }
    ];
  }, [en, executions, jobs, nodes, queues]);

  const actionItems = useMemo(
    () => [
      {
        label: en ? "Pause Job" : "잡 일시중지",
        description: en ? "Requires pause endpoint, permission feature code, and audit record." : "일시중지 엔드포인트, 권한 기능 코드, 감사 기록이 필요합니다."
      },
      {
        label: en ? "Resume Job" : "잡 재개",
        description: en ? "Requires resume endpoint and next-run recalculation proof." : "재개 엔드포인트와 다음 실행 재계산 증적이 필요합니다."
      },
      {
        label: en ? "Retry Failed Run" : "실패 재시도",
        description: en ? "Requires retry endpoint, idempotency key, and result evidence." : "재시도 엔드포인트, 멱등 키, 결과 증적이 필요합니다."
      },
      {
        label: en ? "Drain Queue" : "큐 drain",
        description: en ? "Requires queue drain runner, worker impact check, and rollback policy." : "큐 drain 실행기, 워커 영향 점검, 롤백 정책이 필요합니다."
      }
    ],
    [en]
  );

  logGovernanceScope("PAGE", "batch-management", {
    language: en ? "en" : "ko",
    searchKeyword,
    jobStatus,
    nodeStatus,
    jobCount: filteredJobs.length,
    queueCount: filteredQueues.length,
    nodeCount: filteredNodes.length,
    executionCount: filteredExecutions.length
  });

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Batch" : "배치 관리" }
      ]}
      title={en ? "Batch Management" : "배치 관리"}
      subtitle={en ? "Review batch jobs, queue backlog, worker nodes, and recent execution signals in one workspace." : "배치 잡, 큐 적체, 워커 노드, 최근 실행 신호를 한 작업 공간에서 점검합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <BatchCloseoutPanel actionItems={actionItems} en={en} items={closeoutItems} />

        <CollectionResultPanel
          data-help-id="batch-management-filters"
          description={en ? "Narrow the job and node scope before investigating queue backlog or failed executions." : "큐 적체나 실패 실행을 보기 전에 잡과 노드 범위를 먼저 좁힙니다."}
          icon="schedule"
          title={en ? "Batch Scope Filter" : "배치 조회 조건"}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[60rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="batchKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput
                id="batchKeyword"
                placeholder={en ? "Job, queue, owner, message" : "잡명, 큐, 담당자, 메시지"}
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="batchJobStatus">{en ? "Job Status" : "잡 상태"}</label>
              <AdminSelect id="batchJobStatus" value={jobStatus} onChange={(event) => setJobStatus(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
                <option value="REVIEW">REVIEW</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="batchNodeStatus">{en ? "Node Status" : "노드 상태"}</label>
              <AdminSelect id="batchNodeStatus" value={nodeStatus} onChange={(event) => setNodeStatus(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="HEALTHY">HEALTHY</option>
                <option value="STANDBY">STANDBY</option>
                <option value="DEGRADED">DEGRADED</option>
              </AdminSelect>
            </div>
            <div className="flex items-end gap-2">
              <button
                className="gov-btn gov-btn-outline w-full"
                onClick={() => {
                  setSearchKeyword("");
                  setJobStatus("ALL");
                  setNodeStatus("ALL");
                }}
                type="button"
              >
                {en ? "Reset" : "초기화"}
              </button>
            </div>
          </div>
        </CollectionResultPanel>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="batch-management-summary">
          {summary.map((card) => (
            <SummaryMetricCard
              key={card.title}
              description={card.description}
              title={card.title}
              value={card.value}
            />
          ))}
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="batch-management-jobs">
          <GridToolbar
            actions={<span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Total" : "총"} <strong>{filteredJobs.length}</strong>{en ? "" : "건"}</span>}
            meta={en ? "Keep job status, queue ownership, and next run time aligned." : "잡 상태, 큐 소유, 다음 실행 시점을 함께 확인합니다."}
            title={en ? "Batch Job List" : "배치 잡 목록"}
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Job ID" : "잡 ID"}</th>
                  <th className="px-4 py-3">{en ? "Job Name" : "잡명"}</th>
                  <th className="px-4 py-3">{en ? "Queue" : "큐"}</th>
                  <th className="px-4 py-3">{en ? "Type" : "유형"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-3">{en ? "Last Run" : "최근 실행"}</th>
                  <th className="px-4 py-3">{en ? "Next Run" : "다음 실행"}</th>
                  <th className="px-4 py-3">{en ? "Owner" : "담당"}</th>
                  <th className="px-4 py-3 text-right">{en ? "Asset & Control" : "자산/제어"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredJobs.map((row) => (
                  <tr key={stringOf(row, "jobId")}>
                    <td className="px-4 py-3 font-bold">{stringOf(row, "jobId")}</td>
                    <td className="px-4 py-3">{stringOf(row, "jobName")}</td>
                    <td className="px-4 py-3">{stringOf(row, "queueName")}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {stringOf(row, "executionType")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        stringOf(row, "jobStatus") === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        stringOf(row, "jobStatus") === "REVIEW" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {stringOf(row, "jobStatus")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px]">{stringOf(row, "lastRunAt")}</td>
                    <td className="px-4 py-3 text-[12px]">{stringOf(row, "nextRunAt")}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-slate-600">{stringOf(row, "owner")}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <MemberLinkButton
                          size="sm"
                          variant="secondary"
                          href={buildLocalizedPath(`/admin/system/asset-detail?id=BATCH-${stringOf(row, "jobId")}`, `/en/admin/system/asset-detail?id=BATCH-${stringOf(row, "jobId")}`)}
                        >
                          {en ? "Asset" : "자산 연동"}
                        </MemberLinkButton>
                        <MemberButton
                          size="sm"
                          variant={stringOf(row, "jobStatus") === "ACTIVE" ? "secondary" : "primary"}
                          onClick={() => alert(en ? "Execution action will be integrated via ADMIN-SYS-CLOSE-004." : "강제 실행 및 통제 기능은 백엔드 API 완비 후 연결됩니다.")}
                        >
                          {stringOf(row, "jobStatus") === "ACTIVE" ? (en ? "Pause" : "중지") : (en ? "Trigger" : "수동 실행")}
                        </MemberButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="batch-management-queues">
            <GridToolbar
              meta={en ? "Watch backlog, consumer ownership, and SLA state together." : "적체량, 소비 노드, SLA 상태를 함께 확인합니다."}
              title={en ? "Queue Backlog" : "큐 적체 현황"}
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Queue ID" : "큐 ID"}</th>
                    <th className="px-4 py-3">{en ? "Queue Name" : "큐명"}</th>
                    <th className="px-4 py-3 text-right">{en ? "Backlog" : "대기 건수"}</th>
                    <th className="px-4 py-3">{en ? "Consumer Node" : "소비 노드"}</th>
                    <th className="px-4 py-3">{en ? "Last Message" : "최근 메시지"}</th>
                    <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                    <th className="px-4 py-3 text-right">{en ? "Control" : "제어"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredQueues.map((row) => (
                    <tr key={stringOf(row, "queueId")}>
                      <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "queueId")}</td>
                      <td className="px-4 py-3 font-bold">{stringOf(row, "queueName")}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">{stringOf(row, "backlogCount")}</td>
                      <td className="px-4 py-3 text-[12px]">{stringOf(row, "consumerNode")}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">{stringOf(row, "lastMessageAt")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          stringOf(row, "status") === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {stringOf(row, "status")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MemberButton
                          size="sm"
                          variant="secondary"
                          onClick={() => alert(en ? "Queue drain will be integrated via ADMIN-SYS-CLOSE-004." : "큐 비우기 기능은 백엔드 API 완비 후 연결됩니다.")}
                        >
                          {en ? "Drain" : "큐 비우기"}
                        </MemberButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="gov-card overflow-hidden p-0" data-help-id="batch-management-nodes">
            <GridToolbar
              meta={en ? "Check node health and queue affinity before reruns." : "재실행 전에 노드 상태와 큐 affinity를 확인합니다."}
              title={en ? "Worker Nodes" : "워커 노드"}
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Node ID" : "노드 ID"}</th>
                    <th className="px-4 py-3">{en ? "Role" : "역할"}</th>
                    <th className="px-4 py-3">{en ? "Affinity" : "담당 큐"}</th>
                    <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                    <th className="px-4 py-3">Heartbeat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredNodes.map((row) => (
                    <tr key={stringOf(row, "nodeId")}>
                      <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "nodeId")}</td>
                      <td className="px-4 py-3">{stringOf(row, "role")}</td>
                      <td className="px-4 py-3">{stringOf(row, "affinity")}</td>
                      <td className="px-4 py-3">{stringOf(row, "status")}</td>
                      <td className="px-4 py-3">{stringOf(row, "heartbeatAt")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="batch-management-executions">
          <GridToolbar
            meta={en ? "Focus on retry-required and review-required executions first." : "재시도 필요, 재검토 필요 실행을 먼저 확인하도록 구성했습니다."}
            title={en ? "Recent Batch Executions" : "최근 배치 실행"}
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Executed At" : "실행 시각"}</th>
                  <th className="px-4 py-3">{en ? "Job ID" : "잡 ID"}</th>
                  <th className="px-4 py-3">{en ? "Result" : "결과"}</th>
                  <th className="px-4 py-3">{en ? "Duration" : "소요 시간"}</th>
                  <th className="px-4 py-3">{en ? "Message" : "메시지"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExecutions.map((row, index) => (
                  <tr key={`${stringOf(row, "executedAt")}-${index}`}>
                    <td className="px-4 py-3">{stringOf(row, "executedAt")}</td>
                    <td className="px-4 py-3 font-bold">{stringOf(row, "jobId")}</td>
                    <td className="px-4 py-3">{stringOf(row, "result")}</td>
                    <td className="px-4 py-3">{stringOf(row, "duration")}</td>
                    <td className="px-4 py-3">{stringOf(row, "message")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr_1fr]">
          {runbooks.map((item, index) => (
            <CollectionResultPanel
              description={stringOf(item, "body")}
              icon="menu_book"
              key={`${stringOf(item, "title")}-${index}`}
              title={stringOf(item, "title")}
            >
              <WarningPanel className="mb-0 border-slate-200 bg-slate-50 text-[var(--kr-gov-text-secondary)]" title={stringOf(item, "title")}>
                {stringOf(item, "body")}
              </WarningPanel>
            </CollectionResultPanel>
          ))}
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
