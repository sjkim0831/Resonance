import { useEffect, useState, useCallback } from 'react';
import { fetchSystemMetrics } from '../../lib/api/monitoring';
import type { SystemMetrics } from '../../lib/api/monitoringTypes';
import { AdminPageShell } from '../admin-entry/AdminPageShell';
import { PageStatusNotice } from '../admin-ui/common';
import { AdminWorkspacePageFrame } from '../admin-ui/pageFrames';

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
  const color = percent > 85 ? 'red' : percent > 70 ? 'yellow' : 'green';
  if (reverse && percent > 85) return 'green';
  return color;
}

function ProgressBar({ percent, color, label }: { percent: number; color: string; label?: string }) {
  const colors = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
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
      <span className="text-sm font-medium w-12 text-right">{percent.toFixed(1)}%</span>
    </div>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-red-100 text-red-800',
    running: 'bg-green-100 text-green-800',
    stopped: 'bg-red-100 text-red-800',
    up: 'bg-green-100 text-green-800',
    down: 'bg-red-100 text-red-800',
    enabled: 'bg-blue-100 text-blue-800',
    disabled: 'bg-gray-100 text-gray-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.unknown}`}>
      {status.toUpperCase()}
    </span>
  );
}

function MetricCard({ title, value, unit, icon, trend }: {
  title: string;
  value: string | number;
  unit?: string;
  icon: string;
  trend?: 'up' | 'down' | 'stable';
}) {
  const trendColors = {
    up: 'text-red-500',
    down: 'text-green-500',
    stable: 'text-gray-400',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {value}
            {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
          </p>
        </div>
        <span className="material-symbols-outlined text-2xl text-gray-300">{icon}</span>
      </div>
      {trend && (
        <div className={`mt-2 text-xs ${trendColors[trend]}`}>
          {trend === 'up' && '↑ Higher than normal'}
          {trend === 'down' && '↓ Lower than normal'}
          {trend === 'stable' && '→ Normal range'}
        </div>
      )}
    </div>
  );
}

function ProcessTable({ processes, type }: { processes: SystemMetrics['top_cpu_processes']; type: 'cpu' | 'mem' }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-medium text-gray-600">PID</th>
            <th className="text-left py-2 px-2 font-medium text-gray-600">User</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">{type === 'cpu' ? 'CPU %' : 'Mem %'}</th>
            <th className="text-left py-2 px-2 font-medium text-gray-600">Command</th>
          </tr>
        </thead>
        <tbody>
          {processes.slice(0, 10).map((proc, idx) => (
            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 font-mono text-xs">{proc.pid}</td>
              <td className="py-2 px-2 text-gray-600">{proc.user}</td>
              <td className={`py-2 px-2 text-right font-mono ${type === 'cpu' && proc.cpu > 50 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                {proc.cpu.toFixed(1)}
              </td>
              <td className="py-2 px-2 font-mono text-xs text-gray-600 truncate max-w-xs" title={proc.cmd}>
                {proc.cmd}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NetworkInterfaceTable({ interfaces }: { interfaces: SystemMetrics['network'] }) {
  const activeIfaces = interfaces.filter(i => i.status === 'up' && !i.name.startsWith('veth') && !i.name.startsWith('docker') && !i.name.startsWith('cni') && !i.name.startsWith('flannel'));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-medium text-gray-600">Interface</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">RX</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">TX</th>
            <th className="text-center py-2 px-2 font-medium text-gray-600">Speed</th>
            <th className="text-center py-2 px-2 font-medium text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {activeIfaces.map((iface, idx) => (
            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 font-mono font-medium">{iface.name}</td>
              <td className="py-2 px-2 text-right font-mono text-green-600">{iface.rx_human}</td>
              <td className="py-2 px-2 text-right font-mono text-blue-600">{iface.tx_human}</td>
              <td className="py-2 px-2 text-center">{iface.speed_mbps > 0 ? `${iface.speed_mbps} Mbps` : '-'}</td>
              <td className="py-2 px-2 text-center"><StatusBadge status={iface.status} /></td>
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
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchSystemMetrics();
      setMetrics(data);
      setLastUpdate(new Date());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics');
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
        breadcrumbs={[{ label: 'Home' }, { label: 'System' }, { label: 'Monitoring' }]}
        title="System Monitoring"
      >
        <AdminWorkspacePageFrame>
          <div className="flex items-center justify-center h-64">
            <span className="material-symbols-outlined animate-spin text-4xl text-gray-400">progress_activity</span>
            <span className="ml-3 text-gray-500">Loading metrics...</span>
          </div>
        </AdminWorkspacePageFrame>
      </AdminPageShell>
    );
  }

  if (error && !metrics) {
    return (
      <AdminPageShell
        breadcrumbs={[{ label: 'Home' }, { label: 'System' }, { label: 'Monitoring' }]}
        title="System Monitoring"
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
      breadcrumbs={[{ label: 'Home' }, { label: 'System' }, { label: 'Monitoring' }]}
      title="System Monitoring"
      subtitle="Real-time system performance and resource monitoring"
    >
      <AdminWorkspacePageFrame>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold">System Overview</h2>
            {m.hostname && (
              <span className="text-sm text-gray-500">
                {m.hostname.name} • {m.hostname.os} • Kernel {m.hostname.kernel}
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
              Auto-refresh (10s)
            </label>
            {lastUpdate && (
              <span className="text-sm text-gray-500">
                Updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => void loadData()}
              className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard
            title="CPU Usage"
            value={m.cpu?.usage_percent?.toFixed(1) || '0'}
            unit="%"
            icon="memory"
            trend={(m.cpu?.usage_percent || 0) > 70 ? 'up' : 'stable'}
          />
          <MetricCard
            title="Memory Usage"
            value={m.memory?.usage_percent?.toFixed(1) || '0'}
            unit="%"
            icon="storage"
            trend={(m.memory?.usage_percent || 0) > 75 ? 'up' : 'stable'}
          />
          <MetricCard
            title="Load Average (1m)"
            value={m.load?.load_1m?.toFixed(2) || '0'}
            icon="speed"
          />
          <MetricCard
            title="Uptime"
            value={formatUptime(
              m.hostname?.uptime_days || 0,
              m.hostname?.uptime_hours || 0,
              m.hostname?.uptime_mins || 0
            )}
            icon="schedule"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card title="CPU Details">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">Usage Breakdown</p>
                <ProgressBar percent={m.cpu?.user_percent || 0} color="blue" label="User" />
                <ProgressBar percent={m.cpu?.system_percent || 0} color="purple" label="System" />
                <ProgressBar percent={m.cpu?.iowait_percent || 0} color="yellow" label="IO Wait" />
                <ProgressBar percent={m.cpu?.idle_percent || 0} color="green" label="Idle" />
              </div>
              <div className="pt-2 border-t text-sm">
                <p className="font-medium text-gray-700">{m.cpu?.model}</p>
                <p className="text-gray-500">{m.cpu?.cores} cores</p>
              </div>
            </div>
          </Card>

          <Card title="Memory Details">
            <div className="space-y-3">
              <div>
                <ProgressBar
                  percent={m.memory?.usage_percent || 0}
                  color={getColorForPercent(m.memory?.usage_percent || 0)}
                  label="Used"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Total</p>
                  <p className="font-medium">{formatBytes(m.memory?.total_bytes || 0)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Used</p>
                  <p className="font-medium">{formatBytes(m.memory?.used_bytes || 0)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Free</p>
                  <p className="font-medium">{formatBytes(m.memory?.free_bytes || 0)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Available</p>
                  <p className="font-medium">{formatBytes(m.memory?.available_bytes || 0)}</p>
                </div>
              </div>
              {m.memory?.swap_total_bytes && m.memory.swap_total_bytes > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-500 mb-1">Swap: {formatBytes(m.memory.swap_used_bytes)} / {formatBytes(m.memory.swap_total_bytes)}</p>
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
          <Card title="Disk Usage" className="mb-6">
            <div className="space-y-3">
              {m.disks.map((disk, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{disk.mounted}</span>
                    <span className="text-gray-500">{disk.used} / {disk.total}</span>
                  </div>
                  <ProgressBar
                    percent={disk.usage_percent}
                    color={getColorForPercent(disk.usage_percent)}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {m.disk_io && Object.keys(m.disk_io).length > 0 && (
          <Card title="Disk I/O" className="mb-6">
            <div className="grid grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{m.disk_io.tps?.toFixed(1) || '0'}</p>
                <p className="text-xs text-gray-500">TPS</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{m.disk_io.read_kb_s?.toFixed(0) || '0'}</p>
                <p className="text-xs text-gray-500">Read KB/s</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{m.disk_io.write_kb_s?.toFixed(0) || '0'}</p>
                <p className="text-xs text-gray-500">Write KB/s</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{m.disk_io.await_ms?.toFixed(1) || '0'}</p>
                <p className="text-xs text-gray-500">Await ms</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">{m.disk_io.util_percent?.toFixed(1) || '0'}%</p>
                <p className="text-xs text-gray-500">Util %</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card title="Top CPU Processes">
            <ProcessTable processes={m.top_cpu_processes || []} type="cpu" />
          </Card>

          <Card title="Top Memory Processes">
            <ProcessTable processes={m.top_mem_processes || []} type="mem" />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card title="Load Average">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">1 minute</span>
                <span className="text-xl font-mono font-bold">{(m.load?.load_1m || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">5 minutes</span>
                <span className="text-xl font-mono font-bold">{(m.load?.load_5m || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">15 minutes</span>
                <span className="text-xl font-mono font-bold">{(m.load?.load_15m || 0).toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Running Processes</span>
                  <span className="font-mono">{m.load?.running_processes || '0'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total Threads</span>
                  <span className="font-mono">{m.load?.total_threads || 0}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Network Interfaces">
            <NetworkInterfaceTable interfaces={m.network || []} />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card title="Services Status">
            <div className="space-y-2">
              {m.services && Object.entries(m.services).map(([name, info]) => (
                <div key={name} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                  <span className="font-medium capitalize">{name}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={info.status} />
                    <span className="text-xs text-gray-400">{info.enabled}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="TCP/UDP Connections">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">TCP Established</span>
                <span className="text-2xl font-bold text-green-600">{m.tcp_udp?.tcp_established || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">TCP Timewait</span>
                <span className="text-2xl font-bold text-yellow-600">{m.tcp_udp?.tcp_timewait || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">UDP Sockets</span>
                <span className="text-2xl font-bold text-blue-600">{m.tcp_udp?.udp_sockets || 0}</span>
              </div>
            </div>
          </Card>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <span className="material-symbols-outlined animate-spin text-2xl text-gray-400">progress_activity</span>
            <span className="ml-2 text-gray-500">Updating...</span>
          </div>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export default MonitoringDashboardPage;