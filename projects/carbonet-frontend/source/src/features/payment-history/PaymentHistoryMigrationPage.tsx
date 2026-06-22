import { useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  PaymentHistorySkipLink,
  PaymentHistoryGovernmentBar,
  PaymentHistoryHeader,
  PaymentHistoryNav,
  PaymentHistoryHero,
  PaymentHistoryFilters,
  PaymentHistoryTable,
  PaymentHistoryGuidance,
  PaymentHistoryFooter
} from "./components";
import type { PaymentCategory, PaymentStatus, PaymentRow, LocaleContent } from "./types/PaymentHistoryTypes";

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

export function PaymentHistoryMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
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

  function handleProofClick(id: string) {
    console.log("Proof clicked:", id);
  }

  return (
    <div className="min-h-screen bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)]">
      <PaymentHistorySkipLink content={content} />
      <PaymentHistoryGovernmentBar content={content} />
      <PaymentHistoryHeader content={content} en={en} />
      <PaymentHistoryNav content={content} />
      <main id="main-content" className="pb-16">
        <PaymentHistoryHero
          content={content}
          totalOutflow={totalOutflow}
          refundAmount={refundAmount}
          pendingAmount={pendingAmount}
          budgetLeft={budgetLeft}
          en={en}
          onExport={() => console.log("Export clicked")}
          onCreate={() => navigate(buildLocalizedPath("/trade/buy_request", "/en/trade/buy_request"))}
        />
        <PaymentHistoryFilters
          content={content}
          query={query}
          category={category}
          status={status}
          selectedCount={selectedIds.length}
          totalCount={filteredRows.length}
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
          onStatusChange={setStatus}
          onFilter={() => console.log("Filter clicked")}
        />
        <section className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] lg:px-8">
          <PaymentHistoryTable
            rows={filteredRows}
            content={content}
            en={en}
            selectedIds={selectedIds}
            onToggleAll={toggleAll}
            onToggleRow={toggleRow}
            onProofClick={handleProofClick}
          />
          <PaymentHistoryGuidance content={content} en={en} />
        </section>
      </main>
      <PaymentHistoryFooter content={content} />
    </div>
  );
}