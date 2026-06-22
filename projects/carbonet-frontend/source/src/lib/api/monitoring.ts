import { fetchJson, buildLocalizedPath } from './core';
import type { SystemMetrics } from './monitoringTypes';

export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  return fetchJson<SystemMetrics>(buildLocalizedPath(
    '/admin/api/monitoring/system',
    '/en/admin/api/monitoring/system'
  ));
}