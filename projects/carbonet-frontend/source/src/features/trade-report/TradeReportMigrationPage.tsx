import { useEffect, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminInput, AdminSelect, MemberButton, PageStatusNotice } from "../member/common";

type PriorityTone = "critical" | "warning" | "info" | "success";

type AuditTask = {
  key: string;
  priority: string;
  deadline: string;
  title: string;
  description: string;
  cta: string;
  tone: PriorityTone;
};

type ReportRow = {
  key: string;
  title: string;
  owner: string;
  scope: string;
  updatedAt: string;
  status: string;
  statusClassName: string;
  deadlineType: string;
};

type FocusAccount = {
  key: string;
  name: string;
  accountId: string;
  market: string;
  riskScore: string;
  exposure: string;
  issue: string;
  toneClassName: string;
};

type SidebarSignal = {
  key: string;
  title: string;
  detail: string;
  icon: string;
};

type ReportTheme = {
  pageTitle: string;
  pageSubtitle: string;
  heroTitle: string;
  heroBody: string;
  taskLead: string;
  taskLeadHighlight: string;
  taskLeadTail: string;
  taskButton: string;
  taskSection: string;
  homeLabel: string;
  sectionLabel: string;
  currentLabel: string;
  roleLabel: string;
  roleName: string;
  navItems: string[];
  searchPlaceholder: string;
  registerLabel: string;
  metricLabel: string;
  metricValue: string;
  metricHint: string;
  accountsTitle: string;
  accountsBody: string;
  reportsTitle: string;
  reportsBody: string;
  watchTitle: string;
  watchBody: string;
  emptyAccounts: string;
  emptyReports: string;
  accountKeywordLabel: string;
  reportStatusLabel: string;
  deadlineLabel: string;
  tableHeaders: string[];
  tasks: AuditTask[];
  metrics: Array<{ label: string; value: string; hint: string; accentClassName: string; }>;
  accounts: FocusAccount[];
  reports: ReportRow[];
  watchSignals: SidebarSignal[];
  reportStatuses: string[];
  deadlines: string[];
};

const TASK_TONE_CLASSNAME: Record<PriorityTone, string> = {
  critical: "border-l-red-500 bg-red-500/10 text-red-200",
  warning: "border-l-amber-400 bg-amber-400/10 text-amber-100",
  info: "border-l-blue-400 bg-blue-400/10 text-blue-100",
  success: "border-l-emerald-400 bg-emerald-400/10 text-emerald-100"
};

const CONTENT: Record<"ko" | "en", ReportTheme> = {
  ko: {
    pageTitle: "거래 리포트 허브",
    pageSubtitle: "Trade Compliance Reports",
    heroTitle: "자동 컴플라이언스 체크",
    heroBody: "엔진이 거래 데이터를 실시간 분석해 리포트 우선순위와 감사 대상을 재정렬했습니다. 제출 기한, 이상 징후, 시장 건전성 초안을 한 화면에서 검토합니다.",
    taskLead: "실시간 검증 엔진이",
    taskLeadHighlight: "5개의 우선 감사 과업",
    taskLeadTail: "을 식별했습니다.",
    taskButton: "전체 감사 워크플로우",
    taskSection: "우선순위 감사 과업",
    homeLabel: "홈",
    sectionLabel: "거래",
    currentLabel: "거래 리포트",
    roleLabel: "수석 감사인",
    roleName: "김금융 감사관님",
    navItems: ["거래 목록", "거래 시장", "거래 리포트", "체결 현황"],
    searchPlaceholder: "계좌 번호, 법인명, 거래 식별자(TXID) 또는 감사 코드를 입력하세요.",
    registerLabel: "신규 감사 대상 등록",
    metricLabel: "감사 상태",
    metricValue: "정상",
    metricHint: "자동 검증 엔진 가동 중",
    accountsTitle: "중점 감사 계좌",
    accountsBody: "투명성과 책임성 확보를 위해 상시 추적하는 계좌와 기관입니다.",
    reportsTitle: "리포트 제출 및 검토 큐",
    reportsBody: "기한과 상태별로 현재 제출해야 할 리포트만 추렸습니다.",
    watchTitle: "시장 펄스 및 감시 포인트",
    watchBody: "규제 공시, 변동성 급등, 사후 감사 이슈를 우선 확인합니다.",
    emptyAccounts: "현재 조건에 맞는 감사 계좌가 없습니다.",
    emptyReports: "현재 조건에 맞는 리포트가 없습니다.",
    accountKeywordLabel: "계좌/기관 검색",
    reportStatusLabel: "리포트 상태",
    deadlineLabel: "마감 기준",
    tableHeaders: ["리포트", "담당 조직", "대상 범위", "최근 업데이트", "상태", "기한"],
    tasks: [
      {
        key: "task-1",
        priority: "HIGH RISK",
        deadline: "URGENT",
        title: "골드만-A 이상 거래 감지",
        description: "단기 내 비정상적 고액 이체 패턴이 발생해 자금 출처 확인이 필요합니다.",
        cta: "거래 증빙 문서 확인",
        tone: "critical"
      },
      {
        key: "task-2",
        priority: "VERIFY",
        deadline: "D-1",
        title: "JP-K KYC 갱신 누락",
        description: "법인 주주 명부 갱신 기한이 지나 최신 등기부 대조가 필요합니다.",
        cta: "KYC 양식 열기",
        tone: "warning"
      },
      {
        key: "task-3",
        priority: "REPORTING",
        deadline: "D-3",
        title: "분기 시장 건전성 리포트",
        description: "Q3 시장 유동성 분석 초안이 승인 대기 중이며 감사 코멘트 반영이 남았습니다.",
        cta: "리포트 초안 확인",
        tone: "info"
      },
      {
        key: "task-4",
        priority: "MONITOR",
        deadline: "LIVE",
        title: "신규 상장주 가격 변동",
        description: "A-Tech 종목이 장 초반 변동성 임계치에 도달해 실시간 모니터링이 필요합니다.",
        cta: "실시간 호가 로그",
        tone: "success"
      }
    ],
    metrics: [
      { label: "제출 대기 리포트", value: "12", hint: "이번 주 마감 기준", accentClassName: "text-blue-700" },
      { label: "즉시 감사 대상", value: "5", hint: "우선 순위 상위", accentClassName: "text-red-600" },
      { label: "정상 모니터링 계좌", value: "28", hint: "고정 추적 중", accentClassName: "text-emerald-600" },
      { label: "보류 중 공시 건", value: "3", hint: "추가 소명 요청", accentClassName: "text-amber-600" }
    ],
    accounts: [
      { key: "acct-1", name: "골드만-A", accountId: "AUD-8841", market: "주식/파생", riskScore: "92", exposure: "₩ 184억", issue: "대량 이체 패턴 감지", toneClassName: "bg-red-50 border-red-100 text-red-700" },
      { key: "acct-2", name: "JP-K 법인 계정", accountId: "KYC-2109", market: "채권", riskScore: "74", exposure: "₩ 96억", issue: "KYC 갱신 지연", toneClassName: "bg-amber-50 border-amber-100 text-amber-700" },
      { key: "acct-3", name: "A-Tech 상장 준비", accountId: "MON-6612", market: "IPO", riskScore: "68", exposure: "₩ 52억", issue: "변동성 임계치 도달", toneClassName: "bg-blue-50 border-blue-100 text-blue-700" },
      { key: "acct-4", name: "에코브릿지 CCUS", accountId: "REP-3108", market: "탄소 크레딧", riskScore: "57", exposure: "₩ 41억", issue: "분기 리포트 보완 필요", toneClassName: "bg-emerald-50 border-emerald-100 text-emerald-700" }
    ],
    reports: [
      { key: "report-1", title: "Q3 시장 건전성 리포트", owner: "시장감시실", scope: "거래소 전체", updatedAt: "2026-04-02 09:40", status: "승인 대기", statusClassName: "bg-blue-50 text-blue-700", deadlineType: "D-3" },
      { key: "report-2", title: "이상거래 특별 점검서", owner: "금융범죄 대응팀", scope: "골드만-A", updatedAt: "2026-04-02 08:15", status: "즉시 검토", statusClassName: "bg-red-50 text-red-700", deadlineType: "URGENT" },
      { key: "report-3", title: "KYC 갱신 누락 점검표", owner: "고객실사팀", scope: "JP-K 법인", updatedAt: "2026-04-01 18:20", status: "자료 보완", statusClassName: "bg-amber-50 text-amber-700", deadlineType: "D-1" },
      { key: "report-4", title: "신규 상장주 변동성 브리프", owner: "시장분석실", scope: "A-Tech", updatedAt: "2026-04-02 10:05", status: "실시간 모니터링", statusClassName: "bg-emerald-50 text-emerald-700", deadlineType: "LIVE" }
    ],
    watchSignals: [
      { key: "signal-1", title: "EU 공시 후속 발표", detail: "산업재 섹터 거래량이 장 마감 직전 다시 확대될 가능성이 있습니다.", icon: "policy" },
      { key: "signal-2", title: "고위험 계좌 연쇄 조회", detail: "동일 IP와 담당자가 복수 계좌를 연속 조회해 접근 패턴을 추가 추적 중입니다.", icon: "shield" },
      { key: "signal-3", title: "시장 유동성 초안 재검토", detail: "유동성 편중 지표가 기준선을 상회해 리포트 초안 보정이 필요합니다.", icon: "monitoring" }
    ],
    reportStatuses: ["전체", "승인 대기", "즉시 검토", "자료 보완", "실시간 모니터링"],
    deadlines: ["전체", "URGENT", "D-1", "D-3", "LIVE"]
  },
  en: {
    pageTitle: "Trade Report Hub",
    pageSubtitle: "Trade Compliance Reports",
    heroTitle: "Automated Compliance Check",
    heroBody: "The engine re-ranked report priorities and audit targets in real time. Submission deadlines, anomaly signals, and market integrity drafts are reviewed from one workspace.",
    taskLead: "The live validation engine identified",
    taskLeadHighlight: "five priority audit tasks",
    taskLeadTail: "for immediate review.",
    taskButton: "Open Audit Workflow",
    taskSection: "Prioritized Audit Tasks",
    homeLabel: "Home",
    sectionLabel: "Trade",
    currentLabel: "Trade Reports",
    roleLabel: "Lead Auditor",
    roleName: "Geumyung Kim",
    navItems: ["Trade List", "Trade Market", "Trade Reports", "Settlement View"],
    searchPlaceholder: "Search account, institution, TXID, or audit code.",
    registerLabel: "Register Audit Target",
    metricLabel: "Audit status",
    metricValue: "Normal",
    metricHint: "Automated engine active",
    accountsTitle: "Focus Audit Accounts",
    accountsBody: "These institutions and accounts stay under persistent review for transparency and accountability.",
    reportsTitle: "Report Submission And Review Queue",
    reportsBody: "Only the reports requiring action by deadline and status are shown here.",
    watchTitle: "Market Pulse And Watch Signals",
    watchBody: "Start with regulatory notices, volatility spikes, and post-audit issues.",
    emptyAccounts: "No audit accounts matched the current filters.",
    emptyReports: "No reports matched the current filters.",
    accountKeywordLabel: "Account or institution",
    reportStatusLabel: "Report status",
    deadlineLabel: "Deadline",
    tableHeaders: ["Report", "Owner", "Scope", "Last update", "Status", "Deadline"],
    tasks: [
      {
        key: "task-1",
        priority: "HIGH RISK",
        deadline: "URGENT",
        title: "Goldman-A anomaly trade alert",
        description: "A short-window high-value transfer pattern requires immediate source-of-funds verification.",
        cta: "Review supporting trade files",
        tone: "critical"
      },
      {
        key: "task-2",
        priority: "VERIFY",
        deadline: "D-1",
        title: "JP-K missed KYC renewal",
        description: "The shareholder register renewal deadline passed and needs latest registry verification.",
        cta: "Open KYC form",
        tone: "warning"
      },
      {
        key: "task-3",
        priority: "REPORTING",
        deadline: "D-3",
        title: "Quarterly market integrity report",
        description: "The Q3 liquidity review draft is waiting for audit comments before approval.",
        cta: "Open draft report",
        tone: "info"
      },
      {
        key: "task-4",
        priority: "MONITOR",
        deadline: "LIVE",
        title: "New listing volatility alert",
        description: "A-Tech reached the opening volatility threshold and now requires continuous monitoring.",
        cta: "Open live quote log",
        tone: "success"
      }
    ],
    metrics: [
      { label: "Reports due", value: "12", hint: "Closing this week", accentClassName: "text-blue-700" },
      { label: "Immediate audits", value: "5", hint: "Highest priority", accentClassName: "text-red-600" },
      { label: "Tracked accounts", value: "28", hint: "Persistent monitoring", accentClassName: "text-emerald-600" },
      { label: "Held disclosures", value: "3", hint: "Additional explanation requested", accentClassName: "text-amber-600" }
    ],
    accounts: [
      { key: "acct-1", name: "Goldman-A", accountId: "AUD-8841", market: "Equity / Derivatives", riskScore: "92", exposure: "KRW 18.4B", issue: "Large transfer pattern flagged", toneClassName: "bg-red-50 border-red-100 text-red-700" },
      { key: "acct-2", name: "JP-K Corporate", accountId: "KYC-2109", market: "Fixed Income", riskScore: "74", exposure: "KRW 9.6B", issue: "KYC renewal delayed", toneClassName: "bg-amber-50 border-amber-100 text-amber-700" },
      { key: "acct-3", name: "A-Tech Listing", accountId: "MON-6612", market: "IPO", riskScore: "68", exposure: "KRW 5.2B", issue: "Volatility threshold hit", toneClassName: "bg-blue-50 border-blue-100 text-blue-700" },
      { key: "acct-4", name: "EcoBridge CCUS", accountId: "REP-3108", market: "Carbon Credit", riskScore: "57", exposure: "KRW 4.1B", issue: "Quarterly report needs revision", toneClassName: "bg-emerald-50 border-emerald-100 text-emerald-700" }
    ],
    reports: [
      { key: "report-1", title: "Q3 market integrity report", owner: "Market Surveillance", scope: "Exchange-wide", updatedAt: "2026-04-02 09:40", status: "Pending approval", statusClassName: "bg-blue-50 text-blue-700", deadlineType: "D-3" },
      { key: "report-2", title: "Anomaly trade special review", owner: "Financial Crime Desk", scope: "Goldman-A", updatedAt: "2026-04-02 08:15", status: "Immediate review", statusClassName: "bg-red-50 text-red-700", deadlineType: "URGENT" },
      { key: "report-3", title: "KYC renewal exception sheet", owner: "Client Due Diligence", scope: "JP-K Corporate", updatedAt: "2026-04-01 18:20", status: "Needs evidence", statusClassName: "bg-amber-50 text-amber-700", deadlineType: "D-1" },
      { key: "report-4", title: "New listing volatility brief", owner: "Market Analytics", scope: "A-Tech", updatedAt: "2026-04-02 10:05", status: "Live monitoring", statusClassName: "bg-emerald-50 text-emerald-700", deadlineType: "LIVE" }
    ],
    watchSignals: [
      { key: "signal-1", title: "EU follow-up disclosure", detail: "Industrial trading volume may widen again before market close.", icon: "policy" },
      { key: "signal-2", title: "Linked high-risk access pattern", detail: "The same IP and auditor reviewed multiple flagged accounts in sequence.", icon: "shield" },
      { key: "signal-3", title: "Liquidity draft recalibration", detail: "Concentration metrics moved above baseline and the draft needs adjustment.", icon: "monitoring" }
    ],
    reportStatuses: ["All", "Pending approval", "Immediate review", "Needs evidence", "Live monitoring"],
    deadlines: ["All", "URGENT", "D-1", "D-3", "LIVE"]
  }
};

function InlineStyles() {
  return (
    <style>{`
      :root {
        --kr-audit-primary: #0f172a;
        --kr-audit-accent: #2563eb;
        --kr-audit-accent-soft: #dbeafe;
        --kr-audit-border: #d9e2ec;
        --kr-audit-text: #0f172a;
        --kr-audit-muted: #64748b;
        --kr-audit-radius: 10px;
      }
      body {
        font-family: 'Noto Sans KR', 'Public Sans', sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        z-index: 100;
        padding: 12px;
        background: var(--kr-audit-accent);
        color: white;
        transition: top .2s ease;
      }
      .skip-link:focus {
        top: 0;
      }
      .audit-hero::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
        background-size: 40px 40px;
        opacity: 0.5;
        pointer-events: none;
      }
    `}</style>
  );
}

export function TradeReportMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [keyword, setKeyword] = useState("");
  const [reportStatus, setReportStatus] = useState(content.reportStatuses[0] ?? "");
  const [deadline, setDeadline] = useState(content.deadlines[0] ?? "");

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredAccounts = content.accounts.filter((account) => {
    if (!normalizedKeyword) {
      return true;
    }
    return `${account.name} ${account.accountId} ${account.issue}`.toLowerCase().includes(normalizedKeyword);
  });
  const filteredReports = content.reports.filter((report) => {
    const keywordMatched = !normalizedKeyword || `${report.title} ${report.owner} ${report.scope}`.toLowerCase().includes(normalizedKeyword);
    const statusMatched = reportStatus === content.reportStatuses[0] || report.status === reportStatus;
    const deadlineMatched = deadline === content.deadlines[0] || report.deadlineType === deadline;
    return keywordMatched && statusMatched && deadlineMatched;
  });

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-report", {
      language: en ? "en" : "ko",
      keyword,
      reportStatus,
      deadline,
      visibleAccounts: filteredAccounts.length,
      visibleReports: filteredReports.length
    });
  }, [deadline, en, filteredAccounts.length, filteredReports.length, keyword, reportStatus]);

  return (
    <>
      <InlineStyles />
      <div className="min-h-screen bg-slate-100 text-[var(--kr-audit-text)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Financial compliance trade reporting portal" : "대한민국 정부 공식 서비스 | 금융 거래 리포트 포털"}
        />

        <header className="sticky top-0 z-40 border-b border-[var(--kr-audit-border)] bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex min-h-20 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-3 bg-transparent p-0 text-left" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
                  <span className="material-symbols-outlined text-[36px] font-black text-[var(--kr-audit-accent)]">account_balance</span>
                  <div>
                    <h1 className="text-xl font-black leading-tight">{content.pageTitle}</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--kr-audit-muted)]">{content.pageSubtitle}</p>
                  </div>
                </button>
                <nav className="hidden xl:flex items-center gap-1">
                  {content.navItems.map((item, index) => {
                    const href = index === 0
                      ? buildLocalizedPath("/trade/list", "/en/trade/list")
                      : index === 1
                        ? buildLocalizedPath("/trade/market", "/en/trade/market")
                        : index === 2
                          ? buildLocalizedPath("/trade/report", "/en/trade/report")
                          : buildLocalizedPath("/trade/complete", "/en/trade/complete");
                    const active = index === 2;
                    return (
                      <a
                        className={active
                          ? "border-b-4 border-[var(--kr-audit-accent)] px-4 py-6 text-[15px] font-bold text-[var(--kr-audit-accent)]"
                          : "px-4 py-6 text-[15px] font-bold text-slate-500 transition hover:text-[var(--kr-audit-accent)]"}
                        href={href}
                        key={item}
                      >
                        {item}
                      </a>
                    );
                  })}
                </nav>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="hidden text-right md:block">
                  <p className="text-xs font-bold text-[var(--kr-audit-muted)]">{content.roleLabel}</p>
                  <p className="text-sm font-black">{content.roleName}</p>
                </div>
                <div className="rounded-full border border-blue-100 bg-[var(--kr-audit-accent-soft)] px-4 py-2 text-xs font-bold text-[var(--kr-audit-accent)]">
                  {content.metricHint}: {content.metricValue}
                </div>
                <UserLanguageToggle en={en} onKo={() => navigate("/trade/report")} onEn={() => navigate("/en/trade/report")} />
                {session.value?.authenticated ? (
                  <MemberButton onClick={() => void session.logout()} size="md" variant="primary">{en ? "Logout" : "로그아웃"}</MemberButton>
                ) : (
                  <a className="inline-flex items-center justify-center rounded-[var(--kr-audit-radius)] border border-[var(--kr-audit-accent)] px-4 py-2 text-sm font-bold text-[var(--kr-audit-accent)]" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                    {en ? "Login" : "로그인"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        <main id="main-content">
          <section className="audit-hero relative overflow-hidden bg-slate-950 py-12" data-help-id="trade-report-hero">
            <div className="relative z-10 mx-auto max-w-[1440px] px-4 lg:px-8">
              <div className="grid gap-10 xl:grid-cols-[300px_minmax(0,1fr)]">
                <div>
                  <nav aria-label="Breadcrumb" className="mb-4 flex text-sm text-slate-400">
                    <ol className="flex items-center gap-2">
                      <li><a className="hover:text-white" href={buildLocalizedPath("/home", "/en/home")}>{content.homeLabel}</a></li>
                      <li><span className="material-symbols-outlined text-base">chevron_right</span></li>
                      <li>{content.sectionLabel}</li>
                      <li><span className="material-symbols-outlined text-base">chevron_right</span></li>
                      <li className="font-bold text-white">{content.currentLabel}</li>
                    </ol>
                  </nav>
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-950/30">
                      <span className="material-symbols-outlined text-[28px]">shield_with_heart</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white">{content.heroTitle}</h2>
                      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-300">{content.metricHint}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-slate-300">{content.heroBody}</p>
                  <p className="mt-6 text-sm leading-7 text-slate-400">
                    {content.taskLead} <strong className="text-white">{content.taskLeadHighlight}</strong> {content.taskLeadTail}
                  </p>
                  <div className="mt-8">
                    <MemberButton className="w-full justify-center" size="lg" variant="primary">{content.taskButton}</MemberButton>
                  </div>
                </div>

                <div>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">{content.taskSection}</p>
                      <h3 className="mt-2 text-lg font-black text-white">{content.currentLabel}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="trade-report-tasks">
                    {content.tasks.map((task) => (
                      <article className="rounded-r-[22px] border border-white/10 border-l-4 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition hover:-translate-y-1 hover:bg-white/10" key={task.key}>
                        <div className={`rounded-[20px] ${TASK_TONE_CLASSNAME[task.tone]}`}>
                          <div className="flex items-start justify-between gap-3 p-5">
                            <div>
                              <span className="inline-flex rounded px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] bg-white/10">{task.priority}</span>
                              <h4 className="mt-4 text-sm font-bold text-white">{task.title}</h4>
                              <p className="mt-2 text-[12px] leading-5 text-slate-300">{task.description}</p>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{task.deadline}</span>
                          </div>
                        </div>
                        <a className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-blue-300 hover:text-blue-200" href="#trade-report-table">
                          {task.cta}
                          <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </a>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-10 mx-auto -mt-8 max-w-[1440px] px-4 lg:px-8" data-help-id="trade-report-search">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_220px_220px_220px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-audit-muted)]">{content.accountKeywordLabel}</span>
                  <AdminInput placeholder={content.searchPlaceholder} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-audit-muted)]">{content.reportStatusLabel}</span>
                  <AdminSelect value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}>
                    {content.reportStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                  </AdminSelect>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-audit-muted)]">{content.deadlineLabel}</span>
                  <AdminSelect value={deadline} onChange={(event) => setDeadline(event.target.value)}>
                    {content.deadlines.map((item) => <option key={item} value={item}>{item}</option>)}
                  </AdminSelect>
                </label>
                <div className="flex items-end">
                  <MemberButton className="w-full justify-center" size="lg" variant="primary">{content.registerLabel}</MemberButton>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1440px] px-4 py-10 lg:px-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {content.metrics.map((metric) => (
                <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm" key={metric.label}>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{metric.label}</p>
                  <p className={`mt-3 text-3xl font-black ${metric.accentClassName}`}>{metric.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{metric.hint}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
              <div className="space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]" data-help-id="trade-report-accounts">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--kr-audit-accent)]">{content.accountsTitle}</p>
                      <h3 className="mt-2 text-xl font-black text-slate-950">{content.accountsTitle}</h3>
                      <p className="mt-2 text-sm text-slate-500">{content.accountsBody}</p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
                      {filteredAccounts.length}
                    </div>
                  </div>
                  {filteredAccounts.length === 0 ? (
                    <PageStatusNotice className="mt-6" tone="warning">{content.emptyAccounts}</PageStatusNotice>
                  ) : (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {filteredAccounts.map((account) => (
                        <article className="rounded-[22px] border border-slate-200 p-5" key={account.key}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-black text-slate-950">{account.name}</p>
                              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{account.accountId}</p>
                            </div>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${account.toneClassName}`}>{account.issue}</span>
                          </div>
                          <div className="mt-5 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{en ? "Market" : "시장"}</p>
                              <p className="mt-2 text-sm font-bold text-slate-700">{account.market}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{en ? "Risk" : "위험도"}</p>
                              <p className="mt-2 text-sm font-bold text-slate-700">{account.riskScore}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{en ? "Exposure" : "익스포저"}</p>
                              <p className="mt-2 text-sm font-bold text-slate-700">{account.exposure}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]" data-help-id="trade-report-table" id="trade-report-table">
                  <div className="border-b border-slate-100 px-6 py-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--kr-audit-accent)]">{content.reportsTitle}</p>
                    <h3 className="mt-2 text-xl font-black text-slate-950">{content.reportsTitle}</h3>
                    <p className="mt-2 text-sm text-slate-500">{content.reportsBody}</p>
                  </div>
                  {filteredReports.length === 0 ? (
                    <PageStatusNotice className="m-6" tone="warning">{content.emptyReports}</PageStatusNotice>
                  ) : (
                    <div className="overflow-x-auto px-6 pb-6 pt-4">
                      <table className="min-w-[860px] w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            {content.tableHeaders.map((header) => (
                              <th className="px-3 py-4 first:pl-0 last:pr-0" key={header}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredReports.map((report) => (
                            <tr className="transition hover:bg-slate-50/70" key={report.key}>
                              <td className="px-3 py-4 first:pl-0">
                                <div className="font-bold text-slate-950">{report.title}</div>
                              </td>
                              <td className="px-3 py-4 text-slate-600">{report.owner}</td>
                              <td className="px-3 py-4 text-slate-600">{report.scope}</td>
                              <td className="px-3 py-4 text-slate-600">{report.updatedAt}</td>
                              <td className="px-3 py-4">
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${report.statusClassName}`}>{report.status}</span>
                              </td>
                              <td className="px-3 py-4 pr-0 font-bold text-slate-900">{report.deadlineType}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-6" data-help-id="trade-report-watch">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--kr-audit-accent)]">visibility</span>
                    <h3 className="text-lg font-black text-slate-950">{content.watchTitle}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{content.watchBody}</p>
                  <div className="mt-5 space-y-3">
                    {content.watchSignals.map((signal) => (
                      <article className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4" key={signal.key}>
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-[var(--kr-audit-accent)]">{signal.icon}</span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{signal.title}</h4>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{signal.detail}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-300">assignment</span>
                    <h3 className="text-lg font-black">{en ? "Escalation Timeline" : "에스컬레이션 타임라인"}</h3>
                  </div>
                  <div className="mt-5 space-y-4">
                    {content.tasks.slice(0, 3).map((task) => (
                      <article className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4" key={`timeline-${task.key}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{task.title}</p>
                            <p className="mt-1 text-xs text-slate-300">{task.description}</p>
                          </div>
                          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">{task.deadline}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </section>
        </main>

        <UserPortalFooter
          addressLine={en ? "Government Complex Sejong, Republic of Korea" : "세종특별자치시 정부청사로 370"}
          copyright="Copyright 2026. Carbonet. All rights reserved."
          footerLinks={en ? ["Sitemap", "Privacy Policy", "Terms of Use"] : ["사이트맵", "개인정보처리방침", "이용약관"]}
          lastModifiedLabel={en ? "Updated" : "최종 수정"}
          orgName={en ? "Carbonet Service" : "Carbonet 서비스"}
          serviceLine={en ? "Financial compliance reporting workspace" : "금융 컴플라이언스 리포트 워크스페이스"}
          waAlt={en ? "Web accessibility mark" : "웹 접근성 품질마크"}
        />
      </div>
    </>
  );
}
