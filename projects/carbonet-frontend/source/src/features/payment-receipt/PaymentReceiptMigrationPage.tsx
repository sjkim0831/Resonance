import { useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeInput, HomeLinkButton, HomeTable } from "../home-ui/common";

type ArchiveStatus = "confirmed" | "review" | "pending";
type ArchiveCategory = "cloud" | "welfare" | "subscription";

type AnomalyCard = {
  key: string;
  badge: string;
  badgeClassName: string;
  icon: string;
  title: string;
  body: string;
  actionLabel: string;
  href: string;
  accentClassName: string;
};

type RecurringCard = {
  key: string;
  badge: string;
  badgeClassName: string;
  cardClassName: string;
  headerClassName: string;
  stripClassName: string;
  amountClassName: string;
  amountLabel: string;
  id: string;
  title: string;
  statusLine: string;
  statusActionLabel: string;
  statusActionHref: string;
  dueLabel: string;
  amount: string;
  chart: "bars" | "line" | "flat";
  actions: Array<{ label: string; icon: string; href: string; primary?: boolean }>;
};

type ArchiveRow = {
  key: string;
  date: string;
  vendor: string;
  vendorCode: string;
  amount: number;
  category: ArchiveCategory;
  categoryLabel: string;
  status: ArchiveStatus;
  statusLabel: string;
  actionIcon: "visibility" | "edit";
};

type InsightMetric = {
  key: string;
  title: string;
  value: string;
  description: string;
};

type DistributionMetric = {
  key: string;
  label: string;
  value: string;
  heightClassName: string;
  barClassName: string;
};

type LocaleContent = {
  governmentText: string;
  guidelineText: string;
  brandTitle: string;
  brandSubtitle: string;
  login: string;
  logout: string;
  navItems: Array<{ label: string; href: string; current?: boolean }>;
  heroLabel: string;
  heroTitle: string;
  heroSignal: string;
  savingsTitle: string;
  savingsValue: string;
  savingsBody: string;
  reportButton: string;
  anomalyHeading: string;
  recurringTitle: string;
  recurringBody: string;
  filterLabel: string;
  createLabel: string;
  archiveTitle: string;
  archiveSearchPlaceholder: string;
  archiveDateFilterLabel: string;
  archiveExportLabel: string;
  archiveCountLabel: (count: number) => string;
  tableHeaders: {
    date: string;
    vendor: string;
    amount: string;
    category: string;
    status: string;
    action: string;
  };
  allReceiptsLabel: string;
  insightTitle: string;
  insightBody: string;
  insightUpdated: string;
  budgetLabel: string;
  budgetProgressLabel: string;
  budgetDelta: string;
  distributionTitle: string;
  automationTitle: string;
  automationRate: string;
  automationDetails: Array<{ label: string; value: string }>;
  automationImprovement: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerLinks: string[];
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
};

const KO_CONTENT: LocaleContent = {
  governmentText: "대한민국 정부 공식 서비스 | 결제 영수증 인사이트 포털",
  guidelineText: "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
  brandTitle: "영수증 관리",
  brandSubtitle: "Receipt Intelligence Workspace",
  login: "로그인",
  logout: "로그아웃",
  navItems: [
    { label: "결제 요청", href: "/payment/pay" },
    { label: "결제 내역", href: "/payment/history" },
    { label: "영수증", href: "/payment/receipt", current: true }
  ],
  heroLabel: "AI Financial Guard",
  heroTitle: "영수증 인텔리전스 허브",
  heroSignal: "이상 거래 탐지 활성화",
  savingsTitle: "예상 절감 가능액",
  savingsValue: "₩1,245,000",
  savingsBody: "미사용 구독 해지 및 중복 결제 방지 시 기준",
  reportButton: "정밀 분석 리포트",
  anomalyHeading: "AI 감지 이상 징후 및 절감 기회",
  recurringTitle: "정기 결제 및 구독 관리",
  recurringBody: "다가오는 결제 예정일과 비용 트렌드를 한눈에 파악하세요.",
  filterLabel: "필터",
  createLabel: "신규 결제 등록",
  archiveTitle: "영수증 아카이브 (Receipt Archive)",
  archiveSearchPlaceholder: "공급자, 날짜, 카테고리...",
  archiveDateFilterLabel: "날짜 필터",
  archiveExportLabel: "내보내기",
  archiveCountLabel: (count) => `조회 ${count}건`,
  tableHeaders: {
    date: "일자",
    vendor: "공급자",
    amount: "금액",
    category: "AI 자동 분류 추천",
    status: "상태",
    action: "작업"
  },
  allReceiptsLabel: "전체 영수증 내역 보기 (254건)",
  insightTitle: "Financial Insight Report",
  insightBody: "전체 지출 현황 및 예산 대비 달성률입니다.",
  insightUpdated: "마지막 분석: 방금 전",
  budgetLabel: "올해 누적 지출 vs 예산",
  budgetProgressLabel: "연간 예산 달성률 (3억 목표)",
  budgetDelta: "전년 동기 대비 ▲ 2.5% 증가",
  distributionTitle: "카테고리별 지출 분포",
  automationTitle: "자동화 승인 효율",
  automationRate: "86%",
  automationDetails: [
    { label: "자동 승인", value: "1,200건" },
    { label: "수동 검토", value: "185건" }
  ],
  automationImprovement: "처리 속도 40% 개선",
  footerOrg: "AI Financial Oversight Consortium",
  footerAddress: "(06151) 서울특별시 강남구 테헤란로 500",
  footerServiceLine: "재무지원팀 02-555-9999",
  footerLinks: ["개인정보처리방침", "이용약관", "사이트맵"],
  footerCopyright: "© 2025 AI Financial Oversight. All rights reserved for CFO Dashboards.",
  footerLastModifiedLabel: "최종 수정일:",
  footerWaAlt: "웹 접근성 품질인증 마크"
};

const EN_CONTENT: LocaleContent = {
  governmentText: "Republic of Korea Official Service | Payment Receipt Insight Portal",
  guidelineText: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
  brandTitle: "Receipt Management",
  brandSubtitle: "Receipt Intelligence Workspace",
  login: "Login",
  logout: "Logout",
  navItems: [
    { label: "Payment Requests", href: "/en/payment/pay" },
    { label: "Payment History", href: "/en/payment/history" },
    { label: "Receipts", href: "/en/payment/receipt", current: true }
  ],
  heroLabel: "AI Financial Guard",
  heroTitle: "Receipt Intelligence Hub",
  heroSignal: "Anomaly detection active",
  savingsTitle: "Projected Savings",
  savingsValue: "KRW 1,245,000",
  savingsBody: "Based on canceling unused subscriptions and blocking duplicate payments",
  reportButton: "Deep Analysis Report",
  anomalyHeading: "AI-Detected Anomalies and Savings Opportunities",
  recurringTitle: "Recurring Payments and Subscription Control",
  recurringBody: "Track upcoming due dates and spend trends in one view.",
  filterLabel: "Filter",
  createLabel: "Add Payment",
  archiveTitle: "Receipt Archive",
  archiveSearchPlaceholder: "Search vendor, date, or category...",
  archiveDateFilterLabel: "Date filter",
  archiveExportLabel: "Export",
  archiveCountLabel: (count) => `${count} results`,
  tableHeaders: {
    date: "Date",
    vendor: "Vendor",
    amount: "Amount",
    category: "AI Suggested Category",
    status: "Status",
    action: "Action"
  },
  allReceiptsLabel: "View all receipts (254)",
  insightTitle: "Financial Insight Report",
  insightBody: "Current spending and budget attainment across the portfolio.",
  insightUpdated: "Last analysis: just now",
  budgetLabel: "Year-to-date spending vs budget",
  budgetProgressLabel: "Annual budget attainment (target KRW 300M)",
  budgetDelta: "Up 2.5% year over year",
  distributionTitle: "Spend distribution by category",
  automationTitle: "Automated approval efficiency",
  automationRate: "86%",
  automationDetails: [
    { label: "Auto approved", value: "1,200" },
    { label: "Manual review", value: "185" }
  ],
  automationImprovement: "40% faster processing",
  footerOrg: "AI Financial Oversight Consortium",
  footerAddress: "(06151) 500 Teheran-ro, Gangnam-gu, Seoul, Korea",
  footerServiceLine: "Finance Support 02-555-9999",
  footerLinks: ["Privacy Policy", "Terms of Use", "Sitemap"],
  footerCopyright: "© 2025 AI Financial Oversight. All rights reserved for CFO Dashboards.",
  footerLastModifiedLabel: "Last Modified:",
  footerWaAlt: "Web Accessibility Quality Mark"
};

const ANOMALIES: Record<"ko" | "en", AnomalyCard[]> = {
  ko: [
    {
      key: "duplicate",
      badge: "중복 결제 의심",
      badgeClassName: "bg-red-500/20 text-red-300",
      icon: "error",
      title: "AWS 클라우드 서비스",
      body: "동일 금액이 2회 청구되어 승인 대기 중입니다.",
      actionLabel: "내역 확인",
      href: "/payment/history",
      accentClassName: "border-l-red-500"
    },
    {
      key: "unused",
      badge: "미사용 구독",
      badgeClassName: "bg-amber-500/20 text-amber-300",
      icon: "visibility_off",
      title: "Figma Enterprise",
      body: "최근 30일간 활동이 없는 라이선스 5개가 감지되었습니다.",
      actionLabel: "관리하기",
      href: "/payment/pay",
      accentClassName: "border-l-amber-500"
    },
    {
      key: "optimization",
      badge: "최적화 제안",
      badgeClassName: "bg-emerald-500/20 text-emerald-300",
      icon: "auto_fix_high",
      title: "Adobe Creative Cloud",
      body: "연간 결제로 전환하면 월 비용 절감 여지가 있습니다.",
      actionLabel: "자세히 보기",
      href: "/payment/receipt",
      accentClassName: "border-l-emerald-500"
    },
    {
      key: "deadline",
      badge: "기한 임박",
      badgeClassName: "bg-indigo-500/20 text-indigo-300",
      icon: "event",
      title: "본사 임차료 결제",
      body: "D-3: 9월분 정기 임차료 결제 예정입니다.",
      actionLabel: "승인 검토",
      href: "/payment/history",
      accentClassName: "border-l-indigo-500"
    }
  ],
  en: [
    {
      key: "duplicate",
      badge: "Duplicate Risk",
      badgeClassName: "bg-red-500/20 text-red-300",
      icon: "error",
      title: "AWS Cloud Services",
      body: "The same charge appears twice and is waiting for approval.",
      actionLabel: "Review details",
      href: "/en/payment/history",
      accentClassName: "border-l-red-500"
    },
    {
      key: "unused",
      badge: "Unused Subscription",
      badgeClassName: "bg-amber-500/20 text-amber-300",
      icon: "visibility_off",
      title: "Figma Enterprise",
      body: "Five inactive licenses were detected in the last 30 days.",
      actionLabel: "Manage",
      href: "/en/payment/pay",
      accentClassName: "border-l-amber-500"
    },
    {
      key: "optimization",
      badge: "Optimization",
      badgeClassName: "bg-emerald-500/20 text-emerald-300",
      icon: "auto_fix_high",
      title: "Adobe Creative Cloud",
      body: "Switching to annual billing can reduce the monthly cost.",
      actionLabel: "View insight",
      href: "/en/payment/receipt",
      accentClassName: "border-l-emerald-500"
    },
    {
      key: "deadline",
      badge: "Due Soon",
      badgeClassName: "bg-indigo-500/20 text-indigo-300",
      icon: "event",
      title: "HQ Lease Payment",
      body: "D-3: the recurring September lease payment is approaching.",
      actionLabel: "Review approval",
      href: "/en/payment/history",
      accentClassName: "border-l-indigo-500"
    }
  ]
};

const RECURRING_CARDS: Record<"ko" | "en", RecurringCard[]> = {
  ko: [
    {
      key: "gcp",
      badge: "자동 결제",
      badgeClassName: "bg-indigo-100 text-indigo-700 border border-indigo-200",
      cardClassName: "border-t-indigo-500",
      headerClassName: "bg-indigo-50/30",
      stripClassName: "bg-indigo-50/60 border-indigo-100 text-indigo-800",
      amountClassName: "text-slate-900",
      amountLabel: "이번 달 예상 청구액",
      id: "SUB-2401",
      title: "클라우드 서버 (GCP)",
      statusLine: "결제 예정일: 매월 25일",
      statusActionLabel: "D-11",
      statusActionHref: "/payment/history",
      dueLabel: "예정",
      amount: "₩2,450,000",
      chart: "bars",
      actions: [
        { label: "이력 확인", icon: "history", href: "/payment/history" },
        { label: "설정 관리", icon: "settings", href: "/payment/pay" }
      ]
    },
    {
      key: "saas",
      badge: "검토 필요",
      badgeClassName: "bg-amber-100 text-amber-700 border border-amber-200",
      cardClassName: "border-t-amber-500 ring-2 ring-amber-500/10",
      headerClassName: "bg-amber-50/30",
      stripClassName: "bg-red-50 border-red-100 text-red-800",
      amountClassName: "text-amber-600",
      amountLabel: "월 평균 지출",
      id: "SUB-2405",
      title: "SaaS 협업 툴 패키지",
      statusLine: "이용률 대비 비용이 높게 책정되었습니다.",
      statusActionLabel: "다운그레이드 제안",
      statusActionHref: "/payment/pay",
      dueLabel: "리스크",
      amount: "₩1,120,000",
      chart: "line",
      actions: [
        { label: "이용현황 분석", icon: "query_stats", href: "/payment/history", primary: true },
        { label: "구독 해지", icon: "cancel", href: "/payment/pay" }
      ]
    },
    {
      key: "lease",
      badge: "결제 완료",
      badgeClassName: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      cardClassName: "border-t-emerald-500",
      headerClassName: "bg-emerald-50/30",
      stripClassName: "bg-emerald-50 border-emerald-100 text-emerald-800",
      amountClassName: "text-emerald-600",
      amountLabel: "확정 결제액",
      id: "RENT-002",
      title: "본사 임대차 비용",
      statusLine: "9월분 결제가 정상 승인되었습니다.",
      statusActionLabel: "영수증 보기",
      statusActionHref: "/payment/receipt",
      dueLabel: "완료",
      amount: "₩12,000,000",
      chart: "flat",
      actions: [
        { label: "계약서 상세", icon: "contract", href: "/payment/history" },
        { label: "증빙 출력", icon: "download", href: "/payment/receipt" }
      ]
    }
  ],
  en: [
    {
      key: "gcp",
      badge: "Auto Pay",
      badgeClassName: "bg-indigo-100 text-indigo-700 border border-indigo-200",
      cardClassName: "border-t-indigo-500",
      headerClassName: "bg-indigo-50/30",
      stripClassName: "bg-indigo-50/60 border-indigo-100 text-indigo-800",
      amountClassName: "text-slate-900",
      amountLabel: "Projected monthly charge",
      id: "SUB-2401",
      title: "Cloud Servers (GCP)",
      statusLine: "Next charge: every 25th",
      statusActionLabel: "D-11",
      statusActionHref: "/en/payment/history",
      dueLabel: "Due",
      amount: "KRW 2,450,000",
      chart: "bars",
      actions: [
        { label: "History", icon: "history", href: "/en/payment/history" },
        { label: "Settings", icon: "settings", href: "/en/payment/pay" }
      ]
    },
    {
      key: "saas",
      badge: "Needs Review",
      badgeClassName: "bg-amber-100 text-amber-700 border border-amber-200",
      cardClassName: "border-t-amber-500 ring-2 ring-amber-500/10",
      headerClassName: "bg-amber-50/30",
      stripClassName: "bg-red-50 border-red-100 text-red-800",
      amountClassName: "text-amber-600",
      amountLabel: "Average monthly spend",
      id: "SUB-2405",
      title: "SaaS Collaboration Suite",
      statusLine: "The cost is high relative to usage.",
      statusActionLabel: "Suggest downgrade",
      statusActionHref: "/en/payment/pay",
      dueLabel: "Risk",
      amount: "KRW 1,120,000",
      chart: "line",
      actions: [
        { label: "Usage analysis", icon: "query_stats", href: "/en/payment/history", primary: true },
        { label: "Cancel plan", icon: "cancel", href: "/en/payment/pay" }
      ]
    },
    {
      key: "lease",
      badge: "Paid",
      badgeClassName: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      cardClassName: "border-t-emerald-500",
      headerClassName: "bg-emerald-50/30",
      stripClassName: "bg-emerald-50 border-emerald-100 text-emerald-800",
      amountClassName: "text-emerald-600",
      amountLabel: "Confirmed payment",
      id: "RENT-002",
      title: "HQ Lease Expense",
      statusLine: "The September payment was approved successfully.",
      statusActionLabel: "View receipt",
      statusActionHref: "/en/payment/receipt",
      dueLabel: "Closed",
      amount: "KRW 12,000,000",
      chart: "flat",
      actions: [
        { label: "Contract", icon: "contract", href: "/en/payment/history" },
        { label: "Download proof", icon: "download", href: "/en/payment/receipt" }
      ]
    }
  ]
};

const ARCHIVE_ROWS: Record<"ko" | "en", ArchiveRow[]> = {
  ko: [
    {
      key: "azure",
      date: "2025.08.14",
      vendor: "Microsoft Azure",
      vendorCode: "MS",
      amount: 890000,
      category: "cloud",
      categoryLabel: "IT 인프라/클라우드",
      status: "confirmed",
      statusLabel: "확정됨",
      actionIcon: "visibility"
    },
    {
      key: "starbucks",
      date: "2025.08.12",
      vendor: "Starbucks Coffee",
      vendorCode: "SM",
      amount: 45200,
      category: "welfare",
      categoryLabel: "복리후생/식비",
      status: "review",
      statusLabel: "미분류",
      actionIcon: "edit"
    },
    {
      key: "apple",
      date: "2025.08.10",
      vendor: "Apple Services",
      vendorCode: "AP",
      amount: 19500,
      category: "subscription",
      categoryLabel: "소프트웨어 구독",
      status: "pending",
      statusLabel: "검토중",
      actionIcon: "visibility"
    }
  ],
  en: [
    {
      key: "azure",
      date: "2025.08.14",
      vendor: "Microsoft Azure",
      vendorCode: "MS",
      amount: 890000,
      category: "cloud",
      categoryLabel: "IT Infrastructure / Cloud",
      status: "confirmed",
      statusLabel: "Confirmed",
      actionIcon: "visibility"
    },
    {
      key: "starbucks",
      date: "2025.08.12",
      vendor: "Starbucks Coffee",
      vendorCode: "SM",
      amount: 45200,
      category: "welfare",
      categoryLabel: "Welfare / Meals",
      status: "review",
      statusLabel: "Unclassified",
      actionIcon: "edit"
    },
    {
      key: "apple",
      date: "2025.08.10",
      vendor: "Apple Services",
      vendorCode: "AP",
      amount: 19500,
      category: "subscription",
      categoryLabel: "Software Subscription",
      status: "pending",
      statusLabel: "In Review",
      actionIcon: "visibility"
    }
  ]
};

const INSIGHT_METRIC: Record<"ko" | "en", InsightMetric> = {
  ko: {
    key: "budget",
    title: "올해 누적 지출 vs 예산",
    value: "₩245,800,000",
    description: "연간 예산 달성률 81.9%"
  },
  en: {
    key: "budget",
    title: "Year-to-date spending vs budget",
    value: "KRW 245,800,000",
    description: "81.9% of the annual budget used"
  }
};

const DISTRIBUTION: Record<"ko" | "en", DistributionMetric[]> = {
  ko: [
    { key: "infra", label: "인프라", value: "45%", heightClassName: "h-[70%]", barClassName: "bg-indigo-500" },
    { key: "marketing", label: "마케팅", value: "25%", heightClassName: "h-[42%]", barClassName: "bg-indigo-400" },
    { key: "operations", label: "운영비", value: "20%", heightClassName: "h-[34%]", barClassName: "bg-indigo-300" },
    { key: "other", label: "기타", value: "10%", heightClassName: "h-[20%]", barClassName: "bg-slate-300" }
  ],
  en: [
    { key: "infra", label: "Infra", value: "45%", heightClassName: "h-[70%]", barClassName: "bg-indigo-500" },
    { key: "marketing", label: "Marketing", value: "25%", heightClassName: "h-[42%]", barClassName: "bg-indigo-400" },
    { key: "operations", label: "Ops", value: "20%", heightClassName: "h-[34%]", barClassName: "bg-indigo-300" },
    { key: "other", label: "Other", value: "10%", heightClassName: "h-[20%]", barClassName: "bg-slate-300" }
  ]
};

const ARCHIVE_STATUS_CLASSNAME: Record<ArchiveStatus, string> = {
  confirmed: "bg-emerald-100 text-emerald-700",
  review: "bg-slate-100 text-slate-600",
  pending: "bg-amber-100 text-amber-700"
};

const CATEGORY_CLASSNAME: Record<ArchiveCategory, string> = {
  cloud: "bg-indigo-50 text-indigo-700",
  welfare: "bg-amber-50 text-amber-700",
  subscription: "bg-violet-50 text-violet-700"
};

function formatCurrency(value: number, locale: "ko" | "en") {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

function ChartBlock({ type }: { type: RecurringCard["chart"] }) {
  if (type === "bars") {
    return (
      <div className="flex h-12 w-28 items-end gap-1">
        <div className="h-[40%] flex-1 rounded-sm bg-slate-200" />
        <div className="h-[55%] flex-1 rounded-sm bg-slate-200" />
        <div className="h-[50%] flex-1 rounded-sm bg-slate-200" />
        <div className="h-[75%] flex-1 rounded-sm bg-indigo-500" />
        <div className="h-[60%] flex-1 rounded-sm bg-indigo-300" />
      </div>
    );
  }
  if (type === "line") {
    return (
      <svg className="h-12 w-28" viewBox="0 0 100 30">
        <path d="M0 25 L20 22 L40 28 L60 15 L80 10 L100 5" fill="none" stroke="#f59e0b" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    );
  }
  return (
    <svg className="h-12 w-28" viewBox="0 0 100 30">
      <path d="M0 15 L20 15 L40 15 L60 15 L80 15 L100 15" fill="none" stroke="#10b981" strokeDasharray="4" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

export function PaymentReceiptMigrationPage() {
  const en = isEnglish();
  const locale = en ? "en" : "ko";
  const content = en ? EN_CONTENT : KO_CONTENT;
  const sessionState = useFrontendSession();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ARCHIVE_ROWS[locale].filter((row) => {
      const matchesQuery = !normalized
        || row.vendor.toLowerCase().includes(normalized)
        || row.date.toLowerCase().includes(normalized)
        || row.categoryLabel.toLowerCase().includes(normalized);
      return matchesQuery;
    });
  }, [locale, query]);

  return (
    <div className="min-h-screen bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)]">
      <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.guidelineText} />
      <UserPortalHeader
        brandTitle={content.brandTitle}
        brandSubtitle={content.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <UserLanguageToggle en={en} onKo={() => navigate("/payment/receipt")} onEn={() => navigate("/en/payment/receipt")} />
            {sessionState.value?.authenticated ? (
              <HomeButton type="button" variant="primary" size="sm" onClick={() => void sessionState.logout()}>
                {content.logout}
              </HomeButton>
            ) : (
              <HomeLinkButton href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")} variant="primary" size="sm">
                {content.login}
              </HomeLinkButton>
            )}
          </>
        )}
      />

      <div className="border-b border-[var(--kr-gov-border-light)] bg-white">
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-4 lg:px-8">
          {content.navItems.map((item) => (
            <a
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${item.current ? "bg-[var(--kr-gov-blue)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <section className="relative overflow-hidden rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-sm lg:px-8" data-help-id="payment-receipt-hero">
          <div className="absolute inset-0 opacity-20">
            <div className="h-full w-full bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:40px_40px]" />
          </div>
          <div className="relative grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/30">
                  <span className="material-symbols-outlined text-[28px] text-white">insights</span>
                </div>
                <div>
                  <p className="text-sm font-black">{content.heroLabel}</p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-indigo-300">{content.heroSignal}</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-indigo-500/30 bg-indigo-900/30 p-5">
                <p className="text-sm font-bold text-white">{content.savingsTitle}</p>
                <p className="mt-2 text-3xl font-black text-indigo-300">{content.savingsValue}</p>
                <p className="mt-2 text-xs text-indigo-200/80">{content.savingsBody}</p>
              </div>
              <HomeLinkButton className="mt-5 w-full justify-center bg-white/5 text-white hover:bg-white/10" href={buildLocalizedPath("/payment/history", "/en/payment/history")} variant="ghost">
                <span className="material-symbols-outlined text-sm">troubleshoot</span>
                {content.reportButton}
              </HomeLinkButton>
            </div>

            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">{content.anomalyHeading}</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {ANOMALIES[locale].map((card) => (
                  <a
                    className={`flex min-h-[188px] flex-col rounded-2xl border border-white/5 border-l-4 ${card.accentClassName} bg-slate-800/55 p-5 transition hover:bg-slate-800/80`}
                    href={card.href}
                    key={card.key}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${card.badgeClassName}`}>{card.badge}</span>
                      <span className="material-symbols-outlined text-sm text-slate-300">{card.icon}</span>
                    </div>
                    <h3 className="mt-4 text-sm font-black text-white">{card.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{card.body}</p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-bold text-indigo-300">
                      {card.actionLabel}
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">{content.recurringTitle}</h2>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{content.recurringBody}</p>
            </div>
            <div className="flex gap-3">
              <HomeButton type="button" variant="secondary">
                <span className="material-symbols-outlined text-sm">filter_list</span>
                {content.filterLabel}
              </HomeButton>
              <HomeLinkButton href={buildLocalizedPath("/payment/pay", "/en/payment/pay")} variant="primary">
                <span className="material-symbols-outlined text-sm">add</span>
                {content.createLabel}
              </HomeLinkButton>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {RECURRING_CARDS[locale].map((card) => (
              <article className={`overflow-hidden rounded-[24px] border border-[var(--kr-gov-border-light)] border-t-4 bg-white shadow-sm ${card.cardClassName}`} key={card.key}>
                <div className={`flex items-start justify-between gap-4 border-b border-slate-100 p-6 ${card.headerClassName}`}>
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${card.badgeClassName}`}>{card.badge}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.id}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900">{card.title}</h3>
                  </div>
                  <span className="material-symbols-outlined text-slate-300">more_vert</span>
                </div>
                <div className={`flex items-center justify-between gap-3 border-b px-6 py-3 text-[11px] font-bold ${card.stripClassName}`}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">event_repeat</span>
                    <span>{card.statusLine}</span>
                  </div>
                  <a className="shrink-0 underline" href={card.statusActionHref}>
                    {card.statusActionLabel}
                  </a>
                </div>
                <div className="space-y-6 p-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500">{card.amountLabel}</p>
                      <p className={`mt-1 text-3xl font-black tracking-tight ${card.amountClassName}`}>{card.amount}</p>
                    </div>
                    <ChartBlock type={card.chart} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {card.actions.map((action) => (
                      <a
                        className={`flex flex-col items-center justify-center rounded-2xl px-3 py-4 text-center transition ${
                          action.primary
                            ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white"
                        }`}
                        href={action.href}
                        key={action.label}
                      >
                        <span className="material-symbols-outlined mb-1">{action.icon}</span>
                        <span className="text-xs font-bold">{action.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 overflow-hidden rounded-[24px] border border-[var(--kr-gov-border-light)] bg-white shadow-sm" data-help-id="payment-receipt-detail">
          <div className="border-b border-slate-100 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">receipt_long</span>
                  {content.archiveTitle}
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] lg:w-[680px]">
                <HomeInput
                  aria-label={content.archiveTitle}
                  placeholder={content.archiveSearchPlaceholder}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <HomeButton type="button" variant="secondary">
                  {content.archiveDateFilterLabel}
                </HomeButton>
                <HomeButton type="button" variant="secondary">
                  {content.archiveExportLabel}
                </HomeButton>
              </div>
            </div>
            <div className="mt-4 text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.archiveCountLabel(rows.length)}</div>
          </div>

          <div className="overflow-x-auto">
            <HomeTable>
              <thead className="bg-slate-50">
                <tr>
                  {Object.values(content.tableHeaders).map((header) => (
                    <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400" key={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-t border-slate-100 hover:bg-slate-50" key={row.key}>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{row.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">{row.vendorCode}</div>
                        <span className="text-xs font-black text-slate-900">{row.vendor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900">{formatCurrency(row.amount, locale)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold ${CATEGORY_CLASSNAME[row.category]}`}>
                        <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                        {row.categoryLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold ${ARCHIVE_STATUS_CLASSNAME[row.status]}`}>{row.statusLabel}</span>
                    </td>
                    <td className="px-6 py-4">
                      <a className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/payment/history", "/en/payment/history")}>
                        <span className="material-symbols-outlined text-sm">{row.actionIcon}</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </HomeTable>
          </div>

          <div className="border-t border-slate-100 bg-slate-50 p-4 text-center">
            <a className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/payment/history", "/en/payment/history")}>
              {content.allReceiptsLabel}
              <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
            </a>
          </div>
        </section>

        <section className="mt-10 rounded-[24px] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">{content.insightTitle}</h2>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{content.insightBody}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">
              <span className="material-symbols-outlined text-[16px]">sync</span>
              {content.insightUpdated}
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-sm font-bold text-slate-600">{content.budgetLabel}</h3>
              <p className="mt-6 text-4xl font-black tracking-tight text-indigo-600">{INSIGHT_METRIC[locale].value}</p>
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span>{content.budgetProgressLabel}</span>
                  <span className="text-indigo-600">81.9%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full border border-slate-200 bg-white">
                  <div className="h-full w-[81.9%] bg-indigo-500" />
                </div>
                <p className="text-[11px] text-slate-400">{content.budgetDelta}</p>
              </div>
            </article>

            <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-sm font-bold text-slate-600">{content.distributionTitle}</h3>
              <div className="mt-8 flex h-36 items-end gap-4">
                {DISTRIBUTION[locale].map((item) => (
                  <div className="flex flex-1 flex-col items-center justify-end" key={item.key}>
                    <span className="mb-2 text-[10px] font-black">{item.value}</span>
                    <div className={`w-full rounded-t-lg ${item.heightClassName} ${item.barClassName}`} />
                    <span className="mt-3 text-[10px] font-bold text-slate-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-sm font-bold text-slate-600">{content.automationTitle}</h3>
              <div className="mt-6 flex items-center gap-6">
                <div className="relative h-24 w-24">
                  <svg className="h-full w-full -rotate-90">
                    <circle className="text-white" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                    <circle className="text-emerald-500" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251" strokeDashoffset="35" strokeLinecap="round" strokeWidth="8" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-black">{content.automationRate}</div>
                </div>
                <div className="flex-1 space-y-2">
                  {content.automationDetails.map((detail) => (
                    <div className="flex justify-between text-xs" key={detail.label}>
                      <span className="text-slate-500">{detail.label}</span>
                      <span className="font-bold text-slate-900">{detail.value}</span>
                    </div>
                  ))}
                  <div className="mt-4 inline-flex items-center gap-1 rounded bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                    <span className="material-symbols-outlined text-[14px]">bolt</span>
                    {content.automationImprovement}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      <UserPortalFooter
        orgName={content.footerOrg}
        addressLine={content.footerAddress}
        serviceLine={content.footerServiceLine}
        footerLinks={content.footerLinks}
        copyright={content.footerCopyright}
        lastModifiedLabel={content.footerLastModifiedLabel}
        waAlt={content.footerWaAlt}
      />
    </div>
  );
}
