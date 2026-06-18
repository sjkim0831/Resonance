export type SiteReduction = {
  siteId: string;
  siteName: string;
  reduction: number;
  rank: number;
  trend: "up" | "down" | "stable";
};

type Props = {
  sites: SiteReduction[];
  metric: "reduction" | "cost" | "efficiency";
};

export function SiteReductionRanking({ sites, metric }: Props) {
  const sorted = [...sites].sort((a, b) => {
    if (metric === "reduction") return b.reduction - a.reduction;
    if (metric === "efficiency") return b.reduction - a.reduction;
    return a.rank - b.rank;
  });

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-gray-800">
        <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">leaderboard</span>
        현장별 감축량 순위 / Site Reduction Ranking
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-black text-gray-600">순위</th>
              <th className="text-left py-2 px-3 font-black text-gray-600">현장</th>
              <th className="text-right py-2 px-3 font-black text-gray-600">감축량</th>
              <th className="text-center py-2 px-3 font-black text-gray-600">추세</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((site, idx) => (
              <tr key={site.siteId} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${idx < 3 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                    {idx + 1}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="font-medium text-gray-900">{site.siteName}</div>
                  <div className="text-xs text-gray-400">{site.siteId}</div>
                </td>
                <td className="text-right py-3 px-3 font-medium text-gray-900">{site.reduction}%</td>
                <td className="text-center py-3 px-3">
                  <span className={`material-symbols-outlined text-sm ${site.trend === "up" ? "text-green-600" : site.trend === "down" ? "text-red-600" : "text-gray-400"}`}>
                    {site.trend === "up" ? "arrow_upward" : site.trend === "down" ? "arrow_downward" : "remove"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
