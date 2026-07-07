import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalUsagePage } from "../../lib/api/ops";
import type { ExternalUsagePagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect } from "../member/common";

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("WARNING") || upper.includes("DEGRADED")) return "bg-amber-100 text-amber-700";
  if (upper.includes("ACTIVE") || upper.includes("HEALTHY")) return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export function ExternalUsageMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<ExternalUsagePagePayload>(fetchExternalUsagePage, [], {});
  const page = pageState.value;
  const summary = useMemo(() => ((page?.externalUsageSummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.externalUsageRows || []) as Array<Record<string, string>>), [page]);
  const keyRows = useMemo(() => ((page?.externalUsageKeyRows || []) as Array<Record<string, string>>), [page]);
  const trendRows = useMemo(() => ((page?.externalUsageTrendRows || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalUsageQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalUsageGuidance || []) as Array<Record<string, string>>), [page]);
  const [keyword, setKeyword] = useState("");
  const [authMethod, setAuthMethod] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [
        stringOf(row, "connectionId", "connectionKey"),
        stringOf(row, "connectionName"),
        stringOf(row, "partnerName"),
        stringOf(row, "authMethod"),
        stringOf(row, "consumerName"),
        stringOf(row, "topConsumer"),
        stringOf(row, "targetRoute")
      ].join(" ").toLowerCase();
      const matchesKeyword = !normalizedKeyword || haystack.includes(normalizedKeyword);
      const matchesAuthMethod = authMethod === "ALL" || stringOf(row, "authMethod").toUpperCase() === authMethod;
      const matchesStatus = status === "ALL" || stringOf(row, "status").toUpperCase() === status;
      return matchesKeyword && matchesAuthMethod && matchesStatus;
    });
  }, [authMethod, keyword, rows, status]);

  const filteredKeyRows = useMemo(() => {
    if (authMethod === "ALL") {
      return keyRows;
    }
    return keyRows.filter((row) => stringOf(row, "authMethod").toUpperCase() === authMethod);
  }, [authMethod, keyRows]);

  useEffect(() => {
    logGovernanceScope("PAGE", "external-usage", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      authMethod,
      status
    });
  }, [authMethod, en, filteredRows.length, rows.length, status]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: en ? "API Usage" : "API 사용량" }
      ]}
      title={en ? "API Usage" : "API 사용량"}
      subtitle={en ? "Review external integration traffic, auth grouping, and recent trend movement." : "외부연계 호출량, 인증 그룹, 최근 추세 변화를 함께 점검합니다."}
      actions={<a className="gov-btn" href={buildLocalizedPath("/admin/external/schema", "/en/admin/external/schema")}>{en ? "Schema Registry" : "외부 스키마"}</a>}
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading external API usage..." : "외부 API 사용량을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="external-usage-summary">
          {summary.map((item, index) => <SummaryMetricCard key={`${stringOf(item, "title")}-${index}`} title={stringOf(item, "title")} value={stringOf(item, "value")} description={stringOf(item, "description")} />)}
        </section>
        <CollectionResultPanel
          data-help-id="external-usage-filters"
          title={en ? "Usage Filters" : "사용량 조회 조건"}
          description={en ? "Filter by integration, auth method, or health state before opening downstream screens." : "하위 운영 화면으로 이동하기 전에 연계, 인증 방식, 상태 기준으로 범위를 좁힙니다."}
          icon="filter_alt"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[68rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalUsageKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput id="externalUsageKeyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Connection, partner, consumer" : "연계명, 기관명, 소비 시스템"} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalUsageAuthMethod">{en ? "Auth Method" : "인증 방식"}</label>
              <AdminSelect id="externalUsageAuthMethod" value={authMethod} onChange={(event) => setAuthMethod(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="OAUTH2">OAUTH2</option>
                <option value="API_KEY">API_KEY</option>
                <option value="MUTUAL_TLS">MUTUAL_TLS</option>
                <option value="OBSERVED">OBSERVED</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalUsageStatus">{en ? "Status" : "상태"}</label>
              <AdminSelect id="externalUsageStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="HEALTHY">HEALTHY</option>
                <option value="WARNING">WARNING</option>
                <option value="DEGRADED">DEGRADED</option>
                <option value="ACTIVE">ACTIVE</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-outline w-full" type="button" onClick={() => { setKeyword(""); setAuthMethod("ALL"); setStatus("ALL"); }}>
                {en ? "Reset Filters" : "검색 조건 초기화"}
              </button>
            </div>
          </div>
        </CollectionResultPanel>
        <section className="gov-card overflow-hidden p-0" data-help-id="external-usage-table">
          <GridToolbar
            title={en ? "Traffic Overview" : "트래픽 현황"}
            meta={(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")}
            actions={<p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Visible ${filteredRows.length} of ${rows.length}` : `전체 ${rows.length}건 중 ${filteredRows.length}건 표시`}</p>}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]"><tr><th className="px-4 py-3">{en ? "Connection" : "연계"}</th><th className="px-4 py-3">{en ? "Requests" : "호출 수"}</th><th className="px-4 py-3">{en ? "Errors" : "오류"}</th><th className="px-4 py-3">{en ? "Success" : "성공률"}</th><th className="px-4 py-3">{en ? "Latency" : "지연"}</th><th className="px-4 py-3">{en ? "Status" : "상태"}</th></tr></thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${stringOf(row, "connectionId", "connectionKey")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-3"><a className="font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(row, "targetRoute")}>{stringOf(row, "connectionName")}</a><div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "partnerName")}</div></td>
                    <td className="px-4 py-3">{stringOf(row, "requestCount")}</td>
                    <td className="px-4 py-3">{stringOf(row, "errorCount")}</td>
                    <td className="px-4 py-3">{stringOf(row, "successRate")}%</td>
                    <td className="px-4 py-3">{stringOf(row, "avgDurationText", "avgDurationMs")}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "status"))}`}>{stringOf(row, "status")}</span></td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={6}>{en ? "No external API usage rows match the current filters." : "현재 조건에 맞는 외부 API 사용량이 없습니다."}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="external-usage-auth">
            <GridToolbar title={en ? "Auth Method Mix" : "인증 방식 구성"} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Auth Method" : "인증 방식"}</th><th className="px-4 py-3">{en ? "Connections" : "연계 수"}</th><th className="px-4 py-3">{en ? "Requests" : "호출 수"}</th><th className="px-4 py-3">{en ? "Success" : "성공률"}</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredKeyRows.map((row, index) => <tr key={`${stringOf(row, "authMethod")}-${index}`}><td className="px-4 py-3">{stringOf(row, "authMethod")}</td><td className="px-4 py-3">{stringOf(row, "connectionCount")}</td><td className="px-4 py-3">{stringOf(row, "requestCount")}</td><td className="px-4 py-3">{stringOf(row, "successRate")}%</td></tr>)}
                  {filteredKeyRows.length === 0 ? <tr><td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={4}>{en ? "No auth-method breakdown is available for the current filters." : "현재 조건에 해당하는 인증 방식 집계가 없습니다."}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </article>
          <div className="space-y-4">
            <CollectionResultPanel data-help-id="external-usage-trend" title={en ? "Daily Trend" : "일간 추세"} description={en ? "Recent request, error, and slow-call movement." : "최근 호출, 오류, 지연 호출 추세입니다."} icon="monitoring">
              <div className="space-y-2">
                {trendRows.map((row, index) => <div key={`${stringOf(row, "date", "windowLabel")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm"><strong>{stringOf(row, "date", "windowLabel")}</strong><div className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "requestCount", "requestDelta")} / {stringOf(row, "errorCount", "errorDelta")} / {stringOf(row, "topConnection", "peakRps")}</div></div>)}
                {trendRows.length === 0 ? <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-6 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No recent trend data is available yet." : "아직 최근 추세 데이터가 없습니다."}</div> : null}
              </div>
            </CollectionResultPanel>
            <CollectionResultPanel data-help-id="external-usage-links" title={en ? "Quick Links" : "바로가기"} description={en ? "Move into related observability screens." : "관련 운영 화면으로 바로 이동합니다."} icon="link">
              <div className="grid grid-cols-1 gap-3">{quickLinks.map((item, index) => <a key={`${stringOf(item, "label")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]" href={stringOf(item, "targetRoute", "href")}>{stringOf(item, "label", "title")}</a>)}</div>
            </CollectionResultPanel>
            <CollectionResultPanel data-help-id="external-usage-guidance" title={en ? "Guidance" : "운영 가이드"} description={en ? "Keep quota and auth decisions aligned with source behavior." : "쿼터와 인증 정책은 원천 동작과 함께 판단합니다."} icon="fact_check">
              <div className="space-y-2">{guidance.map((item, index) => <div key={`${stringOf(item, "title")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm"><strong>{stringOf(item, "title")}</strong><p className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body", "description")}</p></div>)}</div>
            </CollectionResultPanel>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
