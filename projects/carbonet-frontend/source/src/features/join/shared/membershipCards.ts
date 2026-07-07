export type MembershipCard = {
  value: string;
  icon: string;
  iconWrapClass: string;
  iconClass: string;
  hoverIconWrapClass: string;
  title: string;
  description: string;
};

export const KO_MEMBERSHIP_CARDS: MembershipCard[] = [
  {
    value: "EMITTER",
    icon: "factory",
    iconWrapClass: "bg-blue-50",
    iconClass: "text-[var(--kr-gov-blue)]",
    hoverIconWrapClass: "group-hover:bg-[var(--kr-gov-blue)]",
    title: "CO2 배출 및 포집 기업",
    description: "이산화탄소를 배출하거나\n포집 시설을 운영하는 기업"
  },
  {
    value: "PERFORMER",
    icon: "settings_suggest",
    iconWrapClass: "bg-cyan-50",
    iconClass: "text-cyan-600",
    hoverIconWrapClass: "group-hover:bg-cyan-700",
    title: "CCUS 사업 수행 기업",
    description: "수송·저장 및 활용 등\nCCUS 사업을 수행하는 기업"
  },
  {
    value: "CENTER",
    icon: "hub",
    iconWrapClass: "bg-emerald-50",
    iconClass: "text-[#008450]",
    hoverIconWrapClass: "group-hover:bg-[#008450]",
    title: "CCUS 진흥센터",
    description: "시스템 운영 및 CCUS 기술\n진흥 업무를 담당하는 기관"
  },
  {
    value: "GOV",
    icon: "account_balance",
    iconWrapClass: "bg-slate-100",
    iconClass: "text-slate-600",
    hoverIconWrapClass: "group-hover:bg-slate-700",
    title: "주무관청 / 행정기관",
    description: "정책 수립 및 관리를 담당하는\n정부 부처 및 행정기관"
  }
];

export const EN_MEMBERSHIP_CARDS: MembershipCard[] = [
  {
    value: "EMITTER",
    icon: "factory",
    iconWrapClass: "bg-blue-50",
    iconClass: "text-[var(--kr-gov-blue)]",
    hoverIconWrapClass: "group-hover:bg-[var(--kr-gov-blue)]",
    title: "CO2 Emitter / Capture Company",
    description: "Companies that emit CO2\nor operate carbon capture facilities"
  },
  {
    value: "PERFORMER",
    icon: "settings_suggest",
    iconWrapClass: "bg-cyan-50",
    iconClass: "text-cyan-600",
    hoverIconWrapClass: "group-hover:bg-cyan-700",
    title: "CCUS Project Executor",
    description: "Companies engaged in\ntransport, storage, and utilization of CO2"
  },
  {
    value: "CENTER",
    icon: "hub",
    iconWrapClass: "bg-emerald-50",
    iconClass: "text-[#008450]",
    hoverIconWrapClass: "group-hover:bg-[#008450]",
    title: "CCUS Promotion Center",
    description: "Organizations in charge\nof system operation and CCUS technology promotion"
  },
  {
    value: "GOV",
    icon: "account_balance",
    iconWrapClass: "bg-slate-100",
    iconClass: "text-slate-600",
    hoverIconWrapClass: "group-hover:bg-slate-700",
    title: "Competent Authority / Government",
    description: "Government ministries and\nadministrative agencies responsible for policy"
  }
];
