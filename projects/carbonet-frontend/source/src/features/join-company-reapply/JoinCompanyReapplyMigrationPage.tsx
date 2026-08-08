import { ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { useExternalScript } from "../../app/hooks/useExternalScript";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getSearchParam, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  fetchJoinCompanyReapplyPage
} from "../../lib/api/join";
import {
  resetJoinSession,
  submitJoinCompanyReapply
} from "../../lib/api/joinSession";
import type {
  JoinCompanyReapplyPagePayload,
  JoinCompanyReapplyReceipt,
  JoinCompanyReapplyResult
} from "../../lib/api/joinTypes";
import { HomeButton, HomeIconButton, HomeInput, HomeLinkButton } from "../home-ui/common";

type UploadRow = {
  id: string;
  file: File | null;
};

type ReapplyForm = {
  reapplyToken: string;
  insttId: string;
  agencyName: string;
  representativeName: string;
  bizRegistrationNumber: string;
  zipCode: string;
  companyAddress: string;
  companyAddressDetail: string;
  chargerName: string;
  chargerEmail: string;
  chargerTel: string;
};

type ReapplyFieldErrorKey =
  | "lookupBizNo"
  | "lookupRepName"
  | "registeredContact"
  | "chargerName"
  | "chargerEmail"
  | "chargerTel"
  | "agencyName"
  | "representativeName"
  | "companyAddress"
  | "applicantResponse"
  | "fileUploads";

const EMPTY_FORM: ReapplyForm = {
  reapplyToken: "",
  insttId: "",
  agencyName: "",
  representativeName: "",
  bizRegistrationNumber: "",
  zipCode: "",
  companyAddress: "",
  companyAddressDetail: "",
  chargerName: "",
  chargerEmail: "",
  chargerTel: ""
};

const ACCEPTED_FILE_TYPES = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 10;
const GOV_SYMBOL_PATH = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK_PATH = "/img/egovframework/kr_gov_symbol.svg";
const FIELD_ELEMENT_IDS: Record<Exclude<ReapplyFieldErrorKey, "fileUploads">, string> = {
  lookupBizNo: "lookup-bizNo",
  lookupRepName: "lookup-repName",
  registeredContact: "lookup-registeredContact",
  chargerName: "charger-name",
  chargerEmail: "charger-email",
  chargerTel: "charger-tel",
  agencyName: "company-name",
  representativeName: "rep-name",
  companyAddress: "zip-code",
  applicantResponse: "applicant-response"
};
const FIELD_ERROR_ORDER: ReapplyFieldErrorKey[] = [
  "lookupBizNo",
  "lookupRepName",
  "registeredContact",
  "chargerName",
  "chargerEmail",
  "chargerTel",
  "agencyName",
  "representativeName",
  "companyAddress",
  "applicantResponse",
  "fileUploads"
];

function createUploadRow(): UploadRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file: null
  };
}

function resolveInitialLookup() {
  const params = new URLSearchParams(window.location.search);
  return {
    lookupHandle: params.get("lookupHandle") || ""
  };
}

function fileSizeLabel(size: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function JoinCompanyReapplyMigrationPage() {
  const en = isEnglish();
  const [initialLookup] = useState(resolveInitialLookup);
  const [bizNo, setBizNo] = useState("");
  const [repName, setRepName] = useState("");
  const [registeredContact, setRegisteredContact] = useState("");
  const [lookupHandle, setLookupHandle] = useState(initialLookup.lookupHandle);
  const [form, setForm] = useState<ReapplyForm>(EMPTY_FORM);
  const [applicantResponse, setApplicantResponse] = useState("");
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([createUploadRow()]);
  const [actionError, setActionError] = useState(() => getSearchParam("errorMessage"));
  const [pageError, setPageError] = useState("");
  const [message, setMessage] = useState(() => getSearchParam("message"));
  const [page, setPage] = useState<JoinCompanyReapplyPagePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<JoinCompanyReapplyReceipt | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ReapplyFieldErrorKey, string>>>({});
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const fileInputPrefix = useId();
  const error = actionError || pageError;

  useExternalScript("//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js");

  useEffect(() => {
    if (!initialLookup.lookupHandle) return;
    void handleLookup(initialLookup.lookupHandle);
  }, []);

  useEffect(() => {
    logGovernanceScope("PAGE", "join-company-reapply", {
      language: en ? "en" : "ko",
      lookupBizNoPresent: Boolean(bizNo.trim()),
      lookupRepresentativePresent: Boolean(repName.trim()),
      lookupRegisteredContactPresent: Boolean(registeredContact.trim()),
      institutionSelected: Boolean(form.insttId),
      uploadRowCount: uploadRows.length,
      loading,
      submitting,
      submitted,
      receiptPresent: Boolean(receipt),
      reapplyTokenPresent: Boolean(form.reapplyToken)
    });
    logGovernanceScope("COMPONENT", "join-company-reapply-files", {
      uploadRowCount: uploadRows.length,
      selectedFileCount: uploadRows.filter((row) => row.file).length,
      dragTargetId
    });
  }, [
    bizNo,
    dragTargetId,
    en,
    form.insttId,
    loading,
    repName,
    registeredContact,
    receipt,
    submitting,
    submitted,
    uploadRows
  ]);

  useEffect(() => {
    if (!error) return;
    const firstInvalidField = FIELD_ERROR_ORDER.find((key) => fieldErrors[key]);
    window.setTimeout(() => {
      if (firstInvalidField) focusField(firstInvalidField);
      else errorSummaryRef.current?.focus();
    }, 0);
  }, [error, fieldErrors]);

  function focusField(key: ReapplyFieldErrorKey) {
    if (key === "fileUploads") {
      document.getElementById("file-list-container")?.focus();
      return;
    }
    document.getElementById(FIELD_ELEMENT_IDS[key])?.focus();
  }

  function clearFieldError(key: ReapplyFieldErrorKey) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function fieldErrorProps(key: ReapplyFieldErrorKey) {
    return {
      "aria-describedby": fieldErrors[key] ? `reapply-error-${key}` : undefined,
      "aria-invalid": fieldErrors[key] ? true : undefined
    };
  }

  function fieldErrorMessage(key: ReapplyFieldErrorKey) {
    return fieldErrors[key] ? (
      <p className="text-xs font-bold text-[var(--kr-gov-error)]" id={`reapply-error-${key}`}>{fieldErrors[key]}</p>
    ) : null;
  }

  function updateField(key: keyof ReapplyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    const errorKeyByField: Partial<Record<keyof ReapplyForm, ReapplyFieldErrorKey>> = {
      agencyName: "agencyName",
      representativeName: "representativeName",
      chargerName: "chargerName",
      chargerEmail: "chargerEmail",
      chargerTel: "chargerTel"
    };
    const errorKey = errorKeyByField[key];
    if (errorKey) clearFieldError(errorKey);
  }

  function hydrateForm(result: JoinCompanyReapplyResult, reapplyToken: string) {
    setForm({
      reapplyToken,
      insttId: String(result.insttId || ""),
      agencyName: String(result.insttNm || ""),
      representativeName: String(result.reprsntNm || ""),
      bizRegistrationNumber: String(result.bizrno || ""),
      zipCode: String(result.zip || ""),
      companyAddress: String(result.adres || ""),
      companyAddressDetail: "",
      chargerName: "",
      chargerEmail: "",
      chargerTel: ""
    });
  }

  async function handleLookup(handleOverride = "") {
    logGovernanceScope("ACTION", "join-company-reapply-lookup", {
      businessNumberPresent: Boolean(bizNo.trim()),
      representativePresent: Boolean(repName.trim()),
      registeredContactPresent: Boolean(registeredContact.trim())
    });
    const activeHandle = handleOverride || lookupHandle;
    const nextFieldErrors: Partial<Record<ReapplyFieldErrorKey, string>> = {};
    if (!activeHandle && !bizNo.trim()) nextFieldErrors.lookupBizNo = en ? "Enter the business registration number." : "사업자등록번호를 입력해 주세요.";
    if (!activeHandle && !repName.trim()) nextFieldErrors.lookupRepName = en ? "Enter the representative name." : "대표자명을 입력해 주세요.";
    if (!activeHandle && !registeredContact.trim()) nextFieldErrors.registeredContact = en
      ? "Enter the email address or phone number registered with the application."
      : "가입 신청에 등록한 담당자 이메일 또는 연락처를 입력해 주세요.";
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setActionError(en ? "Check the required lookup fields." : "조회 필수 항목을 확인해 주세요.");
      return;
    }
    setFieldErrors({});
    setActionError("");
    setPageError("");
    setMessage("");
    setSubmitted(false);
    setReceipt(null);
    submitLockRef.current = false;
    setLoading(true);
    try {
      const nextPage = await fetchJoinCompanyReapplyPage(activeHandle
        ? { lookupHandle: activeHandle }
        : {
            bizNo: bizNo.trim(),
            repName: repName.trim(),
            registeredContact: registeredContact.trim()
          });
      const result = nextPage.result;
      const reapplyToken = String(nextPage.reapplyToken || "").trim();
      if (!result || !reapplyToken) {
        throw new Error(en ? "The secure reapplication token is missing. Please search again." : "안전한 재신청 토큰을 확인할 수 없습니다. 다시 조회해 주세요.");
      }
      setPage(nextPage);
      setLookupHandle(String(nextPage.lookupHandle || activeHandle));
      hydrateForm(result, reapplyToken);
      setUploadRows([createUploadRow()]);
      setApplicantResponse("");
    } catch (nextError) {
      setPage(null);
      setForm(EMPTY_FORM);
      setApplicantResponse("");
      setUploadRows([createUploadRow()]);
      setPageError(nextError instanceof Error ? nextError.message : (en ? "Failed to load reapply page." : "재신청 조회에 실패했습니다."));
    } finally {
      setLoading(false);
    }
  }

  function addFileRow() {
    if (uploadRows.length >= MAX_FILE_COUNT) {
      const fileLimitMessage = en ? "You can upload up to 10 supporting documents." : "증빙 서류는 최대 10개까지 업로드할 수 있습니다.";
      setFieldErrors((current) => ({ ...current, fileUploads: fileLimitMessage }));
      setActionError(fileLimitMessage);
      return;
    }
    setUploadRows((current) => [...current, createUploadRow()]);
  }

  function removeFileRow(id: string) {
    setUploadRows((current) => {
      if (current.length === 1) return [{ ...current[0], file: null }];
      return current.filter((row) => row.id !== id);
    });
  }

  function updateFileRow(id: string, file: File | null) {
    setUploadRows((current) => current.map((row) => (row.id === id ? { ...row, file } : row)));
  }

  function isAcceptedFile(file: File) {
    const lowerName = file.name.toLowerCase();
    return ACCEPTED_FILE_TYPES.some((ext) => lowerName.endsWith(ext));
  }

  function validateUploadFile(file: File) {
    if (!isAcceptedFile(file)) {
      return en ? "Only PDF, JPG, and PNG files can be uploaded." : "PDF, JPG, PNG 파일만 업로드할 수 있습니다.";
    }
    if (file.size <= 0) {
      return en ? "Empty files cannot be uploaded." : "내용이 없는 빈 파일은 업로드할 수 없습니다.";
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return en ? "Each file must be 10 MB or smaller." : "파일 1개당 크기는 10MB 이하여야 합니다.";
    }
    return "";
  }

  function assignDroppedFile(rowId: string, file: File | null) {
    if (!file) return;
    const validationError = validateUploadFile(file);
    if (validationError) {
      setFieldErrors((current) => ({ ...current, fileUploads: validationError }));
      setActionError(validationError);
      return;
    }
    updateFileRow(rowId, file);
    clearFieldError("fileUploads");
    setActionError("");
  }

  function openAddressSearch() {
    const daumPostcode = (window as Window & {
      daum?: {
        Postcode: new (options: {
          oncomplete: (data: {
            zonecode: string;
            roadAddress: string;
            jibunAddress: string;
            userSelectedType: string;
          }) => void;
        }) => { open: () => void };
      };
    }).daum;

    if (!daumPostcode?.Postcode) {
      window.alert(en ? "Address search is not ready yet. Please try again." : "주소 검색을 아직 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    new daumPostcode.Postcode({
      oncomplete(data) {
        const address = data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress;
        setForm((current) => ({
          ...current,
          zipCode: data.zonecode,
          companyAddress: address
        }));
        clearFieldError("companyAddress");
        window.setTimeout(() => {
          const detailInput = document.getElementById("company-address-detail") as HTMLInputElement | null;
          detailInput?.focus();
        }, 0);
      }
    }).open();
  }

  async function handleHome() {
    await resetJoinSession();
    navigate(buildLocalizedPath("/home", "/en/home"));
  }

  function handleStatusLookup() {
    const target = buildLocalizedPath("/join/companyJoinStatusDetail", "/join/en/companyJoinStatusDetail");
    navigate(lookupHandle ? `${target}?lookupHandle=${encodeURIComponent(lookupHandle)}` : buildLocalizedPath("/join/companyJoinStatusSearch", "/join/en/companyJoinStatusSearch"));
  }

  function handleNewLookup() {
    setBizNo("");
    setRepName("");
    setRegisteredContact("");
    setLookupHandle("");
    setPage(null);
    setForm(EMPTY_FORM);
    setApplicantResponse("");
    setUploadRows([createUploadRow()]);
    setActionError("");
    setFieldErrors({});
    setPageError("");
    setMessage("");
    setSubmitted(false);
    setReceipt(null);
    submitLockRef.current = false;
    window.setTimeout(() => {
      document.getElementById("lookup-bizNo")?.focus();
    }, 0);
  }

  async function handleSubmit() {
    if (submitLockRef.current || submitting || submitted) return;
    logGovernanceScope("ACTION", "join-company-reapply-submit", {
      institutionSelected: Boolean(form.insttId),
      companyNamePresent: Boolean(form.agencyName.trim()),
      applicantResponseLength: applicantResponse.trim().length,
      uploadedFileCount: uploadRows.map((row) => row.file).filter((file): file is File => file !== null).length
    });
    setActionError("");
    setMessage("");

    const files = uploadRows.map((row) => row.file).filter((file): file is File => file !== null);
    if (!form.reapplyToken) {
      setActionError(en ? "Please search for the rejected application again." : "반려된 신청 정보를 다시 조회해 주세요.");
      return;
    }
    const nextFieldErrors: Partial<Record<ReapplyFieldErrorKey, string>> = {};
    if (!form.chargerName.trim()) nextFieldErrors.chargerName = en ? "Enter the manager name." : "담당자 성명을 입력해 주세요.";
    if (!form.chargerEmail.trim()) {
      nextFieldErrors.chargerEmail = en ? "Enter the email address." : "이메일 주소를 입력해 주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.chargerEmail.trim())) {
      nextFieldErrors.chargerEmail = en ? "Enter a valid email address." : "올바른 이메일 주소를 입력해 주세요.";
    }
    if (!form.chargerTel.trim()) nextFieldErrors.chargerTel = en ? "Enter the contact number." : "연락처를 입력해 주세요.";
    if (!form.agencyName.trim()) nextFieldErrors.agencyName = en ? "Enter the company name." : "업체명을 입력해 주세요.";
    if (!form.representativeName.trim()) nextFieldErrors.representativeName = en ? "Enter the representative name." : "대표자 성명을 입력해 주세요.";
    if (!form.companyAddress.trim() || !form.zipCode.trim()) nextFieldErrors.companyAddress = en ? "Select the business address." : "사업장 주소를 선택해 주세요.";
    if (files.length === 0) nextFieldErrors.fileUploads = en ? "Upload at least one supporting document." : "증빙 서류를 1개 이상 업로드해 주세요.";
    if (files.length > MAX_FILE_COUNT) nextFieldErrors.fileUploads = en ? "You can upload up to 10 supporting documents." : "증빙 서류는 최대 10개까지 업로드할 수 있습니다.";
    if (applicantResponse.trim().length < 10) nextFieldErrors.applicantResponse = en ? "Describe the corrective action in at least 10 characters." : "보완·재신청 내용을 10자 이상 입력해 주세요.";
    if (applicantResponse.trim().length > 2000) nextFieldErrors.applicantResponse = en ? "Keep the corrective action within 2,000 characters." : "보완·재신청 내용은 2,000자 이내로 입력해 주세요.";
    const invalidFileMessage = files.map(validateUploadFile).find(Boolean);
    if (invalidFileMessage) nextFieldErrors.fileUploads = invalidFileMessage;
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setActionError(en ? "Review the highlighted required fields." : "표시된 필수 항목을 확인해 주세요.");
      return;
    }
    setFieldErrors({});

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const result = await submitJoinCompanyReapply({
        ...form,
        applicantResponse: applicantResponse.trim(),
        fileUploads: files
      });
      const companyName = result.insttNm || form.agencyName;
      setLookupHandle(String(result.lookupHandle || lookupHandle));
      setMessage(en ? `${companyName} reapplication has been submitted.` : `${companyName} 재신청이 접수되었습니다.`);
      setReceipt(result);
      setSubmitted(true);
    } catch (nextError) {
      submitLockRef.current = false;
      setActionError(nextError instanceof Error ? nextError.message : (en ? "Failed to submit reapplication." : "재신청 처리에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  const result = page?.result;
  const insttFiles = page?.insttFiles || [];

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

      <div className="bg-white border-b border-[var(--kr-gov-border-light)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              alt={en ? "Emblem of the Republic of Korea" : "대한민국 정부 상징"}
              className="h-4"
              data-fallback-applied="0"
              onError={(event) => {
                if (event.currentTarget.dataset.fallbackApplied === "1") return;
                event.currentTarget.dataset.fallbackApplied = "1";
                event.currentTarget.src = GOV_SYMBOL_FALLBACK_PATH;
              }}
              src={GOV_SYMBOL_PATH}
            />
            <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">
              {en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
            </span>
          </div>
        </div>
      </div>

      <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex h-20 min-w-0 items-center justify-between">
            <div className="flex min-w-0 max-w-full flex-1 items-center gap-3" data-join-brand-wrapper>
              <HomeLinkButton className="min-h-0 min-w-0 max-w-full overflow-hidden border-0 bg-transparent px-0 py-0 hover:bg-transparent" data-join-brand-action href="#" onClick={(event) => {
                event.preventDefault();
                void handleHome();
              }} variant="ghost">
                <span className="material-symbols-outlined flex-none text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>eco</span>
                <div className="flex min-w-0 max-w-full flex-col">
                  <h1 className="truncate text-lg font-bold leading-none tracking-tight text-[var(--kr-gov-text-primary)]">
                    {en ? "CCUS Portal" : "CCUS 통합관리 포털"}
                  </h1>
                  <p className="mt-1 hidden max-w-full truncate text-[9px] font-bold uppercase tracking-wider text-[var(--kr-gov-text-secondary)] sm:block" data-join-brand-subtitle>Carbon Capture, Utilization and Storage</p>
                </div>
              </HomeLinkButton>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-5xl mx-auto w-full py-10 px-4" id="main-content">
        <div className="mb-8">
          <h2 className="text-3xl font-black mb-2">{en ? "Business Member Reapplication" : "사업자 회원 재신청"}</h2>
          <p className="text-[var(--kr-gov-text-secondary)]">
            {en
              ? "Review the rejection reason and update your information before submitting again."
              : "반려 사유를 확인하신 후 정보를 수정하여 다시 신청해 주시기 바랍니다."}
          </p>
        </div>

        {!page?.success ? (
        <section className="bg-white border border-[var(--kr-gov-border-light)] rounded-lg p-6 mb-6" data-help-id="join-company-reapply-lookup">
          <div className="grid grid-cols-1 gap-4 items-end lg:grid-cols-[1fr_1fr_1.2fr_auto]">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="lookup-bizNo">
                {en ? "Business Registration Number" : "사업자등록번호"}
              </label>
              <HomeInput
                className="home-field home-field--lookup"
                id="lookup-bizNo"
                onChange={(event) => {
                  setBizNo(event.target.value);
                  clearFieldError("lookupBizNo");
                }}
                value={bizNo}
                {...fieldErrorProps("lookupBizNo")}
              />
              {fieldErrorMessage("lookupBizNo")}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="lookup-repName">
                {en ? "Representative Name" : "대표자명"}
              </label>
              <HomeInput
                className="home-field home-field--lookup"
                id="lookup-repName"
                onChange={(event) => {
                  setRepName(event.target.value);
                  clearFieldError("lookupRepName");
                }}
                value={repName}
                {...fieldErrorProps("lookupRepName")}
              />
              {fieldErrorMessage("lookupRepName")}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="lookup-registeredContact">
                {en ? "Registered email or phone" : "등록 담당자 이메일 또는 연락처"}
              </label>
              <HomeInput
                autoComplete="email"
                className="home-field home-field--lookup"
                id="lookup-registeredContact"
                onChange={(event) => {
                  setRegisteredContact(event.target.value);
                  clearFieldError("registeredContact");
                }}
                value={registeredContact}
                {...fieldErrorProps("registeredContact")}
              />
              {fieldErrorMessage("registeredContact")}
            </div>
            <HomeButton
              className="px-6"
              disabled={loading}
              onClick={() => void handleLookup()}
              type="button"
              variant="primary"
            >
              {loading ? "..." : en ? "Load" : "재신청 대상 조회"}
            </HomeButton>
          </div>
        </section>
        ) : null}

        {error ? (
          <div
            aria-atomic="true"
            aria-live="assertive"
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-2"
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
            <div className="flex-grow">
              <p className="font-bold mb-1">{en ? "An error occurred while processing the reapplication." : "재신청 처리 중 오류가 발생했습니다."}</p>
              <p>{error}</p>
              {Object.keys(fieldErrors).length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {FIELD_ERROR_ORDER.filter((key) => fieldErrors[key]).map((key) => (
                    <li key={key}>
                      <button className="underline underline-offset-2" onClick={() => focusField(key)} type="button">{fieldErrors[key]}</button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        {submitted && receipt ? (
          <section aria-live="polite" className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-white p-6 shadow-sm sm:p-8" data-help-id="join-company-reapply-status" role="status">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[32px] text-emerald-600">task_alt</span>
                <div>
                  <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? "Reapplication received" : "재신청 접수 완료"}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                    {en ? "The corrected application is waiting for administrator review. You cannot submit it again." : "보완한 신청서가 운영자 검토 대기 상태로 전환되었습니다. 같은 신청을 다시 제출할 수 없습니다."}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-1 overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] sm:grid-cols-3">
                <div className="border-b border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)] px-4 py-4 sm:border-b-0 sm:border-r">
                  <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Organization" : "접수 기관"}</dt>
                  <dd className="mt-1 break-words text-sm font-bold text-[var(--kr-gov-text-primary)]">{receipt.insttNm}</dd>
                </div>
                <div className="border-b border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)] px-4 py-4 sm:border-b-0 sm:border-r">
                  <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "처리 상태"}</dt>
                  <dd className="mt-1 text-sm font-bold text-emerald-700">{receipt.status === "APPLIED" ? (en ? "Awaiting approval review" : "승인 검토 대기") : receipt.status}</dd>
                </div>
                <div className="bg-[var(--kr-gov-bg-gray)] px-4 py-4">
                  <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Submitted at" : "접수 시각"}</dt>
                  <dd className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{receipt.regDate}</dd>
                </div>
              </dl>
              <div className="flex flex-col gap-3 sm:flex-row">
                <HomeButton className="flex-1" onClick={handleStatusLookup} size="lg" type="button" variant="primary">
                  {en ? "Check approval status" : "승인 상태 조회"}
                </HomeButton>
                <HomeButton className="flex-1" onClick={handleNewLookup} size="lg" type="button">
                  {en ? "Search another application" : "새 재신청 조회"}
                </HomeButton>
              </div>
            </div>
          </section>
        ) : message ? (
          <div aria-live="polite" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700" role="status">{message}</div>
        ) : null}

        {page?.success && !submitted ? (
          <>
            <div className="mb-10 bg-[var(--kr-gov-warning-bg)] border border-[var(--kr-gov-warning-border)] p-6 rounded-[var(--kr-gov-radius)] flex gap-4" data-help-id="join-company-reapply-rejection">
              <span className="material-symbols-outlined text-[var(--kr-gov-error)] text-[32px]">warning</span>
              <div className="flex-grow">
                <h3 className="font-bold text-[var(--kr-gov-error)] mb-1">{en ? "Reason for Rejection" : "가입 신청 반려 사유"}</h3>
                <p className="text-[var(--kr-gov-text-primary)] leading-relaxed">{String(result?.rjctRsn || (en ? "The rejection reason will be displayed here." : "반려 사유 내용이 표시됩니다."))}</p>
                {result?.rjctPnttm ? (
                  <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                    {en ? `(Processed at: ${String(result.rjctPnttm)})` : `(처리일시: ${String(result.rjctPnttm)})`}
                  </p>
                ) : null}
              </div>
            </div>

            <section className="mb-10 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-white p-6" data-help-id="join-company-reapply-response">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Corrective action and response" : "보완·재신청 내용"}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                    {en ? "Explain what was corrected for each rejection reason and identify the supporting evidence." : "반려 사유별로 수정·보완한 내용과 이를 확인할 수 있는 증빙을 구체적으로 작성해 주세요."}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--kr-gov-text-secondary)]">{applicantResponse.length}/2000</span>
              </div>
              <label className="sr-only" htmlFor="applicant-response">{en ? "Corrective action and response" : "보완·재신청 내용"}</label>
              <textarea
                className="min-h-40 w-full resize-y rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border)] bg-white p-4 text-sm leading-6 outline-none focus:border-[var(--kr-gov-blue)] focus:ring-2 focus:ring-blue-100"
                id="applicant-response"
                maxLength={2000}
                onChange={(event) => { setApplicantResponse(event.target.value); clearFieldError("applicantResponse"); }}
                placeholder={en ? "Example: Corrected the representative information and attached the updated registration certificate." : "예: 대표자 정보를 최신 정보로 수정하고 변경된 사업자등록증을 첨부했습니다."}
                required
                value={applicantResponse}
                {...fieldErrorProps("applicantResponse")}
              />
              {fieldErrorMessage("applicantResponse")}
            </section>

            <div className="space-y-12">
              <section data-help-id="join-company-reapply-information">
                <h3 className="form-section-title">{en ? "Basic Information" : "기본 정보"}</h3>
                <p className="mb-5 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en ? "For privacy protection, re-enter the manager contact details and detailed address before resubmitting." : "개인정보 보호를 위해 담당자 연락처와 상세주소를 다시 입력해 주세요."}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="charger-name">
                      {en ? "Manager Name" : "담당자 성명"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <HomeInput autoComplete="name" className="home-field home-field--reapply" id="charger-name" onChange={(event) => updateField("chargerName", event.target.value)} value={form.chargerName} {...fieldErrorProps("chargerName")} />
                    {fieldErrorMessage("chargerName")}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="charger-email">
                      {en ? "Email Address" : "이메일 주소"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <HomeInput
                      autoComplete="email"
                      className="home-field home-field--reapply"
                      id="charger-email"
                      inputMode="email"
                      onChange={(event) => updateField("chargerEmail", event.target.value)}
                      spellCheck={false}
                      type="email"
                      value={form.chargerEmail}
                      {...fieldErrorProps("chargerEmail")}
                    />
                    {fieldErrorMessage("chargerEmail")}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="charger-tel">
                      {en ? "Contact Number" : "연락처"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <HomeInput
                      autoComplete="tel-national"
                      className="home-field home-field--reapply"
                      id="charger-tel"
                      inputMode="numeric"
                      onChange={(event) => updateField("chargerTel", event.target.value)}
                      spellCheck={false}
                      type="text"
                      value={form.chargerTel}
                      {...fieldErrorProps("chargerTel")}
                    />
                    {fieldErrorMessage("chargerTel")}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="form-section-title">{en ? "Business Information" : "사업자 정보"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="company-name">
                      {en ? "Company Name" : "업체명"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <HomeInput autoComplete="organization" className="home-field home-field--reapply" id="company-name" onChange={(event) => updateField("agencyName", event.target.value)} value={form.agencyName} {...fieldErrorProps("agencyName")} />
                    {fieldErrorMessage("agencyName")}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="biz-number">
                      {en ? "Business Registration Number" : "사업자등록번호"}
                    </label>
                    <HomeInput className="home-field home-field--reapply home-field--readonly" id="biz-number" readOnly type="text" value={form.bizRegistrationNumber} />
                    <p className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Business registration number cannot be changed." : "사업자등록번호는 수정할 수 없습니다."}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="rep-name">
                      {en ? "Representative Name" : "대표자 성명"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <HomeInput autoComplete="name" className="home-field home-field--reapply" id="rep-name" onChange={(event) => updateField("representativeName", event.target.value)} value={form.representativeName} {...fieldErrorProps("representativeName")} />
                    {fieldErrorMessage("representativeName")}
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="company-address">
                      {en ? "Business Address" : "사업장 주소"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <HomeInput className="home-field home-field--reapply home-field--readonly max-w-[200px]" id="zip-code" onClick={openAddressSearch} placeholder={en ? "Zip Code" : "우편번호"} readOnly type="text" value={form.zipCode} {...fieldErrorProps("companyAddress")} />
                      <HomeButton className="px-6 text-sm whitespace-nowrap" onClick={openAddressSearch} type="button" variant="primary">
                        {en ? "Find Address" : "주소 검색"}
                      </HomeButton>
                    </div>
                    <HomeInput className="home-field home-field--reapply home-field--readonly mb-2 bg-gray-50 cursor-pointer" id="company-address" onClick={openAddressSearch} readOnly type="text" value={form.companyAddress} />
                    <HomeInput className="home-field home-field--reapply" id="company-address-detail" onChange={(event) => updateField("companyAddressDetail", event.target.value)} placeholder={en ? "Enter detailed address" : "상세주소를 입력하세요"} type="text" value={form.companyAddressDetail} />
                    {fieldErrorMessage("companyAddress")}
                  </div>
                </div>
              </section>

              <section data-help-id="join-company-reapply-files">
                <h3 className="form-section-title">{en ? "Supporting Documents" : "증빙 서류"}</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)]">
                      {en ? "Re-upload Business Registration Certificate" : "사업자등록증 재업로드"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <HomeButton className="px-3 py-1.5 text-xs" disabled={uploadRows.length >= MAX_FILE_COUNT} onClick={addFileRow} size="xs" type="button">
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      {en ? "Add File" : "파일 추가"}
                    </HomeButton>
                  </div>
                  <p className="text-xs leading-5 text-[var(--kr-gov-text-secondary)]">
                    {en ? "Allowed: PDF, JPG, PNG. Up to 10 files, 10 MB per file." : "PDF, JPG, PNG 형식으로 최대 10개, 파일 1개당 10MB까지 업로드할 수 있습니다."}
                  </p>

                  <div
                    aria-describedby={fieldErrors.fileUploads ? "reapply-error-fileUploads" : undefined}
                    aria-invalid={fieldErrors.fileUploads ? true : undefined}
                    className="space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--kr-gov-blue)]"
                    id="file-list-container"
                    tabIndex={-1}
                  >
                    {insttFiles.length > 0 ? (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-[var(--kr-gov-radius)] mb-4">
                        <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] mb-2 uppercase tracking-wider">
                          {en ? "Existing submissions" : "기존 제출 서류"}
                        </p>
                        {insttFiles.map((file, index) => {
                          const fileName = file.orignlFileNm || (en ? "Submitted document" : "제출 서류");
                          const fileSize = file.fileMg || 0;
                          return <div className="flex items-center gap-2 py-1" key={`existing-file-${index}-${fileName}`}>
                            <span className="material-symbols-outlined text-gray-400 text-sm">attach_file</span>
                            <span className="min-w-0 truncate text-sm text-[var(--kr-gov-text-primary)]">{fileName}</span>
                            {fileSize > 0 ? <span className="shrink-0 text-xs text-[var(--kr-gov-text-secondary)]">{fileSizeLabel(fileSize)}</span> : null}
                            <span className="text-[10px] text-[var(--kr-gov-error)] font-bold px-1.5 py-0.5 border border-red-200 bg-red-50 rounded">
                              {en ? "Existing submission" : "기존 제출"}
                            </span>
                          </div>
                        })}
                      </div>
                    ) : null}

                    {uploadRows.map((row, index) => (
                      <label
                        className={`file-row flex items-center gap-3 p-4 rounded-[var(--kr-gov-radius)] transition-all cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--kr-gov-blue)] focus-within:ring-offset-2 ${index === 0
                          ? `border-2 border-dashed group ${dragTargetId === row.id ? "border-[var(--kr-gov-blue)] bg-blue-50/20" : "border-[var(--kr-gov-error)] bg-red-50/20 hover:bg-red-50"}`
                          : `${dragTargetId === row.id ? "border-[var(--kr-gov-blue)] bg-blue-50/20" : "border border-gray-200 bg-white hover:border-[var(--kr-gov-blue)]"} group`
                        }`}
                        htmlFor={`${fileInputPrefix}-${row.id}`}
                        key={row.id}
                        onDragEnter={() => setDragTargetId(row.id)}
                        onDragLeave={() => setDragTargetId((current) => (current === row.id ? null : current))}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragTargetId(row.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragTargetId(null);
                          assignDroppedFile(row.id, event.dataTransfer.files?.[0] || null);
                        }}
                      >
                        <span className={`material-symbols-outlined transition-all ${index === 0
                          ? `${dragTargetId === row.id ? "text-[var(--kr-gov-blue)]" : "text-[var(--kr-gov-error)]"} group-hover:scale-110`
                          : `${dragTargetId === row.id ? "text-[var(--kr-gov-blue)]" : "text-gray-400"} group-hover:text-[var(--kr-gov-blue)]`
                        }`}>
                          {index === 0 ? (row.file ? "check_circle" : "cloud_upload") : (row.file ? "check_circle" : "attach_file")}
                        </span>
                        <div className="flex-grow min-w-0">
                          <HomeInput
                            accept={ACCEPTED_FILE_TYPES.join(",")}
                            aria-describedby={fieldErrors.fileUploads ? "reapply-error-fileUploads" : undefined}
                            aria-invalid={fieldErrors.fileUploads ? true : undefined}
                            className="sr-only file-input"
                            id={`${fileInputPrefix}-${row.id}`}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => assignDroppedFile(row.id, event.target.files?.[0] || null)}
                            type="file"
                          />
                          <div className="file-info flex items-center justify-between">
                            <span className={`file-name text-sm truncate ${row.file
                              ? "font-bold text-[var(--kr-gov-blue)]"
                              : index === 0
                                ? (dragTargetId === row.id ? "font-bold text-[var(--kr-gov-blue)]" : "font-bold text-[var(--kr-gov-error)]")
                                : "text-gray-500"
                            }`}>
                              {row.file
                                ? row.file.name
                                : en
                                  ? (index === 0 ? "Select a new document or drop it here." : "Please select a file.")
                                  : (index === 0 ? "새 서류를 선택하거나 여기로 끌어다 놓으세요." : "파일을 선택해 주세요.")}
                            </span>
                            <span className="file-size text-xs text-gray-400">{row.file ? fileSizeLabel(row.file.size) : ""}</span>
                          </div>
                        </div>
                        <HomeIconButton
                          className={`${row.file || uploadRows.length > 1 ? "" : "hidden "}remove-file-btn text-gray-400 hover:text-red-500 transition-colors`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            removeFileRow(row.id);
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined">close</span>
                        </HomeIconButton>
                      </label>
                    ))}
                    {fieldErrorMessage("fileUploads")}
                  </div>
                </div>
              </section>

              <div className="flex flex-col justify-center gap-3 border-t border-[var(--kr-gov-border-light)] pt-8 sm:flex-row sm:items-center" data-help-id="join-company-reapply-submit">
                <HomeButton
                  className="min-w-[160px] text-lg"
                  onClick={() => window.history.back()}
                  size="lg"
                  type="button"
                >
                  {en ? "Cancel" : "취소"}
                </HomeButton>
                <HomeButton
                  className="min-w-[160px] text-lg shadow-lg shadow-blue-900/10"
                  disabled={submitting || submitted}
                  onClick={() => void handleSubmit()}
                  size="lg"
                  type="button"
                  variant="primary"
                >
                  {submitting ? "..." : submitted ? (en ? "Submission Received" : "접수 완료") : en ? "Complete Reapplication" : "재신청 완료"}
                </HomeButton>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
