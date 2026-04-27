import { useEffect, useMemo } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import type { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";

function handleGovSymbolError(event: React.SyntheticEvent<HTMLImageElement>) {
  if (!event.currentTarget.dataset.fallbackApplied) {
    event.currentTarget.dataset.fallbackApplied = "1";
    event.currentTarget.src = GOV_SYMBOL_FALLBACK;
  }
}

type CreditHoldingCard = {
  type: string;
  typeClassName: string;
  id: string;
  title: string;
  icon?: string;
  quantityValue: string;
  quantityLabel: string;
  quantityUnit: string;
  estimatedValue: string;
  estimatedLabel: string;
  changeText: string;
  changeClassName: string;
  progressValue?: string;
  progressLabel?: string;
  progressValueClassName?: string;
  action1Label: string;
  action1Icon: string;
  action1ClassName?: string;
  action2Label: string;
  action2Icon: string;
  action2ClassName?: string;
};

type MarketItem = {
  name: string;
  nameSub: string;
  price: string;
  changeText: string;
  changeClassName: string;
  volume: string;
  liquidity: number;
};

type AnalyticsCard = {
  title: string;
  value: string;
  valueLabel: string;
  subtitle?: string;
  progressValue?: string;
  progressLabel?: string;
  progressClassName?: string;
  barValue?: string;
  barLabel?: string;
  barClassName?: string;
  items?: { label: string; value: string; valueClassName?: string }[];
  scoreValue?: string;
  scoreLabel?: string;
};

type OpportunityCard = {
  badge: string;
  badgeClassName: string;
  tagText: string;
  title: string;
  description: string;
  actionLabel: string;
  actionIcon: string;
};

type CreditPageContent = {
  skipLink: string;
  govAlt: string;
  govText: string;
  marketIndexLabel: string;
  marketIndexValue: string;
  marketIndexChange: string;
  logoTitle: string;
  logoSubtitle: string;
  navItems: string[];
  managerRole: string;
  managerName: string;
  assistantTitle: string;
  assistantSubtitle: string;
  assistantDescriptionLead: string;
  assistantDescriptionHighlight: string;
  alertSettingsLabel: string;
  opportunitiesTitle: string;
  opportunities: OpportunityCard[];
  searchPlaceholder: string;
  buyButtonLabel: string;
  holdingsTitle: string;
  holdingsSubtitle: string;
  portfolioValueLabel: string;
  portfolioValue: string;
  holdings: CreditHoldingCard[];
  marketplaceTitle: string;
  marketplaceLinkLabel: string;
  marketplaceHeaders: string[];
  marketplaceItems: MarketItem[];
  analyticsTitle: string;
  analyticsSubtitle: string;
  analyticsLastUpdate: string;
  analyticsCards: AnalyticsCard[];
  footerTitle: string;
  footerDescription: string;
  footerLinks: { title: string; links: string[] }[];
  footerCopyright: string;
  footerBadge: string;
  tableActionLabel: string;
  systemExit: string;
};

const CONTENT: Record<"ko" | "en", CreditPageContent> = {
  ko: {
    skipLink: "본문 바로가기",
    govAlt: "대한민국 정부 상징",
    govText: "공식 탄소 자산 금융 분석가 포털",
    marketIndexLabel: "실시간 시장 지수",
    marketIndexValue: "KAU23",
    marketIndexChange: "₩12,450 (▲1.2%)",
    logoTitle: "탄소 크레딧 포트폴리오",
    logoSubtitle: "Carbon Credit Asset Manager",
    navItems: ["포트폴리오", "마켓플레이스", "배출 부채 분석", "거래 내역"],
    managerRole: "Senior Analyst",
    managerName: "김금융 분석가님",
    assistantTitle: "마켓 인사이트",
    assistantSubtitle: "Intelligence Assistant",
    assistantDescriptionLead: "현재 시장 동향과 보유 포트폴리오를 분석한 결과",
    assistantDescriptionHighlight: "3개의 주요 시장 기회가 포착되었습니다.",
    alertSettingsLabel: "알림 설정 관리",
    opportunitiesTitle: "크레딧 시장 기회 및 알림",
    opportunities: [
      {
        badge: "기회",
        badgeClassName: "bg-emerald-500/20 text-emerald-400",
        tagText: "저가",
        title: "KAU23 매수 적기 포착",
        description: "최근 3개월 대비 최저가 형성 중. 상쇄 배출권 전환 시 약 15% 수익 예상",
        actionLabel: "거래소로 이동",
        actionIcon: "arrow_forward"
      },
      {
        badge: "준수",
        badgeClassName: "bg-orange-500/20 text-orange-400",
        tagText: "D-15",
        title: "2024 배출권 이월 신청",
        description: "잉여 배출권의 차기 년도 이월 신청 마감 임박. 현재 약 4,200 tCO2 대상",
        actionLabel: "신청서 작성",
        actionIcon: "edit_note"
      },
      {
        badge: "시장 뉴스",
        badgeClassName: "bg-blue-500/20 text-blue-400",
        tagText: "핫이슈",
        title: "EU CBAM 신규 규제 발표",
        description: "철강 및 화학 섹터 배출권 가격 영향 분석 보고서 업데이트 완료",
        actionLabel: "분석서 보기",
        actionIcon: "description"
      }
    ],
    searchPlaceholder: "크레딧 종류(KAU, KOC), 종목 코드, 또는 프로젝트명을 검색하세요...",
    buyButtonLabel: "매수 주문 실행",
    holdingsTitle: "내 크레딧 보유 현황 (My Credit Holdings)",
    holdingsSubtitle: "실시간 시장 가치를 반영한 보유 자산 포트폴리오입니다.",
    portfolioValueLabel: "총 포트폴리오 가치",
    portfolioValue: "₩12.4억",
    holdings: [
      {
        type: "정부 할당분",
        typeClassName: "bg-blue-100 text-blue-700 border-blue-200",
        id: "ID: KAU-23",
        title: "KAU23 (2023년 할당분)",
        quantityValue: "45,120",
        quantityLabel: "보유 수량",
        quantityUnit: "tCO2",
        estimatedValue: "₩5.62억",
        estimatedLabel: "평가 금액",
        changeText: "▲ 2.1% (매수대비)",
        changeClassName: "text-red-500",
        action1Label: "매도 주문",
        action1Icon: "sell",
        action2Label: "거래 이력",
        action2Icon: "history"
      },
      {
        type: "상쇄 배출권",
        typeClassName: "bg-emerald-100 text-emerald-700 border-emerald-200",
        id: "ID: KOC-RE",
        title: "KOC (재생에너지 상쇄)",
        quantityValue: "12,890",
        quantityLabel: "보유 수량",
        quantityUnit: "tCO2",
        estimatedValue: "₩1.74억",
        estimatedLabel: "평가 금액",
        changeText: "▼ 0.5% (매수대비)",
        changeClassName: "text-blue-500",
        action1Label: "배출권 전환",
        action1Icon: "swap_horiz",
        action1ClassName: "bg-emerald-600 text-white",
        action2Label: "프로젝트 상세",
        action2Icon: "info"
      },
      {
        type: "배출 부채",
        typeClassName: "bg-orange-100 text-orange-700 border-orange-200",
        id: "목표: 2024 최종",
        title: "2024 배출 부채 (Liability)",
        quantityValue: "58,000",
        quantityLabel: "총 배출 예측량",
        quantityUnit: "tCO2",
        estimatedValue: "tCO2 0 (충족)",
        estimatedLabel: "부족분",
        changeText: "커버율 102%",
        changeClassName: "text-emerald-600",
        progressValue: "100%",
        progressLabel: "보유 크레딧 대비 충족률",
        progressValueClassName: "text-emerald-600",
        action1Label: "배출 데이터 시뮬레이션",
        action1Icon: "analytics",
        action2Label: "",
        action2Icon: ""
      }
    ],
    marketplaceTitle: "크레딧 마켓플레이스 현황 (Marketplace)",
    marketplaceLinkLabel: "전체 목록 보기",
    marketplaceHeaders: ["종목명", "현재가", "전일대비", "거래량 (24h)", "유동성", "액션"],
    marketplaceItems: [
      { name: "KAU23", nameSub: "2023 한국 할당 단위", price: "₩12,450", changeText: "▲ 1.2%", changeClassName: "text-red-500", volume: "452,100 tCO2", liquidity: 3 },
      { name: "KAU24", nameSub: "2024 한국 할당 단위", price: "₩14,200", changeText: "▼ 0.8%", changeClassName: "text-blue-500", volume: "128,400 tCO2", liquidity: 2 },
      { name: "KOC (풍력)", nameSub: "상쇄 크레딧 - 재생에너지", price: "₩11,100", changeText: "- 0.0%", changeClassName: "text-gray-400", volume: "85,200 tCO2", liquidity: 1 }
    ],
    analyticsTitle: "포트폴리오 성과 및 배출 분석",
    analyticsSubtitle: "배출 실적과 크레딧 자산의 상관 관계 분석입니다.",
    analyticsLastUpdate: "기준 일시: 2025.08.14 15:45",
    analyticsCards: [
      {
        title: "배출 자산 대비 부채 현황 (LTV)",
        value: "₩12.4억",
        valueLabel: "Total Assets",
        progressValue: "102.4%",
        progressLabel: "배출 부채 커버리지",
        progressClassName: "text-emerald-600",
        barValue: "100%",
        barLabel: "",
        barClassName: "bg-emerald-500",
        subtitle: "※ 현재 자산으로 2024년 정산 의무를 모두 이행하고 약 2.4%의 잉여분이 남을 것으로 예상됩니다."
      },
      {
        title: "크레딧 유형별 비중",
        value: "",
        valueLabel: "",
        items: [
          { label: "KAU23", value: "78%", valueClassName: "bg-blue-600" },
          { label: "KOC", value: "15%", valueClassName: "bg-emerald-500" },
          { label: "기타/현금", value: "7%", valueClassName: "bg-indigo-400" }
        ]
      },
      {
        title: "규제 준수 및 검증 스코어",
        value: "94%",
        valueLabel: "종합 점수",
        items: [
          { label: "배출량 검증", value: "완료", valueClassName: "" },
          { label: "이월 신청", value: "진행중", valueClassName: "text-orange-500" }
        ],
        scoreValue: "자산 건전성 우수",
        scoreLabel: "상태"
      }
    ],
    footerTitle: "탄소자산관리센터",
    footerDescription: "(04551) 서울특별시 중구 세종대로 110 | 금융지원팀: 02-1234-5678\n본 플랫폼은 기업의 탄소 배출권 자산 가치 극대화와 규제 대응을 지원합니다.",
    footerLinks: [{ title: "", links: ["개인정보처리방침", "이용약관", "마켓 리포트 구독"] }],
    footerCopyright: "© 2025 탄소 크레딧 자산 관리 시스템. 분석가 대시보드.",
    footerBadge: "Financial Analyst Mode (AI Integrated)",
    tableActionLabel: "매수",
    systemExit: "로그아웃"
  },
  en: {
    skipLink: "Skip to Main Content",
    govAlt: "Government Symbol",
    govText: "Official Government Service | Carbon Asset Financial Analyst Portal",
    marketIndexLabel: "Real-time Market Index",
    marketIndexValue: "KAU23",
    marketIndexChange: "₩12,450 (▲1.2%)",
    logoTitle: "Carbon Credit Portfolio",
    logoSubtitle: "Carbon Credit Asset Manager",
    navItems: ["Portfolio", "Marketplace", "Emission Analysis", "Trade History"],
    managerRole: "Senior Analyst",
    managerName: "John Doe, CFA",
    assistantTitle: "Market Insights",
    assistantSubtitle: "Intelligence Assistant",
    assistantDescriptionLead: "Analysis of current trends and your portfolio reveals",
    assistantDescriptionHighlight: "3 key market opportunities detected.",
    alertSettingsLabel: "Manage Alert Settings",
    opportunitiesTitle: "Credit Market Opportunities & Reminders",
    opportunities: [
      {
        badge: "OPPORTUNITY",
        badgeClassName: "bg-emerald-500/20 text-emerald-400",
        tagText: "LOW PRICE",
        title: "Buy Opportunity: KAU23",
        description: "Current price is at a 3-month low. Transitioning to offset credits could yield ~15% profit.",
        actionLabel: "Go to Exchange",
        actionIcon: "arrow_forward"
      },
      {
        badge: "COMPLIANCE",
        badgeClassName: "bg-orange-500/20 text-orange-400",
        tagText: "D-15",
        title: "2024 Allowance Carryover",
        description: "Deadline for surplus allowance carryover application is near. ~4,200 tCO2 eligible.",
        actionLabel: "Complete Application",
        actionIcon: "edit_note"
      },
      {
        badge: "MARKET NEWS",
        badgeClassName: "bg-blue-500/20 text-blue-400",
        tagText: "HOT",
        title: "New EU CBAM Regulation",
        description: "Impact analysis report for Steel & Chemical sector carbon pricing now updated.",
        actionLabel: "View Analysis",
        actionIcon: "description"
      }
    ],
    searchPlaceholder: "Search for credit types (KAU, KOC), tickers, or project names...",
    buyButtonLabel: "Execute Buy Order",
    holdingsTitle: "My Credit Holdings",
    holdingsSubtitle: "Portfolio assets reflecting real-time market valuations.",
    portfolioValueLabel: "Total Portfolio Value",
    portfolioValue: "₩1.24B",
    holdings: [
      {
        type: "Gov. Allocation",
        typeClassName: "bg-blue-100 text-blue-700 border-blue-200",
        id: "ID: KAU-23",
        title: "KAU23 (2023 Allocation)",
        quantityValue: "45,120",
        quantityLabel: "Quantity Held",
        quantityUnit: "tCO2",
        estimatedValue: "₩562M",
        estimatedLabel: "Estimated Value",
        changeText: "▲ 2.1% (vs. Entry)",
        changeClassName: "text-red-500",
        action1Label: "Sell Order",
        action1Icon: "sell",
        action2Label: "History",
        action2Icon: "history"
      },
      {
        type: "Offset Credit",
        typeClassName: "bg-emerald-100 text-emerald-700 border-emerald-200",
        id: "ID: KOC-RE",
        title: "KOC (Renewable Offset)",
        quantityValue: "12,890",
        quantityLabel: "Quantity Held",
        quantityUnit: "tCO2",
        estimatedValue: "₩174M",
        estimatedLabel: "Estimated Value",
        changeText: "▼ 0.5% (vs. Entry)",
        changeClassName: "text-blue-500",
        action1Label: "Convert",
        action1Icon: "swap_horiz",
        action1ClassName: "bg-emerald-600 text-white",
        action2Label: "Project Details",
        action2Icon: "info"
      },
      {
        type: "Liability",
        typeClassName: "bg-orange-100 text-orange-700 border-orange-200",
        id: "Target: 2024 Final",
        title: "2024 Emission Liability",
        quantityValue: "58,000",
        quantityLabel: "Forecasted Total",
        quantityUnit: "tCO2",
        estimatedValue: "0 tCO2 (Covered)",
        estimatedLabel: "Shortfall",
        changeText: "Coverage Ratio 102%",
        changeClassName: "text-emerald-600",
        progressValue: "100%",
        progressLabel: "Coverage Ratio",
        progressValueClassName: "text-emerald-600",
        action1Label: "Emission Simulation",
        action1Icon: "analytics",
        action2Label: "",
        action2Icon: ""
      }
    ],
    marketplaceTitle: "Credit Marketplace Overview",
    marketplaceLinkLabel: "View All Listings",
    marketplaceHeaders: ["Asset Name", "Last Price", "Change (24h)", "Volume (24h)", "Liquidity", "Action"],
    marketplaceItems: [
      { name: "KAU23", nameSub: "2023 Korea Allowance Unit", price: "₩12,450", changeText: "▲ 1.2%", changeClassName: "text-red-500", volume: "452,100 tCO2", liquidity: 3 },
      { name: "KAU24", nameSub: "2024 Korea Allowance Unit", price: "₩14,200", changeText: "▼ 0.8%", changeClassName: "text-blue-500", volume: "128,400 tCO2", liquidity: 2 },
      { name: "KOC (Wind Power)", nameSub: "Offset Credit - Renewable", price: "₩11,100", changeText: "- 0.0%", changeClassName: "text-gray-400", volume: "85,200 tCO2", liquidity: 1 }
    ],
    analyticsTitle: "Portfolio Performance & Analytics",
    analyticsSubtitle: "Correlation analysis between emission performance and credit assets.",
    analyticsLastUpdate: "Last Updated: 2025.08.14 15:45",
    analyticsCards: [
      {
        title: "Asset vs. Liability Coverage (LTV)",
        value: "₩1.24B",
        valueLabel: "Total Assets",
        progressValue: "102.4%",
        progressLabel: "Compliance Coverage",
        progressClassName: "text-emerald-600",
        barValue: "100%",
        barLabel: "",
        barClassName: "bg-emerald-500",
        subtitle: "※ Current assets are projected to cover all 2024 settlement obligations with a 2.4% surplus."
      },
      {
        title: "Credit Type Allocation",
        value: "",
        valueLabel: "",
        items: [
          { label: "KAU23", value: "78%", valueClassName: "bg-blue-600" },
          { label: "KOC", value: "15%", valueClassName: "bg-emerald-500" },
          { label: "Misc/Cash", value: "7%", valueClassName: "bg-indigo-400" }
        ]
      },
      {
        title: "Compliance & Verification Score",
        value: "94%",
        valueLabel: "Overall Score",
        items: [
          { label: "Verification", value: "Complete", valueClassName: "" },
          { label: "Carryover App", value: "In Progress", valueClassName: "text-orange-500" }
        ],
        scoreValue: "Excellent Health",
        scoreLabel: "Status"
      }
    ],
    footerTitle: "Carbon Asset Management Center",
    footerDescription: "110 Sejong-daero, Jung-gu, Seoul (04551) | Financial Support: 02-1234-5678\nThis platform supports maximizing carbon credit asset value and regulatory compliance for corporations.",
    footerLinks: [
      { title: "Information", links: ["Privacy Policy", "Terms of Service", "Subscribe to Market Reports"] },
      { title: "Quick Links", links: ["Official Portal", "Online Services", "Customer Support"] }
    ],
    footerCopyright: "© 2025 Carbon Credit Asset Management System. Analyst Dashboard.",
    footerBadge: "Financial Analyst Mode (AI Integrated)",
    tableActionLabel: "Buy",
    systemExit: "Logout"
  }
};

function CreditCard({ card }: { card: CreditHoldingCard }) {
  const hasSecondaryAction = Boolean(card.action2Label);
  return (
    <div className={`gov-card border-t-4 shadow-md ${card.typeClassName.includes("blue") ? "border-t-[var(--kr-gov-blue)]" : card.typeClassName.includes("emerald") ? "border-t-emerald-500" : "border-t-orange-500"}`}>
      <div className={`p-6 border-b border-gray-100 flex justify-between items-start ${card.typeClassName.includes("blue") ? "bg-blue-50/20" : card.typeClassName.includes("emerald") ? "bg-emerald-50/20" : "bg-orange-50/20"}`}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`status-badge ${card.typeClassName}`}>{card.type}</span>
            <span className="text-[10px] font-bold text-gray-400">{card.id}</span>
          </div>
          <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{card.title}</h3>
        </div>
        {card.icon && <span className="material-symbols-outlined text-orange-500">{card.icon}</span>}
      </div>
      <div className="p-6 space-y-8 flex-1">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-gray-500 font-bold mb-1">{card.quantityLabel}</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black tracking-tighter ${card.typeClassName.includes("blue") ? "text-[var(--kr-gov-blue)]" : card.typeClassName.includes("emerald") ? "text-emerald-600" : "text-orange-600"}`}>{card.quantityValue}</span>
              <span className="text-sm font-bold text-gray-400 uppercase">{card.quantityUnit}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-bold">{card.estimatedLabel}</p>
            <p className="text-lg font-black text-gray-800">{card.estimatedValue}</p>
            <p className={`text-[11px] font-bold ${card.changeClassName}`}>{card.changeText}</p>
          </div>
        </div>
        {card.progressValue ? (
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-bold">
              <span>{card.progressLabel}</span>
              <span className={card.progressValueClassName}>{card.progressValue}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: card.progressValue }}></div>
            </div>
            <p className="text-[10px] text-gray-400">※ Current holdings are sufficient for this year's compliance obligations.</p>
          </div>
        ) : (
          <div className="h-16 w-full">
            <svg className="w-full h-full" viewBox="0 0 100 30">
              <path
                d={card.typeClassName.includes("blue") ? "M0 25 L20 22 L40 24 L60 15 L80 18 L100 5" : "M0 10 L20 15 L40 12 L60 20 L80 18 L100 22"}
                fill="none"
                stroke={card.typeClassName.includes("blue") ? "#3b82f6" : "#10b981"}
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        )}
        <div className={`grid gap-3 ${hasSecondaryAction ? "grid-cols-2" : "grid-cols-1"}`}>
          <button className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all ${card.action1ClassName || "bg-gray-50 hover:bg-blue-600 group"}`}>
            <span className={`material-symbols-outlined mb-1 ${card.action1ClassName ? "text-white" : "text-gray-400 group-hover:text-white"}`}>{card.action1Icon}</span>
            <span className={`text-[12px] font-bold ${card.action1ClassName ? "text-white" : "text-gray-600 group-hover:text-white"}`}>{card.action1Label}</span>
          </button>
          {card.action2Label ? (
            <button className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-blue-600 group transition-all">
              <span className="material-symbols-outlined text-gray-400 group-hover:text-white mb-1">{card.action2Icon}</span>
              <span className="text-[12px] font-bold text-gray-600 group-hover:text-white">{card.action2Label}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AllocationBar({ items }: { items: { label: string; value: string; valueClassName?: string }[] }) {
  const percentages = items.map((item) => parseInt(item.value.replace("%", "")));
  const maxPercent = Math.max(...percentages);
  const heights = percentages.map((p) => (p / maxPercent) * 100);

  return (
    <div className="flex gap-4 h-32 items-end pt-6">
      {items.map((item, index) => (
        <div key={item.label} className="flex-1 flex flex-col items-center relative">
          <div className={`${item.valueClassName} rounded-t-lg relative w-full transition-all duration-300`} style={{ height: `${heights[index]}%` }}>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-black">{item.value}</div>
          </div>
          <div className="mt-3 text-[10px] font-bold text-gray-400 whitespace-nowrap">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function ScoreGauge({ score }: { score: string }) {
  const scoreNum = parseInt(score.replace("%", ""));
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (scoreNum / 100) * circumference;

  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90">
        <circle className="text-white" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
        <circle className="text-emerald-500" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black">{score}</span>
      </div>
    </div>
  );
}

export function Co2CreditMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
    }
  );

  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
      void session.reload();
    }

    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [payloadState, session]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };

  useEffect(() => {
    logGovernanceScope("PAGE", "co2-credit", {
      language: en ? "en" : "ko",
      isLoggedIn: Boolean(payload.isLoggedIn),
      menuCode: "H0030301",
      routePath: en ? "/en/co2/credits" : "/co2/credits"
    });
  }, [en, payload.isLoggedIn]);

  return (
    <>
      <style>{`
        :root {
          --kr-gov-blue: #00378b;
          --kr-gov-blue-hover: #002d72;
          --kr-gov-text-primary: #1a1a1a;
          --kr-gov-text-secondary: #4d4d4d;
          --kr-gov-border-light: #d9d9d9;
          --kr-gov-focus: #005fde;
          --kr-gov-bg-gray: #f2f2f2;
          --kr-gov-radius: 5px;
          --market-up: #ef4444;
          --market-down: #3b82f6;
          --credit-accent: #10b981;
          --portfolio-dark: #0f172a;
        }
        body { font-family: 'Public Sans', 'Noto Sans', sans-serif; -webkit-font-smoothing: antialiased; }
        .skip-link {
          position: absolute;
          top: -100px;
          left: 0;
          background: var(--kr-gov-blue);
          color: white;
          padding: 12px;
          z-index: 100;
          transition: all 0.3s;
        }
        .skip-link:focus {
          top: 0;
          outline: none;
          ring: 2px solid white;
        }
        .material-symbols-outlined {
          font-variation-settings: 'wght' 400, 'opsz' 24;
          font-size: 24px;
        }
        .gov-btn {
          padding: 10px 20px;
          font-weight: 700;
          border-radius: var(--kr-gov-radius);
          transition: colors 0.2s;
          outline: none;
        }
        .gov-card {
          border: 1px solid var(--kr-gov-border-light);
          border-radius: var(--kr-gov-radius);
          background: white;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .gov-card:hover {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .status-badge {
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid;
        }
        .trading-row:hover {
          background: #f8fafc;
        }
      `}</style>
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)] min-h-screen">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>
        
        {/* Top Bar */}
        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={content.govAlt} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">{content.govText}</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              <p>{content.marketIndexLabel}: {content.marketIndexValue} <span className="text-red-500">{content.marketIndexChange}</span></p>
            </div>
          </div>
        </div>

        {/* Header */}
        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-3 shrink-0">
                <a className="flex items-center gap-2" href={buildLocalizedPath("/home", "/en/home")}>
                  <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>account_balance_wallet</span>
                  <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tight text-[var(--kr-gov-text-primary)] leading-tight">{content.logoTitle}</h1>
                    <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">{content.logoSubtitle}</p>
                  </div>
                </a>
              </div>
              <nav className="hidden xl:flex items-center space-x-1 h-full ml-12 flex-1">
                {content.navItems.map((item, index) => (
                  <a
                    className={`h-full flex items-center px-4 text-[16px] font-bold border-b-4 transition-all ${index === 0 ? "text-[var(--kr-gov-blue)] border-[var(--kr-gov-blue)]" : "text-gray-500 hover:text-[var(--kr-gov-blue)] border-transparent"}`}
                    href="#"
                    key={item}
                    onClick={(event) => event.preventDefault()}
                  >
                    {item}
                  </a>
                ))}
              </nav>
              <div className="flex items-center gap-4 shrink-0">
                <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{content.managerRole}</span>
                  <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{content.managerName}</span>
                </div>
                <button className="relative w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors border border-blue-100" type="button">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">monitoring</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[8px] text-white flex items-center justify-center font-bold">3</span>
                </button>
                <button
                  className="gov-btn bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] text-sm"
                  onClick={() => {
                    if (payload.isLoggedIn) {
                      void session.logout();
                      return;
                    }
                    navigate(buildLocalizedPath("/signin/loginView", "/en/signin/loginView"));
                  }}
                  type="button"
                >
                  {content.systemExit}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content">
          {/* Hero Section */}
          <section className="bg-[var(--portfolio-dark)] py-10 relative overflow-hidden border-b border-slate-800" data-help-id="co2-credit-hero">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg height="100%" width="100%">
                <pattern height="60" id="dots" patternUnits="userSpaceOnUse" width="60">
                  <circle cx="2" cy="2" fill="white" r="1" />
                </pattern>
                <rect fill="url(#dots)" height="100%" width="100%" />
              </svg>
            </div>
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
              <div className="flex flex-col xl:flex-row gap-8 items-start">
                <div className="xl:w-1/4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <span className="material-symbols-outlined text-white text-[28px]">insights</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">{content.assistantTitle}</h2>
                      <p className="text-emerald-400 text-xs font-bold flex items-center gap-1 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> {content.assistantSubtitle}
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {content.assistantDescriptionLead} <br className="hidden xl:block" />
                    <strong className="text-white">{content.assistantDescriptionHighlight}</strong>
                  </p>
                  <button className="w-full py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white text-sm font-bold transition-all flex items-center justify-center gap-2" type="button">
                    <span className="material-symbols-outlined text-sm">notifications</span> {content.alertSettingsLabel}
                  </button>
                </div>
                <div className="xl:w-3/4 w-full">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">campaign</span> {content.opportunitiesTitle}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {content.opportunities.map((item, index) => (
                      <div key={index} className="bg-white/5 border-l-4 border-l-emerald-500 border border-white/10 p-5 rounded-r-lg group hover:bg-white/10 transition-all cursor-pointer">
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.badgeClassName}`}>{item.badge}</span>
                          <span className="text-[10px] font-bold text-slate-500 tracking-tighter">{item.tagText}</span>
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">{item.title}</h4>
                        <p className="text-slate-400 text-[11px] mb-4">{item.description}</p>
                        <a className="inline-flex items-center text-[11px] font-bold text-emerald-400 hover:text-emerald-300 gap-1 mt-auto" href="#" onClick={(event) => event.preventDefault()}>
                          {item.actionLabel} <span className="material-symbols-outlined text-[14px]">{item.actionIcon}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Search Section */}
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 -mt-8 relative z-20">
            <div className="bg-white shadow-2xl rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center border border-gray-100">
              <div className="relative flex-1 w-full">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">search</span>
                <input
                  className="w-full pl-12 pr-4 h-14 border-none bg-gray-50 rounded-lg focus:ring-2 focus:ring-[var(--kr-gov-blue)] text-sm"
                  placeholder={content.searchPlaceholder}
                  type="text"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button className="flex-1 md:flex-none px-6 h-14 bg-[var(--kr-gov-blue)] text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-[var(--kr-gov-blue-hover)] transition-colors" type="button">
                  <span className="material-symbols-outlined text-[20px]">shopping_cart</span> {content.buyButtonLabel}
                </button>
              </div>
            </div>
          </section>

          {/* Holdings Section */}
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12" data-help-id="co2-credit-portfolio">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
                  {content.holdingsTitle}
                </h2>
                <p className="text-[var(--kr-gov-text-secondary)] text-sm">{content.holdingsSubtitle}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden md:flex bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px]">currency_exchange</span>
                  <span className="text-[11px] font-bold text-emerald-700 leading-none">{content.portfolioValueLabel}: {content.portfolioValue}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
              {content.holdings.map((card, index) => (
                <CreditCard card={card} key={index} />
              ))}
            </div>

            {/* Marketplace Section */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-700">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">storefront</span>
                {content.marketplaceTitle}
              </h2>
              <a className="text-xs font-bold text-[var(--kr-gov-blue)] flex items-center gap-1 hover:underline" href="#">
                {content.marketplaceLinkLabel} <span className="material-symbols-outlined text-sm">arrow_outward</span>
              </a>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-16">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {content.marketplaceHeaders.map((header) => (
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase" key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {content.marketplaceItems.map((item, index) => (
                    <tr className="trading-row transition-colors" key={index}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-800 tracking-tight">{item.name}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">{item.nameSub}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-sm text-gray-800">{item.price}</td>
                      <td className={`px-6 py-4 text-sm font-bold ${item.changeClassName}`}>{item.changeText}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.volume}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <span key={i} className={`w-1.5 h-3 rounded-sm ${i <= item.liquidity ? "bg-emerald-500" : "bg-gray-200"}`} />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button className="px-4 py-1.5 bg-blue-50 text-[var(--kr-gov-blue)] text-xs font-bold rounded hover:bg-blue-600 hover:text-white transition-colors" type="button">{content.tableActionLabel}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Analytics Section */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4" data-help-id="co2-credit-actions">
              <div>
                <h2 className="text-2xl font-black mb-1">{content.analyticsTitle}</h2>
                <p className="text-[var(--kr-gov-text-secondary)] text-sm">{content.analyticsSubtitle}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
                <span className="material-symbols-outlined text-[16px]">update</span> {content.analyticsLastUpdate}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* LTV Card */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h4 className="font-bold text-sm text-gray-600 mb-6">{content.analyticsCards[0].title}</h4>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-4xl font-black text-[var(--kr-gov-blue)] tracking-tight">{content.analyticsCards[0].value}</span>
                  <span className="text-sm font-bold text-gray-400">{content.analyticsCards[0].valueLabel}</span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-[12px] font-bold">
                    <span>{content.analyticsCards[0].progressLabel}</span>
                    <span className={content.analyticsCards[0].progressClassName}>{content.analyticsCards[0].progressValue}</span>
                  </div>
                  <div className="h-3 bg-white rounded-full overflow-hidden border border-gray-200">
                    <div className="h-full bg-emerald-500" style={{ width: content.analyticsCards[0].barValue }}></div>
                  </div>
                  <p className="text-[11px] text-gray-500 font-medium">{content.analyticsCards[0].subtitle}</p>
                </div>
              </div>

              {/* Allocation Card */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h4 className="font-bold text-sm text-gray-600 mb-6">{content.analyticsCards[1].title}</h4>
                <AllocationBar items={content.analyticsCards[1].items || []} />
              </div>

              {/* Score Card */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col justify-between">
                <h4 className="font-bold text-sm text-gray-600 mb-4">{content.analyticsCards[2].title}</h4>
                <div className="flex items-center gap-6">
                  <ScoreGauge score={content.analyticsCards[2].value} />
                  <div className="flex-1 space-y-2">
                    {content.analyticsCards[2].items?.map((item, index) => (
                      <div className="flex justify-between text-xs" key={index}>
                        <span className="text-gray-500">{item.label}</span>
                        <span className={`font-bold ${item.valueClassName || ""}`}>{item.value}</span>
                      </div>
                    ))}
                    <div className="mt-4 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded text-[11px] font-black flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span> {content.analyticsCards[2].scoreValue}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-12 pb-8">
            <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img alt={content.govAlt} className="h-8 grayscale opacity-50" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
                  <span className="text-xl font-black text-gray-800 tracking-tight">{content.footerTitle}</span>
                </div>
                <address className="not-italic text-sm text-gray-500 leading-relaxed whitespace-pre-line">{content.footerDescription}</address>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
                {content.footerLinks.flatMap((section) => section.links).map((link, index) => (
                  <a
                    className={index === 0 ? "text-[var(--kr-gov-blue)] hover:underline" : "text-gray-600 hover:underline"}
                    href="#"
                    key={link}
                    onClick={(e) => e.preventDefault()}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
            <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-xs font-medium text-gray-400">{content.footerCopyright}</p>
              <div className="flex items-center gap-4">
                <div className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">{content.footerBadge}</div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
