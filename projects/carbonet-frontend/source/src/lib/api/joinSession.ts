import { buildFormUrlEncoded, fetchJsonWithResponse, postFormDataWithResponse, postFormUrlEncoded, postJson } from "./core";
import type { JoinSessionPayload } from "./joinTypes";

let joinSessionCache: JoinSessionPayload | null = null;
let joinSessionPromise: Promise<JoinSessionPayload> | null = null;

type JoinStep4SubmitPayload = {
  membershipType?: string;
  mberId: string;
  password: string;
  mberNm: string;
  insttNm: string;
  insttId: string;
  representativeName: string;
  bizrno: string;
  zip: string;
  adres: string;
  detailAdres?: string;
  deptNm?: string;
  moblphonNo1: string;
  moblphonNo2: string;
  moblphonNo3: string;
  applcntEmailAdres: string;
  fileUploads: File[];
};

type JoinCompanyReapplySubmitPayload = {
  insttId: string;
  agencyName: string;
  representativeName: string;
  bizRegistrationNumber: string;
  zipCode: string;
  companyAddress: string;
  companyAddressDetail?: string;
  chargerName: string;
  chargerEmail: string;
  chargerTel: string;
  fileUploads: File[];
};

type JoinActionResponse = { success?: boolean; message?: string } & Record<string, unknown>;
type JoinFormFieldPayload = Record<string, string | undefined>;
type JoinStepPayload = Record<string, string>;

function appendFormFields(form: FormData, payload: JoinFormFieldPayload) {
  Object.entries(payload).forEach(([key, value]) => {
    form.set(key, value ?? "");
  });
  return form;
}

function buildJoinStep4Form(payload: JoinStep4SubmitPayload): FormData {
  const form = new FormData();
  appendFormFields(
    form,
    Object.fromEntries(
      Object.entries(payload)
        .filter(([key]) => key !== "fileUploads")
        .map(([key, value]) => [key, String(value ?? "")])
    )
  );
  payload.fileUploads.forEach((file) => form.append("fileUploads", file));
  return form;
}

function buildJoinCompanyReapplyForm(payload: JoinCompanyReapplySubmitPayload): FormData {
  const form = new FormData();
  appendFormFields(form, {
    insttId: payload.insttId,
    agencyName: payload.agencyName,
    representativeName: payload.representativeName,
    bizRegistrationNumber: payload.bizRegistrationNumber,
    zipCode: payload.zipCode,
    companyAddress: payload.companyAddress,
    companyAddressDetail: payload.companyAddressDetail,
    chargerName: payload.chargerName,
    chargerEmail: payload.chargerEmail,
    chargerTel: payload.chargerTel
  });
  payload.fileUploads.forEach((file) => form.append("fileUploads", file));
  return form;
}

async function submitJoinForm(
  path: string,
  form: FormData,
  fallbackMessage: string
) {
  invalidateJoinSessionCache();
  const { response, body } = await postFormDataWithResponse<JoinActionResponse>(
    path,
    form
  );
  if (!response.ok || !body.success) throw new Error(body.message || `${fallbackMessage}: ${response.status}`);
  return body;
}

async function postJoinStep(
  path: string,
  payload: JoinStepPayload,
  fallbackMessage: string
) {
  invalidateJoinSessionCache();
  const body = await postFormUrlEncoded<JoinActionResponse>(
    path,
    buildFormUrlEncoded(payload)
  );
  if (!body.success) throw new Error(body.message || fallbackMessage);
  return body;
}

export function invalidateJoinSessionCache() {
  joinSessionCache = null;
  joinSessionPromise = null;
}

export async function fetchJoinSession(): Promise<JoinSessionPayload> {
  if (joinSessionCache) {
    return joinSessionCache;
  }

  if (!joinSessionPromise) {
    joinSessionPromise = fetchJsonWithResponse<JoinSessionPayload>("/join/api/session")
      .then(({ response, body: session }) => {
        if (!response.ok) throw new Error(`Failed to load join session: ${response.status}`);
        joinSessionCache = session;
        return session;
      })
      .finally(() => {
        joinSessionPromise = null;
      });
  }

  if (!joinSessionPromise) {
    throw new Error("Join session promise was not initialized");
  }

  return joinSessionPromise;
}

export async function resetJoinSession() {
  invalidateJoinSessionCache();
  return postJson<{ success: boolean }>("/join/api/reset", {});
}

export async function saveJoinStep1(membershipType: string) {
  return postJoinStep("/join/api/step1", { membership_type: membershipType }, "Failed to save join step1");
}

export async function saveJoinStep2(marketingYn: string) {
  return postJoinStep("/join/api/step2", { marketing_yn: marketingYn }, "Failed to save join step2");
}

export async function saveJoinStep3(authMethod: string) {
  return postJoinStep("/join/api/step3", { auth_method: authMethod }, "Failed to save join step3");
}

export async function submitJoinStep4(payload: JoinStep4SubmitPayload) {
  return submitJoinForm(
    "/join/api/step4/submit",
    buildJoinStep4Form(payload),
    "Failed to submit join step4"
  );
}

export async function submitJoinCompanyReapply(payload: JoinCompanyReapplySubmitPayload) {
  return submitJoinForm(
    "/join/api/company-reapply",
    buildJoinCompanyReapplyForm(payload),
    "Failed to submit company reapply"
  );
}
