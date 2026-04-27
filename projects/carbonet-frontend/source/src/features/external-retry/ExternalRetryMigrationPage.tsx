import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalRetryPage } from "../../lib/api/ops";
import type { ExternalRetryPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect } from "../member/common";

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("FAILED") || upper.includes("REVIEW") || upper.includes("BLOCKED")) return "bg-red-100 text-red-700";
  if (upper.includes("DEGRADED") || upper.includes("WATCH") || upper.includes("WARNING")) return "bg-amber-100 text-amber-700";
  if (upper.includes("ACTIVE") || upper.includes("SUCCESS") || upper.includes("HEALTHY")) return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export function ExternalRetryMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<ExternalRetryPagePayload>(fetchExternalRetryPage, [], {});
  const page = pageState.value;
  const summary = useMemo(() => ((page?.externalRetrySummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.externalRetryRows || []) as Array<Record<string, string>>), [page]);
  const policyRows = useMemo(() => ((page?.externalRetryPolicyRows || []) as Array<Record<string, string>>), [page]);
  const executionRows = useMemo(() => ((page?.externalRetryExecutionRows || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalRetryQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalRetryGuidance || []) as Array<Record<string, string>>), [page]);
  const [keyword, setKeyword] = useState("");
  const [retryClass, setRetryClass] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [
        stringOf(row, "connectionId"),
        stringOf(row, "connectionName"),
        stringOf(row, "partnerName"),
        stringOf(row, "queueId"),
        stringOf(row, "retryReason")
      ].join(" ").toLowerCase();
      const matchesKeyword = !normalizedKeyword || haystack.includes(normalizedKeyword);
      const matchesClass = retryClass === "ALL" || stringOf(row, "retryClass").toUpperCase() === retryClass;
      const matchesStatus = status === "ALL" || stringOf(row, "status").toUpperCase() === status;
      return matchesKeyword && matchesClass && matchesStatus;
    });
  }, [keyword, retryClass, rows, status]);

  useEffect(() => {
    logGovernanceScope("PAGE", "external-retry", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      retryClass,
      status
    });
  }, [en, filteredRows.length, retryClass, rows.length, status]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: en ? "Retry Control" : "재시도 관리" }
      ]}
      title={en ? "Retry Control" : "재시도 관리"}
      subtitle={en ? "Review retry candidates, duplicate-guard posture, and recent replay executions before forcing another run." : "강제 재실행 전에 재시도 대상, 중복 방지 상태, 최근 재처리 실행 이력을 함께 점검합니다."}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/external/sync", "/en/admin/external/sync")}>{en ? "Sync Execution" : "동기화 실행"}</a>
          <a className="gov-btn" href={buildLocalizedPath("/admin/external/webhooks", "/en/admin/external/webhooks")}>{en ? "Webhook Settings" : "웹훅 설정"}</a>
        </div>
      }
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading retry control..." : "재시도 관리 화면을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="external-retry-summary">
          {summary.map((item, index) => (
            <SummaryMetricCard
              key={`${stringOf(item, "title")}-${index}`}
              title={stringOf(item, "title")}
              value={stringOf(item, "value")}
              description={stringOf(item, "description")}
            />
          ))}
        </section>

        <CollectionResultPanel
          data-help-id="external-retry-filters"
          title={en ? "Retry Filters" : "재시도 조회 조건"}
          description={en ? "Narrow the queue before checking manual replay, dedupe guard, or downstream maintenance impact." : "수동 재실행, 중복 방지, 하위 시스템 점검 영향 여부를 보기 전에 대상을 좁힙니다."}
          icon="replay"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[68rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalRetryKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput id="externalRetryKeyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Connection, queue, reason" : "연계명, 큐, 재시도 사유"} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalRetryClass">{en ? "Retry Class" : "재시도 분류"}</label>
              <AdminSelect id="externalRetryClass" value={retryClass} onChange={(event) => setRetryClass(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="AUTO">AUTO</option>
                <option value="MANUAL">MANUAL</option>
                <option value="WEBHOOK">WEBHOOK</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalRetryStatus">{en ? "Status" : "상태"}</label>
              <AdminSelect id="externalRetryStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DEGRADED">DEGRADED</option>
                <option value="REVIEW">REVIEW</option>
                <option value="BLOCKED">BLOCKED</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-outline w-full" type="button" onClick={() => { setKeyword(""); setRetryClass("ALL"); setStatus("ALL"); }}>
                {en ? "Reset Filters" : "검색 조건 초기화"}
              </button>
            </div>
          </div>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="external-retry-queue">
          <GridToolbar title={en ? "Retry Queue" : "재시도 대상 현황"} meta={(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")} actions={<p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Visible ${filteredRows.length} of ${rows.length}` : `전체 ${rows.length}건 중 ${filteredRows.length}건 표시`}</p>} />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">{en ? "Target" : "대상"}</th>
                  <th className="px-4 py-3">{en ? "Class" : "분류"}</th>
                  <th className="px-4 py-3">{en ? "Reason" : "재시도 사유"}</th>
                  <th className="px-4 py-3">{en ? "Attempts" : "시도 횟수"}</th>
                  <th className="px-4 py-3">{en ? "Backlog" : "적체"}</th>
                  <th className="px-4 py-3">{en ? "Guard" : "중복 방지"}</th>
                  <th className="px-4 py-3">{en ? "Next Window" : "다음 허용 시각"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${stringOf(row, "queueId", "connectionId")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-3">
                      <a className="font-bold text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>{stringOf(row, "connectionName")}</a>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "connectionId")} / {stringOf(row, "queueId")}</p>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "retryClass")}</td>
                    <td className="px-4 py-3">{stringOf(row, "retryReason")}</td>
                    <td className="px-4 py-3">{stringOf(row, "attemptCount")} / {stringOf(row, "maxAttempts")}</td>
                    <td className="px-4 py-3">{stringOf(row, "backlogCount")}</td>
                    <td className="px-4 py-3">{stringOf(row, "guardStatus")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "nextRetryAt")}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span></td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={8}>
                      {en ? "No retry candidates match the current filters." : "현재 조건에 맞는 재시도 대상이 없습니다."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="external-retry-policy">
            <GridToolbar title={en ? "Retry Policy" : "재시도 정책"} meta={en ? "Policy, dedupe, and fallback handling are grouped for operator review." : "정책, 중복 방지, 실패 후 처리를 운영 점검 기준으로 묶었습니다."} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Target" : "대상"}</th><th className="px-4 py-3">{en ? "Policy" : "정책"}</th><th className="px-4 py-3">{en ? "Guard Window" : "중복 방지 구간"}</th><th className="px-4 py-3">{en ? "Fallback" : "실패 후 처리"}</th><th className="px-4 py-3">{en ? "Owner" : "담당"}</th><th className="px-4 py-3">{en ? "Status" : "상태"}</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {policyRows.map((row, index) => (
                    <tr key={`${stringOf(row, "queueId", "connectionId")}-${index}`}>
                      <td className="px-4 py-3">{stringOf(row, "connectionName")}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "retryPolicy")}</td>
                      <td className="px-4 py-3">{stringOf(row, "guardWindow")}</td>
                      <td className="px-4 py-3">{stringOf(row, "fallbackPolicy")}</td>
                      <td className="px-4 py-3">{stringOf(row, "ownerName")}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="space-y-4">
            <article className="gov-card overflow-hidden p-0" data-help-id="external-retry-history">
              <GridToolbar title={en ? "Recent Replay History" : "최근 재처리 이력"} meta={en ? "Latest manual or automatic replay outcomes." : "최근 수동 또는 자동 재처리 결과입니다."} />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Executed" : "실행 시각"}</th><th className="px-4 py-3">{en ? "Target" : "대상"}</th><th className="px-4 py-3">{en ? "Result" : "결과"}</th><th className="px-4 py-3">{en ? "Duration" : "소요 시간"}</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {executionRows.map((row, index) => (
                      <tr key={`${stringOf(row, "jobId")}-${index}`}>
                        <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "executedAt")}</td>
                        <td className="px-4 py-3">{stringOf(row, "connectionName")}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "result"))}`}>{stringOf(row, "result")}</span></td>
                        <td className="px-4 py-3">{stringOf(row, "duration")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <CollectionResultPanel data-help-id="external-retry-links" title={en ? "Quick Links" : "바로가기"} description={en ? "Move into adjacent operational pages before triggering a replay." : "재시도 실행 전에 관련 운영 화면으로 바로 이동합니다."} icon="link">
              <div className="grid grid-cols-1 gap-3">
                {quickLinks.map((item, index) => (
                  <a key={`${stringOf(item, "label")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]" href={stringOf(item, "targetRoute", "href")}>{stringOf(item, "label", "title")}</a>
                ))}
              </div>
            </CollectionResultPanel>

            <CollectionResultPanel data-help-id="external-retry-guidance" title={en ? "Operating Guidance" : "운영 가이드"} description={en ? "Use the same gate before forcing a replay into downstream systems." : "하위 시스템으로 재처리 재전송을 강제하기 전 같은 기준으로 판단합니다."} icon="fact_check">
              <div className="space-y-3">
                {guidance.map((item, index) => (
                  <article key={`${stringOf(item, "title")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${badgeClass(stringOf(item, "tone"))}`}>{stringOf(item, "tone") || "INFO"}</span>
                      <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                    </div>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body", "description")}</p>
                  </article>
                ))}
              </div>
            </CollectionResultPanel>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
