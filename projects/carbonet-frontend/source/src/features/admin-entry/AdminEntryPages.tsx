import { useEffect } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedAdminHomePageData } from "../../lib/api/bootstrap";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminPageShell } from "./AdminPageShell";
import { PublicLoginPage } from "../public-entry/PublicEntryPages";


export function AdminLoginPage() {
  // Authentication is shared; menu and API permissions remain account-specific.
  return <PublicLoginPage admin />;
}

export function AdminHomePage() {
  const en = window.location.pathname.startsWith("/en/");
  const page = readBootstrappedAdminHomePageData();
  const summaryCards = page?.summaryCards || [
    {
      title: en ? "Current RPS" : "현재 RPS",
      value: "0",
      description: en ? "Monitoring summary is not available yet." : "모니터링 요약 데이터를 아직 불러오지 못했습니다.",
      icon: "monitoring",
      iconClass: "text-[var(--kr-gov-green)]",
      borderClass: "border-l-[var(--kr-gov-green)]"
    },
    {
      title: en ? "Failed Today" : "오늘 실패",
      value: "0",
      description: en ? "Scheduler summary is not available yet." : "스케줄러 요약 데이터를 아직 불러오지 못했습니다.",
      icon: "schedule",
      iconClass: "text-orange-400",
      borderClass: "border-l-orange-400"
    },
    {
      title: en ? "Active Blocks" : "활성 차단",
      value: "0",
      description: en ? "Blocklist summary is not available yet." : "차단 요약 데이터를 아직 불러오지 못했습니다.",
      icon: "gpp_bad",
      iconClass: "text-[var(--kr-gov-blue)]",
      borderClass: "border-l-[var(--kr-gov-blue)]"
    }
  ];
  const reviewQueueRows = page?.reviewQueueRows || [];
  const reviewProgressRows = page?.reviewProgressRows || [];
  const operationalStatusRows = page?.operationalStatusRows || [];
  const systemLogs = page?.systemLogs || [];

  useEffect(() => {
    logGovernanceScope("PAGE", "admin-home", {
      language: en ? "en" : "ko",
      summaryCardCount: summaryCards.length,
      reviewQueueCount: reviewQueueRows.length,
      operationalStatusCount: operationalStatusRows.length,
      systemLogCount: systemLogs.length
    });
    logGovernanceScope("COMPONENT", "admin-home-dashboard", {
      summaryCardCount: summaryCards.length,
      reviewQueueCount: reviewQueueRows.length,
      reviewProgressCount: reviewProgressRows.length,
      operationalStatusCount: operationalStatusRows.length
    });
  }, [en, operationalStatusRows.length, reviewProgressRows.length, reviewQueueRows.length, summaryCards.length, systemLogs.length]);

  function statusBoxClass(status: string) {
    if (status === "WARNING") return "bg-orange-50 border-orange-100";
    if (status === "CRITICAL") return "bg-red-50 border-red-100";
    return "bg-gray-50 border-gray-100";
  }

  function statusMetaClass(status: string) {
    if (status === "WARNING") return "text-orange-600 font-bold";
    if (status === "CRITICAL") return "text-red-500 font-bold";
    return "text-gray-500";
  }

  function statusIconClass(status: string) {
    if (status === "WARNING") return "text-orange-500";
    if (status === "CRITICAL") return "text-red-500";
    return "text-gray-400";
  }

  function statusDotClass(status: string) {
    if (status === "WARNING") return "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.45)]";
    if (status === "CRITICAL") return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
    return "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]";
  }

  function logChipClass(level: string) {
    if (level === "WARNING") return "bg-orange-100 text-orange-700";
    if (level === "CRITICAL") return "bg-red-100 text-red-700";
    return "bg-blue-100 text-blue-700";
  }

  return (
    <AdminPageShell
      actions={(
        <button className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] text-[13px] font-bold hover:bg-gray-50" type="button">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          {en ? "Refresh" : "새로고침"}
        </button>
      )}
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Operations Dashboard" : "운영 대시보드" }
      ]}
      sidebarVariant="dashboard"
      subtitle={en ? "Monitor the real-time operating status of the carbon capture, utilization, and storage system." : "실시간 탄소 포집·활용·저장 시스템 운영 현황을 모니터링합니다."}
      title={en ? "Operations Dashboard" : "운영 관리 대시보드"}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" data-help-id="admin-home-cards">
        {summaryCards.map((card) => (
          <article className={`gov-card border-l-4 ${String(card.borderClass || "border-l-[var(--kr-gov-blue)]")}`} key={`${card.title}-${card.value}`}>
            <div className="flex justify-between items-start">
              <p className="font-bold text-[var(--kr-gov-text-secondary)]">{String(card.title || "")}</p>
              <span className={`material-symbols-outlined ${String(card.iconClass || "text-[var(--kr-gov-blue)]")}`}>{String(card.icon || "insights")}</span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight">{String(card.value || "0")}</span>
            </div>
            <p className="mt-4 text-[12px] text-[var(--kr-gov-text-secondary)] font-medium leading-relaxed">{String(card.description || "")}</p>
          </article>
        ))}
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <article className="gov-card" data-help-id="admin-home-approvals">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">fact_check</span>
              {en ? "Priority Review Queue" : "우선 검토 대기열"}
            </h3>
            <a className="text-xs font-bold text-[var(--kr-gov-blue)] hover:underline flex items-center gap-1" href={buildLocalizedPath("/admin/emission/result_list?resultStatus=REVIEW", "/en/admin/emission/result_list?resultStatus=REVIEW")}>
              {en ? "View All" : "전체보기"} <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-y border-[var(--kr-gov-border-light)]">
                <tr>
                  <th className="px-4 py-3 font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Project" : "대상"}</th>
                  <th className="px-4 py-3 font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Company" : "기관"}</th>
                  <th className="px-4 py-3 font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Calculated On" : "산정일"}</th>
                  <th className="px-4 py-3 font-bold text-center text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "상태"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reviewQueueRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                      {en ? "There are no queued review items." : "대기 중인 검토 항목이 없습니다."}
                    </td>
                  </tr>
                ) : reviewQueueRows.map((row, index) => (
                  <tr className="hover:bg-gray-50/50 transition-colors" key={`${row.title || "queue"}-${index}`}>
                    <td className="px-4 py-4 font-medium">
                      <a className="hover:underline" href={String(row.detailUrl || buildLocalizedPath("/admin/emission/result_list?resultStatus=REVIEW", "/en/admin/emission/result_list?resultStatus=REVIEW"))}>
                        {String(row.title || "")}
                      </a>
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-xs">{String(row.type || "")}</td>
                    <td className="px-4 py-4 text-gray-500 text-xs">{String(row.appliedOn || "")}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[12px] font-black rounded-full">
                        {String(row.statusLabel || (en ? "Pending" : "대기"))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="gov-card" data-help-id="admin-home-progress">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--kr-gov-green)]">bar_chart</span>
              {en ? "Emission Review Progress" : "배출 결과 진행 현황"}
            </h3>
            <span className="text-[11px] font-bold text-gray-400 uppercase">{en ? "Unit: result count" : "단위: 결과 건수"}</span>
          </div>
          <div aria-label={en ? "Bar chart by review stage" : "검토 진행 단계별 막대 그래프"} className="space-y-5">
            {reviewProgressRows.map((row, index) => (
              <div key={`${row.label || "progress"}-${index}`}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{String(row.label || "")}</span>
                  <span className="text-[13px] font-black text-[var(--kr-gov-blue)]">{String(row.value || "0")}</span>
                </div>
                <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${String(row.barClass || "bg-blue-400")}`} style={{ width: String(row.width || "0%") }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <article className="gov-card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">hub</span>
              {en ? "Operational Safeguard Status" : "운영 보호장치 상태"}
            </h3>
          </div>
          <div className="space-y-3">
            {operationalStatusRows.map((row, index) => (
              <div className={`flex items-center justify-between p-4 rounded-[var(--kr-gov-radius)] border ${statusBoxClass(String(row.status || ""))}`} key={`${row.label || "status"}-${index}`}>
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined ${statusIconClass(String(row.status || ""))}`}>{String(row.icon || "radio_button_checked")}</span>
                  <span className="text-sm font-bold">{String(row.label || "")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-medium ${statusMetaClass(String(row.status || ""))}`}>{String(row.meta || "")}</span>
                  <span className={`status-dot ${statusDotClass(String(row.status || ""))}`}></span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="gov-card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">history_edu</span>
              {en ? "Recent Security Audit Logs" : "최근 보안 감사 로그"}
            </h3>
            <a className="text-xs font-bold text-gray-400 hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/admin/security/audit", "/en/admin/security/audit")}>
              {en ? "Open Audit Page" : "감사 화면 이동"}
            </a>
          </div>
          <div className="space-y-4">
            {systemLogs.map((row, index) => (
              <div className={`flex gap-4 items-start ${index < systemLogs.length - 1 ? "pb-3 border-b border-gray-100" : "pb-1"}`} key={`${row.level || "INFO"}-${row.timestamp || index}`}>
                <span className={`px-2 py-0.5 text-[10px] font-black rounded ${logChipClass(String(row.level || "INFO"))}`}>{String(row.level || "INFO")}</span>
                <div className="flex-1">
                  <p className="text-[13px] font-medium">{String(row.message || "")}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{String(row.timestamp || "")}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AdminPageShell>
  );
}
