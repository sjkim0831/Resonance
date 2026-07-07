export type RoadmapMilestone = {
  year: number;
  target: string;
  achieved: string;
  status: "completed" | "in-progress" | "pending";
};

type Props = {
  milestones: RoadmapMilestone[];
  currentYear: number;
};

const statusConfig = {
  completed: { label: "달성", color: "bg-green-500", textColor: "text-green-600" },
  "in-progress": { label: "진행중", color: "bg-blue-500", textColor: "text-blue-600" },
  pending: { label: "대기", color: "bg-gray-300", textColor: "text-gray-400" }
};

export function ReductionRoadmap({ milestones, currentYear }: Props) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-gray-800">
        <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">map</span>
        감축 로드맵 / Reduction Roadmap
      </h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-6">
          {milestones.map((milestone) => {
            const cfg = statusConfig[milestone.status];
            const isPast = milestone.year < currentYear;
            return (
              <div key={milestone.year} className="relative flex items-start gap-4 pl-10">
                <div className={`absolute left-2.5 w-3 h-3 rounded-full ${cfg.color} ${isPast ? "" : "ring-4 ring-white"}`} />
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-black text-gray-900">{milestone.year}년</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.textColor} bg-opacity-10`} style={{ backgroundColor: `${cfg.color}20` }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">목표: {milestone.target}</div>
                  {milestone.achieved && <div className="text-sm text-gray-500">달성: {milestone.achieved}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
