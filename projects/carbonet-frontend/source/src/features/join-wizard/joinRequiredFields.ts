export type JoinRequiredFieldKey =
  | "mberId" | "password" | "passwordConfirm" | "mberNm"
  | "moblphonNo1" | "moblphonNo2" | "moblphonNo3"
  | "applcntEmailAdres" | "zip" | "adres" | "insttId" | "insttNm"
  | "bizrno" | "representativeName" | "fileUploads";

type RequiredFieldSpec = {
  key: JoinRequiredFieldKey;
  elementId: string;
  label: { ko: string; en: string };
};

export const JOIN_STEP4_REQUIRED_FIELDS: readonly RequiredFieldSpec[] = [
  { key: "mberId", elementId: "user-id", label: { ko: "아이디", en: "User ID" } },
  { key: "password", elementId: "password", label: { ko: "비밀번호", en: "Password" } },
  { key: "passwordConfirm", elementId: "password-confirm", label: { ko: "비밀번호 확인", en: "Confirm Password" } },
  { key: "mberNm", elementId: "user-name", label: { ko: "이름", en: "Name" } },
  { key: "moblphonNo1", elementId: "phone-1", label: { ko: "전화번호 앞자리", en: "Phone prefix" } },
  { key: "moblphonNo2", elementId: "phone-2", label: { ko: "전화번호 중간자리", en: "Phone middle digits" } },
  { key: "moblphonNo3", elementId: "phone-3", label: { ko: "전화번호 끝자리", en: "Phone last digits" } },
  { key: "applcntEmailAdres", elementId: "email", label: { ko: "이메일", en: "Email address" } },
  { key: "zip", elementId: "zip-code", label: { ko: "우편번호", en: "Zip code" } },
  { key: "adres", elementId: "user-address", label: { ko: "주소", en: "Address" } },
  { key: "insttId", elementId: "company-search", label: { ko: "소속 기관", en: "Organization" } },
  { key: "insttNm", elementId: "company-search", label: { ko: "기관명", en: "Organization name" } },
  { key: "bizrno", elementId: "biz-number", label: { ko: "사업자등록번호", en: "Business registration number" } },
  { key: "representativeName", elementId: "representative-name", label: { ko: "대표자명", en: "Representative name" } },
  { key: "fileUploads", elementId: "file-input-1", label: { ko: "증빙 서류", en: "Supporting document" } }
] as const;

export function findMissingJoinStep4Fields(values: Partial<Record<JoinRequiredFieldKey, unknown>>, uploadedFileCount: number): JoinRequiredFieldKey[] {
  return JOIN_STEP4_REQUIRED_FIELDS.filter(({ key }) => {
    if (key === "fileUploads") return uploadedFileCount < 1;
    const value = values[key];
    return value == null || String(value).trim().length === 0;
  }).map(({ key }) => key);
}

export function requiredFieldLabel(key: JoinRequiredFieldKey, english: boolean) {
  const spec = JOIN_STEP4_REQUIRED_FIELDS.find((field) => field.key === key);
  return spec?.label[english ? "en" : "ko"] ?? key;
}

export function focusFirstMissingJoinField(keys: readonly JoinRequiredFieldKey[]) {
  const spec = JOIN_STEP4_REQUIRED_FIELDS.find((field) => keys.includes(field.key));
  if (!spec) return;
  window.requestAnimationFrame(() => {
    const element = document.getElementById(spec.elementId);
    element?.focus();
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
