export type JoinCompanyRegisterPagePayload = Record<string, unknown> & {
  membershipType?: string;
  canViewCompanyRegister?: boolean;
  canUseCompanyRegister?: boolean;
};

export type JoinCompanyStatusDetailPayload = {
  success: boolean;
  message?: string;
  result?: Record<string, unknown>;
  insttFiles?: Array<Record<string, unknown>>;
};

export type JoinCompanyReapplyPagePayload = {
  success: boolean;
  message?: string;
  result?: Record<string, unknown>;
  insttFiles?: Array<Record<string, unknown>>;
};

export type JoinSessionPayload = {
  step: number;
  joinVO: Record<string, unknown>;
  verifiedIdentity: boolean;
  requiredSessionReady: boolean;
  membershipType: string;
  canViewStep1: boolean;
  canViewStep2: boolean;
  canViewStep3: boolean;
  canViewStep4: boolean;
};
