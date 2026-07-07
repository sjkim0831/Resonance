import { submitFormUrlEncoded } from "../../lib/api/core";

export function valueOf(record: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!record) {
    return "";
  }
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && `${value}` !== "") {
      return value;
    }
  }
  return "";
}

export function stringOf(record: Record<string, unknown> | null | undefined, ...keys: string[]) {
  return String(valueOf(record, ...keys) || "");
}

export function numberOf(record: Record<string, unknown> | null | undefined, ...keys: string[]) {
  const parsed = Number(valueOf(record, ...keys));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function readRedirectedErrorMessage(response: Response) {
  if (!response.redirected || !response.url) {
    return "";
  }
  try {
    const params = new URL(response.url, window.location.origin).searchParams;
    return params.get("errorMessage") || "";
  } catch {
    return "";
  }
}

export async function submitFormRequest(form: HTMLFormElement) {
  const formData = new FormData(form);
  const body = new URLSearchParams();
  formData.forEach((value, key) => {
    body.append(key, String(value));
  });
  const response = await submitFormUrlEncoded(form.action, body, {
    method: (form.method || "post").toUpperCase()
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed: ${response.status}`);
  }

  const redirectedError = readRedirectedErrorMessage(response);
  if (redirectedError) {
    throw new Error(redirectedError);
  }

  return response;
}

export function normalizeUpper(value: string) {
  return value.trim().toUpperCase();
}
