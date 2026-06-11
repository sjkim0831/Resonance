interface ReportsSectionProps {
  en: boolean;
}

export function EmissionProjectListReports({ en }: ReportsSectionProps) {
  const reportTypes = [
    {
      id: "annual",
      title: en ? "Annual Emission Report" : "연간 배출량 보고서",
      titleEn: "Annual Emission Report",
      description: en
        ? "Comprehensive annual carbon emission summary with scope-wise breakdown and year-over-year analysis."
        : "Scope별 세분화 및 전년 대비 분석이 포함된 연간 탄소 배출량 종합 요약서입니다.",
      icon: "description",
      format: "PDF",
      lastGenerated: "2025-01-15"
    },
    {
      id: "quarterly",
      title: en ? "Quarterly Status Report" : "분기별 현황 보고서",
      titleEn: "Quarterly Status Report",
      description: en
        ? "Quarterly emission performance report with target achievement and compliance status."
        : "목표 달성률 및 규제 준수 현황이 포함된 분기별 배출 실적 보고서입니다.",
      icon: "assessment",
      format: "PDF",
      lastGenerated: "2025-04-10"
    },
    {
      id: "verification",
      title: en ? "Verification Report" : "검증 보고서",
      titleEn: "Verification Report",
      description: en
        ? "Third-party verification results and certification status for managed emission sites."
        : "관리 배출지에 대한 제3자 검증 결과 및 인증 현황입니다.",
      icon: "verified",
      format: "PDF",
      lastGenerated: "2025-03-20"
    },
    {
      id: "lca",
      title: en ? "LCA Analysis Report" : "전과정 평가(LCA) 보고서",
      titleEn: "LCA Analysis Report",
      description: en
        ? "Life Cycle Assessment (LCA) analysis covering Scope 1, 2, and 3 emissions with contribution analysis."
        : "Scope 1, 2, 3 배출량을covering하며 기여도 분석이 포함된 전과정 평가(LCA)입니다.",
      icon: "science",
      format: "XLSX",
      lastGenerated: "2025-05-08"
    },
    {
      id: "reduction",
      title: en ? "Reduction Target Report" : "감축 목표 대비 성과 보고서",
      titleEn: "Reduction Target Report",
      description: en
        ? "Analysis of emission reduction achievements against established targets with future projections."
        : "설정된 감축 목표 대비 배출량 감축 달성 분석 및 향후 전망입니다.",
      icon: "trending_down",
      format: "PDF",
      lastGenerated: "2025-06-01"
    },
    {
      id: "compliance",
      title: en ? "Compliance Status Report" : "규제 준수 현황 보고서",
      titleEn: "Compliance Status Report",
      description: en
        ? "Regulatory compliance status including KEMCO reporting requirements and local regulations."
        : "한국에너지공단 보고 의무 및 지역 규제 등을 포함한 규제 준수 현황입니다.",
      icon: "gavel",
      format: "PDF",
      lastGenerated: "2025-07-15"
    }
  ];

  const quickActions = [
    {
      id: "new-report",
      title: en ? "Generate New Report" : "새 보고서 생성",
      titleEn: "Generate New Report",
      icon: "add_circle",
      description: en ? "Create custom emission report" : "맞춤형 배출 보고서 생성"
    },
    {
      id: "schedule",
      title: en ? "Schedule Reports" : "보고서 예약 설정",
      titleEn: "Schedule Reports",
      icon: "schedule",
      description: en ? "Set up automatic report generation" : "자동 보고서 생성 설정"
    },
    {
      id: "templates",
      title: en ? "Report Templates" : "보고서 템플릿",
      titleEn: "Report Templates",
      icon: "folder_copy",
      description: en ? "Manage saved report templates" : "저장된 보고서 템플릿 관리"
    }
  ];

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)] text-3xl">
              folder_open
            </span>
            {en ? "Reports & Export" : "보고서 및 내보내기"}
          </h2>
          <p className="text-[var(--kr-gov-text-secondary)] text-sm">
            {en
              ? "Generate, download, and manage emission reports in various formats."
              : "다양한 형식으로 배출량 보고서를 생성, 다운로드 및 관리합니다."}
          </p>
        </div>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {reportTypes.map((report) => (
          <ReportCard key={report.id} report={report} en={en} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-[var(--kr-gov-blue)] to-blue-600 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px]">bolt</span>
          {en ? "Quick Actions" : "빠른 작업"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-left transition-all group"
              type="button"
            >
              <span className="material-symbols-outlined text-white text-2xl mb-2 group-hover:scale-110 transition-transform">
                {action.icon}
              </span>
              <div className="font-bold text-white mb-1">{en ? action.titleEn : action.title}</div>
              <div className="text-sm text-white/70">{action.description}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

interface ReportCardProps {
  report: {
    id: string;
    title: string;
    titleEn: string;
    description: string;
    icon: string;
    format: string;
    lastGenerated: string;
  };
  en: boolean;
}

function ReportCard({ report, en }: ReportCardProps) {
  const formatColors: Record<string, string> = {
    PDF: "bg-red-100 text-red-700",
    XLSX: "bg-emerald-100 text-emerald-700",
    CSV: "bg-blue-100 text-blue-700"
  };

  return (
    <div className="export-card group hover:border-[var(--kr-gov-blue)]">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--kr-gov-bg-gray)] flex items-center justify-center group-hover:bg-[var(--kr-gov-blue)] transition-colors">
          <span className="material-symbols-outlined text-[24px] text-gray-500 group-hover:text-white transition-colors">
            {report.icon}
          </span>
        </div>
        <span className={`px-2 py-1 rounded text-[10px] font-bold ${formatColors[report.format]}`}>
          {report.format}
        </span>
      </div>

      <h3 className="font-bold text-gray-900 mb-2 group-hover:text-[var(--kr-gov-blue)] transition-colors">
        {en ? report.titleEn : report.title}
      </h3>

      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        {report.description}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-400">
          <span className="material-symbols-outlined text-[12px] mr-1">schedule</span>
          {en ? "Last generated:" : "최근 생성:"} {report.lastGenerated}
        </div>
        <button
          className="flex items-center gap-1 text-[var(--kr-gov-blue)] text-sm font-bold hover:underline"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          {en ? "Download" : "다운로드"}
        </button>
      </div>
    </div>
  );
}