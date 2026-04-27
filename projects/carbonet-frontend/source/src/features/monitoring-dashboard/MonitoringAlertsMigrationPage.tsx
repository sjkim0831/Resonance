import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeLinkButton } from "../home-ui/common";
import { AdminSelect } from "../member/common";

type AlertTone = "critical" | "warning" | "watch";
type AlertFilter = "all" | AlertTone;
type AlertStatus = "new" | "investigating" | "mitigating" | "stable";

type AlertItem = {
  key: string;
  tone: AlertTone;
  badge: string;
  site: string;
  detectedAt: string;
  status: AlertStatus;
  title: string;
  body: string;
  owner: string;
  impact: string;
  primaryAction: string;
  primaryHref: string;
  secondaryAction?: string;
  secondaryHref?: string;
};

type CoverageCard = {
  key: string;
  region: string;
  title: string;
  metric: string;
  description: string;
  toneClassName: string;
};

type ResponseStep = {
  key: string;
  label: string;
  title: string;
  body: string;
};

type QuickLink = {
  key: string;
  icon: string;
  title: string;
  body: string;
  action: string;
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
  heroBody: string;
  heroPrimaryMetricLabel: string;
  heroPrimaryMetricValue: string;
  heroSecondaryMetricLabel: string;
  heroSecondaryMetricValue: string;
  summaryTitle: string;
  summaryBody: string;
  filterLabel: string;
  filterVisibleLabel: string;
  filterOptions: Array<{ value: AlertFilter; label: string }>;
  statusLabels: Record<AlertStatus, string>;
  statusLegendTitle: string;
  statusLegend: Array<{ key: AlertStatus; label: string }>;
  matrixTitle: string;
  matrixBody: string;
  responseTitle: string;
  responseBody: string;
  responseSteps: ResponseStep[];
  coverageTitle: string;
  coverageBody: string;
  coverageCards: CoverageCard[];
  quickLinksTitle: string;
  quickLinksBody: string;
  quickLinks: QuickLink[];
  guidanceTitle: string;
  guidanceItems: string[];
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerLinks: string[];
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
  alerts: AlertItem[];
};

const TONE_CARD_CLASSNAME: Record<AlertTone, string> = {
  critical: "border-l-red-500",
  warning: "border-l-amber-500",
  watch: "border-l-sky-500"
};

const TONE_BADGE_CLASSNAME: Record<AlertTone, string> = {
  critical: "bg-red-500 text-white",
  warning: "bg-amber-500 text-slate-950",
  watch: "bg-sky-500 text-white"
};

const TONE_ICON_CLASSNAME: Record<AlertTone, string> = {
  critical: "bg-red-100 text-red-600",
  warning: "bg-amber-100 text-amber-700",
  watch: "bg-sky-100 text-sky-700"
};

const STATUS_CLASSNAME: Record<AlertStatus, string> = {
  new: "bg-red-50 text-red-700 border-red-100",
  investigating: "bg-amber-50 text-amber-700 border-amber-100",
  mitigating: "bg-sky-50 text-sky-700 border-sky-100",
  stable: "bg-emerald-50 text-emerald-700 border-emerald-100"
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    governmentText: "대한민국 정부 공식 서비스 | CCUS 경보 관제 허브",
    governmentStatus: "경보 스트림 동기화: 2분 전",
    pageTitle: "경보 현황",
    pageSubtitle: "Alert Operations Board",
    navItems: ["통합 대시보드", "실시간 모니터링", "경보 현황", "성과 추이 분석"],
    supervisorLabel: "운영 관제 책임자",
    supervisorName: "박모니터 책임님",
    assistantCount: "6",
    systemButton: "운영 콘솔",
    skipToContent: "본문 바로가기",
    heroTitle: "Critical Alert Command Board",
    heroStatus: "Operational escalation live",
    heroBody: "선택 reference의 경보 현황 의도를 현재 홈 포털 구조에 맞게 재구성했습니다. 사업장별 경보 우선순위, 대응 단계, 연계 후속 화면을 한 보드에서 이어서 처리할 수 있습니다.",
    heroPrimaryMetricLabel: "활성 경보",
    heroPrimaryMetricValue: "12",
    heroSecondaryMetricLabel: "즉시 조치",
    heroSecondaryMetricValue: "04",
    summaryTitle: "우선 대응 경보 큐",
    summaryBody: "신규, 조사 중, 완화 조치, 안정화 상태를 한 번에 비교하면서 경보별 소유자와 영향 범위를 바로 확인합니다.",
    filterLabel: "경보 등급",
    filterVisibleLabel: "표시 중",
    filterOptions: [
      { value: "all", label: "전체" },
      { value: "critical", label: "Critical" },
      { value: "warning", label: "Warning" },
      { value: "watch", label: "Watch" }
    ],
    statusLabels: {
      new: "신규",
      investigating: "조사 중",
      mitigating: "완화 조치",
      stable: "안정화"
    },
    statusLegendTitle: "상태 범례",
    statusLegend: [
      { key: "new", label: "신규 감지" },
      { key: "investigating", label: "원인 분석" },
      { key: "mitigating", label: "조치 실행" },
      { key: "stable", label: "관찰 유지" }
    ],
    matrixTitle: "경보 대응 매트릭스",
    matrixBody: "가장 먼저 막아야 할 경보부터 조사 중인 항목, 안정화 후 관찰 중인 항목까지 같은 형식으로 정렬했습니다.",
    responseTitle: "즉시 대응 런북",
    responseBody: "reference 화면에서 기대되는 대응 흐름을 현재 Carbonet 모니터링 체계에 맞춰 4단계로 정리했습니다.",
    responseSteps: [
      { key: "detect", label: "01", title: "이상 감지", body: "사업장, 센서, 연계 이벤트에서 치명 징후를 선별합니다." },
      { key: "triage", label: "02", title: "영향 판정", body: "배출량, 운영 연속성, 보고 일정에 미치는 영향을 우선 판정합니다." },
      { key: "respond", label: "03", title: "조치 실행", body: "현장 담당자 호출, 입력값 수정, 외부 연계 점검을 동시에 진행합니다." },
      { key: "verify", label: "04", title: "안정화 확인", body: "경보 해제 후에도 30분 관찰 규칙과 후속 보고서 반영 여부를 확인합니다." }
    ],
    coverageTitle: "권역별 경보 커버리지",
    coverageBody: "주요 권역의 누적 경보와 즉시 대응 부담도를 카드로 정리했습니다.",
    coverageCards: [
      { key: "ulsan", region: "동남권", title: "울산 산업 클러스터", metric: "4 Active", description: "전력 계수 보정과 센서 편차 경보가 집중된 권역", toneClassName: "from-red-500/15 to-red-50 text-red-700" },
      { key: "pohang", region: "동해권", title: "포항 제철 라인", metric: "3 Tracking", description: "에너지 입력 확정과 API 지연 이슈를 추적 중", toneClassName: "from-amber-500/15 to-amber-50 text-amber-700" },
      { key: "gwangyang", region: "남해권", title: "광양 에너지 센터", metric: "2 Stable", description: "안정화 이후 검증 관찰 단계로 전환된 상태", toneClassName: "from-sky-500/15 to-sky-50 text-sky-700" }
    ],
    quickLinksTitle: "연결 작업 보드",
    quickLinksBody: "경보를 확인한 뒤 바로 이어질 후속 화면을 현재 앱 구조에 맞춰 묶었습니다.",
    quickLinks: [
      { key: "realtime", icon: "monitoring", title: "실시간 모니터링", body: "센서 편차와 현장 상태를 바로 열어 원인 후보를 좁힙니다.", action: "실시간 현황 열기", href: "/monitoring/realtime" },
      { key: "track", icon: "share", title: "추적 리포트", body: "연계 경로와 무결성 상태를 따라가며 경보 원인을 추적합니다.", action: "추적 리포트 열기", href: "/monitoring/track" },
      { key: "validate", icon: "task_alt", title: "산정 검증", body: "경보가 보고 일정에 주는 영향을 검증 워크플로우로 넘깁니다.", action: "검증 흐름 열기", href: "/emission/validate" }
    ],
    guidanceTitle: "운영 가이드",
    guidanceItems: [
      "Critical 경보는 15분 내 1차 판정과 담당자 호출을 완료해야 합니다.",
      "완화 조치 상태로 이동한 경보는 추적 리포트 또는 외부 연계 모니터링 증적이 필요합니다.",
      "안정화 상태는 자동 종료하지 않고 다음 보고 주기 전까지 관찰 큐에 남겨 둡니다."
    ],
    footerOrg: "CCUS 통합관제본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110",
    footerServiceLine: "경보 관제실 02-1234-5678",
    footerLinks: ["개인정보처리방침", "운영 가이드", "경보 기준", "문의하기"],
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Alert Operations Board.",
    footerLastModified: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크",
    alerts: [
      {
        key: "ulsan-factor",
        tone: "critical",
        badge: "CRITICAL",
        site: "울산 제3 화학기지",
        detectedAt: "09:12",
        status: "new",
        title: "배출계수 재산정 편차가 허용 범위를 초과했습니다.",
        body: "전력 사용 증빙 2건 누락으로 산정값과 예측값 차이가 8.4%까지 확대되었습니다.",
        owner: "현장 운영팀",
        impact: "주간 검증 일정 지연 위험",
        primaryAction: "검증 흐름 시작",
        primaryHref: "/emission/validate",
        secondaryAction: "추적 리포트",
        secondaryHref: "/monitoring/track"
      },
      {
        key: "pohang-sensor",
        tone: "warning",
        badge: "WARNING",
        site: "포항 제1 열연공장",
        detectedAt: "08:45",
        status: "investigating",
        title: "센서 입력값과 제출 데이터 사이에 반복 편차가 감지되었습니다.",
        body: "야간 배치 이후 전력 사용량 센서가 실제 입력 대비 3회 연속 높은 값을 전송했습니다.",
        owner: "데이터 분석팀",
        impact: "월간 집계 재검토 필요",
        primaryAction: "실시간 화면 열기",
        primaryHref: "/monitoring/realtime"
      },
      {
        key: "gwangyang-api",
        tone: "watch",
        badge: "WATCH",
        site: "광양 제2 에너지센터",
        detectedAt: "07:58",
        status: "mitigating",
        title: "외부 연계 응답 지연이 완화 조치 단계에 있습니다.",
        body: "재시도 설정 변경 후 평균 응답 시간이 정상 범위로 회복 중이며 30분 추가 관찰이 필요합니다.",
        owner: "연계 운영팀",
        impact: "대외 보고 전 재확인 필요",
        primaryAction: "운영 콘솔 열기",
        primaryHref: "/admin/external/monitoring",
        secondaryAction: "연계 추적",
        secondaryHref: "/co2/integrity"
      },
      {
        key: "incheon-backlog",
        tone: "critical",
        badge: "CRITICAL",
        site: "인천 물류센터",
        detectedAt: "06:34",
        status: "mitigating",
        title: "야간 적재 데이터 적체로 경보 해제 조건을 아직 충족하지 못했습니다.",
        body: "적체 건수는 감소했지만 보고서 생성 배치가 아직 지연 상태여서 추가 처리 확인이 필요합니다.",
        owner: "배치 운영팀",
        impact: "오전 브리핑 지표 반영 지연",
        primaryAction: "보고서 화면 열기",
        primaryHref: "/certificate/report_form"
      }
    ]
  },
  en: {
    governmentText: "Republic of Korea Official Service | CCUS Alert Operations Hub",
    governmentStatus: "Alert stream synced 2 minutes ago",
    pageTitle: "Alert Status",
    pageSubtitle: "Alert Operations Board",
    navItems: ["Integrated Dashboard", "Real-time Monitoring", "Alert Status", "Trend Analysis"],
    supervisorLabel: "Operations Lead",
    supervisorName: "Lead Park",
    assistantCount: "6",
    systemButton: "Ops Console",
    skipToContent: "Skip to content",
    heroTitle: "Critical Alert Command Board",
    heroStatus: "Operational escalation live",
    heroBody: "The reference alert-status intent was rebuilt for the current home portal. Site priorities, response stages, and follow-up screens now connect within one board.",
    heroPrimaryMetricLabel: "Active alerts",
    heroPrimaryMetricValue: "12",
    heroSecondaryMetricLabel: "Act now",
    heroSecondaryMetricValue: "04",
    summaryTitle: "Priority alert queue",
    summaryBody: "Compare new, investigating, mitigating, and stable alerts while reviewing ownership and impact without leaving the board.",
    filterLabel: "Severity",
    filterVisibleLabel: "Visible now",
    filterOptions: [
      { value: "all", label: "All" },
      { value: "critical", label: "Critical" },
      { value: "warning", label: "Warning" },
      { value: "watch", label: "Watch" }
    ],
    statusLabels: {
      new: "New",
      investigating: "Investigating",
      mitigating: "Mitigating",
      stable: "Stable"
    },
    statusLegendTitle: "Status legend",
    statusLegend: [
      { key: "new", label: "Newly detected" },
      { key: "investigating", label: "Root-cause review" },
      { key: "mitigating", label: "Mitigation in progress" },
      { key: "stable", label: "Observation only" }
    ],
    matrixTitle: "Alert response matrix",
    matrixBody: "The board keeps the highest-priority alerts, investigation work, and post-recovery observation items in one consistent layout.",
    responseTitle: "Immediate response runbook",
    responseBody: "The expected response flow from the reference screen was translated into the current Carbonet monitoring structure.",
    responseSteps: [
      { key: "detect", label: "01", title: "Detect anomaly", body: "Identify the highest-risk signals across sites, sensors, and linked events." },
      { key: "triage", label: "02", title: "Assess impact", body: "Prioritize emission, operational continuity, and reporting impact." },
      { key: "respond", label: "03", title: "Execute action", body: "Call site owners, adjust inputs, and inspect external integrations in parallel." },
      { key: "verify", label: "04", title: "Verify stabilization", body: "Keep alerts under a 30-minute observation rule after mitigation before closure." }
    ],
    coverageTitle: "Regional alert coverage",
    coverageBody: "The main operating regions are summarized as cards with cumulative alert burden.",
    coverageCards: [
      { key: "ulsan", region: "South-East", title: "Ulsan industrial cluster", metric: "4 Active", description: "Emission-factor and sensor-drift alerts are concentrated here.", toneClassName: "from-red-500/15 to-red-50 text-red-700" },
      { key: "pohang", region: "East Coast", title: "Pohang steel line", metric: "3 Tracking", description: "Energy finalization and API latency issues are under review.", toneClassName: "from-amber-500/15 to-amber-50 text-amber-700" },
      { key: "gwangyang", region: "South Coast", title: "Gwangyang energy center", metric: "2 Stable", description: "Recovered alerts remain in monitored observation status.", toneClassName: "from-sky-500/15 to-sky-50 text-sky-700" }
    ],
    quickLinksTitle: "Linked action board",
    quickLinksBody: "These are the main follow-up screens mapped to the current app after alert review.",
    quickLinks: [
      { key: "realtime", icon: "monitoring", title: "Real-time monitoring", body: "Open sensor drift and site health context immediately.", action: "Open live monitoring", href: "/en/monitoring/realtime" },
      { key: "track", icon: "share", title: "Trace report", body: "Follow data lineage and integrity context to isolate the alert origin.", action: "Open trace report", href: "/en/monitoring/track" },
      { key: "validate", icon: "task_alt", title: "Emission validation", body: "Move reporting-risk alerts into the validation workflow.", action: "Open validation", href: "/en/emission/validate" }
    ],
    guidanceTitle: "Operator guidance",
    guidanceItems: [
      "Critical alerts require first triage and owner contact within 15 minutes.",
      "Mitigating alerts need evidence from trace reporting or external monitoring before closure.",
      "Stable alerts remain in the observation queue until the next reporting cycle."
    ],
    footerOrg: "CCUS Integrated Operations Center",
    footerAddress: "110 Sejong-daero, Jung-gu, Seoul, Republic of Korea",
    footerServiceLine: "Alert Operations Room +82-2-1234-5678",
    footerLinks: ["Privacy Policy", "Operations Guide", "Alert Criteria", "Contact"],
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Alert Operations Board.",
    footerLastModified: "Last Modified:",
    footerWaAlt: "Web Accessibility Quality Mark",
    alerts: [
      {
        key: "ulsan-factor",
        tone: "critical",
        badge: "CRITICAL",
        site: "Ulsan Chemical Base 3",
        detectedAt: "09:12",
        status: "new",
        title: "Emission-factor recalculation drift exceeded the allowed threshold.",
        body: "Two missing electricity evidence documents expanded the gap between reported and forecast values to 8.4%.",
        owner: "Field Operations",
        impact: "Weekly validation schedule at risk",
        primaryAction: "Start validation",
        primaryHref: "/en/emission/validate",
        secondaryAction: "Open trace report",
        secondaryHref: "/en/monitoring/track"
      },
      {
        key: "pohang-sensor",
        tone: "warning",
        badge: "WARNING",
        site: "Pohang Mill 1",
        detectedAt: "08:45",
        status: "investigating",
        title: "Recurring drift was detected between sensor input and submitted data.",
        body: "The overnight batch sent three consecutive power readings above the confirmed entry values.",
        owner: "Data Analytics",
        impact: "Monthly aggregation requires review",
        primaryAction: "Open live view",
        primaryHref: "/en/monitoring/realtime"
      },
      {
        key: "gwangyang-api",
        tone: "watch",
        badge: "WATCH",
        site: "Gwangyang Energy Center 2",
        detectedAt: "07:58",
        status: "mitigating",
        title: "External integration latency is in mitigation status.",
        body: "Retry tuning brought response time back toward baseline, but another 30 minutes of observation is required.",
        owner: "Integration Ops",
        impact: "Recheck required before external reporting",
        primaryAction: "Open ops console",
        primaryHref: "/en/admin/external/monitoring",
        secondaryAction: "Open integrity trace",
        secondaryHref: "/en/co2/integrity"
      },
      {
        key: "incheon-backlog",
        tone: "critical",
        badge: "CRITICAL",
        site: "Incheon Logistics Center",
        detectedAt: "06:34",
        status: "mitigating",
        title: "Nightly backlog still has not met the alert-clear condition.",
        body: "The queue is shrinking, but the report-generation batch remains delayed and needs another confirmation pass.",
        owner: "Batch Operations",
        impact: "Morning briefing metrics may be delayed",
        primaryAction: "Open report screen",
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
      }
      body {
        font-family: "Noto Sans KR", "Public Sans", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .monitoring-alerts-shell {
        background:
          radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 30%),
          linear-gradient(180deg, #f8fafc 0%, #ffffff 38%, #eff6ff 100%);
      }
      .monitoring-alerts-hero {
        background:
          radial-gradient(circle at top right, rgba(239, 68, 68, 0.32), transparent 22%),
          radial-gradient(circle at 20% 20%, rgba(251, 191, 36, 0.22), transparent 28%),
          linear-gradient(135deg, #111827 0%, #0f172a 56%, #172554 100%);
      }
    `}</style>
  );
}

export function MonitoringAlertsMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");

  const visibleAlerts = useMemo(
    () => content.alerts.filter((item) => alertFilter === "all" || item.tone === alertFilter),
    [alertFilter, content.alerts]
  );
  const navTargets = [
    buildLocalizedPath("/monitoring/dashboard", "/en/monitoring/dashboard"),
    buildLocalizedPath("/monitoring/realtime", "/en/monitoring/realtime"),
    buildLocalizedPath("/monitoring/alerts", "/en/monitoring/alerts"),
    buildLocalizedPath("/monitoring/reduction_trend", "/en/monitoring/reduction_trend")
  ];

  useEffect(() => {
    logGovernanceScope("PAGE", "monitoring-alerts", {
      language: en ? "en" : "ko",
      alertFilter,
      alertCount: visibleAlerts.length,
      screenFamily: "home-monitoring-alert-workspace"
    });
  }, [alertFilter, en, visibleAlerts.length]);

  return (
    <>
      <InlineStyles />
      <div className="monitoring-alerts-shell min-h-screen text-[var(--kr-gov-text-primary)]">
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
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-[0_18px_45px_rgba(239,68,68,0.28)]">
                      <span className="material-symbols-outlined text-[28px]">warning</span>
                    </span>
                    <span className="flex flex-col">
                      <span className="text-xl font-black tracking-tight text-[var(--kr-gov-text-primary)]">{content.pageTitle}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{content.pageSubtitle}</span>
                    </span>
                  </span>
                </HomeButton>
                <nav className="hidden items-center gap-1 xl:flex">
                  {content.navItems.map((item, index) => (
                    <HomeButton
                      className={index === 2 ? "!rounded-none !border-x-0 !border-t-0 !border-b-4 !border-red-500 !bg-transparent !px-4 !py-4 !text-red-600 hover:!bg-transparent" : "!rounded-none !border-x-0 !border-t-0 !border-b-4 !border-transparent !bg-transparent !px-4 !py-4 !text-slate-500 hover:!bg-transparent hover:!text-[var(--kr-gov-blue)]"}
                      key={item}
                      onClick={() => navigate(navTargets[index] ?? navTargets[2])}
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
                <HomeButton className="relative h-10 w-10 !rounded-full !border-red-100 !bg-red-50 !p-0 hover:!bg-red-100" type="button" variant="secondary">
                  <span className="material-symbols-outlined text-red-600">notifications_active</span>
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[8px] font-black text-white">{content.assistantCount}</span>
                </HomeButton>
                <HomeButton onClick={() => navigate(buildLocalizedPath("/admin/external/monitoring", "/en/admin/external/monitoring"))} type="button" variant="secondary">
                  {content.systemButton}
                </HomeButton>
                <UserLanguageToggle en={en} onKo={() => navigate("/monitoring/alerts")} onEn={() => navigate("/en/monitoring/alerts")} />
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
          <section className="monitoring-alerts-hero relative overflow-hidden" data-help-id="monitoring-alerts-hero">
            <div className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8">
              <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
                <aside className="space-y-5">
                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-red-200">{content.heroStatus}</p>
                    <h1 className="mt-3 text-3xl font-black text-white">{content.heroTitle}</h1>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{content.heroBody}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3" data-help-id="monitoring-alerts-status">
                    <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-200">{content.heroPrimaryMetricLabel}</p>
                      <p className="mt-2 text-3xl font-black text-white">{content.heroPrimaryMetricValue}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">{content.heroSecondaryMetricLabel}</p>
                      <p className="mt-2 text-3xl font-black text-white">{content.heroSecondaryMetricValue}</p>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/30 p-5" data-help-id="monitoring-alerts-workflow">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-300">{content.statusLegendTitle}</p>
                    <div className="mt-4 grid gap-3">
                      {content.statusLegend.map((item) => (
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3" key={item.key}>
                          <span className="text-sm font-bold text-white">{item.label}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${STATUS_CLASSNAME[item.key]}`}>{content.statusLabels[item.key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>

                <section data-help-id="monitoring-alerts-summary">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-white">{content.summaryTitle}</h2>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{content.summaryBody}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-200">
                        {content.filterVisibleLabel}: {visibleAlerts.length}
                      </span>
                      <div className="min-w-[148px]">
                        <AdminSelect aria-label={content.filterLabel} value={alertFilter} onChange={(event) => setAlertFilter(event.target.value as AlertFilter)}>
                          {content.filterOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </AdminSelect>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {visibleAlerts.map((alert) => (
                      <article className={`rounded-[26px] border border-white/10 border-l-4 bg-white p-6 shadow-[0_24px_55px_rgba(15,23,42,0.2)] ${TONE_CARD_CLASSNAME[alert.tone]}`} key={alert.key}>
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${TONE_ICON_CLASSNAME[alert.tone]}`}>
                            <span className="material-symbols-outlined">notifications_active</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${TONE_BADGE_CLASSNAME[alert.tone]}`}>{alert.badge}</span>
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${STATUS_CLASSNAME[alert.status]}`}>{content.statusLabels[alert.status]}</span>
                              <span className="text-xs font-bold text-slate-400">{alert.site}</span>
                              <span className="text-xs text-slate-300">{alert.detectedAt}</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-900">{alert.title}</h3>
                            <p className="mt-2 text-sm leading-7 text-slate-500">{alert.body}</p>
                            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Owner" : "담당"}</dt>
                                <dd className="mt-1 font-bold text-slate-900">{alert.owner}</dd>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{en ? "Impact" : "영향"}</dt>
                                <dd className="mt-1 font-bold text-slate-900">{alert.impact}</dd>
                              </div>
                            </dl>
                          </div>
                          <div className="flex w-full flex-col gap-2 xl:w-auto">
                            {alert.secondaryAction && alert.secondaryHref ? (
                              <HomeButton className="w-full xl:w-auto" onClick={() => navigate(alert.secondaryHref!)} type="button" variant="secondary">
                                {alert.secondaryAction}
                              </HomeButton>
                            ) : null}
                            <HomeButton className="w-full xl:w-auto !border-red-600 !bg-red-600 hover:!bg-red-700" onClick={() => navigate(alert.primaryHref)} type="button" variant="primary">
                              {alert.primaryAction}
                            </HomeButton>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </section>

          <section className="border-b border-slate-200 bg-white" data-help-id="monitoring-alerts-matrix">
            <div className="mx-auto max-w-[1440px] px-4 py-14 lg:px-8">
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                <article className="rounded-[28px] border border-slate-200 bg-slate-50 p-8">
                  <h2 className="text-2xl font-black text-slate-950">{content.matrixTitle}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{content.matrixBody}</p>
                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    {content.responseSteps.map((step, index) => (
                      <div className={`rounded-[24px] border p-5 ${index === 1 ? "border-red-200 bg-white shadow-[0_18px_40px_rgba(239,68,68,0.12)]" : "border-slate-200 bg-white"}`} key={step.key}>
                        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black ${index === 1 ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700"}`}>{step.label}</span>
                        <h3 className="mt-4 text-lg font-black text-slate-900">{step.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-500">{step.body}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-[28px] bg-slate-950 p-8 text-white" data-help-id="monitoring-alerts-runbook">
                  <h2 className="text-2xl font-black">{content.responseTitle}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{content.responseBody}</p>
                  <div className="mt-8 space-y-5">
                    {content.guidanceItems.map((item, index) => (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4" key={item}>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-200">{index + 1 < 10 ? `0${index + 1}` : index + 1}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-200">{item}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section className="bg-white" data-help-id="monitoring-alerts-coverage">
            <div className="mx-auto max-w-[1440px] px-4 py-14 lg:px-8">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-950">{content.coverageTitle}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">{content.coverageBody}</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                {content.coverageCards.map((card) => (
                  <article className={`rounded-[26px] border border-slate-200 bg-gradient-to-br p-6 shadow-[0_16px_35px_rgba(15,23,42,0.08)] ${card.toneClassName}`} key={card.key}>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em]">{card.region}</p>
                    <h3 className="mt-3 text-xl font-black text-slate-950">{card.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
                    <p className="mt-6 text-3xl font-black">{card.metric}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 bg-slate-50" data-help-id="monitoring-alerts-links">
            <div className="mx-auto max-w-[1440px] px-4 py-14 lg:px-8">
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{content.quickLinksTitle}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{content.quickLinksBody}</p>
                  <div className="mt-8 grid gap-5 md:grid-cols-3">
                    {content.quickLinks.map((link) => (
                      <article className="rounded-[24px] border border-slate-200 bg-white p-6" key={link.key}>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--kr-gov-blue)] text-white">
                          <span className="material-symbols-outlined">{link.icon}</span>
                        </div>
                        <h3 className="mt-4 text-lg font-black text-slate-900">{link.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-500">{link.body}</p>
                        <HomeButton className="mt-5 w-full" onClick={() => navigate(link.href)} type="button" variant="primary">
                          {link.action}
                        </HomeButton>
                      </article>
                    ))}
                  </div>
                </div>

                <aside className="rounded-[28px] border border-slate-200 bg-white p-8" data-help-id="monitoring-alerts-guidance">
                  <h2 className="text-2xl font-black text-slate-950">{content.guidanceTitle}</h2>
                  <div className="mt-6 space-y-4">
                    {content.guidanceItems.map((item) => (
                      <div className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-4" key={item}>
                        <span className="material-symbols-outlined mt-0.5 text-red-500">priority_high</span>
                        <p className="text-sm leading-7 text-slate-600">{item}</p>
                      </div>
                    ))}
                  </div>
                </aside>
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
