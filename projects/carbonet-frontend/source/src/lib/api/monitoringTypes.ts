export type SystemMetrics = {
  timestamp: string;
  hostname?: {
    name: string;
    kernel?: string;
    os?: string;
    uptime_days?: number;
    uptime_hours?: number;
    uptime_mins?: number;
  };
  cpu?: {
    model?: string;
    cores?: number;
    usage_percent?: number;
    idle_percent?: number;
    user_percent?: number;
    system_percent?: number;
    iowait_percent?: number;
    physical_processors?: number;
  };
  memory?: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    available_bytes: number;
    usage_percent: number;
    swap_total_bytes?: number;
    swap_used_bytes?: number;
    swap_usage_percent?: number;
  };
  disks?: Array<{
    filesystem?: string;
    total?: string;
    used?: string;
    available?: string;
    usage_percent?: number;
    mounted?: string;
  }>;
  disk_io?: {
    tps: number;
    read_kb_s: number;
    write_kb_s: number;
    await_ms: number;
    util_percent: number;
  };
  network?: Array<{
    name: string;
    rx_bytes: number;
    tx_bytes: number;
    rx_human?: string;
    tx_human?: string;
    speed_mbps?: number;
    status?: string;
    rx_packets?: number;
    tx_packets?: number;
  }>;
  load?: {
    load_1m: number;
    load_5m: number;
    load_15m: number;
    running_processes?: string;
    total_threads?: number;
  };
  top_cpu_processes?: Array<{
    pid: number | string;
    user: string;
    cpu: number;
    mem: number;
    cmd: string;
  }>;
  top_mem_processes?: Array<{
    pid: number | string;
    user: string;
    cpu: number;
    mem: number;
    cmd: string;
  }>;
  services?: Record<string, { status: string; enabled: string }>;
  tcp_udp?: {
    tcp_established?: number;
    tcp_timewait?: number;
    udp_sockets?: number;
  };
  success?: boolean;
  error?: string;
};

export type DatabaseMetrics = {
  timestamp: string;
  database: string;
  health: string;
  server: {
    status: string;
    pid: number;
  };
  broker: {
    status: string;
  };
  tables: number;
  translation_rows: number;
  ecoinvent_rows: number;
  korean_names: number;
  success: boolean;
  error?: string;
};

export type OverviewMetrics = {
  timestamp: string;
  system: SystemMetrics;
  database: DatabaseMetrics;
  overall: {
    system: string;
    database: string;
    status: string;
  };
  success: boolean;
};

export type Alert = {
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
};

export type AlertsResponse = {
  alerts: Alert[];
  count: number;
  success: boolean;
};

export type HealthStatus = {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  checks: Record<string, unknown>;
  success: boolean;
};