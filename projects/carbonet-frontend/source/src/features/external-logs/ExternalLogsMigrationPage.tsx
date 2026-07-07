import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalLogsPage } from "../../lib/api/ops";
import type { ExternalLogsPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect } from "../member/common";

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("DANGER") || upper.includes("ERROR") || upper.includes("FAIL") || upper.includes("5")) return "bg-red-100 text-red-700";
  if (upper.includes("WARNING") || upper.includes("SLOW") || upper.includes("4") || upper.includes("REVIEW")) return "bg-amber-100 text-amber-700";
  if (upper.includes("NEUTRAL") || upper.includes("TRACE") || upper.includes("ACCESS")) return "bg-slate-100 text-slate-700";
  return "bg-emerald-100 text-emerald-700";
}

export function ExternalLogsMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<ExternalLogsPagePayload>(fetchExternalLogsPage, [], {});
  const page = pageState.value;
  const summary = useMemo(() => ((page?.externalLogSummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.externalLogRows || []) as Array<Record<string, string>>), [page]);
  const issueRows = useMemo(() => ((page?.externalLogIssueRows || []) as Array<Record<string, string>>), [page]);
  const connectionRows = useMemo(() => ((page?.externalLogConnectionRows || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalLogQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalLogGuidance || []) as Array<Record<string, string>>), [page]);
  const [keyword, setKeyword] = useState("");
  const [logType, setLogType] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [
        stringOf(row, "connectionName"),
        stringOf(row, "apiId"),
        stringOf(row, "requestUri"),
        stringOf(row, "traceId"),
        stringOf(row, "detail"),
        stringOf(row, "actorId")
      ].join(" ").toLowerCase();
      const matchesKeyword = !normalizedKeyword || haystack.includes(normalizedKeyword);
      const matchesType = logType === "ALL" || stringOf(row, "logType").toUpperCase() === logType;
      const matchesSeverity = severity === "ALL" || stringOf(row, "severity").toUpperCase() === severity;
      return matchesKeyword && matchesType && matchesSeverity;
    });
  }, [keyword, logType, rows, severity]);

  useEffect(() => {
    logGovernanceScope("PAGE", "external-logs", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      logType,
      severity
    });
  }, [en, filteredRows.length, logType, rows.length, severity]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: en ? "External Logs" : "외부 연계 로그" }
      ]}
      title={en ? "External Logs" : "외부 연계 로그"}
      subtitle={en ? "Review recent access, error, and trace events for external integrations in one operating queue." : "외부연계 access, error, trace 이벤트를 하나의 운영 큐에서 함께 점검합니다."}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/external/usage", "/en/admin/external/usage")}>{en ? "API Usage" : "API 사용량"}</a>
          <a className="gov-btn" href={buildLocalizedPath("/admin/external/connection_list", "/en/admin/external/connection_list")}>{en ? "Connection Registry" : "외부 연계 목록"}</a>
        </div>
      }
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading external log activity..." : "외부연계 로그 현황을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="external-logs-summary">
          {summary.map((item, index) => (
            <SummaryMetricCard key={`${stringOf(item, "title")}-${index}`} title={stringOf(item, "title")} value={stringOf(item, "value")} description={stringOf(item, "description")} />
          ))}
        </section>

        <CollectionResultPanel data-help-id="external-logs-filters" title={en ? "Log Filters" : "로그 조회 조건"} description={en ? "Filter the recent queue by type, severity, or identifiers before opening drill-down pages." : "상세 화면으로 이동하기 전에 유형, 위험도, 식별자로 최근 이벤트 범위를 좁힙니다."} icon="filter_alt">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[68rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalLogsKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput id="externalLogsKeyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Connection, URI, trace, actor" : "연계명, URI, trace, 작업자"} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalLogsType">{en ? "Log Type" : "로그 유형"}</label>
              <AdminSelect id="externalLogsType" value={logType} onChange={(event) => setLogType(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ACCESS">ACCESS</option>
                <option value="ERROR">ERROR</option>
                <option value="TRACE">TRACE</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalLogsSeverity">{en ? "Severity" : "위험도"}</label>
              <AdminSelect id="externalLogsSeverity" value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="DANGER">DANGER</option>
                <option value="WARNING">WARNING</option>
                <option value="NEUTRAL">NEUTRAL</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-outline w-full" type="button" onClick={() => { setKeyword(""); setLogType("ALL"); setSeverity("ALL"); }}>
                {en ? "Reset Filters" : "검색 조건 초기화"}
              </button>
            </div>
          </div>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="external-logs-queue">
          <GridToolbar title={en ? "Recent Integration Events" : "최근 외부연계 이벤트"} meta={(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")} actions={<p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Visible ${filteredRows.length} of ${rows.length}` : `전체 ${rows.length}건 중 ${filteredRows.length}건 표시`}</p>} />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">{en ? "Occurred" : "발생 시각"}</th>
                  <th className="px-4 py-3">{en ? "Type" : "유형"}</th>
                  <th className="px-4 py-3">{en ? "Connection" : "연계"}</th>
                  <th className="px-4 py-3">{en ? "Target" : "대상"}</th>
                  <th className="px-4 py-3">{en ? "Detail" : "상세"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${stringOf(row, "id")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "occurredAt")}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "severity"))}`}>{stringOf(row, "logType")}</span></td>
                    <td className="px-4 py-3">
                      <a className="font-bold text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>{stringOf(row, "connectionName")}</a>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "apiId") || stringOf(row, "traceId")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{stringOf(row, "requestUri") || "-"}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "actorId") || "-"}</p>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "detail")}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span></td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={6}>{en ? "No external log events match the current filters." : "현재 조건에 맞는 외부연계 로그가 없습니다."}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,1fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="external-logs-issues">
            <GridToolbar title={en ? "Recent Issues" : "최근 주의 이슈"} meta={en ? "Latency, response, and error signals are sorted together." : "지연, 응답 이상, 오류 신호를 함께 정렬해 보여줍니다."} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Occurred" : "발생 시각"}</th><th className="px-4 py-3">{en ? "Issue" : "이슈"}</th><th className="px-4 py-3">{en ? "Connection" : "연계"}</th><th className="px-4 py-3">{en ? "Status" : "상태"}</th><th className="px-4 py-3">{en ? "Detail" : "상세"}</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {issueRows.map((row, index) => (
                    <tr key={`${stringOf(row, "occurredAt")}-${index}`}>
                      <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "occurredAt")}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "issueType"))}`}>{stringOf(row, "issueType")}</span></td>
                      <td className="px-4 py-3"><a className="font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(row, "targetRoute")}>{stringOf(row, "connectionName")}</a></td>
                      <td className="px-4 py-3">{stringOf(row, "status")}</td>
                      <td className="px-4 py-3">{stringOf(row, "detail")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="space-y-4">
            <article className="gov-card overflow-hidden p-0" data-help-id="external-logs-watchlist">
              <GridToolbar title={en ? "Watchlist Connections" : "감시 대상 연계"} meta={en ? "Connections already trending toward review are pinned here." : "상태 저하 조짐이 있는 연계를 상단에 고정합니다."} />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Connection" : "연계"}</th><th className="px-4 py-3">{en ? "Errors" : "오류"}</th><th className="px-4 py-3">{en ? "Latency" : "지연"}</th><th className="px-4 py-3">{en ? "Status" : "상태"}</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {connectionRows.map((row, index) => (
                      <tr key={`${stringOf(row, "connectionId")}-${index}`}>
                        <td className="px-4 py-3">
                          <a className="font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(row, "targetRoute")}>{stringOf(row, "connectionName")}</a>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "lastSeenAt")}</p>
                        </td>
                        <td className="px-4 py-3">{stringOf(row, "errorCount")}</td>
                        <td className="px-4 py-3">{stringOf(row, "avgDurationMs")}ms</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span></td>
                      </tr>
                    ))}
                    {connectionRows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={4}>{en ? "No watchlist connections right now." : "현재 감시 대상 연계가 없습니다."}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <CollectionResultPanel data-help-id="external-logs-links" title={en ? "Quick Links" : "바로가기"} description={en ? "Open the connected operational pages for deeper drill-down." : "연결된 운영 화면으로 바로 이동해 상세 원인을 확인합니다."} icon="link">
              <div className="grid grid-cols-1 gap-3">
                {quickLinks.map((item, index) => (
                  <a key={`${stringOf(item, "label")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]" href={stringOf(item, "targetRoute", "href")}>{stringOf(item, "label", "title")}</a>
                ))}
              </div>
            </CollectionResultPanel>
          </div>
        </section>

        <CollectionResultPanel data-help-id="external-logs-guidance" title={en ? "Operating Guidance" : "운영 가이드"} description={en ? "Keep the same incident baseline before retrying, reprocessing, or escalating to a partner." : "재시도, 재처리, 대외 협의 전에 같은 기준으로 먼저 판단합니다."} icon="fact_check">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
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
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
