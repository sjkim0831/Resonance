import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminInput, MemberButton, PageStatusNotice } from "../member/common";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type AlertCard = {
  key: string;
  badge: string;
  badgeClassName: string;
  due: string;
  title: string;
  body: string;
  actionLabel: string;
  href: string;
  icon: string;
};

type AccountAction = {
  label: string;
  icon: string;
  href: string;
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
  status: string;
  progressLabel?: string;
  progressWidth?: string;
  bars?: Array<{ label: string; value: string; heightClassName: string; barClassName: string }>;
  score?: string;
  details?: Array<{ label: string; value: string }>;
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
  statusMessage: string;
  urgentTitle: string;
  searchPlaceholder: string;
  searchHint: string;
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
  footerLastModified: string;
  footerWaAlt: string;
  footerLinks: string[];
  copiedLabel: string;
  alerts: AlertCard[];
  managedAccounts: ManagedAccount[];
  siteCards: SiteCard[];
  reportMetrics: ReportMetric[];
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    pageTitle: "결제 요청",
    pageSubtitle: "PAYMENT ACTION & VIRTUAL ACCOUNT HUB",
    governmentText: "대한민국 정부 공식 서비스 | 결제 요청 및 가상계좌 운영 허브",
    governmentStatus: "금융 데이터 최종 갱신: 2026.04.02 16:20",
    navItems: [
      { label: "결제 내역", href: "/payment/history" },
      { label: "결제 요청", href: "/payment/pay", active: true },
      { label: "가상계좌", href: "/payment/virtual_account" },
      { label: "영수증", href: "/payment/receipt" }
    ],
    roleLabel: "결제 운영 책임자",
    roleName: "이현장 관리자",
    heroTitle: "결제 액션 센터",
    heroLabel: "Action Required",
    heroBody: "reference의 결제 및 가상계좌 통합 허브를 현재 Carbonet 홈 포털 패턴으로 이식했습니다. 미납 건, 임박 결제, 가상계좌 잔액 부족 건을 한 화면에서 정리하고 즉시 후속 액션으로 연결합니다.",
    heroAction: "전체 결제 대기 목록",
    statusMessage: "reference HTML을 React 마이그레이션 화면으로 변환했고, 검색과 계좌 액션은 현재 홈 포털 내 링크 흐름에 맞춰 재구성했습니다.",
    urgentTitle: "긴급 결제 및 기한 안내",
    searchPlaceholder: "가상계좌 번호, 사이트 명칭, 또는 입금자명을 검색하세요",
    searchHint: "검색 결과는 관리 가상계좌와 기타 사이트 카드에 동시에 반영됩니다.",
    requestAccountButton: "가상계좌 발급 요청",
    managedTitle: "관리 가상계좌 현황",
    managedBody: "각 사이트별 가상계좌 정보와 실시간 잔액을 투명하게 확인하십시오.",
    settingsLabel: "계좌 설정 관리",
    otherSitesTitle: "기타 사이트 결제 현황",
    otherSitesMeta: "총 12개소",
    reportTitle: "통합 자금 운영 리포트",
    reportBody: "관리 중인 모든 사이트의 결제 현황 및 가상계좌 총액 분석입니다.",
    reportUpdated: "최종 정산 업데이트: 2026.04.02 16:15",
    footerOrg: "CCUS 통합금융관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110",
    footerServiceLine: "결제 및 정산 지원팀 02-9876-5432",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Dedicated Site Overseer Financial Portal.",
    footerLastModified: "최종 갱신",
    footerWaAlt: "웹 접근성 품질마크",
    footerLinks: ["전자금융거래약관", "개인정보처리방침", "사이트맵"],
    copiedLabel: "계좌번호가 복사되었습니다.",
    alerts: [
      {
        key: "ulsan-overdue",
        badge: "OVERDUE",
        badgeClassName: "bg-red-500/20 text-red-300",
        due: "경과: 5일",
        title: "울산 제3: 8월 정산분 미납",
        body: "연체 가산금이 발생 중입니다. 즉시 납부가 필요합니다.",
        actionLabel: "즉시 결제하기",
        href: "/payment/history",
        icon: "arrow_forward"
      },
      {
        key: "pohang-upcoming",
        badge: "UPCOMING",
        badgeClassName: "bg-amber-500/20 text-amber-300",
        due: "D-3",
        title: "포항 제1: 검증 수수료",
        body: "3단계 현장 검증 수수료 납기일이 3일 남았습니다.",
        actionLabel: "납부 정보 확인",
        href: "/payment/receipt",
        icon: "info"
      },
      {
        key: "gwangyang-recurring",
        badge: "RECURRING",
        badgeClassName: "bg-sky-500/20 text-sky-300",
        due: "D-15",
        title: "광양 제2: 유지보수 정기결제",
        body: "가상계좌 잔액 확인 및 정기 이체 준비가 필요합니다.",
        actionLabel: "잔액 충전",
        href: "/payment/virtual_account",
        icon: "account_balance_wallet"
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
          { label: "납부 실행", icon: "payments", href: "/payment/history", toneClassName: "hover:bg-blue-600 hover:text-white" },
          { label: "명세서 출력", icon: "description", href: "/payment/receipt", toneClassName: "hover:bg-blue-600 hover:text-white" }
        ],
        ledger: [
          { label: "검증 수수료 정산", at: "2026.03.29 10:22", value: "- 2,500,000원", valueClassName: "text-red-500" },
          { label: "관리비 이체", at: "2026.03.25 15:45", value: "+ 5,000,000원", valueClassName: "text-blue-500" }
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
        note: "미납액(8,200,000원) 대비 잔액이 부족합니다.",
        accentClassName: "border-t-red-500",
        ringClassName: "ring-2 ring-red-500/20",
        actions: [
          { label: "가상계좌 충전", icon: "account_balance_wallet", href: "/payment/virtual_account", toneClassName: "bg-red-600 text-white hover:bg-red-700" },
          { label: "납부 이력", icon: "history", href: "/payment/history", toneClassName: "hover:bg-red-600 hover:text-white" }
        ],
        ledger: [
          { label: "연체 가산금 부과", at: "3시간 전", value: "- 45,000원", valueClassName: "text-red-500" },
          { label: "관리 시스템 사용료", at: "2026.03.01", value: "- 8,155,000원", valueClassName: "text-red-500" }
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
          { label: "납부 공문 발송", icon: "forward_to_inbox", href: "/payment/receipt", toneClassName: "hover:bg-orange-600 hover:text-white" },
          { label: "청구서 조회", icon: "receipt", href: "/payment/history", toneClassName: "hover:bg-orange-600 hover:text-white" }
        ],
        ledger: [
          { label: "보고서 검토비 정산", at: "2일 전", value: "- 1,200,000원", valueClassName: "text-red-500" },
          { label: "예치금 입금", at: "2026.03.20", value: "+ 50,000,000원", valueClassName: "text-blue-500" }
        ]
      }
    ],
    siteCards: [
      {
        key: "incheon",
        siteId: "IC-005",
        title: "인천 물류센터",
        balance: "2,452,000원",
        status: "완납",
        statusClassName: "text-emerald-600",
        actionLabel: "내역 상세",
        actionHref: "/payment/history",
        actionClassName: "border-gray-200 text-gray-600 hover:bg-gray-50"
      },
      {
        key: "daejeon",
        siteId: "DJ-021",
        title: "대전 R&D 캠퍼스",
        balance: "120,000원",
        status: "결제대기",
        statusClassName: "text-orange-600",
        actionLabel: "즉시 결제",
        actionHref: "/payment/pay",
        actionClassName: "border-orange-200 text-orange-600 hover:bg-orange-50"
      },
      {
        key: "paju",
        siteId: "PJ-088",
        title: "파주 전산센터",
        balance: "5,890,000원",
        status: "완납",
        statusClassName: "text-emerald-600",
        actionLabel: "내역 상세",
        actionHref: "/payment/history",
        actionClassName: "border-gray-200 text-gray-600 hover:bg-gray-50"
      },
      {
        key: "new",
        siteId: "NEW",
        title: "신규 계좌 연동",
        balance: "-",
        status: "계좌 추가",
        statusClassName: "text-[var(--kr-gov-blue)]",
        actionLabel: "신규 계좌 연동",
        actionHref: "/payment/virtual_account",
        actionClassName: "border-dashed border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)] hover:bg-blue-50"
      }
    ],
    reportMetrics: [
      {
        key: "balance",
        title: "총 관리 자금 잔액",
        value: "345,120,000",
        unit: "KRW",
        status: "▲ 12.2% (전월대비)",
        progressLabel: "이달 집행 예정액",
        progressWidth: "34.7%"
      },
      {
        key: "distribution",
        title: "결제 상태별 분포",
        value: "",
        status: "",
        bars: [
          { label: "결제완료", value: "15", heightClassName: "h-32", barClassName: "bg-emerald-500" },
          { label: "청구됨", value: "4", heightClassName: "h-24", barClassName: "bg-orange-400" },
          { label: "미납/연체", value: "1", heightClassName: "h-16", barClassName: "bg-red-400" },
          { label: "대기중", value: "2", heightClassName: "h-20", barClassName: "bg-gray-300" }
        ]
      },
      {
        key: "compliance",
        title: "정산 신뢰도 및 준수율",
        value: "",
        status: "",
        score: "94%",
        badge: "우수 자금 관리 사업장",
        details: [
          { label: "기한 내 결제", value: "18건" },
          { label: "누적 연체", value: "1건" }
        ]
      }
    ]
  },
  en: {
    pageTitle: "Payment Requests",
    pageSubtitle: "PAYMENT ACTION & VIRTUAL ACCOUNT HUB",
    governmentText: "Official Government Service | Payment requests and virtual account operations hub",
    governmentStatus: "Financial data refreshed: 2026.04.02 16:20",
    navItems: [
      { label: "Payment History", href: "/payment/history" },
      { label: "Payment Requests", href: "/payment/pay", active: true },
      { label: "Virtual Accounts", href: "/payment/virtual_account" },
      { label: "Receipts", href: "/payment/receipt" }
    ],
    roleLabel: "Payment Operations Lead",
    roleName: "Lead Manager Lee",
    heroTitle: "Payment Action Center",
    heroLabel: "Action Required",
    heroBody: "The reference payment and virtual account hub was rebuilt in the current Carbonet home portal structure. Overdue invoices, upcoming deadlines, and low-balance virtual accounts are grouped into one operating screen with direct follow-up actions.",
    heroAction: "Open full payment queue",
    statusMessage: "The reference HTML was converted into a React migration page and the search plus account actions were aligned to the current portal navigation flow.",
    urgentTitle: "Urgent payments and due-date notices",
    searchPlaceholder: "Search by virtual account number, site name, or depositor",
    searchHint: "Results are applied to managed virtual accounts and secondary site cards together.",
    requestAccountButton: "Request virtual account issuance",
    managedTitle: "Managed virtual accounts",
    managedBody: "Monitor site-level virtual account details and live balances in one place.",
    settingsLabel: "Manage account settings",
    otherSitesTitle: "Other site payment status",
    otherSitesMeta: "12 sites",
    reportTitle: "Integrated treasury operations report",
    reportBody: "Portfolio-level payment health and virtual account balance analysis across managed sites.",
    reportUpdated: "Last settlement update: 2026.04.02 16:15",
    footerOrg: "CCUS Integrated Treasury Office",
    footerAddress: "110 Sejong-daero, Jung-gu, Seoul 04551",
    footerServiceLine: "Payments and settlement desk +82-2-9876-5432",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Dedicated Site Overseer Financial Portal.",
    footerLastModified: "Last updated",
    footerWaAlt: "Web accessibility certification",
    footerLinks: ["Electronic Financial Terms", "Privacy Policy", "Sitemap"],
    copiedLabel: "Account number copied.",
    alerts: [
      {
        key: "ulsan-overdue",
        badge: "OVERDUE",
        badgeClassName: "bg-red-500/20 text-red-300",
        due: "5 days overdue",
        title: "Ulsan Site 3: August settlement unpaid",
        body: "Late fees are already being charged. Immediate payment is required.",
        actionLabel: "Pay now",
        href: "/payment/history",
        icon: "arrow_forward"
      },
      {
        key: "pohang-upcoming",
        badge: "UPCOMING",
        badgeClassName: "bg-amber-500/20 text-amber-300",
        due: "D-3",
        title: "Pohang Site 1: verification fee",
        body: "The stage-3 field verification fee is due in three days.",
        actionLabel: "View payment info",
        href: "/payment/receipt",
        icon: "info"
      },
      {
        key: "gwangyang-recurring",
        badge: "RECURRING",
        badgeClassName: "bg-sky-500/20 text-sky-300",
        due: "D-15",
        title: "Gwangyang Site 2: recurring maintenance payment",
        body: "Check the virtual account balance and prepare the recurring transfer.",
        actionLabel: "Top up balance",
        href: "/payment/virtual_account",
        icon: "account_balance_wallet"
      }
    ],
    managedAccounts: [
      {
        key: "pohang",
        badge: "Healthy",
        badgeClassName: "border border-emerald-200 bg-emerald-100 text-emerald-700",
        bank: "IBK",
        title: "Pohang Hot Rolling Plant 1",
        number: "120-10452-99-001",
        balance: "12,450,000",
        balanceToneClassName: "text-[var(--kr-gov-blue)]",
        accentClassName: "border-t-[var(--kr-gov-blue)]",
        actions: [
          { label: "Execute payment", icon: "payments", href: "/payment/history", toneClassName: "hover:bg-blue-600 hover:text-white" },
          { label: "Print statement", icon: "description", href: "/payment/receipt", toneClassName: "hover:bg-blue-600 hover:text-white" }
        ],
        ledger: [
          { label: "Verification fee settlement", at: "2026.03.29 10:22", value: "- KRW 2,500,000", valueClassName: "text-red-500" },
          { label: "Operations transfer", at: "2026.03.25 15:45", value: "+ KRW 5,000,000", valueClassName: "text-blue-500" }
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
        note: "The balance is below the unpaid amount of KRW 8,200,000.",
        accentClassName: "border-t-red-500",
        ringClassName: "ring-2 ring-red-500/20",
        actions: [
          { label: "Top up account", icon: "account_balance_wallet", href: "/payment/virtual_account", toneClassName: "bg-red-600 text-white hover:bg-red-700" },
          { label: "Payment history", icon: "history", href: "/payment/history", toneClassName: "hover:bg-red-600 hover:text-white" }
        ],
        ledger: [
          { label: "Late fee charged", at: "3 hours ago", value: "- KRW 45,000", valueClassName: "text-red-500" },
          { label: "System usage fee", at: "2026.03.01", value: "- KRW 8,155,000", valueClassName: "text-red-500" }
        ]
      },
      {
        key: "gwangyang",
        badge: "Due soon",
        badgeClassName: "border border-orange-200 bg-orange-100 text-orange-700",
        bank: "Shinhan Bank",
        title: "Gwangyang Energy Center 2",
        number: "110-882-942112",
        balance: "48,920,000",
        balanceToneClassName: "text-orange-600",
        accentClassName: "border-t-orange-400",
        actions: [
          { label: "Send notice", icon: "forward_to_inbox", href: "/payment/receipt", toneClassName: "hover:bg-orange-600 hover:text-white" },
          { label: "View invoice", icon: "receipt", href: "/payment/history", toneClassName: "hover:bg-orange-600 hover:text-white" }
        ],
        ledger: [
          { label: "Report review fee", at: "2 days ago", value: "- KRW 1,200,000", valueClassName: "text-red-500" },
          { label: "Deposit received", at: "2026.03.20", value: "+ KRW 50,000,000", valueClassName: "text-blue-500" }
        ]
      }
    ],
    siteCards: [
      {
        key: "incheon",
        siteId: "IC-005",
        title: "Incheon Logistics Center",
        balance: "KRW 2,452,000",
        status: "Paid",
        statusClassName: "text-emerald-600",
        actionLabel: "View details",
        actionHref: "/payment/history",
        actionClassName: "border-gray-200 text-gray-600 hover:bg-gray-50"
      },
      {
        key: "daejeon",
        siteId: "DJ-021",
        title: "Daejeon R&D Campus",
        balance: "KRW 120,000",
        status: "Pending",
        statusClassName: "text-orange-600",
        actionLabel: "Pay now",
        actionHref: "/payment/pay",
        actionClassName: "border-orange-200 text-orange-600 hover:bg-orange-50"
      },
      {
        key: "paju",
        siteId: "PJ-088",
        title: "Paju Data Center",
        balance: "KRW 5,890,000",
        status: "Paid",
        statusClassName: "text-emerald-600",
        actionLabel: "View details",
        actionHref: "/payment/history",
        actionClassName: "border-gray-200 text-gray-600 hover:bg-gray-50"
      },
      {
        key: "new",
        siteId: "NEW",
        title: "Connect new account",
        balance: "-",
        status: "Add account",
        statusClassName: "text-[var(--kr-gov-blue)]",
        actionLabel: "Connect new account",
        actionHref: "/payment/virtual_account",
        actionClassName: "border-dashed border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)] hover:bg-blue-50"
      }
    ],
    reportMetrics: [
      {
        key: "balance",
        title: "Total managed balance",
        value: "345,120,000",
        unit: "KRW",
        status: "+12.2% vs prior month",
        progressLabel: "Planned execution this month",
        progressWidth: "34.7%"
      },
      {
        key: "distribution",
        title: "Payment status distribution",
        value: "",
        status: "",
        bars: [
          { label: "Paid", value: "15", heightClassName: "h-32", barClassName: "bg-emerald-500" },
          { label: "Invoiced", value: "4", heightClassName: "h-24", barClassName: "bg-orange-400" },
          { label: "Overdue", value: "1", heightClassName: "h-16", barClassName: "bg-red-400" },
          { label: "Queued", value: "2", heightClassName: "h-20", barClassName: "bg-gray-300" }
        ]
      },
      {
        key: "compliance",
        title: "Settlement reliability and compliance",
        value: "",
        status: "",
        score: "94%",
        badge: "High-performing treasury site",
        details: [
          { label: "On-time payments", value: "18" },
          { label: "Accumulated delays", value: "1" }
        ]
      }
    ]
  }
};

function localizedPath(path: string) {
  return buildLocalizedPath(path, `/en${path}`);
}

export function PaymentPayMigrationPage() {
  const session = useFrontendSession();
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const [query, setQuery] = useState("");
  const [copiedAccount, setCopiedAccount] = useState("");

  useEffect(() => {
    document.title = content.pageTitle;
  }, [content.pageTitle]);

  useEffect(() => {
    logGovernanceScope("PAGE", "payment-pay", {
      language: en ? "en" : "ko",
      userType: session.value?.authorCode || "guest",
      queryLength: query.trim().length
    });
  }, [en, query, session.value?.authorCode]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredManagedAccounts = useMemo(
    () => content.managedAccounts.filter((account) => {
      if (!normalizedQuery) {
        return true;
      }
      return `${account.title} ${account.number} ${account.bank}`.toLowerCase().includes(normalizedQuery);
    }),
    [content.managedAccounts, normalizedQuery]
  );
  const filteredSiteCards = useMemo(
    () => content.siteCards.filter((site) => {
      if (!normalizedQuery) {
        return true;
      }
      return `${site.title} ${site.siteId} ${site.balance}`.toLowerCase().includes(normalizedQuery);
    }),
    [content.siteCards, normalizedQuery]
  );

  async function handleCopy(accountNumber: string) {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedAccount(accountNumber);
      window.setTimeout(() => setCopiedAccount(""), 1800);
    } catch {
      setCopiedAccount("");
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-3 focus:py-2 focus:text-white" href="#main-content">
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.governmentStatus} />

      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-5 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--kr-gov-blue)] text-white shadow-lg shadow-blue-500/20">
                <span className="material-symbols-outlined text-[28px]">account_balance</span>
              </span>
              <div>
                <h1 className="text-xl font-black tracking-tight">{content.pageTitle}</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{content.pageSubtitle}</p>
              </div>
            </div>
            <nav className="mt-5 hidden flex-wrap items-center gap-1 xl:flex">
              {content.navItems.map((item) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    item.active ? "bg-blue-50 text-[var(--kr-gov-blue)]" : "text-slate-500 hover:bg-slate-50 hover:text-[var(--kr-gov-blue)]"
                  }`}
                  key={item.href}
                  onClick={() => navigate(localizedPath(item.href))}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <UserLanguageToggle en={en} onKo={() => navigate("/payment/pay")} onEn={() => navigate("/en/payment/pay")} />
            <div className="hidden text-right md:block">
              <p className="text-xs font-bold text-slate-500">{content.roleLabel}</p>
              <p className="text-sm font-black text-slate-900">{content.roleName}</p>
            </div>
            <MemberButton className="!bg-[var(--kr-gov-blue)] !px-4 !py-2.5 !text-white hover:!bg-[#002d72]" onClick={() => void session.logout()} type="button">
              {en ? "Log out" : "로그아웃"}
            </MemberButton>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="overflow-hidden border-b border-slate-800 bg-slate-900 py-10">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="mb-5 max-w-4xl">
              <PageStatusNotice tone="warning">{content.statusMessage}</PageStatusNotice>
            </div>
            <div className="grid gap-8 xl:grid-cols-[0.9fr_1.5fr]">
              <article className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-white" data-help-id="payment-pay-hero">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/20">
                    <span className="material-symbols-outlined text-[28px]">payments</span>
                  </span>
                  <div>
                    <h2 className="text-2xl font-black">{content.heroTitle}</h2>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-300">{content.heroLabel}</p>
                  </div>
                </div>
                <p className="text-sm leading-7 text-slate-300">{content.heroBody}</p>
                <button
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold transition hover:bg-white/15"
                  onClick={() => navigate(localizedPath("/payment/history"))}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  {content.heroAction}
                </button>
              </article>

              <section data-help-id="payment-pay-urgent">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  <span className="material-symbols-outlined text-[16px]">priority_high</span>
                  {content.urgentTitle}
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  {content.alerts.map((alert) => (
                    <article className="flex h-full flex-col rounded-r-2xl border border-white/10 border-l-4 bg-white/5 p-5 text-white backdrop-blur-sm" key={alert.key}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${alert.badgeClassName}`}>{alert.badge}</span>
                        <span className="text-[10px] font-bold text-slate-500">{alert.due}</span>
                      </div>
                      <h4 className="text-sm font-bold">{alert.title}</h4>
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">{alert.body}</p>
                      <button
                        className="mt-5 inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-sky-200"
                        onClick={() => navigate(localizedPath(alert.href))}
                        type="button"
                      >
                        {alert.actionLabel}
                        <span className="material-symbols-outlined text-[14px]">{alert.icon}</span>
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-8 max-w-[1440px] px-4 lg:px-8" data-help-id="payment-pay-search">
          <div className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400" htmlFor="payment-pay-search-input">
                  Search
                </label>
                <AdminInput
                  id="payment-pay-search-input"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={content.searchPlaceholder}
                  value={query}
                />
                <p className="mt-2 text-xs text-slate-500">{content.searchHint}</p>
              </div>
              <div className="flex shrink-0 items-end">
                <MemberButton className="!h-[46px] !px-5" onClick={() => navigate(localizedPath("/payment/virtual_account"))} type="button">
                  <span className="material-symbols-outlined text-[18px]">add_card</span>
                  {content.requestAccountButton}
                </MemberButton>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8" data-help-id="payment-pay-managed-accounts">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-black">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">account_balance</span>
                {content.managedTitle}
              </h2>
              <p className="mt-2 text-sm text-slate-500">{content.managedBody}</p>
            </div>
            <button
              className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-[var(--kr-gov-blue)]"
              onClick={() => navigate(localizedPath("/payment/virtual_account"))}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
              {content.settingsLabel}
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {filteredManagedAccounts.map((account) => (
              <article className={`overflow-hidden rounded-[24px] border bg-white shadow-md ${account.accentClassName} ${account.ringClassName || ""}`} key={account.key}>
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-slate-50/70 p-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${account.badgeClassName}`}>{account.badge}</span>
                      <span className="text-[10px] font-bold text-gray-400">{account.bank}</span>
                    </div>
                    <h3 className="text-xl font-black">{account.title}</h3>
                    <p className="mt-1 font-mono text-sm text-gray-500">{account.number}</p>
                  </div>
                  <button className="rounded-full border border-gray-200 p-2 text-gray-400 transition hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" onClick={() => void handleCopy(account.number)} type="button">
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  </button>
                </div>
                <div className="space-y-7 p-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Current Balance</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className={`text-3xl font-black tracking-tight ${account.balanceToneClassName}`}>{account.balance}</span>
                      <span className="text-sm font-bold text-gray-400">KRW</span>
                    </div>
                    {account.note ? <p className="mt-1 text-[11px] font-bold text-red-500">{account.note}</p> : null}
                    {copiedAccount === account.number ? <p className="mt-2 text-[11px] font-bold text-emerald-600">{content.copiedLabel}</p> : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {account.actions.map((action) => (
                      <button
                        className={`flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 p-4 text-gray-600 transition ${action.toneClassName}`}
                        key={action.label}
                        onClick={() => navigate(localizedPath(action.href))}
                        type="button"
                      >
                        <span className="material-symbols-outlined mb-1 text-[20px]">{action.icon}</span>
                        <span className="text-[12px] font-bold">{action.label}</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">최근 입출금 내역</p>
                    <ul className="space-y-4">
                      {account.ledger.map((row) => (
                        <li className="flex items-center justify-between gap-3 text-xs" key={`${account.key}-${row.label}`}>
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

        <section className="mx-auto max-w-[1440px] px-4 pb-16 lg:px-8" data-help-id="payment-pay-sites">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-700">
              {content.otherSitesTitle}
              <span className="ml-2 text-sm font-normal text-gray-400">{content.otherSitesMeta}</span>
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {filteredSiteCards.map((site) => (
              <article className="flex h-full flex-col rounded-[20px] border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-lg" key={site.key}>
                <div className="border-b border-gray-100 p-4">
                  <span className="text-[10px] font-bold text-gray-400">ID: {site.siteId}</span>
                  <h3 className="mt-1 font-bold text-gray-800">{site.title}</h3>
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div className="mb-4 space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">잔액</span>
                      <span className="font-bold">{site.balance}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">상태</span>
                      <span className={`font-bold ${site.statusClassName}`}>{site.status}</span>
                    </div>
                  </div>
                  <button
                    className={`w-full rounded-lg border px-3 py-2.5 text-xs font-bold transition ${site.actionClassName}`}
                    onClick={() => navigate(localizedPath(site.actionHref))}
                    type="button"
                  >
                    {site.actionLabel}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-gray-200 bg-white py-16" data-help-id="payment-pay-report">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-black">{content.reportTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{content.reportBody}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                <span className="material-symbols-outlined text-[16px]">update</span>
                {content.reportUpdated}
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {content.reportMetrics.map((metric) => (
                <article className="rounded-[24px] border border-gray-100 bg-gray-50 p-6" key={metric.key}>
                  <h3 className="text-sm font-bold text-gray-600">{metric.title}</h3>

                  {metric.progressWidth ? (
                    <>
                      <div className="mt-6 flex items-baseline gap-2">
                        <span className="text-4xl font-black tracking-tight text-[var(--kr-gov-blue)]">{metric.value}</span>
                        <span className="text-sm font-bold text-gray-400">{metric.unit}</span>
                        <span className="ml-auto text-sm font-bold text-emerald-600">{metric.status}</span>
                      </div>
                      <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-[12px] font-bold">
                          <span>{metric.progressLabel}</span>
                          <span className="text-[var(--kr-gov-blue)]">{metric.progressWidth}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full border border-gray-200 bg-white">
                          <div className="h-full bg-[var(--kr-gov-blue)]" style={{ width: metric.progressWidth }} />
                        </div>
                      </div>
                    </>
                  ) : null}

                  {metric.bars ? (
                    <div className="mt-8 flex items-end gap-4">
                      {metric.bars.map((bar) => (
                        <div className="flex flex-1 flex-col items-center" key={`${metric.key}-${bar.label}`}>
                          <div className="mb-2 text-[11px] font-black">{bar.value}</div>
                          <div className={`w-full rounded-t-lg ${bar.heightClassName} ${bar.barClassName}`} />
                          <div className="mt-3 text-[10px] font-bold text-gray-400">{bar.label}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {metric.score ? (
                    <div className="mt-6 flex items-center gap-6">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full border-8 border-emerald-500/20 text-xl font-black text-slate-900">
                        {metric.score}
                      </div>
                      <div className="flex-1 space-y-2">
                        {metric.details?.map((detail) => (
                          <div className="flex justify-between text-xs" key={detail.label}>
                            <span className="text-gray-500">{detail.label}</span>
                            <span className="font-bold">{detail.value}</span>
                          </div>
                        ))}
                        {metric.badge ? (
                          <div className="mt-4 inline-flex items-center gap-1 rounded bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                            <span className="material-symbols-outlined text-[14px]">verified_user</span>
                            {metric.badge}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
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
  );
}
