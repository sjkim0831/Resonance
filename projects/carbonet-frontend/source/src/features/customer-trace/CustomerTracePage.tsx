import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { fetchCustomerTraceSummary, fetchCustomerTraces } from "../../lib/api/aiManagement";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

const DOMAINS = ["", "공통", "회원인증", "탄소배출", "보고서인증서", "탄소정보", "모니터링", "거래", "결제", "외부연계", "콘텐츠", "시스템", "교육훈련", "모바일", "유지보수"];

export function CustomerTracePage() {
  const en = isEnglish();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const summary = useAsyncValue(() => fetchCustomerTraceSummary(), []);
  const traces = useAsyncValue(() => fetchCustomerTraces({ domain: domain || undefined, query: query || undefined, limit: "100" }), [domain, query]);

  useEffect(() => { logGovernanceScope("PAGE", "customer-trace", { language: en ? "en" : "ko" }); }, [en]);

  return (
    <AdminPageShell
      breadcrumbs={[{ label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") }, { label: en ? "AI Management" : "AI 운영" }, { label: en ? "Customer Trace" : "고객 요구 추적" }]}
      sidebarVariant="system"
      title={en ? "Customer Requirement Trace" : "고객 요구 추적"}
      subtitle={en ? "Connect customer evidence to pages, APIs, SDUI assets, SRs, and verification." : "고객 근거와 페이지·API·SDUI·SR·검증 증거를 연결합니다."}
      actions={<button className="gov-btn gov-btn-outline" onClick={() => { void summary.reload(); void traces.reload(); }} type="button">{en ? "Refresh" : "새로고침"}</button>}
    >
      <AdminWorkspacePageFrame>
        {summary.error || traces.error ? <PageStatusNotice tone="error">{summary.error || traces.error}</PageStatusNotice> : null}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetricCard title={en ? "Canonical use cases" : "기준 UC"} value={String(summary.value?.traceCount ?? "-")} description={en ? "Master customer use cases." : "고객 Master 기준 유즈케이스입니다."} />
          <SummaryMetricCard title={en ? "Customer maturity" : "고객 성숙도"} value={`${summary.value?.customerMaturity?.score ?? "-"} / ${summary.value?.customerMaturity?.grade ?? "-"}`} description={en ? "Requirement governance maturity." : "요구사항 관리 성숙도입니다."} />
          <SummaryMetricCard title={en ? "Delivery readiness" : "납품 준비도"} value={`${summary.value?.deliveryReadiness?.score ?? "-"} / ${summary.value?.deliveryReadiness?.grade ?? "-"}`} description={en ? "Evidence-backed delivery readiness." : "검증 증거 기반 납품 준비도입니다."} />
          <SummaryMetricCard title={en ? "SR review groups" : "SR 검토 묶음"} value={String(summary.value?.srRequestCount ?? "-")} description={en ? "Human review is required." : "사람의 검토 후 실행할 수 있습니다."} />
        </section>

        <section className="border-y border-[var(--kr-gov-border-light)] bg-white px-5 py-4">
          <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
            <select className="gov-select" value={domain} onChange={(event) => setDomain(event.target.value)} aria-label={en ? "Domain" : "도메인"}>
              {DOMAINS.map((item) => <option key={item || "ALL"} value={item}>{item || (en ? "All domains" : "전체 도메인")}</option>)}
            </select>
            <input className="gov-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Search use case ID or title" : "UC ID 또는 요구사항명 검색"} />
            <div className="flex min-h-10 items-center text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? `${traces.value?.total ?? 0} results` : `${traces.value?.total ?? 0}건`}</div>
          </div>
        </section>

        <section className="overflow-hidden border border-[var(--kr-gov-border-light)] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-[var(--kr-gov-border-light)] bg-slate-50 text-xs font-black text-slate-600">
                <tr><th className="px-4 py-3">UC</th><th className="px-4 py-3">{en ? "Requirement" : "요구사항"}</th><th className="px-4 py-3">{en ? "Domain" : "도메인"}</th><th className="px-4 py-3 text-center">{en ? "Pages" : "페이지"}</th><th className="px-4 py-3 text-center">API</th><th className="px-4 py-3 text-center">SR</th><th className="px-4 py-3">{en ? "Status" : "상태"}</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--kr-gov-border-light)]">
                {(traces.value?.items || []).map((row) => (
                  <tr key={row.useCaseId} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-[var(--kr-gov-blue)]">{row.useCaseId}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{row.title}</td><td className="px-4 py-3 text-slate-600">{row.domain}</td>
                    <td className="px-4 py-3 text-center font-bold">{row.pageCandidates?.length || 0}</td><td className="px-4 py-3 text-center font-bold">{row.apiCandidates?.length || 0}</td><td className="px-4 py-3 text-center font-bold">{row.srRequestIds?.length || 0}</td>
                    <td className="px-4 py-3"><span className="inline-flex border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">{row.bindingStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export default CustomerTracePage;
