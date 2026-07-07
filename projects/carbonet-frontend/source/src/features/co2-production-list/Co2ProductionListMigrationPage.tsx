import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import type { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const WA_MARK = "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y";

type Recommendation = {
  badge: string;
  badgeClassName: string;
  confidence: string;
  title: string;
  description: string;
  action: string;
  icon: string;
};

type SummaryCard = {
  title: string;
  icon: string;
  iconClassName: string;
  value: string;
  unit: string;
  changeText: string;
  changeClassName: string;
  changeIcon: string;
  cardClassName: string;
  titleClassName?: string;
  valueClassName?: string;
  unitClassName?: string;
};

type TrendCard = {
  title: string;
  dotClassName: string;
  rangeLabel: string;
  path: string;
  fillPath?: string;
  gradientId?: string;
  gradientColor?: string;
  strokeColor: string;
  withBaseline?: boolean;
  targetLabel?: string;
  footerStatus?: string;
  footerStatusClassName?: string;
  footerStatusIcon?: string;
};

type FacilityCard = {
  icon: string;
  iconWrapClassName: string;
  iconClassName: string;
  title: string;
  status: string;
  metricLabels: [string, string, string];
  metricValues: [string, string, string];
  metricUnits: [string, string, string];
  efficiencyLabel: string;
  efficiencyValue: string;
  efficiencyValueClassName: string;
  efficiencyBarClassName: string;
  efficiencyWidth: string;
  noticeWrapClassName: string;
  noticeIcon: string;
  noticeIconClassName: string;
  noticeTitle: string;
  noticeDescription: string;
  noticeAction: string;
  noticeTitleClassName: string;
  noticeDescriptionClassName: string;
  noticeActionClassName: string;
  menuButtonLabel: string;
};

type EventRow = {
  occurredAt: string;
  target: string;
  description: string;
  impact: string;
  impactClassName: string;
  status: string;
  statusClassName: string;
};

type FooterSection = {
  title: string;
  links: string[];
  firstLinkAccent?: boolean;
};

type ProductionPageContent = {
  skipLink: string;
  govAlt: string;
  govText: string;
  statusLabel: string;
  logoTitle: string;
  logoSubtitle: string;
  navItems: string[];
  managerRole: string;
  managerName: string;
  assistantTitle: string;
  assistantSubtitle: string;
  assistantDescriptionLead: string;
  assistantDescriptionTail: string;
  recommendations: Recommendation[];
  overviewTitle: string;
  overviewDescription: string;
  rangeTabs: string[];
  summaryCards: SummaryCard[];
  trendCards: TrendCard[];
  timeLabels: string[];
  facilitiesTitle: string;
  facilitiesDownload: string;
  facilities: FacilityCard[];
  eventTitle: string;
  eventHeaders: [string, string, string, string, string];
  eventRows: EventRow[];
  footerTitle: string;
  footerDescription: string;
  footerSections: FooterSection[];
  footerCopyright: string;
  footerChip: string;
  waAlt: string;
  systemExit: string;
};

const CONTENT: Record<"ko" | "en", ProductionPageContent> = {
  ko: {
    skipLink: "본문 바로가기",
    govAlt: "대한민국 정부 상징",
    govText: "대한민국 정부 공식 서비스 | 탄소배출 및 생산 효율성 대시보드",
    statusLabel: "실시간 가동 현황: 정상",
    logoTitle: "생산·탄소 통합 관제",
    logoSubtitle: "Plant Efficiency Dashboard",
    navItems: ["전체 모니터링", "생산 & 탄소 효율", "설비 가동 최적화", "보고서 관리"],
    managerRole: "공장 관리자",
    managerName: "김생산 본부장님",
    assistantTitle: "최적화 지능형 비서",
    assistantSubtitle: "Optimization Assistant",
    assistantDescriptionLead: "AI가 현재 생산량 대비 배출 패턴을 분석했습니다.",
    assistantDescriptionTail: "생산 목표를 유지하면서 탄소를 줄일 수 있는 3가지 제안이 있습니다.",
    recommendations: [
      { badge: "효율 개선", badgeClassName: "bg-emerald-500/20 text-emerald-400", confidence: "98% 신뢰", title: "제2 소포 공정 압력 최적화", description: "압력 0.5bar 하향 조정 시 시간당 12kg CO2 감축 예상", action: "제어 설정 바로가기", icon: "tune" },
      { badge: "부하 분산", badgeClassName: "bg-amber-500/20 text-amber-400", confidence: "85% 신뢰", title: "피크 시간대 가열로 스케줄링", description: "전력 피크 시간대(14시) 가열로 순차 가동 권장", action: "스케줄러 반영", icon: "calendar_today" },
      { badge: "연료 대체", badgeClassName: "bg-blue-500/20 text-blue-400", confidence: "72% 신뢰", title: "수소 혼소 비중 5% 확대", description: "현재 공정 안정도 높음. 친환경 연료 비중 확대 가능", action: "혼소 밸브 제어", icon: "settings_input_component" }
    ],
    overviewTitle: "생산 연계 탄소 효율성 현황",
    overviewDescription: "실시간 생산량과 에너지 소비, 탄소 집약도를 통합 분석합니다.",
    rangeTabs: ["시간별", "일간", "주간"],
    summaryCards: [
      { title: "총 생산 정보", icon: "inventory_2", iconClassName: "text-blue-600", value: "12,540", unit: "UNIT", changeText: "전시간 대비 2.4% 증가", changeClassName: "text-emerald-600", changeIcon: "trending_up", cardClassName: "border-t-4 border-t-blue-600" },
      { title: "에너지 소비량", icon: "bolt", iconClassName: "text-amber-500", value: "8,922", unit: "MWh", changeText: "전시간 대비 5.1% 증가", changeClassName: "text-red-500", changeIcon: "trending_up", cardClassName: "border-t-4 border-t-amber-500" },
      { title: "탄소 배출량 (CO2)", icon: "co2", iconClassName: "text-red-500", value: "4,215", unit: "tCO2", changeText: "전시간 대비 3.8% 증가", changeClassName: "text-red-500", changeIcon: "trending_up", cardClassName: "border-t-4 border-t-red-500" },
      { title: "탄소 집약도 (단위당)", icon: "query_stats", iconClassName: "text-indigo-600", value: "0.336", unit: "tCO2/unit", changeText: "효율 1.2% 개선됨", changeClassName: "text-emerald-600", changeIcon: "trending_down", cardClassName: "border-t-4 border-t-indigo-600 bg-indigo-50/20", titleClassName: "text-indigo-700", valueClassName: "text-indigo-700", unitClassName: "text-indigo-400" }
    ],
    trendCards: [
      { title: "생산량 (Production)", dotClassName: "bg-blue-600", rangeLabel: "최근 12시간", path: "M0 35 L10 32 L20 30 L30 25 L40 28 L50 20 L60 18 L70 15 L80 12 L90 8 L100 10", fillPath: "M0 35 L10 32 L20 30 L30 25 L40 28 L50 20 L60 18 L70 15 L80 12 L90 8 L100 10 L100 40 L0 40 Z", gradientId: "blue-grad", gradientColor: "#2563eb", strokeColor: "#2563eb" },
      { title: "에너지 소비 (Energy)", dotClassName: "bg-amber-500", rangeLabel: "최근 12시간", path: "M0 30 L10 28 L20 32 L30 35 L40 30 L50 25 L60 22 L70 20 L80 18 L90 20 L100 15", fillPath: "M0 30 L10 28 L20 32 L30 35 L40 30 L50 25 L60 22 L70 20 L80 18 L90 20 L100 15 L100 40 L0 40 Z", gradientId: "amber-grad", gradientColor: "#f59e0b", strokeColor: "#f59e0b" },
      { title: "탄소 집약도 (Intensity)", dotClassName: "bg-indigo-500", rangeLabel: "최근 12시간", path: "M0 25 L10 24 L20 26 L30 28 L40 22 L50 23 L60 21 L70 19 L80 18 L90 19 L100 17", strokeColor: "#6366f1", withBaseline: true, targetLabel: "목표 기준선 (0.28)", footerStatus: "효율 개선 중", footerStatusClassName: "text-emerald-600", footerStatusIcon: "bolt" }
    ],
    timeLabels: ["08:00", "12:00", "16:00", "현재"],
    facilitiesTitle: "주요 설비 가동 효율 분석",
    facilitiesDownload: "전체 설비 데이터 다운로드",
    facilities: [
      {
        icon: "factory",
        iconWrapClassName: "bg-blue-100",
        iconClassName: "text-blue-600",
        title: "포항 제1 - 가열로 A-12",
        status: "상태: 정상 가동 중 (부하 85%)",
        metricLabels: ["시간당 생산", "전력 소모", "탄소 배출"],
        metricValues: ["1.2k", "450", "210"],
        metricUnits: ["U/h", "kW", "kg/h"],
        efficiencyLabel: "배출 효율 (Intensity)",
        efficiencyValue: "0.175 tCO2/U",
        efficiencyValueClassName: "text-indigo-600",
        efficiencyBarClassName: "bg-indigo-500",
        efficiencyWidth: "65%",
        noticeWrapClassName: "bg-indigo-50 border border-indigo-100",
        noticeIcon: "auto_awesome",
        noticeIconClassName: "text-indigo-500",
        noticeTitle: "AI 권장사항",
        noticeDescription: "냉각 팬 속도를 15% 감속하여 에너지 4% 절감 가능",
        noticeAction: "제어 파라미터 적용",
        noticeTitleClassName: "text-indigo-800",
        noticeDescriptionClassName: "text-indigo-600",
        noticeActionClassName: "text-indigo-700",
        menuButtonLabel: "설비 메뉴"
      },
      {
        icon: "cyclone",
        iconWrapClassName: "bg-emerald-100",
        iconClassName: "text-emerald-600",
        title: "울산 제3 - 고정 연소기 C-04",
        status: "상태: 최적화 대기 (부하 60%)",
        metricLabels: ["시간당 생산", "가스 소모", "탄소 배출"],
        metricValues: ["0.8k", "180", "355"],
        metricUnits: ["U/h", "m³", "kg/h"],
        efficiencyLabel: "배출 효율 (Intensity)",
        efficiencyValue: "0.443 tCO2/U (주의)",
        efficiencyValueClassName: "text-red-600",
        efficiencyBarClassName: "bg-red-500",
        efficiencyWidth: "85%",
        noticeWrapClassName: "bg-red-50 border border-red-100",
        noticeIcon: "warning",
        noticeIconClassName: "text-red-500",
        noticeTitle: "효율 경고",
        noticeDescription: "가열기 버너 노즐 불완전 연소 감지. 긴급 점검 권장",
        noticeAction: "유지보수 티켓 발행",
        noticeTitleClassName: "text-red-800",
        noticeDescriptionClassName: "text-red-600",
        noticeActionClassName: "text-red-700",
        menuButtonLabel: "설비 메뉴"
      }
    ],
    eventTitle: "현장 공정 로그 및 탄소 이벤트",
    eventHeaders: ["발생 시간", "대상 공정/설비", "이벤트 내용", "배출 영향도", "조치 상태"],
    eventRows: [
      { occurredAt: "14:22:15", target: "광양 2센터 - 터빈 B", description: "가동 부하 상향 조정 (생산 목표 달성용)", impact: "+15.2 kg CO2", impactClassName: "text-red-500", status: "시스템 자동기록", statusClassName: "bg-blue-100 text-blue-700" },
      { occurredAt: "14:05:42", target: "전체 시스템", description: "AI 비서: 제2 소포 공정 압력 최적화 제안", impact: "-24.0 kg CO2 (예상)", impactClassName: "text-emerald-600", status: "승인 대기", statusClassName: "bg-amber-100 text-amber-700" },
      { occurredAt: "13:48:10", target: "포항 1공장 - 배출구 02", description: "TMS 자동 측정값 전송 완료", impact: "88.5 kg CO2", impactClassName: "text-[var(--kr-gov-text-primary)]", status: "검증 완료", statusClassName: "bg-emerald-100 text-emerald-700" }
    ],
    footerTitle: "CCUS 통합 효율 관리 시스템",
    footerDescription: "본 시스템은 대한민국 저탄소 녹색성장 기본법에 따라 기업의 생산 활동과 탄소 배출을 실시간으로 연계하여 효율적인 탄소 경영을 지원합니다.",
    footerSections: [
      { title: "플랫폼 안내", links: ["시스템 이용 안내", "탄소 효율 산정 공식", "AI 최적화 로직 가이드"] },
      { title: "법적 고지", links: ["개인정보처리방침", "데이터 보안 정책", "TMS 전송 규약"], firstLinkAccent: true }
    ],
    footerCopyright: "© 2025 CCUS Efficiency Control Portal. All rights reserved.",
    footerChip: "AI AGENT V4.2 ACTIVE",
    waAlt: "웹 접근성 품질인증 마크",
    systemExit: "시스템 종료"
  },
  en: {
    skipLink: "Skip to content",
    govAlt: "Government Symbol",
    govText: "Official ROK Government Service | Carbon Emission & Production Efficiency Dashboard",
    statusLabel: "Operational Status: Normal",
    logoTitle: "Integrated Control",
    logoSubtitle: "Plant Efficiency Dashboard",
    navItems: ["Full Monitoring", "Production & Carbon Efficiency", "Equipment Optimization", "Report Management"],
    managerRole: "Plant Manager",
    managerName: "Kim, Sang-jin",
    assistantTitle: "Intelligent Assistant",
    assistantSubtitle: "Optimization Assistant",
    assistantDescriptionLead: "AI analyzed emission patterns relative to current production.",
    assistantDescriptionTail: "There are 3 suggestions to reduce carbon without compromising production targets.",
    recommendations: [
      { badge: "Efficiency Up", badgeClassName: "bg-emerald-500/20 text-emerald-400", confidence: "98% Confidence", title: "Secondary Bubbler Pressure Opt.", description: "Adjusting pressure by -0.5 bar saves ~12kg CO2/hr", action: "Go to Control Settings", icon: "tune" },
      { badge: "Load Balancing", badgeClassName: "bg-amber-500/20 text-amber-400", confidence: "85% Confidence", title: "Peak Hours Furnace Scheduling", description: "Recommend sequential furnace operation during peak (14:00)", action: "Apply to Scheduler", icon: "calendar_today" },
      { badge: "Fuel Switching", badgeClassName: "bg-blue-500/20 text-blue-400", confidence: "72% Confidence", title: "Increase H2 Mixing to 5%", description: "Process stability is high. Expand eco-friendly fuel ratio", action: "Control Valve Adjust", icon: "settings_input_component" }
    ],
    overviewTitle: "Production-Linked Carbon Efficiency Overview",
    overviewDescription: "Integrated analysis of real-time production, energy consumption, and carbon intensity.",
    rangeTabs: ["Hourly", "Daily", "Weekly"],
    summaryCards: [
      { title: "Total Production", icon: "inventory_2", iconClassName: "text-blue-600", value: "12,540", unit: "UNIT", changeText: "+2.4% vs prev. hour", changeClassName: "text-emerald-600", changeIcon: "trending_up", cardClassName: "border-t-4 border-t-blue-600" },
      { title: "Energy Consumption", icon: "bolt", iconClassName: "text-amber-500", value: "8,922", unit: "MWh", changeText: "+5.1% vs prev. hour", changeClassName: "text-red-500", changeIcon: "trending_up", cardClassName: "border-t-4 border-t-amber-500" },
      { title: "Carbon Emissions (CO2)", icon: "co2", iconClassName: "text-red-500", value: "4,215", unit: "tCO2", changeText: "+3.8% vs prev. hour", changeClassName: "text-red-500", changeIcon: "trending_up", cardClassName: "border-t-4 border-t-red-500" },
      { title: "Carbon Intensity (Per Unit)", icon: "query_stats", iconClassName: "text-indigo-600", value: "0.336", unit: "tCO2/unit", changeText: "Efficiency improved by 1.2%", changeClassName: "text-emerald-600", changeIcon: "trending_down", cardClassName: "border-t-4 border-t-indigo-600 bg-indigo-50/20", titleClassName: "text-indigo-700", valueClassName: "text-indigo-700", unitClassName: "text-indigo-400" }
    ],
    trendCards: [
      { title: "Production", dotClassName: "bg-blue-600", rangeLabel: "Last 12 Hours", path: "M0 35 L10 32 L20 30 L30 25 L40 28 L50 20 L60 18 L70 15 L80 12 L90 8 L100 10", fillPath: "M0 35 L10 32 L20 30 L30 25 L40 28 L50 20 L60 18 L70 15 L80 12 L90 8 L100 10 L100 40 L0 40 Z", gradientId: "blue-grad", gradientColor: "#2563eb", strokeColor: "#2563eb" },
      { title: "Energy", dotClassName: "bg-amber-500", rangeLabel: "Last 12 Hours", path: "M0 30 L10 28 L20 32 L30 35 L40 30 L50 25 L60 22 L70 20 L80 18 L90 20 L100 15", fillPath: "M0 30 L10 28 L20 32 L30 35 L40 30 L50 25 L60 22 L70 20 L80 18 L90 20 L100 15 L100 40 L0 40 Z", gradientId: "amber-grad", gradientColor: "#f59e0b", strokeColor: "#f59e0b" },
      { title: "Carbon Intensity (Intensity)", dotClassName: "bg-indigo-500", rangeLabel: "Last 12 Hours", path: "M0 25 L10 24 L20 26 L30 28 L40 22 L50 23 L60 21 L70 19 L80 18 L90 19 L100 17", strokeColor: "#6366f1", withBaseline: true, targetLabel: "Target Baseline (0.28)", footerStatus: "Improving Efficiency", footerStatusClassName: "text-emerald-600", footerStatusIcon: "bolt" }
    ],
    timeLabels: ["08:00", "12:00", "16:00", "Now"],
    facilitiesTitle: "Key Equipment Efficiency Analysis",
    facilitiesDownload: "Download All Facility Data",
    facilities: [
      {
        icon: "factory",
        iconWrapClassName: "bg-blue-100",
        iconClassName: "text-blue-600",
        title: "Pohang Plant 1 - Furnace A-12",
        status: "Status: Running normally (Load 85%)",
        metricLabels: ["Production/hr", "Power Use", "Carbon Emission"],
        metricValues: ["1.2k", "450", "210"],
        metricUnits: ["U/h", "kW", "kg/h"],
        efficiencyLabel: "Emission Intensity",
        efficiencyValue: "0.175 tCO2/U",
        efficiencyValueClassName: "text-indigo-600",
        efficiencyBarClassName: "bg-indigo-500",
        efficiencyWidth: "65%",
        noticeWrapClassName: "bg-indigo-50 border border-indigo-100",
        noticeIcon: "auto_awesome",
        noticeIconClassName: "text-indigo-500",
        noticeTitle: "AI Recommendation",
        noticeDescription: "Reduce cooling fan speed by 15% to save 4% energy",
        noticeAction: "Apply Control Parameters",
        noticeTitleClassName: "text-indigo-800",
        noticeDescriptionClassName: "text-indigo-600",
        noticeActionClassName: "text-indigo-700",
        menuButtonLabel: "Equipment Menu"
      },
      {
        icon: "cyclone",
        iconWrapClassName: "bg-emerald-100",
        iconClassName: "text-emerald-600",
        title: "Ulsan Plant 3 - Fixed Burner C-04",
        status: "Status: Awaiting optimization (Load 60%)",
        metricLabels: ["Production/hr", "Gas Usage", "Carbon Emission"],
        metricValues: ["0.8k", "180", "355"],
        metricUnits: ["U/h", "m³", "kg/h"],
        efficiencyLabel: "Emission Intensity",
        efficiencyValue: "0.443 tCO2/U (Warning)",
        efficiencyValueClassName: "text-red-600",
        efficiencyBarClassName: "bg-red-500",
        efficiencyWidth: "85%",
        noticeWrapClassName: "bg-red-50 border border-red-100",
        noticeIcon: "warning",
        noticeIconClassName: "text-red-500",
        noticeTitle: "Efficiency Warning",
        noticeDescription: "Incomplete burner nozzle combustion detected. Urgent inspection recommended",
        noticeAction: "Issue Maintenance Ticket",
        noticeTitleClassName: "text-red-800",
        noticeDescriptionClassName: "text-red-600",
        noticeActionClassName: "text-red-700",
        menuButtonLabel: "Equipment Menu"
      }
    ],
    eventTitle: "Process Logs and Carbon Events",
    eventHeaders: ["Timestamp", "Target Process/Facility", "Event", "Emission Impact", "Action Status"],
    eventRows: [
      { occurredAt: "14:22:15", target: "Gwangyang Center 2 - Turbine B", description: "Load increased to meet production target", impact: "+15.2 kg CO2", impactClassName: "text-red-500", status: "System Logged", statusClassName: "bg-blue-100 text-blue-700" },
      { occurredAt: "14:05:42", target: "Entire System", description: "AI Assistant: Secondary bubbler pressure optimization suggested", impact: "-24.0 kg CO2 (Est.)", impactClassName: "text-emerald-600", status: "Pending Approval", statusClassName: "bg-amber-100 text-amber-700" },
      { occurredAt: "13:48:10", target: "Pohang Plant 1 - Outlet 02", description: "TMS automatic measurement transmitted", impact: "88.5 kg CO2", impactClassName: "text-[var(--kr-gov-text-primary)]", status: "Verified", statusClassName: "bg-emerald-100 text-emerald-700" }
    ],
    footerTitle: "CCUS Integrated Efficiency Management System",
    footerDescription: "This system supports efficient carbon management by linking production activities and carbon emissions in real time under Korea's Low Carbon Green Growth Framework Act.",
    footerSections: [
      { title: "Platform Guide", links: ["System User Guide", "Carbon Efficiency Formula", "AI Optimization Logic"] },
      { title: "Legal Notice", links: ["Privacy Policy", "Data Security Policy", "TMS Transfer Protocol"], firstLinkAccent: true }
    ],
    footerCopyright: "© 2025 CCUS Efficiency Control Portal. All rights reserved.",
    footerChip: "AI AGENT V4.2 ACTIVE",
    waAlt: "Web Accessibility Quality Mark",
    systemExit: "Logout"
  }
};

function handleGovSymbolError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function Co2ProductionInlineStyles({ en }: { en: boolean }) {
  return (
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
      }
      body { font-family: ${en ? "'Inter', 'Public Sans', sans-serif" : "'Noto Sans KR', 'Public Sans', sans-serif"}; -webkit-font-smoothing: antialiased; }
      .skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        background: var(--kr-gov-blue);
        color: white;
        padding: 12px;
        z-index: 100;
        transition: top .2s ease;
      }
      .skip-link:focus { top: 0; }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
      }
      .gov-btn {
        padding: 0.625rem 1.25rem;
        font-weight: 700;
        border-radius: var(--kr-gov-radius);
        transition: background-color .2s ease, color .2s ease;
        outline: none;
      }
      .gov-card {
        border: 1px solid var(--kr-gov-border-light);
        border-radius: var(--kr-gov-radius);
        background: white;
        transition: all .2s ease;
        outline: none;
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .gov-card:hover { box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
      .trend-line {
        stroke-dasharray: 1000;
        stroke-dashoffset: 1000;
        animation: draw 2s forwards;
      }
      .nav-active {
        border-bottom-width: 4px;
        border-color: var(--kr-gov-blue);
        color: var(--kr-gov-blue);
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      @keyframes draw { to { stroke-dashoffset: 0; } }
      @media (max-width: 1279px) {
        .production-header-nav {
          display: none;
        }
      }
    `}</style>
  );
}

function TrendChartCard({ card, labels }: { card: TrendCard; labels: string[] }) {
  return (
    <div className="gov-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${card.dotClassName}`}></span> {card.title}
        </h3>
        <span className="text-[10px] font-bold text-gray-400">{card.rangeLabel}</span>
      </div>
      <div className="h-48 w-full relative">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
          {card.withBaseline ? <line stroke="#cbd5e1" strokeDasharray="2" strokeWidth="1" x1="0" x2="100" y1="20" y2="20"></line> : null}
          <path className="trend-line" d={card.path} fill="none" stroke={card.strokeColor} strokeWidth={card.withBaseline ? "2.5" : "2"}></path>
          {card.fillPath && card.gradientId && card.gradientColor ? (
            <>
              <path d={card.fillPath} fill={`url(#${card.gradientId})`} opacity="0.1"></path>
              <defs>
                <linearGradient id={card.gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={card.gradientColor}></stop>
                  <stop offset="100%" stopColor="#fff"></stop>
                </linearGradient>
              </defs>
            </>
          ) : null}
        </svg>
        {!card.withBaseline ? (
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="border-b border-gray-400 w-full h-0"></div>
            <div className="border-b border-gray-400 w-full h-0"></div>
            <div className="border-b border-gray-400 w-full h-0"></div>
          </div>
        ) : null}
        {card.targetLabel ? (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <span className="text-[9px] font-bold text-gray-300">{card.targetLabel}</span>
          </div>
        ) : null}
      </div>
      <div className={`mt-4 ${card.footerStatus ? "flex items-center justify-between" : "flex justify-between"} text-[10px] font-bold text-gray-400`}>
        <div className="flex justify-between w-full max-w-[180px]">
          {labels.map((label) => <span key={label}>{label}</span>)}
        </div>
        {card.footerStatus ? (
          <div className={`text-[11px] font-bold flex items-center gap-1 ${card.footerStatusClassName || ""}`}>
            <span className="material-symbols-outlined text-[14px]">{card.footerStatusIcon || "bolt"}</span> {card.footerStatus}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Co2ProductionListMigrationPage() {
  const en = isEnglish();
  const content = CONTENT[en ? "en" : "ko"];
  const session = useFrontendSession();
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [activeRangeIndex] = useState(0);
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
    logGovernanceScope("PAGE", "co2-production-list", {
      language: en ? "en" : "ko",
      isLoggedIn: Boolean(payload.isLoggedIn),
      menuCode: "H0030101",
      routePath: en ? "/en/co2/production_list" : "/co2/production_list"
    });
  }, [en, payload.isLoggedIn]);

  return (
    <>
      <Co2ProductionInlineStyles en={en} />
      <div className="bg-[#f8fafc] text-[var(--kr-gov-text-primary)] min-h-screen">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={content.govAlt} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[11px] font-medium text-gray-400">{content.govText}</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-bold text-gray-500">
              <span>{content.statusLabel}</span>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            </div>
          </div>
        </div>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-3 shrink-0">
                <a className="flex items-center gap-2 focus-visible" href={buildLocalizedPath("/home", "/en/home")}>
                  <span className="material-symbols-outlined text-[36px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 700" }}>analytics</span>
                  <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tight text-[var(--kr-gov-text-primary)] leading-tight">{content.logoTitle}</h1>
                    <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">{content.logoSubtitle}</p>
                  </div>
                </a>
              </div>
              <nav className="production-header-nav hidden xl:flex items-center space-x-1 h-full ml-12 flex-1">
                {content.navItems.map((item, index) => (
                  <a
                    className={`h-full flex items-center px-4 text-[16px] font-bold border-b-4 transition-all ${index === 1 ? "nav-active" : "text-gray-500 hover:text-[var(--kr-gov-blue)] border-transparent"}`}
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
                <button className="relative w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center hover:bg-indigo-100 transition-colors" type="button">
                  <span className="material-symbols-outlined text-indigo-600">psychology</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 border-2 border-white rounded-full text-[8px] text-white flex items-center justify-center font-bold">3</span>
                </button>
                <button
                  className="gov-btn bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] text-sm focus-visible"
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
          <section className="bg-[#0f172a] py-8 relative overflow-hidden border-b border-slate-800" data-help-id="co2-production-hero">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 relative z-10">
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                <div className="lg:w-1/3">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                      <span className="material-symbols-outlined text-white text-[28px]">tips_and_updates</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white">{content.assistantTitle}</h2>
                      <p className="text-indigo-400 text-xs font-bold tracking-widest uppercase">{content.assistantSubtitle}</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">
                    {content.assistantDescriptionLead}<br />
                    <span className="text-white font-bold">{content.assistantDescriptionTail}</span>
                  </p>
                </div>
                <div className="lg:w-2/3 w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                  {content.recommendations.map((item) => (
                    <div className="bg-white/5 border border-white/10 p-4 rounded-lg hover:bg-white/10 transition-all group cursor-pointer" key={item.title}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.badgeClassName}`}>{item.badge}</span>
                        <span className="text-white text-xs font-bold ml-auto">{item.confidence}</span>
                      </div>
                      <h4 className="text-white font-bold text-sm mb-1 leading-tight">{item.title}</h4>
                      <p className="text-slate-400 text-[11px] mb-3">{item.description}</p>
                      <a className="text-indigo-400 text-[11px] font-bold flex items-center gap-1 group-hover:underline" href="#" onClick={(event) => event.preventDefault()}>
                        {item.action} <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">dashboard</span>
                  {content.overviewTitle}
                </h2>
                <p className="text-slate-500 text-sm mt-1">{content.overviewDescription}</p>
              </div>
              <div className="flex bg-white border border-gray-200 p-1 rounded-lg">
                {content.rangeTabs.map((tab, index) => (
                  <button className={`px-4 py-2 text-xs font-bold rounded ${index === activeRangeIndex ? "bg-[var(--kr-gov-blue)] text-white" : "text-gray-500 hover:bg-gray-50"}`} key={tab} type="button">
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10" data-help-id="co2-production-summary-cards">
              {content.summaryCards.map((card) => (
                <div className={`gov-card p-6 ${card.cardClassName}`} key={card.title}>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-xs font-bold uppercase tracking-wider ${card.titleClassName || "text-gray-500"}`}>{card.title}</span>
                    <span className={`material-symbols-outlined ${card.iconClassName}`}>{card.icon}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-black ${card.valueClassName || ""}`}>{card.value}</span>
                    <span className={`text-sm font-bold ${card.unitClassName || "text-gray-400"}`}>{card.unit}</span>
                  </div>
                  <div className={`mt-4 flex items-center text-xs font-bold ${card.changeClassName}`}>
                    <span className="material-symbols-outlined text-[16px] mr-1">{card.changeIcon}</span> {card.changeText}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12" data-help-id="co2-production-trend-charts">
              {content.trendCards.map((card) => (
                <TrendChartCard card={card} key={card.title} labels={content.timeLabels} />
              ))}
            </div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-800">{content.facilitiesTitle}</h3>
              <button className="text-xs font-bold text-[var(--kr-gov-blue)] flex items-center gap-1" type="button">
                {content.facilitiesDownload} <span className="material-symbols-outlined text-[16px]">download</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8" data-help-id="co2-production-facilities">
              {content.facilities.map((facility) => (
                <div className="gov-card overflow-hidden" key={facility.title}>
                  <div className="bg-slate-50 p-4 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${facility.iconWrapClassName}`}>
                        <span className={`material-symbols-outlined ${facility.iconClassName}`}>{facility.icon}</span>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800">{facility.title}</h4>
                        <p className="text-[10px] text-gray-400 font-bold">{facility.status}</p>
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center transition-colors" type="button" aria-label={facility.menuButtonLabel}>
                      <span className="material-symbols-outlined text-gray-400">more_vert</span>
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {facility.metricLabels.map((label, index) => (
                        <div className={`text-center ${index === 1 ? "border-x border-gray-100" : ""}`} key={label}>
                          <p className="text-[10px] font-bold text-gray-400 mb-1">{label}</p>
                          <p className={`text-lg font-black ${index === 2 ? "text-red-500" : "text-slate-700"}`}>
                            {facility.metricValues[index]} <span className="text-[10px] text-gray-400">{facility.metricUnits[index]}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-600">{facility.efficiencyLabel}</span>
                        <span className={`font-black ${facility.efficiencyValueClassName}`}>{facility.efficiencyValue}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${facility.efficiencyBarClassName}`} style={{ width: facility.efficiencyWidth }}></div>
                      </div>
                      <div className={`p-3 rounded-lg flex items-start gap-2 ${facility.noticeWrapClassName}`}>
                        <span className={`material-symbols-outlined text-[18px] ${facility.noticeIconClassName}`}>{facility.noticeIcon}</span>
                        <div className="flex-1">
                          <p className={`text-[11px] font-bold ${facility.noticeTitleClassName}`}>{facility.noticeTitle}</p>
                          <p className={`text-[10px] mt-0.5 ${facility.noticeDescriptionClassName}`}>{facility.noticeDescription}</p>
                          <a className={`inline-block mt-2 text-[10px] font-black underline ${facility.noticeActionClassName}`} href="#" onClick={(event) => event.preventDefault()}>
                            {facility.noticeAction}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="bg-white border-t border-gray-200 py-12" data-help-id="co2-production-events">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
              <div className="flex items-center gap-3 mb-8">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">history</span>
                <h3 className="text-xl font-black">{content.eventTitle}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {content.eventHeaders.map((header) => (
                        <th className="py-4 font-bold text-gray-400 text-[11px] uppercase tracking-wider" key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {content.eventRows.map((row) => (
                      <tr key={`${row.occurredAt}-${row.target}`}>
                        <td className="py-4 font-medium text-gray-500">{row.occurredAt}</td>
                        <td className="py-4 font-bold">{row.target}</td>
                        <td className="py-4">{row.description}</td>
                        <td className={`py-4 font-bold ${row.impactClassName}`}>{row.impact}</td>
                        <td className="py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${row.statusClassName}`}>{row.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
        <footer className="bg-white border-t border-gray-200 mt-20">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12">
            <div className="flex flex-col md:flex-row justify-between gap-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img alt={content.govAlt} className="h-8 grayscale opacity-50" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
                  <span className="text-xl font-black text-gray-800 tracking-tight">{content.footerTitle}</span>
                </div>
                <p className="text-sm text-gray-500 max-w-md leading-relaxed">{content.footerDescription}</p>
              </div>
              <div className="flex flex-wrap gap-12">
                {content.footerSections.map((section) => (
                  <div className="space-y-4" key={section.title}>
                    <h5 className="text-sm font-black text-gray-800">{section.title}</h5>
                    <ul className="text-xs text-gray-500 space-y-2 font-bold">
                      {section.links.map((link, index) => (
                        <li key={link}>
                          <a
                            className={index === 0 && section.firstLinkAccent ? "text-[var(--kr-gov-blue)]" : "hover:text-[var(--kr-gov-blue)]"}
                            href={index === 0 && section.firstLinkAccent ? buildLocalizedPath("/sitemap", "/en/sitemap") : "#"}
                            onClick={(event) => {
                              if (!(index === 0 && section.firstLinkAccent)) {
                                event.preventDefault();
                              }
                            }}
                          >
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-xs font-medium text-gray-400">{content.footerCopyright}</p>
              <div className="flex items-center gap-4">
                <div className="text-[10px] font-black text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">{content.footerChip}</div>
                <img alt={content.waAlt} className="h-10 opacity-40" src={WA_MARK} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
