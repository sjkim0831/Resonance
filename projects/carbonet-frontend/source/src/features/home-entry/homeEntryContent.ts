import { HomeServiceItem, SummaryCard } from "./homeEntryTypes";

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
    logoTitle: "CCUS 통합관리 포털",
    logoSubtitle: "탄소 배출 관리 서비스",
    navAria: "주 메뉴",
    allMenu: "전체메뉴",
    openAllMenu: "전체메뉴 열기",
    closeAllMenu: "전체메뉴 닫기",
    login: "로그인",
    logout: "로그아웃",
    signup: "회원가입",
    heroBadge: "2050 탄소중립 실천",
    heroTitle: "지속가능한 미래를 위한 탄소 관리",
    heroDescription: "국가 CCUS 핵심 데이터, 정밀 시뮬레이션 및 인증 서비스를 통합적으로 제공합니다.",
    heroButton: "상세 분석 보기",
    searchPlaceholder: "자원, 배출 계수 또는 프로젝트 상태 검색...",
    searchAria: "통합 검색",
    dashboardTitle: "실시간 현황 대시보드",
    dashboardSubtitle: "2025년 8월 24일 기준 실시간 데이터 요약",
    coreServicesTitle: "핵심 서비스",
    summaryCards: [
      {
        title: "누적 CO2 포집량",
        badge: "목표 달성 중",
        value: "1,452,890",
        unit: "tCO2",
        progressLabel: "연간 목표 달성률",
        progressValue: "72.6%",
        progressWidth: "72.6%"
      },
      {
        title: "진행 중인 프로젝트",
        statBlocks: [
          { label: "상용화 단계", value: "18", unit: "건" },
          { label: "실증/파일럿", value: "27", unit: "건" }
        ],
        note: "전월 대비 +12.4%",
        progressLabel: "수도권/영남권 비율",
        progressValue: "40%/60%"
      },
      {
        title: "인증 처리 상태",
        ringText: "85%",
        rows: [
          { label: "검증 완료", value: "124건" },
          { label: "심사 진행중", value: "22건" }
        ],
        ringNote: "심사 적체 해소 중"
      }
    ] as SummaryCard[],
    services: [
      { icon: "analytics", title: "배출량 시뮬레이션", description: "AI 기반 모델로 탄소 발자국을 예측하고 최적의 격리지를 탐색합니다.", href: "/join/step1" },
      { icon: "verified_user", title: "인증 신청", description: "산업체 탄소 감축에 대한 공식 정부 검증 절차를 시작하세요.", href: "/signin/loginView" },
      { icon: "label", title: "CO2 태그 검색", description: "특정 탄소 배출권 및 검증된 격리 배치 데이터를 조회합니다.", href: "/home" },
      { icon: "database", title: "데이터 저장소", description: "전국의 기술 매뉴얼, 정책 보고서 및 실시간 센서 데이터를 제공합니다.", href: "/home" }
    ] as HomeServiceItem[],
    announcementsTitle: "공지사항",
    supportTitle: "기술 지원 센터",
    supportDescription: "배출량 보고 또는 기술 통합에 도움이 필요하신가요? 공공기관 및 기업 이해관계자를 위한 전담 지원팀이 상시 대기 중입니다.",
    supportHotline: "080-1234-5678",
    footerOrg: "CCUS 관리본부",
    footerAddress: "© 2025 CCUS 관리본부. All rights reserved. 대한민국 디지털 정부 혁신 서비스.",
    footerLinks: ["개인정보처리방침", "이용약관", "고객지원", "기관정보", "사이트맵"],
    lastModified: "최종 수정일:",
    waAlt: "웹 접근성 품질인증 마크"
  },
  en: {
    skipLink: "Skip to Main Content",
    govAlt: "Government Symbol of the Republic of Korea",
    govText: "Official Website of the Republic of Korea Government",
    govGuide: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    logoTitle: "CCUS 통합관리 포털",
    logoSubtitle: "Carbon Emission Management Service",
    navAria: "Main menu",
    allMenu: "All Menu",
    openAllMenu: "Open all menu",
    closeAllMenu: "Close all menu",
    login: "Login",
    logout: "Logout",
    signup: "Sign Up",
    heroBadge: "2050 Net-Zero Commitment",
    heroTitle: "Sustainable Future for Carbon Management",
    heroDescription: "Providing integrated national CCUS core data, precision simulation, and certification services.",
    heroButton: "View Details",
    searchPlaceholder: "Search resources, emission factors, or project status...",
    searchAria: "Integrated search",
    dashboardTitle: "Real-time Status Dashboard",
    dashboardSubtitle: "Real-time data summary as of August 24, 2025",
    coreServicesTitle: "Core Services",
    summaryCards: [
      {
        title: "Cumulative CO2 Captured",
        badge: "On Target",
        value: "1,452,890",
        unit: "tCO2",
        progressLabel: "Annual Target Achievement",
        progressValue: "72.6%",
        progressWidth: "72.6%"
      },
      {
        title: "Active Projects",
        statBlocks: [
          { label: "Commercial Stage", value: "18", unit: "cases" },
          { label: "Demo/Pilot Stage", value: "27", unit: "cases" }
        ],
        note: "+12.4% from last month",
        progressLabel: "Capital Area / Yeongnam Ratio",
        progressValue: "40% / 60%"
      },
      {
        title: "Certification Processing",
        ringText: "85%",
        rows: [
          { label: "Verified Complete", value: "124 cases" },
          { label: "Under Review", value: "22 cases" }
        ],
        ringNote: "Backlog clearing in progress"
      }
    ] as SummaryCard[],
    services: [
      { icon: "analytics", title: "Emission Simulation", description: "Predict carbon footprint and explore optimal storage sites with AI-based models.", href: "/join/en/step1" },
      { icon: "verified_user", title: "Certification Application", description: "Start the official government verification process for industrial carbon reduction.", href: "/en/signin/loginView" },
      { icon: "label", title: "CO2 Tag Search", description: "Query specific carbon emission rights and verified storage placement data.", href: "/en/home" },
      { icon: "database", title: "Data Repository", description: "Provides national technical manuals, policy reports, and real-time sensor data.", href: "/en/home" }
    ] as HomeServiceItem[],
    announcementsTitle: "Announcements",
    supportTitle: "Technical Support Center",
    supportDescription: "Need help with emission reporting or technical integration? A dedicated support team for public institutions and enterprise stakeholders is on standby.",
    supportHotline: "080-1234-5678",
    footerOrg: "CCUS Management HQ",
    footerAddress: "© 2025 CCUS Management HQ. All rights reserved. Republic of Korea Digital Government Innovation Service.",
    footerLinks: ["Privacy Policy", "Terms of Use", "Customer Support", "Organization Info", "Sitemap"],
    lastModified: "Last Modified:",
    waAlt: "Web Accessibility Quality Certification Mark"
  }
} as const;

export type LocalizedHomeContent = (typeof LOCALIZED_CONTENT)[keyof typeof LOCALIZED_CONTENT];