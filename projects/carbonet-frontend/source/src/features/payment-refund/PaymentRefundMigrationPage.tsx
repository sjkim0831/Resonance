import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeInput, HomeSelect, HomeTable } from "../home-ui/common";

type NavItem = {
  label: string;
  href: string;
  current?: boolean;
};

type QueueCard = {
  key: string;
  badge: string;
  badgeClassName: string;
  requestId: string;
  title: string;
  body: string;
  actionLabel: string;
  actionIcon: string;
  href: string;
  accentClassName: string;
};

type TableStatus = "pending" | "verifying" | "completed" | "denied";

type RefundRow = {
  key: string;
  requestedDate: string;
  requestedTime: string;
  customerName: string;
  customerId: string;
  orderTitle: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  status: TableStatus;
  primaryAction?: { label: string; toneClassName: string };
  secondaryAction: { label: string; toneClassName: string };
  tertiaryAction?: { label: string; toneClassName: string };
};

type ReasonBar = {
  label: string;
  value: string;
  heightClassName: string;
  barClassName: string;
};

type SlaMetric = {
  complianceRate: string;
  dashOffset: string;
  sameDayCount: string;
  delayedCount: string;
  badge: string;
};

type LocalizedContent = {
  skipToContent: string;
  pageTitle: string;
  governmentText: string;
  governmentStatus: string;
  brandTitle: string;
  brandSubtitle: string;
  navItems: NavItem[];
  roleLabel: string;
  roleName: string;
  heroTitle: string;
  heroBody: string;
  heroButton: string;
  urgentLabel: string;
  urgentTitle: string;
  searchPlaceholder: string;
  searchStatusAll: string;
  searchStatusOptions: Array<{ value: TableStatus | "all"; label: string }>;
  filterButton: string;
  requestsTitle: string;
  requestsBody: string;
  syncedLabel: string;
  downloadLabel: string;
  tableHeaders: {
    requestedAt: string;
    customer: string;
    order: string;
    amount: string;
    status: string;
    action: string;
  };
  statusLabels: Record<TableStatus, string>;
  pageSummary: string;
  pageNumbers: string[];
  monitoringTitle: string;
  monitoringBody: string;
  monitoringUpdated: string;
  totalRefundTitle: string;
  totalRefundValue: string;
  totalRefundChange: string;
  budgetLabel: string;
  budgetValue: string;
  distributionTitle: string;
  slaTitle: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
  footerLinks: string[];
  logoutLabel: string;
  queueIntroLabel: string;
  queueIntroBody: string;
  queueRiskHighlight: string;
  queueCards: QueueCard[];
  rows: RefundRow[];
  reasonBars: ReasonBar[];
  slaMetric: SlaMetric;
};

const STATUS_CLASS_NAME: Record<TableStatus, string> = {
  pending: "border-orange-200 bg-orange-50 text-orange-600",
  verifying: "border-blue-200 bg-blue-50 text-blue-600",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-600",
  denied: "border-red-200 bg-red-50 text-red-600"
};

const CONTENT: Record<"ko" | "en", LocalizedContent> = {
  ko: {
    skipToContent: "본문 바로가기",
    pageTitle: "결제 환불 관리 센터",
    governmentText: "대한민국 정부 공식 서비스 | 환불 관리 지원 포털",
    governmentStatus: "실시간 요청 감지: 활성화됨",
    brandTitle: "결제 환불 관리 센터",
    brandSubtitle: "Refund Management System",
    navItems: [
      { label: "환불 요청 목록", href: "/payment/refund", current: true },
      { label: "정산 통계", href: "/monitoring/statistics" },
      { label: "고객 상담 이력", href: "/monitoring/share" },
      { label: "시스템 설정", href: "/payment/refund_account" }
    ],
    roleLabel: "CS 전담 감독관",
    roleName: "김환불 매니저님",
    heroTitle: "처리 대기 비서",
    heroBody: "AI가 긴급도가 높은 환불 요청을 우선 순위화했습니다.",
    heroButton: "일괄 처리 모드",
    urgentLabel: "긴급 처리 큐",
    urgentTitle: "High Priority",
    searchPlaceholder: "주문 번호, 고객명, 또는 이메일을 입력하세요...",
    searchStatusAll: "모든 상태",
    searchStatusOptions: [
      { value: "all", label: "모든 상태" },
      { value: "pending", label: "승인 대기" },
      { value: "verifying", label: "서류 확인중" },
      { value: "completed", label: "환불 완료" },
      { value: "denied", label: "환불 불가" }
    ],
    filterButton: "필터 적용",
    requestsTitle: "환불 요청 데이터 (Refund Requests)",
    requestsBody: "실시간 접수된 환불 건을 관리하고 처리 결과를 업데이트합니다.",
    syncedLabel: "방금 전 데이터 동기화 완료",
    downloadLabel: "엑셀 다운로드",
    tableHeaders: {
      requestedAt: "요청 일시",
      customer: "고객명 / ID",
      order: "주문 정보",
      amount: "금액",
      status: "상태",
      action: "액션"
    },
    statusLabels: {
      pending: "승인 대기",
      verifying: "서류 확인중",
      completed: "환불 완료",
      denied: "환불 불가"
    },
    pageSummary: "총 154건 중 1-20건 표시",
    pageNumbers: ["1", "2", "3", "8"],
    monitoringTitle: "환불 처리 성과 모니터링",
    monitoringBody: "부서별 환불 처리 목표 및 SLA 준수 현황입니다.",
    monitoringUpdated: "마지막 동기화: 2025.08.14 15:45",
    totalRefundTitle: "이번 달 환불 총액",
    totalRefundValue: "₩ 42,850,000",
    totalRefundChange: "▲ 12.4% (전월대비)",
    budgetLabel: "환불 예산 대비 소진율 (80,000,000원)",
    budgetValue: "53.5%",
    distributionTitle: "요청 사유별 분포",
    slaTitle: "SLA 처리 준수율 (24시간 이내)",
    footerOrg: "CCUS 결제통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 환불 고충 센터: 1588-1234",
    footerServiceLine: "본 시스템은 정부 결제 가이드라인 및 공정거래위원회의 환불 정책을 준수합니다.",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Refund Management Overseer Portal.",
    footerLastModifiedLabel: "최종 수정일",
    footerWaAlt: "웹 접근성 품질인증 마크",
    footerLinks: ["환불 정책 안내", "이용약관", "CS 매뉴얼"],
    logoutLabel: "로그아웃",
    queueIntroLabel: "Smart Queue",
    queueIntroBody: "5건의 고위험 요청이 검토를 기다리고 있습니다.",
    queueRiskHighlight: "고위험 요청",
    queueCards: [
      {
        key: "req-882",
        badge: "24H EXPIRED",
        badgeClassName: "bg-red-500/20 text-red-400",
        requestId: "REQ-882",
        title: "VIP 고객: 박영희",
        body: "이중 결제 오류로 인한 즉시 전액 환불 요청",
        actionLabel: "즉시 검토",
        actionIcon: "arrow_forward",
        href: "/payment/history",
        accentClassName: "border-l-red-500"
      },
      {
        key: "req-741",
        badge: "DISPUTE",
        badgeClassName: "bg-orange-500/20 text-orange-400",
        requestId: "REQ-741",
        title: "고액 건: (주)솔루션",
        body: "서비스 미이용에 따른 위약금 면제 요청",
        actionLabel: "상세 보기",
        actionIcon: "open_in_new",
        href: "/payment/history",
        accentClassName: "border-l-orange-500"
      },
      {
        key: "req-901",
        badge: "VERIFY",
        badgeClassName: "bg-blue-500/20 text-blue-400",
        requestId: "REQ-901",
        title: "서류 보완: 김철수",
        body: "통장 사본 확인 필요 (진위 여부 체크 대기)",
        actionLabel: "서류 확인",
        actionIcon: "fact_check",
        href: "/payment/refund_account",
        accentClassName: "border-l-blue-500"
      },
      {
        key: "req-112",
        badge: "RECURRING",
        badgeClassName: "bg-emerald-500/20 text-emerald-400",
        requestId: "REQ-112",
        title: "반복 요청: 이지은",
        body: "최근 3개월 내 4번째 환불. 어뷰징 확인 필요",
        actionLabel: "분석 리포트",
        actionIcon: "trending_up",
        href: "/monitoring/statistics",
        accentClassName: "border-l-emerald-500"
      }
    ],
    rows: [
      {
        key: "ord-00123",
        requestedDate: "2025-08-14",
        requestedTime: "14:22:10",
        customerName: "이현우",
        customerId: "user_29384",
        orderTitle: "배출권 통합 패키지 A",
        orderId: "#ORD-2025-00123",
        amount: 1250000,
        paymentMethod: "카드 취소 (신한)",
        status: "pending",
        primaryAction: { label: "승인", toneClassName: "bg-emerald-600 text-white hover:bg-emerald-700" },
        secondaryAction: { label: "거절", toneClassName: "bg-red-500 text-white hover:bg-red-600" },
        tertiaryAction: { label: "상세", toneClassName: "border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200" }
      },
      {
        key: "ord-00088",
        requestedDate: "2025-08-14",
        requestedTime: "11:05:45",
        customerName: "박영희",
        customerId: "vip_gold_park",
        orderTitle: "컨설팅 1:1 세션 3회",
        orderId: "#ORD-2025-00088",
        amount: 3420000,
        paymentMethod: "무통장 입금",
        status: "verifying",
        primaryAction: { label: "승인", toneClassName: "bg-emerald-600 text-white hover:bg-emerald-700" },
        secondaryAction: { label: "거절", toneClassName: "bg-red-500 text-white hover:bg-red-600" },
        tertiaryAction: { label: "상세", toneClassName: "border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200" }
      },
      {
        key: "ord-00110",
        requestedDate: "2025-08-13",
        requestedTime: "17:40:22",
        customerName: "김철수",
        customerId: "user_10292",
        orderTitle: "구독 서비스 (월간)",
        orderId: "#ORD-2025-00110",
        amount: 89000,
        paymentMethod: "간편결제 (Naver)",
        status: "completed",
        secondaryAction: { label: "처리완료", toneClassName: "bg-gray-200 text-gray-400" },
        tertiaryAction: { label: "영수증", toneClassName: "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" }
      },
      {
        key: "ord-00052",
        requestedDate: "2025-08-13",
        requestedTime: "09:12:00",
        customerName: "(주)데이터솔루션",
        customerId: "biz_client_04",
        orderTitle: "API 연동 라이선스",
        orderId: "#ORD-2025-00052",
        amount: 5500000,
        paymentMethod: "계좌이체",
        status: "denied",
        secondaryAction: { label: "재검토", toneClassName: "border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200" },
        tertiaryAction: { label: "사유 보기", toneClassName: "border border-red-200 bg-white text-red-600 hover:bg-red-50" }
      }
    ],
    reasonBars: [
      { label: "단순변심", value: "45%", heightClassName: "h-28", barClassName: "bg-emerald-500" },
      { label: "결제오류", value: "28%", heightClassName: "h-20", barClassName: "bg-orange-400" },
      { label: "서비스불만", value: "15%", heightClassName: "h-14", barClassName: "bg-blue-400" },
      { label: "기타", value: "12%", heightClassName: "h-12", barClassName: "bg-gray-300" }
    ],
    slaMetric: {
      complianceRate: "92%",
      dashOffset: "25",
      sameDayCount: "142건",
      delayedCount: "12건",
      badge: "서비스 품질 우수 유지중"
    }
  },
  en: {
    skipToContent: "Skip to main content",
    pageTitle: "Payment Refund Management Center",
    governmentText: "Republic of Korea Official Service | Refund Management Support Portal",
    governmentStatus: "Real-time request detection: enabled",
    brandTitle: "Payment Refund Management Center",
    brandSubtitle: "Refund Management System",
    navItems: [
      { label: "Refund Requests", href: "/payment/refund", current: true },
      { label: "Settlement Statistics", href: "/monitoring/statistics" },
      { label: "Consultation History", href: "/monitoring/share" },
      { label: "System Settings", href: "/payment/refund_account" }
    ],
    roleLabel: "CS Supervisor",
    roleName: "Manager Kim Refund",
    heroTitle: "Processing Queue Assistant",
    heroBody: "AI prioritized refund requests with the highest urgency.",
    heroButton: "Batch Processing Mode",
    urgentLabel: "Urgent Queue",
    urgentTitle: "High Priority",
    searchPlaceholder: "Enter order number, customer name, or email...",
    searchStatusAll: "All statuses",
    searchStatusOptions: [
      { value: "all", label: "All statuses" },
      { value: "pending", label: "Awaiting approval" },
      { value: "verifying", label: "Verifying documents" },
      { value: "completed", label: "Refund completed" },
      { value: "denied", label: "Refund denied" }
    ],
    filterButton: "Apply Filter",
    requestsTitle: "Refund Requests Data",
    requestsBody: "Manage live refund requests and update processing outcomes.",
    syncedLabel: "Data sync completed just now",
    downloadLabel: "Export Excel",
    tableHeaders: {
      requestedAt: "Requested At",
      customer: "Customer / ID",
      order: "Order Info",
      amount: "Amount",
      status: "Status",
      action: "Action"
    },
    statusLabels: {
      pending: "Awaiting approval",
      verifying: "Verifying documents",
      completed: "Refund completed",
      denied: "Refund denied"
    },
    pageSummary: "Showing 1-20 of 154 requests",
    pageNumbers: ["1", "2", "3", "8"],
    monitoringTitle: "Refund Performance Monitoring",
    monitoringBody: "Department-level refund targets and SLA compliance status.",
    monitoringUpdated: "Last sync: 2025.08.14 15:45",
    totalRefundTitle: "Total Refund Amount This Month",
    totalRefundValue: "KRW 42,850,000",
    totalRefundChange: "+12.4% vs previous month",
    budgetLabel: "Budget consumption against refund budget (KRW 80,000,000)",
    budgetValue: "53.5%",
    distributionTitle: "Reason Distribution",
    slaTitle: "SLA Compliance Rate (within 24 hours)",
    footerOrg: "CCUS Payment Integration Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Refund Grievance Center: 1588-1234",
    footerServiceLine: "This system complies with government payment guidelines and fair trade refund policy.",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Refund Management Overseer Portal.",
    footerLastModifiedLabel: "Last Modified",
    footerWaAlt: "Web Accessibility Quality Mark",
    footerLinks: ["Refund Policy", "Terms of Use", "CS Manual"],
    logoutLabel: "Logout",
    queueIntroLabel: "Smart Queue",
    queueIntroBody: "5 high-risk requests are waiting for review.",
    queueRiskHighlight: "high-risk requests",
    queueCards: [
      {
        key: "req-882",
        badge: "24H EXPIRED",
        badgeClassName: "bg-red-500/20 text-red-400",
        requestId: "REQ-882",
        title: "VIP customer: Park Young-hee",
        body: "Immediate full refund request for duplicated payment error",
        actionLabel: "Review now",
        actionIcon: "arrow_forward",
        href: "/payment/history",
        accentClassName: "border-l-red-500"
      },
      {
        key: "req-741",
        badge: "DISPUTE",
        badgeClassName: "bg-orange-500/20 text-orange-400",
        requestId: "REQ-741",
        title: "High amount: Solution Co.",
        body: "Penalty waiver request due to unused service",
        actionLabel: "View details",
        actionIcon: "open_in_new",
        href: "/payment/history",
        accentClassName: "border-l-orange-500"
      },
      {
        key: "req-901",
        badge: "VERIFY",
        badgeClassName: "bg-blue-500/20 text-blue-400",
        requestId: "REQ-901",
        title: "Document supplement: Kim Cheol-su",
        body: "Bankbook copy verification required",
        actionLabel: "Check documents",
        actionIcon: "fact_check",
        href: "/payment/refund_account",
        accentClassName: "border-l-blue-500"
      },
      {
        key: "req-112",
        badge: "RECURRING",
        badgeClassName: "bg-emerald-500/20 text-emerald-400",
        requestId: "REQ-112",
        title: "Repeated request: Lee Ji-eun",
        body: "Fourth refund in three months. Abuse review required",
        actionLabel: "Analysis report",
        actionIcon: "trending_up",
        href: "/monitoring/statistics",
        accentClassName: "border-l-emerald-500"
      }
    ],
    rows: [
      {
        key: "ord-00123",
        requestedDate: "2025-08-14",
        requestedTime: "14:22:10",
        customerName: "Lee Hyun-woo",
        customerId: "user_29384",
        orderTitle: "Emission Credit Package A",
        orderId: "#ORD-2025-00123",
        amount: 1250000,
        paymentMethod: "Card reversal (Shinhan)",
        status: "pending",
        primaryAction: { label: "Approve", toneClassName: "bg-emerald-600 text-white hover:bg-emerald-700" },
        secondaryAction: { label: "Reject", toneClassName: "bg-red-500 text-white hover:bg-red-600" },
        tertiaryAction: { label: "Details", toneClassName: "border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200" }
      },
      {
        key: "ord-00088",
        requestedDate: "2025-08-14",
        requestedTime: "11:05:45",
        customerName: "Park Young-hee",
        customerId: "vip_gold_park",
        orderTitle: "1:1 Consulting Session x3",
        orderId: "#ORD-2025-00088",
        amount: 3420000,
        paymentMethod: "Wire transfer",
        status: "verifying",
        primaryAction: { label: "Approve", toneClassName: "bg-emerald-600 text-white hover:bg-emerald-700" },
        secondaryAction: { label: "Reject", toneClassName: "bg-red-500 text-white hover:bg-red-600" },
        tertiaryAction: { label: "Details", toneClassName: "border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200" }
      },
      {
        key: "ord-00110",
        requestedDate: "2025-08-13",
        requestedTime: "17:40:22",
        customerName: "Kim Cheol-su",
        customerId: "user_10292",
        orderTitle: "Subscription Service (Monthly)",
        orderId: "#ORD-2025-00110",
        amount: 89000,
        paymentMethod: "Simple pay (Naver)",
        status: "completed",
        secondaryAction: { label: "Completed", toneClassName: "bg-gray-200 text-gray-400" },
        tertiaryAction: { label: "Receipt", toneClassName: "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" }
      },
      {
        key: "ord-00052",
        requestedDate: "2025-08-13",
        requestedTime: "09:12:00",
        customerName: "Data Solution Co.",
        customerId: "biz_client_04",
        orderTitle: "API Integration License",
        orderId: "#ORD-2025-00052",
        amount: 5500000,
        paymentMethod: "Account transfer",
        status: "denied",
        secondaryAction: { label: "Re-review", toneClassName: "border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200" },
        tertiaryAction: { label: "View reason", toneClassName: "border border-red-200 bg-white text-red-600 hover:bg-red-50" }
      }
    ],
    reasonBars: [
      { label: "Change of mind", value: "45%", heightClassName: "h-28", barClassName: "bg-emerald-500" },
      { label: "Payment error", value: "28%", heightClassName: "h-20", barClassName: "bg-orange-400" },
      { label: "Service issue", value: "15%", heightClassName: "h-14", barClassName: "bg-blue-400" },
      { label: "Other", value: "12%", heightClassName: "h-12", barClassName: "bg-gray-300" }
    ],
    slaMetric: {
      complianceRate: "92%",
      dashOffset: "25",
      sameDayCount: "142",
      delayedCount: "12",
      badge: "Service quality remains strong"
    }
  }
};

function formatCurrency(value: number, en: boolean) {
  return new Intl.NumberFormat(en ? "en-US" : "ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

function isRowVisible(row: RefundRow, query: string, status: TableStatus | "all") {
  const normalizedQuery = query.trim().toLowerCase();
  const haystack = `${row.customerName} ${row.customerId} ${row.orderTitle} ${row.orderId}`.toLowerCase();
  return (!normalizedQuery || haystack.includes(normalizedQuery))
    && (status === "all" || row.status === status);
}

export function PaymentRefundMigrationPage() {
  const session = useFrontendSession();
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TableStatus | "all">("all");

  useEffect(() => {
    document.title = content.pageTitle;
  }, [content.pageTitle]);

  useEffect(() => {
    logGovernanceScope("PAGE", "payment-refund", {
      language: en ? "en" : "ko",
      status,
      queryLength: query.length,
      userType: session.value?.authorCode || "guest"
    });
  }, [en, query.length, session.value?.authorCode, status]);

  const visibleRows = useMemo(
    () => content.rows.filter((row) => isRowVisible(row, query, status)),
    [content.rows, query, status]
  );

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-3 focus:py-2 focus:text-white" href="#main-content">{content.skipToContent}</a>
      <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.governmentStatus} />
      <UserPortalHeader
        brandTitle={content.brandTitle}
        brandSubtitle={content.brandSubtitle}
        onHomeClick={() => navigate(buildLocalizedPath("/home", "/en/home"))}
        rightContent={(
          <>
            <nav className="hidden items-center space-x-1 xl:flex">
              {content.navItems.map((item) => (
                <button
                  className={`h-full border-b-4 px-4 py-7 text-[16px] font-bold transition-all ${item.current ? "border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)]" : "border-transparent text-gray-500 hover:text-[var(--kr-gov-blue)]"}`}
                  key={item.href}
                  onClick={() => navigate(buildLocalizedPath(item.href, `/en${item.href}`))}
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
            <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-blue-50 transition-colors hover:bg-blue-100" type="button">
              <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">support_agent</span>
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[8px] font-bold text-white">12</span>
            </button>
            <UserLanguageToggle en={en} onKo={() => navigate("/payment/refund")} onEn={() => navigate("/en/payment/refund")} />
            <HomeButton onClick={() => void session.logout()} size="sm" variant="primary">{content.logoutLabel}</HomeButton>
          </>
        )}
      />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-900 py-10" data-help-id="payment-refund-priority">
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <svg height="100%" width="100%">
              <pattern height="60" id="payment-refund-dots" patternUnits="userSpaceOnUse" width="60">
                <circle cx="2" cy="2" fill="white" r="1" />
              </pattern>
              <rect fill="url(#payment-refund-dots)" height="100%" width="100%" />
            </svg>
          </div>
          <div className="relative z-10 mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex flex-col items-start gap-8 xl:flex-row">
              <div className="xl:w-1/4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
                    <span className="material-symbols-outlined text-[28px] text-white">bolt</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">{content.heroTitle}</h2>
                    <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-indigo-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      {content.queueIntroLabel}
                    </p>
                  </div>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-slate-400">
                  {content.heroBody}{" "}
                  <strong className="text-white">{content.queueIntroBody}</strong>
                </p>
                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 py-3 text-sm font-bold text-white transition-all hover:bg-white/15" type="button">
                  <span className="material-symbols-outlined text-sm">assignment_late</span>
                  {content.heroButton}
                </button>
              </div>

              <div className="w-full xl:w-3/4">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <span className="material-symbols-outlined text-[16px]">priority_high</span>
                  {content.urgentLabel} ({content.urgentTitle})
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {content.queueCards.map((card) => (
                    <button
                      className={`group rounded-r-lg border border-white/10 border-l-4 ${card.accentClassName} bg-white/5 p-5 text-left backdrop-blur-md transition-all hover:bg-white/10`}
                      key={card.key}
                      onClick={() => navigate(buildLocalizedPath(card.href, `/en${card.href}`))}
                      type="button"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${card.badgeClassName}`}>{card.badge}</span>
                        <span className="text-[10px] font-bold tracking-tighter text-slate-500">{card.requestId}</span>
                      </div>
                      <h4 className="mb-1 text-sm font-bold text-white">{card.title}</h4>
                      <p className="mb-4 text-[11px] text-slate-400">{card.body}</p>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 transition-colors group-hover:text-indigo-300">
                        {card.actionLabel}
                        <span className="material-symbols-outlined text-[14px]">{card.actionIcon}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-20 mx-auto -mt-8 max-w-[1440px] px-4 lg:px-8" data-help-id="payment-refund-filters">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-2xl md:flex-row">
            <div className="relative w-full flex-[2]">
              <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
              <HomeInput className="h-14 rounded-lg border-none bg-gray-50 pl-12 pr-4 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder={content.searchPlaceholder} value={query} />
            </div>
            <div className="w-full flex-1 md:w-auto">
              <HomeSelect className="h-14 rounded-lg border-none bg-gray-50 text-sm font-medium" onChange={(event) => setStatus(event.target.value as TableStatus | "all")} value={status}>
                {content.searchStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </HomeSelect>
            </div>
            <div className="flex w-full gap-2 md:w-auto">
              <HomeButton className="h-14 px-8" type="button" variant="primary">
                <span className="material-symbols-outlined text-[20px]">filter_list</span>
                {content.filterButton}
              </HomeButton>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8" data-help-id="payment-refund-table">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-black">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">list_alt</span>
                {content.requestsTitle}
              </h2>
              <p className="text-sm font-medium text-[var(--kr-gov-text-secondary)]">{content.requestsBody}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 md:flex">
                <span className="material-symbols-outlined text-[18px] text-blue-500">update</span>
                <span className="text-[11px] font-bold leading-none text-blue-700">{content.syncedLabel}</span>
              </div>
              <button className="flex items-center gap-1 text-xs font-bold text-gray-400 transition-colors hover:text-[var(--kr-gov-blue)]" type="button">
                <span className="material-symbols-outlined text-[18px]">download</span>
                {content.downloadLabel}
              </button>
            </div>
          </div>

          <section className="overflow-hidden rounded-[5px] border border-[var(--kr-gov-border-light)] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <HomeTable className="w-full border-collapse text-left">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-gray-500">{content.tableHeaders.requestedAt}</th>
                    <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-gray-500">{content.tableHeaders.customer}</th>
                    <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-gray-500">{content.tableHeaders.order}</th>
                    <th className="px-6 py-4 text-right text-[13px] font-bold uppercase tracking-wider text-gray-500">{content.tableHeaders.amount}</th>
                    <th className="px-6 py-4 text-center text-[13px] font-bold uppercase tracking-wider text-gray-500">{content.tableHeaders.status}</th>
                    <th className="px-6 py-4 text-center text-[13px] font-bold uppercase tracking-wider text-gray-500">{content.tableHeaders.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRows.map((row) => (
                    <tr className={`transition-colors hover:bg-blue-50/30 ${row.status === "completed" ? "bg-gray-50/50" : ""}`} key={row.key}>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-bold ${row.status === "completed" ? "text-gray-500" : "text-gray-900"}`}>{row.requestedDate}</div>
                        <div className="text-[11px] text-gray-400">{row.requestedTime}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-bold ${row.status === "completed" ? "text-gray-500" : "text-gray-900"}`}>{row.customerName}</div>
                        <div className="text-[11px] text-gray-400">{row.customerId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-medium ${row.status === "completed" ? "text-gray-400" : "text-gray-700"}`}>{row.orderTitle}</div>
                        <div className={`text-[11px] font-bold underline ${row.status === "completed" ? "text-gray-400" : "text-blue-600"}`}>{row.orderId}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-black ${row.status === "completed" ? "text-gray-500" : "text-gray-900"}`}>{formatCurrency(row.amount, en)}</div>
                        <div className="text-[10px] text-gray-400">{row.paymentMethod}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS_NAME[row.status]}`}>{content.statusLabels[row.status]}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {row.primaryAction ? (
                            <button className={`rounded-[5px] px-4 py-2 text-xs font-bold transition-colors ${row.primaryAction.toneClassName}`} type="button">
                              {row.primaryAction.label}
                            </button>
                          ) : null}
                          <button className={`rounded-[5px] px-4 py-2 text-xs font-bold transition-colors ${row.secondaryAction.toneClassName} ${row.status === "completed" ? "cursor-not-allowed" : ""}`} disabled={row.status === "completed"} type="button">
                            {row.secondaryAction.label}
                          </button>
                          {row.tertiaryAction ? (
                            <button className={`rounded-[5px] px-4 py-2 text-xs font-bold transition-colors ${row.tertiaryAction.toneClassName}`} type="button">
                              {row.tertiaryAction.label}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </HomeTable>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
              <div className="text-xs font-bold text-gray-500">{content.pageSummary}</div>
              <div className="flex items-center gap-1">
                <button className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-500 transition-colors hover:bg-gray-100" type="button">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {content.pageNumbers.map((pageNumber, index) => (
                  <button
                    className={`flex h-8 w-8 items-center justify-center rounded border text-xs font-bold transition-colors ${index === 0 ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white" : "border-gray-300 bg-white text-gray-500 hover:bg-gray-100"}`}
                    key={pageNumber}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                ))}
                <span className="px-2 text-xs text-gray-400">...</span>
                <button className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-500 transition-colors hover:bg-gray-100" type="button">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </section>
        </section>

        <section className="border-y border-gray-200 bg-white py-16" data-help-id="payment-refund-monitoring">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="text-2xl font-black">{content.monitoringTitle}</h2>
                <p className="text-sm font-medium text-[var(--kr-gov-text-secondary)]">{content.monitoringBody}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                <span className="material-symbols-outlined text-[16px]">update</span>
                {content.monitoringUpdated}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <article className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                <h4 className="mb-6 text-sm font-bold text-gray-600">{content.totalRefundTitle}</h4>
                <div className="mb-6 flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-[var(--kr-gov-blue)]">{content.totalRefundValue}</span>
                  <span className="ml-auto text-sm font-bold text-red-600">{content.totalRefundChange}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[12px] font-bold">
                    <span>{content.budgetLabel}</span>
                    <span className="text-[var(--kr-gov-blue)]">{content.budgetValue}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full border border-gray-200 bg-white">
                    <div className="h-full bg-[var(--kr-gov-blue)]" style={{ width: content.budgetValue }} />
                  </div>
                </div>
              </article>

              <article className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                <h4 className="mb-6 text-sm font-bold text-gray-600">{content.distributionTitle}</h4>
                <div className="flex h-32 items-end gap-4">
                  {content.reasonBars.map((bar) => (
                    <div className={`relative flex-1 rounded-t-lg ${bar.barClassName} ${bar.heightClassName}`} key={bar.label}>
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-black">{bar.value}</div>
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-gray-400">{bar.label}</div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="flex flex-col justify-between rounded-xl border border-gray-100 bg-gray-50 p-6">
                <h4 className="mb-4 text-sm font-bold text-gray-600">{content.slaTitle}</h4>
                <div className="flex items-center gap-6">
                  <div className="relative h-24 w-24">
                    <svg className="h-full w-full -rotate-90">
                      <circle className="text-white" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                      <circle className="text-emerald-500" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251" strokeDashoffset={content.slaMetric.dashOffset} strokeLinecap="round" strokeWidth="8" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-black">{content.slaMetric.complianceRate}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{en ? "Same-day processing" : "당일 처리"}</span>
                      <span className="font-bold">{content.slaMetric.sameDayCount}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{en ? "Delayed requests" : "지연 요청"}</span>
                      <span className="font-bold">{content.slaMetric.delayedCount}</span>
                    </div>
                    <div className="mt-4 flex items-center gap-1 rounded bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      {content.slaMetric.badge}
                    </div>
                  </div>
                </div>
              </article>
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

export default PaymentRefundMigrationPage;
