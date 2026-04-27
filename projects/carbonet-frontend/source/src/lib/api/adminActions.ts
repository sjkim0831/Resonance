import {
  buildAdminApiPath,
  buildFormUrlEncoded,
  buildJsonHeaders,
  invalidateAdminPageCaches,
  postAdminJson,
  postFormData,
  postFormUrlEncoded
} from "./core";

type FrontendSessionLike = {
  csrfHeaderName: string;
  csrfToken: string;
};

type AuthorRoleProfile = {
  authorCode: string;
  displayTitle: string;
  priorityWorks: string[];
  description: string;
  memberEditVisibleYn: string;
  roleType?: string;
  baseRoleYn?: string;
  parentAuthorCode?: string;
  assignmentScope?: string;
  defaultMemberTypes?: string[];
  updatedAt?: string;
};

type CreateAuthGroupResponse = {
  success?: boolean;
  message?: string;
  authorCode: string;
};

type SaveCompanyAccountResponse = {
  success?: boolean;
  message?: string;
  errors?: string[];
  insttId: string;
};

async function postAdminAction<T extends { success?: boolean; message?: string }>(
  path: string,
  payload: unknown,
  fallbackMessage: string,
  headers?: Record<string, string>
): Promise<T> {
  const body = await postAdminJson<T>(path, payload, headers ? { headers } : undefined);
  if (!body.success) {
    throw new Error(String(body.message || fallbackMessage));
  }
  invalidateAdminPageCaches();
  return body;
}

export async function createAuthGroup(
  session: FrontendSessionLike,
  payload: {
    authorCode: string;
    authorNm: string;
    authorDc: string;
    roleCategory: string;
    insttId?: string;
  }
) {
  return postAdminAction<CreateAuthGroupResponse>(
    "/api/admin/auth-groups",
    payload,
    "Failed to create auth group",
    buildJsonHeaders(session)
  );
}

export async function saveAuthGroupFeatures(
  session: FrontendSessionLike,
  payload: {
    authorCode: string;
    roleCategory: string;
    featureCodes: string[];
  }
) {
  return postAdminAction<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/admin/auth-groups/features",
    payload,
    "Failed to save auth-group features",
    buildJsonHeaders(session)
  );
}

export async function saveAdminAuthChange(
  session: FrontendSessionLike,
  payload: {
    emplyrId: string;
    authorCode: string;
  }
) {
  return postAdminAction<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/admin/auth-change/save",
    payload,
    "Failed to save auth change",
    buildJsonHeaders(session)
  );
}

export async function saveAuthorRoleProfile(
  session: FrontendSessionLike,
  payload: {
    authorCode: string;
    roleCategory: string;
    displayTitle: string;
    priorityWorks: string[];
    description: string;
    memberEditVisibleYn: string;
    roleType?: string;
    baseRoleYn?: string;
    parentAuthorCode?: string;
    assignmentScope?: string;
    defaultMemberTypes?: string[];
  }
) {
  return postAdminAction<{
    success?: boolean;
    message?: string;
    authorCode: string;
    profile: AuthorRoleProfile;
  }>(
    "/api/admin/auth-groups/profile-save",
    payload,
    "Failed to save author role profile",
    buildJsonHeaders(session)
  );
}

export async function saveDeptRoleMapping(
  session: FrontendSessionLike,
  payload: {
    insttId: string;
    cmpnyNm: string;
    deptNm: string;
    authorCode: string;
  }
) {
  return postAdminAction<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/admin/dept-role-mapping/save",
    payload,
    "Failed to save dept mapping",
    buildJsonHeaders(session)
  );
}

export async function saveDeptRoleMember(
  session: FrontendSessionLike,
  payload: {
    insttId: string;
    entrprsMberId: string;
    authorCode: string;
  }
) {
  return postAdminAction<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/admin/dept-role-mapping/member-save",
    payload,
    "Failed to save dept member role",
    buildJsonHeaders(session)
  );
}

export async function saveMemberEdit(
  _session: FrontendSessionLike,
  payload: {
    memberId: string;
    applcntNm: string;
    applcntEmailAdres: string;
    phoneNumber: string;
    entrprsSeCode: string;
    entrprsMberSttus: string;
    authorCode: string;
    featureCodes: string[];
    zip: string;
    adres: string;
    detailAdres: string;
    marketingYn: string;
    deptNm: string;
  }
) {
  const body = await postAdminJson<{ success?: boolean; message?: string; errors?: string[] } & Record<string, unknown>>(
    "/api/admin/member/edit",
    payload,
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  if (!body.success) {
    throw new Error(String(body.message || (body.errors ? body.errors.join(", ") : "Failed to save member edit")));
  }
  invalidateAdminPageCaches();
  return body;
}

export async function saveMemberRegister(
  _session: FrontendSessionLike,
  payload: {
    memberId: string;
    applcntNm: string;
    password: string;
    passwordConfirm: string;
    applcntEmailAdres: string;
    phoneNumber: string;
    entrprsSeCode: string;
    insttId: string;
    deptNm: string;
    authorCode: string;
    zip: string;
    adres: string;
    detailAdres: string;
  }
) {
  const body = await postAdminJson<{ success?: boolean; message?: string; errors?: string[] } & Record<string, unknown>>(
    "/api/admin/member/register",
    payload,
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  if (!body.success) {
    throw new Error(String(body.message || (body.errors ? body.errors.join(", ") : "Failed to save member register")));
  }
  invalidateAdminPageCaches();
  return body;
}

export async function resetMemberPasswordAction(session: FrontendSessionLike, memberId: string) {
  const form = buildFormUrlEncoded({ memberId });
  const headers = buildJsonHeaders(session);
  delete headers["Content-Type"];
  const body = await postFormUrlEncoded<{ status?: string; errors?: string } & Record<string, unknown>>(
    "/admin/member/reset_password",
    form,
    {
      headers
    }
  );
  if (body.status !== "success") {
    throw new Error(String(body.errors || "Failed to reset password"));
  }
  invalidateAdminPageCaches();
  return body;
}

export async function saveAdminPermission(
  _session: FrontendSessionLike,
  payload: { emplyrId: string; authorCode: string; featureCodes: string[]; }
) {
  const body = await postAdminJson<{ success?: boolean; message?: string; errors?: string[] } & Record<string, unknown>>(
    "/api/admin/member/admin-account/permissions",
    payload,
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  if (!body.success) {
    throw new Error(String(body.message || (body.errors ? body.errors.join(", ") : "Failed to save admin permission")));
  }
  invalidateAdminPageCaches();
  return body;
}

export async function createAdminAccount(
  _session: FrontendSessionLike,
  payload: {
    rolePreset: string;
    adminId: string;
    adminName: string;
    password: string;
    passwordConfirm: string;
    adminEmail: string;
    phone1: string;
    phone2: string;
    phone3: string;
    deptNm: string;
    insttId: string;
    zip: string;
    adres: string;
    detailAdres: string;
    featureCodes: string[];
  }
) {
  const body = await postAdminJson<{ success?: boolean; message?: string; errors?: string[] } & Record<string, unknown>>(
    "/api/admin/member/admin-account",
    payload,
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  if (!body.success) {
    throw new Error(String(body.message || (body.errors ? body.errors.join(", ") : "Failed to create admin account")));
  }
  invalidateAdminPageCaches();
  return body;
}

export async function saveCompanyAccount(
  _session: FrontendSessionLike,
  payload: {
    insttId?: string;
    membershipType: string;
    agencyName?: string;
    representativeName?: string;
    bizRegistrationNumber?: string;
    zipCode: string;
    companyAddress: string;
    companyAddressDetail?: string;
    chargerName: string;
    chargerEmail: string;
    chargerTel: string;
    fileUploads: File[];
  }
) {
  const form = new FormData();
  if (payload.insttId) form.set("insttId", payload.insttId);
  form.set("membershipType", payload.membershipType);
  if (typeof payload.agencyName === "string") form.set("agencyName", payload.agencyName);
  if (typeof payload.representativeName === "string") form.set("representativeName", payload.representativeName);
  if (typeof payload.bizRegistrationNumber === "string") form.set("bizRegistrationNumber", payload.bizRegistrationNumber);
  form.set("zipCode", payload.zipCode);
  form.set("companyAddress", payload.companyAddress);
  form.set("companyAddressDetail", payload.companyAddressDetail || "");
  form.set("chargerName", payload.chargerName);
  form.set("chargerEmail", payload.chargerEmail);
  form.set("chargerTel", payload.chargerTel);
  payload.fileUploads.forEach((file) => form.append("fileUploads", file));

  const body = await postFormData<SaveCompanyAccountResponse>(
    buildAdminApiPath("/api/admin/member/company-account"),
    form,
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  );
  if (!body.success) {
    throw new Error(String(body.message || (body.errors ? body.errors.join(", ") : "Failed to save company account")));
  }
  invalidateAdminPageCaches();
  return body;
}

export async function submitMemberApproveAction(
  session: FrontendSessionLike,
  payload: { action: string; memberId?: string; selectedIds?: string[]; rejectReason?: string; }
) {
  return postAdminAction<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/admin/member/approve/action",
    payload,
    "Failed to approve member",
    buildJsonHeaders(session)
  );
}

export async function submitCompanyApproveAction(
  session: FrontendSessionLike,
  payload: { action: string; insttId?: string; selectedIds?: string[]; rejectReason?: string; }
) {
  return postAdminAction<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/admin/member/company-approve/action",
    payload,
    "Failed to approve company",
    buildJsonHeaders(session)
  );
}

export async function submitCertificateApproveAction(
  session: FrontendSessionLike,
  payload: { action: string; certificateId?: string; selectedIds?: string[]; rejectReason?: string; }
) {
  return postAdminAction<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/admin/certificate/approve/action",
    payload,
    "Failed to approve certificate",
    buildJsonHeaders(session)
  );
}

export async function submitTradeRejectAction(
  session: FrontendSessionLike,
  payload: { tradeId?: string; rejectReason?: string; operatorNote?: string; }
) {
  return postAdminAction<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/trade/reject/action",
    payload,
    "Failed to submit trade reject action",
    buildJsonHeaders(session)
  );
}

export async function submitTradeApproveAction(
  session: FrontendSessionLike,
  payload: { action: string; tradeId?: string; selectedIds?: string[]; rejectReason?: string; }
) {
  return postAdminAction<{ success?: boolean; message?: string } & Record<string, unknown>>(
    "/api/admin/trade/approve/action",
    payload,
    "Failed to approve trade",
    buildJsonHeaders(session)
  );
}
