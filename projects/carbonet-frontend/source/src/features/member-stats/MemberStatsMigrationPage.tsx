import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedMemberStatsPageData } from "../../lib/api/bootstrap";
import { fetchMemberStatsPage } from "../../lib/api/member";
import type { MemberStatsPagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { stringOf } from "../admin-system/adminSystemShared";
import { MemberButton } from "../member/common";
import { useEffect, useMemo } from "react";

export function MemberStatsMigrationPage() {
  const en = isEnglish();
  const initialPayload = useMemo(() => readBootstrappedMemberStatsPageData(), []);
  const pageState = useAsyncValue<MemberStatsPagePayload>(fetchMemberStatsPage, [], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload)
  });
  const page = pageState.value;
  const memberTypeStats = (page?.memberTypeStats || []) as Array<Record<string, string>>;
  const monthlySignupStats = (page?.monthlySignupStats || []) as Array<Record<string, string>>;
  const regionalDistribution = (page?.regionalDistribution || []) as Array<Record<string, string>>;

  useEffect(() => {
    logGovernanceScope("PAGE", "member-stats", {
      language: en ? "en" : "ko",
      totalMembers: Number(page?.totalMembers || 0),
      memberTypeCount: memberTypeStats.length,
      monthlyPoints: monthlySignupStats.length,
      regionalCount: regionalDistribution.length
    });
    logGovernanceScope("COMPONENT", "member-stats-summary", {
      memberTypeCount: memberTypeStats.length,
      monthlyPoints: monthlySignupStats.length,
      regionalCount: regionalDistribution.length
    });
  }, [en, memberTypeStats.length, monthlySignupStats.length, page?.totalMembers, regionalDistribution.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Member & Permission" : "회원·권한 관리" },
        { label: en ? "Member Statistics Dashboard" : "회원 통계 현황" }
      ]}
      title={en ? "Member Statistics Dashboard" : "회원 통계 현황"}
      subtitle={en ? "Analyze the registered member base by member type, monthly signups, and regional distribution." : "시스템에 등록된 전체 회원 정보를 유형별, 지역별로 분석합니다."}
    >
      {pageState.error ? <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageState.error}</div> : null}

      <div className="flex justify-end gap-2 mb-8">
        <MemberButton icon="calendar_today" size="xs" type="button" variant="secondary">{en ? "Period" : "기간 설정"}</MemberButton>
        <MemberButton icon="refresh" size="xs" type="button" variant="secondary">{en ? "Refresh" : "데이터 갱신"}</MemberButton>
        <MemberButton icon="description" size="xs" type="button" variant="primary">{en ? "Generate Report" : "보고서 생성"}</MemberButton>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10" data-help-id="member-stats-summary">
        <article className="gov-card">
          <h3 className="font-bold text-lg mb-8 flex items-center justify-between">
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-blue-600">pie_chart</span>{en ? "Member Type Ratio" : "회원 유형 비율"}</span>
            <span className="text-xs text-gray-400 font-normal">{en ? "Cumulative" : "누적 기준"}</span>
          </h3>
          <div className="relative flex items-center justify-center h-64">
            <svg className="w-48 h-48 -rotate-90" viewBox="0 0 100 100">
              <circle className="text-gray-100" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeWidth="12" />
              <circle className="text-blue-600" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeDasharray="78.7 100" strokeWidth="12" />
              <circle className="text-emerald-500" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeDasharray="21.3 100" strokeDashoffset="-78.7" strokeWidth="12" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-black">{Number(page?.totalMembers || 0).toLocaleString()}</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase">{en ? "Total Members" : "전체 회원"}</span>
            </div>
          </div>
          <div className="mt-8 space-y-4">
            {memberTypeStats.map((item) => (
              <div className="flex items-center justify-between" key={stringOf(item, "key")}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${stringOf(item, "colorClass")}`} />
                  <span className="text-sm font-bold">{stringOf(item, "label")}</span>
                </div>
                <span className="text-sm font-black">{`${stringOf(item, "percentage")}% (${Number(stringOf(item, "count") || "0").toLocaleString()}${en ? "" : "명"})`}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="gov-card col-span-1 lg:col-span-2" data-help-id="member-stats-trend">
          <h3 className="font-bold text-lg mb-8 flex items-center justify-between">
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-600">bar_chart</span>{en ? "Monthly New Signup Trend" : "월별 신규 가입 추이"}</span>
            <div className="flex gap-2 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-full bg-blue-200" />2024</span>
              <span className="flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-[var(--kr-gov-blue)]" />2025</span>
            </div>
          </h3>
          <div className="relative h-64 mt-12">
            <div className="absolute bottom-0 left-0 w-full h-px bg-gray-200" />
            <div className="flex items-end justify-between h-full px-4">
              {monthlySignupStats.map((item) => {
                const active = stringOf(item, "active") === "Y";
                return (
                  <div className="flex flex-col items-center gap-2 group cursor-pointer" key={stringOf(item, "month")}>
                    <div className="flex items-end gap-1">
                      <div className="w-4 bg-blue-100 rounded-t-sm" style={{ height: `${Number(stringOf(item, "previousHeight") || "0")}px` }} />
                      <div className={`w-8 rounded-t-sm ${active ? "bg-[var(--kr-gov-blue)]" : "bg-blue-300 group-hover:bg-[var(--kr-gov-blue)] transition-colors"}`} style={{ height: `${Number(stringOf(item, "currentHeight") || "0")}px` }} />
                    </div>
                    <span className={`text-[11px] ${active ? "font-bold text-[var(--kr-gov-blue)]" : "font-medium text-gray-400"}`}>{stringOf(item, "month")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      <section className="gov-card" data-help-id="member-stats-region">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2"><span className="material-symbols-outlined text-orange-500">map</span>{en ? "Regional Distribution of Enterprise Members" : "기업 회원 지역별 분포 현황"}</h3>
            <p className="text-xs text-gray-500 mt-1">{en ? "Aggregated based on enterprise member location information." : "기업 회원 소재지 정보를 기준으로 집계된 데이터입니다."}</p>
          </div>
          <MemberButton icon="download" size="xs" type="button" variant="secondary">{en ? "Download CSV" : "데이터 내려받기 (CSV)"}</MemberButton>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {regionalDistribution.map((item) => (
            <article className="p-4 bg-gray-50 rounded-[var(--kr-gov-radius)] border border-gray-100" key={stringOf(item, "region")}>
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "region")}</span>
                <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{stringOf(item, "percentage")}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${stringOf(item, "percentage")}%` }} /></div>
              <p className="text-[13px] mt-2 font-medium text-[var(--kr-gov-text-secondary)]">{stringOf(item, "countLabel")}</p>
            </article>
          ))}
        </div>
      </section>
    </AdminPageShell>
  );
}
