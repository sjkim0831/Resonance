import { useEffect, useState, useCallback } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { fetchAiObservability } from "../../lib/api/aiManagement";
import { SimpleTable, SummaryCards, TabBar, text, rowsOf, Badge } from "./aiShared";

type TabKey = "traces" | "prompts" | "tokens" | "context" | "failures";

interface Stage {
  stage: string;
  stageName: string;
  duration_ms: number;
  status: string;
  tokens?: number;
  detail?: string;
  model?: string;
  ragChunks?: number;
  ragMs?: number;
}

function parseStages(stagesJson: unknown): Stage[] {
  if (!stagesJson) return [];
  if (typeof stagesJson === "string") {
    try {
      const parsed = JSON.parse(stagesJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(stagesJson)) return stagesJson as Stage[];
  return [];
}

function getStageName(stage: string, en: boolean): string {
  const names: Record<string, { en: string; ko: string }> = {
    RAG_SEARCH: { en: "RAG Search", ko: "RAG 검색" },
    MODEL_INFER: { en: "Model Inference", ko: "모델 추론" },
    TOOL_CALL: { en: "Tool Call", ko: "도구 호출" },
    RESPONSE: { en: "Response Generation", ko: "응답 생성" },
    INTENT_PARSE: { en: "Intent Parse", ko: "의도 분석" },
    VERIFICATION: { en: "Verification", ko: "검증" },
  };
  return names[stage]?.[en ? "en" : "ko"] || stage;
}

function TraceFlow({ trace, en }: { trace: Record<string, unknown>; en: boolean }) {
  const stages: Stage[] = parseStages(trace.stages || trace.stages_json);

  return (
    <section className="gov-card">
      <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">{en ? "Trace Flow" : "추적 흐름"}</h2>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              Trace ID: {text(trace.trace_id || trace.traceId)} | {en ? "Total" : "총"}: {text(trace.totalDuration || trace.total_duration_ms)}ms
            </p>
          </div>
          <Badge value={trace.status} />
        </div>
      </div>

      {stages.length === 0 ? (
        <div className="p-6 text-center text-[var(--kr-gov-text-secondary)]">
          {en ? "No trace data available" : "추적 데이터가 없습니다"}
        </div>
      ) : (
        <div className="space-y-3 p-6">
          {stages.map((stage, i) => (
            <div className="flex items-start gap-4" key={i}>
              <div className="flex flex-col items-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black ${
                  String(stage.status || "").toUpperCase().includes("SUCCESS")
                    ? "bg-emerald-100 text-emerald-700"
                    : String(stage.status || "").toUpperCase().includes("FAIL")
                    ? "bg-rose-100 text-rose-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {i + 1}
                </div>
                {i < stages.length - 1 && <div className="mt-2 h-12 w-0.5 bg-slate-300" />}
              </div>
              <div className="flex-1 rounded-lg border border-[var(--kr-gov-border-light)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{getStageName(stage.stage, en)}</p>
                    <Badge value={stage.status} />
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{text(stage.duration_ms)}ms</p>
                    {stage.tokens && <p className="text-xs text-[var(--kr-gov-text-secondary)]">{stage.tokens} tokens</p>}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  {stage.model && (
                    <div className="rounded bg-slate-50 p-2">
                      <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Model" : "모델"}: </span>
                      <span className="font-medium">{stage.model}</span>
                    </div>
                  )}
                  {stage.ragChunks !== undefined && (
                    <div className="rounded bg-slate-50 p-2">
                      <span className="text-[var(--kr-gov-text-secondary)]">RAG: </span>
                      <span className="font-medium">{stage.ragChunks} chunks</span>
                    </div>
                  )}
                  {stage.ragMs !== undefined && (
                    <div className="rounded bg-slate-50 p-2">
                      <span className="text-[var(--kr-gov-text-secondary)]">RAG {en ? "Time" : "시간"}: </span>
                      <span className="font-medium">{stage.ragMs}ms</span>
                    </div>
                  )}
                </div>

                {stage.detail && (
                  <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{stage.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-4">
        <h4 className="mb-3 font-bold">{en ? "Request & Response" : "요청 및 응답"}</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--kr-gov-text-secondary)]">{en ? "User Query" : "사용자 질문"}</p>
            <div className="max-h-40 overflow-auto rounded border border-[var(--kr-gov-border-light)] bg-slate-50 p-3">
              <pre className="whitespace-pre-wrap text-sm">{text(trace.user_query || trace.query)}</pre>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Response" : "응답"}</p>
            <div className="max-h-40 overflow-auto rounded border border-[var(--kr-gov-border-light)] bg-slate-50 p-3">
              <pre className="whitespace-pre-wrap text-sm">{text(trace.response_text || "")}</pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AiObservabilityPage() {
  const en = isEnglish();
  const [traceId, setTraceId] = useState("");
  const [tab, setTab] = useState<TabKey>("traces");
  const [selectedTrace, setSelectedTrace] = useState<Record<string, unknown> | undefined>(undefined);

  const state = useAsyncValue(
    () => fetchAiObservability({ traceId: traceId || undefined }),
    [traceId]
  );
  const payload = state.value;

  useEffect(() => {
    logGovernanceScope("PAGE", "ai-observability", { language: en ? "en" : "ko" });
  }, [en]);

  const tabs = [
    { key: "traces", label: en ? "Traces" : "Trace" },
    { key: "prompts", label: en ? "Prompts" : "Prompt 추적" },
    { key: "tokens", label: en ? "Token Usage" : "Token 사용량" },
    { key: "context", label: en ? "Context" : "컨텍스트" },
    { key: "failures", label: en ? "Failures" : "실패 분석" },
  ];

  const tracesData = rowsOf(payload?.traces || []);

  const cols: Record<TabKey, any[]> = {
    traces: [
      { key: "trace_id", label: "Trace ID" },
      { key: "query", label: en ? "Query" : "질문", wide: true },
      { key: "tokens", label: "Tokens" },
      { key: "totalDuration", label: en ? "Duration" : "소요시간" },
      { key: "status", label: en ? "Status" : "상태", badge: true },
    ],
    prompts: [
      { key: "createdAt", label: en ? "Time" : "시간" },
      { key: "model", label: en ? "Model" : "모델" },
      { key: "version", label: "Ver" },
      { key: "promptPreview", label: en ? "Prompt" : "프롬프트", wide: true },
      { key: "tokens", label: "Tokens" },
    ],
    tokens: [
      { key: "period", label: en ? "Period" : "기간" },
      { key: "model", label: en ? "Model" : "모델" },
      { key: "promptTokens", label: "Prompt" },
      { key: "completionTokens", label: "Completion" },
      { key: "totalTokens", label: "Total" },
      { key: "cost", label: en ? "Cost" : "비용" },
    ],
    context: [
      { key: "traceId", label: "Trace" },
      { key: "queryLength", label: en ? "Query Len" : "질문 길이" },
      { key: "ragChunks", label: "RAG" },
      { key: "contextTokens", label: "Tokens" },
      { key: "overflow", label: en ? "Overflow" : "초과", badge: true },
    ],
    failures: [
      { key: "createdAt", label: en ? "Time" : "시간" },
      { key: "model", label: en ? "Model" : "모델" },
      { key: "message", label: en ? "Error" : "오류", wide: true },
      { key: "duration", label: en ? "Duration" : "소요시간" },
    ],
  };

  const handleTraceClick = useCallback((row: Record<string, unknown>) => {
    setSelectedTrace(row);
  }, []);

  const summary = payload?.summary || {};

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "AI Management" : "AI 관리" },
        { label: en ? "Observability" : "AI 관측" },
      ]}
      sidebarVariant="system"
      title={en ? "AI Observability" : "AI 관측"}
      subtitle={en ? "Trace request flows, monitor token usage, analyze context, and diagnose failures." : "요청 흐름을 추적하고, Token 사용량을 모니터링하며, 컨텍스트를 분석하고, 실패를 진단합니다."}
    >
      <AdminWorkspacePageFrame>
        {state.error && <PageStatusNotice tone="error">{state.error}</PageStatusNotice>}

        <SummaryCards cards={[
          { title: en ? "Traces" : "Trace", value: text(summary.traceCount), desc: en ? "Total traces tracked." : "추적된 전체 Trace입니다." },
          { title: en ? "Today Tokens" : "오늘 Token", value: text(summary.todayTokens), desc: en ? "Tokens consumed today." : "오늘 소비된 Token입니다." },
          { title: en ? "Avg Latency" : "평균 지연", value: text(summary.avgLatency), desc: en ? "Response time average." : "평균 응답 시간입니다." },
          { title: en ? "Failure Rate" : "실패율", value: text(summary.failureRate), desc: en ? "Recent failure ratio." : "최근 실패 비율입니다." },
        ]} />

        <section className="gov-card">
          <TabBar
            tabs={tabs}
            active={tab}
            setActive={(k) => {
              setTab(k as TabKey);
              setSelectedTrace(undefined);
            }}
            extra={
              <div className="flex gap-2">
                <input
                  className="gov-input w-48 text-sm"
                  placeholder={en ? "Trace ID search..." : "Trace ID 검색..."}
                  value={traceId}
                  onChange={(e) => setTraceId(e.target.value)}
                />
                <select className="gov-select text-sm">
                  <option value="ALL">{en ? "All Models" : "전체 모델"}</option>
                  <option value="qwen2.5-coder-7b">Qwen 7B</option>
                  <option value="qwen2.5-coder-14b">Qwen 14B</option>
                </select>
              </div>
            }
          />

          {tab === "traces" && !selectedTrace && (
            <div>
              <SimpleTable
                rows={tracesData}
                columns={cols.traces}
                onRowClick={handleTraceClick}
              />
              <div className="border-t border-[var(--kr-gov-border-light)] p-4 text-center">
                <p className="text-xs text-[var(--kr-gov-text-secondary)]">
                  {en ? "Click a row to view trace detail" : "행을 클릭하여 상세 Trace 확인"}
                </p>
              </div>
            </div>
          )}

          {tab === "traces" && selectedTrace && (
            <div>
              <TraceFlow trace={selectedTrace} en={en} />
              <div className="border-t border-[var(--kr-gov-border-light)] p-4 text-center">
                <button
                  className="gov-btn gov-btn-outline"
                  onClick={() => setSelectedTrace(undefined)}
                  type="button"
                >
                  {en ? "Back to list" : "목록으로"}
                </button>
              </div>
            </div>
          )}

          {tab === "prompts" && <SimpleTable rows={rowsOf(payload?.prompts || [])} columns={cols.prompts} />}
          {tab === "tokens" && (
            <div>
              <SimpleTable rows={rowsOf(payload?.tokenUsage || [])} columns={cols.tokens} />
              <div className="border-t border-[var(--kr-gov-border-light)] p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="gov-card p-4">
                    <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Total Prompt" : "전체 Prompt"}</p>
                    <p className="mt-1 text-xl font-black">{text(summary.totalPromptTokens)}</p>
                  </div>
                  <div className="gov-card p-4">
                    <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Total Completion" : "전체 Completion"}</p>
                    <p className="mt-1 text-xl font-black">{text(summary.totalCompletionTokens)}</p>
                  </div>
                  <div className="gov-card p-4">
                    <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Estimated Cost" : "예상 비용"}</p>
                    <p className="mt-1 text-xl font-black">{text(summary.estimatedCost)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === "context" && <SimpleTable rows={rowsOf(payload?.contextAnalyses || [])} columns={cols.context} />}
          {tab === "failures" && (
            <SimpleTable
              rows={rowsOf(payload?.failures || [])}
              columns={cols.failures}
              onRowClick={(row) => {
                const matchingTrace = tracesData.find((t) => t.trace_id === row.id);
                if (matchingTrace) {
                  setSelectedTrace(matchingTrace);
                  setTab("traces");
                }
              }}
            />
          )}
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}