import { StatCard } from "./EmissionProjectListTypes";
import { ProgressBar } from "./EmissionProjectListShared";

interface MetricsSectionProps {
  en: boolean;
  statCards: StatCard[];
  annualAccumulation: string;
  annualTarget: string;
  achievementRate: number;
  onCardClick: (cardId: string) => void;
}

export function EmissionProjectListMetrics({
  en,
  statCards,
  annualAccumulation,
  annualTarget,
  achievementRate,
  onCardClick
}: MetricsSectionProps) {
  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 -mt-6 relative z-20">
      {/* Main Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((card) => (
          <MetricCard key={card.id} card={card} en={en} onClick={() => onCardClick(card.id)} />
        ))}
      </div>

      {/* Achievement Progress Section */}
      <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--kr-gov-blue)] text-2xl">
                trending_down
              </span>
              {en ? "Annual Emission Progress" : "연간 배출량 달성 현황"}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {en
                ? `Target: ${annualTarget} tCO₂ | Current: ${annualAccumulation} tCO₂`
                : `목표: ${annualTarget} tCO₂ | 현재: ${annualAccumulation} tCO₂`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-black text-[var(--kr-gov-blue)]">{achievementRate}%</div>
              <div className="text-xs text-gray-500">{en ? "Achievement Rate" : "달성률"}</div>
            </div>
            <div className="w-16 h-16">
              <CircularProgress percent={achievementRate} size={64} strokeWidth={6} color="#00378b" />
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm font-bold mb-2">
            <span className="text-gray-600">
              {en ? "Progress to Target" : "목표까지 진행"}
            </span>
            <span className="text-[var(--kr-gov-blue)]">{achievementRate}%</span>
          </div>
          <ProgressBar
            percent={achievementRate}
            color="url(#progressGradient)"
            height="h-4"
          />
          <svg width="0" height="0">
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00378b" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-black text-gray-900">{annualAccumulation}</div>
            <div className="text-xs text-gray-500 font-medium">{en ? "Used (tCO₂)" : "사용량 (tCO₂)"}</div>
          </div>
          <div className="text-center border-l border-r border-gray-100">
            <div className="text-2xl font-black text-gray-400">
              {(parseInt(annualTarget.replace(/,/g, "")) - parseInt(annualAccumulation.replace(/,/g, ""))).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 font-medium">{en ? "Remaining (tCO₂)" : "남은량 (tCO₂)"}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-emerald-600">-4.2%</div>
            <div className="text-xs text-gray-500 font-medium">{en ? "vs Last Year" : "전년 대비"}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface MetricCardProps {
  card: StatCard;
  en: boolean;
  onClick: () => void;
}

function MetricCard({ card, en, onClick }: MetricCardProps) {
  return (
    <div
      className={`metric-card cursor-pointer ${card.colorClass}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-semibold text-gray-500">{en ? card.titleEn : card.title}</p>
        <span className="material-symbols-outlined text-gray-400 text-xl">{card.icon}</span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-black text-gray-900 tracking-tight">{card.value}</span>
        <span className="text-sm font-bold text-gray-400">{card.unit}</span>
      </div>
      {card.trend && (
        <div
          className={`flex items-center gap-1 text-xs font-bold ${
            card.trendDirection === "up" ? "text-emerald-600" : "text-red-500"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {card.trendDirection === "up" ? "trending_up" : "trending_down"}
          </span>
          {card.trendEn || card.trend}
        </div>
      )}
    </div>
  );
}

function CircularProgress({ percent, size = 64, strokeWidth = 6, color = "#00378b" }: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="rotate-[135deg]" width={size} height={size}>
        <circle
          className="text-gray-200"
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black text-gray-700">{percent}%</span>
      </div>
    </div>
  );
}