import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { MemberButton } from "../member/common";

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
  accentClassName: string;
};

type WorkflowStep = {
  key: string;
  stepLabel: string;
  title: string;
  icon: string;
  active?: boolean;
};

type TimelineEntry = {
  key: string;
  status: string;
  statusClassName: string;
  icon: string;
  timestamp: string;
  amount: string;
  title: string;
  body: string;
  actions: Array<{ label: string; href: string; primary?: boolean }>;
};

type LedgerEntry = {
  label: string;
  at: string;
  value: string;
  valueClassName: string;
};

type ManagedAccountAction = {
  label: string;
  icon: string;
  href: string;
  className: string;
};

type ManagedAccount = {
  key: string;
  badge: string;
  badgeClassName: string;
  bank: string;
  title: string;
  number: string;
  amountLabel: string;
  balance: string;
  balanceClassName: string;
  note?: string;
  cardClassName: string;
  headerClassName: string;
  actions: ManagedAccountAction[];
  ledger: LedgerEntry[];
  trend?: "rise" | "fall" | "flat";
};

type SiteCard = {
  key: string;
  siteId?: string;
  title: string;
  balance: string;
  status: string;
  statusClassName: string;
  actionLabel: string;
  href?: string;
  actionClassName: string;
  addNew?: boolean;
};

type DistributionBar = {
  label: string;
  value: string;
  heightClassName: string;
  barClassName: string;
};

type ReportMetric =
  | {
      key: string;
      title: string;
      type: "progress";
      value: string;
      unit: string;
      delta: string;
      progressLabel: string;
      progressWidth: string;
    }
  | {
      key: string;
      title: string;
      type: "bars";
      bars: DistributionBar[];
    }
  | {
      key: string;
      title: string;
      type: "score";
      score: string;
      details: Array<{ label: string; value: string }>;
      badge: string;
    };

type LocaleContent = {
  governmentText: string;
  governmentStatus: string;
  pageTitle: string;
  pageSubtitle: string;
  roleLabel: string;
  roleName: string;
  logoutLabel: string;
  navItems: NavItem[];
  heroType: "alerts" | "timeline";
  heroTitle: string;
  heroSubtitle: string;
  heroButtonLabel?: string;
  heroButtonHref?: string;
  heroDescription?: string;
  alertsHeading?: string;
  alertCards: AlertCard[];
  workflowSteps: WorkflowStep[];
  timelineHeading?: string;
  timelineActionLabel?: string;
  timelineActionHref?: string;
  timelineEntries: TimelineEntry[];
  searchPlaceholder: string;
  issueButtonLabel: string;
  managedTitle: string;
  managedBody: string;
  managedMetaLabel?: string;
  managedMetaValue?: string;
  manageButtonLabel: string;
  copiedLabel: string;
  managedAccounts: ManagedAccount[];
  siteSectionTitle: string;
  siteSectionMeta: string;
  siteCards: SiteCard[];
  reportTitle: string;
  reportBody: string;
  reportUpdated: string;
  reportMetrics: ReportMetric[];
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerLinks: string[];
  footerCopyright: string;
  footerLastModified: string;
  footerWaAlt: string;
};

const KO_CONTENT: LocaleContent = {
  governmentText: "대한민국 정부 공식 서비스 | 전담 사이트 총괄 관리자 전용",
  governmentStatus: "금융 데이터 최종 갱신: 방금 전",
  pageTitle: "결제 및 가상계좌 통합 허브",
  pageSubtitle: "Dedicated Site Payment Hub",
  roleLabel: "총괄 사이트 감독관",
  roleName: "이현장 관리자님",
  logoutLabel: "로그아웃",
  navItems: [
    { label: "결제", href: "/payment/pay", active: true },
    { label: "결제 내역", href: "/payment/history" },
    { label: "가상계좌", href: "/payment/virtual_account" },
    { label: "정산 보고서", href: "/trade/report" }
  ],
  heroType: "alerts",
  heroTitle: "결제 액션 센터",
  heroSubtitle: "Action Required",
  heroButtonLabel: "전체 결제 대기 목록",
  heroButtonHref: "/payment/history",
  heroDescription: "미납 고지서 및 다가오는 결제 기한을 확인하십시오. 미납 건을 포함한 3개의 주요 항목이 감지되었습니다.",
  alertsHeading: "긴급 결제 및 기한 안내",
  alertCards: [
    {
      key: "ulsan-overdue",
      badge: "OVERDUE",
      badgeClassName: "bg-red-500/20 text-red-400",
      due: "경과: 5일",
      title: "울산 제3: 8월 정산분 미납",
      body: "연체 가산금이 발생 중입니다. 즉시 납부가 필요합니다.",
      actionLabel: "즉시 결제하기",
      href: "/payment/history",
      icon: "arrow_forward",
      accentClassName: "border-l-red-500"
    },
    {
      key: "pohang-upcoming",
      badge: "UPCOMING",
      badgeClassName: "bg-orange-500/20 text-orange-400",
      due: "D-3",
      title: "포항 제1: 검증 수수료",
      body: "3단계 현장 검증 수수료 납기일이 3일 남았습니다.",
      actionLabel: "납부 정보 확인",
      href: "/payment/receipt",
      icon: "info",
      accentClassName: "border-l-orange-500"
    },
    {
      key: "gwangyang-recurring",
      badge: "RECURRING",
      badgeClassName: "bg-blue-500/20 text-blue-400",
      due: "D-15",
      title: "광양 제2: 유지보수 정기결제",
      body: "가상계좌 잔액 확인 및 정기 이체 준비가 필요합니다.",
      actionLabel: "잔액 충전",
      href: "/payment/virtual_account",
      icon: "account_balance_wallet",
      accentClassName: "border-l-blue-500"
    }
  ],
  workflowSteps: [],
  timelineEntries: [],
  searchPlaceholder: "가상계좌 번호, 사이트 명칭, 또는 입금자명을 검색하세요...",
  issueButtonLabel: "가상계좌 발급 요청",
  managedTitle: "관리 가상계좌 현황 (Managed Virtual Accounts)",
  managedBody: "각 사이트별 가상계좌 정보와 실시간 잔액을 투명하게 확인하십시오.",
  manageButtonLabel: "계좌 설정 관리",
  copiedLabel: "계좌번호가 복사되었습니다.",
  managedAccounts: [
    {
      key: "pohang",
      badge: "정상 계좌",
      badgeClassName: "border border-emerald-200 bg-emerald-100 text-emerald-700",
      bank: "기업은행",
      title: "포항 제1 열연공장",
      number: "120-10452-99-001",
      amountLabel: "현재 잔액 (Current Balance)",
      balance: "12,450,000",
      balanceClassName: "text-[var(--kr-gov-blue)]",
      cardClassName: "border-t-[var(--kr-gov-blue)]",
      headerClassName: "bg-blue-50/20",
      actions: [
        { label: "납부 실행", icon: "payments", href: "/payment/pay", className: "hover:bg-blue-600 hover:text-white" },
        { label: "명세서 출력", icon: "description", href: "/payment/receipt", className: "hover:bg-blue-600 hover:text-white" }
      ],
      ledger: [
        { label: "검증 수수료 정산", at: "2025.08.14 10:22", value: "- 2,500,000원", valueClassName: "text-red-500" },
        { label: "관리비 이체", at: "2025.08.10 15:45", value: "+ 5,000,000원", valueClassName: "text-blue-500" }
      ]
    },
    {
      key: "ulsan",
      badge: "납부 지연",
      badgeClassName: "border border-red-200 bg-red-100 text-red-700",
      bank: "우리은행",
      title: "울산 제3 화학기지",
      number: "333-02142-12-042",
      amountLabel: "현재 잔액 (Current Balance)",
      balance: "150,000",
      balanceClassName: "text-red-600",
      note: "※ 미납액(8,200,000원) 대비 잔액이 부족합니다.",
      cardClassName: "border-t-red-500 ring-2 ring-red-500/20",
      headerClassName: "bg-red-50/20",
      actions: [
        { label: "가상계좌 충전", icon: "account_balance_wallet", href: "/payment/virtual_account", className: "bg-red-600 text-white hover:bg-red-700" },
        { label: "납부 이력", icon: "history", href: "/payment/history", className: "hover:bg-red-600 hover:text-white" }
      ],
      ledger: [
        { label: "연체 가산금 부과", at: "3시간 전", value: "- 45,000원", valueClassName: "text-red-500" },
        { label: "관리 시스템 사용료", at: "2025.08.01", value: "- 8,155,000원", valueClassName: "text-red-500" }
      ]
    },
    {
      key: "gwangyang",
      badge: "기한 임박",
      badgeClassName: "border border-orange-200 bg-orange-100 text-orange-700",
      bank: "신한은행",
      title: "광양 제2 에너지센터",
      number: "110-882-942112",
      amountLabel: "현재 잔액 (Current Balance)",
      balance: "48,920,000",
      balanceClassName: "text-orange-600",
      cardClassName: "border-t-orange-400",
      headerClassName: "bg-orange-50/20",
      actions: [
        { label: "납부 공문 발송", icon: "forward_to_inbox", href: "/payment/receipt", className: "hover:bg-orange-600 hover:text-white" },
        { label: "청구서 조회", icon: "receipt", href: "/payment/history", className: "hover:bg-orange-600 hover:text-white" }
      ],
      ledger: [
        { label: "보고서 검토비 정산", at: "2일 전", value: "- 1,200,000원", valueClassName: "text-red-500" },
        { label: "예치금 입금", at: "2025.08.05", value: "+ 50,000,000원", valueClassName: "text-blue-500" }
      ]
    }
  ],
  siteSectionTitle: "기타 사이트 결제 현황",
  siteSectionMeta: "총 12개소",
  siteCards: [
    {
      key: "incheon",
      siteId: "IC-005",
      title: "인천 물류센터",
      balance: "2,452,000원",
      status: "완납",
      statusClassName: "text-emerald-600",
      actionLabel: "내역 상세",
      href: "/payment/history",
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
      href: "/payment/pay",
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
      href: "/payment/history",
      actionClassName: "border-gray-200 text-gray-600 hover:bg-gray-50"
    },
    {
      key: "new-account",
      title: "신규 계좌 연동",
      balance: "",
      status: "",
      statusClassName: "",
      actionLabel: "",
      actionClassName: "",
      addNew: true,
      href: "/payment/virtual_account"
    }
  ],
  reportTitle: "통합 자금 운영 리포트",
  reportBody: "관리 중인 모든 사이트의 결제 현황 및 가상계좌 총액 분석입니다.",
  reportUpdated: "최종 정산 업데이트: 2025.08.14 15:45",
  reportMetrics: [
    {
      key: "portfolio",
      title: "총 관리 자금 잔액",
      type: "progress",
      value: "345,120,000",
      unit: "KRW",
      delta: "▲ 12.2% (전월대비)",
      progressLabel: "이달 집행 예정액 (120,000,000원)",
      progressWidth: "34.7%"
    },
    {
      key: "distribution",
      title: "결제 상태별 분포",
      type: "bars",
      bars: [
        { label: "결제완료", value: "15", heightClassName: "h-32", barClassName: "bg-emerald-500" },
        { label: "청구됨", value: "4", heightClassName: "h-24", barClassName: "bg-orange-400" },
        { label: "미납/연체", value: "1", heightClassName: "h-12", barClassName: "bg-red-400" },
        { label: "대기중", value: "2", heightClassName: "h-16", barClassName: "bg-gray-300" }
      ]
    },
    {
      key: "score",
      title: "정산 신뢰도 및 준수율",
      type: "score",
      score: "94%",
      details: [
        { label: "기한 내 결제", value: "18건" },
        { label: "누적 연체", value: "1건" }
      ],
      badge: "우수 자금 관리 사업장"
    }
  ],
  footerOrg: "CCUS 통합금융관리본부",
  footerAddress: "(04551) 서울특별시 중구 세종대로 110",
  footerServiceLine: "결제 및 정산 지원팀 02-9876-5432",
  footerLinks: ["전자금융거래약관", "개인정보처리방침", "결제 매뉴얼 다운로드"],
  footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Dedicated Site Overseer Financial Portal.",
  footerLastModified: "최종 갱신",
  footerWaAlt: "웹 접근성 품질인증 마크"
};

const EN_CONTENT: LocaleContent = {
  governmentText: "Official Government Service | Payment & Settlement Support Center",
  governmentStatus: "Virtual Account Status: Normal",
  pageTitle: "Payment & Virtual Account Management",
  pageSubtitle: "Payment & Billing Control Center",
  roleLabel: "Settlement Manager",
  roleName: "Admin Lee Hyeon-jang",
  logoutLabel: "Logout",
  navItems: [
    { label: "Dashboard", href: "/payment/virtual_account", active: true },
    { label: "Payment History", href: "/payment/history" },
    { label: "Virtual Accounts", href: "/payment/virtual_account" },
    { label: "Certificates", href: "/payment/receipt" }
  ],
  heroType: "timeline",
  heroTitle: "Payment Assistant",
  heroSubtitle: "Guided Billing Workflow",
  workflowSteps: [
    { key: "step1", stepLabel: "Step 01", title: "Making a Payment", icon: "credit_score", active: true },
    { key: "step2", stepLabel: "Step 02", title: "Set up Virtual Account", icon: "account_balance" },
    { key: "step3", stepLabel: "Step 03", title: "View Payment History", icon: "history" }
  ],
  alertCards: [],
  timelineHeading: "Payment History Timeline",
  timelineActionLabel: "Download All Records",
  timelineActionHref: "/payment/history",
  timelineEntries: [
    {
      key: "pending",
      status: "Pending",
      statusClassName: "bg-red-500/20 text-red-400",
      icon: "pending_actions",
      timestamp: "2025-08-16 14:30",
      amount: "₩ 1,240,000",
      title: "Pohang Hot Rolling Mill 1 - August Monthly Emission Contribution",
      body: "Due Date: 2025-08-20 | Virtual Account: KB Bank 752901-04-123456",
      actions: [
        { label: "Copy Account Info", href: "/payment/virtual_account", primary: true },
        { label: "View Invoice", href: "/payment/receipt" }
      ]
    },
    {
      key: "completed",
      status: "Completed",
      statusClassName: "bg-emerald-500/20 text-emerald-400",
      icon: "check_circle",
      timestamp: "2025-08-12 09:15",
      amount: "₩ 890,000",
      title: "Ulsan Chemical Base 3 - Additional Verification Fee",
      body: "Payment Completed | Receipt No: RCP-20250812-091",
      actions: [
        { label: "Print Receipt", href: "/payment/receipt" }
      ]
    },
    {
      key: "scheduled",
      status: "Scheduled",
      statusClassName: "bg-blue-500/20 text-blue-400",
      icon: "info",
      timestamp: "2025-08-01 10:00",
      amount: "₩ 2,450,000",
      title: "Gwangyang Energy Center 2 - Annual Membership Renewal",
      body: "Auto-payment Date: 2025-09-01",
      actions: [
        { label: "Manage Auto-pay", href: "/payment/pay" }
      ]
    }
  ],
  searchPlaceholder: "Search facility code, billing number, or virtual account number...",
  issueButtonLabel: "Issue New Virtual Account",
  managedTitle: "Active Virtual Accounts",
  managedBody: "Status of virtual accounts frequently used by facility.",
  managedMetaLabel: "Payment Assistant Active",
  managedMetaValue: "Manage",
  manageButtonLabel: "Manage",
  copiedLabel: "Account number copied.",
  managedAccounts: [
    {
      key: "pohang",
      badge: "Safe",
      badgeClassName: "border border-emerald-200 bg-emerald-100 text-emerald-700",
      bank: "Pohang Hot Rolling Mill 1",
      title: "Pohang Hot Rolling Mill 1",
      number: "Urgent amount due: KRW 1.24M",
      amountLabel: "Total Accumulated Payment",
      balance: "15,420,000",
      balanceClassName: "text-[var(--kr-gov-blue)]",
      cardClassName: "border-t-emerald-300",
      headerClassName: "bg-white",
      actions: [
        { label: "Account Info", icon: "account_balance", href: "/payment/virtual_account", className: "hover:bg-blue-600 hover:text-white" },
        { label: "Receipts", icon: "receipt", href: "/payment/receipt", className: "hover:bg-blue-600 hover:text-white" }
      ],
      ledger: [
        { label: "Recent Issued Charge", at: "₩ 240,000", value: "Pay Now", valueClassName: "text-[var(--kr-gov-blue)]" },
        { label: "July Payment Confirmed", at: "Approved", value: "", valueClassName: "text-slate-400" }
      ],
      trend: "rise"
    },
    {
      key: "ulsan",
      badge: "Attention Payment",
      badgeClassName: "border border-orange-200 bg-orange-100 text-orange-700",
      bank: "Ulsan Chemical Base 3",
      title: "Ulsan Chemical Base 3",
      number: "Account expires in 6 days.",
      amountLabel: "Amount Due",
      balance: "890,000",
      balanceClassName: "text-orange-600",
      note: "Payment Method Changed",
      cardClassName: "border-t-orange-300",
      headerClassName: "bg-white",
      actions: [
        { label: "Go to Payment", icon: "payments", href: "/payment/pay", className: "bg-orange-500 text-white hover:bg-orange-600" },
        { label: "Payment History", icon: "history", href: "/payment/history", className: "hover:bg-orange-500 hover:text-white" }
      ],
      ledger: [
        { label: "Virtual Account Re-Issued", at: "Required", value: "", valueClassName: "text-slate-400" },
        { label: "Payment Method Changed", at: "Pending", value: "", valueClassName: "text-slate-400" }
      ],
      trend: "fall"
    },
    {
      key: "gwangyang",
      badge: "Processing",
      badgeClassName: "border border-blue-200 bg-blue-100 text-blue-700",
      bank: "Gwangyang Energy Center 2",
      title: "Gwangyang Energy Center 2",
      number: "Annual membership setup approved.",
      amountLabel: "Total Budget Balance",
      balance: "42,890,000",
      balanceClassName: "text-[var(--kr-gov-blue)]",
      cardClassName: "border-t-blue-300",
      headerClassName: "bg-white",
      actions: [
        { label: "Settlement Status", icon: "monitoring", href: "/payment/history", className: "hover:bg-blue-600 hover:text-white" },
        { label: "Invoice", icon: "description", href: "/payment/receipt", className: "hover:bg-blue-600 hover:text-white" }
      ],
      ledger: [
        { label: "Audit Data Generation Complete", at: "Review ready", value: "", valueClassName: "text-slate-400" },
        { label: "Payment Limit Increase Approved", at: "Done", value: "", valueClassName: "text-slate-400" }
      ],
      trend: "rise"
    }
  ],
  siteSectionTitle: "Annual Payment & Budget Report",
  siteSectionMeta: "Overview of payment statistics and budget utilization for all managed facilities.",
  siteCards: [],
  reportTitle: "Annual Payment & Budget Report",
  reportBody: "Overview of payment statistics and budget utilization for all managed facilities.",
  reportUpdated: "Last Synchronized: 2025.08.16 09:30",
  reportMetrics: [
    {
      key: "cumulative",
      title: "Cumulative Payments vs Budget Goal",
      type: "progress",
      value: "124,510,000",
      unit: "",
      delta: "▼ 2.5% Under Budget",
      progressLabel: "Annual Budget Limit (KRW 150,000,000)",
      progressWidth: "83.0%"
    },
    {
      key: "method-distribution",
      title: "Distribution by Payment Method",
      type: "bars",
      bars: [
        { label: "Virtual Acc.", value: "45%", heightClassName: "h-16", barClassName: "bg-slate-400" },
        { label: "Corp Card", value: "28%", heightClassName: "h-10", barClassName: "bg-slate-300" },
        { label: "Auto Debit", value: "15%", heightClassName: "h-6", barClassName: "bg-slate-200" },
        { label: "Other", value: "12%", heightClassName: "h-5", barClassName: "bg-slate-200" }
      ]
    },
    {
      key: "on-time-rate",
      title: "On-time Payment Rate",
      type: "score",
      score: "95%",
      details: [
        { label: "On time", value: "42 cases" },
        { label: "Delayed", value: "2 cases" }
      ],
      badge: "Excellent Control"
    }
  ],
  footerOrg: "CCUS Settlement HQ",
  footerAddress: "(04551) 10 Sejong-daero, Jung-gu, Seoul",
  footerServiceLine: "Payment Support: +82-2-9876-5432",
  footerLinks: ["Privacy Policy", "Terms of Payment", "Virtual Account Guide"],
  footerCopyright: "© 2025 CCUS Carbonet. Payment & Billing Portal.",
  footerLastModified: "Last synchronized",
  footerWaAlt: "Web accessibility quality mark"
};

const CONTENT = {
  ko: KO_CONTENT,
  en: EN_CONTENT
} as const;

function PaymentSearchBar(props: {
  placeholder: string;
  buttonLabel: string;
  query: string;
  onQueryChange: (value: string) => void;
  onIssue: () => void;
}) {
  return (
    <section className="relative z-20 mx-auto -mt-8 max-w-[1440px] px-4 lg:px-8">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-2xl md:flex-row">
        <div className="relative w-full flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
          <input
            className="h-14 w-full rounded-lg border-none bg-gray-50 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[var(--kr-gov-blue)]"
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder={props.placeholder}
            value={props.query}
          />
        </div>
        <div className="flex w-full gap-2 md:w-auto">
          <button
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--kr-gov-blue)] px-6 font-bold text-white transition-colors hover:bg-[var(--kr-gov-blue-hover)] md:flex-none"
            onClick={props.onIssue}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">add_card</span>
            {props.buttonLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function TrendLine({ trend }: { trend?: "rise" | "fall" | "flat" }) {
  if (!trend) {
    return null;
  }
  if (trend === "rise") {
    return (
      <svg className="h-10 w-24" fill="none" viewBox="0 0 96 40">
        <path d="M4 28C18 28 22 18 34 18C46 18 50 8 62 8C74 8 78 4 92 4" stroke="#3b82f6" strokeLinecap="round" strokeWidth="3" />
        <path d="M4 32C18 32 22 24 34 24C46 24 50 16 62 16C74 16 78 10 92 10" opacity="0.2" stroke="#3b82f6" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }
  if (trend === "fall") {
    return (
      <svg className="h-10 w-24" fill="none" viewBox="0 0 96 40">
        <path d="M4 8C18 8 22 14 34 14C46 14 50 22 62 22C74 22 78 28 92 28" stroke="#f97316" strokeLinecap="round" strokeWidth="3" />
        <path d="M4 14C18 14 22 20 34 20C46 20 50 28 62 28C74 28 78 34 92 34" opacity="0.2" stroke="#f97316" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }
  return (
    <svg className="h-10 w-24" fill="none" viewBox="0 0 96 40">
      <path d="M4 20H92" stroke="#94a3b8" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

export function PaymentVirtualAccountMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [query, setQuery] = useState("");
  const [copiedAccount, setCopiedAccount] = useState("");

  const filteredAccounts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return content.managedAccounts;
    }
    return content.managedAccounts.filter((account) =>
      [account.title, account.bank, account.number].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [content.managedAccounts, query]);

  const filteredSiteCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return content.siteCards;
    }
    return content.siteCards.filter((site) => {
      if (site.addNew) {
        return true;
      }
      return [site.title, site.siteId || ""].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [content.siteCards, query]);

  useEffect(() => {
    logGovernanceScope("PAGE", "payment-virtual-account", {
      language: en ? "en" : "ko",
      query,
      filteredAccounts: filteredAccounts.length
    });
  }, [en, filteredAccounts.length, query]);

  function localizedPath(koPath: string) {
    return buildLocalizedPath(koPath, `/en${koPath}`);
  }

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

      <header className="sticky top-0 z-40 border-b border-[var(--kr-gov-border-light)] bg-white shadow-sm">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
          <div className="flex h-20 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button className="flex items-center gap-2 text-left" onClick={() => navigate(localizedPath("/home"))} type="button">
                <span className="material-symbols-outlined text-[36px] font-bold text-[var(--kr-gov-blue)]">
                  {en ? "account_balance_wallet" : "account_balance"}
                </span>
                <div className="flex flex-col">
                  <h1 className="leading-tight text-xl font-black tracking-tight">{content.pageTitle}</h1>
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-text-secondary)]">{content.pageSubtitle}</p>
                </div>
              </button>
            </div>

            <nav className="ml-12 hidden h-full flex-1 items-center space-x-1 xl:flex">
              {content.navItems.map((item) => (
                <button
                  className={`flex h-full items-center border-b-4 px-4 text-[16px] font-bold transition-all ${
                    item.active
                      ? "border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)]"
                      : "border-transparent text-gray-500 hover:text-[var(--kr-gov-blue)]"
                  }`}
                  key={item.label}
                  onClick={() => navigate(localizedPath(item.href))}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-4">
              <UserLanguageToggle
                en={en}
                onEn={() => navigate("/en/payment/virtual_account")}
                onKo={() => navigate("/payment/virtual_account")}
              />
              <div className="hidden text-right md:block">
                <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{content.roleLabel}</span>
                <p className="text-sm font-black">{content.roleName}</p>
              </div>
              <MemberButton className="!bg-[var(--kr-gov-blue)] !px-4 !py-2.5 !text-white hover:!bg-[var(--kr-gov-blue-hover)]" onClick={() => void session.logout()} type="button">
                {content.logoutLabel}
              </MemberButton>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-900 py-10" data-help-id="payment-virtual-account-hero">
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <svg height="100%" width="100%">
              <pattern height="60" id="virtual-account-dots" patternUnits="userSpaceOnUse" width="60">
                <circle cx="2" cy="2" fill="white" r="1" />
              </pattern>
              <rect fill="url(#virtual-account-dots)" height="100%" width="100%" />
            </svg>
          </div>
          <div className="relative z-10 mx-auto max-w-[1440px] px-4 lg:px-8">
            {content.heroType === "alerts" ? (
              <div className="flex flex-col items-start gap-8 xl:flex-row">
                <div className="xl:w-1/4">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/20">
                      <span className="material-symbols-outlined text-[28px] text-white">payments</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">{content.heroTitle}</h2>
                      <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                        {content.heroSubtitle}
                      </p>
                    </div>
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-slate-400">
                    {content.heroDescription}
                  </p>
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 py-3 text-sm font-bold text-white transition-all hover:bg-white/15"
                    onClick={() => navigate(localizedPath(content.heroButtonHref || "/payment/history"))}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">receipt_long</span>
                    {content.heroButtonLabel}
                  </button>
                </div>
                <div className="w-full xl:w-3/4">
                  <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                    <span className="material-symbols-outlined text-[16px]">priority_high</span>
                    {content.alertsHeading}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {content.alertCards.map((alert) => (
                      <article
                        className={`group relative flex min-h-[182px] cursor-pointer flex-col overflow-hidden rounded-r-lg border ${alert.accentClassName} border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all hover:bg-white/10`}
                        key={alert.key}
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${alert.badgeClassName}`}>{alert.badge}</span>
                          <span className="text-[10px] font-bold tracking-tighter text-slate-500">{alert.due}</span>
                        </div>
                        <h4 className="mb-1 text-sm font-bold text-white">{alert.title}</h4>
                        <p className="mb-4 text-[11px] text-slate-400">{alert.body}</p>
                        <button
                          className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300"
                          onClick={() => navigate(localizedPath(alert.href))}
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
            ) : (
              <div className="flex flex-col items-start gap-12 xl:flex-row">
                <div className="xl:w-1/3">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
                      <span className="material-symbols-outlined text-[28px] text-white">payments</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">{content.heroTitle}</h2>
                      <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.28em] text-indigo-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                        {content.heroSubtitle}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {content.workflowSteps.map((step) => (
                      <button
                        className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                          step.active
                            ? "border-indigo-500/30 bg-indigo-600 text-white hover:bg-indigo-700"
                            : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                        key={step.key}
                        onClick={() => navigate(localizedPath("/payment/virtual_account"))}
                        type="button"
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${step.active ? "bg-white/20 group-hover:bg-white/30" : "bg-white/10 group-hover:bg-white/20"}`}>
                          <span className="material-symbols-outlined">{step.icon}</span>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase opacity-70">{step.stepLabel}</div>
                          <div className="text-sm font-bold">{step.title}</div>
                        </div>
                        <span className="material-symbols-outlined ml-auto opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100">chevron_right</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-full xl:w-2/3">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                      <span className="material-symbols-outlined text-[16px]">timeline</span>
                      {content.timelineHeading}
                    </h3>
                    <button className="text-[11px] font-bold text-indigo-400 hover:underline" onClick={() => navigate(localizedPath(content.timelineActionHref || "/payment/history"))} type="button">
                      {content.timelineActionLabel}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {content.timelineEntries.map((entry, index) => (
                      <div className="group relative flex gap-6" key={entry.key}>
                        {index !== content.timelineEntries.length - 1 ? (
                          <div className="absolute left-[21px] top-8 h-[calc(100%-24px)] w-[2px] bg-slate-700/50" />
                        ) : null}
                        <div className="relative z-10 flex flex-col items-center">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-full border-4 border-slate-900 ${entry.statusClassName.replace("text-", "bg-").replace("/20", "/20")}`}>
                            <span className={`material-symbols-outlined text-[20px] ${entry.statusClassName.split(" ")[1] || "text-white"} ${entry.icon === "pending_actions" ? "animate-pulse" : ""}`}>
                              {entry.icon}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 cursor-pointer rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/10">
                          <div className="mb-2 flex items-start justify-between">
                            <div>
                              <span className={`mr-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${entry.statusClassName}`}>{entry.status}</span>
                              <span className="text-[11px] font-bold text-slate-400">{entry.timestamp}</span>
                            </div>
                            <div className="text-right text-lg font-black text-white">{entry.amount}</div>
                          </div>
                          <h4 className="mb-1 text-base font-bold text-white">{entry.title}</h4>
                          <p className="mb-4 text-xs text-slate-400">{entry.body}</p>
                          <div className="flex flex-wrap gap-3">
                            {entry.actions.map((action) => (
                              <button
                                className={`rounded-lg px-4 py-2 text-[11px] font-bold ${
                                  action.primary
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                    : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                                }`}
                                key={action.label}
                                onClick={() => navigate(localizedPath(action.href))}
                                type="button"
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <div data-help-id="payment-virtual-account-search">
        <PaymentSearchBar
          buttonLabel={content.issueButtonLabel}
          onIssue={() => navigate(localizedPath("/payment/virtual_account"))}
          onQueryChange={setQuery}
          placeholder={content.searchPlaceholder}
          query={query}
        />
        </div>

        <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8" data-help-id="payment-virtual-account-managed">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-black">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">account_balance</span>
                {content.managedTitle}
              </h2>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{content.managedBody}</p>
            </div>
            {content.managedMetaLabel ? (
              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 md:flex">
                  <span className="material-symbols-outlined text-[18px] text-indigo-500">bolt</span>
                  <span className="text-[11px] font-bold leading-none text-indigo-700">{content.managedMetaLabel}</span>
                </div>
                <button className="text-xs font-bold text-gray-400 transition-colors hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(localizedPath("/payment/virtual_account"))} type="button">
                  {content.manageButtonLabel}
                </button>
              </div>
            ) : (
              <button className="flex items-center gap-1 text-xs font-bold text-gray-400 transition-colors hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(localizedPath("/payment/virtual_account"))} type="button">
                <span className="material-symbols-outlined text-[18px]">settings</span>
                {content.manageButtonLabel}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {filteredAccounts.map((account) => (
              <article className={`flex h-full flex-col rounded-[20px] border border-[var(--kr-gov-border-light)] bg-white shadow-md ${account.cardClassName}`} key={account.key}>
                <div className={`flex items-start justify-between border-b border-gray-100 p-6 ${account.headerClassName}`}>
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${account.badgeClassName}`}>{account.badge}</span>
                      <span className="text-[10px] font-bold text-gray-400">{account.bank}</span>
                    </div>
                    <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{account.title}</h3>
                    <p className={`${en ? "text-[11px] font-medium" : "text-sm font-mono"} mt-1 text-gray-500`}>{account.number}</p>
                  </div>
                  <button className="text-gray-300 transition-colors hover:text-[var(--kr-gov-blue)]" onClick={() => void handleCopy(account.number)} type="button">
                    <span className="material-symbols-outlined">content_copy</span>
                  </button>
                </div>
                <div className="flex flex-1 flex-col justify-between p-6">
                  <div className="space-y-8">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">{account.amountLabel}</p>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-black tracking-tighter ${account.balanceClassName}`}>{account.balance}</span>
                        <span className="text-sm font-bold text-gray-400">{en ? "KRW" : "KRW"}</span>
                      </div>
                      {account.note ? <p className={`mt-1 text-[10px] font-bold ${en ? "text-orange-500" : "text-red-500"}`}>{account.note}</p> : null}
                      {copiedAccount === account.number ? <p className="mt-2 text-[11px] font-bold text-emerald-600">{content.copiedLabel}</p> : null}
                    </div>

                    {en && account.trend ? (
                      <div className="flex justify-end">
                        <TrendLine trend={account.trend} />
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                      {account.actions.map((action) => (
                        <button
                          className={`flex flex-col items-center justify-center rounded-xl bg-gray-50 p-4 text-[12px] font-bold text-gray-600 transition-all ${action.className}`}
                          key={action.label}
                          onClick={() => navigate(localizedPath(action.href))}
                          type="button"
                        >
                          <span className="material-symbols-outlined mb-1">{action.icon}</span>
                          {action.label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        {!en ? <span className="h-1 w-1 rounded-full bg-gray-400" /> : null}
                        {en ? "Recent Billing Feed" : "최근 입출금 내역"}
                      </p>
                      <ul className="space-y-4">
                        {account.ledger.map((item) => (
                          <li className="flex items-center justify-between text-xs" key={`${account.key}-${item.label}`}>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-700">{item.label}</span>
                              <span className="text-gray-400">{item.at}</span>
                            </div>
                            {item.value ? <span className={`font-black ${item.valueClassName}`}>{item.value}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {!en ? (
          <section className="mx-auto max-w-[1440px] px-4 pb-16 lg:px-8" data-help-id="payment-virtual-account-sites">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-700">
                {content.siteSectionTitle}
                <span className="ml-2 text-sm font-normal text-gray-400">{content.siteSectionMeta}</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {filteredSiteCards.map((site) => (
                site.addNew ? (
                  <button
                    className="group flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-6 transition-all hover:border-[var(--kr-gov-blue)] hover:bg-white"
                    key={site.key}
                    onClick={() => navigate(localizedPath(site.href || "/payment/virtual_account"))}
                    type="button"
                  >
                    <span className="material-symbols-outlined mb-2 text-[32px] text-gray-300 transition-colors group-hover:text-[var(--kr-gov-blue)]">account_balance</span>
                    <span className="text-xs font-bold text-gray-400 transition-colors group-hover:text-[var(--kr-gov-blue)]">{site.title}</span>
                  </button>
                ) : (
                  <article className="gov-card transition-colors hover:border-blue-400" key={site.key}>
                    <div className="border-b border-gray-100 p-4">
                      <span className="text-[10px] font-bold text-gray-400">ID: {site.siteId}</span>
                      <h4 className="font-bold text-gray-800">{site.title}</h4>
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div className="mb-4 space-y-2 text-xs">
                        <div className="flex justify-between"><span className="text-gray-500">잔액</span><span className="font-bold">{site.balance}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">상태</span><span className={`font-bold ${site.statusClassName}`}>{site.status}</span></div>
                      </div>
                      <button
                        className={`w-full rounded border px-3 py-2.5 text-xs font-bold transition ${site.actionClassName}`}
                        onClick={() => navigate(localizedPath(site.href || "/payment/history"))}
                        type="button"
                      >
                        {site.actionLabel}
                      </button>
                    </div>
                  </article>
                )
              ))}
            </div>
          </section>
        ) : null}

        <section className="border-y border-gray-200 bg-white py-16" data-help-id="payment-virtual-account-report">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-black">{content.reportTitle}</h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{content.reportBody}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                <span className="material-symbols-outlined text-[16px]">update</span>
                {content.reportUpdated}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {content.reportMetrics.map((metric) => (
                <article className="rounded-xl border border-gray-100 bg-gray-50 p-6" key={metric.key}>
                  <h3 className="mb-6 text-sm font-bold text-gray-600">{metric.title}</h3>
                  {metric.type === "progress" ? (
                    <>
                      <div className="mb-6 flex items-baseline gap-2">
                        <span className="text-4xl font-black tracking-tight text-[var(--kr-gov-blue)]">{metric.value}</span>
                        {metric.unit ? <span className="text-sm font-bold text-gray-400">{metric.unit}</span> : null}
                        <span className={`ml-auto text-sm font-bold ${en ? "text-emerald-600" : "text-emerald-600"}`}>{metric.delta}</span>
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
                    </>
                  ) : null}

                  {metric.type === "bars" ? (
                    <div className="flex h-32 items-end gap-4">
                      {metric.bars.map((bar) => (
                        <div className="flex flex-1 flex-col items-center" key={`${metric.key}-${bar.label}`}>
                          <div className="mb-2 text-[11px] font-black">{bar.value}</div>
                          <div className={`w-full rounded-t-lg ${bar.heightClassName} ${bar.barClassName}`} />
                          <div className="mt-3 whitespace-nowrap text-[10px] font-bold text-gray-400">{bar.label}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {metric.type === "score" ? (
                    <div className="flex items-center gap-6">
                      <div className="relative h-24 w-24">
                        <svg className="h-full w-full -rotate-90">
                          <circle className="text-white" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                          <circle
                            className="text-emerald-500"
                            cx="48"
                            cy="48"
                            fill="transparent"
                            r="40"
                            stroke="currentColor"
                            strokeDasharray="251"
                            strokeDashoffset={metric.score === "95%" ? "13" : "30"}
                            strokeLinecap="round"
                            strokeWidth="8"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xl font-black">{metric.score}</div>
                      </div>
                      <div className="flex-1 space-y-2">
                        {metric.details.map((detail) => (
                          <div className="flex justify-between text-xs" key={detail.label}>
                            <span className="text-gray-500">{detail.label}</span>
                            <span className="font-bold">{detail.value}</span>
                          </div>
                        ))}
                        <div className="mt-4 inline-flex items-center gap-1 rounded bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                          <span className="material-symbols-outlined text-[14px]">verified_user</span>
                          {metric.badge}
                        </div>
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
