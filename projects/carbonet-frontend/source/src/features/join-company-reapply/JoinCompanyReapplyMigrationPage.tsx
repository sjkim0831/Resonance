import { ChangeEvent, useEffect, useId, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
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
import { HomeButton, HomeIconButton, HomeInput, HomeLinkButton } from "../home-ui/common";

type UploadRow = {
  id: string;
  file: File | null;
};

type ReapplyForm = {
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

const EMPTY_FORM: ReapplyForm = {
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

function createUploadRow(): UploadRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file: null
  };
}

function resolveInitialLookup() {
  const params = new URLSearchParams(window.location.search);
  return {
    bizNo: params.get("bizNo") || "",
    repName: params.get("repName") || ""
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
  const initialLookup = resolveInitialLookup();
  const [bizNo, setBizNo] = useState(initialLookup.bizNo);
  const [repName, setRepName] = useState(initialLookup.repName);
  const [form, setForm] = useState<ReapplyForm>(EMPTY_FORM);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([createUploadRow()]);
  const [actionError, setActionError] = useState(() => getSearchParam("errorMessage"));
  const [message, setMessage] = useState(() => getSearchParam("message"));
  const [submitting, setSubmitting] = useState(false);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const fileInputPrefix = useId();
  const pageState = useAsyncValue(
    () => fetchJoinCompanyReapplyPage({ bizNo: bizNo.trim(), repName: repName.trim() }),
    [bizNo, repName],
    {
      enabled: false,
      onSuccess(result) {
        hydrateForm((result.result || {}) as Record<string, unknown>);
        setUploadRows([createUploadRow()]);
      }
    }
  );
  const page = pageState.value;
  const loading = pageState.loading;
  const error = actionError || pageState.error;

  useExternalScript("//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js");

  useEffect(() => {
    if (!initialLookup.bizNo || !initialLookup.repName) return;
    void handleLookup();
  }, []);

  useEffect(() => {
    logGovernanceScope("PAGE", "join-company-reapply", {
      language: en ? "en" : "ko",
      bizNo: bizNo.trim(),
      repName: repName.trim(),
      insttId: form.insttId,
      uploadRowCount: uploadRows.length,
      loading,
      submitting
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
    submitting,
    uploadRows
  ]);

  function updateField(key: keyof ReapplyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function hydrateForm(result: Record<string, unknown>) {
    setForm({
      insttId: String(result.insttId || ""),
      agencyName: String(result.insttNm || ""),
      representativeName: String(result.reprsntNm || ""),
      bizRegistrationNumber: String(result.bizrno || ""),
      zipCode: String(result.zip || ""),
      companyAddress: String(result.adres || ""),
      companyAddressDetail: String(result.detailAdres || ""),
      chargerName: String(result.chargerNm || ""),
      chargerEmail: String(result.chargerEmail || ""),
      chargerTel: String(result.chargerTel || "")
    });
  }

  async function handleLookup() {
    logGovernanceScope("ACTION", "join-company-reapply-lookup", {
      bizNo: bizNo.trim(),
      repName: repName.trim()
    });
    if (!bizNo.trim() || !repName.trim()) {
      setActionError(en ? "Enter both business registration number and representative name." : "사업자등록번호와 대표자명을 모두 입력해 주세요.");
      return;
    }
    setActionError("");
    setMessage("");
    const result = await pageState.reload();
    if (!result) {
      setActionError(en ? "Failed to load reapply page." : "재신청 조회에 실패했습니다.");
    }
  }

  function addFileRow() {
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

  function assignDroppedFile(rowId: string, file: File | null) {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      setActionError(en ? "Only PDF, JPG, and PNG files can be uploaded." : "PDF, JPG, PNG 파일만 업로드할 수 있습니다.");
      return;
    }
    updateFileRow(rowId, file);
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

  async function handleSubmit() {
    logGovernanceScope("ACTION", "join-company-reapply-submit", {
      insttId: form.insttId,
      agencyName: form.agencyName,
      uploadedFileCount: uploadRows.map((row) => row.file).filter((file): file is File => file !== null).length
    });
    setActionError("");
    setMessage("");

    const files = uploadRows.map((row) => row.file).filter((file): file is File => file !== null);
    if (!form.chargerName || !form.chargerEmail || !form.chargerTel || !form.agencyName || !form.representativeName || !form.companyAddress || !form.zipCode) {
      setActionError(en ? "Please fill in all required fields." : "필수 항목을 모두 입력해 주세요.");
      return;
    }
    if (files.length === 0) {
      setActionError(en ? "Please upload at least one supporting document." : "증빙 서류를 1개 이상 업로드해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitJoinCompanyReapply({
        ...form,
        fileUploads: files
      });
      setMessage(en ? `${String(result.insttNm || form.agencyName)} reapplication has been submitted.` : `${String(result.insttNm || form.agencyName)} 재신청이 접수되었습니다.`);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : (en ? "Failed to submit reapplication." : "재신청 처리에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  const result = (page?.result || {}) as Record<string, unknown>;
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
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8BPzqtzSLVGSrjt4mzhhVBy9SocCRDssk1F3XRVu7Xq9jHh7qzzt48wFi8qduCiJmB0LRQczPB7waPe3h0gkjn3jOEDxt6UJSJjdXNf8P-4WlM2BEZrfg2SL91uSiZrFcCk9KYrsdg-biTS9dtJ_OIghDBEVoAzMc33XcCYR_UP0QQdoYzBe840YrtH40xGyB9MSr0QH4D0foqlvOhG0jX8CDayXNlDsSKlfClVd3K2aodlwg4xSxgXHB3vnnnA0L2yNBNihQQg0"
            />
            <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">
              {en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
            </span>
          </div>
        </div>
      </div>

      <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3 shrink-0">
              <HomeLinkButton className="min-h-0 border-0 bg-transparent px-0 py-0 hover:bg-transparent" href="#" onClick={(event) => {
                event.preventDefault();
                void handleHome();
              }} variant="ghost">
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>eco</span>
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold tracking-tight text-[var(--kr-gov-text-primary)] leading-none">
                    {en ? "CCUS Portal" : "CCUS 통합관리 포털"}
                  </h1>
                  <p className="text-[9px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider mt-1">Carbon Capture, Utilization and Storage</p>
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
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="lookup-bizNo">
                {en ? "Business Registration Number" : "사업자등록번호"}
              </label>
              <HomeInput className="home-field home-field--lookup" id="lookup-bizNo" onChange={(event) => setBizNo(event.target.value)} value={bizNo} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="lookup-repName">
                {en ? "Representative Name" : "대표자명"}
              </label>
              <HomeInput className="home-field home-field--lookup" id="lookup-repName" onChange={(event) => setRepName(event.target.value)} value={repName} />
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
            <div className="flex-grow">
              <p className="font-bold mb-1">{en ? "An error occurred while processing the reapplication." : "재신청 처리 중 오류가 발생했습니다."}</p>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        {message ? (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] shrink-0">check_circle</span>
            <div className="flex-grow">
              <p className="font-bold mb-1">{en ? "Reapplication submitted successfully." : "재신청이 정상적으로 접수되었습니다."}</p>
              <p>{message}</p>
            </div>
          </div>
        ) : null}

        {page?.success ? (
          <>
            <div className="mb-10 bg-[var(--kr-gov-warning-bg)] border border-[var(--kr-gov-warning-border)] p-6 rounded-[var(--kr-gov-radius)] flex gap-4">
              <span className="material-symbols-outlined text-[var(--kr-gov-error)] text-[32px]">warning</span>
              <div className="flex-grow">
                <h3 className="font-bold text-[var(--kr-gov-error)] mb-1">{en ? "Reason for Rejection" : "가입 신청 반려 사유"}</h3>
                <p className="text-[var(--kr-gov-text-primary)] leading-relaxed">{String(result.rjctRsn || (en ? "The rejection reason will be displayed here." : "반려 사유 내용이 표시됩니다."))}</p>
                {result.rjctPnttm ? (
                  <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                    {en ? `(Processed at: ${String(result.rjctPnttm)})` : `(처리일시: ${String(result.rjctPnttm)})`}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-12">
              <section data-help-id="join-company-reapply-form">
                <h3 className="form-section-title">{en ? "Basic Information" : "기본 정보"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="charger-name">
                      {en ? "Manager Name" : "담당자 성명"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <HomeInput autoComplete="name" className="home-field home-field--reapply" id="charger-name" onChange={(event) => updateField("chargerName", event.target.value)} value={form.chargerName} />
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
                      type="text"
                      value={form.chargerEmail}
                    />
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
                    />
                  </div>
                </div>
              </section>

              <section data-help-id="join-company-reapply-files">
                <h3 className="form-section-title">{en ? "Business Information" : "사업자 정보"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="company-name">
                      {en ? "Company Name" : "업체명"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <HomeInput autoComplete="organization" className="home-field home-field--reapply" id="company-name" onChange={(event) => updateField("agencyName", event.target.value)} value={form.agencyName} />
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
                    <HomeInput autoComplete="name" className="home-field home-field--reapply" id="rep-name" onChange={(event) => updateField("representativeName", event.target.value)} value={form.representativeName} />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="company-address">
                      {en ? "Business Address" : "사업장 주소"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <HomeInput className="home-field home-field--reapply home-field--readonly max-w-[200px]" id="zip-code" onClick={openAddressSearch} placeholder={en ? "Zip Code" : "우편번호"} readOnly type="text" value={form.zipCode} />
                      <HomeButton className="px-6 text-sm whitespace-nowrap" onClick={openAddressSearch} type="button" variant="primary">
                        {en ? "Find Address" : "주소 검색"}
                      </HomeButton>
                    </div>
                    <HomeInput className="home-field home-field--reapply home-field--readonly mb-2 bg-gray-50 cursor-pointer" id="company-address" onClick={openAddressSearch} readOnly type="text" value={form.companyAddress} />
                    <HomeInput className="home-field home-field--reapply" id="company-address-detail" onChange={(event) => updateField("companyAddressDetail", event.target.value)} placeholder={en ? "Enter detailed address" : "상세주소를 입력하세요"} type="text" value={form.companyAddressDetail} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="form-section-title">{en ? "Supporting Documents" : "증빙 서류"}</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)]">
                      {en ? "Re-upload Business Registration Certificate" : "사업자등록증 재업로드"} <span className="text-[var(--kr-gov-error)]">*</span>
                    </label>
                    <HomeButton className="px-3 py-1.5 text-xs" onClick={addFileRow} size="xs" type="button">
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      {en ? "Add File" : "파일 추가"}
                    </HomeButton>
                  </div>

                  <div id="file-list-container" className="space-y-3">
                    {insttFiles.length > 0 ? (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-[var(--kr-gov-radius)] mb-4">
                        <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] mb-2 uppercase tracking-wider">
                          {en ? "Current Documents" : "현재 등록된 서류"}
                        </p>
                        {insttFiles.map((file, index) => (
                          <div className="flex items-center gap-2 py-1" key={`${String(file.fileId || "file")}-${index}`}>
                            <span className="material-symbols-outlined text-gray-400 text-sm">attach_file</span>
                            <span className="text-sm text-[var(--kr-gov-text-primary)]">{String(file.orignlFileNm || file.streFileNm || "file")}</span>
                            <span className="text-[10px] text-[var(--kr-gov-error)] font-bold px-1.5 py-0.5 border border-red-200 bg-red-50 rounded">
                              {en ? "Rejected" : "반려됨"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {uploadRows.map((row, index) => (
                      <label
                        className={`file-row flex items-center gap-3 p-4 rounded-[var(--kr-gov-radius)] transition-all cursor-pointer ${index === 0
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
                            className="hidden file-input"
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
                  </div>
                </div>
              </section>

              <div className="flex justify-center items-center gap-4 pt-8 border-t border-[var(--kr-gov-border-light)]">
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
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                  size="lg"
                  type="button"
                  variant="primary"
                >
                  {submitting ? "..." : en ? "Complete Reapplication" : "재신청 완료"}
                </HomeButton>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
