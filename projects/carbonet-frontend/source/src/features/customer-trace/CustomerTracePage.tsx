import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { fetchCustomerTrace, fetchCustomerTraceSummary, fetchCustomerTraces, type CustomerTraceDetail } from "../../lib/api/aiManagement";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

const DOMAINS = ["", "공통", "회원인증", "탄소배출", "보고서인증서", "탄소정보", "모니터링", "거래", "결제", "외부연계", "콘텐츠", "시스템", "교육훈련", "모바일", "유지보수"];

export function CustomerTracePage() {
  const en = isEnglish();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [detail, setDetail] = useState<CustomerTraceDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const summary = useAsyncValue(() => fetchCustomerTraceSummary(), []);
  const traces = useAsyncValue(() => fetchCustomerTraces({ domain: domain || undefined, query: query || undefined, limit: "100" }), [domain, query]);
  const runtimeGaps = (summary.value?.runtimeFindings || []).filter((finding) => finding.state !== "HEALTHY");

  useEffect(() => { logGovernanceScope("PAGE", "customer-trace", { language: en ? "en" : "ko" }); }, [en]);

  const openDetail = async (useCaseId: string) => {
    setDetailError("");
    try { setDetail(await fetchCustomerTrace(useCaseId)); }
    catch (error) { setDetailError(error instanceof Error ? error.message : String(error)); }
  };

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
        {runtimeGaps.length > 0 ? (
          <PageStatusNotice tone="warning">
            <strong>{en ? "Runtime deployment gaps" : "런타임 반영 대기"}</strong>
            <span className="ml-2">
              {runtimeGaps.map((finding) => `${finding.path} (${finding.httpStatus}, ${finding.remediation})`).join(" / ")}
            </span>
          </PageStatusNotice>
        ) : null}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryMetricCard title={en ? "Canonical use cases" : "기준 UC"} value={String(summary.value?.traceCount ?? "-")} description={en ? "Master customer use cases." : "고객 Master 기준 유즈케이스입니다."} />
          <SummaryMetricCard title={en ? "Customer maturity" : "고객 성숙도"} value={`${summary.value?.customerMaturity?.score ?? "-"} / ${summary.value?.customerMaturity?.grade ?? "-"}`} description={en ? "Requirement governance maturity." : "요구사항 관리 성숙도입니다."} />
          <SummaryMetricCard title={en ? "Delivery readiness" : "납품 준비도"} value={`${summary.value?.deliveryReadiness?.score ?? "-"} / ${summary.value?.deliveryReadiness?.grade ?? "-"}`} description={en ? "Evidence-backed delivery readiness." : "검증 증거 기반 납품 준비도입니다."} />
          <SummaryMetricCard title={en ? "SR review groups" : "SR 검토 묶음"} value={String(summary.value?.srRequestCount ?? "-")} description={en ? "Human review is required." : "사람의 검토 후 실행할 수 있습니다."} />
          <SummaryMetricCard title={en ? "Pending approvals" : "승인 검토 대기"} value={String(summary.value?.approvalStateSummary?.PENDING ?? "-")} description={en ? "No AI decision is auto-approved." : "AI 판단은 자동 승인되지 않습니다."} />
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
                  <tr key={row.useCaseId} className="cursor-pointer hover:bg-slate-50" onClick={() => void openDetail(row.useCaseId)}>
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

        {detailError ? <PageStatusNotice tone="error">{detailError}</PageStatusNotice> : null}
        {detail ? (
          <section className="border border-[var(--kr-gov-border-light)] bg-white" aria-label={en ? "Requirement evidence detail" : "요구사항 근거 상세"}>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--kr-gov-border-light)] px-5 py-4">
              <div><p className="font-mono text-xs font-bold text-[var(--kr-gov-blue)]">{detail.binding.useCaseId}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{detail.binding.title}</h2></div>
              <button className="gov-btn gov-btn-outline" type="button" onClick={() => setDetail(null)}>{en ? "Close" : "닫기"}</button>
            </header>
            <div className="grid gap-px bg-slate-200 lg:grid-cols-3">
              <div className="bg-white p-5"><p className="text-xs font-bold text-slate-500">{en ? "Approval" : "승인 상태"}</p><p className="mt-2 text-base font-black text-amber-800">{detail.approval?.state || "PENDING"}</p><p className="mt-1 text-xs text-slate-600">{detail.approval?.reviewer || (en ? "Reviewer not assigned" : "검토자 미지정")}</p></div>
              <div className="bg-white p-5"><p className="text-xs font-bold text-slate-500">{en ? "Page evidence" : "페이지 근거"}</p><p className="mt-2 text-2xl font-black text-slate-900">{detail.binding.pageCandidates?.length || 0}</p></div>
              <div className="bg-white p-5"><p className="text-xs font-bold text-slate-500">{en ? "API evidence / SR" : "API 근거 / SR"}</p><p className="mt-2 text-2xl font-black text-slate-900">{detail.binding.apiCandidates?.length || 0} / {detail.srRequests?.length || 0}</p></div>
            </div>
            <div className="grid gap-6 px-5 py-5 xl:grid-cols-2">
              <div><h3 className="text-sm font-black text-slate-900">{en ? "Page candidates" : "페이지 후보"}</h3><div className="mt-3 space-y-2">{(detail.binding.pageCandidates || []).map((item) => <div key={`${item.assetId}-${item.routePath}`} className="border-l-4 border-[var(--kr-gov-blue)] bg-slate-50 px-4 py-3"><p className="font-mono text-xs font-bold text-slate-900">{item.routePath || item.assetId}</p><p className="mt-1 text-xs text-slate-600">{item.httpEvidence?.classification || "PENDING"} · HTTP {item.httpEvidence?.httpStatus ?? "-"} · {en ? "agreement" : "합의"} {item.agreementCount ?? 0}</p></div>)}</div></div>
              <div><h3 className="text-sm font-black text-slate-900">{en ? "API candidates" : "API 후보"}</h3><div className="mt-3 space-y-2">{(detail.binding.apiCandidates || []).map((item) => <div key={`${item.assetId}-${item.contract}`} className="border-l-4 border-emerald-600 bg-slate-50 px-4 py-3"><p className="font-mono text-xs font-bold text-slate-900">{item.contract || item.assetId}</p><p className="mt-1 text-xs text-slate-600">{en ? "agreement" : "합의"} {item.agreementCount ?? 0} · {en ? "confidence" : "신뢰도"} {item.confidence ?? "-"}</p></div>)}</div></div>
            </div>
            <div className="border-t border-[var(--kr-gov-border-light)] px-5 py-5"><h3 className="text-sm font-black text-slate-900">{en ? "Linked SR review requests" : "연결된 SR 검토 요청"}</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{(detail.srRequests || []).map((request) => <div key={request.requestId} className="border border-slate-200 px-4 py-3"><p className="font-mono text-xs font-bold text-[var(--kr-gov-blue)]">{request.requestId}</p><p className="mt-1 text-sm font-bold text-slate-900">{request.summary}</p><p className="mt-1 text-xs text-slate-600">{request.approvalStatus} · auto execute: {String(request.executeAutomatically)}</p></div>)}</div></div>
          </section>
        ) : null}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export default CustomerTracePage;
