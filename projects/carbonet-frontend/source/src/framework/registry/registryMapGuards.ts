export function setUniqueRegistryValue<TValue>(
  registry: Map<string, TValue>,
  path: string,
  value: TValue,
  duplicateMessage: string
) {
  if (registry.has(path)) {
    throw new Error(duplicateMessage);
  }
  registry.set(path, value);
}

export function setCompatibleRegistryValue<TValue>(
  registry: Map<string, TValue>,
  path: string,
  value: TValue,
  conflictMessage: string
) {
  const existingValue = registry.get(path);
  if (existingValue !== undefined && existingValue !== value) {
    throw new Error(conflictMessage);
  }
  registry.set(path, value);
}

export function getNormalizedRegistryValue<TValue>(
  registry: Map<string, TValue>,
  path: string,
  normalizePath: (value: string) => string
) {
  return registry.get(normalizePath(path)) || null;
}
