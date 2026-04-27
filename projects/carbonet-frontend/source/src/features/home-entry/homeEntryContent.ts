import { HomeQuickLink, HomeServiceItem, SummaryCard } from "./homeEntryTypes";

export const HOME_ENTRY_ASSETS = {
  GOV_SYMBOL:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD8BPzqtzSLVGSrjt4mzhhVBy9SocCRDssk1F3XRVu7Xq9jHh7qzzt48wFi8qduCiJmB0LRQczPB7waPe3h0gkjn3jOEDxt6UJSJjdXNf8P-4WlM2BEZrfg2SL91uSiZrFcCk9KYrsdg-biTS9dtJ_OIghDBEVoAzMc33XcCYR_UP0QQdoYzBe840YrtH40xGyB9MSr0QH4D0foqlvOhG0jX8CDayXNlDsSKlfClVd3K2aodlwg4xSxgXHB3vnnnA0L2yNBNihQQg0",
  FOOTER_SYMBOL:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBUw404pm2QFmL61j73Dpfn72GnHGEg-KXTkLQ8WVJYUJ4iekrO0IvqJK8cd0cOSNSIh9Yq1LAodkSNj7oHtVAltdnnymj25ZzOI3l167qrrWmkEoYsZGu3ztT-YGo9se-fFR3NhBG3rZ8DYfs2vna0bxSzVG8VjryTnsz40LCDS2SN3-AeqXrbaPEva2ptmrQzO8iQSwbqSGyGKddlGf7FtnhHT25Cz5a5Xhk8MTve0BF4RWxN-ULiw64ZBbrTASIHQUaURqiZXyE",
  HERO_IMAGE:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAKzEmq3B_kHRl3FWheD0HIdd3wasUtuhFVFgeRS05lgvAoyZS3TAjbi14ilZx1_L6i6qxmVk4OP8cNbisdlZRCSUAOwrKOVimb-EXOsS8PU1Sp_cB__QUog96l3-0MOv1ytGr46E0DjQVE-xJZF1mpIl3qWUAcm0bMOOwwT95WOqhuzJ6n0e5xjS85Oh5ccEJ0Qba6PTC5EnaLQDnyXFxNQr1hHjf034PZnFbSRLt8rRWDtjPZZpYhIo1_brXQ_xjIQqT4XK8kvPM",
  WA_MARK:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y"
} as const;

export const LOCALIZED_CONTENT = {
  ko: {
    skipLink: "본문 바로가기",
    govAlt: "대한민국 정부 상징",
    govText: "대한민국 정부 공식 서비스",
    govGuide: "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
    logoTitle: "CCUS 탄소발자국 플랫폼",
    logoSubtitle: "Carbon Footprint Platform",
    navAria: "주 메뉴",
    allMenu: "전체메뉴",
    openAllMenu: "전체메뉴 열기",
    closeAllMenu: "전체메뉴 닫기",
    login: "로그인",
    logout: "로그아웃",
    signup: "회원가입",
    heroBadge: "2050 탄소중립 실천",
    heroTitle: "지속 가능한 미래,\n탄소 중립의 새로운 파트너",
    heroDescription: "CCUS 기술 기반 탄소배출량 산정부터 인증까지 원스톱으로 지원합니다.",
    heroButton: "서비스 가이드 보기",
    searchTitle: "무엇을 도와드릴까요?",
    searchPlaceholder: "서비스, 정책자료, 공지사항 등 통합 검색",
    searchAria: "통합 검색",
    popularSearches: "인기 검색어",
    popularTags: [
      { label: "#배출량산정", href: "/home", query: "배출량산정" },
      { label: "#인증서발급", href: "/home", query: "인증서발급" },
      { label: "#크레딧거래", href: "/home", query: "크레딧거래" },
      { label: "#수수료안내", href: "/home", query: "수수료안내" }
    ] as HomeQuickLink[],
    coreServicesTitle: "주요 서비스",
    coreServicesDescription: "CCUS 탄소발자국 플랫폼의 핵심 기능을 바로 이용해보세요.",
    services: [
      { icon: "factory", title: "탄소배출 산정", description: "산업 공정별 이산화탄소 배출량을 시뮬레이션하고 산정합니다.", href: "/join/step1" },
      { icon: "verified_user", title: "보고서 & 인증서", description: "검증된 배출량에 대한 공식 인증서를 신청하고 발급받습니다.", href: "/signin/loginView" },
      { icon: "database", title: "탄소 정보 조회", description: "유통되는 탄소의 출처와 관련된 상세 데이터를 확인합니다.", href: "/home" },
      { icon: "storefront", title: "탄소 거래소", description: "탄소 크레딧 및 배출권을 투명하게 거래할 수 있습니다.", href: "/signin/loginView" },
      { icon: "monitoring", title: "실시간 모니터링", description: "국가 및 개별 사업장의 탄소 현황을 대시보드로 제공합니다.", href: "/home" },
      { icon: "credit_card", title: "통합 결제", description: "이용 수수료 및 거래 대금을 안전하게 결제합니다.", href: "/signin/loginView" },
      { icon: "support_agent", title: "고객 지원 센터", description: "이용 중 발생하는 문의사항을 신속하게 해결해 드립니다.", href: "/signin/findId" },
      { icon: "menu_book", title: "플랫폼 이용 가이드", description: "처음 방문자를 위한 단계별 이용 방법을 안내합니다.", href: "/join/step1" }
    ] as HomeServiceItem[],
    summaryTitle: "실시간 데이터 요약",
    summaryDescription: "국가 CCUS 활동 모니터링 주요 지표 (2025년 누적)",
    summaryUpdated: "최종 업데이트: 2025.08.14 09:00",
    summaryCards: [
      {
        title: "누적 이산화탄소 포집량",
        badge: "실시간",
        value: "1,452,890",
        unit: "tCO2",
        progressLabel: "올해 목표 (2,000,000 tCO2)",
        progressValue: "72.6%",
        progressWidth: "72.6%"
      },
      {
        title: "진행 중인 활성 프로젝트",
        statBlocks: [
          { label: "상업화 단계", value: "18", unit: "건" },
          { label: "실증 단계", value: "27", unit: "건" }
        ],
        note: "전분기 대비 15% 활성도 증가"
      },
      {
        title: "인증 서비스 현황",
        ringText: "85%",
        rows: [
          { label: "검증 완료", value: "124건" },
          { label: "심사 진행중", value: "22건" }
        ],
        ringNote: "심사 적체 해소 중"
      }
    ] as SummaryCard[],
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678 (평일 09:00~18:00)",
    footerDesc: "본 서비스는 관계 법령에 의거하여 온실가스 감축 성과를 관리합니다.",
    footerLinks: ["개인정보처리방침", "이용약관", "사이트맵", "이메일무단수집거부", "찾아오시는 길"],
    lastModified: "최종 수정일:",
    waAlt: "웹 접근성 품질인증 마크"
  },
  en: {
    skipLink: "Skip to Main Content",
    govAlt: "Government Symbol of the Republic of Korea",
    govText: "Official Website of the Republic of Korea Government",
    govGuide: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    logoTitle: "CCUS Footprint Platform",
    logoSubtitle: "Carbon Footprint Platform",
    navAria: "Main menu",
    allMenu: "All Menu",
    openAllMenu: "Open all menu",
    closeAllMenu: "Close all menu",
    login: "Login",
    logout: "Logout",
    signup: "Sign Up",
    heroBadge: "2050 Net-Zero Commitment",
    heroTitle: "Sustainable Future,\nYour Partner in Carbon Neutrality",
    heroDescription: "Providing a one-stop solution from CCUS-based carbon emission calculation to official certification.",
    heroButton: "View Service Guide",
    searchTitle: "How can we help you?",
    searchPlaceholder: "Search services, policy data, announcements, and more",
    searchAria: "Integrated search",
    popularSearches: "Popular Searches",
    popularTags: [
      { label: "#EmissionCalculation", href: "/en/home", query: "emission calculation" },
      { label: "#CertificationIssuance", href: "/en/home", query: "certification issuance" },
      { label: "#CreditTrading", href: "/en/home", query: "credit trading" },
      { label: "#FeeGuide", href: "/en/home", query: "fee guide" }
    ] as HomeQuickLink[],
    coreServicesTitle: "Core Services",
    coreServicesDescription: "Access the key features of the CCUS Carbon Footprint Platform.",
    services: [
      { icon: "factory", title: "Emission Calculation", description: "Simulate and calculate CO2 emissions for various industrial processes.", href: "/join/en/step1" },
      { icon: "verified_user", title: "Reports & Certificates", description: "Apply for and receive official certificates for verified emission levels.", href: "/en/signin/loginView" },
      { icon: "database", title: "Carbon Data Inquiry", description: "Check detailed data related to the origin and distribution of carbon.", href: "/en/home" },
      { icon: "storefront", title: "Carbon Marketplace", description: "Transparently trade carbon credits and emission allowances.", href: "/en/signin/loginView" },
      { icon: "monitoring", title: "Real-time Monitoring", description: "Dashboards displaying national and enterprise-level carbon status.", href: "/en/home" },
      { icon: "credit_card", title: "Integrated Payment", description: "Securely pay service fees and transaction amounts.", href: "/en/signin/loginView" },
      { icon: "support_agent", title: "Customer Support", description: "Quickly resolve inquiries or issues encountered during platform use.", href: "/en/signin/findId" },
      { icon: "menu_book", title: "Platform Guide", description: "Step-by-step instructions for first-time visitors.", href: "/join/en/step1" }
    ] as HomeServiceItem[],
    summaryTitle: "Real-time Data Summary",
    summaryDescription: "Key indicators for National CCUS activities (2025 Cumulative)",
    summaryUpdated: "Last updated: 2025.08.14 09:00",
    summaryCards: [
      {
        title: "Cumulative CO2 Captured",
        badge: "LIVE",
        value: "1,452,890",
        unit: "tCO2",
        progressLabel: "Annual Goal (2,000,000 tCO2)",
        progressValue: "72.6%",
        progressWidth: "72.6%"
      },
      {
        title: "Active Projects in Progress",
        statBlocks: [
          { label: "Commercial Stage", value: "18", unit: "cases" },
          { label: "Demonstration Stage", value: "27", unit: "cases" }
        ],
        note: "15% increase in activity from last quarter"
      },
      {
        title: "Certification Service Status",
        ringText: "85%",
        rows: [
          { label: "Completed", value: "124 cases" },
          { label: "Under Review", value: "22 cases" }
        ],
        ringNote: "Backlog clearing in progress"
      }
    ] as SummaryCard[],
    footerOrg: "CCUS Integrated Management HQ",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Main Phone: 02-1234-5678 (Weekdays 09:00~18:00)",
    footerDesc: "This service manages greenhouse gas reduction performance in accordance with relevant laws.",
    footerLinks: ["Privacy Policy", "Terms of Use", "Sitemap", "Rejection of Unauthorized Email Collection", "Directions"],
    lastModified: "Last Modified:",
    waAlt: "Web Accessibility Quality Certification Mark"
  }
} as const;

export type LocalizedHomeContent = (typeof LOCALIZED_CONTENT)[keyof typeof LOCALIZED_CONTENT];
