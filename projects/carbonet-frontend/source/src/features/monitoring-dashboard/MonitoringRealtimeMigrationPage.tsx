import { useEffect, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeLinkButton } from "../home-ui/common";
import { AdminSelect } from "../member/common";

type QueueTone = "critical" | "required" | "verification";
type QueueFilter = "all" | QueueTone;

type QueueItem = {
  key: string;
  tone: QueueTone;
  badge: string;
  due: string;
  icon: string;
  title: string;
  body: string;
  collaborators?: string[];
  secondaryAction?: string;
  secondaryHref?: string;
  primaryAction: string;
  primaryHref: string;
};

type WorkflowStep = {
  key: string;
  label: string;
  title: string;
  body: string;
  active?: boolean;
};

type GuidanceCard = {
  key: string;
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  metricLabel: string;
  metricValue: string;
  action: string;
  href: string;
};

type TimelineItem = {
  key: string;
  label: string;
  title: string;
  body: string;
  href: string;
};

type LocalizedContent = {
  governmentText: string;
  governmentStatus: string;
  pageTitle: string;
  pageSubtitle: string;
  navItems: string[];
  supervisorLabel: string;
  supervisorName: string;
  assistantCount: string;
  systemButton: string;
  skipToContent: string;
  heroTitle: string;
  heroStatus: string;
  heroBriefingTitle: string;
  heroBriefingBody: string;
  heroPrimaryMetricLabel: string;
  heroPrimaryMetricValue: string;
  heroSecondaryMetricLabel: string;
  heroSecondaryMetricValue: string;
  queueTitle: string;
  queueCountSuffix: string;
  queueFilteredLabel: string;
  queueFilterLabel: string;
  queueFilterOptions: Array<{ value: QueueFilter; label: string }>;
  queueSummaryTitle: string;
  queueSummaryItems: Array<{ key: QueueTone; label: string }>;
  workflowTitle: string;
  workflowBody: string;
  workflowSteps: WorkflowStep[];
  guidanceTitle: string;
  guidanceBody: string;
  guidanceCards: GuidanceCard[];
  timelineTitle: string;
  timelineBody: string;
  timelineItems: TimelineItem[];
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerLinks: string[];
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  queueItems: QueueItem[];
};

const QUEUE_CARD_CLASSNAME: Record<QueueTone, string> = {
  critical: "border-l-red-500",
  required: "border-l-orange-500",
  verification: "border-l-blue-500"
};

const QUEUE_BADGE_CLASSNAME: Record<QueueTone, string> = {
  critical: "bg-red-500 text-white",
  required: "bg-orange-500 text-white",
  verification: "bg-blue-500 text-white"
};

const QUEUE_ICON_CLASSNAME: Record<QueueTone, string> = {
  critical: "bg-red-100 text-red-600",
  required: "bg-orange-100 text-orange-600",
  verification: "bg-blue-100 text-blue-600"
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    governmentText: "환경데이터 분석가 전용 | Predictive Monitoring Hub",
    governmentStatus: "데이터 모델링 갱신: 5분 전",
    pageTitle: "예측 모니터링 허브",
    pageSubtitle: "Environmental Data Intelligence",
    navItems: ["실시간 예측 현황", "이상 징후 분석", "시뮬레이션 모델", "데이터 거버넌스"],
    supervisorLabel: "데이터 분석팀",
    supervisorName: "강데이터 분석가님",
    assistantCount: "3",
    systemButton: "시스템 설정",
    skipToContent: "본문 바로가기",
    heroTitle: "실시간 예측 브리핑",
    heroStatus: "Predictive Monitoring Core",
    heroBriefingTitle: "현재 감시 포인트",
    heroBriefingBody: "주요 사업장 3곳에서 예측 배출량 편차가 확대되고 있습니다. 실측 대비 차이가 큰 지점부터 원인 분석과 시뮬레이션 모델 점검을 진행해야 합니다.",
    heroPrimaryMetricLabel: "예측 정확도",
    heroPrimaryMetricValue: "96.4%",
    heroSecondaryMetricLabel: "집중 감시",
    heroSecondaryMetricValue: "18 Sites",
    queueTitle: "Prediction Insight Feed",
    queueCountSuffix: "Signals",
    queueFilteredLabel: "표시 중",
    queueFilterLabel: "필터",
    queueFilterOptions: [
      { value: "all", label: "전체" },
      { value: "critical", label: "긴급" },
      { value: "required", label: "필수" },
      { value: "verification", label: "검증" }
    ],
    queueSummaryTitle: "집중 분석 포인트",
    queueSummaryItems: [
      { key: "critical", label: "이상 징후" },
      { key: "required", label: "모델 점검" },
      { key: "verification", label: "검증 비교" }
    ],
    workflowTitle: "실시간 분석 흐름",
    workflowBody: "예측 모니터링 reference 흐름에 맞춰 이상 감지, 원인 분석, 시뮬레이션, 거버넌스 검토를 한 화면에서 이어서 처리하도록 구성했습니다.",
    workflowSteps: [
      {
        key: "capture",
        label: "01",
        title: "이상 감지",
        body: "편차가 큰 사업장과 비정상 패턴을 먼저 식별합니다."
      },
      {
        key: "validate",
        label: "02",
        title: "원인 분석",
        body: "실측값, 예측값, 지역 조건을 대조해 원인 후보를 좁힙니다.",
        active: true
      },
      {
        key: "respond",
        label: "03",
        title: "모델 대응",
        body: "시뮬레이션과 파라미터 점검으로 대응 시나리오를 실행합니다."
      },
      {
        key: "close",
        label: "04",
        title: "거버넌스 반영",
        body: "검토 결과를 모니터링 리포트와 데이터 거버넌스에 반영합니다."
      }
    ],
    guidanceTitle: "분석 작업 보드",
    guidanceBody: "실시간 모니터링에서 바로 이어지는 주요 분석 진입점을 묶었습니다.",
    guidanceCards: [
      {
        key: "realtime",
        icon: "monitoring",
        eyebrow: "MONITORING",
        title: "통합 대시보드 이동",
        body: "전사 우선순위와 운영 브리핑이 필요할 때 통합 허브로 이동합니다.",
        metricLabel: "상위 허브",
        metricValue: "Dashboard",
        action: "통합 대시보드",
        href: "/monitoring/dashboard"
      },
      {
        key: "validate",
        icon: "task_alt",
        eyebrow: "VALIDATION",
        title: "시뮬레이션 모델",
        body: "예측 시나리오와 감축 효과 모델을 바로 점검합니다.",
        metricLabel: "활성 모델",
        metricValue: "12 Models",
        action: "시뮬레이션 열기",
        href: "/emission/simulate"
      },
      {
        key: "integrity",
        icon: "verified_user",
        eyebrow: "TRACEABILITY",
        title: "데이터 거버넌스",
        body: "무결성과 품질 지표를 확인해 예측 신뢰도를 판단합니다.",
        metricLabel: "정상 연계율",
        metricValue: "99.8%",
        action: "무결성 화면 열기",
        href: "/co2/integrity"
      }
    ],
    timelineTitle: "오늘의 분석 일정",
    timelineBody: "실시간 모니터링 이후 바로 이어갈 분석 액션을 타임라인으로 정리했습니다.",
    timelineItems: [
      {
        key: "08",
        label: "08:30",
        title: "울산 제3 편차 원인 추적",
        body: "센서 편차와 외부 기온 변수를 비교해 예측 오차 원인 확인",
        href: "/monitoring/track"
      },
      {
        key: "10",
        label: "10:00",
        title: "포항 제1 모델 보정 검토",
        body: "8월 실측값과 예측 모델 파라미터 재대조",
        href: "/emission/simulate"
      },
      {
        key: "14",
        label: "14:00",
        title: "예측 리포트 패키지 생성",
        body: "통합 대시보드용 브리핑 요약에 분석 결과 반영",
        href: "/certificate/report_form"
      }
    ],
    footerOrg: "환경데이터 분석본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110",
    footerServiceLine: "예측 모니터링 분석실 02-1234-5678",
    footerLinks: ["개인정보처리방침", "분석 가이드", "데이터 거버넌스", "문의하기"],
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Predictive Monitoring Hub.",
    footerLastModified: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크",
    queueItems: [
      {
        key: "ulsan-docs",
        tone: "critical",
        badge: "CRITICAL",
        due: "D-2 Deadline",
        icon: "priority_high",
        title: "울산 제3 화학기지: 예측 편차 확대",
        body: "실측 대비 예측 배출량 편차가 8%를 넘어 원인 분석이 필요합니다.",
        collaborators: ["1", "2", "3"],
        secondaryAction: "추적 리포트",
        secondaryHref: "/monitoring/track",
        primaryAction: "실시간 상세 보기",
        primaryHref: "/monitoring/track"
      },
      {
        key: "pohang-energy",
        tone: "required",
        badge: "REQUIRED",
        due: "Monthly Update",
        icon: "pending_actions",
        title: "포항 제1 열연공장: 모델 보정 필요",
        body: "야간 업데이트 이후 예측 곡선이 실측 추세와 벌어져 시뮬레이션 점검이 필요합니다.",
        primaryAction: "시뮬레이션 점검",
        primaryHref: "/emission/simulate"
      },
      {
        key: "gwangyang-report",
        tone: "verification",
        badge: "VERIFICATION",
        due: "Board Review",
        icon: "verified",
        title: "광양 제2 에너지센터: 연간 예측 재검증",
        body: "연말 목표 초과 가능성에 대한 예측 모델 신뢰도 점검이 필요합니다.",
        secondaryAction: "무결성 추적",
        secondaryHref: "/co2/integrity",
        primaryAction: "예측 리포트",
        primaryHref: "/certificate/report_form"
      },
      {
        key: "incheon-sync",
        tone: "verification",
        badge: "VERIFICATION",
        due: "API Sync",
        icon: "sync_problem",
        title: "인천 물류센터: 실시간 연계 지연",
        body: "외부 연계 지연으로 실시간 예측 반영 시간이 증가해 데이터 거버넌스 검토가 필요합니다.",
        secondaryAction: "데이터 거버넌스",
        secondaryHref: "/co2/integrity",
        primaryAction: "추적 리포트",
        primaryHref: "/co2/integrity"
      },
      {
        key: "executive-brief",
        tone: "required",
        badge: "REQUIRED",
        due: "17:00 Briefing",
        icon: "description",
        title: "실시간 예측 브리핑 생성",
        body: "사업장별 예측 편차와 위험 신호를 묶어 분석 브리핑을 준비해야 합니다.",
        primaryAction: "브리핑 생성",
        primaryHref: "/certificate/report_form"
      }
    ]
  },
  en: {
    governmentText: "Environmental Analyst Workspace | Predictive Monitoring Hub",
    governmentStatus: "Model refresh: 5 minutes ago",
    pageTitle: "Predictive Monitoring Hub",
    pageSubtitle: "Environmental Data Intelligence",
    navItems: ["Live Forecast", "Anomaly Analysis", "Simulation Models", "Data Governance"],
    supervisorLabel: "Data Analytics Team",
    supervisorName: "Analyst Kang",
    assistantCount: "3",
    systemButton: "System Settings",
    skipToContent: "Skip to content",
    heroTitle: "Live Forecast Briefing",
    heroStatus: "Predictive Monitoring Core",
    heroBriefingTitle: "Current watch points",
    heroBriefingBody: "Three priority facilities are showing widening variance against forecast values. Start with the sites where measured values diverge the most.",
    heroPrimaryMetricLabel: "Forecast Accuracy",
    heroPrimaryMetricValue: "96.4%",
    heroSecondaryMetricLabel: "Focused Sites",
    heroSecondaryMetricValue: "18",
    queueTitle: "Prediction Insight Feed",
    queueCountSuffix: "Signals",
    queueFilteredLabel: "Visible now",
    queueFilterLabel: "Filter",
    queueFilterOptions: [
      { value: "all", label: "All" },
      { value: "critical", label: "Critical" },
      { value: "required", label: "Required" },
      { value: "verification", label: "Verification" }
    ],
    queueSummaryTitle: "Focused analysis points",
    queueSummaryItems: [
      { key: "critical", label: "Anomalies" },
      { key: "required", label: "Model checks" },
      { key: "verification", label: "Comparisons" }
    ],
    workflowTitle: "Real-time Analysis Flow",
    workflowBody: "The live monitoring reference flow was rebuilt so anomaly detection, root-cause review, simulation, and governance checks stay on one page.",
    workflowSteps: [
      {
        key: "capture",
        label: "01",
        title: "Detect anomalies",
        body: "Identify high-variance facilities and unusual patterns first."
      },
      {
        key: "validate",
        label: "02",
        title: "Review causes",
        body: "Compare measured values, forecast values, and regional factors to narrow causes.",
        active: true
      },
      {
        key: "respond",
        label: "03",
        title: "Run response model",
        body: "Inspect simulation paths and adjust model assumptions."
      },
      {
        key: "close",
        label: "04",
        title: "Reflect governance",
        body: "Write the result back into monitoring reports and governance records."
      }
    ],
    guidanceTitle: "Analyst Workboard",
    guidanceBody: "These are the main destinations connected directly from the live monitoring workspace.",
    guidanceCards: [
      {
        key: "realtime",
        icon: "monitoring",
        eyebrow: "MONITORING",
        title: "Integrated dashboard",
        body: "Move to the enterprise-wide hub when you need top-level priorities and executive briefing context.",
        metricLabel: "Upper hub",
        metricValue: "Dashboard",
        action: "Open dashboard",
        href: "/en/monitoring/dashboard"
      },
      {
        key: "validate",
        icon: "task_alt",
        eyebrow: "VALIDATION",
        title: "Simulation models",
        body: "Inspect forecast scenarios and reduction-effect models directly.",
        metricLabel: "Active models",
        metricValue: "12 Models",
        action: "Open simulation",
        href: "/en/emission/simulate"
      },
      {
        key: "integrity",
        icon: "verified_user",
        eyebrow: "TRACEABILITY",
        title: "Data governance",
        body: "Review integrity and quality indicators to judge forecast reliability.",
        metricLabel: "Healthy sync rate",
        metricValue: "99.8%",
        action: "Open integrity",
        href: "/en/co2/integrity"
      }
    ],
    timelineTitle: "Today's analysis schedule",
    timelineBody: "The lower section organizes the next analysis actions after live monitoring.",
    timelineItems: [
      {
        key: "08",
        label: "08:30",
        title: "Trace Ulsan Site 3 variance cause",
        body: "Compare sensor variance and weather variables to explain forecast error",
        href: "/en/monitoring/track"
      },
      {
        key: "10",
        label: "10:00",
        title: "Review Pohang model correction",
        body: "Recheck August measured values against model parameters",
        href: "/en/emission/simulate"
      },
      {
        key: "14",
        label: "14:00",
        title: "Generate forecast briefing package",
        body: "Reflect analysis results into the dashboard briefing summary",
        href: "/en/certificate/report_form"
      }
    ],
    footerOrg: "Environmental Data Analytics Office",
    footerAddress: "110 Sejong-daero, Jung-gu, Seoul, Republic of Korea",
    footerServiceLine: "Predictive Monitoring Center +82-2-1234-5678",
    footerLinks: ["Privacy Policy", "Analysis Guide", "Data Governance", "Contact"],
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Predictive Monitoring Hub.",
    footerLastModified: "Last Modified:",
    footerWaAlt: "Web Accessibility Quality Mark",
    queueItems: [
      {
        key: "ulsan-docs",
        tone: "critical",
        badge: "CRITICAL",
        due: "D-2 Deadline",
        icon: "priority_high",
        title: "Ulsan Chemical Base 3: forecast variance widening",
        body: "Measured emissions are diverging by more than 8% from the forecast and need cause review.",
        collaborators: ["1", "2", "3"],
        secondaryAction: "Open trace report",
        secondaryHref: "/en/monitoring/track",
        primaryAction: "Open live detail",
        primaryHref: "/en/monitoring/track"
      },
      {
        key: "pohang-energy",
        tone: "required",
        badge: "REQUIRED",
        due: "Monthly Update",
        icon: "pending_actions",
        title: "Pohang Mill 1: model correction needed",
        body: "After the nightly update, the forecast curve drifted away from the measured trend.",
        primaryAction: "Inspect simulation",
        primaryHref: "/en/emission/simulate"
      },
      {
        key: "gwangyang-report",
        tone: "verification",
        badge: "VERIFICATION",
        due: "Board Review",
        icon: "verified",
        title: "Gwangyang Center 2: yearly forecast review",
        body: "Model confidence should be checked for the year-end exceedance scenario.",
        secondaryAction: "Open integrity trace",
        secondaryHref: "/en/co2/integrity",
        primaryAction: "Open forecast report",
        primaryHref: "/en/certificate/report_form"
      },
      {
        key: "incheon-sync",
        tone: "verification",
        badge: "VERIFICATION",
        due: "API Sync",
        icon: "sync_problem",
        title: "Incheon Logistics Center: real-time sync delay",
        body: "External sync latency is slowing forecast updates and requires governance review.",
        secondaryAction: "Open governance",
        secondaryHref: "/en/co2/integrity",
        primaryAction: "Open trace report",
        primaryHref: "/en/co2/integrity"
      },
      {
        key: "executive-brief",
        tone: "required",
        badge: "REQUIRED",
        due: "17:00 Briefing",
        icon: "description",
        title: "Generate live forecast briefing package",
        body: "Collect variance signals and risk items for the analyst review session.",
        primaryAction: "Generate briefing",
        primaryHref: "/en/certificate/report_form"
      }
    ]
  }
};

function InlineStyles() {
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
        --kr-gov-radius: 10px;
      }
      body {
        font-family: "Noto Sans KR", "Public Sans", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .monitoring-dashboard-shell {
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 38%, #f8fafc 100%);
      }
      .monitoring-dashboard-hero {
        background:
          radial-gradient(circle at top right, rgba(99, 102, 241, 0.28), transparent 24%),
          linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      }
      .monitoring-dashboard-hero::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: 0.1;
        background-image:
          linear-gradient(90deg, rgba(255,255,255,0.24) 1px, transparent 1px),
          linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px);
        background-size: 42px 42px;
        pointer-events: none;
      }
      .action-feed::-webkit-scrollbar {
        width: 6px;
      }
      .action-feed::-webkit-scrollbar-track {
        background: #e2e8f0;
        border-radius: 999px;
      }
      .action-feed::-webkit-scrollbar-thumb {
        background: #94a3b8;
        border-radius: 999px;
      }
    `}</style>
  );
}

export function MonitoringRealtimeMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");

  const visibleQueue = content.queueItems.filter((item) => queueFilter === "all" || item.tone === queueFilter);
  const queueCounts = content.queueItems.reduce<Record<QueueTone, number>>(
    (accumulator, item) => {
      accumulator[item.tone] += 1;
      return accumulator;
    },
    { critical: 0, required: 0, verification: 0 }
  );
  const queueCountLabel = `${visibleQueue.length} ${content.queueCountSuffix}`;
  const navTargets = [
    buildLocalizedPath("/monitoring/dashboard", "/en/monitoring/dashboard"),
    buildLocalizedPath("/monitoring/realtime", "/en/monitoring/realtime"),
    buildLocalizedPath("/emission/validate", "/en/emission/validate"),
    buildLocalizedPath("/certificate/list", "/en/certificate/list")
  ];

  useEffect(() => {
    logGovernanceScope("PAGE", "monitoring-realtime", {
      language: en ? "en" : "ko",
      queueFilter,
      queueCount: visibleQueue.length,
      screenFamily: "home-monitoring-workspace"
    });
  }, [en, queueFilter, visibleQueue.length]);

  return (
    <>
      <InlineStyles />
      <div className="monitoring-dashboard-shell min-h-screen text-[var(--kr-gov-text-primary)]">
        <HomeLinkButton
          className="absolute left-0 top-0 z-[100] -translate-y-full !rounded-none !border-0 !bg-[var(--kr-gov-blue)] !text-white focus:!translate-y-0"
          href="#main-content"
          variant="ghost"
        >
          {content.skipToContent}
        </HomeLinkButton>
        <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.governmentStatus} />

        <header className="sticky top-0 z-50 border-b border-[var(--kr-gov-border-light)] bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex min-h-20 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <HomeButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-left hover:!bg-transparent" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button" variant="ghost">
                  <span className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>hub</span>
                    <span className="flex flex-col">
                      <span className="text-xl font-black tracking-tight text-[var(--kr-gov-text-primary)]">{content.pageTitle}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{content.pageSubtitle}</span>
                    </span>
                  </span>
                </HomeButton>
                <nav className="hidden items-center gap-1 xl:flex">
                  {content.navItems.map((item, index) => (
                    <HomeButton
                      className={index === 0 ? "!rounded-none !border-x-0 !border-t-0 !border-b-4 !border-[var(--kr-gov-blue)] !bg-transparent !px-4 !py-4 !text-[var(--kr-gov-blue)] hover:!bg-transparent" : "!rounded-none !border-x-0 !border-t-0 !border-b-4 !border-transparent !bg-transparent !px-4 !py-4 !text-slate-500 hover:!bg-transparent hover:!text-[var(--kr-gov-blue)]"}
                      key={item}
                      onClick={() => navigate(navTargets[index] ?? navTargets[0])}
                      type="button"
                      variant="ghost"
                    >
                      {item}
                    </HomeButton>
                  ))}
                </nav>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="hidden text-right md:block">
                  <p className="text-xs font-bold text-slate-500">{content.supervisorLabel}</p>
                  <p className="text-sm font-black text-slate-900">{content.supervisorName}</p>
                </div>
                <HomeButton className="relative h-10 w-10 !rounded-full !border-indigo-100 !bg-indigo-50 !p-0 hover:!bg-indigo-100" type="button" variant="secondary">
                  <span className="material-symbols-outlined text-indigo-600">auto_awesome</span>
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[8px] font-black text-white">{content.assistantCount}</span>
                </HomeButton>
                <HomeButton onClick={() => navigate(buildLocalizedPath("/admin/external/monitoring", "/en/admin/external/monitoring"))} type="button" variant="secondary">
                  {content.systemButton}
                </HomeButton>
                <UserLanguageToggle en={en} onKo={() => navigate("/monitoring/realtime")} onEn={() => navigate("/en/monitoring/realtime")} />
                {session.value?.authenticated ? (
                  <HomeButton onClick={() => void session.logout()} type="button" variant="primary">
                    {en ? "Logout" : "로그아웃"}
                  </HomeButton>
                ) : (
                  <HomeLinkButton href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")} variant="primary">
                    {en ? "Login" : "로그인"}
                  </HomeLinkButton>
                )}
              </div>
            </div>
          </div>
        </header>

        <main id="main-content">
          <section className="monitoring-dashboard-hero relative overflow-hidden" data-help-id="monitoring-dashboard-hero">
            <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-12 lg:px-8">
              <div className="grid gap-10 lg:grid-cols-[360px_minmax(0,1fr)]">
                <aside className="flex flex-col justify-between" data-help-id="monitoring-dashboard-status">
                  <div>
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-600 shadow-[0_18px_50px_rgba(79,70,229,0.35)]">
                        <span className="material-symbols-outlined text-[32px] text-white">bolt</span>
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-white">{content.heroTitle}</h2>
                        <p className="mt-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-indigo-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          {content.heroStatus}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 backdrop-blur">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-indigo-200">
                        <span className="material-symbols-outlined text-[18px]">psychology</span>
                        {content.heroBriefingTitle}
                      </h3>
                      <p className="text-sm leading-7 text-slate-300">{content.heroBriefingBody}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-600/20 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-300">{content.heroPrimaryMetricLabel}</p>
                      <p className="mt-1 text-2xl font-black text-white">{content.heroPrimaryMetricValue}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-600/20 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">{content.heroSecondaryMetricLabel}</p>
                      <p className="mt-1 text-2xl font-black text-white">{content.heroSecondaryMetricValue}</p>
                    </div>
                  </div>
                </aside>

                <section data-help-id="monitoring-dashboard-summary">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                      <span className="material-symbols-outlined text-[18px] text-indigo-300">list_alt</span>
                      {content.queueTitle}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded bg-slate-800 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">{queueCountLabel}</span>
                      <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {content.queueFilteredLabel}: {queueFilter === "all" ? (en ? "All" : "전체") : content.queueFilterOptions.find((option) => option.value === queueFilter)?.label}
                      </span>
                      <div className="min-w-[132px]">
                        <AdminSelect aria-label={content.queueFilterLabel} value={queueFilter} onChange={(event) => setQueueFilter(event.target.value as QueueFilter)}>
                          {content.queueFilterOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </AdminSelect>
                      </div>
                    </div>
                  </div>

                  <div className="action-feed max-h-[480px] space-y-4 overflow-y-auto pr-2 md:pr-4">
                    {visibleQueue.map((item) => (
                      <article className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.14)] ${QUEUE_CARD_CLASSNAME[item.tone]}`} key={item.key}>
                        <div className="flex flex-col gap-5 md:flex-row md:items-center">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${QUEUE_ICON_CLASSNAME[item.tone]}`}>
                            <span className="material-symbols-outlined">{item.icon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${QUEUE_BADGE_CLASSNAME[item.tone]}`}>{item.badge}</span>
                              <span className="text-xs font-bold text-slate-400">{item.due}</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-900">{item.title}</h3>
                            <p className="mt-2 text-sm text-slate-500">{item.body}</p>
                          </div>
                          <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
                            {item.collaborators ? (
                              <div className="mb-1 flex -space-x-2">
                                {item.collaborators.map((collaborator, index, collaborators) => (
                                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[8px] font-black ${index === collaborators.length - 1 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"}`} key={`${item.key}-${collaborator}`}>
                                    {collaborator}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="flex w-full flex-col gap-2 md:w-auto">
                              {item.secondaryAction && item.secondaryHref ? (
                                <HomeButton className="w-full md:w-auto" onClick={() => navigate(item.secondaryHref!)} type="button" variant="secondary">
                                  {item.secondaryAction}
                                </HomeButton>
                              ) : null}
                              <HomeButton className="w-full md:w-auto" onClick={() => navigate(item.primaryHref)} type="button" variant="primary">
                                {item.primaryAction}
                              </HomeButton>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-300">{content.queueSummaryTitle}</p>
                      <p className="text-[11px] text-slate-400">{en ? "Based on the current queue" : "현재 큐 기준 요약"}</p>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {content.queueSummaryItems.map((summaryItem) => (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3" key={summaryItem.key}>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{summaryItem.label}</p>
                          <p className="mt-1 text-2xl font-black text-white">{queueCounts[summaryItem.key]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8">
            <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]" data-help-id="monitoring-dashboard-workflow">
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">{content.workflowTitle}</h2>
                    <p className="mt-2 max-w-[720px] text-sm leading-7 text-slate-500">{content.workflowBody}</p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">
                    Workflow
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {content.workflowSteps.map((step) => (
                    <div className={`rounded-2xl border p-5 ${step.active ? "border-indigo-200 bg-indigo-600 text-white shadow-[0_16px_30px_rgba(79,70,229,0.2)]" : "border-slate-200 bg-slate-50 text-slate-800"}`} key={step.key}>
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full text-sm font-black ${step.active ? "bg-white text-indigo-600" : "bg-white text-slate-500"}`}>
                        {step.label}
                      </div>
                      <h3 className="text-base font-black">{step.title}</h3>
                      <p className={`mt-2 text-sm leading-6 ${step.active ? "text-indigo-100" : "text-slate-500"}`}>{step.body}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[28px] bg-slate-950 p-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]" data-help-id="monitoring-dashboard-board">
                <h2 className="text-2xl font-black">{content.timelineTitle}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">{content.timelineBody}</p>
                <div className="mt-8 space-y-5">
                  {content.timelineItems.map((item) => (
                    <div className="flex gap-4" key={item.key}>
                      <div className="flex w-16 shrink-0 items-start justify-center">
                        <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-black text-indigo-200">{item.label}</span>
                      </div>
                      <div className="relative flex-1 border-l border-slate-700 pl-5">
                        <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-400" />
                        <h3 className="font-black text-white">{item.title}</h3>
                        <p className="mt-1 text-sm text-slate-300">{item.body}</p>
                        <HomeButton className="mt-3 !border-slate-700 !bg-transparent !text-indigo-200 hover:!bg-slate-900" onClick={() => navigate(item.href)} type="button" variant="ghost">
                          {en ? "Open linked screen" : "연결 화면 열기"}
                        </HomeButton>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section className="border-y border-slate-100 bg-white" data-help-id="monitoring-dashboard-guidance">
            <div className="mx-auto max-w-[1440px] px-4 py-14 lg:px-8">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-950">{content.guidanceTitle}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">{content.guidanceBody}</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-3" data-help-id="monitoring-dashboard-queue">
                {content.guidanceCards.map((card) => (
                  <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)]" key={card.key}>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                        <span className="material-symbols-outlined">{card.icon}</span>
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{card.eyebrow}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900">{card.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-500">{card.body}</p>
                    <div className="mt-5 rounded-2xl bg-white px-4 py-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{card.metricLabel}</p>
                      <p className="mt-1 text-2xl font-black text-indigo-700">{card.metricValue}</p>
                    </div>
                    <HomeButton className="mt-5 w-full" onClick={() => navigate(card.href)} type="button" variant="primary">
                      {card.action}
                    </HomeButton>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>

        <UserPortalFooter
          addressLine={content.footerAddress}
          copyright={content.footerCopyright}
          footerLinks={content.footerLinks}
          lastModifiedLabel={content.footerLastModified}
          orgName={content.footerOrg}
          serviceLine={content.footerServiceLine}
          waAlt={content.footerWaAlt}
        />
      </div>
    </>
  );
}
