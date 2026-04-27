import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter, UserPortalHeader } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeInput } from "../home-ui/common";

type NavItem = {
  label: string;
  href: string;
  current?: boolean;
};

type AlertCard = {
  key: string;
  badge: string;
  badgeClassName: string;
  due: string;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  icon: string;
  accentClassName: string;
};

type AccountAction = {
  label: string;
  href: string;
  icon: string;
  toneClassName: string;
};

type LedgerRow = {
  label: string;
  at: string;
  value: string;
  valueClassName: string;
};

type ManagedAccount = {
  key: string;
  badge: string;
  badgeClassName: string;
  bank: string;
  title: string;
  number: string;
  balance: string;
  balanceToneClassName: string;
  note?: string;
  accentClassName: string;
  ringClassName?: string;
  actions: AccountAction[];
  ledger: LedgerRow[];
};

type SiteCard = {
  key: string;
  siteId: string;
  title: string;
  balance: string;
  status: string;
  statusClassName: string;
  actionLabel: string;
  actionHref: string;
  actionClassName: string;
};

type ReportMetric = {
  key: string;
  title: string;
  value: string;
  unit?: string;
  accentClassName?: string;
  note?: string;
  progressLabel?: string;
  progressWidth?: string;
  bars?: Array<{ label: string; value: string; heightClassName: string; barClassName: string }>;
  detailRows?: Array<{ label: string; value: string }>;
  badge?: string;
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
  heroLabel: string;
  heroBody: string;
  heroAction: string;
  urgentTitle: string;
  searchPlaceholder: string;
  requestAccountButton: string;
  managedTitle: string;
  managedBody: string;
  settingsLabel: string;
  otherSitesTitle: string;
  otherSitesMeta: string;
  reportTitle: string;
  reportBody: string;
  reportUpdated: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
  footerLinks: string[];
  logout: string;
  copiedLabel: string;
  connectLabel: string;
  alerts: AlertCard[];
  managedAccounts: ManagedAccount[];
  siteCards: SiteCard[];
  reportMetrics: ReportMetric[];
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "환불 계좌 운영",
    pageSubtitle: "REFUND ACCOUNT OPERATIONS HUB",
    governmentText: "대한민국 정부 공식 서비스 | 환불 계좌 및 가상계좌 운영 허브",
    governmentStatus: "금융 데이터 최종 갱신: 2026.04.02 16:20",
    navItems: [
      { label: "결제 요청", href: "/payment/pay" },
      { label: "결제 내역", href: "/payment/history" },
      { label: "결제 환불", href: "/payment/refund" },
      { label: "환불 계좌", href: "/payment/refund_account", current: true }
    ],
    roleLabel: "총괄 사이트 감독관",
    roleName: "이현장 관리자",
    heroTitle: "결제 및 가상계좌 통합 허브",
    heroLabel: "Action Required",
    heroBody: "reference의 결제 및 가상계좌 통합 허브를 `/payment/refund_account` 대상 앱 구조에 맞춰 React로 재구성했습니다. 환불 계좌 검증, 계좌 잔액, 미납 위험, 후속 결제 액션을 한 화면에서 관리합니다.",
    heroAction: "전체 결제 대기 목록",
    urgentTitle: "긴급 결제 및 기한 안내",
    searchPlaceholder: "가상계좌 번호, 사이트 명칭, 또는 입금자명을 검색하세요",
    requestAccountButton: "가상계좌 발급 요청",
    managedTitle: "관리 가상계좌 현황",
    managedBody: "각 사이트별 가상계좌 정보와 실시간 잔액을 투명하게 확인하십시오.",
    settingsLabel: "계좌 설정 관리",
    otherSitesTitle: "기타 사이트 결제 현황",
    otherSitesMeta: "총 12개소",
    reportTitle: "통합 자금 운영 리포트",
    reportBody: "관리 중인 모든 사이트의 결제 현황 및 가상계좌 총액 분석입니다.",
    reportUpdated: "최종 정산 업데이트: 2026.04.02 15:45",
    footerOrg: "CCUS 통합금융관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110",
    footerServiceLine: "결제 및 정산 지원팀 02-9876-5432",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Dedicated Site Overseer Financial Portal.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크",
    footerLinks: ["전자금융거래약관", "개인정보처리방침", "결제 매뉴얼 다운로드"],
    logout: "로그아웃",
    copiedLabel: "계좌번호가 복사되었습니다.",
    connectLabel: "신규 계좌 연동",
    alerts: [
      {
        key: "ulsan-overdue",
        badge: "OVERDUE",
        badgeClassName: "bg-red-500/20 text-red-300",
        due: "경과: 5일",
        title: "울산 제3: 8월 정산분 미납",
        body: "연체 가산금이 발생 중입니다. 즉시 납부가 필요합니다.",
        actionLabel: "즉시 결제하기",
        actionHref: "/payment/history",
        icon: "arrow_forward",
        accentClassName: "border-l-red-500"
      },
      {
        key: "pohang-upcoming",
        badge: "UPCOMING",
        badgeClassName: "bg-orange-500/20 text-orange-300",
        due: "D-3",
        title: "포항 제1: 검증 수수료",
        body: "3단계 현장 검증 수수료 납기일이 3일 남았습니다.",
        actionLabel: "납부 정보 확인",
        actionHref: "/payment/receipt",
        icon: "info",
        accentClassName: "border-l-orange-500"
      },
      {
        key: "gwangyang-recurring",
        badge: "RECURRING",
        badgeClassName: "bg-blue-500/20 text-blue-300",
        due: "D-15",
        title: "광양 제2: 유지보수 정기결제",
        body: "가상계좌 잔액 확인 및 정기 이체 준비가 필요합니다.",
        actionLabel: "잔액 충전",
        actionHref: "/payment/pay",
        icon: "account_balance_wallet",
        accentClassName: "border-l-blue-500"
      }
    ],
    managedAccounts: [
      {
        key: "pohang",
        badge: "정상 계좌",
        badgeClassName: "border border-emerald-200 bg-emerald-100 text-emerald-700",
        bank: "기업은행",
        title: "포항 제1 열연공장",
        number: "120-10452-99-001",
        balance: "12,450,000",
        balanceToneClassName: "text-[var(--kr-gov-blue)]",
        accentClassName: "border-t-[var(--kr-gov-blue)]",
        actions: [
          { label: "납부 실행", href: "/payment/history", icon: "payments", toneClassName: "hover:bg-blue-600 hover:text-white" },
          { label: "명세서 출력", href: "/payment/receipt", icon: "description", toneClassName: "hover:bg-blue-600 hover:text-white" }
        ],
        ledger: [
          { label: "검증 수수료 정산", at: "2026.04.02 10:22", value: "- 2,500,000원", valueClassName: "text-red-500" },
          { label: "관리비 이체", at: "2026.03.29 15:45", value: "+ 5,000,000원", valueClassName: "text-blue-500" }
        ]
      },
      {
        key: "ulsan",
        badge: "납부 지연",
        badgeClassName: "border border-red-200 bg-red-100 text-red-700",
        bank: "우리은행",
        title: "울산 제3 화학기지",
        number: "333-02142-12-042",
        balance: "150,000",
        balanceToneClassName: "text-red-600",
        note: "※ 미납액(8,200,000원) 대비 잔액이 부족합니다.",
        accentClassName: "border-t-red-500",
        ringClassName: "ring-2 ring-red-500/20",
        actions: [
          { label: "가상계좌 충전", href: "/payment/pay", icon: "account_balance_wallet", toneClassName: "bg-red-600 text-white hover:bg-red-700" },
          { label: "납부 이력", href: "/payment/history", icon: "history", toneClassName: "hover:bg-red-600 hover:text-white" }
        ],
        ledger: [
          { label: "연체 가산금 부과", at: "3시간 전", value: "- 45,000원", valueClassName: "text-red-500" },
          { label: "관리 시스템 사용료", at: "2026.04.01", value: "- 8,155,000원", valueClassName: "text-red-500" }
        ]
      },
      {
        key: "gwangyang",
        badge: "기한 임박",
        badgeClassName: "border border-orange-200 bg-orange-100 text-orange-700",
        bank: "신한은행",
        title: "광양 제2 에너지센터",
        number: "110-882-942112",
        balance: "48,920,000",
        balanceToneClassName: "text-orange-600",
        accentClassName: "border-t-orange-400",
        actions: [
          { label: "납부 공문 발송", href: "/payment/receipt", icon: "forward_to_inbox", toneClassName: "hover:bg-orange-600 hover:text-white" },
          { label: "청구서 조회", href: "/payment/history", icon: "receipt", toneClassName: "hover:bg-orange-600 hover:text-white" }
        ],
        ledger: [
          { label: "보고서 검토비 정산", at: "2일 전", value: "- 1,200,000원", valueClassName: "text-red-500" },
          { label: "예치금 입금", at: "2026.03.24", value: "+ 50,000,000원", valueClassName: "text-blue-500" }
        ]
      }
    ],
    siteCards: [
      { key: "incheon", siteId: "IC-005", title: "인천 물류센터", balance: "2,452,000원", status: "완납", statusClassName: "text-emerald-600", actionLabel: "내역 상세", actionHref: "/payment/history", actionClassName: "border-gray-200 text-gray-600 hover:bg-gray-50" },
      { key: "daejeon", siteId: "DJ-021", title: "대전 R&D 캠퍼스", balance: "120,000원", status: "결제대기", statusClassName: "text-orange-600", actionLabel: "즉시 결제", actionHref: "/payment/pay", actionClassName: "border-orange-200 text-orange-600 hover:bg-orange-50" },
      { key: "paju", siteId: "PJ-088", title: "파주 전산센터", balance: "5,890,000원", status: "완납", statusClassName: "text-emerald-600", actionLabel: "내역 상세", actionHref: "/payment/history", actionClassName: "border-gray-200 text-gray-600 hover:bg-gray-50" }
    ],
    reportMetrics: [
      {
        key: "balance",
        title: "총 관리 자금 잔액",
        value: "345,120,000",
        unit: "KRW",
        accentClassName: "text-[var(--kr-gov-blue)]",
        note: "▲ 12.2% (전월대비)",
        progressLabel: "이달 집행 예정액 (120,000,000원)",
        progressWidth: "34.7%"
      },
      {
        key: "distribution",
        title: "결제 상태별 분포",
        value: "",
        bars: [
          { label: "결제완료", value: "15", heightClassName: "h-[88%]", barClassName: "bg-emerald-500" },
          { label: "청구됨", value: "4", heightClassName: "h-[62%]", barClassName: "bg-orange-400" },
          { label: "미납/연체", value: "1", heightClassName: "h-[44%]", barClassName: "bg-red-400" },
          { label: "대기중", value: "2", heightClassName: "h-[38%]", barClassName: "bg-gray-300" }
        ]
      },
      {
        key: "compliance",
        title: "정산 신뢰도 및 준수율",
        value: "94%",
        detailRows: [
          { label: "기한 내 결제", value: "18건" },
          { label: "누적 연체", value: "1건" }
        ],
        badge: "우수 자금 관리 사업장"
      }
    ]
  },
  en: {
    pageTitle: "Refund Account Operations",
    pageSubtitle: "REFUND ACCOUNT OPERATIONS HUB",
    governmentText: "Republic of Korea Official Service | Refund Account and Virtual Account Operations Hub",
    governmentStatus: "Finance data updated: 2026.04.02 16:20",
    navItems: [
      { label: "Payment Request", href: "/payment/pay" },
      { label: "Payment History", href: "/payment/history" },
      { label: "Payment Refund", href: "/payment/refund" },
      { label: "Refund Account", href: "/payment/refund_account", current: true }
    ],
    roleLabel: "Lead Site Supervisor",
    roleName: "Manager Lee Hyeon-jang",
    heroTitle: "Payment and Virtual Account Integrated Hub",
    heroLabel: "Action Required",
    heroBody: "The reference payment and virtual account hub has been rebuilt for the `/payment/refund_account` flow. Operators can review refund-account readiness, account balances, overdue risks, and follow-up payment actions from one workspace.",
    heroAction: "All Payment Backlog",
    urgentTitle: "Urgent Payments and Deadlines",
    searchPlaceholder: "Search virtual account number, site, or depositor",
    requestAccountButton: "Request Virtual Account",
    managedTitle: "Managed Virtual Accounts",
    managedBody: "Review each site's virtual-account details and real-time balance transparently.",
    settingsLabel: "Account Settings",
    otherSitesTitle: "Other Site Payment Status",
    otherSitesMeta: "12 sites",
    reportTitle: "Integrated Funds Operations Report",
    reportBody: "Analysis of payment status and virtual-account totals across every managed site.",
    reportUpdated: "Settlement refresh: 2026.04.02 15:45",
    footerOrg: "CCUS Integrated Finance Office",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea",
    footerServiceLine: "Payments and Settlements Desk +82-2-9876-5432",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Dedicated Site Overseer Financial Portal.",
    footerLastModifiedLabel: "Last Modified:",
    footerWaAlt: "Web Accessibility Quality Mark",
    footerLinks: ["Electronic Finance Terms", "Privacy Policy", "Payment Manual Download"],
    logout: "Logout",
    copiedLabel: "Account number copied.",
    connectLabel: "Connect New Account",
    alerts: [
      {
        key: "ulsan-overdue",
        badge: "OVERDUE",
        badgeClassName: "bg-red-500/20 text-red-300",
        due: "5 days overdue",
        title: "Ulsan Plant 3: August settlement unpaid",
        body: "Late-payment surcharge is already accruing. Immediate payment is required.",
        actionLabel: "Pay Now",
        actionHref: "/payment/history",
        icon: "arrow_forward",
        accentClassName: "border-l-red-500"
      },
      {
        key: "pohang-upcoming",
        badge: "UPCOMING",
        badgeClassName: "bg-orange-500/20 text-orange-300",
        due: "D-3",
        title: "Pohang Line 1: Verification fee",
        body: "Three days remain before the stage-three field verification fee is due.",
        actionLabel: "Review Billing",
        actionHref: "/payment/receipt",
        icon: "info",
        accentClassName: "border-l-orange-500"
      },
      {
        key: "gwangyang-recurring",
        badge: "RECURRING",
        badgeClassName: "bg-blue-500/20 text-blue-300",
        due: "D-15",
        title: "Gwangyang Energy Center 2: Recurring maintenance payment",
        body: "Balance inspection and recurring transfer preparation are required.",
        actionLabel: "Top Up Balance",
        actionHref: "/payment/pay",
        icon: "account_balance_wallet",
        accentClassName: "border-l-blue-500"
      }
    ],
    managedAccounts: [
      {
        key: "pohang",
        badge: "Healthy",
        badgeClassName: "border border-emerald-200 bg-emerald-100 text-emerald-700",
        bank: "IBK",
        title: "Pohang Hot Strip Mill 1",
        number: "120-10452-99-001",
        balance: "12,450,000",
        balanceToneClassName: "text-[var(--kr-gov-blue)]",
        accentClassName: "border-t-[var(--kr-gov-blue)]",
        actions: [
          { label: "Run Payment", href: "/payment/history", icon: "payments", toneClassName: "hover:bg-blue-600 hover:text-white" },
          { label: "Print Statement", href: "/payment/receipt", icon: "description", toneClassName: "hover:bg-blue-600 hover:text-white" }
        ],
        ledger: [
          { label: "Verification fee settlement", at: "2026.04.02 10:22", value: "- KRW 2,500,000", valueClassName: "text-red-500" },
          { label: "Operations transfer", at: "2026.03.29 15:45", value: "+ KRW 5,000,000", valueClassName: "text-blue-500" }
        ]
      },
      {
        key: "ulsan",
        badge: "Delayed",
        badgeClassName: "border border-red-200 bg-red-100 text-red-700",
        bank: "Woori Bank",
        title: "Ulsan Chemical Base 3",
        number: "333-02142-12-042",
        balance: "150,000",
        balanceToneClassName: "text-red-600",
        note: "Balance is below the unpaid amount (KRW 8,200,000).",
        accentClassName: "border-t-red-500",
        ringClassName: "ring-2 ring-red-500/20",
        actions: [
          { label: "Top Up Virtual Account", href: "/payment/pay", icon: "account_balance_wallet", toneClassName: "bg-red-600 text-white hover:bg-red-700" },
          { label: "Payment History", href: "/payment/history", icon: "history", toneClassName: "hover:bg-red-600 hover:text-white" }
        ],
        ledger: [
          { label: "Late-payment surcharge", at: "3 hours ago", value: "- KRW 45,000", valueClassName: "text-red-500" },
          { label: "System usage fee", at: "2026.04.01", value: "- KRW 8,155,000", valueClassName: "text-red-500" }
        ]
      },
      {
        key: "gwangyang",
        badge: "Due Soon",
        badgeClassName: "border border-orange-200 bg-orange-100 text-orange-700",
        bank: "Shinhan",
        title: "Gwangyang Energy Center 2",
        number: "110-882-942112",
        balance: "48,920,000",
        balanceToneClassName: "text-orange-600",
        accentClassName: "border-t-orange-400",
        actions: [
          { label: "Send Notice", href: "/payment/receipt", icon: "forward_to_inbox", toneClassName: "hover:bg-orange-600 hover:text-white" },
          { label: "View Invoice", href: "/payment/history", icon: "receipt", toneClassName: "hover:bg-orange-600 hover:text-white" }
        ],
        ledger: [
          { label: "Report review settlement", at: "2 days ago", value: "- KRW 1,200,000", valueClassName: "text-red-500" },
          { label: "Deposit received", at: "2026.03.24", value: "+ KRW 50,000,000", valueClassName: "text-blue-500" }
        ]
      }
    ],
    siteCards: [
      { key: "incheon", siteId: "IC-005", title: "Incheon Logistics Center", balance: "KRW 2,452,000", status: "Paid", statusClassName: "text-emerald-600", actionLabel: "View Details", actionHref: "/payment/history", actionClassName: "border-gray-200 text-gray-600 hover:bg-gray-50" },
      { key: "daejeon", siteId: "DJ-021", title: "Daejeon R&D Campus", balance: "KRW 120,000", status: "Awaiting Payment", statusClassName: "text-orange-600", actionLabel: "Pay Now", actionHref: "/payment/pay", actionClassName: "border-orange-200 text-orange-600 hover:bg-orange-50" },
      { key: "paju", siteId: "PJ-088", title: "Paju Data Center", balance: "KRW 5,890,000", status: "Paid", statusClassName: "text-emerald-600", actionLabel: "View Details", actionHref: "/payment/history", actionClassName: "border-gray-200 text-gray-600 hover:bg-gray-50" }
    ],
    reportMetrics: [
      {
        key: "balance",
        title: "Total Managed Balance",
        value: "345,120,000",
        unit: "KRW",
        accentClassName: "text-[var(--kr-gov-blue)]",
        note: "+12.2% vs previous month",
        progressLabel: "Scheduled to disburse this month (KRW 120,000,000)",
        progressWidth: "34.7%"
      },
      {
        key: "distribution",
        title: "Payment Status Distribution",
        value: "",
        bars: [
          { label: "Paid", value: "15", heightClassName: "h-[88%]", barClassName: "bg-emerald-500" },
          { label: "Billed", value: "4", heightClassName: "h-[62%]", barClassName: "bg-orange-400" },
          { label: "Overdue", value: "1", heightClassName: "h-[44%]", barClassName: "bg-red-400" },
          { label: "Pending", value: "2", heightClassName: "h-[38%]", barClassName: "bg-gray-300" }
        ]
      },
      {
        key: "compliance",
        title: "Settlement Trust and Compliance",
        value: "94%",
        detailRows: [
          { label: "On-time payments", value: "18" },
          { label: "Cumulative overdue", value: "1" }
        ],
        badge: "High-trust finance site"
      }
    ]
  }
};

function localizedHref(href: string, en: boolean) {
  if (!en) {
    return href;
  }
  return href.startsWith("/en/") ? href : buildLocalizedPath(href, `/en${href}`);
}

function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return Promise.resolve();
  }
  return navigator.clipboard.writeText(value);
}

export function PaymentRefundAccountMigrationPage() {
  const session = useFrontendSession();
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const [query, setQuery] = useState("");
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  useEffect(() => {
    document.title = content.pageTitle;
  }, [content.pageTitle]);

  const queryValue = query.trim().toLowerCase();
  const filteredAccounts = useMemo(
    () =>
      content.managedAccounts.filter((account) =>
        !queryValue ||
        account.title.toLowerCase().includes(queryValue) ||
        account.number.toLowerCase().includes(queryValue) ||
        account.bank.toLowerCase().includes(queryValue)
      ),
    [content.managedAccounts, queryValue]
  );
  const filteredSites = useMemo(
    () =>
      content.siteCards.filter((site) =>
        !queryValue ||
        site.title.toLowerCase().includes(queryValue) ||
        site.siteId.toLowerCase().includes(queryValue)
      ),
    [content.siteCards, queryValue]
  );

  useEffect(() => {
    logGovernanceScope("PAGE", "payment-refund-account", {
      language: en ? "en" : "ko",
      query,
      accountCount: filteredAccounts.length,
      siteCount: filteredSites.length,
      copiedAccount,
      userType: session.value?.authorCode || "guest"
    });
  }, [copiedAccount, en, filteredAccounts.length, filteredSites.length, query, session.value?.authorCode]);

  useEffect(() => {
    if (!copiedAccount) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopiedAccount(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copiedAccount]);

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.governmentStatus} />
      <UserPortalHeader
        brandTitle={content.pageTitle}
        brandSubtitle={content.pageSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <nav className="hidden items-center space-x-1 xl:flex">
              {content.navItems.map((item) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${item.current ? "bg-[var(--kr-gov-blue)] text-white" : "text-slate-500 hover:bg-slate-100 hover:text-[var(--kr-gov-blue)]"}`}
                  key={item.href}
                  onClick={() => navigate(localizedHref(item.href, en))}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="hidden md:flex flex-col items-end pr-2">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{content.roleLabel}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{content.roleName}</span>
            </div>
            <UserLanguageToggle en={en} onKo={() => navigate("/payment/refund_account")} onEn={() => navigate("/en/payment/refund_account")} />
            <HomeButton onClick={() => void session.logout()} size="sm" variant="primary">{content.logout}</HomeButton>
          </>
        )}
      />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-900 py-10" data-help-id="payment-refund-account-hero">
          <div className="absolute inset-0 opacity-10">
            <svg className="h-full w-full" aria-hidden="true">
              <pattern id="refund-account-dots" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#refund-account-dots)" />
            </svg>
          </div>
          <div className="relative z-10 mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
              <div className="xl:w-1/4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/20">
                    <span className="material-symbols-outlined text-[28px] text-white">payments</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">{content.heroTitle}</h2>
                    <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-blue-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      {content.heroLabel}
                    </p>
                  </div>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-slate-300">{content.heroBody}</p>
                <HomeButton
                  className="w-full justify-center border border-white/20 bg-white/10 text-white hover:bg-white/15"
                  icon="receipt_long"
                  onClick={() => navigate(localizedHref("/payment/history", en))}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  {content.heroAction}
                </HomeButton>
              </div>
              <div className="w-full xl:w-3/4" data-help-id="payment-refund-account-alerts">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <span className="material-symbols-outlined text-[16px]">priority_high</span>
                  {content.urgentTitle}
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {content.alerts.map((alert) => (
                    <article className={`rounded-r-lg border border-white/10 border-l-4 ${alert.accentClassName} bg-white/5 p-5 backdrop-blur-md transition hover:bg-white/10`} key={alert.key}>
                      <div className="mb-3 flex items-start justify-between">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${alert.badgeClassName}`}>{alert.badge}</span>
                        <span className="text-[10px] font-bold tracking-tight text-slate-500">{alert.due}</span>
                      </div>
                      <h4 className="mb-1 text-sm font-bold text-white">{alert.title}</h4>
                      <p className="mb-4 text-[11px] text-slate-400">{alert.body}</p>
                      <button
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-300 hover:text-blue-200"
                        onClick={() => navigate(localizedHref(alert.actionHref, en))}
                        type="button"
                      >
                        {alert.actionLabel}
                        <span className="material-symbols-outlined text-[14px]">{alert.icon}</span>
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-20 mx-auto -mt-8 max-w-[1440px] px-4 lg:px-8" data-help-id="payment-refund-account-search">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-2xl md:flex-row">
            <div className="relative w-full flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
              <HomeInput
                className="h-14 rounded-lg border-none bg-gray-50 pl-12 pr-4 text-sm"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={content.searchPlaceholder}
                value={query}
              />
            </div>
            <HomeButton
              className="h-14 w-full justify-center px-6 md:w-auto"
              icon="add_card"
              onClick={() => navigate(localizedHref("/payment/pay", en))}
              size="lg"
              type="button"
              variant="primary"
            >
              {content.requestAccountButton}
            </HomeButton>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8" data-help-id="payment-refund-account-managed">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-black">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">account_balance</span>
                {content.managedTitle}
              </h2>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{content.managedBody}</p>
            </div>
            <button
              className="hidden items-center gap-1 text-xs font-bold text-gray-400 transition hover:text-[var(--kr-gov-blue)] md:inline-flex"
              onClick={() => navigate(localizedHref("/payment/refund", en))}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
              {content.settingsLabel}
            </button>
          </div>

          {copiedAccount ? (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              {content.copiedLabel}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {filteredAccounts.map((account) => (
              <article className={`flex h-full flex-col rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white shadow-md ${account.accentClassName} ${account.ringClassName || ""} border-t-4`} data-help-id="payment-refund-account-account-card" key={account.key}>
                <div className="flex items-start justify-between border-b border-gray-100 bg-slate-50/60 p-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${account.badgeClassName}`}>{account.badge}</span>
                      <span className="text-[10px] font-bold text-gray-400">{account.bank}</span>
                    </div>
                    <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{account.title}</h3>
                    <p className="mt-1 text-sm font-mono text-gray-500">{account.number}</p>
                  </div>
                  <button
                    className="text-gray-300 transition hover:text-[var(--kr-gov-blue)]"
                    onClick={() => {
                      void copyText(account.number).then(() => setCopiedAccount(account.number));
                    }}
                    type="button"
                  >
                    <span className="material-symbols-outlined">content_copy</span>
                  </button>
                </div>
                <div className="flex flex-1 flex-col space-y-8 p-6">
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">{en ? "Current Balance" : "현재 잔액"}</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-black tracking-tighter ${account.balanceToneClassName}`}>{account.balance}</span>
                      <span className="text-sm font-bold text-gray-400">KRW</span>
                    </div>
                    {account.note ? <p className="mt-1 text-[10px] font-bold text-red-500">{account.note}</p> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {account.actions.map((action) => (
                      <button
                        className={`flex flex-col items-center justify-center rounded-xl bg-gray-50 p-4 text-center transition ${action.toneClassName}`}
                        key={action.label}
                        onClick={() => navigate(localizedHref(action.href, en))}
                        type="button"
                      >
                        <span className="material-symbols-outlined mb-1 text-gray-400">{action.icon}</span>
                        <span className="text-[12px] font-bold text-gray-600">{action.label}</span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                      <span className="h-1 w-1 rounded-full bg-gray-400" />
                      {en ? "Recent Ledger" : "최근 입출금 내역"}
                    </p>
                    <ul className="space-y-4">
                      {account.ledger.map((row) => (
                        <li className="flex items-center justify-between text-xs" key={`${account.key}-${row.label}`}>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-700">{row.label}</span>
                            <span className="text-gray-400">{row.at}</span>
                          </div>
                          <span className={`font-black ${row.valueClassName}`}>{row.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 pb-12 lg:px-8" data-help-id="payment-refund-account-sites">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-700">
              {content.otherSitesTitle}
              <span className="ml-2 text-sm font-normal text-gray-400">{content.otherSitesMeta}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {filteredSites.map((site) => (
              <article className="flex h-full flex-col rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white transition hover:border-blue-400" key={site.key}>
                <div className="border-b border-gray-100 p-4">
                  <span className="text-[10px] font-bold text-gray-400">ID: {site.siteId}</span>
                  <h4 className="font-bold text-gray-800">{site.title}</h4>
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div className="mb-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{en ? "Balance" : "잔액"}</span>
                      <span className="font-bold">{site.balance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{en ? "Status" : "상태"}</span>
                      <span className={`font-bold ${site.statusClassName}`}>{site.status}</span>
                    </div>
                  </div>
                  <button
                    className={`w-full rounded border py-2.5 text-xs font-bold transition ${site.actionClassName}`}
                    onClick={() => navigate(localizedHref(site.actionHref, en))}
                    type="button"
                  >
                    {site.actionLabel}
                  </button>
                </div>
              </article>
            ))}
            <button
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-6 transition hover:border-[var(--kr-gov-blue)] hover:bg-white"
              onClick={() => navigate(localizedHref("/payment/pay", en))}
              type="button"
            >
              <span className="material-symbols-outlined mb-2 text-[32px] text-gray-300">account_balance</span>
              <span className="text-xs font-bold text-gray-400">{content.connectLabel}</span>
            </button>
          </div>
        </section>

        <section className="border-y border-gray-200 bg-white py-16" data-help-id="payment-refund-account-report">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-black">{content.reportTitle}</h2>
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{content.reportBody}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                <span className="material-symbols-outlined text-[16px]">update</span>
                {content.reportUpdated}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {content.reportMetrics.map((metric) => {
                if (metric.key === "balance") {
                  return (
                    <article className="rounded-xl border border-gray-100 bg-gray-50 p-6" key={metric.key}>
                      <h4 className="mb-6 text-sm font-bold text-gray-600">{metric.title}</h4>
                      <div className="mb-6 flex items-baseline gap-2">
                        <span className={`text-4xl font-black tracking-tight ${metric.accentClassName}`}>{metric.value}</span>
                        <span className="text-sm font-bold text-gray-400">{metric.unit}</span>
                        <span className="ml-auto text-sm font-bold text-emerald-600">{metric.note}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[12px] font-bold">
                          <span>{metric.progressLabel}</span>
                          <span className="text-[var(--kr-gov-blue)]">{metric.progressWidth}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full border border-gray-200 bg-white">
                          <div className="h-full bg-[var(--kr-gov-blue)]" style={{ width: metric.progressWidth }} />
                        </div>
                      </div>
                    </article>
                  );
                }
                if (metric.key === "distribution") {
                  return (
                    <article className="rounded-xl border border-gray-100 bg-gray-50 p-6" key={metric.key}>
                      <h4 className="mb-6 text-sm font-bold text-gray-600">{metric.title}</h4>
                      <div className="flex h-32 items-end gap-4">
                        {metric.bars?.map((bar) => (
                          <div className="relative flex flex-1 items-end justify-center" key={bar.label}>
                            <div className={`w-full rounded-t-lg ${bar.barClassName} ${bar.heightClassName}`} />
                            <div className="absolute -top-6 text-[11px] font-black">{bar.value}</div>
                            <div className="absolute -bottom-6 whitespace-nowrap text-[10px] font-bold text-gray-400">{bar.label}</div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                }
                return (
                  <article className="flex flex-col justify-between rounded-xl border border-gray-100 bg-gray-50 p-6" key={metric.key}>
                    <h4 className="mb-4 text-sm font-bold text-gray-600">{metric.title}</h4>
                    <div className="flex items-center gap-6">
                      <div className="relative h-24 w-24">
                        <svg className="h-full w-full -rotate-90" aria-hidden="true">
                          <circle cx="48" cy="48" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white" />
                          <circle cx="48" cy="48" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray="251" strokeDashoffset="30" className="text-emerald-500" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xl font-black">{metric.value}</div>
                      </div>
                      <div className="flex-1 space-y-2">
                        {metric.detailRows?.map((row) => (
                          <div className="flex justify-between text-xs" key={row.label}>
                            <span className="text-gray-500">{row.label}</span>
                            <span className="font-bold">{row.value}</span>
                          </div>
                        ))}
                        <div className="mt-4 inline-flex items-center gap-1 rounded bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                          <span className="material-symbols-outlined text-[14px]">verified_user</span>
                          {metric.badge}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={content.footerAddress}
        copyright={content.footerCopyright}
        footerLinks={content.footerLinks}
        lastModifiedLabel={content.footerLastModifiedLabel}
        orgName={content.footerOrg}
        serviceLine={content.footerServiceLine}
        waAlt={content.footerWaAlt}
      />
    </div>
  );
}

export default PaymentRefundAccountMigrationPage;
