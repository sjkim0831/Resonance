import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHermesWorkflowPage, type HermesWorkflowPayload } from "../../lib/api/hermesWorkflow";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type TabKey = "steps" | "interpretations" | "executions" | "cliSessions" | "snapshots" | "contexts" | "recommendations" | "verifications" | "models" | "failures" | "stages";

function text(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function rowsOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

function badgeClass(value: unknown) {
  const normalized = String(value || "").toUpperCase();
  if (normalized.includes("SUCCESS") || normalized.includes("COMPLETED") || normalized.includes("OK") || normalized === "Y") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized.includes("PENDING") || normalized.includes("READY") || normalized.includes("INTERPRETED")) {
    return "bg-blue-100 text-blue-700";
  }
  if (normalized.includes("RUN") || normalized.includes("MEDIUM") || normalized.includes("HIGH")) {
    return "bg-amber-100 text-amber-700";
  }
  if (normalized.includes("FAIL") || normalized.includes("ERROR") || normalized.includes("CRITICAL")) {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-700";
}

function StatusBadge({ value }: { value: unknown }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(value)}`}>{text(value)}</span>;
}

function SimpleTable({ rows, columns }: { rows: Array<Record<string, unknown>>; columns: Array<{ key: string; label: string; status?: boolean; wide?: boolean }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)] text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th className={`px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)] ${column.wide ? "min-w-[22rem]" : ""}`} key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={columns.length}>No data</td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={`${text(row.hermesTaskId || row.hermesStepId || row.hermesExecutionId || row.stageCode || row.failurePatternId)}-${index}`}>
              {columns.map((column) => (
                <td className="max-w-2xl px-4 py-3 align-top" key={column.key}>
                  {column.status ? <StatusBadge value={row[column.key]} /> : <span className="break-words">{text(row[column.key])}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summary({ payload, en }: { payload: HermesWorkflowPayload | null; en: boolean }) {
  const summary = payload?.summary || {};
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryMetricCard title={en ? "Tasks" : "작업"} value={text(summary.taskCount)} description={en ? "Recorded Hermes requests." : "DB에 기록된 Hermes 요청입니다."} />
      <SummaryMetricCard title={en ? "Open" : "진행/대기"} value={text(summary.openTaskCount)} description={en ? "Not completed or failed." : "완료/실패 처리 전 작업입니다."} />
      <SummaryMetricCard title={en ? "Steps" : "단계"} value={text(summary.stepCount)} description={en ? "Stored ordered steps." : "저장된 실행 순서입니다."} />
      <SummaryMetricCard title={en ? "Next Ready" : "다음 추천"} value={text(summary.recommendationCount)} description={en ? "Ready recommendations." : "바로 이어서 요청 가능한 추천입니다."} />
    </section>
  );
}

function TaskList({ rows, en }: { rows: Array<Record<string, unknown>>; en: boolean }) {
  return (
    <section className="gov-card overflow-hidden p-0">
      <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
        <h2 className="text-lg font-black">{en ? "Hermes Tasks" : "Hermes 작업 기록"}</h2>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
          {en ? "Latest interpreted requests, model owner, and target route." : "최근 해석된 요청, 담당 모델, 대상 경로를 확인합니다."}
        </p>
      </div>
      <SimpleTable
        rows={rows}
        columns={[
          { key: "createdAt", label: en ? "Created" : "생성" },
          { key: "taskType", label: en ? "Type" : "유형", status: true },
          { key: "riskLevel", label: en ? "Risk" : "위험도", status: true },
          { key: "status", label: en ? "Status" : "상태", status: true },
          { key: "ownerModel", label: en ? "Model" : "모델" },
          { key: "targetRoute", label: en ? "Route" : "경로" },
          { key: "userRequest", label: en ? "Request" : "요청", wide: true }
        ]}
      />
    </section>
  );
}

function DetailTabs({ payload, activeTab, setActiveTab, en }: { payload: HermesWorkflowPayload | null; activeTab: TabKey; setActiveTab: (tab: TabKey) => void; en: boolean }) {
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "steps", label: en ? "Steps" : "작업 순서" },
    { key: "interpretations", label: en ? "Interpretation" : "명령 해석" },
    { key: "executions", label: en ? "Execution Logs" : "실행 로그" },
    { key: "cliSessions", label: en ? "CLI Sessions" : "CLI 세션" },
    { key: "snapshots", label: en ? "Live Snapshots" : "실시간 스냅샷" },
    { key: "contexts", label: en ? "Context Packs" : "컨텍스트 팩" },
    { key: "recommendations", label: en ? "Next Actions" : "다음 작업 추천" },
    { key: "verifications", label: en ? "Verification" : "검증 로그" },
    { key: "models", label: en ? "Model Decisions" : "모델 결정" },
    { key: "failures", label: en ? "Failure Patterns" : "장애 패턴" },
    { key: "stages", label: en ? "Stage Templates" : "단계 템플릿" }
  ];
  const rows = useMemo(() => {
    if (activeTab === "steps") return rowsOf(payload?.steps);
    if (activeTab === "interpretations") return rowsOf(payload?.interpretations);
    if (activeTab === "executions") return rowsOf(payload?.executions);
    if (activeTab === "cliSessions") return rowsOf(payload?.cliSessions);
    if (activeTab === "snapshots") return rowsOf(payload?.runtimeSnapshots);
    if (activeTab === "contexts") return rowsOf(payload?.contextPacks);
    if (activeTab === "recommendations") return rowsOf(payload?.nextRecommendations);
    if (activeTab === "verifications") return rowsOf(payload?.verifications);
    if (activeTab === "models") return rowsOf(payload?.modelDecisions);
    if (activeTab === "failures") return rowsOf(payload?.failurePatterns);
    return rowsOf(payload?.stageTemplates);
  }, [activeTab, payload]);
  const columns = useMemo(() => {
    if (activeTab === "steps") return [
      { key: "stepOrder", label: "Order" },
      { key: "stageCode", label: "Stage", status: true },
      { key: "stepTitle", label: en ? "Title" : "제목" },
      { key: "allowedExecutor", label: en ? "Executor" : "실행자" },
      { key: "status", label: en ? "Status" : "상태", status: true },
      { key: "expectedEvidence", label: en ? "Evidence" : "증거", wide: true }
    ];
    if (activeTab === "interpretations") return [
      { key: "status", label: en ? "Status" : "상태", status: true },
      { key: "modelName", label: en ? "Model" : "모델" },
      { key: "confidenceScore", label: en ? "Confidence" : "신뢰도" },
      { key: "normalizedCommand", label: en ? "Command" : "명령", wide: true }
    ];
    if (activeTab === "executions") return [
      { key: "startedAt", label: en ? "Started" : "시작" },
      { key: "executionType", label: en ? "Type" : "유형", status: true },
      { key: "status", label: en ? "Status" : "상태", status: true },
      { key: "exitCode", label: en ? "Exit" : "종료" },
      { key: "elapsedMs", label: "ms" },
      { key: "commandText", label: en ? "Command" : "명령", wide: true },
      { key: "outputSummary", label: en ? "Output" : "출력", wide: true }
    ];
    if (activeTab === "cliSessions") return [
      { key: "startedAt", label: en ? "Started" : "시작" },
      { key: "mode", label: en ? "Mode" : "모드", status: true },
      { key: "status", label: en ? "Status" : "상태", status: true },
      { key: "exitCode", label: en ? "Exit" : "종료" },
      { key: "elapsedMs", label: "ms" },
      { key: "workspacePath", label: en ? "Workspace" : "작업 경로" },
      { key: "stdoutRef", label: en ? "Stdout" : "표준출력", wide: true },
      { key: "transcriptRef", label: en ? "Transcript" : "대화 기록", wide: true }
    ];
    if (activeTab === "snapshots") return [
      { key: "frstRegistPnttm", label: en ? "Captured" : "기록" },
      { key: "snapshotType", label: en ? "Type" : "유형", status: true },
      { key: "sourceRef", label: en ? "Source" : "출처", wide: true },
      { key: "summary", label: en ? "Summary" : "요약", wide: true },
      { key: "rawPayload", label: en ? "Payload" : "내용", wide: true }
    ];
    if (activeTab === "contexts") return [
      { key: "frstRegistPnttm", label: en ? "Created" : "생성" },
      { key: "requestFingerprint", label: en ? "Fingerprint" : "지문" },
      { key: "evidenceRef", label: en ? "Evidence" : "증거", wide: true },
      { key: "previousWorkContext", label: en ? "Previous Work" : "이전 작업", wide: true },
      { key: "runtimeContext", label: en ? "Runtime" : "런타임", wide: true }
    ];
    if (activeTab === "recommendations") return [
      { key: "recommendationOrder", label: "Order" },
      { key: "recommendationType", label: en ? "Type" : "유형", status: true },
      { key: "riskLevel", label: en ? "Risk" : "위험도", status: true },
      { key: "status", label: en ? "Status" : "상태", status: true },
      { key: "title", label: en ? "Title" : "제목", wide: true },
      { key: "rationale", label: en ? "Why" : "근거", wide: true },
      { key: "commandText", label: en ? "Command" : "명령", wide: true }
    ];
    if (activeTab === "verifications") return [
      { key: "verifiedAt", label: en ? "Verified" : "검증" },
      { key: "verificationType", label: en ? "Type" : "유형", status: true },
      { key: "passedYn", label: en ? "Pass" : "통과", status: true },
      { key: "targetUrl", label: "URL" },
      { key: "resultSummary", label: en ? "Result" : "결과", wide: true }
    ];
    if (activeTab === "models") return [
      { key: "decisionStage", label: en ? "Stage" : "단계", status: true },
      { key: "selectedModel", label: en ? "Selected" : "선택 모델" },
      { key: "fallbackModel", label: en ? "Fallback" : "대체" },
      { key: "acceptedYn", label: en ? "Accepted" : "승인", status: true },
      { key: "decisionReason", label: en ? "Reason" : "이유", wide: true }
    ];
    if (activeTab === "failures") return [
      { key: "failureType", label: en ? "Type" : "유형", status: true },
      { key: "patternKey", label: en ? "Pattern" : "패턴" },
      { key: "hitCount", label: en ? "Hits" : "횟수" },
      { key: "symptomSummary", label: en ? "Symptom" : "증상", wide: true },
      { key: "recoverySummary", label: en ? "Recovery" : "복구", wide: true }
    ];
    return [
      { key: "stageOrder", label: "Order" },
      { key: "stageCode", label: "Stage", status: true },
      { key: "stageName", label: en ? "Name" : "이름" },
      { key: "defaultExecutor", label: en ? "Executor" : "실행자" },
      { key: "evidencePolicy", label: en ? "Evidence Policy" : "증거 정책", wide: true }
    ];
  }, [activeTab, en]);

  return (
    <section className="gov-card overflow-hidden p-0">
      <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button className={`gov-btn ${activeTab === tab.key ? "gov-btn-primary" : "gov-btn-outline"}`} key={tab.key} onClick={() => setActiveTab(tab.key)} type="button">
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <SimpleTable rows={rows} columns={columns} />
    </section>
  );
}

export function HermesWorkflowMigrationPage() {
  const en = isEnglish();
  const [status, setStatus] = useState("ALL");
  const [taskType, setTaskType] = useState("ALL");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("steps");
  const state = useAsyncValue(() => fetchHermesWorkflowPage({ status, taskType, keyword }), [status, taskType, keyword]);
  const payload = state.value;
  const tasks = rowsOf(payload?.tasks);

  useEffect(() => {
    logGovernanceScope("PAGE", "hermes-workflow", {
      language: en ? "en" : "ko",
      taskCount: tasks.length,
      status,
      taskType
    });
  }, [en, tasks.length, status, taskType]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Hermes Workflow" : "Hermes 작업 기억" }
      ]}
      sidebarVariant="system"
      title={en ? "Hermes Workflow Memory" : "Hermes 작업 기억"}
      subtitle={en ? "Review request interpretation, ordered steps, execution evidence, and reusable failure memory." : "요청 해석, 작업 순서, 실행 증거, 재사용 장애 패턴을 확인합니다."}
      actions={<button className="gov-btn gov-btn-outline" onClick={() => void state.reload()} type="button">{en ? "Refresh" : "새로고침"}</button>}
    >
      <AdminWorkspacePageFrame>
        {state.error ? <PageStatusNotice tone="error">{state.error}</PageStatusNotice> : null}
        {payload?.message ? <PageStatusNotice tone="info">{payload.message}</PageStatusNotice> : null}
        <Summary en={en} payload={payload} />
        <section className="gov-card">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.8fr_0.8fr_1.4fr_auto]">
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">Status</span>
              <select className="gov-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="ALL">ALL</option>
                <option value="INTERPRETED">INTERPRETED</option>
                <option value="PENDING">PENDING</option>
                <option value="RUNNING">RUNNING</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">Task Type</span>
              <select className="gov-select" value={taskType} onChange={(event) => setTaskType(event.target.value)}>
                <option value="ALL">ALL</option>
                <option value="frontend">frontend</option>
                <option value="backend">backend</option>
                <option value="database">database</option>
                <option value="deploy">deploy</option>
                <option value="kubernetes">kubernetes</option>
                <option value="ai">ai</option>
                <option value="logs">logs</option>
                <option value="hermes-native">hermes-native</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
              <input className="gov-input" value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setKeyword(keywordDraft.trim());
                }
              }} />
            </label>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-primary w-full" onClick={() => setKeyword(keywordDraft.trim())} type="button">{en ? "Search" : "검색"}</button>
            </div>
          </div>
        </section>
        <TaskList en={en} rows={tasks} />
        <DetailTabs activeTab={activeTab} en={en} payload={payload} setActiveTab={setActiveTab} />
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
