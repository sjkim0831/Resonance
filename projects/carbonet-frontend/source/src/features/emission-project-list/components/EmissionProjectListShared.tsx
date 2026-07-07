import { SiteStatus, PriorityLevel } from "./EmissionProjectListTypes";

interface StatusBadgeProps {
  status: SiteStatus;
  label: string;
  showDot?: boolean;
}

export function StatusBadge({ status, label, showDot = true }: StatusBadgeProps) {

  return (
    <span
      className={`status-badge ${status === "normal" ? "status-badge-normal" : status === "delayed" ? "status-badge-delayed" : status === "verifying" ? "status-badge-verifying" : "status-badge-pending"}`}
    >
      {showDot && (
        <span
          className={`pulse-indicator ${status === "delayed" || status === "pending" ? "pulse-dot" : ""}`}
          style={{
            backgroundColor: status === "normal" ? "#22c55e" : status === "delayed" ? "#f59e0b" : status === "verifying" ? "#3b82f6" : "#ef4444"
          }}
        />
      )}
      {label}
    </span>
  );
}

interface PriorityBadgeProps {
  level: PriorityLevel;
}

export function PriorityBadge({ level }: PriorityBadgeProps) {
  const levelClasses: Record<PriorityLevel, string> = {
    CRITICAL: "bg-red-500/20 text-red-400 border border-red-500/30",
    REQUIRED: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    VERIFICATION: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    INSIGHT: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
  };

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${levelClasses[level]}`}>
      {level}
    </span>
  );
}

interface CircularProgressProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  color?: string;
}

export function CircularProgress({ percent, size = 96, strokeWidth = 8, showLabel = true, color = "#10b981" }: CircularProgressProps) {
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
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-gray-800">{percent}%</span>
        </div>
      )}
    </div>
  );
}

interface ProgressBarProps {
  percent: number;
  color?: string;
  height?: string;
  showLabel?: boolean;
}

export function ProgressBar({ percent, color = "#00378b", height = "h-2", showLabel = false }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className={`progress-bar ${height}`}>
        <div
          className="progress-bar-fill"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{percent}%</span>
        </div>
      )}
    </div>
  );
}

interface SparklineChartProps {
  path: string;
  color: string;
  height?: number;
}

export function SparklineChart({ path, color, height = 30 }: SparklineChartProps) {
  return (
    <svg className="sparkline-svg" viewBox="0 0 100 30" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L100 30 L0 30 Z`}
        fill={`url(#gradient-${color.replace("#", "")})`}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

interface BarChartProps {
  data: Array<{ value: number; label: string; color: string; heightPercent: number }>;
  maxHeight?: number;
}

export function BarChart({ data, maxHeight = 128 }: BarChartProps) {
  return (
    <div className="flex items-end gap-3 px-2" style={{ height: maxHeight }}>
      {data.map((bar, index) => (
        <div className="flex-1 flex flex-col items-center gap-2" key={index}>
          <span className="text-[11px] font-black text-gray-600">{bar.value}</span>
          <div
            className={`w-full rounded-t-lg transition-all hover:opacity-80`}
            style={{
              height: `${bar.heightPercent}%`,
              backgroundColor: bar.color,
              maxHeight: maxHeight - 40
            }}
          />
          <span className="text-[10px] font-semibold text-gray-400 text-center leading-tight">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

interface PulseIndicatorProps {
  color?: string;
  animate?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PulseIndicator({ color = "#22c55e", animate = true, size = "md" }: PulseIndicatorProps) {
  const sizeMap = { sm: "h-2 w-2", md: "h-2.5 w-2.5", lg: "h-3 w-3" };
  const dotSize = sizeMap[size];

  return (
    <span className={`relative inline-flex ${dotSize}`}>
      {animate && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75`}
          style={{ backgroundColor: color }}
        />
      )}
      <span
        className={`relative inline-flex rounded-full h-full w-full`}
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

interface ScopeBadgeProps {
  scope: "scope1" | "scope2" | "scope3";
}

export function ScopeBadge({ scope }: ScopeBadgeProps) {
  const configs = {
    scope1: { class: "scope1-badge", label: "S1" },
    scope2: { class: "scope2-badge", label: "S2" },
    scope3: { class: "scope3-badge", label: "S3" }
  };
  const config = configs[scope];

  return <span className={`scope-badge ${config.class}`}>{config.label}</span>;
}

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">{icon}</span>
      <h3 className="text-lg font-bold text-gray-700 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  );
}