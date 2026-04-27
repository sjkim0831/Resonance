import { useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  HomeButton,
  HomeCheckbox,
  HomeInput,
  HomeLinkButton,
  HomeSelect,
  HomeTable
} from "../home-ui/common";

type PaymentStatus = "completed" | "pending" | "on-hold" | "cancelled";
type PaymentCategory = "operations" | "labor" | "logistics" | "energy" | "equipment";

type PaymentRow = {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  category: PaymentCategory;
  categoryLabel: string;
  method: string;
  status: PaymentStatus;
  proofIcon: "receipt_long" | "description" | "inventory_2";
};

type LocaleContent = {
  skipToContent: string;
  governmentText: string;
  guidelineText: string;
  brandTitle: string;
  brandSubtitle: string;
  pageEyebrow: string;
  pageTitle: string;
  pageDescription: string;
  periodLabel: string;
  navItems: Array<{ label: string; href: string; current?: boolean }>;
  exportLabel: string;
  createLabel: string;
  searchPlaceholder: string;
  categoryAll: string;
  statusAll: string;
  dateRangeLabel: string;
  filterLabel: string;
  selectedLabel: string;
  totalCountLabel: string;
  tableHeaders: {
    date: string;
    vendor: string;
    amount: string;
    category: string;
    method: string;
    status: string;
    proof: string;
  };
  summaryCards: Array<{ key: string; title: string; caption: string }>;
  statusLabels: Record<PaymentStatus, string>;
  categoryLabels: Record<PaymentCategory, string>;
  guidanceTitle: string;
  guidanceItems: string[];
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerLinks: string[];
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
  login: string;
  logout: string;
};

const PAYMENT_ROWS: PaymentRow[] = [
  {
    id: "PAY-20250814-001",
    date: "2025-08-14",
    vendor: "(주)대한에너지기술",
    amount: 42000000,
    category: "energy",
    categoryLabel: "에너지비 (전력)",
    method: "법인계좌 (신한 110-***)",
    status: "completed",
    proofIcon: "receipt_long"
  },
  {
    id: "PAY-20250814-002",
    date: "2025-08-14",
    vendor: "글로벌 에코 솔루션",
    amount: 8450000,
    category: "equipment",
    categoryLabel: "자산구입 (센서)",
    method: "법인카드 (국민 4211)",
    status: "pending",
    proofIcon: "description"
  },
  {
    id: "PAY-20250813-003",
    date: "2025-08-13",
    vendor: "울산 제3 화학기지 공정팀",
    amount: 19600000,
    category: "operations",
    categoryLabel: "운영비 (정비)",
    method: "법인계좌 (우리 201-***)",
    status: "completed",
    proofIcon: "inventory_2"
  },
  {
    id: "PAY-20250812-004",
    date: "2025-08-12",
    vendor: "탄소 물류 파트너스",
    amount: 11300000,
    category: "logistics",
    categoryLabel: "물류비 (운송)",
    method: "법인카드 (삼성 8821)",
    status: "on-hold",
    proofIcon: "description"
  },
  {
    id: "PAY-20250811-005",
    date: "2025-08-11",
    vendor: "CCUS 운영지원센터",
    amount: 5400000,
    category: "labor",
    categoryLabel: "인건비 (외주)",
    method: "세금계산서 정산",
    status: "completed",
    proofIcon: "receipt_long"
  },
  {
    id: "PAY-20250810-006",
    date: "2025-08-10",
    vendor: "스마트 검교정 연구소",
    amount: 3700000,
    category: "equipment",
    categoryLabel: "장비구입 (검교정)",
    method: "법인카드 (국민 4211)",
    status: "cancelled",
    proofIcon: "description"
  }
];

const STATUS_CLASSNAME: Record<PaymentStatus, string> = {
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  pending: "bg-amber-50 text-amber-700 border border-amber-100",
  "on-hold": "bg-slate-100 text-slate-700 border border-slate-200",
  cancelled: "bg-rose-50 text-rose-700 border border-rose-100"
};

const CONTENT: Record<"ko" | "en", LocaleContent> = {
  ko: {
    skipToContent: "본문 바로가기",
    governmentText: "대한민국 정부 공식 서비스 | CCUS 통합 결제 포털",
    guidelineText: "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
    brandTitle: "결제 내역 관리",
    brandSubtitle: "Payment History Workspace",
    pageEyebrow: "기간별 결제 요약",
    pageTitle: "결제 내역",
    pageDescription: "reference 화면의 금융 집행 보드를 현재 사용자 포털 구조에 맞춰 재구성했습니다. 기간별 집행액, 승인 대기, 증빙 확인 흐름을 한 화면에서 검토할 수 있습니다.",
    periodLabel: "2025년 08월 01일 ~ 2025년 08월 14일 기준",
    navItems: [
      { label: "결제 대시보드", href: "/payment/dashboard" },
      { label: "결제 내역", href: "/payment/history", current: true },
      { label: "정산 리포트", href: "/trade/report" },
      { label: "결제 환불", href: "/payment/refund" }
    ],
    exportLabel: "데이터 내보내기",
    createLabel: "신규 지출 등록",
    searchPlaceholder: "거래처명, 항목명, 결제 번호 검색",
    categoryAll: "전체 카테고리",
    statusAll: "모든 상태",
    dateRangeLabel: "2025.08.01 ~ 2025.08.14",
    filterLabel: "필터 적용",
    selectedLabel: "선택 건수",
    totalCountLabel: "조회 건수",
    tableHeaders: {
      date: "결제 일자",
      vendor: "거래처",
      amount: "결제 금액",
      category: "지출 카테고리",
      method: "결제 수단",
      status: "상태",
      proof: "증빙"
    },
    summaryCards: [
      { key: "outflow", title: "총 지출", caption: "선택한 기간 누적 지출" },
      { key: "refund", title: "환급 및 정산", caption: "부가세 환급 및 상계 반영" },
      { key: "pending", title: "승인 대기", caption: "결재 대기 중인 지출" },
      { key: "budget", title: "가용 예산", caption: "월간 예산 대비 잔여율" }
    ],
    statusLabels: {
      completed: "결제 완료",
      pending: "승인 대기",
      "on-hold": "지불 보류",
      cancelled: "취소됨"
    },
    categoryLabels: {
      operations: "운영비",
      labor: "인건비",
      logistics: "물류비",
      energy: "에너지비",
      equipment: "장비구입"
    },
    guidanceTitle: "운영 메모",
    guidanceItems: [
      "승인 대기 건은 결재 문서와 증빙 업로드 상태를 함께 확인해야 합니다.",
      "지불 보류 건은 거래처 정산 계좌 검증 또는 세금계산서 오류 가능성을 우선 점검합니다.",
      "취소 건은 환불 처리 화면과 연결해 후속 정산 여부를 추적합니다."
    ],
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110",
    footerServiceLine: "결제 지원센터 02-1234-5678",
    footerLinks: ["개인정보처리방침", "이용약관", "사이트맵", "이메일무단수집거부"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Payment Workspace.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크",
    login: "로그인",
    logout: "로그아웃"
  },
  en: {
    skipToContent: "Skip to main content",
    governmentText: "Republic of Korea Official Service | CCUS Integrated Payment Portal",
    guidelineText: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    brandTitle: "Payment History Management",
    brandSubtitle: "Payment History Workspace",
    pageEyebrow: "Period Payment Summary",
    pageTitle: "Payment History",
    pageDescription: "The finance execution board from the reference has been rebuilt for the current user portal. Review disbursement totals, pending approvals, and proof documents in one flow.",
    periodLabel: "Based on Aug 01, 2025 to Aug 14, 2025",
    navItems: [
      { label: "Payment Dashboard", href: "/en/payment/dashboard" },
      { label: "Payment History", href: "/en/payment/history", current: true },
      { label: "Settlement Report", href: "/en/trade/report" },
      { label: "Payment Refund", href: "/en/payment/refund" }
    ],
    exportLabel: "Export Data",
    createLabel: "Register Expense",
    searchPlaceholder: "Search vendor, item, or payment number",
    categoryAll: "All Categories",
    statusAll: "All Statuses",
    dateRangeLabel: "2025.08.01 ~ 2025.08.14",
    filterLabel: "Apply Filters",
    selectedLabel: "Selected",
    totalCountLabel: "Results",
    tableHeaders: {
      date: "Payment Date",
      vendor: "Vendor",
      amount: "Amount",
      category: "Expense Category",
      method: "Payment Method",
      status: "Status",
      proof: "Proof"
    },
    summaryCards: [
      { key: "outflow", title: "Total Outflow", caption: "Total disbursement in range" },
      { key: "refund", title: "Refund & Inflow", caption: "VAT refund and settlements" },
      { key: "pending", title: "Pending Approval", caption: "Expenses awaiting approval" },
      { key: "budget", title: "Budget Left", caption: "Remaining monthly budget" }
    ],
    statusLabels: {
      completed: "Completed",
      pending: "Pending",
      "on-hold": "On Hold",
      cancelled: "Cancelled"
    },
    categoryLabels: {
      operations: "Operations",
      labor: "Labor",
      logistics: "Logistics",
      energy: "Energy",
      equipment: "Equipment"
    },
    guidanceTitle: "Operator Notes",
    guidanceItems: [
      "Pending rows should be reviewed together with approval documents and uploaded proof files.",
      "On-hold rows usually require bank account verification or tax invoice correction first.",
      "Cancelled rows should be traced against the refund workflow for settlement impact."
    ],
    footerOrg: "CCUS Integrated Management Office",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea",
    footerServiceLine: "Payment Support Center +82-2-1234-5678",
    footerLinks: ["Privacy Policy", "Terms of Use", "Sitemap", "Email Collection Refusal"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Payment Workspace.",
    footerLastModifiedLabel: "Last Modified:",
    footerWaAlt: "Web Accessibility Quality Mark",
    login: "Login",
    logout: "Logout"
  }
};

function formatCurrency(value: number, locale: "ko" | "en") {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

export function PaymentHistoryMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const sessionState = useFrontendSession();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PaymentCategory | "all">("all");
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return PAYMENT_ROWS.filter((row) => {
      const matchesQuery = !normalizedQuery
        || row.vendor.toLowerCase().includes(normalizedQuery)
        || row.id.toLowerCase().includes(normalizedQuery)
        || row.categoryLabel.toLowerCase().includes(normalizedQuery);
      const matchesCategory = category === "all" || row.category === category;
      const matchesStatus = status === "all" || row.status === status;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [category, query, status]);

  const totalOutflow = filteredRows
    .filter((row) => row.status !== "cancelled")
    .reduce((sum, row) => sum + row.amount, 0);
  const refundAmount = 12450000;
  const pendingAmount = filteredRows
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + row.amount, 0);
  const budgetLeft = 42.5;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredRows.some((row) => row.id === id)));
  }, [filteredRows]);

  useEffect(() => {
    logGovernanceScope("PAGE", "payment-history", {
      language: en ? "en" : "ko",
      rowCount: filteredRows.length,
      selectedCount: selectedIds.length,
      query,
      category,
      status
    });
  }, [category, en, filteredRows.length, query, selectedIds.length, status]);

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? filteredRows.map((row) => row.id) : []);
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((item) => item !== id);
    });
  }

  return (
    <div className="min-h-screen bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)]">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {content.skipToContent}
      </a>
      <UserGovernmentBar governmentText={content.governmentText} guidelineText={content.guidelineText} />
      <UserPortalHeader
        brandTitle={content.brandTitle}
        brandSubtitle={content.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <UserLanguageToggle
              en={en}
              onKo={() => navigate("/payment/history")}
              onEn={() => navigate("/en/payment/history")}
            />
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
      <main id="main-content" className="pb-16">
        <section className="border-b border-slate-800 bg-slate-950" data-help-id="payment-history-hero">
          <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-300">{content.pageEyebrow}</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight text-white">{content.pageTitle}</h2>
                <p className="mt-4 text-sm leading-6 text-slate-300">{content.pageDescription}</p>
                <p className="mt-3 text-xs font-semibold text-slate-400">{content.periodLabel}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <HomeButton type="button" variant="secondary" size="sm" icon="download">
                  {content.exportLabel}
                </HomeButton>
                <HomeLinkButton href={buildLocalizedPath("/trade/buy_request", "/en/trade/buy_request")} variant="primary" size="sm" icon="add_circle">
                  {content.createLabel}
                </HomeLinkButton>
              </div>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{content.summaryCards[0].title}</p>
                <p className="mt-3 text-3xl font-black text-white">{formatCurrency(totalOutflow, en ? "en" : "ko")}</p>
                <p className="mt-2 text-xs text-slate-400">{content.summaryCards[0].caption}</p>
              </article>
              <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{content.summaryCards[1].title}</p>
                <p className="mt-3 text-3xl font-black text-emerald-300">{formatCurrency(refundAmount, en ? "en" : "ko")}</p>
                <p className="mt-2 text-xs text-slate-400">{content.summaryCards[1].caption}</p>
              </article>
              <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{content.summaryCards[2].title}</p>
                <p className="mt-3 text-3xl font-black text-amber-300">{formatCurrency(pendingAmount, en ? "en" : "ko")}</p>
                <p className="mt-2 text-xs text-slate-400">{content.summaryCards[2].caption}</p>
              </article>
              <article className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{content.summaryCards[3].title}</p>
                <p className="mt-3 text-3xl font-black text-sky-300">{budgetLeft}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-sky-400" style={{ width: `${budgetLeft}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-400">{content.summaryCards[3].caption}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pt-8 lg:px-8" data-help-id="payment-history-filters">
          <div className="rounded-[24px] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
              <HomeInput
                aria-label={content.searchPlaceholder}
                placeholder={content.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <HomeSelect value={category} onChange={(event) => setCategory(event.target.value as PaymentCategory | "all")}>
                <option value="all">{content.categoryAll}</option>
                {Object.entries(content.categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </HomeSelect>
              <HomeSelect value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus | "all")}>
                <option value="all">{content.statusAll}</option>
                {Object.entries(content.statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </HomeSelect>
              <div className="flex items-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 text-sm text-[var(--kr-gov-text-secondary)]">
                <span className="material-symbols-outlined mr-2 text-[18px]">calendar_month</span>
                {content.dateRangeLabel}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-sm text-[var(--kr-gov-text-secondary)]">
                <span>{content.selectedLabel}: <strong className="text-[var(--kr-gov-text-primary)]">{selectedIds.length}</strong></span>
                <span>{content.totalCountLabel}: <strong className="text-[var(--kr-gov-text-primary)]">{filteredRows.length}</strong></span>
              </div>
              <HomeButton type="button" variant="secondary" size="sm" icon="filter_alt">
                {content.filterLabel}
              </HomeButton>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] lg:px-8">
          <div className="overflow-hidden rounded-[24px] border border-[var(--kr-gov-border-light)] bg-white shadow-sm" data-help-id="payment-history-table">
            <div className="overflow-x-auto">
              <HomeTable>
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-center">
                      <HomeCheckbox
                        checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length}
                        onChange={(event) => toggleAll(event.target.checked)}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">{content.tableHeaders.date}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">{content.tableHeaders.vendor}</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">{content.tableHeaders.amount}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">{content.tableHeaders.category}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">{content.tableHeaders.method}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">{content.tableHeaders.status}</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--kr-gov-text-secondary)]">{content.tableHeaders.proof}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const checked = selectedIds.includes(row.id);
                    return (
                      <tr className="border-t border-slate-100 hover:bg-sky-50/40" key={row.id}>
                        <td className="px-4 py-4 text-center">
                          <HomeCheckbox checked={checked} onChange={(event) => toggleRow(row.id, event.target.checked)} />
                        </td>
                        <td className="px-4 py-4 font-medium">{row.date}</td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-[var(--kr-gov-blue)]">{row.vendor}</div>
                          <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{row.id}</div>
                        </td>
                        <td className="px-4 py-4 text-right font-black">{formatCurrency(row.amount, en ? "en" : "ko")}</td>
                        <td className="px-4 py-4">{row.categoryLabel}</td>
                        <td className="px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">{row.method}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${STATUS_CLASSNAME[row.status]}`}>
                            {content.statusLabels[row.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button className="text-slate-400 transition-colors hover:text-[var(--kr-gov-blue)]" type="button">
                            <span className="material-symbols-outlined">{row.proofIcon}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </HomeTable>
            </div>
          </div>

          <aside className="space-y-4" data-help-id="payment-history-guidance">
            <section className="rounded-[24px] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-black">{content.guidanceTitle}</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                {content.guidanceItems.map((item) => (
                  <li className="rounded-2xl bg-slate-50 px-4 py-3" key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-[24px] bg-[var(--kr-gov-blue)] p-6 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-100">Connected Flow</p>
              <h3 className="mt-3 text-2xl font-black">Refund / Settlement</h3>
              <p className="mt-3 text-sm leading-6 text-sky-50">
                {en
                  ? "Cancelled or on-hold payments are best reviewed together with the refund process and settlement report in the current app structure."
                  : "결제 취소 또는 보류 건은 환불 처리, 정산 리포트와 함께 검토하는 흐름이 현재 앱 구조와 가장 잘 맞습니다."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <HomeLinkButton href={buildLocalizedPath("/trade/report", "/en/trade/report")} variant="secondary" size="sm">
                  {en ? "Open Report" : "리포트 열기"}
                </HomeLinkButton>
                <HomeLinkButton href={buildLocalizedPath("/payment/refund", "/en/payment/refund")} variant="secondary" size="sm">
                  {en ? "Payment Refund" : "결제 환불"}
                </HomeLinkButton>
              </div>
            </section>
          </aside>
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
