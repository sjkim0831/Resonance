import { ChartData } from "./EmissionProjectListTypes";
import { CircularProgress, BarChart } from "./EmissionProjectListShared";

interface ChartsSectionProps {
  en: boolean;
  processDistribution: ChartData[];
  scopeData: Array<{
    scope: string;
    scopeLabel: string;
    emissions: string;
    target: string;
    achieved: string;
    color: string;
  }>;
  certificationData: {
    percent: number;
    certified: number;
    inProgress: number;
    isCompliant: boolean;
  };
}

export function EmissionProjectListCharts({ en, processDistribution, scopeData, certificationData }: ChartsSectionProps) {
  return (
    <section className="bg-gradient-to-b from-white to-gray-50 border-y border-gray-200 py-16">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
              <span className="material-symbols-outlined text-[var(--kr-gov-blue)] text-3xl">
                analytics
              </span>
              {en ? "Integrated Emission Monitoring Report" : "종합 배출 모니터링 리포트"}
            </h2>
            <p className="text-[var(--kr-gov-text-secondary)] text-sm">
              {en
                ? "Statistics and target progress across all managed emission sites."
                : "관리 중인 모든 배출지의 통계 및 목표 달성 현황입니다."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 font-bold bg-gray-100 px-3 py-2 rounded-lg">
            <span className="material-symbols-outlined text-[14px]">update</span>
            {en ? "Last update: 2025.08.14 15:45" : "최종 업데이트: 2025.08.14 15:45"}
          </div>
        </div>

        {/* Main Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Annual Progress Chart */}
          <div className="chart-container">
            <h4 className="font-bold text-sm text-gray-600 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[var(--kr-gov-blue)]">
                trending_down
              </span>
              {en ? "Annual accumulation vs target" : "올해 누적 배출량 vs 연간 목표"}
            </h4>
            <AnnualProgressChart en={en} />
          </div>

          {/* Process Distribution Chart */}
          <div className="chart-container">
            <h4 className="font-bold text-sm text-gray-600 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[var(--kr-gov-blue)]">
                pie_chart
              </span>
              {en ? "Site distribution by process" : "프로세스별 배출지 분포"}
            </h4>
            <BarChart data={processDistribution} maxHeight={140} />
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {processDistribution.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-gray-500">
                    {en ? item.labelEn : item.label} ({item.value})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Certification Progress Chart */}
          <div className="chart-container">
            <h4 className="font-bold text-sm text-gray-600 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[var(--kr-gov-blue)]">
                verified
              </span>
              {en ? "Certification & verification performance" : "인증 및 검증 성과"}
            </h4>
            <div className="flex items-center gap-6">
              <CircularProgress
                percent={certificationData.percent}
                size={96}
                strokeWidth={8}
                color="#10b981"
              />
              <div className="flex-1 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{en ? "Certified" : "인증 완료"}</span>
                  <span className="font-bold text-gray-800">{certificationData.certified}건</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{en ? "In Progress" : "진행 중"}</span>
                  <span className="font-bold text-gray-800">{certificationData.inProgress}건</span>
                </div>
                {certificationData.isCompliant && (
                  <div className="mt-4 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    {en ? "Quality standard compliant" : "품질 표준 준수 중"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scope Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {scopeData.map((scope) => (
            <ScopeCard key={scope.scope} scope={scope} en={en} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface AnnualProgressChartProps {
  en: boolean;
}

function AnnualProgressChart({ en }: AnnualProgressChartProps) {
  const currentValue = 45120;
  const targetValue = 60000;
  const percent = Math.round((currentValue / targetValue) * 100);
  const remaining = targetValue - currentValue;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-4xl font-black text-[var(--kr-gov-blue)] tracking-tight">45,120</span>
        <span className="text-sm font-bold text-gray-400">tCO₂</span>
        <span className="ml-auto text-sm font-bold text-emerald-600 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">trending_down</span>
          {en ? "▼ 4.2% YoY" : "▼ 4.2% (전년동기)"}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-[12px] font-bold">
          <span className="text-gray-500">
            {en ? "Annual target (60,000 tCO₂)" : "연간 허용 목표 (60,000 tCO₂)"}
          </span>
          <span className="text-[var(--kr-gov-blue)]">{percent}%</span>
        </div>

        {/* Progress Bar with Gradient */}
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all relative"
            style={{ width: `${percent}%` }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "linear-gradient(90deg, #00378b 0%, #3b82f6 100%)"
              }}
            />
          </div>
        </div>

        <div className="flex justify-between text-[11px] text-gray-400">
          <span>{en ? "45,120 tCO₂ used" : "45,120 tCO₂ 사용"}</span>
          <span>
            {en
              ? `${remaining.toLocaleString()} tCO₂ remaining`
              : `${remaining.toLocaleString()} tCO₂ 남음`}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ScopeCardProps {
  scope: {
    scope: string;
    scopeLabel: string;
    emissions: string;
    target: string;
    achieved: string;
    color: string;
  };
  en: boolean;
}

function ScopeCard({ scope, en }: ScopeCardProps) {
  const scopeLabels: Record<string, { name: string; nameEn: string; desc: string; descEn: string }> = {
    scope1: {
      name: "Scope 1",
      nameEn: "Scope 1",
      desc: "직접 배출원",
      descEn: "Direct emissions"
    },
    scope2: {
      name: "Scope 2",
      nameEn: "Scope 2",
      desc: "간접 배출원 (에너지)",
      descEn: "Indirect (Energy)"
    },
    scope3: {
      name: "Scope 3",
      nameEn: "Scope 3",
      desc: "기타 간접 배출원",
      descEn: "Other indirect"
    }
  };

  const info = scopeLabels[scope.scope];

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: scope.color }}
          />
          <div>
            <div className="font-bold text-gray-900">{en ? info.nameEn : info.name}</div>
            <div className="text-xs text-gray-500">{en ? info.descEn : info.desc}</div>
          </div>
        </div>
        <span
          className="px-2 py-1 rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: scope.color }}
        >
          {scope.achieved}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">{en ? "Current" : "현재 배출"}</span>
          <span className="font-bold text-gray-900">{scope.emissions} tCO₂</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">{en ? "Target" : "목표"}</span>
          <span className="font-bold text-gray-700">{scope.target} tCO₂</span>
        </div>
      </div>

      {/* Mini Progress Bar */}
      <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: scope.achieved,
            backgroundColor: scope.color
          }}
        />
      </div>
    </div>
  );
}