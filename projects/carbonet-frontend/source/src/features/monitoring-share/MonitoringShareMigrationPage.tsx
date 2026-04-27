import { useEffect, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminSelect, MemberButton, PageStatusNotice } from "../member/common";

type AudienceKey = "executive" | "stakeholder" | "audit";
type QueueTone = "critical" | "required" | "verify" | "insight";
type SiteTone = "stable" | "warning";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type HeroMetric = {
  label: string;
  value: string;
  unit?: string;
  badge: string;
  note?: string;
  badgeClassName: string;
};

type SummaryMetric = {
  label: string;
  value: string;
  unit?: string;
  progress: string;
  progressClassName: string;
};

type IndicatorRow = {
  label: string;
  value: string;
  versusTarget: string;
  targetClassName: string;
  confidence: string;
  confidenceClassName: string;
};

type Milestone = {
  key: string;
  order: string;
  title: string;
  body: string;
  result?: string;
  resultClassName?: string;
  complete?: boolean;
};

type QueueItem = {
  key: string;
  tone: QueueTone;
  badge: string;
  due: string;
  title: string;
  body: string;
  actionLabel: string;
  href: string;
};

type SiteCard = {
  key: string;
  tone: SiteTone;
  idLabel: string;
  title: string;
  value: string;
  unit: string;
  trend: string;
  alert?: string;
  primaryAction: string;
  primaryHref: string;
  secondaryAction?: string;
  secondaryHref?: string;
};

type LocalizedContent = {
  pageTitle: string;
  pageSubtitle: string;
  governmentText: string;
  governmentStatus: string;
  navItems: NavItem[];
  roleLabel: string;
  roleName: string;
  heroTitle: string;
  heroSubTitle: string;
  heroBreadcrumb: string[];
  pageStatusMessage: string;
  shareLabel: string;
  downloadLabel: string;
  briefingTitle: string;
  briefingUpdated: string;
  briefingHealthy: string;
  briefingSectionTitle: string;
  briefingSectionBody: string;
  milestonesTitle: string;
  milestonesSubtitle: string;
  fullReportLabel: string;
  assistantTitle: string;
  assistantSubtitle: string;
  assistantBody: string;
  assistantAction: string;
  audienceLabel: string;
  audienceOptions: Array<{ key: AudienceKey; label: string }>;
  queueTitle: string;
  siteTitle: string;
  siteBody: string;
  siteListLabel: string;
  siteRegisterLabel: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  heroMetrics: HeroMetric[];
  summaryMetrics: SummaryMetric[];
  indicatorRows: IndicatorRow[];
  milestones: Milestone[];
  queueItems: QueueItem[];
  siteCards: SiteCard[];
};

const QUEUE_TONE_CLASSNAME: Record<QueueTone, string> = {
  critical: "border-l-rose-500 bg-rose-500/10",
  required: "border-l-amber-500 bg-amber-500/10",
  verify: "border-l-sky-500 bg-sky-500/10",
  insight: "border-l-emerald-500 bg-emerald-500/10"
};

const QUEUE_BADGE_CLASSNAME: Record<QueueTone, string> = {
  critical: "bg-rose-500 text-white",
  required: "bg-amber-500 text-white",
  verify: "bg-sky-500 text-white",
  insight: "bg-emerald-500 text-white"
};

const SITE_CARD_CLASSNAME: Record<SiteTone, string> = {
  stable: "border-t-[var(--kr-gov-blue)] bg-white",
  warning: "border-t-orange-500 bg-white ring-2 ring-orange-500/10"
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "이해관계자 공유 및 경영진 요약",
    pageSubtitle: "EXECUTIVE SUMMARY & STAKEHOLDER BRIEFING",
    governmentText: "대한민국 정부 공식 서비스 | 탄소중립 경영 지원 포털",
    governmentStatus: "실시간 분석 시스템 가동 중",
    navItems: [
      { label: "모니터링", href: "/monitoring/dashboard" },
      { label: "분석 리포트", href: "/monitoring/statistics" },
      { label: "이해관계자 공유", href: "/monitoring/share", active: true },
      { label: "환경 데이터 관리", href: "/emission/project_list" }
    ],
    roleLabel: "최고환경책임자",
    roleName: "김경영 이사님",
    heroTitle: "경영진 요약 및 이해관계자 브리핑",
    heroSubTitle: "Executive Summary & Stakeholder Briefing",
    heroBreadcrumb: ["Dashboard", "Executive Summary"],
    pageStatusMessage: "reference 이해관계자 공유 화면을 현재 홈 포털 React 구조와 공통 상태/입력 패턴에 맞춰 재구성했습니다.",
    shareLabel: "이해관계자 공유하기",
    downloadLabel: "리포트 다운로드",
    briefingTitle: "전사 컴플라이언스 및 규제 대응 현황",
    briefingUpdated: "최종 감사 일자: 2026년 3월 28일",
    briefingHealthy: "모두 정상 (Healthy)",
    briefingSectionTitle: "이해관계자 주요 관심 지표",
    briefingSectionBody: "공개 브리핑에 자주 포함되는 핵심 항목을 현재 수치, 목표 대비, 신뢰도 수준으로 정리했습니다.",
    milestonesTitle: "탄소 감축 주요 성과",
    milestonesSubtitle: "Reduction Milestones",
    fullReportLabel: "경영진 분석 리포트 전문 보기",
    assistantTitle: "업데이트 비서",
    assistantSubtitle: "Intelligent Assistant",
    assistantBody: "감독관님, 실시간 데이터 분석 결과 4개의 우선 업데이트 업무가 감지되었습니다. 원활한 브리핑을 위해 데이터를 최신화해 주세요.",
    assistantAction: "업무 큐 전체 관리",
    audienceLabel: "브리핑 대상",
    audienceOptions: [
      { key: "executive", label: "경영진 요약" },
      { key: "stakeholder", label: "이해관계자 공유본" },
      { key: "audit", label: "감사 대응 브리프" }
    ],
    queueTitle: "Your Update Queue (Priority Tasks)",
    siteTitle: "핵심 배출지 현황 모니터링",
    siteBody: "현장 관리 감독관이 실시간 데이터를 제어하는 전용 위젯입니다.",
    siteListLabel: "전체 배출지 목록",
    siteRegisterLabel: "신규 배출지 등록",
    footerOrg: "CCUS 통합성과관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 이해관계자 지원 센터: 02-1234-5678",
    footerServiceLine: "본 시스템은 정부 지침에 따른 탄소 중립 성과 보고를 지원합니다.",
    footerCopyright: "© 2026 CCUS Carbon Management Platform. Executive View Enabled.",
    footerLastModified: "최종 갱신",
    footerWaAlt: "웹 접근성 품질마크",
    heroMetrics: [
      { label: "총 탄소 배출량 (YTD)", value: "45,120", unit: "tCO2e", badge: "TARGET ON-TRACK", note: "전년비 4.2% 감축", badgeClassName: "bg-emerald-500/20 text-emerald-300" },
      { label: "배출권 규제 준수율", value: "94.8", unit: "%", badge: "HIGH COMPLIANCE", note: "검증 8건 완료", badgeClassName: "bg-indigo-500/20 text-indigo-300" },
      { label: "CCUS 포집 효율", value: "82.5", unit: "%", badge: "OPERATIONAL EXCELLENCE", badgeClassName: "bg-sky-500/20 text-sky-300" },
      { label: "친환경 투자 회수율 (ROI)", value: "12.4", unit: "%", badge: "POSITIVE TREND", badgeClassName: "bg-orange-500/20 text-orange-300" }
    ],
    summaryMetrics: [
      { label: "공식 검증 통과", value: "12", unit: "/ 15 개소", progress: "80%", progressClassName: "bg-indigo-500" },
      { label: "배출권 잔여량", value: "14,880", unit: "tCO2e", progress: "65%", progressClassName: "bg-emerald-500" },
      { label: "법적 공시 준비도", value: "Ready", unit: "Tier 3 완료", progress: "67%", progressClassName: "bg-emerald-500" }
    ],
    indicatorRows: [
      { label: "Scope 1 배출 집약도", value: "0.45 tCO2/ton", versusTarget: "▲ 12% 개선", targetClassName: "text-emerald-600", confidence: "Verified", confidenceClassName: "bg-blue-50 text-blue-600 border border-blue-100" },
      { label: "재생 에너지 사용 비율", value: "18.5 %", versusTarget: "▲ 5% 증가", targetClassName: "text-indigo-600", confidence: "Verified", confidenceClassName: "bg-blue-50 text-blue-600 border border-blue-100" },
      { label: "공급망 배출 데이터 확보", value: "62 %", versusTarget: "● 분석 중", targetClassName: "text-orange-600", confidence: "Self-Report", confidenceClassName: "bg-slate-100 text-slate-500 border border-slate-200" }
    ],
    milestones: [
      { key: "pohang", order: "1", title: "포항 제1공장 에너지 효율화", body: "폐열 회수 시스템 도입으로 연간 배출량의 8%를 성공적으로 감축했습니다.", result: "1,200 tCO2 감축 달성", resultClassName: "text-emerald-600", complete: true },
      { key: "gwangyang", order: "2", title: "그린 수소 혼소 실증 완료", body: "광양 제2 에너지센터에서 수소 혼소 기술을 적용해 탄소 배출을 15% 억제했습니다.", complete: true },
      { key: "realtime", order: "3", title: "전 배출지 리얼타임 모니터링 구축", body: "데이터 투명성을 확보해 ESG 평가 지수를 A등급으로 유지하고 있습니다." }
    ],
    queueItems: [
      { key: "ulsan-docs", tone: "critical", badge: "Critical", due: "D-2", title: "울산 제3: 서류 보완", body: "배출계수 재산정 증빙 누락", actionLabel: "업데이트 하기", href: "/emission/validate" },
      { key: "pohang-energy", tone: "required", badge: "Required", due: "D-5", title: "포항 제1: 에너지 입력", body: "8월분 전력 사용량 확정", actionLabel: "입력기 열기", href: "/emission/data_input" },
      { key: "gwangyang-verify", tone: "verify", badge: "Verify", due: "D-12", title: "광양 제2: 검증 준비", body: "품질 보증 체크리스트 85%", actionLabel: "체크리스트", href: "/emission/validate" },
      { key: "trend-insight", tone: "insight", badge: "Insight", due: "Today", title: "배출 목표 트렌드", body: "현재 배출량이 목표 범위를 이탈", actionLabel: "분석 보고서", href: "/monitoring/reduction_trend" }
    ],
    siteCards: [
      { key: "pohang", tone: "stable", idLabel: "ID: PH-001", title: "포항 제1 열연공장", value: "2,341", unit: "tCO2", trend: "▲ 2.4% Trend", primaryAction: "데이터 입력", primaryHref: "/emission/data_input", secondaryAction: "산정 로직 확인", secondaryHref: "/emission/validate" },
      { key: "ulsan", tone: "warning", idLabel: "ID: US-042", title: "울산 제3 화학기지", value: "4,812", unit: "tCO2", trend: "▼ 1.1% Trend", alert: "증빙 서류 2건 누락", primaryAction: "누락 서류 업로드", primaryHref: "/emission/validate" }
    ]
  },
  en: {
    pageTitle: "Stakeholder Sharing and Executive Summary",
    pageSubtitle: "EXECUTIVE SUMMARY & STAKEHOLDER BRIEFING",
    governmentText: "Official Government Service | Carbon-neutral management support portal",
    governmentStatus: "Real-time analytics system active",
    navItems: [
      { label: "Monitoring", href: "/monitoring/dashboard" },
      { label: "Analytics Reports", href: "/monitoring/statistics" },
      { label: "Stakeholder Sharing", href: "/monitoring/share", active: true },
      { label: "Environmental Data", href: "/emission/project_list" }
    ],
    roleLabel: "Chief Sustainability Officer",
    roleName: "Director Kim",
    heroTitle: "Executive Summary & Stakeholder Briefing",
    heroSubTitle: "Executive Summary & Stakeholder Briefing",
    heroBreadcrumb: ["Dashboard", "Executive Summary"],
    pageStatusMessage: "The reference stakeholder-sharing dashboard was rebuilt in the current React home portal structure using shared state and field patterns.",
    shareLabel: "Share with Stakeholders",
    downloadLabel: "Download Report",
    briefingTitle: "Enterprise Compliance and Regulatory Readiness",
    briefingUpdated: "Last audit date: March 28, 2026",
    briefingHealthy: "Healthy",
    briefingSectionTitle: "Key Stakeholder Indicators",
    briefingSectionBody: "Frequently shared briefing indicators are organized by current value, target delta, and confidence level.",
    milestonesTitle: "Reduction Milestones",
    milestonesSubtitle: "Reduction Milestones",
    fullReportLabel: "Open full executive analysis report",
    assistantTitle: "Update Assistant",
    assistantSubtitle: "Intelligent Assistant",
    assistantBody: "Four priority update tasks were detected from the live analysis stream. Refresh the latest data before the next stakeholder briefing.",
    assistantAction: "Manage full work queue",
    audienceLabel: "Audience preset",
    audienceOptions: [
      { key: "executive", label: "Executive summary" },
      { key: "stakeholder", label: "Stakeholder sharing" },
      { key: "audit", label: "Audit brief" }
    ],
    queueTitle: "Your Update Queue (Priority Tasks)",
    siteTitle: "Pinned Emission Sites",
    siteBody: "Dedicated widgets for supervisors who control real-time site data before sharing.",
    siteListLabel: "All sites",
    siteRegisterLabel: "Register site",
    footerOrg: "CCUS Integrated Performance Center",
    footerAddress: "110 Sejong-daero, Jung-gu, Seoul 04551 | Stakeholder desk: +82-2-1234-5678",
    footerServiceLine: "This system supports carbon-neutral performance reporting under government guidance.",
    footerCopyright: "© 2026 CCUS Carbon Management Platform. Executive View Enabled.",
    footerLastModified: "Last updated",
    footerWaAlt: "Web accessibility mark",
    heroMetrics: [
      { label: "Total carbon emissions (YTD)", value: "45,120", unit: "tCO2e", badge: "TARGET ON-TRACK", note: "4.2% lower YoY", badgeClassName: "bg-emerald-500/20 text-emerald-300" },
      { label: "Allowance compliance rate", value: "94.8", unit: "%", badge: "HIGH COMPLIANCE", note: "8 verifications complete", badgeClassName: "bg-indigo-500/20 text-indigo-300" },
      { label: "CCUS capture efficiency", value: "82.5", unit: "%", badge: "OPERATIONAL EXCELLENCE", badgeClassName: "bg-sky-500/20 text-sky-300" },
      { label: "Green investment ROI", value: "12.4", unit: "%", badge: "POSITIVE TREND", badgeClassName: "bg-orange-500/20 text-orange-300" }
    ],
    summaryMetrics: [
      { label: "Official verification passed", value: "12", unit: "/ 15 sites", progress: "80%", progressClassName: "bg-indigo-500" },
      { label: "Remaining allowance", value: "14,880", unit: "tCO2e", progress: "65%", progressClassName: "bg-emerald-500" },
      { label: "Disclosure readiness", value: "Ready", unit: "Tier 3 complete", progress: "67%", progressClassName: "bg-emerald-500" }
    ],
    indicatorRows: [
      { label: "Scope 1 intensity", value: "0.45 tCO2/ton", versusTarget: "▲ 12% improved", targetClassName: "text-emerald-600", confidence: "Verified", confidenceClassName: "bg-blue-50 text-blue-600 border border-blue-100" },
      { label: "Renewable energy share", value: "18.5 %", versusTarget: "▲ 5% increase", targetClassName: "text-indigo-600", confidence: "Verified", confidenceClassName: "bg-blue-50 text-blue-600 border border-blue-100" },
      { label: "Supply-chain emissions coverage", value: "62 %", versusTarget: "● In review", targetClassName: "text-orange-600", confidence: "Self-Report", confidenceClassName: "bg-slate-100 text-slate-500 border border-slate-200" }
    ],
    milestones: [
      { key: "pohang", order: "1", title: "Pohang Mill 1 efficiency upgrade", body: "Waste-heat recovery reduced annual emissions by 8%.", result: "1,200 tCO2 reduction achieved", resultClassName: "text-emerald-600", complete: true },
      { key: "gwangyang", order: "2", title: "Green hydrogen co-firing pilot", body: "Gwangyang Energy Center 2 held carbon output 15% below the prior pattern.", complete: true },
      { key: "realtime", order: "3", title: "Full real-time monitoring rollout", body: "Higher data transparency is keeping the ESG evaluation grade at A." }
    ],
    queueItems: [
      { key: "ulsan-docs", tone: "critical", badge: "Critical", due: "D-2", title: "Ulsan Base 3: document update", body: "Missing evidence for emission-factor recalculation", actionLabel: "Update now", href: "/emission/validate" },
      { key: "pohang-energy", tone: "required", badge: "Required", due: "D-5", title: "Pohang Mill 1: energy input", body: "Finalize August power usage", actionLabel: "Open input form", href: "/emission/data_input" },
      { key: "gwangyang-verify", tone: "verify", badge: "Verify", due: "D-12", title: "Gwangyang Center 2: verification prep", body: "Quality assurance checklist at 85%", actionLabel: "Checklist", href: "/emission/validate" },
      { key: "trend-insight", tone: "insight", badge: "Insight", due: "Today", title: "Target trend drift", body: "Current emissions moved outside the target band", actionLabel: "Analysis report", href: "/monitoring/reduction_trend" }
    ],
    siteCards: [
      { key: "pohang", tone: "stable", idLabel: "ID: PH-001", title: "Pohang Mill 1", value: "2,341", unit: "tCO2", trend: "▲ 2.4% Trend", primaryAction: "Enter data", primaryHref: "/emission/data_input", secondaryAction: "Check calculation logic", secondaryHref: "/emission/validate" },
      { key: "ulsan", tone: "warning", idLabel: "ID: US-042", title: "Ulsan Chemical Base 3", value: "4,812", unit: "tCO2", trend: "▼ 1.1% Trend", alert: "Two evidence files missing", primaryAction: "Upload missing files", primaryHref: "/emission/validate" }
    ]
  }
};

export function MonitoringShareMigrationPage() {
  const session = useFrontendSession();
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const [audience, setAudience] = useState<AudienceKey>("executive");

  const goToLocalized = (href: string) => {
    navigate(buildLocalizedPath(href, `/en${href}`));
  };

  useEffect(() => {
    document.title = content.pageTitle;
  }, [content.pageTitle]);

  useEffect(() => {
    logGovernanceScope("PAGE", "monitoring-share", {
      language: en ? "en" : "ko",
      userType: session.value?.authorCode || "guest",
      audience
    });
  }, [audience, en, session.value?.authorCode]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[var(--kr-gov-text-primary)]">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-3 focus:py-2 focus:text-white" href="#main-content">
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.governmentStatus} />

      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-5 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[34px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                analytics
              </span>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900">CCUS Performance Dashboard</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{content.pageSubtitle}</p>
              </div>
            </div>
            <nav className="mt-5 hidden flex-wrap items-center gap-1 xl:flex">
              {content.navItems.map((item) => (
                <button
                  className={`h-10 border-b-[3px] px-4 text-[15px] font-bold transition ${
                    item.active
                      ? "border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)]"
                      : "border-transparent text-slate-500 hover:text-[var(--kr-gov-blue)]"
                  }`}
                  key={item.href}
                  onClick={() => navigate(buildLocalizedPath(item.href, `/en${item.href}`))}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <UserLanguageToggle en={en} onEn={() => navigate("/en/monitoring/share")} onKo={() => navigate("/monitoring/share")} />
            <div className="hidden text-right md:block">
              <p className="text-xs font-bold text-slate-500">{content.roleLabel}</p>
              <p className="text-sm font-black text-slate-900">{content.roleName}</p>
            </div>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <span className="material-symbols-outlined text-slate-700">share</span>
              <span className="absolute right-0.5 top-0.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">NEW</span>
            </div>
            <MemberButton className="!bg-[var(--kr-gov-blue)] !px-4 !py-2.5 !text-sm !text-white hover:!bg-[#002d72]">
              {en ? "Log out" : "로그아웃"}
            </MemberButton>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="overflow-hidden bg-slate-900 pb-24 pt-10 text-white" data-help-id="monitoring-share-hero">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="mb-6 max-w-3xl">
              <PageStatusNotice tone="warning">{content.pageStatusMessage}</PageStatusNotice>
            </div>
            <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-indigo-300">
                  <span className="material-symbols-outlined text-[14px]">home</span>
                  <span>{content.heroBreadcrumb[0]}</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  <span className="text-white">{content.heroBreadcrumb[1]}</span>
                </div>
                <h2 className="text-3xl font-black leading-tight text-white lg:text-5xl">{content.heroTitle}</h2>
                <p className="mt-3 text-lg font-semibold text-indigo-300">{content.heroSubTitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <MemberButton className="!gap-2 !bg-white !px-5 !py-3 !text-sm !font-bold !text-slate-900 hover:!bg-slate-100" onClick={() => goToLocalized("/monitoring/export")}>
                  <span className="material-symbols-outlined text-[18px]">ios_share</span>
                  {content.shareLabel}
                </MemberButton>
                <MemberButton className="!gap-2 !bg-indigo-600 !px-5 !py-3 !text-sm !font-bold !text-white hover:!bg-indigo-500" onClick={() => goToLocalized("/trade/report")}>
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  {content.downloadLabel}
                </MemberButton>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {content.heroMetrics.map((metric) => (
                <article className="rounded-[22px] border border-white/15 bg-white/10 p-6 backdrop-blur" key={metric.label}>
                  <p className="text-xs font-bold text-slate-300">{metric.label}</p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-3xl font-black text-white">{metric.value}</span>
                    {metric.unit ? <span className="pb-1 text-sm font-bold uppercase text-slate-400">{metric.unit}</span> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-1 text-[11px] font-bold ${metric.badgeClassName}`}>{metric.badge}</span>
                    {metric.note ? <span className="text-[11px] text-slate-400">{metric.note}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-12 pb-14" data-help-id="monitoring-share-briefing">
          <div className="mx-auto grid max-w-[1440px] gap-8 px-4 lg:grid-cols-[1.7fr_1fr] lg:px-8">
            <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-8 flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <span className="material-symbols-outlined">verified_user</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{content.briefingTitle}</h3>
                    <p className="mt-1 text-xs text-slate-500">{content.briefingUpdated}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{content.briefingHealthy}</span>
              </div>

              <div className="mb-8 grid gap-4 md:grid-cols-3">
                {content.summaryMetrics.map((metric) => (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={metric.label}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="text-2xl font-black text-slate-900">{metric.value}</span>
                      {metric.unit ? <span className="pb-1 text-xs text-slate-400">{metric.unit}</span> : null}
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${metric.progressClassName}`} style={{ width: metric.progress }} />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-700">{content.briefingSectionTitle}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">{content.briefingSectionBody}</p>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        <th className="px-2 py-3">{en ? "Indicator" : "지표 항목"}</th>
                        <th className="px-2 py-3">{en ? "Current" : "현재 수치"}</th>
                        <th className="px-2 py-3">{en ? "Vs target" : "목표 대비"}</th>
                        <th className="px-2 py-3">{en ? "Confidence" : "신뢰도 수준"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {content.indicatorRows.map((row) => (
                        <tr className="hover:bg-slate-50" key={row.label}>
                          <td className="px-2 py-4 font-bold text-slate-700">{row.label}</td>
                          <td className="px-2 py-4 text-slate-600">{row.value}</td>
                          <td className={`px-2 py-4 font-bold ${row.targetClassName}`}>{row.versusTarget}</td>
                          <td className="px-2 py-4">
                            <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-black uppercase ${row.confidenceClassName}`}>{row.confidence}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>

            <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-8 flex items-start gap-3 border-b border-slate-100 pb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <span className="material-symbols-outlined">energy_savings_leaf</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{content.milestonesTitle}</h3>
                  <p className="mt-1 text-xs text-slate-500">{content.milestonesSubtitle}</p>
                </div>
              </div>
              <div className="flex-1 space-y-6">
                {content.milestones.map((milestone) => (
                  <div className="relative pl-9" key={milestone.key}>
                    <div className={`absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${milestone.complete ? "bg-indigo-600" : "bg-slate-300"}`}>
                      {milestone.order}
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">{milestone.title}</h4>
                    <p className="mt-2 text-xs leading-6 text-slate-500">{milestone.body}</p>
                    {milestone.result ? <p className={`mt-2 text-[11px] font-black ${milestone.resultClassName}`}>{milestone.result}</p> : null}
                  </div>
                ))}
              </div>
              <div className="mt-8 border-t border-slate-100 pt-6">
                <MemberButton
                  className="!flex !w-full !justify-center !gap-2 !bg-slate-900 !py-3 !text-sm !font-bold !text-white hover:!bg-black"
                  onClick={() => navigate(buildLocalizedPath("/monitoring/statistics", "/en/monitoring/statistics"))}
                >
                  <span className="material-symbols-outlined text-[18px]">auto_graph</span>
                  {content.fullReportLabel}
                </MemberButton>
              </div>
            </article>
          </div>
        </section>

        <section className="pb-14" data-help-id="monitoring-share-queue">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="overflow-hidden rounded-[28px] border border-indigo-800 bg-indigo-950 shadow-2xl shadow-indigo-950/10">
              <div className="grid gap-8 p-8 xl:grid-cols-[320px_1fr]">
                <div>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                      <span className="material-symbols-outlined text-[28px]">auto_awesome</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">{content.assistantTitle}</h2>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-300">{content.assistantSubtitle}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-indigo-100">{content.assistantBody}</p>
                  <div className="mt-6">
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300" htmlFor="monitoring-share-audience">
                      {content.audienceLabel}
                    </label>
                    <AdminSelect id="monitoring-share-audience" value={audience} onChange={(event) => setAudience(event.target.value as AudienceKey)}>
                      {content.audienceOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </AdminSelect>
                  </div>
                  <MemberButton className="!mt-4 !w-full !justify-center !gap-2 !bg-indigo-800 !py-3 !text-sm !font-bold !text-white hover:!bg-indigo-700" onClick={() => goToLocalized("/monitoring/export")}>
                    <span className="material-symbols-outlined text-[18px]">list_alt</span>
                    {content.assistantAction}
                  </MemberButton>
                </div>

                <div>
                  <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300">
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    <span>{content.queueTitle}</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {content.queueItems.map((item) => (
                      <article className={`rounded-r-xl border border-white/10 border-l-4 p-5 ${QUEUE_TONE_CLASSNAME[item.tone]}`} key={item.key}>
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${QUEUE_BADGE_CLASSNAME[item.tone]}`}>{item.badge}</span>
                          <span className="text-[10px] font-bold text-indigo-300">{item.due}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white">{item.title}</h3>
                        <p className="mt-2 min-h-[34px] text-[11px] leading-5 text-indigo-100/70">{item.body}</p>
                        <button
                          className="mt-4 text-[11px] font-bold text-indigo-300 hover:underline"
                          onClick={() => goToLocalized(item.href)}
                          type="button"
                        >
                          {item.actionLabel} →
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-16" data-help-id="monitoring-share-sites">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    push_pin
                  </span>
                  {content.siteTitle}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{content.siteBody}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MemberButton className="!border !border-slate-200 !bg-white !px-4 !py-2.5 !text-xs !font-bold !text-slate-700 hover:!bg-slate-50" onClick={() => goToLocalized("/emission/project_list")}>
                  {content.siteListLabel}
                </MemberButton>
                <MemberButton className="!bg-slate-900 !px-4 !py-2.5 !text-xs !font-bold !text-white hover:!bg-black" onClick={() => goToLocalized("/emission/data_input")}>
                  + {content.siteRegisterLabel}
                </MemberButton>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {content.siteCards.map((site) => (
                <article className={`overflow-hidden rounded-2xl border border-slate-200 border-t-4 shadow-sm ${SITE_CARD_CLASSNAME[site.tone]}`} key={site.key}>
                  <div className={`flex items-start justify-between p-6 ${site.tone === "warning" ? "bg-orange-50/50" : "bg-blue-50/40"}`}>
                    <div>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${site.tone === "warning" ? "border-orange-200 bg-orange-100 text-orange-700" : "border-blue-200 bg-blue-100 text-blue-700"}`}>
                        {site.idLabel}
                      </span>
                      <h3 className={`mt-3 text-xl font-black ${site.tone === "warning" ? "text-orange-600" : "text-slate-900"}`}>{site.title}</h3>
                    </div>
                    <span className={`material-symbols-outlined ${site.tone === "warning" ? "text-orange-500" : "text-blue-600"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      push_pin
                    </span>
                  </div>

                  {site.alert ? (
                    <div className="flex items-center justify-between border-y border-red-100 bg-red-50 px-6 py-3">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-red-700">
                        <span className="material-symbols-outlined text-[16px]">report</span>
                        {site.alert}
                      </span>
                    </div>
                  ) : null}

                  <div className="space-y-6 p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{en ? "Current emission" : "현재 배출량"}</p>
                        <div className="mt-2 flex items-end gap-1">
                          <span className="text-3xl font-black text-slate-900">{site.value}</span>
                          <span className="pb-1 text-sm font-bold uppercase text-slate-400">{site.unit}</span>
                        </div>
                      </div>
                      <div className={`rounded px-3 py-3 text-[10px] font-black ${site.tone === "warning" ? "bg-orange-50 text-orange-600" : "bg-indigo-50 text-indigo-600"}`}>
                        {site.trend}
                      </div>
                    </div>

                    <div className={`grid gap-2 ${site.secondaryAction ? "grid-cols-2" : "grid-cols-1"}`}>
                      <MemberButton
                        className={`!justify-center !py-2.5 !text-[11px] !font-bold ${site.tone === "warning" ? "!bg-orange-600 !text-white hover:!bg-orange-700" : "!bg-slate-900 !text-white hover:!bg-black"}`}
                        onClick={() => goToLocalized(site.primaryHref)}
                      >
                        {site.primaryAction}
                      </MemberButton>
                      {site.secondaryAction && site.secondaryHref
                        ? (() => {
                            const secondaryHref = site.secondaryHref;
                            return (
                                <MemberButton
                                  className="!justify-center !border !border-slate-200 !bg-white !py-2.5 !text-[11px] !font-bold !text-slate-700 hover:!bg-slate-50"
                                  onClick={() => goToLocalized(secondaryHref)}
                                >
                                  {site.secondaryAction}
                                </MemberButton>
                            );
                          })()
                        : null}
                    </div>
                  </div>
                </article>
              ))}

              <article
                className="flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/30"
                onClick={() => goToLocalized("/emission/data_input")}
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
                  <span className="material-symbols-outlined text-[32px] text-slate-300">add_task</span>
                </div>
                <h3 className="font-bold text-slate-500">{en ? "Pin another emission site" : "배출지 추가 핀(Pin) 고정"}</h3>
                <p className="mt-2 text-[11px] text-slate-400">{en ? "Register another facility that needs focused oversight." : "집중 관리가 필요한 시설을 등록하세요."}</p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={content.footerAddress}
        copyright={content.footerCopyright}
        lastModifiedLabel={content.footerLastModified}
        orgName={content.footerOrg}
        serviceLine={content.footerServiceLine}
        waAlt={content.footerWaAlt}
      />
    </div>
  );
}
