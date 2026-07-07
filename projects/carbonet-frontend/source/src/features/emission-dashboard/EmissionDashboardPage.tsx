import { useEffect, useMemo, useState, useCallback } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AIChatPanel, AIInsightCard } from "../emission-common/AIChatPanel";
import { analyzeEmissionSite, getDataQualityAnalysis } from "../../lib/ai/useAIStream";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HeaderMobileMenu
} from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";

type ScopeData = {
  scope: string;
  scopeLabel: string;
  scopeLabelEn: string;
  emissions: string;
  target: string;
  achieved: string;
  color: string;
  bgColor: string;
};

type SiteEmissionSummary = {
  siteId: string;
  siteName: string;
  status: string;
  statusClass: string;
  currentEmission: string;
  monthlyTarget: string;
 YoYChange: string;
  dataCompleteness: string;
  lastUpdated: string;
  sparklineData: string;
  scope1Emission: string;
  scope2Emission: string;
  scope3Emission: string;
};

type ReductionTarget = {
  year: number;
  targetReduction: string;
  actualReduction: string;
  achievedPercent: number;
  status: string;
  statusClass: string;
};

type EmissionTrend = {
  month: string;
  actual: number;
  target: number;
  scope1: number;
  scope2: number;
  scope3: number;
};

type DataQualityItem = {
  category: string;
  status: string;
  statusClass: string;
  completeness: string;
  lastVerified: string;
};

type QuickAction = {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  href: string;
  color: string;
};

function handleGovSymbolError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function EmissionDashboardInlineStyles() {
  return (
    <style>{`
      :root {
        --kr-gov-blue: #00378b;
        --kr-gov-blue-hover: #002d72;
        --kr-gov-text-primary: #1a1a1a;
        --kr-gov-text-secondary: #4d4d4d;
        --kr-gov-border-light: #d9d9d9;
        --kr-gov-focus: #005fde;
        --kr-gov-bg-gray: #f2f2f2;
        --kr-gov-radius: 5px;
        --scope1-color: #ef4444;
        --scope2-color: #f97316;
        --scope3-color: #eab308;
        --total-color: #00378b;
      }
      body {
        font-family: 'Noto Sans KR', 'Public Sans', sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        background: var(--kr-gov-blue);
        color: white;
        padding: 12px;
        z-index: 100;
        transition: top .2s ease;
      }
      .skip-link:focus { top: 0; }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
      }
      .scope-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 700;
      }
      .metric-card {
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid var(--kr-gov-border-light);
        transition: all .2s ease;
      }
      .metric-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
      .progress-bar {
        height: 8px;
        border-radius: 9999px;
        background: #e5e7eb;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        border-radius: 9999px;
        transition: width 0.5s ease;
      }
      .site-card {
        background: white;
        border-radius: 12px;
        border: 1px solid var(--kr-gov-border-light);
        overflow: hidden;
        transition: all .2s ease;
      }
      .site-card:hover {
        border-color: var(--kr-gov-focus);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
      .trend-chart-bar {
        width: 100%;
        display: flex;
        align-items: flex-end;
        gap: 4px;
        height: 120px;
      }
      .trend-bar-group {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      .trend-bar-actual {
        width: 100%;
        border-radius: 4px 4px 0 0;
      }
      .trend-bar-target {
        width: 60%;
        border-radius: 2px;
        background: rgba(0, 55, 139, 0.2);
      }
      .action-card {
        background: white;
        border-radius: 12px;
        padding: 1rem;
        border: 1px solid var(--kr-gov-border-light);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        cursor: pointer;
        transition: all .2s ease;
      }
      .action-card:hover {
        border-color: var(--kr-gov-focus);
        background: #f8fafc;
        transform: translateY(-2px);
      }
      .status-badge-critical {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      .status-badge-warning {
        background: #fffbeb;
        color: #d97706;
        border: 1px solid #fde68a;
      }
      .status-badge-success {
        background: #f0fdf4;
        color: #16a34a;
        border: 1px solid #bbf7d0;
      }
      .status-badge-normal {
        background: #eff6ff;
        color: #2563eb;
        border: 1px solid #bfdbfe;
      }
      .sparkline {
        width: 100%;
        height: 40px;
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
    `}</style>
  );
}

export function EmissionDashboardPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiInsights, setAiInsights] = useState<Array<{
    id: string;
    type: "analysis" | "forecast" | "recommendation" | "alert";
    title: string;
    titleEn: string;
    content: string;
    confidence?: number;
  }>>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
    }
  );

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [payloadState, session]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const homeMenu = payload.homeMenu || [];

  const scopeData = useMemo<ScopeData[]>(() => [
    { scope: "scope1", scopeLabel: "Scope 1", scopeLabelEn: "Scope 1", emissions: "12,450", target: "13,000", achieved: "95.8%", color: "#ef4444", bgColor: "bg-red-50" },
    { scope: "scope2", scopeLabel: "Scope 2", scopeLabelEn: "Scope 2", emissions: "18,230", target: "20,000", achieved: "91.2%", color: "#f97316", bgColor: "bg-orange-50" },
    { scope: "scope3", scopeLabel: "Scope 3", scopeLabelEn: "Scope 3", emissions: "8,120", target: "10,000", achieved: "81.2%", color: "#eab308", bgColor: "bg-yellow-50" }
  ], []);

  const totalEmissions = useMemo(() => {
    const total = scopeData.reduce((sum, s) => sum + parseInt(s.emissions.replace(/,/g, ''), 10), 0);
    return total.toLocaleString();
  }, [scopeData]);

  const totalTarget = useMemo(() => {
    const total = scopeData.reduce((sum, s) => sum + parseInt(s.target.replace(/,/g, ''), 10), 0);
    return total.toLocaleString();
  }, [scopeData]);

  const overallAchievement = useMemo(() => {
    const actual = scopeData.reduce((sum, s) => sum + parseInt(s.emissions.replace(/,/g, ''), 10), 0);
    const target = scopeData.reduce((sum, s) => sum + parseInt(s.target.replace(/,/g, ''), 10), 0);
    return ((target / actual) * 100).toFixed(1);
  }, [scopeData]);

  const siteEmissions = useMemo<SiteEmissionSummary[]>(() => [
    { siteId: "PH-001", siteName: en ? "Pohang Hot Rolling Mill 1" : "포항 제1 열연공장", status: en ? "Normal" : "정상", statusClass: "status-badge-success", currentEmission: "2,341", monthlyTarget: "2,500", YoYChange: "-4.2%", dataCompleteness: "100%", lastUpdated: "2h ago", sparklineData: "M0 30 L15 25 L30 28 L45 20 L60 22 L75 15 L90 12 L100 8", scope1Emission: "890", scope2Emission: "1,200", scope3Emission: "251" },
    { siteId: "US-042", siteName: en ? "Ulsan Chemical Base 3" : "울산 제3 화학기지", status: en ? "Input Delayed" : "입력 지연", statusClass: "status-badge-warning", currentEmission: "4,812", monthlyTarget: "5,000", YoYChange: "+1.8%", dataCompleteness: "65%", lastUpdated: "1d ago", sparklineData: "M0 10 L15 15 L30 12 L45 20 L60 18 L75 25 L90 22 L100 28", scope1Emission: "2,800", scope2Emission: "1,500", scope3Emission: "512" },
    { siteId: "GN-112", siteName: en ? "Gwangyang Energy Center 2" : "광양 제2 에너지센터", status: en ? "Verified" : "검증 완료", statusClass: "status-badge-normal", currentEmission: "12,890", monthlyTarget: "13,000", YoYChange: "-8.5%", dataCompleteness: "100%", lastUpdated: "3h ago", sparklineData: "M0 35 L15 32 L30 30 L45 28 L60 25 L75 22 L90 20 L100 18", scope1Emission: "8,500", scope2Emission: "3,800", scope3Emission: "590" },
    { siteId: "IC-005", siteName: en ? "Incheon Logistics Center" : "인천 물류센터", status: en ? "Normal" : "정상", statusClass: "status-badge-success", currentEmission: "452", monthlyTarget: "500", YoYChange: "-2.1%", dataCompleteness: "100%", lastUpdated: "30m ago", sparklineData: "M0 25 L20 22 L40 20 L60 18 L80 15 L100 12", scope1Emission: "280", scope2Emission: "120", scope3Emission: "52" },
    { siteId: "DJ-021", siteName: en ? "Daejeon R&D Campus" : "대전 R&D 캠퍼스", status: en ? "Pending" : "대기", statusClass: "status-badge-critical", currentEmission: "210", monthlyTarget: "250", YoYChange: "+5.2%", dataCompleteness: "40%", lastUpdated: "2d ago", sparklineData: "M0 8 L25 10 L50 12 L75 15 L100 18", scope1Emission: "80", scope2Emission: "100", scope3Emission: "30" }
  ], [en]);

  const reductionTargets = useMemo<ReductionTarget[]>(() => [
    { year: 2024, targetReduction: "15%", actualReduction: "18.2%", achievedPercent: 121, status: en ? "Exceeded" : "초과 달성", statusClass: "status-badge-success" },
    { year: 2025, targetReduction: "20%", actualReduction: "12.5%", achievedPercent: 62, status: en ? "In Progress" : "진행중", statusClass: "status-badge-normal" },
    { year: 2026, targetReduction: "30%", actualReduction: "4.2%", achievedPercent: 14, status: en ? "Planning" : "계획중", statusClass: "status-badge-warning" }
  ], [en]);

  const emissionTrends = useMemo<EmissionTrend[]>(() => [
    { month: en ? "Feb" : "2월", actual: 4200, target: 4500, scope1: 1500, scope2: 1800, scope3: 900 },
    { month: en ? "Mar" : "3월", actual: 4100, target: 4400, scope1: 1450, scope2: 1750, scope3: 900 },
    { month: en ? "Apr" : "4월", actual: 3950, target: 4300, scope1: 1380, scope2: 1680, scope3: 890 },
    { month: en ? "May" : "5월", actual: 3800, target: 4200, scope1: 1300, scope2: 1620, scope3: 880 },
    { month: en ? "Jun" : "6월", actual: 3650, target: 4100, scope1: 1250, scope2: 1550, scope3: 850 },
    { month: en ? "Jul" : "7월", actual: 3850, target: 4000, scope1: 1320, scope2: 1600, scope3: 930 }
  ], [en]);

  const dataQuality = useMemo<DataQualityItem[]>(() => [
    { category: en ? "Energy Data" : "에너지 데이터", status: en ? "Complete" : "완료", statusClass: "status-badge-success", completeness: "98%", lastVerified: "2024-07-14" },
    { category: en ? "Fuel Consumption" : "연료 소비", status: en ? "Complete" : "완료", statusClass: "status-badge-success", completeness: "95%", lastVerified: "2024-07-13" },
    { category: en ? "Refrigerant Leakage" : "냉매 누출", status: en ? "Pending" : "대기", statusClass: "status-badge-warning", completeness: "72%", lastVerified: "2024-07-10" },
    { category: en ? "Waste Management" : "폐기물 관리", status: en ? "In Review" : "검토중", statusClass: "status-badge-normal", completeness: "85%", lastVerified: "2024-07-12" },
    { category: en ? "Business Travel" : "출장 교통", status: en ? "Complete" : "완료", statusClass: "status-badge-success", completeness: "100%", lastVerified: "2024-07-14" }
  ], [en]);

  const quickActions = useMemo<QuickAction[]>(() => [
    { id: "data-input", label: "데이터 입력", labelEn: "Data Input", icon: "edit_square", href: "/emission/data_input", color: "#00378b" },
    { id: "calculate", label: "산정 로직", labelEn: "Calculate", icon: "calculate", href: "/emission/management", color: "#16a34a" },
    { id: "report", label: "보고서 생성", labelEn: "Generate Report", icon: "description", href: "/admin/emission/survey-report", color: "#d97706" },
    { id: "validate", label: "검증 진행", labelEn: "Validate", icon: "fact_check", href: "/emission/validate", color: "#7c3aed" },
    { id: "ecoinvent", label: "계수 관리", labelEn: "Factor Mgmt", icon: "inventory_2", href: "/admin/emission/ecoinvent", color: "#0891b2" },
    { id: "site-mgmt", label: "현장 관리", labelEn: "Site Mgmt", icon: "location_on", href: "/admin/emission/site-management", color: "#64748b" }
  ], []);

  const maxTrendValue = useMemo(() => Math.max(...emissionTrends.map(t => Math.max(t.actual, t.target))), []);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-dashboard", {
      language: en ? "en" : "ko",
      mobileMenuOpen,
      menuCount: homeMenu.length,
      isLoggedIn: Boolean(payload.isLoggedIn),
      scopeCount: scopeData.length,
      siteCount: siteEmissions.length
    });
  }, [en, mobileMenuOpen, homeMenu.length, payload.isLoggedIn, scopeData.length, siteEmissions.length]);

  const navigateTo = (path: string) => {
    navigate(path);
  };

  const loadAIInsights = useCallback(async () => {
    setIsLoadingInsights(true);
    const insights = [];

    // Analyze top emission site
    if (siteEmissions.length > 0) {
      const topSite = siteEmissions[0];
      try {
        const analysis = await analyzeEmissionSite({
          siteId: topSite.siteId,
          siteName: topSite.siteName,
          currentEmission: topSite.currentEmission,
          targetEmission: topSite.monthlyTarget,
          status: topSite.status,
          dataCompleteness: topSite.dataCompleteness,
        }, en);

        insights.push({
          id: "site-analysis-1",
          type: "analysis" as const,
          title: en ? `Analysis: ${topSite.siteId}` : `분석: ${topSite.siteId}`,
          titleEn: `Analysis: ${topSite.siteName}`,
          content: analysis.substring(0, 200) + (analysis.length > 200 ? "..." : ""),
          confidence: 0.85,
        });
      } catch (e) {
        console.error("AI analysis failed:", e);
      }
    }

    // Data quality analysis
    try {
      const avgCompleteness = dataQuality.reduce((sum, d) => sum + parseInt(d.completeness), 0) / dataQuality.length;
      const qualityAnalysis = await getDataQualityAnalysis(
        `${avgCompleteness}%`,
        new Date().toISOString().split("T")[0],
        "reviewed",
        en
      );

      if (avgCompleteness < 90) {
        insights.push({
          id: "quality-alert",
          type: "alert" as const,
          title: en ? "Data Quality Warning" : "데이터 품질 경고",
          titleEn: "Data Quality Warning",
          content: en
            ? `Average data completeness is ${avgCompleteness.toFixed(0)}%. Some categories require attention.`
            : `평균 데이터 완전성이 ${avgCompleteness.toFixed(0)}%입니다. 일부 카테고리에 주의가 필요합니다.`,
          confidence: 0.9,
        });
      }

      insights.push({
        id: "quality-recommendation",
        type: "recommendation" as const,
        title: en ? "Quality Improvement" : "품질 개선 권장",
        titleEn: "Quality Improvement",
        content: qualityAnalysis.recommendations.substring(0, 200),
        confidence: 0.78,
      });
    } catch (e) {
      console.error("Quality analysis failed:", e);
    }

    // Add forecast insight
    insights.push({
      id: "forecast-1",
      type: "forecast" as const,
      title: en ? "Emission Forecast" : "배출량 예측",
      titleEn: "Emission Forecast",
      content: en
        ? "Based on current trends, emissions are expected to decrease by 3-5% next month. Continue monitoring for accurate prediction."
        : "현재 트렌드 기반으로 다음 달 배출량이 3-5% 감소할 것으로 예상됩니다. 정확한 예측을 위해 모니터링을 계속하세요.",
      confidence: 0.72,
    });

    setAiInsights(insights);
    setIsLoadingInsights(false);
  }, [en, siteEmissions, dataQuality]);

  useEffect(() => {
    loadAIInsights();
  }, [loadAIInsights]);

  return (
    <>
      <EmissionDashboardInlineStyles />
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={en ? "Government symbol" : "대한민국 정부 상징"} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Official Government Service | Carbon Management System" : "대한민국 정부 공식 서비스 | 탄소 배출량 관리 시스템"}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              <p>{en ? "Last update: just now" : "마지막 업데이트: 방금 전"}</p>
            </div>
          </div>
        </div>

        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="relative flex items-center h-24">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={content} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                {/* AI Chat Button */}
                <button
                  type="button"
                  className="hidden xl:inline-flex px-4 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 items-center gap-2 shadow-lg shadow-indigo-500/30"
                  onClick={() => setAiChatOpen(true)}
                >
                  <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                  {en ? "AI Assistant" : "AI 어시스턴트"}
                </button>
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate("/home")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate("/en/home")}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)]" onClick={() => void session.logout()}>{content.logout}</button>
                ) : (
                  <>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] items-center" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-white text-[var(--kr-gov-blue)] border border-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-bg-gray)] items-center" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
                  </>
                )}
                <button
                  id="mobile-menu-toggle"
                  className="xl:hidden w-11 h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] flex items-center justify-center hover:bg-[var(--kr-gov-bg-gray)] focus-visible"
                  type="button"
                  aria-controls="mobile-menu"
                  aria-expanded={mobileMenuOpen}
                  aria-label={content.openAllMenu}
                  onClick={() => setMobileMenuOpen((current) => !current)}
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div id="mobile-menu" className={`${mobileMenuOpen ? "" : "hidden"} xl:hidden fixed inset-0 z-[70]`} aria-hidden={!mobileMenuOpen}>
          <button type="button" id="mobile-menu-backdrop" className="absolute inset-0 bg-black/50" aria-label={content.closeAllMenu} onClick={() => setMobileMenuOpen(false)} />
          <HeaderMobileMenu
            content={content}
            en={en}
            homeMenu={homeMenu}
            isLoggedIn={Boolean(payload.isLoggedIn)}
            onClose={() => setMobileMenuOpen(false)}
            onLogout={session.logout}
          />
        </div>

        <main id="main-content">
          <section className="bg-gradient-to-r from-[#00378b] to-[#004a9c] py-10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg height="100%" width="100%">
                <pattern height="60" id="dots" patternUnits="userSpaceOnUse" width="60">
                  <circle cx="2" cy="2" fill="white" r="1" />
                </pattern>
                <rect fill="url(#dots)" height="100%" width="100%" />
              </svg>
            </div>
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <span className="material-symbols-outlined text-white text-[32px]">eco</span>
                    </div>
                    <div>
                      <h1 className="text-3xl font-black text-white">{en ? "Carbon Emission Dashboard" : "탄소 배출량 관리 대시보드"}</h1>
                      <p className="text-blue-200 text-sm font-medium flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        {en ? "Real-time monitoring • " : "실시간 모니터링 • "} {new Date().toLocaleDateString(en ? 'en-US' : 'ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/30 rounded-xl text-white font-bold transition-all flex items-center gap-2"
                    onClick={() => navigateTo("/emission/data_input")}
                  >
                    <span className="material-symbols-outlined">add</span>
                    {en ? "New Input" : "신규 입력"}
                  </button>
                  <button
                    type="button"
                    className="px-6 py-3 bg-white text-[#00378b] hover:bg-blue-50 rounded-xl font-bold transition-all flex items-center gap-2"
                    onClick={() => navigateTo("/emission/project_list")}
                  >
                    <span className="material-symbols-outlined">list</span>
                    {en ? "Project List" : "프로젝트 목록"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 -mt-6 relative z-20">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
              <div className="metric-card shadow-lg border-t-4 border-t-[#00378b]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-500">{en ? "Total Emissions" : "총 배출량"}</span>
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-[var(--kr-gov-blue)]">{totalEmissions}</span>
                  <span className="text-sm font-bold text-gray-400">tCO2</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-bold text-green-600">↓ 4.2%</span>
                  <span className="text-xs text-gray-400">{en ? "vs last year" : "전년 대비"}</span>
                </div>
              </div>

              <div className="metric-card shadow-lg border-t-4 border-t-green-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-500">{en ? "Annual Target" : "연간 목표"}</span>
                  <span className="material-symbols-outlined text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-green-600">{totalTarget}</span>
                  <span className="text-sm font-bold text-gray-400">tCO2</span>
                </div>
                <div className="mt-2">
                  <div className="progress-bar">
                    <div className="progress-bar-fill bg-green-500" style={{ width: `${overallAchievement}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 mt-1">{overallAchievement}% {en ? "achieved" : "달성"}</span>
                </div>
              </div>

              <div className="metric-card shadow-lg border-t-4 border-t-orange-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-500">{en ? "Data Completeness" : "데이터 완전성"}</span>
                  <span className="material-symbols-outlined text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>checklist</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-orange-600">87%</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-bold text-orange-600">3 {en ? "sites need input" : "개 현장 입력 필요"}</span>
                </div>
              </div>

              <div className="metric-card shadow-lg border-t-4 border-t-purple-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-500">{en ? "Active Sites" : "운영 현장"}</span>
                  <span className="material-symbols-outlined text-purple-600" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-purple-600">{siteEmissions.length}</span>
                  <span className="text-sm font-bold text-gray-400">{en ? "sites" : "개소"}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-bold text-green-600">4</span>
                  <span className="text-xs text-gray-400">{en ? "normal" : "정상"},</span>
                  <span className="text-sm font-bold text-orange-600">1</span>
                  <span className="text-xs text-gray-400">{en ? "delayed" : "지연"}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
                {en ? "Emissions by Scope" : "범위별 배출량 (Scope 1/2/3)"}
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {scopeData.map((scope) => (
                <div key={scope.scope} className={`${scope.bgColor} rounded-xl p-6 border border-gray-200`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">{en ? scope.scopeLabelEn : scope.scopeLabel}</h3>
                    <span className="scope-badge" style={{ background: scope.color, color: 'white' }}>{scope.achieved}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-black" style={{ color: scope.color }}>{scope.emissions}</span>
                    <span className="text-sm font-bold text-gray-500">tCO2</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{en ? "Target" : "목표"}</span>
                      <span className="font-bold">{scope.target} tCO2</span>
                    </div>
                    <div className="progress-bar h-3">
                      <div className="progress-bar-fill" style={{ width: scope.achieved, background: scope.color }} />
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-500">{en ? "vs Last Year" : "전년 대비"}</p>
                        <p className="text-lg font-black text-green-600">-{((Math.random() * 5 + 2)).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{en ? "MoM Change" : "전월 대비"}</p>
                        <p className="text-lg font-black text-green-600">-1.2%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 bg-white border-t border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                {en ? "Emission Trend (Monthly)" : "월별 배출 추이"}
              </h2>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-[var(--kr-gov-blue)]" />
                  <span className="font-medium text-gray-600">{en ? "Actual" : "실제 배출"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-200" />
                  <span className="font-medium text-gray-600">{en ? "Target" : "목표"}</span>
                </div>
              </div>
            </div>
            <div className="trend-chart-bar">
              {emissionTrends.map((trend, idx) => (
                <div key={idx} className="trend-bar-group">
                  <div className="w-full flex flex-col items-center gap-1">
                    <div
                      className="trend-bar-actual bg-[#00378b]"
                      style={{ height: `${(trend.actual / maxTrendValue) * 100}%`, minHeight: '8px' }}
                    />
                    <div
                      className="trend-bar-target"
                      style={{ height: `${(trend.target / maxTrendValue) * 100}%`, minHeight: '4px' }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-500 mt-2">{trend.month}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                {en ? "Site Emissions" : "현장별 배출량"}
              </h2>
              <a className="text-sm font-bold text-[var(--kr-gov-blue)] hover:underline flex items-center gap-1" href="/admin/emission/site-management">
                {en ? "Manage Sites" : "현장 관리"} <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {siteEmissions.map((site) => (
                <div key={site.siteId} className="site-card">
                  <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`scope-badge ${site.statusClass}`}>{site.status}</span>
                      <span className="text-xs font-bold text-gray-400">ID: {site.siteId}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">{site.siteName}</h3>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{en ? "Current Emission" : "현재 배출량"}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-[var(--kr-gov-blue)]">{site.currentEmission}</span>
                          <span className="text-xs font-bold text-gray-400">tCO2</span>
                        </div>
                      </div>
                      <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
                        <path d={site.sparklineData} fill="none" stroke="#00378b" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-2 bg-red-50 rounded-lg">
                        <p className="text-xs text-gray-500">Scope 1</p>
                        <p className="text-sm font-black text-red-600">{site.scope1Emission}</p>
                      </div>
                      <div className="text-center p-2 bg-orange-50 rounded-lg">
                        <p className="text-xs text-gray-500">Scope 2</p>
                        <p className="text-sm font-black text-orange-600">{site.scope2Emission}</p>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded-lg">
                        <p className="text-xs text-gray-500">Scope 3</p>
                        <p className="text-sm font-black text-yellow-600">{site.scope3Emission}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{en ? "Monthly Target" : "월간 목표"}</span>
                        <span className="font-bold">{site.monthlyTarget} tCO2</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{en ? "YoY Change" : "전년 대비"}</span>
                        <span className={`font-bold ${site.YoYChange.startsWith('-') ? 'text-green-600' : 'text-red-600'}`}>{site.YoYChange}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{en ? "Data Completeness" : "데이터 완전성"}</span>
                        <span className={`font-bold ${site.dataCompleteness === '100%' ? 'text-green-600' : 'text-orange-600'}`}>{site.dataCompleteness}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="w-full mt-4 py-2 text-sm font-bold bg-[var(--kr-gov-blue)] text-white rounded-lg hover:bg-[var(--kr-gov-blue-hover)] transition-colors"
                      onClick={() => navigateTo(`/admin/emission/management?siteId=${site.siteId}`)}
                    >
                      {en ? "View Details" : "상세 보기"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 bg-white border-t border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>track_changes</span>
                {en ? "Reduction Targets" : "감축 목표"}</h2>
              <a className="text-sm font-bold text-green-600 hover:underline flex items-center gap-1" href="/emission/reduction">
                {en ? "View All" : "전체 보기"} <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {reductionTargets.map((target) => (
                <div key={target.year} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black text-gray-800">{target.year} {en ? "Target" : "목표"}</h3>
                    <span className={`scope-badge ${target.statusClass}`}>{target.status}</span>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">{en ? "Target Reduction" : "목표 감축"}</span>
                      <span className="font-bold">{target.targetReduction}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{en ? "Actual Reduction" : "실제 감축"}</span>
                      <span className="font-bold text-green-600">{target.actualReduction}</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">{en ? "Achievement" : "달성률"}</span>
                      <span className={`font-black ${target.achievedPercent >= 100 ? 'text-green-600' : target.achievedPercent >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
                        {target.achievedPercent}%
                      </span>
                    </div>
                    <div className="progress-bar h-3">
                      <div
                        className={`progress-bar-fill ${target.achievedPercent >= 100 ? 'bg-green-500' : target.achievedPercent >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(target.achievedPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                {en ? "Quick Actions" : "빠른 작업"}
              </h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {quickActions.map((action) => (
                <a
                  key={action.id}
                  className="action-card"
                  href={buildLocalizedPath(action.href, `/en${action.href}`)}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${action.color}15` }}
                  >
                    <span className="material-symbols-outlined text-2xl" style={{ color: action.color }}>
                      {action.icon}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-700 text-center">{en ? action.labelEn : action.label}</span>
                </a>
              ))}
            </div>
          </section>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 bg-white border-t border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                {en ? "Data Quality Status" : "데이터 품질 현황"}
              </h2>
              <a className="text-sm font-bold text-orange-500 hover:underline flex items-center gap-1" href="/emission/validate">
                {en ? "Validate All" : "전체 검증"} <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-bold text-gray-600">{en ? "Category" : "분류"}</th>
                    <th className="text-center py-3 px-4 font-bold text-gray-600">{en ? "Status" : "상태"}</th>
                    <th className="text-center py-3 px-4 font-bold text-gray-600">{en ? "Completeness" : "완전성"}</th>
                    <th className="text-right py-3 px-4 font-bold text-gray-600">{en ? "Last Verified" : "마지막 검증"}</th>
                  </tr>
                </thead>
                <tbody>
                  {dataQuality.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{item.category}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`scope-badge ${item.statusClass}`}>{item.status}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 progress-bar h-2">
                            <div
                              className="progress-bar-fill bg-orange-500"
                              style={{ width: item.completeness }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-500 w-10 text-right">{item.completeness}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">{item.lastVerified}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        {/* AI Insights Section */}
        <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              {en ? "AI-Powered Insights" : "AI 기반 인사이트"}
              <span className="ml-2 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                {en ? "NVIDIA AI" : "엔비디아 AI"}
              </span>
            </h2>
            <button
              type="button"
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              onClick={() => loadAIInsights()}
              disabled={isLoadingInsights}
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoadingInsights ? "animate-spin" : ""}`}>refresh</span>
              {isLoadingInsights ? (en ? "Loading..." : "로딩 중...") : (en ? "Refresh" : "새로고침")}
            </button>
          </div>
          {isLoadingInsights && aiInsights.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-500">{en ? "Analyzing with AI..." : "AI 분석 중..."}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aiInsights.map((insight) => (
                <AIInsightCard
                  key={insight.id}
                  en={en}
                  type={insight.type}
                  title={en ? insight.titleEn : insight.title}
                  content={insight.content}
                  confidence={insight.confidence}
                  onAction={() => setAiChatOpen(true)}
                />
              ))}
            </div>
          )}
        </section>

        {/* AI Chat Panel Modal */}
        {aiChatOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-4">
            <div className="absolute inset-0 bg-black/30" onClick={() => setAiChatOpen(false)} />
            <div className="relative z-10">
              <AIChatPanel
                en={en}
                siteContext={siteEmissions[0] ? {
                  siteId: siteEmissions[0].siteId,
                  siteName: siteEmissions[0].siteName,
                  currentEmission: siteEmissions[0].currentEmission,
                  targetEmission: siteEmissions[0].monthlyTarget,
                  status: siteEmissions[0].status,
                  dataCompleteness: siteEmissions[0].dataCompleteness,
                } : undefined}
                onClose={() => setAiChatOpen(false)}
              />
            </div>
          </div>
        )}

        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-12 pb-8">
            <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img alt={en ? "Republic of Korea government symbol" : "대한민국 정부 상징"} className="h-8 grayscale opacity-50" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
                  <span className="text-xl font-black text-gray-800 tracking-tight">{en ? "Carbon Management System" : "탄소 배출량 관리 시스템"}</span>
                </div>
                <address className="not-italic text-sm text-gray-500 leading-relaxed">
                  {en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Carbon Management Team: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 탄소 관리팀: 02-1234-5678"}<br />
                  {en ? "This platform is optimized for enterprise carbon emission management." : "본 플랫폼은 기업의 탄소 배출량 관리를 위해 최적화되었습니다."}
                </address>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
                <a className="text-[var(--kr-gov-blue)] hover:underline" href="#">{en ? "Privacy Policy" : "개인정보처리방침"}</a>
                <a className="text-gray-600 hover:underline" href="#">{en ? "Terms of Use" : "이용약관"}</a>
                <a className="text-gray-600 hover:underline" href="#">{en ? "Manual Download" : "매뉴얼 다운로드"}</a>
              </div>
            </div>
            <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-xs font-medium text-gray-400">{en ? "© 2024 Carbon Management System. All rights reserved." : "© 2024 탄소 배출량 관리 시스템. 모든 권리 보유."}</p>
              <div className="flex items-center gap-4">
                <div className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">V 1.0.0</div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}