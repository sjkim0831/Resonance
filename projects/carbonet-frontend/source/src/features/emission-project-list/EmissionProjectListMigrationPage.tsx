import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { HomePayload } from "../home-entry/homeEntryTypes";

import {
  QueueItem,
  DedicatedSite,
  GeneralSite,
  StatCard,
  ChartData,
} from "./components/EmissionProjectListTypes";
import {
  EmissionProjectListStyles,
} from "./components/EmissionProjectListStyles";
import {
  EmissionProjectListHeader,
} from "./components/EmissionProjectListHeader";
import {
  EmissionProjectListHero,
} from "./components/EmissionProjectListHero";
import {
  EmissionProjectListMetrics,
} from "./components/EmissionProjectListMetrics";
import {
  EmissionProjectListSites,
} from "./components/EmissionProjectListSites";
import {
  EmissionProjectListCharts,
} from "./components/EmissionProjectListCharts";
import {
  EmissionProjectListDataTable,
} from "./components/EmissionProjectListDataTable";
import {
  EmissionProjectListReports,
} from "./components/EmissionProjectListReports";
import {
  EmissionProjectListFooter,
} from "./components/EmissionProjectListFooter";

export function EmissionProjectListMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined,
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

  const adminSiteManagementHref = buildLocalizedPath(
    "/admin/emission/site-management",
    "/en/admin/emission/site-management"
  );

  // Queue Items (Task Queue)
  const queueItems = useMemo<QueueItem[]>(() => [
    {
      id: "Q-001",
      level: "CRITICAL",
      levelClass: "bg-red-500/20 text-red-400 border border-red-500/30",
      due: "D-2",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      title: "울산 제3: 보완 서류 제출",
      titleEn: "Ulsan Site 3: Supplement Document",
      description: "공정 배출계수 재산정 로직에 따른 증빙 서류 누락 탐지",
      descriptionEn: "Missing supporting files detected after emission-factor recalculation.",
      cta: "업데이트 시작",
      ctaEn: "Start update",
      icon: "arrow_forward",
      siteId: "US-042",
      siteName: "울산 제3 화학기지",
      siteNameEn: "Ulsan Chemical Base 3",
      actionRequired: true,
      estimatedTime: "30 min",
    },
    {
      id: "Q-002",
      level: "REQUIRED",
      levelClass: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
      due: "D-5",
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      title: "포항 제1: 에너지 데이터",
      titleEn: "Pohang Site 1: Energy Data",
      description: "8월 2주차 전력 사용량 고지서 대조 및 최종 확정 필요",
      descriptionEn: "August week-2 power statement must be reconciled and confirmed.",
      cta: "데이터 입력기",
      ctaEn: "Open data input",
      icon: "open_in_new",
      siteId: "PH-001",
      siteName: "포항 제1 열연공장",
      siteNameEn: "Pohang Hot Rolling Mill 1",
      actionRequired: true,
      estimatedTime: "45 min",
    },
    {
      id: "Q-003",
      level: "VERIFICATION",
      levelClass: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
      due: "D-12",
      dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      title: "광양 제2: 검증 준비",
      titleEn: "Gwangyang Site 2: Verification",
      description: "품질 보증 체크리스트 85% 완료. 마지막 3개 항목 확인",
      descriptionEn: "QA checklist is 85% complete and 3 items remain.",
      cta: "체크리스트 열기",
      ctaEn: "Open checklist",
      icon: "fact_check",
      siteId: "GN-112",
      siteName: "광양 제2 에너지센터",
      siteNameEn: "Gwangyang Energy Center 2",
      actionRequired: false,
      estimatedTime: "20 min",
    },
    {
      id: "Q-004",
      level: "INSIGHT",
      levelClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
      due: "TODAY",
      dueDate: new Date(),
      title: "배출 목표 분석 확인",
      titleEn: "Emission target variance",
      description: "현재 배출 트렌드가 올해 감축 목표 범위를 벗어남",
      descriptionEn: "Current trend is moving outside this year's reduction target range.",
      cta: "분석 리포트",
      ctaEn: "Open analysis report",
      icon: "trending_down",
      siteId: "ALL",
      siteName: "전체 배출지",
      siteNameEn: "All Sites",
      actionRequired: false,
      estimatedTime: "10 min",
    },
  ], []);

  // Dedicated Sites
  const dedicatedSites = useMemo<DedicatedSite[]>(() => [
    {
      id: "PH-001",
      title: "포항 제1 열연공장",
      titleEn: "Pohang Hot Rolling Mill 1",
      status: "normal",
      statusLabel: "정상 운영",
      statusLabelEn: "Normal Operation",
      statusClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      noticeClass: "bg-indigo-50/50 border-b border-indigo-100",
      noticeIcon: "notifications_active",
      notice: "8월 2주차 데이터 대조가 필요합니다.",
      noticeEn: "Week-2 August data reconciliation is required.",
      noticeLink: "지금 바로 실행",
      noticeLinkEn: "Run now",
      valueLabel: "현재 배출량 (Real-time)",
      valueLabelEn: "Current Emission (Real-time)",
      currentEmission: "2,341",
      monthlyTarget: "2,500",
      valueTone: "text-[var(--kr-gov-blue)]",
      sparkline: "M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 5 L80 8 L90 2 L100 4",
      accentClass: "border-t-[var(--kr-gov-blue)]",
      pinClass: "text-[var(--kr-gov-blue)]",
      scope1Emission: "890",
      scope2Emission: "1,200",
      scope3Emission: "251",
      dataCompleteness: "100%",
      lastUpdated: "12 min ago",
      actions: [
        { label: "데이터 입력", labelEn: "Data Input", icon: "edit_square" },
        { label: "산정 로직", labelEn: "Calculation Logic", icon: "calculate" },
      ],
      activity: [
        {
          title: "에너지 데이터 확정 (Admin)",
          titleEn: "Energy data confirmed (Admin)",
          meta: "12분 전 · 데이터 유효성 검증 완료",
          metaEn: "12 min ago · validation completed",
        },
        {
          title: "Tier 3 산정 계수 업데이트",
          titleEn: "Tier 3 factor updated",
          meta: "어제 · 시스템 자동 최적화",
          metaEn: "Yesterday · auto optimization",
        },
      ],
    },
    {
      id: "US-042",
      title: "울산 제3 화학기지",
      titleEn: "Ulsan Chemical Base 3",
      status: "delayed",
      statusLabel: "입력 지연 (65%)",
      statusLabelEn: "Input Delayed (65%)",
      statusClass: "bg-orange-100 text-orange-700 border border-orange-200",
      noticeClass: "bg-red-50 border-b border-red-100",
      noticeIcon: "warning",
      notice: "산정 증빙 서류 2건이 누락되었습니다.",
      noticeEn: "Two supporting documents are missing.",
      noticeLink: "즉시 업로드",
      noticeLinkEn: "Upload now",
      valueLabel: "누적 배출량",
      valueLabelEn: "Accumulated Emission",
      currentEmission: "4,812",
      monthlyTarget: "5,000",
      valueTone: "text-orange-600",
      sparkline: "M0 5 L15 15 L30 10 L45 25 L60 20 L75 28 L90 18 L100 22",
      accentClass: "border-t-orange-500",
      pinClass: "text-orange-500",
      scope1Emission: "2,800",
      scope2Emission: "1,500",
      scope3Emission: "512",
      dataCompleteness: "65%",
      lastUpdated: "3 hours ago",
      actions: [
        { label: "서류 보완하기", labelEn: "Supplement Document", icon: "upload_file", solid: true },
        { label: "이력 확인", labelEn: "History", icon: "history" },
      ],
      activity: [
        {
          title: "검증관(김검증) 보완 요청 알림",
          titleEn: "Reviewer supplement request",
          meta: "3시간 전 · '증빙 자료 부족' 사유",
          metaEn: "3 hours ago · reason: insufficient proof",
        },
        {
          title: "데이터 수정 (이현장)",
          titleEn: "Data correction (Site Admin)",
          meta: "어제 · 고정 연소 섹션 12% 보정",
          metaEn: "Yesterday · 12% combustion section adjustment",
        },
      ],
    },
    {
      id: "GN-112",
      title: "광양 제2 에너지센터",
      titleEn: "Gwangyang Energy Center 2",
      status: "verifying",
      statusLabel: "검증 진행중",
      statusLabelEn: "Verification In Progress",
      statusClass: "bg-blue-100 text-blue-700 border border-blue-200",
      noticeClass: "bg-blue-50/50 border-b border-blue-100",
      noticeIcon: "verified",
      notice: "에너지공단 검증 1단계 통과 완료.",
      noticeEn: "KEA verification phase 1 has passed.",
      noticeLink: "결과서 다운로드",
      noticeLinkEn: "Download result",
      valueLabel: "연간 누적치",
      valueLabelEn: "Annual Accumulation",
      currentEmission: "12,890",
      monthlyTarget: "13,000",
      valueTone: "text-blue-700",
      sparkline: "M0 28 L20 25 L40 22 L60 20 L80 18 L100 15",
      accentClass: "border-t-blue-500",
      pinClass: "text-blue-500",
      scope1Emission: "8,500",
      scope2Emission: "3,800",
      scope3Emission: "590",
      dataCompleteness: "100%",
      lastUpdated: "2 days ago",
      actions: [
        { label: "검증 현황", labelEn: "Verification Status", icon: "fact_check" },
        { label: "보고서 출력", labelEn: "Report Export", icon: "description" },
      ],
      activity: [
        {
          title: "한국에너지공단 심사 개시",
          titleEn: "External verification started",
          meta: "2일 전 · 외부 검증 절차 착수",
          metaEn: "2 days ago · KEMCO audit launched",
        },
        {
          title: "보고서 최종 승인 완료",
          titleEn: "Report final approval",
          meta: "2025.08.10 · 현장 감독관 확정",
          metaEn: "2025.08.10 · site overseer confirmed",
        },
      ],
    },
  ], []);

  // General Sites
  const generalSites = useMemo<GeneralSite[]>(() => [
    {
      id: "IC-005",
      title: "인천 물류센터",
      titleEn: "Incheon Logistics Center",
      emission: "452 tCO₂",
      targetEmission: "500 tCO₂",
      status: "normal",
      statusLabel: "정상",
      statusLabelEn: "Normal",
      statusClass: "text-emerald-600",
      statusBgClass: "bg-emerald-50 text-emerald-700",
      action: "데이터 상세",
      actionEn: "View Details",
      actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300",
      dataCompleteness: "100%",
      lastInputDate: "2025-08-14",
      verifier: "검증완료",
      verifierEn: "Verified",
    },
    {
      id: "DJ-021",
      title: "대전 R&D 캠퍼스",
      titleEn: "Daejeon R&D Campus",
      emission: "210 tCO₂",
      targetEmission: "250 tCO₂",
      status: "delayed",
      statusLabel: "입력대기",
      statusLabelEn: "Input Pending",
      statusClass: "text-orange-600",
      statusBgClass: "bg-orange-50 text-orange-700",
      action: "입력 개시",
      actionEn: "Start Input",
      actionClass: "border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300",
      dataCompleteness: "40%",
      lastInputDate: "2025-08-10",
      verifier: "검증중",
      verifierEn: "Verifying",
    },
    {
      id: "PJ-088",
      title: "파주 전산센터",
      titleEn: "Paju Data Center",
      emission: "890 tCO₂",
      targetEmission: "900 tCO₂",
      status: "normal",
      statusLabel: "정상",
      statusLabelEn: "Normal",
      statusClass: "text-emerald-600",
      statusBgClass: "bg-emerald-50 text-emerald-700",
      action: "데이터 상세",
      actionEn: "View Details",
      actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300",
      dataCompleteness: "100%",
      lastInputDate: "2025-08-14",
      verifier: "검증완료",
      verifierEn: "Verified",
    },
    {
      id: "AS-033",
      title: "안산 제조공장",
      titleEn: "Ansan Manufacturing Plant",
      emission: "1,560 tCO₂",
      targetEmission: "1,600 tCO₂",
      status: "normal",
      statusLabel: "정상",
      statusLabelEn: "Normal",
      statusClass: "text-emerald-600",
      statusBgClass: "bg-emerald-50 text-emerald-700",
      action: "데이터 상세",
      actionEn: "View Details",
      actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300",
      dataCompleteness: "95%",
      lastInputDate: "2025-08-14",
      verifier: "검증완료",
      verifierEn: "Verified",
    },
    {
      id: "BS-055",
      title: "부산 해상 물류",
      titleEn: "Busan Marine Logistics",
      emission: "678 tCO₂",
      targetEmission: "700 tCO₂",
      status: "delayed",
      statusLabel: "입력대기",
      statusLabelEn: "Input Pending",
      statusClass: "text-orange-600",
      statusBgClass: "bg-orange-50 text-orange-700",
      action: "입력 개시",
      actionEn: "Start Input",
      actionClass: "border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300",
      dataCompleteness: "72%",
      lastInputDate: "2025-08-13",
      verifier: "검증중",
      verifierEn: "Verifying",
    },
    {
      id: "GW-077",
      title: "광주 제조공장",
      titleEn: "Gwangju Manufacturing Plant",
      emission: "923 tCO₂",
      targetEmission: "1,000 tCO₂",
      status: "normal",
      statusLabel: "정상",
      statusLabelEn: "Normal",
      statusClass: "text-emerald-600",
      statusBgClass: "bg-emerald-50 text-emerald-700",
      action: "데이터 상세",
      actionEn: "View Details",
      actionClass: "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300",
      dataCompleteness: "88%",
      lastInputDate: "2025-08-14",
      verifier: "검증완료",
      verifierEn: "Verified",
    },
  ], []);

  // Stat Cards
  const statCards = useMemo<StatCard[]>(() => [
    {
      id: "annual-accumulation",
      title: "올해 누적 배출량",
      titleEn: "Annual Accumulation",
      value: "45,120",
      unit: "tCO₂",
      trend: "▼ 4.2%",
      trendDirection: "down",
      trendEn: "▼ 4.2% YoY",
      icon: "science",
      colorClass: "border-l-4 border-l-[var(--kr-gov-blue)]",
    },
    {
      id: "annual-target",
      title: "연간 목표",
      titleEn: "Annual Target",
      value: "60,000",
      unit: "tCO₂",
      icon: "flag",
      colorClass: "border-l-4 border-l-emerald-500",
    },
    {
      id: "achievement-rate",
      title: "달성률",
      titleEn: "Achievement Rate",
      value: "75.2",
      unit: "%",
      trend: "▲ 2.1%",
      trendDirection: "up",
      trendEn: "▲ 2.1% vs last month",
      icon: "workspace_premium",
      colorClass: "border-l-4 border-l-orange-500",
    },
  ], []);

  // Process Distribution Chart Data
  const processDistribution = useMemo<ChartData[]>(() => [
    { label: "산정완료", labelEn: "Calculated", value: 12, color: "#22c55e", heightPercent: 100 },
    { label: "입력중", labelEn: "Input", value: 5, color: "#f97316", heightPercent: 70 },
    { label: "검증중", labelEn: "Verifying", value: 3, color: "#3b82f6", heightPercent: 42 },
    { label: "대기", labelEn: "Pending", value: 1, color: "#9ca3af", heightPercent: 18 },
  ], []);

  // Scope Data
  const scopeData = useMemo(() => [
    { scope: "scope1", scopeLabel: "Scope 1", emissions: "12,450", target: "13,000", achieved: "95.8%", color: "#ef4444" },
    { scope: "scope2", scopeLabel: "Scope 2", emissions: "18,230", target: "20,000", achieved: "91.2%", color: "#f97316" },
    { scope: "scope3", scopeLabel: "Scope 3", emissions: "8,120", target: "10,000", achieved: "81.2%", color: "#eab308" },
  ], []);

  // Certification Data
  const certificationData = useMemo(() => ({
    percent: 80,
    certified: 8,
    inProgress: 2,
    isCompliant: true,
  }), []);

  // Event Handlers
  const handleViewAllTasks = () => {
    console.log("View all tasks");
  };

  const handleTaskClick = (taskId: string) => {
    console.log("Task clicked:", taskId);
  };

  const handleCardClick = (cardId: string) => {
    console.log("Card clicked:", cardId);
  };

  const handleSiteClick = (siteId: string) => {
    console.log("Site clicked:", siteId);
  };

  const handleActionClick = (siteId: string, action: string) => {
    console.log("Action clicked:", siteId, action);
  };

  // Governance logging
  useEffect(() => {
    logGovernanceScope("PAGE", "emission-project-list", {
      language: en ? "en" : "ko",
      mobileMenuOpen,
      menuCount: homeMenu.length,
      isLoggedIn: Boolean(payload.isLoggedIn),
      dedicatedSiteCount: dedicatedSites.length,
      generalSiteCount: generalSites.length,
    });
  }, [en, mobileMenuOpen, homeMenu.length, payload.isLoggedIn, dedicatedSites.length, generalSites.length]);

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen">
      {/* Skip Link */}
      <a
        className="skip-link focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
        href="#main-content"
      >
        {en ? "Skip to content" : "본문 바로가기"}
      </a>

      {/* Inline Styles */}
      <EmissionProjectListStyles />

      {/* Header */}
      <EmissionProjectListHeader
        en={en}
        payload={payload}
        onLogout={session.logout}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
      />

      {/* Main Content */}
      <main id="main-content">
        {/* Hero Section with AI Assistant */}
        <EmissionProjectListHero
          en={en}
          queueItems={queueItems}
          totalTasks={queueItems.length}
          criticalTasks={queueItems.filter((q) => q.level === "CRITICAL").length}
          onViewAllTasks={handleViewAllTasks}
          onTaskClick={handleTaskClick}
        />

        {/* Metrics Section */}
        <EmissionProjectListMetrics
          en={en}
          statCards={statCards}
          annualAccumulation="45,120"
          annualTarget="60,000"
          achievementRate={75.2}
          onCardClick={handleCardClick}
        />

        {/* Sites Management Section */}
        <EmissionProjectListSites
          en={en}
          dedicatedSites={dedicatedSites}
          generalSites={generalSites}
          adminSiteManagementHref={adminSiteManagementHref}
          onSiteClick={handleSiteClick}
          onActionClick={handleActionClick}
        />

        {/* Charts Section */}
        <EmissionProjectListCharts
          en={en}
          processDistribution={processDistribution}
          scopeData={scopeData}
          certificationData={certificationData}
        />

        {/* Data Table Section */}
        <EmissionProjectListDataTable en={en} />

        {/* Reports Section */}
        <EmissionProjectListReports en={en} />
      </main>

      {/* Footer */}
      <EmissionProjectListFooter en={en} />
    </div>
  );
}