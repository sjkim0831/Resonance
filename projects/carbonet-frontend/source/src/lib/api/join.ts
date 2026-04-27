import { buildQueryString, fetchPageJson, fetchTextWithResponse, fetchValidatedJson, postFormDataWithResponse } from "./core";
import { invalidateJoinSessionCache } from "./joinSession";
import type {
  JoinCompanyReapplyPagePayload,
  JoinCompanyRegisterPagePayload,
  JoinCompanyStatusDetailPayload
} from "./joinTypes";

type CompanySearchPayload = {
  list: Array<{
    insttId: string;
    cmpnyNm: string;
    bizrno: string;
    cxfc: string;
    joinStat: string;
    entrprsSeCode: string;
  }>;
  totalCnt: number;
  page: number;
  size: number;
  totalPages: number;
};

type DuplicateFlagResponse = {
  isDuplicated?: boolean;
  duplicated?: boolean;
};

type JoinQueryParams = Record<string, string | number | boolean | null | undefined>;
type JoinActionResponse = { success?: boolean; message?: string } & Record<string, unknown>;
type JoinValidatedResponse = { message?: string; success?: boolean };

type JoinCompanyRegisterSubmitPayload = {
  membershipType: string;
  agencyName: string;
  representativeName: string;
  bizRegistrationNumber: string;
  zipCode: string;
  companyAddress: string;
  companyAddressDetail?: string;
  chargerName: string;
  chargerEmail: string;
  chargerTel: string;
  lang?: string;
  fileUploads: File[];
};

function buildJoinUrl(path: string, params?: JoinQueryParams) {
  return `${path}${buildQueryString(params)}`;
}

function appendJoinFormFields(form: FormData, payload: Record<string, string | undefined>) {
  Object.entries(payload).forEach(([key, value]) => {
    form.set(key, value ?? "");
  });
  return form;
}

function buildJoinCompanyRegisterForm(payload: JoinCompanyRegisterSubmitPayload): FormData {
  const form = new FormData();
  appendJoinFormFields(form, {
    membershipType: payload.membershipType,
    agencyName: payload.agencyName,
    representativeName: payload.representativeName,
    bizRegistrationNumber: payload.bizRegistrationNumber,
    zipCode: payload.zipCode,
    companyAddress: payload.companyAddress,
    companyAddressDetail: payload.companyAddressDetail,
    chargerName: payload.chargerName,
    chargerEmail: payload.chargerEmail,
    chargerTel: payload.chargerTel,
    lang: payload.lang || "ko"
  });
  payload.fileUploads.forEach((file) => form.append("fileUploads", file));
  return form;
}

async function submitJoinMultipartForm(
  path: string,
  form: FormData,
  fallbackMessage: string
) {
  invalidateJoinSessionCache();
  const { response, body } = await postFormDataWithResponse<JoinActionResponse>(
    path,
    form
  );
  if (!response.ok || !body.success) {
    throw new Error(body.message || `${fallbackMessage}: ${response.status}`);
  }
  return body;
}

async function fetchDuplicateFlag(
  path: string,
  params: JoinQueryParams,
  fallbackMessage: string
): Promise<boolean> {
  const body = await fetchPageJson<DuplicateFlagResponse>(buildJoinUrl(path, params), {
    fallbackMessage
  });
  return Boolean(body.isDuplicated ?? body.duplicated);
}

async function fetchNumericDuplicateFlag(
  path: string,
  params: JoinQueryParams,
  fallbackMessage: string
): Promise<boolean> {
  const { response, body } = await fetchTextWithResponse(buildJoinUrl(path, params));
  if (!response.ok) {
    throw new Error(`${fallbackMessage}: ${response.status}`);
  }
  return Number(body) > 0;
}

async function fetchJoinJson<T>(
  path: string,
  fallbackMessage: string,
  params?: JoinQueryParams
): Promise<T> {
  return fetchPageJson<T>(buildJoinUrl(path, params), {
    fallbackMessage
  });
}

async function fetchValidatedJoinJson<T extends JoinValidatedResponse>(
  path: string,
  params: JoinQueryParams,
  fallbackMessage: string
) {
  return fetchValidatedJson<T>(buildJoinUrl(path, params), {
    fallbackMessage,
    resolveError: (body, status) => body.message || `${fallbackMessage}: ${status}`,
    validate: (body) => body.success !== false
  });
}

export async function searchJoinCompanies(params: {
  keyword: string;
  page?: number;
  size?: number;
  status?: string;
  membershipType?: string;
}) {
  return fetchJoinJson<CompanySearchPayload>(
    "/join/searchCompany",
    "Failed to search join companies",
    params
  );
}

export async function checkJoinMemberId(mberId: string) {
  return {
    isDuplicated: await fetchDuplicateFlag(
      "/join/checkId",
      { mberId },
      "Failed to check join member ID"
    )
  };
}

export async function checkJoinEmail(email: string) {
  return {
    isDuplicated: await fetchDuplicateFlag(
      "/join/checkEmail",
      { email },
      "Failed to check join email"
    )
  };
}

export async function fetchJoinCompanyRegisterPage() {
  return fetchJoinJson<JoinCompanyRegisterPagePayload>(
    "/join/api/company-register/page",
    "Failed to load join company register page"
  );
}

export async function checkCompanyNameDuplicate(agencyName: string) {
  return fetchNumericDuplicateFlag(
    "/join/checkCompanyNameDplct",
    { agencyName },
    "Failed to check company name"
  );
}

export async function fetchJoinCompanyStatusDetail(params: { bizNo?: string; appNo?: string; repName: string; }) {
  return fetchValidatedJoinJson<JoinCompanyStatusDetailPayload>(
    "/join/api/company-status/detail",
    params,
    "Failed to load company status detail"
  );
}

export async function fetchJoinCompanyReapplyPage(params: { bizNo: string; repName: string; }) {
  return fetchValidatedJoinJson<JoinCompanyReapplyPagePayload>(
    "/join/api/company-reapply/page",
    params,
    "Failed to load company reapply page"
  );
}

export async function submitJoinCompanyRegister(payload: JoinCompanyRegisterSubmitPayload) {
  return submitJoinMultipartForm(
    "/join/api/company-register",
    buildJoinCompanyRegisterForm(payload),
    "Failed to submit company register"
  );
}
