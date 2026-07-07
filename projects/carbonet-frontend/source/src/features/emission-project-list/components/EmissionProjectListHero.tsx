import { QueueItem } from "./EmissionProjectListTypes";
import { PriorityBadge, PulseIndicator } from "./EmissionProjectListShared";

interface HeroSectionProps {
  en: boolean;
  queueItems: QueueItem[];
  totalTasks: number;
  criticalTasks: number;
  onViewAllTasks: () => void;
  onTaskClick: (taskId: string) => void;
}

export function EmissionProjectListHero({
  en,
  queueItems,
  totalTasks,
  criticalTasks,
  onViewAllTasks,
  onTaskClick
}: HeroSectionProps) {
  return (
    <section className="hero-gradient relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 hero-pattern opacity-[0.03] pointer-events-none" />
      
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 relative z-10">
        <div className="flex flex-col xl:flex-row gap-10 items-stretch">
          {/* Left Column - AI Assistant Info */}
          <div className="xl:w-1/4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 glow-effect">
                <span className="material-symbols-outlined text-white text-[28px]">auto_awesome</span>
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">
                  {en ? "Update Assistant" : "업데이트 비서"}
                </h2>
                <p className="text-indigo-400 text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <PulseIndicator color="#818cf8" size="sm" /> {en ? "AI-Powered" : "AI 기반"}
                </p>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              {en ? (
                <>
                  AI가 배출지 데이터를 실시간 분석하여 필요한 업데이트 업무를 감지했습니다.{" "}
                  <strong className="text-white font-bold">{totalTasks}개의 우선 업무</strong>
                  가 대기 중입니다.
                </>
              ) : (
                <>
                  AI가 배출지 데이터를 실시간 분석하여 필요한 업데이트 업무를 감지했습니다.{" "}
                  <strong className="text-white font-bold">{totalTasks}개의 우선 업무</strong>
                  가 대기 중입니다.
                </>
              )}
            </p>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-black text-white">{totalTasks}</div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {en ? "Total Tasks" : "전체 업무"}
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-black text-red-400">{criticalTasks}</div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {en ? "Critical" : "긴급"}
                </div>
              </div>
            </div>

            <button
              className="w-full py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-sm font-bold transition-all flex items-center justify-center gap-2.5 backdrop-blur-sm"
              type="button"
              onClick={onViewAllTasks}
            >
              <span className="material-symbols-outlined text-[18px]">checklist</span>
              {en ? "View Full Workflow" : "전체 워크플로우 보기"}
            </button>
          </div>

          {/* Right Column - Task Queue */}
          <div className="xl:w-3/4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">priority_high</span>
                {en ? "Your Update Queue (Priority Order)" : "우선순위순 업데이트 대기열"}
              </h3>
              <div className="ai-badge">
                <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                {en ? "AI Active" : "AI 활성화"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {queueItems.map((item) => (
                <TaskCard
                  key={item.id}
                  item={item}
                  en={en}
                  onClick={() => onTaskClick(item.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface TaskCardProps {
  item: QueueItem;
  en: boolean;
  onClick: () => void;
}

function TaskCard({ item, en, onClick }: TaskCardProps) {
  const borderColor =
    item.level === "CRITICAL"
      ? "border-l-red-500"
      : item.level === "REQUIRED"
      ? "border-l-orange-500"
      : item.level === "VERIFICATION"
      ? "border-l-blue-500"
      : "border-l-emerald-500";

  return (
    <div
      className={`task-card border-l-4 ${borderColor} cursor-pointer group`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="flex justify-between items-start mb-3">
        <PriorityBadge level={item.level} />
        <span className="text-[10px] font-black text-slate-500 tracking-tight bg-black/20 px-2 py-0.5 rounded">
          {item.due}
        </span>
      </div>

      <div className="mb-2">
        <span className="text-[10px] font-mono text-slate-500 bg-black/20 px-1.5 py-0.5 rounded">
          #{item.siteId}
        </span>
      </div>

      <h4 className="text-white font-bold text-sm mb-2 leading-snug line-clamp-2">
        {en ? item.titleEn : item.title}
      </h4>

      <p className="text-slate-400 text-[11px] mb-4 leading-relaxed line-clamp-2">
        {en ? item.descriptionEn : item.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="text-[10px] text-slate-500">
          <span className="material-symbols-outlined text-[12px] mr-1">schedule</span>
          {item.estimatedTime}
        </div>
        <a
          className="inline-flex items-center text-[11px] font-bold text-indigo-400 hover:text-indigo-300 gap-1.5 group-hover:gap-2.5 transition-all"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }}
        >
          {en ? item.ctaEn : item.cta}
          <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
        </a>
      </div>
    </div>
  );
}