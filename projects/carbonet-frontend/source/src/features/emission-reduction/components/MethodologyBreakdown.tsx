import { MethodologyItem } from "../types/emissionReduction";

type Props = {
  methodologies: MethodologyItem[];
  totalReduction: number;
};

export function MethodologyBreakdown({ methodologies, totalReduction }: Props) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-gray-800">
        <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">pie_chart</span>
        감축 방법론 기여도 / Methodology Contribution
      </h3>
      <div className="space-y-4">
        {methodologies.map((method: MethodologyItem) => {
          const percent = ((method.contribution / totalReduction) * 100).toFixed(1);
          return (
            <div key={method.id} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${method.color}20` }}>
                <span className="material-symbols-outlined" style={{ color: method.color }}>{method.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-800">{method.name}</span>
                  <span className="text-sm font-bold text-gray-600">{method.contribution} tCO₂e</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, backgroundColor: method.color }}
                  />
                </div>
              </div>
              <span className="text-xs text-gray-400 w-12 text-right">{percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
