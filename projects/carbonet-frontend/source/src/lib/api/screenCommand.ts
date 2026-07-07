function normalizeChainValues(values: string[] | undefined, fallback: string) {
  const normalized = (values || []).map((item) => item.trim()).filter(Boolean);
  if (normalized.length > 0) {
    return normalized;
  }
  return fallback.trim() ? [fallback.trim()] : [];
}

export function getScreenCommandChainValues(
  values: string[] | undefined,
  fallback: string
) {
  return normalizeChainValues(values, fallback);
}

export function getScreenCommandChainText(
  values: string[] | undefined,
  fallback: string,
  separator = " -> "
) {
  const normalized = normalizeChainValues(values, fallback);
  return normalized.length > 0 ? normalized.join(separator) : "-";
}
