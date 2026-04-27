import {
  buildFormUrlEncoded,
  fetchJsonWithResponse,
  postFormUrlEncodedWithResponse
} from "./core";
import type { MypagePayload, MypageSectionPayload } from "./portalTypes";

type MypageContext = {
  insttId?: string;
};

type PortalSession = {
  csrfHeaderName?: string;
  csrfToken?: string;
  insttId?: string;
};

type PortalFormPayload = Record<string, string>;
type PortalHeaders = Record<string, string>;
type MypageSettingKey = "marketing" | "profile" | "company" | "staff" | "email" | "password";

type MypageActionResponse = MypageSectionPayload & {
  message?: string;
};

let mypageContextCache: MypageContext | null = null;
let mypageContextPromise: Promise<MypageContext> | null = null;

const PORTAL_ERROR_MESSAGES = {
  context: "Failed to load mypage context",
  mypage: "Failed to load mypage",
  mypageSection: "Failed to load mypage section",
  marketing: "Failed to save marketing setting",
  profile: "Failed to save profile setting",
  company: "Failed to save company setting",
  staff: "Failed to save staff setting",
  email: "Failed to save email setting",
  password: "Failed to save password setting"
} as const;

function isPortalResponseAccepted(response: Response) {
  return response.ok || response.status === 401;
}

function isEnglishPortalPath(path: string) {
  return path.startsWith("/api/en/");
}

function buildPortalPath(koPath: string, enPath: string, en = false) {
  return en ? enPath : koPath;
}

function buildMypagePath(path = "", en = false) {
  return buildPortalPath(`/api/mypage${path}`, `/api/en/mypage${path}`, en);
}

function buildMypageSectionPath(section: string, en = false) {
  return buildMypagePath(`/section/${encodeURIComponent(section)}`, en);
}

function buildMypageSettingPath(setting: string, en = false) {
  return buildMypagePath(`/${setting}`, en);
}

export function invalidatePortalContextCache() {
  mypageContextCache = null;
  mypageContextPromise = null;
}

async function fetchMypageContext(en = false): Promise<MypageContext> {
  if (mypageContextCache) {
    return mypageContextCache;
  }

  if (!mypageContextPromise) {
    mypageContextPromise = fetchJsonWithResponse<MypageContext>(buildMypagePath("/context", en))
      .then(({ response, body: context }) => {
        if (!isPortalResponseAccepted(response)) {
          throw new Error(`${PORTAL_ERROR_MESSAGES.context}: ${response.status}`);
        }
        mypageContextCache = context;
        return context;
      })
      .finally(() => {
        mypageContextPromise = null;
      });
  }

  if (!mypageContextPromise) {
    throw new Error("Mypage context promise was not initialized");
  }

  return mypageContextPromise;
}

function appendInsttId(search: URLSearchParams, insttId?: string) {
  const normalizedInsttId = String(insttId || "").trim();
  if (normalizedInsttId) {
    search.set("instt_id", normalizedInsttId);
  }
  return search;
}

function buildPortalForm(
  payload: PortalFormPayload,
  insttId?: string
) {
  return appendInsttId(buildFormUrlEncoded(payload), insttId);
}

function buildPortalQuery(insttId?: string) {
  return appendInsttId(buildFormUrlEncoded(), insttId);
}

async function buildMypageUrl(path: string) {
  const context = await fetchMypageContext(isEnglishPortalPath(path)).catch(() => null);
  const search = buildPortalQuery(context?.insttId);
  return search.toString() ? `${path}?${search.toString()}` : path;
}

function buildPortalHeaders(session: PortalSession): PortalHeaders {
  const headers: PortalHeaders = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest"
  };
  if (session.csrfHeaderName && session.csrfToken) {
    headers[session.csrfHeaderName] = session.csrfToken;
  }
  return headers;
}

function resolvePortalInsttId(session: PortalSession, insttId?: string) {
  return insttId || session.insttId;
}

async function saveMypageSectionPayload(
  session: PortalSession,
  path: string,
  payload: PortalFormPayload,
  fallbackMessage: string,
  insttId?: string
) {
  const { response, body } = await postFormUrlEncodedWithResponse<MypageActionResponse>(
    path,
    buildPortalForm(payload, resolvePortalInsttId(session, insttId)),
    { headers: buildPortalHeaders(session) }
  );
  if (!isPortalResponseAccepted(response)) {
    throw new Error(body.message || `${fallbackMessage}: ${response.status}`);
  }
  return body;
}

function saveMypageSetting(
  session: PortalSession,
  setting: MypageSettingKey,
  payload: PortalFormPayload,
  fallbackMessage: string,
  en = false,
  insttId?: string
) {
  return saveMypageSectionPayload(
    session,
    buildMypageSettingPath(setting, en),
    payload,
    fallbackMessage,
    insttId
  );
}

async function fetchMypagePayload<T>(
  path: string,
  fallbackMessage: string
) {
  const { response, body } = await fetchJsonWithResponse<T>(await buildMypageUrl(path));
  if (!isPortalResponseAccepted(response)) {
    throw new Error(`${fallbackMessage}: ${response.status}`);
  }
  return body;
}

export async function fetchMypage(en = false) {
  return fetchMypagePayload<MypagePayload>(
    buildMypagePath("", en),
    PORTAL_ERROR_MESSAGES.mypage
  );
}

export async function fetchMypageSection(section: string, en = false) {
  return fetchMypagePayload<MypageSectionPayload>(
    buildMypageSectionPath(section, en),
    PORTAL_ERROR_MESSAGES.mypageSection
  );
}

export async function saveMypageMarketing(session: PortalSession, marketingYn: string, en = false, insttId?: string) {
  return saveMypageSetting(
    session,
    "marketing",
    { marketingYn },
    PORTAL_ERROR_MESSAGES.marketing,
    en,
    insttId
  );
}

export async function saveMypageProfile(
  session: PortalSession,
  payload: { zip: string; address: string; detailAddress: string },
  en = false,
  insttId?: string
) {
  return saveMypageSetting(
    session,
    "profile",
    payload,
    PORTAL_ERROR_MESSAGES.profile,
    en,
    insttId
  );
}

export async function saveMypageCompany(
  session: PortalSession,
  payload: { companyName: string; representativeName: string; zip: string; address: string; detailAddress: string },
  en = false,
  insttId?: string
) {
  return saveMypageSetting(
    session,
    "company",
    payload,
    PORTAL_ERROR_MESSAGES.company,
    en,
    insttId
  );
}

export async function saveMypageStaff(
  session: PortalSession,
  payload: { staffName: string; deptNm: string; areaNo: string; middleTelno: string; endTelno: string },
  en = false,
  insttId?: string
) {
  return saveMypageSetting(
    session,
    "staff",
    payload,
    PORTAL_ERROR_MESSAGES.staff,
    en,
    insttId
  );
}

export async function saveMypageEmail(session: PortalSession, email: string, en = false, insttId?: string) {
  return saveMypageSetting(
    session,
    "email",
    { email },
    PORTAL_ERROR_MESSAGES.email,
    en,
    insttId
  );
}

export async function saveMypagePassword(session: PortalSession, currentPassword: string, newPassword: string, en = false, insttId?: string) {
  return saveMypageSetting(
    session,
    "password",
    { currentPassword, newPassword },
    PORTAL_ERROR_MESSAGES.password,
    en,
    insttId
  );
}
