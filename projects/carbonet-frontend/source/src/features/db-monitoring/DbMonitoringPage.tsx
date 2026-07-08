import { useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type Health = "up" | "down" | "warning";

interface NamedValue {
  name: string;
  value: number;
}

interface DatabaseSize {
  name: string;
  size: number;
}

interface PatroniMember {
  name: string;
  role: string;
  state: string;
  host: string;
  timeline: number;
  lagMb: number;
}

interface PrometheusTarget {
  job: string;
  instance: string;
  health: string;
  lastScrape: string;
  lastError: string;
}

interface TableStat {
  name: string;
  liveRows: number;
  deadRows: number;
  sizeBytes: number;
}

interface DbEnvironment {
  cluster: string;
  databaseEngine: string;
  haManager: string;
  patroniCluster: string;
  pgData: string;
  writeService: string;
  readService: string;
  legacyService: string;
  pooler: string;
  poolerAdmin: string;
  exporter: string;
  prometheus: string;
  grafana: string;
  externalPatroniNodePort: string;
  externalHaNodePort: string;
  directHaNodePort: string;
  patroniMembers: PatroniMember[];
}

interface TransactionStats {
  commits: number;
  rollbacks: number;
  rollbackPercent: number;
  commitsPerSecond: number;
  rollbacksPerSecond: number;
}

interface DbSettings {
  maxConnections: number;
  sharedBuffersBytes: number;
  effectiveCacheSizeBytes: number;
  workMemBytes: number;
  maintenanceWorkMemBytes: number;
  walKeepSizeBytes: number;
  maxWalSizeBytes: number;
  minWalSizeBytes: number;
  maxWalSenders: number;
  maxReplicationSlots: number;
  autovacuum: number;
  hotStandby: number;
  ssl: number;
}

interface DbMetrics {
  environment: DbEnvironment;
  prometheusTargets: PrometheusTarget[];
  pgUp: number;
  databaseSizes: DatabaseSize[];
  activityByState: NamedValue[];
  activityByDatabase: NamedValue[];
  activeConnections: number;
  totalConnections: number;
  maxConnections: number;
  connectionUsagePercent: number;
  replicationLag: number;
  replicationIsReplica: number;
  replicationSlotsActive: number;
  walSize: number;
  walSegments: number;
  locksByMode: NamedValue[];
  accessShareLocks: number;
  exclusiveLocks: number;
  transactionStats: TransactionStats;
  cacheHitPercent: number;
  deadlocks: number;
  tempBytes: number;
  tableStats: TableStat[];
  settings: DbSettings;
  lastScrapeError: number;
  scrapeDuration: number;
  scrapesTotal: number;
  timestamp: number;
  timestampIso: string;
}

const fallbackPayload: DbMetrics = {
  environment: {
    cluster: "carbonet-prod",
    databaseEngine: "PostgreSQL",
    haManager: "Patroni 3.2.2",
    patroniCluster: "postgres-patroni",
    pgData: "/home/postgres/pgdata/pgroot/data",
    writeService: "postgres-haproxy.carbonet-prod.svc.cluster.local:5432",
    readService: "postgres-haproxy.carbonet-prod.svc.cluster.local:5433",
    legacyService: "postgres-ha.carbonet-prod.svc.cluster.local:5432",
    pooler: "postgres-pgbouncer.carbonet-prod.svc.cluster.local:5432",
    poolerAdmin: "postgres-pgbouncer.carbonet-prod.svc.cluster.local:5433",
    exporter: "postgres-exporter.monitoring.svc.cluster.local:9187",
    prometheus: "http://prometheus.monitoring.svc.cluster.local:9090",
    grafana: "http://172.16.1.232:30300",
    externalPatroniNodePort: "172.16.1.232:31433",
    externalHaNodePort: "172.16.1.232:31432",
    directHaNodePort: "172.16.1.232:31434",
    patroniMembers: [
      { name: "postgres-patroni-0", role: "Leader", state: "running", host: "10.244.0.215", timeline: 7, lagMb: 0 },
      { name: "postgres-patroni-1", role: "Replica", state: "streaming", host: "10.244.0.217", timeline: 7, lagMb: 0 },
      { name: "postgres-patroni-2", role: "Replica", state: "streaming", host: "10.244.0.218", timeline: 7, lagMb: 0 }
    ]
  },
  prometheusTargets: [{ job: "postgres-exporter", instance: "postgres-exporter.monitoring.svc.cluster.local:9187", health: "up", lastScrape: "-", lastError: "" }],
  pgUp: 1,
  databaseSizes: [
    { name: "carbonet", size: 1524030487 },
    { name: "postgres", size: 7732247 },
    { name: "template0", size: 7537167 },
    { name: "template1", size: 7602703 }
  ],
  activityByState: [{ name: "active", value: 1 }, { name: "idle", value: 0 }],
  activityByDatabase: [{ name: "postgres", value: 1 }, { name: "carbonet", value: 0 }],
  activeConnections: 1,
  totalConnections: 1,
  maxConnections: 100,
  connectionUsagePercent: 1,
  replicationLag: 0,
  replicationIsReplica: 0,
  replicationSlotsActive: 0,
  walSize: 218103808,
  walSegments: 13,
  locksByMode: [{ name: "accesssharelock", value: 558 }],
  accessShareLocks: 558,
  exclusiveLocks: 0,
  transactionStats: { commits: 7608690, rollbacks: 4684, rollbackPercent: 0.06, commitsPerSecond: 0, rollbacksPerSecond: 0 },
  cacheHitPercent: 99.95,
  deadlocks: 0,
  tempBytes: 0,
  tableStats: [],
  settings: {
    maxConnections: 100,
    sharedBuffersBytes: 134217728,
    effectiveCacheSizeBytes: 0,
    workMemBytes: 0,
    maintenanceWorkMemBytes: 0,
    walKeepSizeBytes: 0,
    maxWalSizeBytes: 0,
    minWalSizeBytes: 0,
    maxWalSenders: 0,
    maxReplicationSlots: 0,
    autovacuum: 1,
    hotStandby: 1,
    ssl: 0
  },
  lastScrapeError: 0,
  scrapeDuration: 0.0029,
  scrapesTotal: 0,
  timestamp: Date.now(),
  timestampIso: new Date().toISOString()
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function StatusBadge({ value, label }: { value: Health; label?: string }) {
  const config = {
    up: { bg: "bg-emerald-100", text: "text-emerald-700", label: label ?? "UP" },
    down: { bg: "bg-rose-100", text: "text-rose-700", label: label ?? "DOWN" },
    warning: { bg: "bg-amber-100", text: "text-amber-700", label: label ?? "WARN" }
  };
  const c = config[value];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${c.bg} ${c.text}`}>{c.label}</span>;
}

function SimpleBar({ value, max, tone = "bg-blue-500" }: { value: number; max: number; tone?: string }) {
  const width = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
      <div className={`h-2 rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function DetailGrid({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <dl className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-slate-50 p-4">
          <dt className="text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-bold text-[var(--kr-gov-text-primary)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GrafanaEmbed({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative" style={{ height: "calc(100vh - 320px)", minHeight: "500px" }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="text-sm text-[var(--kr-gov-text-secondary)]">Grafana 로딩 중...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <p className="font-bold text-rose-600">대시보드 로드 실패</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="gov-link text-sm">
              Grafana에서 직접 열기
            </a>
          </div>
        </div>
      )}
      <iframe
        src={url}
        className="h-full w-full rounded-lg border border-[var(--kr-gov-border-light)]"
        style={{ display: loading ? "none" : "block" }}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError("Failed to load");
        }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}

export function DbMonitoringPage() {
  const en = isEnglish();
  const [payload, setPayload] = useState<DbMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showGrafana, setShowGrafana] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    try {
      setError(null);
      const res = await fetch("/admin/api/prometheus/metrics", {
        credentials: "include",
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
      });

      if (!res.ok) {
        setPayload(fallbackPayload);
        setLastUpdated(new Date());
        setError(`HTTP ${res.status}`);
        return;
      }

      const data = await res.json();
      setPayload({ ...fallbackPayload, ...data, environment: { ...fallbackPayload.environment, ...(data.environment ?? {}) } });
      setLastUpdated(new Date());
    } catch (e) {
      setPayload(fallbackPayload);
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    logGovernanceScope("PAGE", "db-monitoring", { language: en ? "en" : "ko" });
    void loadMetrics().finally(() => setLoading(false));
  }, [en]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadMetrics();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const data = payload ?? fallbackPayload;
  const env = data.environment;
  const totalDbSize = useMemo(() => data.databaseSizes.reduce((sum, db) => sum + Number(db.size || 0), 0), [data.databaseSizes]);
  const clusterHealth: Health = data.pgUp === 1 && data.lastScrapeError === 0 ? "up" : data.pgUp === 1 ? "warning" : "down";
  const connectionTone = data.connectionUsagePercent >= 80 ? "warning" : "up";
  const grafanaUrl = "http://172.16.1.232:30300/d/postgres-db-monitoring/postgresql-database-monitoring?kiosk=tv&theme=light";

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Database Monitoring" : "DB 모니터링" }
      ]}
      sidebarVariant="system"
      title={en ? "PostgreSQL HA Monitoring" : "PostgreSQL HA 모니터링"}
      subtitle={en ? "Patroni, HAProxy, PgBouncer, exporter, and PostgreSQL runtime metrics." : "Patroni, HAProxy, PgBouncer, exporter, PostgreSQL 런타임 지표를 통합 확인합니다."}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && <span className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Updated" : "갱신"}: {lastUpdated.toLocaleTimeString()}</span>}
          <label className="flex items-center gap-1.5 text-sm text-[var(--kr-gov-text-secondary)]">
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="gov-checkbox" />
            {en ? "Auto-refresh (30s)" : "자동 새로고침 (30초)"}
          </label>
          <button className="gov-btn gov-btn-outline" onClick={() => void loadMetrics()} type="button">
            {en ? "Refresh" : "새로고침"}
          </button>
          <button className={`gov-btn ${showGrafana ? "gov-btn-primary" : "gov-btn-outline"}`} onClick={() => setShowGrafana(!showGrafana)} type="button">
            {showGrafana ? (en ? "Hide Grafana" : "Grafana 숨기기") : en ? "Show Grafana" : "Grafana 보기"}
          </button>
        </div>
      }
    >
      <AdminWorkspacePageFrame>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {error && <PageStatusNotice tone="warning">실시간 API 응답을 받지 못해 마지막 확인값/기본값을 표시합니다. ({error})</PageStatusNotice>}

            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <SummaryMetricCard title={en ? "DB Health" : "DB 상태"} value={<StatusBadge value={clusterHealth} />} description={env.patroniCluster} />
              <SummaryMetricCard title={en ? "Connections" : "연결 사용률"} value={`${formatNumber(data.connectionUsagePercent, 1)}%`} description={`${formatNumber(data.totalConnections)} / ${formatNumber(data.maxConnections)}`} />
              <SummaryMetricCard title={en ? "Replication Lag" : "복제 지연"} value={`${formatNumber(data.replicationLag, 1)}s`} description={en ? "Prometheus exporter" : "Prometheus 수집값"} />
              <SummaryMetricCard title={en ? "Database Size" : "DB 총 용량"} value={formatBytes(totalDbSize)} description={`${data.databaseSizes.length} databases`} />
              <SummaryMetricCard title={en ? "WAL" : "WAL"} value={formatBytes(data.walSize)} description={`${formatNumber(data.walSegments)} segments`} />
              <SummaryMetricCard title={en ? "Cache Hit" : "캐시 적중률"} value={`${formatNumber(data.cacheHitPercent, 2)}%`} description={data.deadlocks > 0 ? `${formatNumber(data.deadlocks)} deadlocks` : "deadlock 0"} />
            </section>

            <section className="gov-card mb-6">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black">{en ? "Current DB Environment" : "현재 DB 환경"}</h2>
              </div>
              <div className="p-6">
                <DetailGrid
                  items={[
                    { label: "Namespace", value: env.cluster },
                    { label: "Engine", value: env.databaseEngine },
                    { label: "HA Manager", value: env.haManager },
                    { label: "PGDATA", value: env.pgData },
                    { label: "Write Service", value: env.writeService },
                    { label: "Read Service", value: env.readService },
                    { label: "PgBouncer", value: env.pooler },
                    { label: "PgBouncer Admin", value: env.poolerAdmin },
                    { label: "Exporter", value: env.exporter },
                    { label: "Prometheus", value: env.prometheus },
                    { label: "External Patroni", value: env.externalPatroniNodePort },
                    { label: "External HA", value: env.externalHaNodePort }
                  ]}
                />
              </div>
            </section>

            <section className="gov-card mb-6">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black">{en ? "Patroni Cluster Members" : "Patroni 클러스터 멤버"}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">
                    <tr>
                      <th className="px-6 py-3">Member</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">State</th>
                      <th className="px-6 py-3">Host</th>
                      <th className="px-6 py-3">TL</th>
                      <th className="px-6 py-3">Lag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--kr-gov-border-light)]">
                    {env.patroniMembers.map((member) => (
                      <tr key={member.name}>
                        <td className="px-6 py-4 font-bold">{member.name}</td>
                        <td className="px-6 py-4"><StatusBadge value={member.role.toLowerCase() === "leader" ? "up" : "warning"} label={member.role} /></td>
                        <td className="px-6 py-4">{member.state}</td>
                        <td className="px-6 py-4">{member.host}</td>
                        <td className="px-6 py-4">{member.timeline}</td>
                        <td className="px-6 py-4">{member.lagMb} MB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="gov-card">
                <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                  <h2 className="text-lg font-black">{en ? "Database Sizes" : "데이터베이스 크기"}</h2>
                </div>
                <div className="divide-y divide-[var(--kr-gov-border-light)]">
                  {data.databaseSizes.map((db) => (
                    <div key={db.name} className="px-6 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold">{db.name}</p>
                          <p className="text-sm text-[var(--kr-gov-text-secondary)]">{formatBytes(db.size)}</p>
                        </div>
                        <p className="text-sm font-bold">{formatNumber(totalDbSize > 0 ? (db.size / totalDbSize) * 100 : 0, 1)}%</p>
                      </div>
                      <SimpleBar value={db.size} max={Math.max(totalDbSize, 1)} tone="bg-sky-500" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="gov-card">
                <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                  <h2 className="text-lg font-black">{en ? "Connections and Locks" : "연결 및 락"}</h2>
                </div>
                <div className="space-y-5 p-6">
                  <div>
                    <div className="flex justify-between text-sm font-bold">
                      <span>{en ? "Connection usage" : "연결 사용률"}</span>
                      <span>{formatNumber(data.connectionUsagePercent, 1)}%</span>
                    </div>
                    <SimpleBar value={data.connectionUsagePercent} max={100} tone={connectionTone === "warning" ? "bg-amber-500" : "bg-emerald-500"} />
                  </div>
                  <DetailGrid
                    items={[
                      { label: en ? "Active" : "활성 연결", value: formatNumber(data.activeConnections) },
                      { label: en ? "Total" : "전체 연결", value: formatNumber(data.totalConnections) },
                      { label: "Max Connections", value: formatNumber(data.maxConnections) },
                      { label: "AccessShareLock", value: formatNumber(data.accessShareLocks) },
                      { label: "Exclusive Locks", value: formatNumber(data.exclusiveLocks) },
                      { label: "Temp Bytes", value: formatBytes(data.tempBytes) }
                    ]}
                  />
                </div>
              </div>
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="gov-card">
                <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                  <h2 className="text-lg font-black">{en ? "Transactions" : "트랜잭션"}</h2>
                </div>
                <div className="p-6">
                  <DetailGrid
                    items={[
                      { label: "Commit", value: formatNumber(data.transactionStats.commits) },
                      { label: "Rollback", value: formatNumber(data.transactionStats.rollbacks) },
                      { label: "Rollback %", value: `${formatNumber(data.transactionStats.rollbackPercent, 3)}%` },
                      { label: "Commit/sec", value: formatNumber(data.transactionStats.commitsPerSecond, 3) },
                      { label: "Rollback/sec", value: formatNumber(data.transactionStats.rollbacksPerSecond, 3) },
                      { label: "Deadlocks", value: formatNumber(data.deadlocks) }
                    ]}
                  />
                </div>
              </div>

              <div className="gov-card">
                <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                  <h2 className="text-lg font-black">{en ? "PostgreSQL Settings" : "PostgreSQL 설정"}</h2>
                </div>
                <div className="p-6">
                  <DetailGrid
                    items={[
                      { label: "shared_buffers", value: formatBytes(data.settings.sharedBuffersBytes) },
                      { label: "effective_cache_size", value: formatBytes(data.settings.effectiveCacheSizeBytes) },
                      { label: "work_mem", value: formatBytes(data.settings.workMemBytes) },
                      { label: "maintenance_work_mem", value: formatBytes(data.settings.maintenanceWorkMemBytes) },
                      { label: "max_wal_size", value: formatBytes(data.settings.maxWalSizeBytes) },
                      { label: "max_wal_senders", value: formatNumber(data.settings.maxWalSenders) },
                      { label: "max_replication_slots", value: formatNumber(data.settings.maxReplicationSlots) },
                      { label: "autovacuum", value: data.settings.autovacuum ? "on" : "off" },
                      { label: "hot_standby", value: data.settings.hotStandby ? "on" : "off" }
                    ]}
                  />
                </div>
              </div>
            </section>

            <section className="gov-card mb-6">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black">{en ? "Exporter and Prometheus Targets" : "Exporter 및 Prometheus 타깃"}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">
                    <tr>
                      <th className="px-6 py-3">Job</th>
                      <th className="px-6 py-3">Instance</th>
                      <th className="px-6 py-3">Health</th>
                      <th className="px-6 py-3">Scrape</th>
                      <th className="px-6 py-3">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--kr-gov-border-light)]">
                    {data.prometheusTargets.map((target) => (
                      <tr key={`${target.job}-${target.instance}`}>
                        <td className="px-6 py-4 font-bold">{target.job}</td>
                        <td className="px-6 py-4">{target.instance}</td>
                        <td className="px-6 py-4"><StatusBadge value={target.health === "up" ? "up" : "down"} label={target.health} /></td>
                        <td className="px-6 py-4">{target.lastScrape}</td>
                        <td className="px-6 py-4">{target.lastError || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {data.tableStats.length > 0 && (
              <section className="gov-card mb-6">
                <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                  <h2 className="text-lg font-black">{en ? "Largest / Active Tables" : "주요 테이블 상태"}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">
                      <tr>
                        <th className="px-6 py-3">Table</th>
                        <th className="px-6 py-3">Live Rows</th>
                        <th className="px-6 py-3">Dead Rows</th>
                        <th className="px-6 py-3">Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--kr-gov-border-light)]">
                      {data.tableStats.map((table) => (
                        <tr key={table.name}>
                          <td className="px-6 py-4 font-bold">{table.name}</td>
                          <td className="px-6 py-4">{formatNumber(table.liveRows)}</td>
                          <td className="px-6 py-4">{formatNumber(table.deadRows)}</td>
                          <td className="px-6 py-4">{formatBytes(table.sizeBytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="gov-card">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h2 className="text-lg font-black">{en ? "External Monitoring" : "외부 모니터링"}</h2>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-3">
                  <a href="http://172.16.1.232:30300/d/postgres-db-monitoring/postgresql-database-monitoring" target="_blank" rel="noopener noreferrer" className="gov-btn gov-btn-outline">
                    {en ? "Open in Grafana" : "Grafana에서 열기"} →
                  </a>
                  <a href="http://172.16.1.232:30900" target="_blank" rel="noopener noreferrer" className="gov-btn gov-btn-outline">
                    {en ? "Prometheus Console" : "Prometheus 콘솔"} →
                  </a>
                  <a href="http://172.16.1.232:30300" target="_blank" rel="noopener noreferrer" className="gov-btn gov-btn-outline">
                    {en ? "Grafana Home" : "Grafana 홈"} →
                  </a>
                </div>
              </div>
            </section>

            {showGrafana && (
              <section className="gov-card mt-6">
                <div className="flex items-center justify-between border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                  <h2 className="text-lg font-black">{en ? "Grafana Dashboard" : "Grafana 대시보드"}</h2>
                  <button className="gov-btn gov-btn-outline text-sm" onClick={() => setShowGrafana(false)}>
                    {en ? "Collapse" : "접기"}
                  </button>
                </div>
                <div className="p-4">
                  <GrafanaEmbed url={grafanaUrl} />
                </div>
              </section>
            )}
          </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export const Component = DbMonitoringPage;
export const loader = undefined;
