import { fetchJson, buildAdminApiPath } from './core';
import type { SystemMetrics } from './monitoringTypes';

export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  return fetchJson<SystemMetrics>(buildAdminApiPath(
    '/api/monitoring/system'
  ));
}