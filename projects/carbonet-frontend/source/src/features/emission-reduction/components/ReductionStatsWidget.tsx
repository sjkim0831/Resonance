
export type ReductionStatsProps = {
  totalReduction: string;
  targetReduction: string;
  achievedPercent: number;
  activeScenarios: number;
};

export function ReductionStatsWidget({ totalReduction, targetReduction, achievedPercent, activeScenarios }: ReductionStatsProps) {
  const statusColor = achievedPercent >= 80 ? "text-green-600" : achievedPercent >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="metric-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">trending_down</span>
          <span className="text-xs font-medium text-gray-500">총 감축량</span>
        </div>
        <div className="text-2xl font-black text-gray-900">{totalReduction}</div>
        <div className="text-xs text-gray-400 mt-1">tCO₂e</div>
      </div>
      <div className="metric-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-purple-600">track_changes</span>
          <span className="text-xs font-medium text-gray-500">목표 감축량</span>
        </div>
        <div className="text-2xl font-black text-gray-900">{targetReduction}</div>
        <div className="text-xs text-gray-400 mt-1">tCO₂e</div>
      </div>
      <div className="metric-card">
        <div className="flex items-center gap-2 mb-2">
          <span className={`material-symbols-outlined ${statusColor}`}>verified</span>
          <span className="text-xs font-medium text-gray-500">달성률</span>
        </div>
        <div className={`text-2xl font-black ${statusColor}`}>{achievedPercent}%</div>
        <div className="text-xs text-gray-400 mt-1">목표 대비</div>
      </div>
      <div className="metric-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-emerald-600">play_circle</span>
          <span className="text-xs font-medium text-gray-500">활성 시나리오</span>
        </div>
        <div className="text-2xl font-black text-gray-900">{activeScenarios}</div>
        <div className="text-xs text-gray-400 mt-1">시나리오</div>
      </div>
    </div>
  );
}
