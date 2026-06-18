export type InvestmentItem = {
  category: string;
  amount: number;
  expectedReduction: number;
  timeline: string;
};

type Props = {
  investments: InvestmentItem[];
  totalBudget: number;
};

export function InvestmentPlan({ investments, totalBudget }: Props) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-gray-800">
        <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">account_balance</span>
        투자 계획 / Investment Plan
      </h3>
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <div className="text-sm text-gray-500">총 예산</div>
        <div className="text-2xl font-black text-[var(--kr-gov-blue)]">{totalBudget.toLocaleString()}만원</div>
      </div>
      <div className="space-y-3">
        {investments.map((inv, idx) => (
          <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-[var(--kr-gov-blue)] text-white flex items-center justify-center text-xs font-bold">
              {idx + 1}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-800">{inv.category}</div>
              <div className="text-xs text-gray-500">{inv.timeline}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-900">{inv.amount.toLocaleString()}만원</div>
              <div className="text-xs text-green-600">-{inv.expectedReduction}% 배출</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
