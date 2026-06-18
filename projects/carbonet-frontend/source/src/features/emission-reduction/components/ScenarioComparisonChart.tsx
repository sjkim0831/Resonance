export type ScenarioData = {
  id: string;
  name: string;
  color: string;
  reduction: number;
  cost: number;
  feasibility: string;
};

type Props = {
  scenarios: ScenarioData[];
  selectedId?: string;
  onSelect?: (id: string) => void;
};

export function ScenarioComparisonChart({ scenarios, selectedId, onSelect }: Props) {
  const maxReduction = Math.max(...scenarios.map(s => s.reduction), 1);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-gray-800">
        <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">compare</span>
        시나리오 비교 / Scenario Comparison
      </h3>
      <div className="space-y-4">
        {scenarios.map((scenario) => {
          const widthPercent = (scenario.reduction / maxReduction) * 100;
          const isSelected = selectedId === scenario.id;
          return (
            <div
              key={scenario.id}
              onClick={() => onSelect?.(scenario.id)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${isSelected ? "border-[var(--kr-gov-blue)] bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scenario.color }} />
                  <span className="font-bold text-gray-800">{scenario.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-[var(--kr-gov-blue)]">{scenario.reduction}%</span>
                  <span className="text-xs text-gray-400 ml-1">감축</span>
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${widthPercent}%`, backgroundColor: scenario.color }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>비용: {scenario.cost}만원</span>
                <span>타당성: {scenario.feasibility}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
