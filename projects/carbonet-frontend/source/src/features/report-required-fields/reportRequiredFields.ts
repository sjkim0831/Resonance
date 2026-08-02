export type ReportRequiredField = {
  key: string;
  label: string;
  value: unknown;
  elementId?: string;
  valid?: (value: unknown) => boolean;
};

export function findMissingReportFields(fields: readonly ReportRequiredField[]) {
  return fields.filter((field) => {
    if (field.valid) return !field.valid(field.value);
    if (field.value == null) return true;
    if (typeof field.value === "boolean") return !field.value;
    if (typeof field.value === "number") return !Number.isFinite(field.value);
    return String(field.value).trim().length === 0;
  });
}

export function focusFirstMissingReportField(fields: readonly ReportRequiredField[]) {
  const first = fields.find((field) => field.elementId);
  if (!first?.elementId) return;
  window.requestAnimationFrame(() => {
    const element = document.getElementById(first.elementId!);
    element?.focus();
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export function validateReportRequiredFields(fields: readonly ReportRequiredField[]) {
  const missing = findMissingReportFields(fields);
  focusFirstMissingReportField(missing);
  return missing;
}

export function reportRequiredErrorClass(missingKeys: readonly string[], key: string) {
  return missingKeys.includes(key) ? " border-red-500 ring-2 ring-red-100" : "";
}
