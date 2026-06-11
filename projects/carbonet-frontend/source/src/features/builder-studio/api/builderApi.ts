import type { BuilderComponent, BuilderScreen, BuilderTheme, BuilderNode } from '../types/builder';

const API_BASE = '/api/platform/builder';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getComponents(params?: {
  type?: string;
  category?: string;
  activeOnly?: boolean;
}): Promise<{ components: BuilderComponent[]; count: number }> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.activeOnly !== undefined) searchParams.set('activeOnly', String(params.activeOnly));
  const query = searchParams.toString();
  return fetchJson(`${API_BASE}/components${query ? `?${query}` : ''}`);
}

export async function getComponent(componentId: string): Promise<{ component: BuilderComponent }> {
  return fetchJson(`${API_BASE}/components/${componentId}`);
}

export async function createComponent(component: Partial<BuilderComponent>): Promise<{ component: BuilderComponent }> {
  return fetchJson(`${API_BASE}/components`, {
    method: 'POST',
    body: JSON.stringify(component),
  });
}

export async function updateComponent(
  componentId: string,
  component: Partial<BuilderComponent>
): Promise<{ component: BuilderComponent }> {
  return fetchJson(`${API_BASE}/components/${componentId}`, {
    method: 'PUT',
    body: JSON.stringify(component),
  });
}

export async function deleteComponent(componentId: string): Promise<{ message: string }> {
  return fetchJson(`${API_BASE}/components/${componentId}`, { method: 'DELETE' });
}

export async function getScreens(status?: string): Promise<{ screens: BuilderScreen[]; count: number }> {
  const query = status ? `?status=${status}` : '';
  return fetchJson(`${API_BASE}/screens${query}`);
}

export async function getScreen(screenId: string): Promise<{ screen: BuilderScreen }> {
  return fetchJson(`${API_BASE}/screens/${screenId}`);
}

export async function getScreenByMenuCode(menuCode: string): Promise<{ screen: BuilderScreen }> {
  return fetchJson(`${API_BASE}/screens/by-menu/${menuCode}`);
}

export async function createScreen(screen: Partial<BuilderScreen>): Promise<{ screen: BuilderScreen }> {
  return fetchJson(`${API_BASE}/screens`, {
    method: 'POST',
    body: JSON.stringify(screen),
  });
}

export async function updateScreen(
  screenId: string,
  screen: Partial<BuilderScreen>
): Promise<{ screen: BuilderScreen }> {
  return fetchJson(`${API_BASE}/screens/${screenId}`, {
    method: 'PUT',
    body: JSON.stringify(screen),
  });
}

export async function deleteScreen(screenId: string): Promise<{ message: string }> {
  return fetchJson(`${API_BASE}/screens/${screenId}`, { method: 'DELETE' });
}

export async function publishScreen(screenId: string): Promise<{ screen: BuilderScreen }> {
  return fetchJson(`${API_BASE}/screens/${screenId}/publish`, { method: 'POST' });
}

export async function duplicateScreen(
  screenId: string,
  newMenuCode: string,
  newMenuTitle: string
): Promise<{ screen: BuilderScreen }> {
  return fetchJson(`${API_BASE}/screens/${screenId}/duplicate?newMenuCode=${newMenuCode}&newMenuTitle=${encodeURIComponent(newMenuTitle)}`, {
    method: 'POST',
  });
}

export async function getScreenNodes(screenId: string): Promise<{ nodes: BuilderNode[]; count: number }> {
  return fetchJson(`${API_BASE}/screens/${screenId}/nodes`);
}

export async function addNodeToScreen(
  screenId: string,
  node: Partial<BuilderNode>
): Promise<{ node: BuilderNode }> {
  return fetchJson(`${API_BASE}/screens/${screenId}/nodes`, {
    method: 'POST',
    body: JSON.stringify(node),
  });
}

export async function updateNode(
  screenId: string,
  nodeId: string,
  node: Partial<BuilderNode>
): Promise<{ node: BuilderNode }> {
  return fetchJson(`${API_BASE}/screens/${screenId}/nodes/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify(node),
  });
}

export async function removeNode(screenId: string, nodeId: string): Promise<{ message: string }> {
  return fetchJson(`${API_BASE}/screens/${screenId}/nodes/${nodeId}`, { method: 'DELETE' });
}

export async function getScreenPreview(screenId: string): Promise<{ previewHtml: string; screenId: string }> {
  return fetchJson(`${API_BASE}/screens/${screenId}/preview`);
}

export async function getThemes(): Promise<{ themes: BuilderTheme[]; count: number }> {
  return fetchJson(`${API_BASE}/themes`);
}

export async function getComponentTypes(): Promise<{ types: Array<{ code: string; label: string }> }> {
  return fetchJson(`${API_BASE}/component-types`);
}

export async function getCategories(): Promise<{ categories: Array<{ code: string; label: string }> }> {
  return fetchJson(`${API_BASE}/categories`);
}

export async function healthCheck(): Promise<{ status: string; timestamp: number }> {
  return fetchJson(`${API_BASE}/health`);
}