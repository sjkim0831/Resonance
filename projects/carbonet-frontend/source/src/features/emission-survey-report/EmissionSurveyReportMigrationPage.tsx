import { useMemo } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard, WarningPanel } from "../admin-ui/common";
import { AdminSummaryStrip, AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberButton, MemberButtonGroup } from "../member/common";
import {
  loadEmissionSurveyReportSession,
  type EmissionSurveyReportPayload,
  type EmissionSurveyReportRow,
  type EmissionSurveyReportSectionSummary
} from "./reportSession";

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

function formatPercent(value: number, digits = 1) {
  return `${formatNumber(value, digits)}%`;
}

function sectionColor(index: number) {
  const palette = [
    "from-slate-900 to-slate-700",
    "from-emerald-600 to-emerald-500",
    "from-cyan-600 to-sky-500",
    "from-amber-500 to-orange-500",
    "from-violet-600 to-fuchsia-500",
    "from-rose-600 to-pink-500",
    "from-blue-700 to-indigo-500",
    "from-slate-500 to-slate-400"
  ];
  return palette[index % palette.length];
}

function renderScenarioToneClassName(tone: string) {
  if (tone === "optimized") {
    return "border-emerald-200 bg-emerald-50";
  }
  if (tone === "conservative") {
    return "border-slate-200 bg-slate-50";
  }
  return "border-[var(--kr-gov-blue)] bg-blue-50";
}

function buildSectionGroups(rows: EmissionSurveyReportRow[]) {
  const map = new Map<string, { sectionLabel: string; rows: EmissionSurveyReportRow[] }>();
  rows.forEach((row) => {
    const current = map.get(row.sectionCode);
    if (current) {
      current.rows.push(row);
      return;
    }
    map.set(row.sectionCode, {
      sectionLabel: row.sectionLabel,
      rows: [row]
    });
  });
  return Array.from(map.entries()).map(([sectionCode, value]) => ({
    sectionCode,
    sectionLabel: value.sectionLabel,
    rows: value.rows
  }));
}

function buildInsight(summary: EmissionSurveyReportPayload["summary"], sections: EmissionSurveyReportSectionSummary[], en: boolean) {
  const top = sections[0];
  if (!top) {
    return en
      ? "No calculated rows are available yet. Fill in quantity and emission factor values first."
      : "아직 계산 가능한 행이 없습니다. 양과 배출계수를 먼저 입력하세요.";
  }
  return en
    ? `${top.sectionLabel} drives ${formatPercent(summary.topContributorSharePercent)} of the current total footprint. Read this report as a contribution map, not just a final number.`
    : `${top.sectionLabel} 섹션이 전체 배출량의 ${formatPercent(summary.topContributorSharePercent)}를 차지합니다. 이 리포트는 최종 숫자보다 기여 구조를 읽는 화면으로 봐야 합니다.`;
}

function barWidth(totalEmission: number, maxEmission: number) {
  if (totalEmission <= 0 || maxEmission <= 0) {
    return 0;
  }
  return Math.max(8, (totalEmission / maxEmission) * 100);
}

export function EmissionSurveyReportMigrationPage() {
  const en = isEnglish();
  const report = loadEmissionSurveyReportSession();

  logGovernanceScope("PAGE", "emission-survey-report", {
    route: window.location.pathname,
    hasSessionPayload: Boolean(report),
    productName: report?.productName || ""
  });

  const chartSections = useMemo(
    () => (report?.sectionSummaries || []).filter((section) => section.totalEmission > 0),
    [report]
  );
  const sectionGroups = useMemo(
    () => buildSectionGroups(report?.rows || []),
    [report]
  );

  if (!report) {
    return (
      <AdminPageShell
        breadcrumbs={[
          { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
          { label: en ? "Emissions & Certification" : "배출/인증" },
          { label: en ? "Emission Survey Management" : "배출 설문 관리", href: buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin") },
          { label: en ? "Carbon Report" : "탄소배출량 리포트" }
        ]}
        title={en ? "Carbon Emission Analysis Report" : "탄소배출량 분석 리포트"}
        subtitle={en ? "No calculated report session was found." : "계산 결과 세션을 찾지 못했습니다."}
      >
        <AdminWorkspacePageFrame>
          <PageStatusNotice tone="warning">
            {en
              ? "Open this page through the calculation button on the survey admin screen."
              : "배출 설문 관리 화면의 `실제 탄소배출량 계산` 버튼을 통해 이 페이지로 진입하세요."}
          </PageStatusNotice>
          <MemberButton onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin"))} type="button">
            {en ? "Back To Survey Admin" : "배출 설문 관리로 이동"}
          </MemberButton>
        </AdminWorkspacePageFrame>
      </AdminPageShell>
    );
  }

  const generatedDate = new Date(report.generatedAt);
  const generatedLabel = Number.isNaN(generatedDate.getTime()) ? report.generatedAt : generatedDate.toLocaleString();
  const insight = buildInsight(report.summary, chartSections, en);
  const maxChartEmission = chartSections.reduce((max, section) => Math.max(max, section.totalEmission), 0);
  const normalization = report.normalization || {
    outputQuantityTotal: 0,
    factor: 1,
    applied: false
  };

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Emissions & Certification" : "배출/인증" },
        { label: en ? "Emission Survey Management" : "배출 설문 관리", href: buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin") },
        { label: en ? "Carbon Report" : "탄소배출량 리포트" }
      ]}
      title={en ? "Carbon Emission Analysis Report" : "탄소배출량 분석 리포트"}
      subtitle={en ? "Manager report with charts, scenarios, and audit notes." : "그래프, 시나리오, 검증 메모를 함께 보여주는 관리자 리포트입니다."}
      actions={(
        <MemberButtonGroup>
          <MemberButton onClick={() => window.print()} type="button" variant="secondary">{en ? "Export PDF" : "PDF 출력"}</MemberButton>
          <MemberButton onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin"))} type="button" variant="secondary">{en ? "Recalculate" : "다시 계산"}</MemberButton>
        </MemberButtonGroup>
      )}
    >
      <AdminWorkspacePageFrame>
        <section className="overflow-hidden rounded-[calc(var(--kr-gov-radius)+10px)] bg-[linear-gradient(135deg,#0f172a,#11284d_42%,#0f766e)] text-white shadow-[0_26px_60px_rgba(15,23,42,0.22)]">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_380px] lg:px-8 lg:py-8">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/80">
                {en ? "Product Carbon Footprint" : "제품 탄소발자국"}
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white lg:text-5xl">
                {report.productName || report.pageTitle}
              </h1>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-white/80 lg:text-[15px]">
                {insight}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/75">
                <span>{en ? "Generated" : "계산일시"} {generatedLabel}</span>
                <span className="h-1 w-1 rounded-full bg-white/35" />
                <span>{en ? "Category" : "계산 범위"} {report.calculationScope.categoryName || "-"}</span>
                <span className="h-1 w-1 rounded-full bg-white/35" />
                <span>{en ? "Tier" : "기준 Tier"} {report.calculationScope.tierLabel || "-"}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[calc(var(--kr-gov-radius)+4px)] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">{en ? "Total Footprint" : "총 탄소배출량"}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.05em]">{formatNumber(report.summary.totalEmission)}</p>
                <p className="mt-1 text-xs text-white/70">kg CO2e</p>
              </div>
              <div className="rounded-[calc(var(--kr-gov-radius)+4px)] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">{en ? "Top Contributor" : "최대 기여 섹션"}</p>
                <p className="mt-3 text-xl font-black tracking-[-0.04em]">{report.summary.topContributorLabel || "-"}</p>
                <p className="mt-1 text-xs text-white/70">{formatPercent(report.summary.topContributorSharePercent)}</p>
              </div>
              <div className="rounded-[calc(var(--kr-gov-radius)+4px)] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">{en ? "Data Confidence" : "데이터 신뢰도"}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.05em]">{report.summary.dataConfidence}</p>
                <p className="mt-1 text-xs text-white/70">/ 100</p>
              </div>
              <div className="rounded-[calc(var(--kr-gov-radius)+4px)] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">{en ? "Warnings" : "경고 건수"}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.05em]">{report.summary.warningCount}</p>
                <p className="mt-1 text-xs text-white/70">{en ? "audit notes" : "검토 메모"}</p>
              </div>
            </div>
          </div>
        </section>

        <AdminSummaryStrip>
          <SummaryMetricCard title={en ? "Total Carbon Footprint" : "총 탄소배출량"} value={`${formatNumber(report.summary.totalEmission)} kg CO2e`} description={en ? "Calculated rows only" : "배출계수와 양이 모두 입력된 행 기준"} />
          <SummaryMetricCard title={en ? "Calculated Rows" : "계산 완료 행"} value={`${report.summary.calculatedRowCount} / ${report.summary.rowCount}`} description={en ? "Rows ready for final calculation" : "전체 입력 행 중 계산 가능한 행"} accentClassName="text-emerald-700" surfaceClassName="bg-emerald-50" />
          <SummaryMetricCard title={en ? "Classification" : "분류 정보"} value={`${report.classification.majorLabel || "-"} / ${report.classification.middleLabel || "-"}`} description={report.classification.smallLabel || (en ? "No small classification selected" : "소분류 미선택")} accentClassName="text-sky-700" surfaceClassName="bg-sky-50" />
          <SummaryMetricCard
            title={en ? "Normalization Base" : "정규화 기준"}
            value={normalization.applied ? `1 / ${formatNumber(normalization.outputQuantityTotal, 6)}` : "1 / 1"}
            description={normalization.applied
              ? (en ? "Product + byproduct total rebased to 1." : "제품+부산물 총량을 1 기준으로 재산정했습니다.")
              : (en ? "No output quantity was entered." : "제품/부산물 총량이 없어 원본 양을 유지했습니다.")}
            accentClassName="text-amber-700"
            surfaceClassName="bg-amber-50"
          />
        </AdminSummaryStrip>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_420px]">
          <div className="space-y-6">
            <section className="rounded-[calc(var(--kr-gov-radius)+6px)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{en ? "Contribution Analysis" : "기여도 분석"}</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--kr-gov-text-primary)]">{en ? "Section Contribution Graph" : "섹션별 탄소배출 기여 그래프"}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{en ? "Observation Mode" : "관찰 모드"}</span>
              </div>
              <div className="mt-6 rounded-[calc(var(--kr-gov-radius)+4px)] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff,#f3f8fb)] p-5">
                <div className="space-y-4 rounded-[calc(var(--kr-gov-radius)+2px)] bg-[linear-gradient(180deg,#f8fbff,#eef4f8)] px-4 py-4">
                  {chartSections.map((section, index) => {
                    const width = barWidth(section.totalEmission, maxChartEmission);
                    return (
                      <div className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_88px] items-center gap-4" key={section.sectionCode}>
                        <div className="text-sm font-bold text-slate-700">
                          {section.sectionLabel}
                        </div>
                        <div className="h-11 rounded-full bg-slate-200/80 p-1">
                          <div
                            className={`flex h-full items-center justify-end rounded-full bg-gradient-to-r ${sectionColor(index)} px-3 text-right text-xs font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]`}
                            style={{ width: `${width}%` }}
                          >
                            {formatPercent(section.sharePercent)}
                          </div>
                        </div>
                        <div className="text-right text-xs font-bold text-slate-500">
                          {formatNumber(section.totalEmission)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {en
                    ? "Read each horizontal bar as the normalized section emission after rebasing product + byproduct quantity to 1."
                    : "각 가로 막대는 제품+부산물 총량을 1 기준으로 환산한 뒤 다시 계산한 섹션별 배출량입니다."}
                </p>
              </div>
            </section>

            <CollectionResultPanel
              data-help-id="emission-survey-report-patterns"
              description={en ? "Strategic reading notes derived from the current survey input." : "현재 설문 입력값에서 읽힌 전략적 해석 메모입니다."}
              icon="auto_awesome"
              title={en ? "Patterns & Strategic Interpretation" : "패턴과 전략적 해석"}
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Observation" : "관찰"}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{insight}</p>
                </div>
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Pattern Recognition" : "패턴 인식"}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? `${report.summary.calculatedRowCount} rows are calculation-ready, while ${report.summary.warningCount} warning conditions still shape the interpretation of this report.`
                      : `${report.summary.calculatedRowCount}개 행이 실제 계산에 반영되었고, ${report.summary.warningCount}건의 경고가 최종 해석에 영향을 줍니다.`}
                  </p>
                </div>
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Form & Dimension" : "형상과 차원"}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "The report mixes absolute value, relative share, and audit warning layers in one view so operators can read cause, weight, and confidence together."
                      : "이 리포트는 절대값, 상대 비중, 검증 경고를 한 화면에 겹쳐 배치해 원인, 무게감, 신뢰도를 함께 읽도록 구성했습니다."}
                  </p>
                </div>
              </div>
            </CollectionResultPanel>

            <section className="rounded-[calc(var(--kr-gov-radius)+6px)] border border-[var(--kr-gov-border-light)] bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kr-gov-border-light)] px-5 py-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{en ? "Detailed Inventory" : "상세 계산 인벤토리"}</p>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[var(--kr-gov-text-primary)]">{en ? "Detailed Calculation Inventory" : "상세 계산 결과표"}</h2>
                </div>
                <MemberButton onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin"))} size="sm" type="button" variant="secondary">
                  {en ? "Back To Editor" : "입력 화면으로"}
                </MemberButton>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                      <th className="px-4 py-3">{en ? "Section / Substance" : "섹션 / 물질명"}</th>
                      <th className="px-4 py-3">{en ? "Quantity" : "양"}</th>
                      <th className="px-4 py-3">{en ? "Unit" : "단위"}</th>
                      <th className="px-4 py-3">{en ? "Emission Factor" : "배출계수"}</th>
                      <th className="px-4 py-3">{en ? "Total CO2e" : "산출량"}</th>
                      <th className="px-4 py-3">{en ? "Audit Status" : "검증 상태"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionGroups.map((group) => (
                      <FragmentSectionRows en={en} group={group} key={group.sectionCode} />
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white">
                    <tr>
                      <td className="px-4 py-4 text-right text-xs font-black uppercase tracking-[0.16em] text-white/65" colSpan={4}>
                        {en ? "Summation Result" : "최종 합계"}
                      </td>
                      <td className="px-4 py-4 text-lg font-black">{formatNumber(report.summary.totalEmission)}</td>
                      <td className="px-4 py-4 text-sm text-white/70">kg CO2e</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[calc(var(--kr-gov-radius)+6px)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{en ? "Scenario Projection" : "시나리오 비교"}</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[var(--kr-gov-text-primary)]">{en ? "Scenario Projection" : "시나리오 예측"}</h2>
              <div className="mt-5 space-y-3">
                {report.scenarios.map((scenario) => (
                  <div className={`rounded-[var(--kr-gov-radius)] border p-4 ${renderScenarioToneClassName(scenario.tone)}`} key={scenario.label}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{scenario.label}</p>
                        <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--kr-gov-text-primary)]">{formatNumber(scenario.totalEmission)} <span className="text-sm font-bold text-slate-500">kg</span></p>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-black ${scenario.deltaPercent <= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {scenario.deltaPercent > 0 ? "+" : ""}{formatPercent(scenario.deltaPercent)}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{scenario.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {report.alerts.length > 0 ? (
              <WarningPanel title={en ? "Audit Integrity Flag" : "검증 / 감사 플래그"}>
                <ul className="space-y-3">
                  {report.alerts.map((alert, index) => (
                    <li className="flex gap-3" key={`${alert.title}-${index}`}>
                      <span className="material-symbols-outlined mt-0.5 text-[18px]">{alert.tone === "warning" ? "warning" : "info"}</span>
                      <div>
                        <p className="font-bold">{alert.title}</p>
                        <p className="mt-1 text-sm leading-6">{alert.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </WarningPanel>
            ) : null}

            <section className="overflow-hidden rounded-[calc(var(--kr-gov-radius)+6px)] border border-slate-200 bg-[linear-gradient(135deg,#0f172a,#10233f_46%,#12315a)] text-white shadow-[0_16px_40px_rgba(15,23,42,0.2)]">
              <div className="p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65">{en ? "Verified Report" : "검증 리포트"}</p>
                <p className="mt-3 text-5xl font-black tracking-[-0.06em]">{report.summary.dataConfidence}%</p>
                <p className="mt-1 text-sm text-white/70">{en ? "Precision Score" : "정밀도 점수"}</p>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#22c55e)]" style={{ width: `${Math.max(0, Math.min(report.summary.dataConfidence, 100))}%` }} />
                </div>
                <div className="mt-6 border-t border-white/10 pt-4 text-xs font-bold uppercase tracking-[0.14em] text-white/70">
                  ISO-14064-1 Compliant Style Report
                </div>
              </div>
            </section>
          </div>
        </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

function FragmentSectionRows({ group, en }: { group: { sectionLabel: string; rows: EmissionSurveyReportRow[] }; en: boolean }) {
  return (
    <>
      <tr className="bg-blue-50/60">
        <td className="px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--kr-gov-blue)]" colSpan={6}>
          {group.sectionLabel}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr className="border-b border-slate-100 align-top" key={row.rowId}>
          <td className="px-4 py-4">
            <div className="font-bold text-[var(--kr-gov-text-primary)]">{row.materialName || "-"}</div>
            <div className="mt-1 text-xs text-slate-500">{row.group || row.sectionLabel}</div>
          </td>
          <td className="px-4 py-4 text-sm text-[var(--kr-gov-text-primary)]">
            <div>{row.amountText || "-"}</div>
            {row.originalAmount > 0 && row.originalAmountText && row.originalAmountText !== row.amountText ? (
              <div className="mt-1 text-[11px] text-slate-500">
                {en ? "original" : "원본"} {row.originalAmountText}
              </div>
            ) : null}
          </td>
          <td className="px-4 py-4 text-sm text-slate-500">{row.unit || "-"}</td>
          <td className="px-4 py-4 text-sm text-[var(--kr-gov-text-primary)]">{row.emissionFactorText || "-"}</td>
          <td className="px-4 py-4 text-sm font-black text-[var(--kr-gov-text-primary)]">{row.calculated ? formatNumber(row.totalEmission) : "-"}</td>
          <td className="px-4 py-4">
            <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${row.warning ? "bg-rose-100 text-rose-700" : row.sourceMode === "직접입력" || row.sourceMode === "Manual" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
              {row.warning || row.sourceMode || (en ? "Verified" : "검증 완료")}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}
