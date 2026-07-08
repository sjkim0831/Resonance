import { useEffect, useState, useCallback } from "react";
import { fetchSystemMetrics } from "../../lib/api/monitoring";
import type { SystemMetrics } from "../../lib/api/monitoringTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

function formatBytes(bytes: number): string {
  if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(1)} TB`;
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatUptime(days: number, hours: number, mins: number): string {
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getColorForPercent(percent: number, reverse = false): string {
  const color = percent > 85 ? "red" : percent > 70 ? "yellow" : "green";
  if (reverse && percent > 85) return "green";
  return color;
}

const LABELS = {
  ko: {
    home: "홈",
    system: "시스템",
    monitoring: "모니터링",
    title: "시스템 모니터링",
    subtitle: "실시간 시스템 성능 및 리소스 모니터링",
    loading: "지표를 불러오는 중...",
    systemOverview: "시스템 개요",
    kernel: "커널",
    autoRefresh: "자동 새로고침 (10초)",
    updated: "갱신",
    refresh: "새로고침",
    cpuUsage: "CPU 사용률",
    memoryUsage: "메모리 사용률",
    loadAverage1m: "부하 평균 (1분)",
    uptime: "가동 시간",
    cpuDetails: "CPU 상세",
    usageBreakdown: "사용률 구성",
    user: "사용자",
    systemLabel: "시스템",
    ioWait: "I/O 대기",
    idle: "유휴",
    cores: "코어",
    memoryDetails: "메모리 상세",
    used: "사용",
    total: "전체",
    free: "여유",
    available: "사용 가능",
    swap: "스왑",
    diskUsage: "디스크 사용량",
    diskIO: "디스크 I/O",
    readKbs: "읽기 KB/s",
    writeKbs: "쓰기 KB/s",
    awaitMs: "대기 ms",
    utilPercent: "사용률 %",
    topCpuProcesses: "CPU 상위 프로세스",
    topMemoryProcesses: "메모리 상위 프로세스",
    pid: "PID",
    type: "유형",
    rss: "RSS",
    command: "명령",
    gpuMetrics: "GPU 지표",
    gpuStatus: "GPU 상태",
    utilization: "사용률",
    memory: "메모리",
    temperature: "온도",
    power: "전력",
    fanSpeed: "팬 속도",
    clockSm: "클럭 (SM)",
    clockMemory: "클럭 (메모리)",
    gpuNotAvailable: "GPU를 사용할 수 없습니다",
    gpuNotAccessible: "컨테이너에서 nvidia-smi에 접근할 수 없습니다",
    loadAverage: "부하 평균",
    minute: "1분",
    minutes5: "5분",
    minutes15: "15분",
    runningProcesses: "실행 중인 프로세스",
    totalThreads: "전체 스레드",
    networkInterfaces: "네트워크 인터페이스",
    interface: "인터페이스",
    rx: "수신",
    tx: "송신",
    speed: "속도",
    status: "상태",
    servicesStatus: "서비스 상태",
    tcpUdpConnections: "TCP/UDP 연결",
    tcpEstablished: "TCP 연결됨",
    tcpListen: "TCP 수신 대기",
    tcpTimewait: "TCP TIME_WAIT",
    tcpCloseWait: "TCP CLOSE_WAIT",
    udpSockets: "UDP 소켓",
    totalTcp: "TCP 전체",
    higherThanNormal: "정상보다 높음",
    lowerThanNormal: "정상보다 낮음",
    normalRange: "정상 범위",
    updating: "업데이트 중...",
  },
  en: {
    home: "Home",
    system: "System",
    monitoring: "Monitoring",
    title: "System Monitoring",
    subtitle: "Real-time system performance and resource monitoring",
    loading: "Loading metrics...",
    systemOverview: "System Overview",
    kernel: "Kernel",
    autoRefresh: "Auto-refresh (10s)",
    updated: "Updated",
    refresh: "Refresh",
    cpuUsage: "CPU Usage",
    memoryUsage: "Memory Usage",
    loadAverage1m: "Load Average (1m)",
    uptime: "Uptime",
    cpuDetails: "CPU Details",
    usageBreakdown: "Usage Breakdown",
    user: "User",
    systemLabel: "System",
    ioWait: "IO Wait",
    idle: "Idle",
    cores: "cores",
    memoryDetails: "Memory Details",
    used: "Used",
    total: "Total",
    free: "Free",
    available: "Available",
    swap: "Swap",
    diskUsage: "Disk Usage",
    diskIO: "Disk I/O",
    readKbs: "Read KB/s",
    writeKbs: "Write KB/s",
    awaitMs: "Await ms",
    utilPercent: "Util %",
    topCpuProcesses: "Top CPU Processes",
    topMemoryProcesses: "Top Memory Processes",
    pid: "PID",
    type: "Type",
    rss: "RSS",
    command: "Command",
    gpuMetrics: "GPU Metrics",
    gpuStatus: "GPU Status",
    utilization: "Utilization",
    memory: "Memory",
    temperature: "Temperature",
    power: "Power",
    fanSpeed: "Fan Speed",
    clockSm: "Clock (SM)",
    clockMemory: "Clock (Memory)",
    gpuNotAvailable: "GPU Not Available",
    gpuNotAccessible: "nvidia-smi not accessible in container",
    loadAverage: "Load Average",
    minute: "1 minute",
    minutes5: "5 minutes",
    minutes15: "15 minutes",
    runningProcesses: "Running Processes",
    totalThreads: "Total Threads",
    networkInterfaces: "Network Interfaces",
    interface: "Interface",
    rx: "RX",
    tx: "TX",
    speed: "Speed",
    status: "Status",
    servicesStatus: "Services Status",
    tcpUdpConnections: "TCP/UDP Connections",
    tcpEstablished: "TCP Established",
    tcpListen: "TCP Listen",
    tcpTimewait: "TCP Timewait",
    tcpCloseWait: "TCP Close Wait",
    udpSockets: "UDP Sockets",
    totalTcp: "Total TCP",
    higherThanNormal: "Higher than normal",
    lowerThanNormal: "Lower than normal",
    normalRange: "Normal range",
    updating: "Updating...",
  },
} as const;

type MonitoringLabels = Record<keyof typeof LABELS.ko, string>;

function getMonitoringLabels(): MonitoringLabels {
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/en/")
  ) {
    return LABELS.en;
  }
  return LABELS.ko;
}

function ProgressBar({
  percent,
  color,
  label,
}: {
  percent: number;
  color: string;
  label?: string;
}) {
  const colors = {
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
  };

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm text-gray-600 w-20">{label}</span>}
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color as keyof typeof colors] || colors.blue} transition-all duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <span className="text-sm font-medium w-12 text-right">
        {percent.toFixed(1)}%
      </span>
    </div>
  );
}

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}
    >
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-red-100 text-red-800",
    running: "bg-green-100 text-green-800",
    stopped: "bg-red-100 text-red-800",
    up: "bg-green-100 text-green-800",
    down: "bg-red-100 text-red-800",
    enabled: "bg-blue-100 text-blue-800",
    disabled: "bg-gray-100 text-gray-800",
    unknown: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.unknown}`}
    >
      {status.toUpperCase()}
    </span>
  );
}

function MetricCard({
  title,
  value,
  unit,
  icon,
  trend,
  labels,
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: string;
  trend?: "up" | "down" | "stable";
  labels: MonitoringLabels;
}) {
  const trendColors = {
    up: "text-red-500",
    down: "text-green-500",
    stable: "text-gray-400",
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {value}
            {unit && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                {unit}
              </span>
            )}
          </p>
        </div>
        <span className="material-symbols-outlined text-2xl text-gray-300">
          {icon}
        </span>
      </div>
      {trend && (
        <div className={`mt-2 text-xs ${trendColors[trend]}`}>
          {trend === "up" && `↑ ${labels.higherThanNormal}`}
          {trend === "down" && `↓ ${labels.lowerThanNormal}`}
          {trend === "stable" && `→ ${labels.normalRange}`}
        </div>
      )}
    </div>
  );
}

function ProcessTable({
  processes,
  type,
  labels,
}: {
  processes: SystemMetrics["top_cpu_processes"];
  type: "cpu" | "mem";
  labels: MonitoringLabels;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-medium text-gray-600">
              {labels.pid}
            </th>
            <th className="text-left py-2 px-2 font-medium text-gray-600">
              {labels.type}
            </th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">
              {type === "cpu" ? "CPU %" : "Mem %"}
            </th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">
              {labels.rss}
            </th>
            <th className="text-left py-2 px-2 font-medium text-gray-600">
              {labels.command}
            </th>
          </tr>
        </thead>
        <tbody>
          {processes?.slice(0, 10).map((proc, idx) => (
            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 font-mono text-xs">{proc.pid}</td>
              <td className="py-2 px-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    proc.type === "java"
                      ? "bg-orange-100 text-orange-800"
                      : proc.type === "python"
                        ? "bg-green-100 text-green-800"
                        : proc.type === "nodejs"
                          ? "bg-emerald-100 text-emerald-800"
                          : proc.type === "database"
                            ? "bg-purple-100 text-purple-800"
                            : proc.type === "webserver"
                              ? "bg-blue-100 text-blue-800"
                              : proc.type === "container"
                                ? "bg-cyan-100 text-cyan-800"
                                : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {proc.type || "other"}
                </span>
              </td>
              <td
                className={`py-2 px-2 text-right font-mono ${type === "cpu" && proc.cpu > 50 ? "text-red-600 font-bold" : "text-gray-900"}`}
              >
                {proc.cpu.toFixed(1)}
              </td>
              <td className="py-2 px-2 text-right font-mono text-xs text-gray-600">
                {proc.rss_human ||
                  (proc.rss_kb ? `${(proc.rss_kb / 1024).toFixed(1)} MB` : "-")}
              </td>
              <td
                className="py-2 px-2 font-mono text-xs text-gray-600 truncate max-w-xs"
                title={proc.cmd}
              >
                {proc.cmd}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NetworkInterfaceTable({
  interfaces,
  labels,
}: {
  interfaces: SystemMetrics["network"];
  labels: MonitoringLabels;
}) {
  const activeIfaces =
    interfaces?.filter(
      (i) =>
        i.status === "up" &&
        !i.name.startsWith("veth") &&
        !i.name.startsWith("docker") &&
        !i.name.startsWith("cni") &&
        !i.name.startsWith("flannel"),
    ) || [];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-medium text-gray-600">
              {labels.interface}
            </th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">
              {labels.rx}
            </th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">
              {labels.tx}
            </th>
            <th className="text-center py-2 px-2 font-medium text-gray-600">
              {labels.speed}
            </th>
            <th className="text-center py-2 px-2 font-medium text-gray-600">
              {labels.status}
            </th>
          </tr>
        </thead>
        <tbody>
          {activeIfaces.map((iface, idx) => (
            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 font-mono font-medium">{iface.name}</td>
              <td className="py-2 px-2 text-right font-mono text-green-600">
                {iface.rx_human}
              </td>
              <td className="py-2 px-2 text-right font-mono text-blue-600">
                {iface.tx_human}
              </td>
              <td className="py-2 px-2 text-center">
                {(iface.speed_mbps ?? 0) > 0 ? `${iface.speed_mbps} Mbps` : "-"}
              </td>
              <td className="py-2 px-2 text-center">
                <StatusBadge status={iface.status ?? "unknown"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MonitoringDashboardPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const labels = getMonitoringLabels();

  const loadData = useCallback(async () => {
    try {
      const data = await fetchSystemMetrics();
      setMetrics(data);
      setLastUpdate(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      void loadData();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadData, autoRefresh]);

  if (loading && !metrics) {
    return (
      <AdminPageShell
        breadcrumbs={[
          { label: labels.home },
          { label: labels.system },
          { label: labels.monitoring },
        ]}
        title={labels.title}
      >
        <AdminWorkspacePageFrame>
          <div className="flex items-center justify-center h-64">
            <span className="material-symbols-outlined animate-spin text-4xl text-gray-400">
              progress_activity
            </span>
            <span className="ml-3 text-gray-500">{labels.loading}</span>
          </div>
        </AdminWorkspacePageFrame>
      </AdminPageShell>
    );
  }

  if (error && !metrics) {
    return (
      <AdminPageShell
        breadcrumbs={[
          { label: labels.home },
          { label: labels.system },
          { label: labels.monitoring },
        ]}
        title={labels.title}
      >
        <AdminWorkspacePageFrame>
          <PageStatusNotice tone="error">{error}</PageStatusNotice>
        </AdminWorkspacePageFrame>
      </AdminPageShell>
    );
  }

  const m = metrics;
  if (!m) return null;

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: labels.home },
        { label: labels.system },
        { label: labels.monitoring },
      ]}
      title={labels.title}
      subtitle={labels.subtitle}
    >
      <AdminWorkspacePageFrame>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold">{labels.systemOverview}</h2>
            {m.hostname && (
              <span className="text-sm text-gray-500">
                {m.hostname.name} • {m.hostname.os} • {labels.kernel}{" "}
                {m.hostname.kernel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              {labels.autoRefresh}
            </label>
            {lastUpdate && (
              <span className="text-sm text-gray-500">
                {labels.updated}: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => void loadData()}
              className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <span className="material-symbols-outlined text-base">
                refresh
              </span>
              {labels.refresh}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-6">
          <MetricCard
            labels={labels}
            title={labels.cpuUsage}
            value={m.cpu?.usage_percent?.toFixed(1) || "0"}
            unit="%"
            icon="memory"
            trend={(m.cpu?.usage_percent || 0) > 70 ? "up" : "stable"}
          />
          <MetricCard
            labels={labels}
            title={labels.memoryUsage}
            value={m.memory?.usage_percent?.toFixed(1) || "0"}
            unit="%"
            icon="storage"
            trend={(m.memory?.usage_percent || 0) > 75 ? "up" : "stable"}
          />
          <MetricCard
            labels={labels}
            title={labels.loadAverage1m}
            value={m.load?.load_1m?.toFixed(2) || "0"}
            icon="speed"
          />
          <MetricCard
            labels={labels}
            title={labels.uptime}
            value={formatUptime(
              m.hostname?.uptime_days || 0,
              m.hostname?.uptime_hours || 0,
              m.hostname?.uptime_mins || 0,
            )}
            icon="schedule"
          />
          <MetricCard
            labels={labels}
            title={labels.gpuStatus}
            value={m.gpu?.available ? String(m.gpu.devices?.length || 0) : labels.gpuNotAvailable}
            icon="developer_board"
            trend={m.gpu?.available ? "stable" : undefined}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card title={labels.cpuDetails}>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">
                  {labels.usageBreakdown}
                </p>
                <ProgressBar
                  percent={m.cpu?.user_percent || 0}
                  color="blue"
                  label={labels.user}
                />
                <ProgressBar
                  percent={m.cpu?.system_percent || 0}
                  color="purple"
                  label={labels.systemLabel}
                />
                <ProgressBar
                  percent={m.cpu?.iowait_percent || 0}
                  color="yellow"
                  label={labels.ioWait}
                />
                <ProgressBar
                  percent={m.cpu?.idle_percent || 0}
                  color="green"
                  label={labels.idle}
                />
              </div>
              <div className="pt-2 border-t text-sm">
                <p className="font-medium text-gray-700">{m.cpu?.model}</p>
                <p className="text-gray-500">
                  {m.cpu?.cores} {labels.cores}
                </p>
              </div>
            </div>
          </Card>

          <Card title={labels.memoryDetails}>
            <div className="space-y-3">
              <div>
                <ProgressBar
                  percent={m.memory?.usage_percent || 0}
                  color={getColorForPercent(m.memory?.usage_percent || 0)}
                  label={labels.used}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">{labels.total}</p>
                  <p className="font-medium">
                    {formatBytes(m.memory?.total_bytes || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">{labels.used}</p>
                  <p className="font-medium">
                    {formatBytes(m.memory?.used_bytes || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">{labels.free}</p>
                  <p className="font-medium">
                    {formatBytes(m.memory?.free_bytes || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">{labels.available}</p>
                  <p className="font-medium">
                    {formatBytes(m.memory?.available_bytes || 0)}
                  </p>
                </div>
              </div>
              {m.memory?.swap_total_bytes && m.memory.swap_total_bytes > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-500 mb-1">
                    {labels.swap}: {formatBytes(m.memory?.swap_used_bytes ?? 0)}{" "}
                    / {formatBytes(m.memory?.swap_total_bytes ?? 0)}
                  </p>
                  <ProgressBar
                    percent={m.memory.swap_usage_percent || 0}
                    color={getColorForPercent(m.memory.swap_usage_percent || 0)}
                  />
                </div>
              )}
            </div>
          </Card>
        </div>

        {m.disks && m.disks.length > 0 && (
          <Card title={labels.diskUsage} className="mb-6">
            <div className="space-y-3">
              {m.disks.map((disk, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{disk.mounted}</span>
                    <span className="text-gray-500">
                      {disk.used} / {disk.total}
                    </span>
                  </div>
                  <ProgressBar
                    percent={disk.usage_percent ?? 0}
                    color={getColorForPercent(disk.usage_percent ?? 0)}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {m.disk_io && Object.keys(m.disk_io).length > 0 && (
          <Card title={labels.diskIO} className="mb-6">
            <div className="grid grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {m.disk_io.tps?.toFixed(1) || "0"}
                </p>
                <p className="text-xs text-gray-500">TPS</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {m.disk_io.read_kb_s?.toFixed(0) || "0"}
                </p>
                <p className="text-xs text-gray-500">{labels.readKbs}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {m.disk_io.write_kb_s?.toFixed(0) || "0"}
                </p>
                <p className="text-xs text-gray-500">{labels.writeKbs}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {m.disk_io.await_ms?.toFixed(1) || "0"}
                </p>
                <p className="text-xs text-gray-500">{labels.awaitMs}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">
                  {m.disk_io.util_percent?.toFixed(1) || "0"}%
                </p>
                <p className="text-xs text-gray-500">{labels.utilPercent}</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card title={labels.topCpuProcesses}>
            <ProcessTable
              processes={m.top_cpu_processes || []}
              type="cpu"
              labels={labels}
            />
          </Card>

          <Card title={labels.topMemoryProcesses}>
            <ProcessTable
              processes={m.top_mem_processes || []}
              type="mem"
              labels={labels}
            />
          </Card>
        </div>

        {m.gpu?.available && (
          <div className="mb-6">
            <Card title={labels.gpuMetrics}>
              <div className="space-y-4">
                {m.gpu.devices?.map((g) => (
                  <div
                    key={g.index}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-600">
                          memory
                        </span>
                        <span className="font-bold">{g.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        GPU {g.index}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">
                          {labels.utilization}
                        </p>
                        <p className="text-xl font-bold text-green-600">
                          {g.utilization_percent.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{labels.memory}</p>
                        <p className="text-xl font-bold text-blue-600">
                          {g.memory_used_mb.toFixed(0)} /{" "}
                          {g.memory_total_mb.toFixed(0)} MB
                        </p>
                        <p className="text-xs text-gray-400">
                          ({g.memory_used_percent.toFixed(1)}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">
                          {labels.temperature}
                        </p>
                        <p className="text-xl font-bold text-orange-600">
                          {g.temperature_c}°C
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{labels.power}</p>
                        <p className="text-xl font-bold text-purple-600">
                          {g.power_draw_w.toFixed(1)} /{" "}
                          {g.power_limit_w.toFixed(0)} W
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{labels.fanSpeed}</span>
                        <span className="font-mono">
                          {g.fan_speed_percent.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{labels.clockSm}</span>
                        <span className="font-mono">{g.clock_sm_mhz} MHz</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          {labels.clockMemory}
                        </span>
                        <span className="font-mono">
                          {g.clock_memory_mhz} MHz
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {!m.gpu?.available && (
          <div className="mb-6">
            <Card title={labels.gpuMetrics}>
              <div className="flex items-center justify-center py-8 text-gray-400">
                <span className="material-symbols-outlined text-4xl mr-3">
                  memory
                </span>
                <div>
                  <p className="text-gray-600 font-medium">
                    {labels.gpuNotAvailable}
                  </p>
                  <p className="text-sm text-gray-400">
                    {labels.gpuNotAccessible}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card title={labels.loadAverage}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{labels.minute}</span>
                <span className="text-xl font-mono font-bold">
                  {(m.load?.load_1m || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{labels.minutes5}</span>
                <span className="text-xl font-mono font-bold">
                  {(m.load?.load_5m || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{labels.minutes15}</span>
                <span className="text-xl font-mono font-bold">
                  {(m.load?.load_15m || 0).toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {labels.runningProcesses}
                  </span>
                  <span className="font-mono">
                    {m.load?.running_processes || "0"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{labels.totalThreads}</span>
                  <span className="font-mono">
                    {m.load?.total_threads || 0}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card title={labels.networkInterfaces}>
            <NetworkInterfaceTable
              interfaces={m.network || []}
              labels={labels}
            />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card title={labels.servicesStatus}>
            <div className="space-y-2">
              {m.services &&
                Object.entries(m.services).map(([name, info]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium capitalize">{name}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={info.status} />
                      <span className="text-xs text-gray-400">
                        {info.enabled}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          <Card title={labels.tcpUdpConnections}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{labels.tcpEstablished}</span>
                <span className="text-2xl font-bold text-green-600">
                  {m.tcp_udp?.tcp_established || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{labels.tcpListen}</span>
                <span className="text-2xl font-bold text-blue-600">
                  {m.tcp_udp?.tcp_listen || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{labels.tcpTimewait}</span>
                <span className="text-2xl font-bold text-yellow-600">
                  {m.tcp_udp?.tcp_timewait || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{labels.tcpCloseWait}</span>
                <span className="text-2xl font-bold text-orange-600">
                  {m.tcp_udp?.tcp_closewait || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{labels.udpSockets}</span>
                <span className="text-2xl font-bold text-purple-600">
                  {m.tcp_udp?.udp_sockets || 0}
                </span>
              </div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="text-gray-600 font-medium">
                  {labels.totalTcp}
                </span>
                <span className="text-xl font-bold">
                  {m.tcp_udp?.tcp_total || 0}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <span className="material-symbols-outlined animate-spin text-2xl text-gray-400">
              progress_activity
            </span>
            <span className="ml-2 text-gray-500">{labels.updating}</span>
          </div>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export default MonitoringDashboardPage;
