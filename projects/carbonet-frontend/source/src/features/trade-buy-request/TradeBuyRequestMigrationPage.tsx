import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  AdminInput,
  AdminSelect,
  MemberActionBar,
  MemberButton,
  PageStatusNotice
} from "../member/common";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type StepState = "active" | "pending";

type StepItem = {
  key: string;
  label: string;
  state: StepState;
};

type GuideItem = {
  key: string;
  text: string;
};

type RequestCard = {
  id: string;
  title: string;
  team: string;
  amount: string;
  requestedAt: string;
  statusLabel: string;
  statusClassName: string;
  progressPercent: number;
  accentClassName: string;
};

type BuyRequestContent = {
  pageTitle: string;
  pageSubtitle: string;
  homeLabel: string;
  sectionLabel: string;
  currentLabel: string;
  heroTitle: string;
  heroBody: string;
  topNav: string[];
  teamMeta: string;
  userName: string;
  budgetLabel: string;
  nextApprovalLabel: string;
  wizardTitle: string;
  stepCounter: string;
  categoryLabel: string;
  itemLabel: string;
  quantityLabel: string;
  unitLabel: string;
  draftLabel: string;
  nextLabel: string;
  guideTitle: string;
  guideHint: string;
  pendingTitle: string;
  pendingBody: string;
  searchPlaceholder: string;
  filterLabel: string;
  summaryEyebrow: string;
  summaryTitle: string;
  summaryBody: string;
  notice: string;
  categories: Array<{ value: string; label: string }>;
  units: Array<{ value: string; label: string }>;
  steps: StepItem[];
  guides: GuideItem[];
  requestCards: RequestCard[];
};

const CONTENT: Record<"ko" | "en", BuyRequestContent> = {
  ko: {
    pageTitle: "구매 요청 센터",
    pageSubtitle: "Purchase Request Center",
    homeLabel: "홈",
    sectionLabel: "거래 및 구매요청",
    currentLabel: "구매 요청",
    heroTitle: "신규 구매 요청",
    heroBody: "부서 운영에 필요한 물품 및 서비스 구매를 위한 가이드형 신청 프로세스입니다.",
    topNav: ["대시보드", "거래 및 구매요청", "주문/체결 내역", "자산/재고 관리"],
    teamMeta: "기술연구소 · 전략기획팀",
    userName: "김구매 선임연구원님",
    budgetLabel: "예산 집행률 72.4%",
    nextApprovalLabel: "차기 결재일 내일",
    wizardTitle: "Step 01. 품목 선정",
    stepCounter: "1 / 4",
    categoryLabel: "요청 품목 분류",
    itemLabel: "품목명 / 서비스명",
    quantityLabel: "수량",
    unitLabel: "단위",
    draftLabel: "임시 저장",
    nextLabel: "다음 단계로 이동",
    guideTitle: "부서 구매 가이드",
    guideHint: "도움이 필요하신가요? 사내 메신저 '구매지원봇'을 이용하세요.",
    pendingTitle: "나의 구매 요청 현황",
    pendingBody: "현재 결재 진행 중이거나 확인이 필요한 요청 건들입니다.",
    searchPlaceholder: "요청서 검색...",
    filterLabel: "필터",
    summaryEyebrow: "신청 가이드",
    summaryTitle: "예산 검토 전 품목 정보를 먼저 확정합니다.",
    summaryBody: "품목 분류, 대상 수량, 단위를 입력하면 다음 단계에서 부서 예산과 승인 라인을 검토합니다.",
    notice: "IT 장비 신청 시 보안 적합성 검토서를 함께 준비해 주세요.",
    categories: [
      { value: "office", label: "사무용품 및 소모품" },
      { value: "it", label: "IT 하드웨어 / 소프트웨어" },
      { value: "lab", label: "연구 시설 및 장비" },
      { value: "service", label: "외부 용역 및 컨설팅" }
    ],
    units: [
      { value: "EA", label: "EA (개)" },
      { value: "SET", label: "SET (조)" },
      { value: "BOX", label: "BOX (박스)" }
    ],
    steps: [
      { key: "pick", label: "품목 선정", state: "active" },
      { key: "budget", label: "예산 확인", state: "pending" },
      { key: "details", label: "신청 정보", state: "pending" },
      { key: "submit", label: "최종 제출", state: "pending" }
    ],
    guides: [
      { key: "capex", text: "단가가 500만원 이상인 경우 자산 관리팀의 사전 승인이 필요합니다." },
      { key: "security", text: "IT 장비 신청 시 '보안 적합성 검토서'를 반드시 첨부해 주세요." },
      { key: "history", text: "동일 품목의 과거 구매 이력은 주문/체결 내역 메뉴에서 확인 가능합니다." }
    ],
    requestCards: [
      {
        id: "REQ-20260402-01",
        title: "고성능 데이터 분석용 서버",
        team: "기술연구소 · 인프라팀 협조 건",
        amount: "₩ 12,450,000",
        requestedAt: "2026.04.02",
        statusLabel: "결재 대기",
        statusClassName: "bg-amber-100 text-amber-700",
        progressPercent: 40,
        accentClassName: "border-l-amber-500"
      },
      {
        id: "REQ-20260401-07",
        title: "사내 협업용 라이선스 추가 구매",
        team: "전략기획팀 · 운영예산",
        amount: "₩ 2,880,000",
        requestedAt: "2026.04.01",
        statusLabel: "예산 확인",
        statusClassName: "bg-blue-100 text-blue-700",
        progressPercent: 65,
        accentClassName: "border-l-blue-500"
      },
      {
        id: "REQ-20260329-03",
        title: "실험실 정밀 저울 교체",
        team: "탄소실증랩 · 장비교체",
        amount: "₩ 4,360,000",
        requestedAt: "2026.03.29",
        statusLabel: "검토 완료",
        statusClassName: "bg-emerald-100 text-emerald-700",
        progressPercent: 100,
        accentClassName: "border-l-emerald-500"
      },
      {
        id: "REQ-20260327-11",
        title: "외부 규제 컨설팅 용역",
        team: "정책대응셀 · 규제대응",
        amount: "₩ 8,900,000",
        requestedAt: "2026.03.27",
        statusLabel: "보완 요청",
        statusClassName: "bg-rose-100 text-rose-700",
        progressPercent: 25,
        accentClassName: "border-l-rose-500"
      }
    ]
  },
  en: {
    pageTitle: "Purchase Request Center",
    pageSubtitle: "Purchase Request Center",
    homeLabel: "Home",
    sectionLabel: "Trade & Requests",
    currentLabel: "Buy Request",
    heroTitle: "New Purchase Request",
    heroBody: "A guided request workflow for goods and services needed by your department.",
    topNav: ["Dashboard", "Trade & Requests", "Orders & Settlement", "Assets & Inventory"],
    teamMeta: "Technology Lab · Strategy Planning",
    userName: "Kim Buyer, Senior Researcher",
    budgetLabel: "Budget execution 72.4%",
    nextApprovalLabel: "Next approval tomorrow",
    wizardTitle: "Step 01. Select item",
    stepCounter: "1 / 4",
    categoryLabel: "Request category",
    itemLabel: "Item / Service name",
    quantityLabel: "Quantity",
    unitLabel: "Unit",
    draftLabel: "Save draft",
    nextLabel: "Move to next step",
    guideTitle: "Department purchase guide",
    guideHint: "Need help? Contact the internal messenger bot for purchase support.",
    pendingTitle: "My Purchase Requests",
    pendingBody: "Requests that are currently awaiting approval or require attention.",
    searchPlaceholder: "Search request...",
    filterLabel: "Filter",
    summaryEyebrow: "Guided entry",
    summaryTitle: "Finalize the item scope before budget validation.",
    summaryBody: "After category, quantity, and unit are set, the next step reviews budget availability and the approval line.",
    notice: "For IT equipment requests, prepare the security suitability review form before submission.",
    categories: [
      { value: "office", label: "Office supplies & consumables" },
      { value: "it", label: "IT hardware / software" },
      { value: "lab", label: "Research facilities & equipment" },
      { value: "service", label: "External service & consulting" }
    ],
    units: [
      { value: "EA", label: "EA" },
      { value: "SET", label: "SET" },
      { value: "BOX", label: "BOX" }
    ],
    steps: [
      { key: "pick", label: "Item Selection", state: "active" },
      { key: "budget", label: "Budget Check", state: "pending" },
      { key: "details", label: "Request Details", state: "pending" },
      { key: "submit", label: "Final Submit", state: "pending" }
    ],
    guides: [
      { key: "capex", text: "Items above KRW 5 million require pre-approval from the asset management team." },
      { key: "security", text: "IT equipment requests must include the security suitability review form." },
      { key: "history", text: "Past purchases for the same item can be reviewed in the orders and settlement menu." }
    ],
    requestCards: [
      {
        id: "REQ-20260402-01",
        title: "High-performance analytics server",
        team: "Technology Lab · Infra support",
        amount: "KRW 12,450,000",
        requestedAt: "2026.04.02",
        statusLabel: "Approval pending",
        statusClassName: "bg-amber-100 text-amber-700",
        progressPercent: 40,
        accentClassName: "border-l-amber-500"
      },
      {
        id: "REQ-20260401-07",
        title: "Additional collaboration licenses",
        team: "Strategy Planning · Operations budget",
        amount: "KRW 2,880,000",
        requestedAt: "2026.04.01",
        statusLabel: "Budget review",
        statusClassName: "bg-blue-100 text-blue-700",
        progressPercent: 65,
        accentClassName: "border-l-blue-500"
      },
      {
        id: "REQ-20260329-03",
        title: "Lab precision scale replacement",
        team: "Carbon Lab · Equipment refresh",
        amount: "KRW 4,360,000",
        requestedAt: "2026.03.29",
        statusLabel: "Reviewed",
        statusClassName: "bg-emerald-100 text-emerald-700",
        progressPercent: 100,
        accentClassName: "border-l-emerald-500"
      },
      {
        id: "REQ-20260327-11",
        title: "External regulatory consulting service",
        team: "Policy response cell",
        amount: "KRW 8,900,000",
        requestedAt: "2026.03.27",
        statusLabel: "Need revision",
        statusClassName: "bg-rose-100 text-rose-700",
        progressPercent: 25,
        accentClassName: "border-l-rose-500"
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
        --kr-gov-bg-gray: #f4f6f8;
        --kr-gov-radius: 8px;
      }
      body { font-family: 'Noto Sans KR', 'Public Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .skip-link { position: absolute; top: -100px; left: 0; z-index: 100; padding: 12px; background: var(--kr-gov-blue); color: white; transition: top .2s ease; }
      .skip-link:focus { top: 0; }
      .trade-grid::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
        background-size: 40px 40px;
        opacity: 0.4;
        pointer-events: none;
      }
      .step-pill {
        position: relative;
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
      }
      .step-pill::after {
        content: "";
        position: absolute;
        top: 19px;
        left: calc(50% + 24px);
        width: calc(100% - 48px);
        height: 2px;
        background: #dbe3ec;
      }
      .step-pill:last-child::after { display: none; }
      .step-node {
        position: relative;
        z-index: 1;
        display: flex;
        height: 40px;
        width: 40px;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        border: 2px solid #cbd5e1;
        background: white;
        color: #94a3b8;
        font-weight: 800;
      }
      .step-pill[data-state="active"] .step-node {
        border-color: var(--kr-gov-blue);
        background: var(--kr-gov-blue);
        color: white;
      }
      .step-pill[data-state="active"]::after {
        background: var(--kr-gov-blue);
      }
    `}</style>
  );
}

export function TradeBuyRequestMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const [category, setCategory] = useState(content.categories[0]?.value ?? "");
  const [itemName, setItemName] = useState(en ? "Two high-performance workstations" : "고성능 워크스테이션 2대");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(content.units[0]?.value ?? "");
  const [searchKeyword, setSearchKeyword] = useState("");

  const filteredRequests = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return content.requestCards;
    }
    return content.requestCards.filter((card) => (
      `${card.id} ${card.title} ${card.team}`.toLowerCase().includes(keyword)
    ));
  }, [content.requestCards, searchKeyword]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-buy-request", {
      language: en ? "en" : "ko",
      category,
      quantity,
      unit,
      pendingCount: filteredRequests.length
    });
  }, [category, en, filteredRequests.length, quantity, unit]);

  return (
    <>
      <InlineStyles />
      <div className="min-h-screen bg-[#f8fafc] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Department purchase request system" : "대한민국 정부 공식 서비스 | 부서별 구매 요청 시스템"}
        />

        <header className="sticky top-0 z-40 border-b border-[var(--kr-gov-border-light)] bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto max-w-[1440px] px-4 lg:px-8">
            <div className="flex min-h-20 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-3 bg-transparent p-0 text-left" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
                  <span className="material-symbols-outlined text-[36px] font-black text-[var(--kr-gov-blue)]">shopping_cart</span>
                  <div>
                    <h1 className="text-xl font-black leading-tight">{content.pageTitle}</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-text-secondary)]">{content.pageSubtitle}</p>
                  </div>
                </button>
                <nav className="hidden xl:flex items-center gap-1">
                  {content.topNav.map((item, index) => (
                    <a
                      className={index === 1
                        ? "border-b-4 border-[var(--kr-gov-blue)] px-4 py-6 text-[15px] font-bold text-[var(--kr-gov-blue)]"
                        : "px-4 py-6 text-[15px] font-bold text-slate-500 transition hover:text-[var(--kr-gov-blue)]"}
                      href={index === 1 ? buildLocalizedPath("/trade/buy_request", "/en/trade/buy_request") : "#"}
                      key={item}
                      onClick={(event) => {
                        if (index !== 1) {
                          event.preventDefault();
                        }
                      }}
                    >
                      {item}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="hidden text-right md:block">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{content.teamMeta}</p>
                  <p className="text-sm font-black">{content.userName}</p>
                </div>
                <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 md:block">
                  {content.budgetLabel}
                </div>
                <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 lg:block">
                  {content.nextApprovalLabel}
                </div>
                <UserLanguageToggle
                  en={en}
                  onKo={() => navigate("/trade/buy_request")}
                  onEn={() => navigate("/en/trade/buy_request")}
                />
                {session.value?.authenticated ? (
                  <MemberButton onClick={() => void session.logout()} size="md" variant="primary">{en ? "Logout" : "로그아웃"}</MemberButton>
                ) : (
                  <a className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                    {en ? "Login" : "로그인"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        <main id="main-content">
          <section className="trade-grid relative overflow-hidden bg-slate-950 py-14" data-help-id="trade-buy-request-hero">
            <div className="relative z-10 mx-auto max-w-[1200px] px-4 lg:px-8">
              <div className="text-center">
                <nav aria-label="Breadcrumb" className="mb-4 flex justify-center text-sm text-slate-400">
                  <ol className="flex items-center gap-2">
                    <li><a className="hover:text-white" href={buildLocalizedPath("/home", "/en/home")}>{content.homeLabel}</a></li>
                    <li><span className="material-symbols-outlined text-base">chevron_right</span></li>
                    <li>{content.sectionLabel}</li>
                    <li><span className="material-symbols-outlined text-base">chevron_right</span></li>
                    <li className="font-bold text-white">{content.currentLabel}</li>
                  </ol>
                </nav>
                <h2 className="text-3xl font-black text-white">{content.heroTitle}</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300">{content.heroBody}</p>
              </div>

              <div className="mt-10 overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-6" data-help-id="trade-buy-request-steps">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--kr-gov-blue)]">{content.stepCounter}</p>
                      <h3 className="mt-1 text-lg font-black text-slate-900">{content.wizardTitle}</h3>
                    </div>
                    <div className="hidden rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 md:block">
                      {content.notice}
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    {content.steps.map((step, index) => (
                      <div className="step-pill" data-state={step.state} key={step.key}>
                        <div className="step-node">{index + 1}</div>
                        <span className={step.state === "active" ? "text-[11px] font-bold text-[var(--kr-gov-blue)]" : "text-[11px] font-bold text-slate-400"}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]" data-help-id="trade-buy-request-form">
                  <section className="px-6 py-8 lg:px-10">
                    <div className="grid gap-6 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.categoryLabel}</span>
                        <AdminSelect value={category} onChange={(event) => setCategory(event.target.value)}>
                          {content.categories.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </AdminSelect>
                      </label>

                      <label className="block md:col-span-2">
                        <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.itemLabel}</span>
                        <AdminInput value={itemName} onChange={(event) => setItemName(event.target.value)} />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.quantityLabel}</span>
                        <AdminInput inputMode="numeric" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{content.unitLabel}</span>
                        <AdminSelect value={unit} onChange={(event) => setUnit(event.target.value)}>
                          {content.units.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </AdminSelect>
                      </label>
                    </div>

                    <MemberActionBar
                      className="mt-8"
                      dataHelpId="trade-buy-request-actions"
                      description={content.summaryBody}
                      eyebrow={content.summaryEyebrow}
                      primary={<MemberButton size="lg" variant="primary">{content.nextLabel}</MemberButton>}
                      secondary={{ label: content.draftLabel }}
                      title={content.summaryTitle}
                    />
                  </section>

                  <aside className="border-t border-slate-100 bg-blue-50/70 px-6 py-8 lg:border-l lg:border-t-0 lg:px-8" data-help-id="trade-buy-request-guide">
                    <div className="rounded-[24px] border border-blue-100 bg-white/80 p-6 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">info</span>
                        <h3 className="text-lg font-black text-blue-950">{content.guideTitle}</h3>
                      </div>
                      <ul className="mt-5 space-y-3 text-sm leading-6 text-blue-900">
                        {content.guides.map((item) => (
                          <li className="flex gap-3" key={item.key}>
                            <span className="mt-1 text-blue-400">•</span>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">
                        {content.guideHint}
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1440px] px-4 py-16 lg:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-2xl font-black text-slate-950">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">pending_actions</span>
                  {content.pendingTitle}
                </h3>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{content.pendingBody}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="min-w-[260px]">
                  <AdminInput placeholder={content.searchPlaceholder} value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} />
                </div>
                <MemberButton variant="secondary">{content.filterLabel}</MemberButton>
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <PageStatusNotice className="mt-8" tone="warning">
                {en ? "No purchase requests matched the current search." : "현재 검색 조건에 맞는 구매 요청이 없습니다."}
              </PageStatusNotice>
            ) : null}

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4" data-help-id="trade-buy-request-pending">
              {filteredRequests.map((card) => (
                <article className={`flex h-full flex-col rounded-[24px] border border-slate-200 border-l-4 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${card.accentClassName}`.trim()} key={card.id}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${card.statusClassName}`.trim()}>{card.statusLabel}</span>
                    <span className="text-[11px] font-bold text-slate-400">{card.id}</span>
                  </div>
                  <h4 className="mt-4 text-lg font-black text-slate-950">{card.title}</h4>
                  <p className="mt-1 text-xs text-slate-500">{card.team}</p>
                  <dl className="mt-6 space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-400">{en ? "Amount" : "요청 금액"}</dt>
                      <dd className="font-bold text-slate-900">{card.amount}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-400">{en ? "Requested" : "요청 일자"}</dt>
                      <dd className="font-medium text-slate-900">{card.requestedAt}</dd>
                    </div>
                  </dl>
                  <div className="mt-6">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[var(--kr-gov-blue)]" style={{ width: `${card.progressPercent}%` }} />
                    </div>
                    <p className="mt-2 text-right text-[11px] font-bold text-slate-400">{card.progressPercent}%</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

        <UserPortalFooter
          addressLine={en ? "Government Complex Sejong, Republic of Korea" : "세종특별자치시 정부청사로 370"}
          copyright={en ? "Copyright 2026. Carbonet. All rights reserved." : "Copyright 2026. Carbonet. All rights reserved."}
          footerLinks={en ? ["Sitemap", "Privacy Policy", "Terms of Use"] : ["사이트맵", "개인정보처리방침", "이용약관"]}
          lastModifiedLabel={en ? "Updated" : "최종 수정"}
          orgName={en ? "Carbonet Service" : "Carbonet 서비스"}
          serviceLine={en ? "Purchase request support workspace" : "부서 구매 요청 지원 워크스페이스"}
          waAlt={en ? "Web accessibility mark" : "웹 접근성 품질마크"}
        />
      </div>
    </>
  );
}
