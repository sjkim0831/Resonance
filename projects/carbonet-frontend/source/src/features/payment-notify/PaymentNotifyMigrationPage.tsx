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
import { HomeButton, HomeInput } from "../home-ui/common";

type NavItem = {
  label: string;
  href: string;
  current?: boolean;
};

type SummaryCard = {
  key: string;
  label: string;
  value: string;
  toneClassName: string;
};

type VerificationAction = {
  key: string;
  label: string;
  icon: string;
  toneClassName: string;
};

type AuditTrailItem = {
  key: string;
  title: string;
  at: string;
  detail: string;
  toneClassName: string;
};

type InvoiceLine = {
  key: string;
  date: string;
  description: string;
  spec: string;
  quantity: string;
  unitPrice: string;
  supplyValue: string;
  taxAmount: string;
  remark: string;
};

type RelatedRecord = {
  key: string;
  label: string;
  value: string;
  toneClassName?: string;
};

type LocaleContent = {
  pageTitle: string;
  pageSubtitle: string;
  governmentText: string;
  governmentStatus: string;
  roleLabel: string;
  roleName: string;
  logoutLabel: string;
  navItems: NavItem[];
  heroTitle: string;
  heroBody: string;
  heroBadge: string;
  summaryCards: SummaryCard[];
  searchPlaceholder: string;
  searchHint: string;
  openHistoryLabel: string;
  toolsTitle: string;
  auditTrailTitle: string;
  documentTitle: string;
  documentSubtitle: string;
  supplierLabel: string;
  recipientLabel: string;
  registrationLabel: string;
  businessNameLabel: string;
  representativeLabel: string;
  addressLabel: string;
  businessTypeLabel: string;
  businessItemLabel: string;
  issueDateLabel: string;
  supplyValueLabel: string;
  taxValueLabel: string;
  noteLabel: string;
  itemsLabel: string;
  totalAmountLabel: string;
  cashLabel: string;
  billedLabel: string;
  receivedLabel: string;
  approvalNumberLabel: string;
  digitalSignatureLabel: string;
  certifiedCopyLabel: string;
  relatedInfoTitle: string;
  projectLabel: string;
  settlementStatusLabel: string;
  allocationLabel: string;
  excessLabel: string;
  connectedRecordsLabel: string;
  commentLabel: string;
  commentPlaceholder: string;
  commentActionLabel: string;
  noticeTitle: string;
  noticeBody: string;
  footerOrg: string;
  footerAddress: string;
  footerServiceLine: string;
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
  footerLinks: string[];
};

const CONTENT: Record<"ko" | "en", LocaleContent> = {
  ko: {
    pageTitle: "세금계산서 조회",
    pageSubtitle: "TAX INVOICE REVIEW DESK",
    governmentText: "대한민국 정부 공식 서비스 | 환불 요청 및 세금계산서 검증 포털",
    governmentStatus: "세금계산서 상태 최종 동기화: 2026.04.02 16:40",
    roleLabel: "정산 준법감시 담당",
    roleName: "박철수 감사팀장",
    logoutLabel: "로그아웃",
    navItems: [
      { label: "결제 요청", href: "/payment/pay" },
      { label: "결제 내역", href: "/payment/history" },
      { label: "환불 요청", href: "/payment/refund" },
      { label: "환불 계좌", href: "/payment/refund_account" },
      { label: "세금계산서", href: "/payment/notify", current: true }
    ],
    heroTitle: "세금계산서 검증 및 정산 연계 화면",
    heroBody: "참조 화면의 문서형 레이아웃을 현재 Carbonet 홈 포털 패턴으로 재구성했습니다. 환불 요청과 연결된 세금계산서를 중앙 문서 뷰어에서 검토하고, 좌우 패널에서 감사 이력과 정산 상태를 함께 확인할 수 있습니다.",
    heroBadge: "VAT / AUDIT READY",
    summaryCards: [
      { key: "approval", label: "승인 상태", value: "문서 승인 완료", toneClassName: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      { key: "sync", label: "국세청 연계", value: "전송 대기 D-8", toneClassName: "bg-amber-50 text-amber-700 border-amber-200" },
      { key: "project", label: "연계 현장", value: "울산 제3 화학기지", toneClassName: "bg-blue-50 text-blue-700 border-blue-200" }
    ],
    searchPlaceholder: "승인번호, 거래처명, 프로젝트명으로 검색",
    searchHint: "검색어는 품목, 감사 이력, 연계 기록에 동시에 반영됩니다.",
    openHistoryLabel: "결제 내역으로 이동",
    toolsTitle: "검증 도구",
    auditTrailTitle: "감사 이력",
    documentTitle: "전자세금계산서",
    documentSubtitle: "(공급받는자 보관용)",
    supplierLabel: "공급자",
    recipientLabel: "공급받는자",
    registrationLabel: "등록번호",
    businessNameLabel: "상호",
    representativeLabel: "대표자",
    addressLabel: "주소",
    businessTypeLabel: "업태",
    businessItemLabel: "종목",
    issueDateLabel: "작성일자",
    supplyValueLabel: "공급가액",
    taxValueLabel: "세액",
    noteLabel: "비고",
    itemsLabel: "품목",
    totalAmountLabel: "합계금액",
    cashLabel: "현금",
    billedLabel: "청구",
    receivedLabel: "영수",
    approvalNumberLabel: "승인번호",
    digitalSignatureLabel: "전자서명 ID",
    certifiedCopyLabel: "CCUS 통합정산본부\n원본대조필",
    relatedInfoTitle: "연계 정보",
    projectLabel: "연계 프로젝트",
    settlementStatusLabel: "배출권 정산 상태",
    allocationLabel: "할당량",
    excessLabel: "초과분",
    connectedRecordsLabel: "연계 기록",
    commentLabel: "감사 코멘트",
    commentPlaceholder: "환불 요청과 세금계산서의 정합성 검토 의견을 입력하세요.",
    commentActionLabel: "코멘트 저장 및 확인",
    noticeTitle: "준법 안내",
    noticeBody: "부가가치세법 제32조에 따라 발급일이 속한 달의 다음 달 10일까지 국세청 전송이 필요합니다. 환불 승인 전에 공급가액, 세액, 프로젝트 정산 내역의 일치 여부를 확인해야 합니다.",
    footerOrg: "CCUS 통합금융관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110",
    footerServiceLine: "세금계산서 및 정산 지원 02-9876-5432",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Tax Invoice Review Portal.",
    footerLastModifiedLabel: "최종 수정일",
    footerWaAlt: "웹 접근성 품질인증 마크",
    footerLinks: ["시스템 로그", "보안 정책", "헬프데스크"]
  },
  en: {
    pageTitle: "Tax Invoice Review",
    pageSubtitle: "TAX INVOICE REVIEW DESK",
    governmentText: "Republic of Korea Official Service | Refund and Tax Invoice Verification Portal",
    governmentStatus: "Tax invoice sync updated: 2026.04.02 16:40",
    roleLabel: "Settlement Compliance Lead",
    roleName: "Chul-soo Park",
    logoutLabel: "Logout",
    navItems: [
      { label: "Payment Request", href: "/payment/pay" },
      { label: "Payment History", href: "/payment/history" },
      { label: "Refund Requests", href: "/payment/refund" },
      { label: "Refund Account", href: "/payment/refund_account" },
      { label: "Tax Invoice", href: "/payment/notify", current: true }
    ],
    heroTitle: "Tax invoice review and settlement linkage",
    heroBody: "The reference document layout has been rebuilt inside the current Carbonet home portal. Operators can inspect a refund-linked tax invoice in the central document viewer while reviewing the audit trail and settlement status from the side panels.",
    heroBadge: "VAT / AUDIT READY",
    summaryCards: [
      { key: "approval", label: "Approval", value: "Document approved", toneClassName: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      { key: "sync", label: "NTS Transfer", value: "Due in 8 days", toneClassName: "bg-amber-50 text-amber-700 border-amber-200" },
      { key: "project", label: "Linked Site", value: "Ulsan No. 3 Chemical Base", toneClassName: "bg-blue-50 text-blue-700 border-blue-200" }
    ],
    searchPlaceholder: "Search by approval no., vendor, or project",
    searchHint: "The query filters invoice items, audit events, and linked records together.",
    openHistoryLabel: "Open payment history",
    toolsTitle: "Verification Tools",
    auditTrailTitle: "Audit Trail",
    documentTitle: "Electronic Tax Invoice",
    documentSubtitle: "(Recipient Copy)",
    supplierLabel: "Supplier",
    recipientLabel: "Recipient",
    registrationLabel: "Registration No.",
    businessNameLabel: "Business Name",
    representativeLabel: "Representative",
    addressLabel: "Address",
    businessTypeLabel: "Business Type",
    businessItemLabel: "Line of Biz",
    issueDateLabel: "Date Created",
    supplyValueLabel: "Supply Value",
    taxValueLabel: "Tax Amount",
    noteLabel: "Remarks",
    itemsLabel: "Item Description",
    totalAmountLabel: "Total Amount",
    cashLabel: "Cash",
    billedLabel: "Billed",
    receivedLabel: "Received",
    approvalNumberLabel: "Approval No.",
    digitalSignatureLabel: "Digital Signature ID",
    certifiedCopyLabel: "CCUS Integrated\nMgmt. HQ\nCertified Copy",
    relatedInfoTitle: "Related Data",
    projectLabel: "Connected Project",
    settlementStatusLabel: "Emission Settlement Status",
    allocationLabel: "Allocation",
    excessLabel: "Excess",
    connectedRecordsLabel: "Connected Records",
    commentLabel: "Audit Comment",
    commentPlaceholder: "Write a review note about refund-to-invoice consistency.",
    commentActionLabel: "Save and confirm comment",
    noticeTitle: "Compliance Notice",
    noticeBody: "Under Article 32 of the VAT Act, the invoice must be transmitted to the NTS by the 10th of the month following issuance. Confirm that the supply amount, tax amount, and project settlement record are aligned before approving the refund.",
    footerOrg: "CCUS Integrated Finance Operations",
    footerAddress: "110 Sejong-daero, Jung-gu, Seoul 04551",
    footerServiceLine: "Invoice and settlement support 02-9876-5432",
    footerCopyright: "© 2026 CCUS Carbon Footprint Platform. Tax Invoice Review Portal.",
    footerLastModifiedLabel: "Last Modified",
    footerWaAlt: "Web Accessibility Quality Mark",
    footerLinks: ["System Logs", "Security Policy", "Help Desk"]
  }
};

const VERIFICATION_ACTIONS: Record<"ko" | "en", VerificationAction[]> = {
  ko: [
    { key: "signature", label: "전자서명 검증", icon: "verified_user", toneClassName: "bg-blue-50 text-blue-700 border-blue-100" },
    { key: "nts", label: "국세청 DB 대조", icon: "content_paste_search", toneClassName: "bg-slate-50 text-slate-700 border-slate-200" },
    { key: "print", label: "증빙 사본 출력", icon: "print", toneClassName: "bg-slate-50 text-slate-700 border-slate-200" }
  ],
  en: [
    { key: "signature", label: "Verify digital signature", icon: "verified_user", toneClassName: "bg-blue-50 text-blue-700 border-blue-100" },
    { key: "nts", label: "NTS database cross-check", icon: "content_paste_search", toneClassName: "bg-slate-50 text-slate-700 border-slate-200" },
    { key: "print", label: "Print certified copy", icon: "print", toneClassName: "bg-slate-50 text-slate-700 border-slate-200" }
  ]
};

const AUDIT_TRAIL: Record<"ko" | "en", AuditTrailItem[]> = {
  ko: [
    { key: "approved", title: "문서 승인 완료", at: "2026.04.02 14:22:10", detail: "이현장 관리자 전자서명 적용 완료", toneClassName: "text-blue-600" },
    { key: "integrity", title: "데이터 무결성 검증", at: "2026.04.02 13:05:45", detail: "배출권 정산 및 환불 요청 내역과 일치", toneClassName: "text-emerald-600" },
    { key: "issued", title: "세금계산서 발행", at: "2026.04.01 09:30:00", detail: "카본솔루션네트워크 주식회사 발행", toneClassName: "text-slate-500" },
    { key: "settlement", title: "정산 프로세스 시작", at: "2026.03.31 17:40:12", detail: "환불 요청서와 정산 캘린더 연계", toneClassName: "text-slate-500" }
  ],
  en: [
    { key: "approved", title: "Document approval completed", at: "2026.04.02 14:22:10", detail: "Digital signature applied by Lee Hyeon-jang", toneClassName: "text-blue-600" },
    { key: "integrity", title: "Data integrity validation", at: "2026.04.02 13:05:45", detail: "Matches emission settlement and refund records", toneClassName: "text-emerald-600" },
    { key: "issued", title: "Tax invoice issued", at: "2026.04.01 09:30:00", detail: "Issued by Carbon Solution Network Co., Ltd.", toneClassName: "text-slate-500" },
    { key: "settlement", title: "Settlement process initiated", at: "2026.03.31 17:40:12", detail: "Linked to refund request and settlement calendar", toneClassName: "text-slate-500" }
  ]
};

const INVOICE_LINES: Record<"ko" | "en", InvoiceLine[]> = {
  ko: [
    { key: "line-1", date: "04 / 01", description: "배출 데이터 산정 수수료 (울산/포항)", spec: "-", quantity: "1", unitPrice: "8,000,000", supplyValue: "8,000,000", taxAmount: "800,000", remark: "1차 정산" },
    { key: "line-2", date: "04 / 01", description: "현장 검증 지원 및 시스템 유지보수", spec: "M/M", quantity: "0.5", unitPrice: "9,000,000", supplyValue: "4,500,000", taxAmount: "450,000", remark: "-" },
    { key: "line-3", date: "04 / 01", description: "환불 재검토 자료 패키징", spec: "SET", quantity: "1", unitPrice: "750,000", supplyValue: "750,000", taxAmount: "75,000", remark: "증빙 첨부" }
  ],
  en: [
    { key: "line-1", date: "04 / 01", description: "Emission data calculation fee (Ulsan/Pohang)", spec: "-", quantity: "1", unitPrice: "8,000,000", supplyValue: "8,000,000", taxAmount: "800,000", remark: "1st settlement" },
    { key: "line-2", date: "04 / 01", description: "Field verification support and system maintenance", spec: "M/M", quantity: "0.5", unitPrice: "9,000,000", supplyValue: "4,500,000", taxAmount: "450,000", remark: "-" },
    { key: "line-3", date: "04 / 01", description: "Refund re-review evidence packaging", spec: "SET", quantity: "1", unitPrice: "750,000", supplyValue: "750,000", taxAmount: "75,000", remark: "Evidence attached" }
  ]
};

const CONNECTED_RECORDS: Record<"ko" | "en", RelatedRecord[]> = {
  ko: [
    { key: "refund", label: "환불 요청 번호", value: "RF-2026-0412", toneClassName: "text-[var(--kr-gov-blue)]" },
    { key: "payment", label: "원결제 번호", value: "PAY-2026-0301-882" },
    { key: "vendor", label: "공급자", value: "카본솔루션네트워크(주)" },
    { key: "operator", label: "담당 운영자", value: "이현장 관리자" }
  ],
  en: [
    { key: "refund", label: "Refund request", value: "RF-2026-0412", toneClassName: "text-[var(--kr-gov-blue)]" },
    { key: "payment", label: "Original payment", value: "PAY-2026-0301-882" },
    { key: "vendor", label: "Supplier", value: "Carbon Solution Network Co., Ltd." },
    { key: "operator", label: "Operator", value: "Lee Hyeon-jang" }
  ]
};

function localizedHref(path: string) {
  return buildLocalizedPath(path, `/en${path}`);
}

export function PaymentNotifyMigrationPage() {
  const session = useFrontendSession();
  const en = isEnglish();
  const locale = en ? "en" : "ko";
  const content = CONTENT[locale];
  const [query, setQuery] = useState("");
  const [comment, setComment] = useState("");
  const [amountMode, setAmountMode] = useState<"billed" | "received">("billed");

  const normalizedQuery = query.trim().toLowerCase();
  const filteredLines = useMemo(
    () => INVOICE_LINES[locale].filter((item) => `${item.description} ${item.remark}`.toLowerCase().includes(normalizedQuery)),
    [locale, normalizedQuery]
  );
  const filteredTrail = useMemo(
    () => AUDIT_TRAIL[locale].filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(normalizedQuery)),
    [locale, normalizedQuery]
  );
  const filteredRecords = useMemo(
    () => CONNECTED_RECORDS[locale].filter((item) => `${item.label} ${item.value}`.toLowerCase().includes(normalizedQuery)),
    [locale, normalizedQuery]
  );

  useEffect(() => {
    logGovernanceScope("PAGE", "payment-notify", {
      language: locale,
      query,
      lineCount: filteredLines.length,
      trailCount: filteredTrail.length,
      recordCount: filteredRecords.length,
      amountMode,
      userType: session.value?.authorCode || "guest"
    });
  }, [amountMode, filteredLines.length, filteredRecords.length, filteredTrail.length, locale, query, session.value?.authorCode]);

  return (
    <div className="min-h-screen bg-[#eef2f7] text-[var(--kr-gov-text-primary)]">
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
                  onClick={() => navigate(localizedHref(item.href))}
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
            <UserLanguageToggle en={en} onKo={() => navigate("/payment/notify")} onEn={() => navigate("/en/payment/notify")} />
            <HomeButton onClick={() => void session.logout()} size="sm" variant="primary">{content.logoutLabel}</HomeButton>
          </>
        )}
      />

      <main id="main-content">
        <section className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-4 py-10 text-white lg:px-8" data-help-id="payment-notify-hero">
          <div className="mx-auto max-w-[1500px]">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold tracking-[0.25em] text-blue-200">
                  {content.heroBadge}
                </span>
                <h1 className="mt-4 text-3xl font-black tracking-tight lg:text-4xl">{content.heroTitle}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{content.heroBody}</p>
              </div>
              <div className="grid w-full gap-3 md:grid-cols-3 xl:max-w-[640px]">
                {content.summaryCards.map((item) => (
                  <article className={`rounded-2xl border p-4 ${item.toneClassName}`} key={item.key}>
                    <p className="text-xs font-bold uppercase tracking-widest">{item.label}</p>
                    <p className="mt-2 text-lg font-black">{item.value}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto -mt-7 max-w-[1500px] px-4 lg:px-8" data-help-id="payment-notify-search">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <HomeInput
                  className="h-14 rounded-2xl border-slate-200 bg-slate-50 pl-12 pr-4 text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={content.searchPlaceholder}
                  value={query}
                />
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 xl:max-w-md">{content.searchHint}</div>
              <HomeButton
                className="h-14 justify-center px-6"
                icon="receipt_long"
                onClick={() => navigate(localizedHref("/payment/history"))}
                size="lg"
                type="button"
                variant="primary"
              >
                {content.openHistoryLabel}
              </HomeButton>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-10 lg:px-8">
          <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
            <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm" data-help-id="payment-notify-tools">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{content.toolsTitle}</h2>
                <div className="mt-4 space-y-3">
                  {VERIFICATION_ACTIONS[locale].map((action) => (
                    <button
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition hover:brightness-[0.98] ${action.toneClassName}`}
                      key={action.key}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-5">
                <h2 className="mb-5 text-xs font-black uppercase tracking-[0.2em] text-slate-400">{content.auditTrailTitle}</h2>
                <div className="relative ml-1 space-y-6">
                  {filteredTrail.map((item) => (
                    <div className="relative pl-6" key={item.key}>
                      <span className="absolute left-0 top-2 h-2 w-2 rounded-full bg-blue-500" />
                      <span className="absolute left-[3.5px] top-4 h-[calc(100%+16px)] w-px bg-slate-200" />
                      <p className="text-[13px] font-bold text-slate-800">{item.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{item.at}</p>
                      <p className={`mt-1 text-[11px] font-medium ${item.toneClassName}`}>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="rounded-[32px] border border-slate-200 bg-slate-100 p-4 shadow-sm lg:p-8" data-help-id="payment-notify-document">
              <div className="mx-auto max-w-[860px] rounded-[28px] border border-slate-300 bg-white px-4 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] lg:px-10 lg:py-9">
                <div className="text-center">
                  <h2 className="inline-block border-[3px] border-black px-6 py-2 text-2xl font-black uppercase tracking-tight lg:text-3xl">{content.documentTitle}</h2>
                  <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.25em] text-slate-400">{content.documentSubtitle}</p>
                </div>

                <div className="mt-7 overflow-hidden rounded-2xl border border-black">
                  <table className="w-full border-collapse text-center text-[11px] lg:text-[12px]">
                    <tbody>
                      <tr>
                        <th className="w-9 border border-black bg-slate-50 px-1 py-2 font-bold" rowSpan={4}>{content.supplierLabel}</th>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.registrationLabel}</th>
                        <td className="border border-black px-2 py-2 text-lg font-black" colSpan={3}>123-45-67890</td>
                        <th className="w-9 border border-black bg-slate-50 px-1 py-2 font-bold" rowSpan={4}>{content.recipientLabel}</th>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.registrationLabel}</th>
                        <td className="border border-black px-2 py-2 text-lg font-black" colSpan={3}>098-76-54321</td>
                      </tr>
                      <tr>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.businessNameLabel}</th>
                        <td className="border border-black px-2 py-2">Carbon Solution Network Co.</td>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.representativeLabel}</th>
                        <td className="border border-black px-2 py-2">{en ? "Gildong Hong" : "홍길동"}</td>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.businessNameLabel}</th>
                        <td className="border border-black px-2 py-2">{en ? "Korea Carbon Mgmt. HQ" : "한국 탄소관리 본부"}</td>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.representativeLabel}</th>
                        <td className="border border-black px-2 py-2">{en ? "Hyeon-jang Lee" : "이현장"}</td>
                      </tr>
                      <tr>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.addressLabel}</th>
                        <td className="border border-black px-2 py-2 text-left" colSpan={3}>{en ? "15F, 110 Sejong-daero, Jung-gu, Seoul" : "서울특별시 중구 세종대로 110, 15층"}</td>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.addressLabel}</th>
                        <td className="border border-black px-2 py-2 text-left" colSpan={3}>{en ? "3F, Carbon Bldg, 123 Sejong-daero, Jung-gu, Seoul" : "서울특별시 중구 세종대로 123, 카본빌딩 3층"}</td>
                      </tr>
                      <tr>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.businessTypeLabel}</th>
                        <td className="border border-black px-2 py-2">{en ? "Service / IT" : "서비스 / IT"}</td>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.businessItemLabel}</th>
                        <td className="border border-black px-2 py-2">{en ? "Emission consulting" : "배출권 컨설팅"}</td>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.businessTypeLabel}</th>
                        <td className="border border-black px-2 py-2">{en ? "Public admin" : "공공행정"}</td>
                        <th className="border border-black bg-slate-50 px-2 py-2">{content.businessItemLabel}</th>
                        <td className="border border-black px-2 py-2">{en ? "Env. support" : "환경관리 지원"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-[-1px] overflow-hidden rounded-b-2xl border border-black">
                  <table className="w-full border-collapse text-center text-[11px] lg:text-[12px]">
                    <tbody>
                      <tr className="bg-slate-50 font-bold">
                        <th className="border border-black px-2 py-2">{content.issueDateLabel}</th>
                        <th className="border border-black px-2 py-2">{content.supplyValueLabel}</th>
                        <th className="border border-black px-2 py-2">{content.taxValueLabel}</th>
                        <th className="border border-black px-2 py-2">{content.noteLabel}</th>
                      </tr>
                      <tr>
                        <td className="border border-black px-2 py-3 font-bold">2026. 04. 01</td>
                        <td className="border border-black px-2 py-3 text-lg font-black">13,250,000</td>
                        <td className="border border-black px-2 py-3 text-lg font-black">1,325,000</td>
                        <td className="border border-black px-2 py-3 text-left">{en ? "April refund-linked settlement package" : "4월 환불 연계 정산 패키지"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-[-1px] overflow-hidden rounded-b-2xl border border-black">
                  <table className="w-full border-collapse text-center text-[10px] lg:text-[11px]">
                    <thead className="bg-slate-50 font-bold">
                      <tr>
                        <th className="border border-black px-2 py-2">{en ? "Date" : "월/일"}</th>
                        <th className="border border-black px-2 py-2">{content.itemsLabel}</th>
                        <th className="border border-black px-2 py-2">{en ? "Spec" : "규격"}</th>
                        <th className="border border-black px-2 py-2">{en ? "Qty" : "수량"}</th>
                        <th className="border border-black px-2 py-2">{en ? "Unit Price" : "단가"}</th>
                        <th className="border border-black px-2 py-2">{content.supplyValueLabel}</th>
                        <th className="border border-black px-2 py-2">{content.taxValueLabel}</th>
                        <th className="border border-black px-2 py-2">{content.noteLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLines.map((line) => (
                        <tr key={line.key}>
                          <td className="border border-black px-2 py-2">{line.date}</td>
                          <td className="border border-black px-2 py-2 text-left">{line.description}</td>
                          <td className="border border-black px-2 py-2">{line.spec}</td>
                          <td className="border border-black px-2 py-2">{line.quantity}</td>
                          <td className="border border-black px-2 py-2 text-right">{line.unitPrice}</td>
                          <td className="border border-black px-2 py-2 text-right">{line.supplyValue}</td>
                          <td className="border border-black px-2 py-2 text-right">{line.taxAmount}</td>
                          <td className="border border-black px-2 py-2 text-left">{line.remark}</td>
                        </tr>
                      ))}
                      {filteredLines.length < 4 ? Array.from({ length: 4 - filteredLines.length }).map((_, index) => (
                        <tr key={`empty-${index}`}>
                          <td className="border border-black px-2 py-3">&nbsp;</td>
                          <td className="border border-black px-2 py-3">&nbsp;</td>
                          <td className="border border-black px-2 py-3">&nbsp;</td>
                          <td className="border border-black px-2 py-3">&nbsp;</td>
                          <td className="border border-black px-2 py-3">&nbsp;</td>
                          <td className="border border-black px-2 py-3">&nbsp;</td>
                          <td className="border border-black px-2 py-3">&nbsp;</td>
                          <td className="border border-black px-2 py-3">&nbsp;</td>
                        </tr>
                      )) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-[-1px] overflow-hidden rounded-b-2xl border border-black">
                  <table className="w-full border-collapse text-center text-[11px] lg:text-[12px]">
                    <tbody>
                      <tr className="bg-slate-50 font-bold">
                        <th className="border border-black px-2 py-2">{content.totalAmountLabel}</th>
                        <th className="border border-black px-2 py-2">{content.cashLabel}</th>
                        <th className="border border-black px-2 py-2">Check</th>
                        <th className="border border-black px-2 py-2">Note</th>
                        <th className="border border-black px-2 py-2">Accounts Rec.</th>
                        <th className="border border-black px-2 py-2">
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-[10px] font-bold">{en ? "This amount is" : "이 금액은"}</span>
                            <button
                              className={`rounded border px-2 py-0.5 text-[10px] ${amountMode === "received" ? "bg-black text-white" : "bg-white text-black"}`}
                              onClick={() => setAmountMode("received")}
                              type="button"
                            >
                              {content.receivedLabel}
                            </button>
                            <button
                              className={`rounded border px-2 py-0.5 text-[10px] ${amountMode === "billed" ? "bg-black text-white" : "bg-white text-black"}`}
                              onClick={() => setAmountMode("billed")}
                              type="button"
                            >
                              {content.billedLabel}
                            </button>
                          </div>
                        </th>
                      </tr>
                      <tr>
                        <td className="border border-black px-2 py-3 text-lg font-black text-blue-700">14,575,000</td>
                        <td className="border border-black px-2 py-3">14,575,000</td>
                        <td className="border border-black px-2 py-3">0</td>
                        <td className="border border-black px-2 py-3">0</td>
                        <td className="border border-black px-2 py-3">0</td>
                        <td className="border border-black px-2 py-3 font-bold">{amountMode === "billed" ? content.billedLabel : content.receivedLabel}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-10 flex flex-col gap-6 border-t border-dashed border-slate-300 pt-8 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1 text-[11px] text-slate-400">
                    <p><strong className="text-slate-600">{content.approvalNumberLabel}:</strong> 20260401-41000001-98765432</p>
                    <p><strong className="text-slate-600">{content.digitalSignatureLabel}:</strong> SIG-KR-GOV-CCUS-8812</p>
                    <p>{en ? "Protected against forgery in accordance with public record management rules." : "공공기록물 관리 규정에 따라 위변조 방지 조치가 적용되었습니다."}</p>
                  </div>
                  <div className="flex justify-end">
                    <div className="flex h-28 w-28 rotate-12 items-center justify-center rounded-full border-[3px] border-red-500 text-center text-[11px] font-black leading-tight text-red-500 whitespace-pre-line">
                      {content.certifiedCopyLabel}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm" data-help-id="payment-notify-related">
              <div className="p-6">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{content.relatedInfoTitle}</h2>
                <div className="mt-6">
                  <label className="mb-2 block text-[11px] font-bold text-slate-500">{content.projectLabel}</label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-black text-slate-800">{en ? "Ulsan No. 3 Chemical Base" : "울산 제3 화학기지"}</p>
                    <p className="mt-1 text-[11px] text-slate-400">ID: US-042</p>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="mb-2 block text-[11px] font-bold text-slate-500">{content.settlementStatusLabel}</label>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{content.allocationLabel}</span>
                      <strong>12,000 tCO2</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-red-600">
                      <span>{content.excessLabel}</span>
                      <strong>+1,240 tCO2</strong>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-[85%] rounded-full bg-red-500" />
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="mb-3 block text-[11px] font-bold text-slate-500">{content.connectedRecordsLabel}</label>
                  <div className="space-y-3">
                    {filteredRecords.map((record) => (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={record.key}>
                        <p className="text-[11px] font-bold text-slate-500">{record.label}</p>
                        <p className={`mt-1 text-sm font-black text-slate-800 ${record.toneClassName || ""}`}>{record.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-6">
                  <label className="mb-3 block text-[11px] font-bold text-slate-500" htmlFor="payment-notify-comment">{content.commentLabel}</label>
                  <textarea
                    className="h-28 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-[var(--kr-gov-blue)] focus:ring-2 focus:ring-[var(--kr-gov-blue)]/15"
                    id="payment-notify-comment"
                    onChange={(event) => setComment(event.target.value)}
                    placeholder={content.commentPlaceholder}
                    value={comment}
                  />
                  <button className="mt-3 w-full rounded-2xl bg-[var(--kr-gov-blue)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#002d72]" type="button">
                    {content.commentActionLabel}
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[18px] text-amber-600">gavel</span>
                    <div>
                      <p className="text-[11px] font-bold text-amber-800">{content.noticeTitle}</p>
                      <p className="mt-1 text-[11px] leading-5 text-amber-700">{content.noticeBody}</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <UserPortalFooter
        orgName={content.footerOrg}
        addressLine={content.footerAddress}
        serviceLine={content.footerServiceLine}
        copyright={content.footerCopyright}
        footerLinks={content.footerLinks}
        waAlt={content.footerWaAlt}
        lastModifiedLabel={content.footerLastModifiedLabel}
      />
    </div>
  );
}

export default PaymentNotifyMigrationPage;
