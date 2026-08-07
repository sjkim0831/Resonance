export type JoinCompanyRegisterPagePayload = Record<string, unknown> & {
  membershipType?: string;
  canViewCompanyRegister?: boolean;
  canUseCompanyRegister?: boolean;
};

export type JoinCompanyStatusDetailPayload = {
  success: boolean;
  lookupHandle?: string;
  message?: string;
  result?: {
    insttId?: string;
    insttNm?: string;
    reprsntNm?: string;
    bizrno?: string;
    entrprsSeCode?: string;
    insttSttus?: string;
    rjctRsn?: string;
    rjctPnttm?: string;
    frstRegistPnttm?: string;
    lastUpdtPnttm?: string;
  };
  insttFiles?: Array<{
    fileSn?: number;
    orignlFileNm?: string;
    fileMg?: number;
    fileExtsn?: string;
    regDate?: string;
    downloadToken?: string;
  }>;
};

export type JoinCompanyReapplyResult = {
  insttId: string;
  insttNm: string;
  reprsntNm: string;
  bizrno: string;
  zip: string;
  adres: string;
  insttSttus: string;
  rjctRsn?: string;
  rjctPnttm?: string;
  entrprsSeCode?: string;
};

export type JoinCompanyReapplyFile = {
  fileSn: number;
  orignlFileNm: string;
  fileMg: number;
  fileExtsn?: string;
  regDate?: string;
};

export type JoinCompanyReapplyReceipt = {
  success: boolean;
  lookupHandle?: string;
  insttId: string;
  insttNm: string;
  bizrno: string;
  status: string;
  regDate: string;
  receipt: {
    applicationVersion: number;
    evidenceFileCount: number;
    changeHash: string;
    fileIds: string[];
    fileSha256s: string[];
  };
  message?: string;
};

export type JoinCompanyReapplyPagePayload = {
  success: boolean;
  lookupHandle?: string;
  message?: string;
  reapplyToken?: string;
  reapplyTokenExpiresInSeconds?: number;
  result?: JoinCompanyReapplyResult;
  insttFiles?: JoinCompanyReapplyFile[];
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
