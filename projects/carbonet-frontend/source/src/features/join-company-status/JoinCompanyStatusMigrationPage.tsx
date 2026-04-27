import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchJoinCompanyStatusDetail } from "../../lib/api/join";
import { buildLocalizedPath, getSearchParam, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeCheckbox, HomeInput, HomeLinkButton } from "../home-ui/common";

function getInitialQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    bizNo: params.get("bizNo") || "",
    appNo: params.get("appNo") || "",
    repName: params.get("repName") || ""
  };
}

type DetailResult = Record<string, unknown>;
type DetailFile = Record<string, unknown>;

const COPY = {
  ko: {
    skip: "본문 바로가기",
    govService: "대한민국 정부 공식 서비스",
    logoTitle: "CCUS 통합관리 포털",
    logoSub: "Carbon Capture, Utilization and Storage",
    searchTitle: "회원사 가입 신청 현황 조회",
    searchDesc: "회원사 등록 신청 시 입력한 정보를 통해 현재 진행 상태를 조회하실 수 있습니다.",
    detailTitle: "회원사 가입 현황 상세",
    detailDesc: "신청하신 회원사 가입 내역 및 처리 상태를 확인하실 수 있습니다.",
    tabBiz: "사업자등록번호로 조회",
    tabApp: "신청번호로 조회",
    bizNo: "사업자등록번호",
    appNo: "신청번호",
    repName: "대표자명",
    bizPlaceholder: "000-00-00000 (숫자만 입력)",
    appPlaceholder: "APP-YYYYMMDD-XXX",
    repPlaceholder: "대표자 성함을 입력하세요",
    verifyTitle: "본인확인 단계",
    verifyDesc: "안전한 정보 조회를 위해 본인인증이 필요합니다.",
    verifyButton: "본인인증 (휴대폰 등)",
    agree: "조회를 위한 개인정보 수집 및 이용에 동의합니다. (필수)",
    search: "조회하기",
    appNoBadge: "신청 번호",
    lastUpdated: "최종 업데이트",
    companyName: "신청 기관명",
    submittedOn: "신청일",
    businessNo: "사업자등록번호",
    representative: "대표자명",
    attachedFiles: "첨부 서류 내역",
    noFiles: "첨부된 서류가 없습니다.",
    download: "다운로드",
    back: "뒤로가기",
    reapply: "재신청하기",
    home: "홈으로 이동",
    searchError: "입력하신 정보와 일치하는 신청 내역이 없습니다.",
    needAgree: "개인정보 수집 및 이용에 동의하셔야 합니다.",
    needRepName: "대표자명을 입력해주세요.",
    needBizNo: "사업자등록번호를 입력해주세요.",
    needAppNo: "신청번호를 입력해주세요.",
    verifyAlert: "본인인증을 진행합니다.",
    submitted: "신청 완료",
    review: "운영자 검토 중",
    pending: "승인 대기",
    approved: "승인 완료",
    rejected: "승인 반려",
    blocked: "차단",
    pendingTitle: "현재 운영자의 서류 검토가 진행 중입니다.",
    pendingDesc: "신청하신 서류에 대해 담당 운영자가 적정성 검토를 진행하고 있습니다. 통상적으로 업무일 기준 3~5일이 소요됩니다.",
    approvedTitle: "회원사 가입 승인이 완료되었습니다.",
    approvedDesc: "이제 관리자 승인을 거쳐 정식 회원사로 활동하실 수 있습니다. 가입 시 입력한 메일로 안내가 발송되었습니다.",
    rejectedTitle: "회원사 가입 신청이 반려되었습니다.",
    rejectedDesc: "입력하신 정보 또는 제출하신 서류에 보완이 필요합니다. 아래의 반려 사유를 확인하시고, [재신청하기] 버튼을 통해 정보를 수정하여 다시 제출해 주시기 바랍니다.",
    blockedTitle: "회원사 접근이 차단되었습니다.",
    blockedDesc: "현재 신청 건은 운영 정책에 따라 차단 상태입니다. 재신청은 불가하며 운영자에게 문의해 주세요.",
    rejectReason: "상세 반려 사유",
    rejectHandledBy: "처리기한: 탄소중립 CCUS 통합관리본부 운영국",
    noData: "-"
  },
  en: {
    skip: "Skip to content",
    govService: "Official Government Service of the Republic of Korea",
    logoTitle: "CCUS Portal",
    logoSub: "Carbon Capture, Utilization and Storage",
    searchTitle: "Check Membership Application Status",
    searchDesc: "You can check the current status of your membership application using the information entered during registration.",
    detailTitle: "Membership Application Details",
    detailDesc: "Review your submitted application and current processing status.",
    tabBiz: "Search by Business Number",
    tabApp: "Search by Application Number",
    bizNo: "Business Registration Number",
    appNo: "Application Number",
    repName: "Representative Name",
    bizPlaceholder: "000-00-00000 (numbers only)",
    appPlaceholder: "APP-YYYYMMDD-XXX",
    repPlaceholder: "Enter the representative name",
    verifyTitle: "Identity verification",
    verifyDesc: "Identity verification is required to securely check application information.",
    verifyButton: "Verify identity",
    agree: "I agree to the collection and use of personal information for status inquiry. (Required)",
    search: "Search",
    appNoBadge: "Application No.",
    lastUpdated: "Last updated",
    companyName: "Organization Name",
    submittedOn: "Submitted On",
    businessNo: "Business Registration No.",
    representative: "Representative",
    attachedFiles: "Attached Documents",
    noFiles: "No attached documents.",
    download: "Download",
    back: "Back",
    reapply: "Reapply",
    home: "Go to Home",
    searchError: "No application matched the entered information.",
    needAgree: "You must agree to the collection and use of personal information.",
    needRepName: "Please enter the representative name.",
    needBizNo: "Please enter the business registration number.",
    needAppNo: "Please enter the application number.",
    verifyAlert: "Identity verification will be provided later.",
    submitted: "Submitted",
    review: "Under Review",
    pending: "Pending Approval",
    approved: "Approved",
    rejected: "Rejected",
    blocked: "Blocked",
    pendingTitle: "The administrator is currently reviewing your documents.",
    pendingDesc: "Your submitted information and supporting files are under review. This usually takes 3 to 5 business days.",
    approvedTitle: "Your membership application has been approved.",
    approvedDesc: "A notice has been sent to the email address used during registration.",
    rejectedTitle: "Your membership application was rejected.",
    rejectedDesc: "Please review the rejection reason below and submit a corrected application if needed.",
    blockedTitle: "Membership access has been blocked.",
    blockedDesc: "Resubmission is not available. Please contact the administrator.",
    rejectReason: "Rejection Reason",
    rejectHandledBy: "Handled by CCUS Integrated Management Division",
    noData: "-"
  }
} as const;

function toStringValue(value: unknown, fallback = "-") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}

function toFileName(file: DetailFile) {
  return toStringValue(file.orignlFileNm || file.streFileNm, "");
}

function toFileId(file: DetailFile) {
  return toStringValue(file.fileId, "");
}

export function JoinCompanyStatusMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const initialQuery = useMemo(() => getInitialQuery(), []);
  const isDetailPage = window.location.pathname.includes("companyJoinStatusDetail");
  const isGuidePage = window.location.pathname.includes("companyJoinStatusGuide");
  const [mode, setMode] = useState<"biz" | "app">(initialQuery.appNo ? "app" : "biz");
  const [bizNo, setBizNo] = useState(initialQuery.bizNo);
  const [appNo, setAppNo] = useState(initialQuery.appNo);
  const [repName, setRepName] = useState(initialQuery.repName);
  const [agreed, setAgreed] = useState(false);
  const detailState = useAsyncValue(
    () => fetchJoinCompanyStatusDetail({
      bizNo: initialQuery.bizNo || undefined,
      appNo: initialQuery.appNo || undefined,
      repName: initialQuery.repName
    }),
    [initialQuery.bizNo, initialQuery.appNo, initialQuery.repName, isDetailPage],
    {
      enabled: isDetailPage && Boolean(initialQuery.repName && (initialQuery.bizNo || initialQuery.appNo)),
      onError: () => undefined
    }
  );
  const detail = detailState.value;
  const error = detailState.error;

  const result = (detail?.result || {}) as DetailResult;
  const files = (detail?.insttFiles || []) as DetailFile[];
  const status = toStringValue(result.insttSttus, "");
  const lastUpdated = toStringValue(result.lastUpdtPnttm, copy.noData);
  const rejectReason = toStringValue(result.rjctRsn, "");
  const rejectAt = toStringValue(result.rjctPnttm, "");
  const submitted = getSearchParam("submitted") === "1";
  const submittedCompany = getSearchParam("insttNm");
  const submittedDate = getSearchParam("regDate");

  useEffect(() => {
    logGovernanceScope("PAGE", "join-company-status", {
      language: en ? "en" : "ko",
      mode,
      isDetailPage,
      isGuidePage,
      bizNo: bizNo.trim(),
      appNo: appNo.trim(),
      repName: repName.trim(),
      status,
      submitted
    });
    logGovernanceScope("COMPONENT", "join-company-status-detail", {
      detailLoaded: Boolean(detail),
      fileCount: files.length,
      status,
      rejectReasonPresent: Boolean(rejectReason && rejectReason !== copy.noData),
      agreed
    });
  }, [
    agreed,
    appNo,
    bizNo,
    copy.noData,
    detail,
    en,
    files.length,
    isDetailPage,
    isGuidePage,
    mode,
    rejectReason,
    repName,
    status,
    submitted
  ]);

  function goHome() {
    navigate(buildLocalizedPath("/home", "/en/home"));
  }

  function changeLanguage(nextEnglish: boolean) {
    const targetBasePath = isDetailPage
      ? nextEnglish ? "/join/en/companyJoinStatusDetail" : "/join/companyJoinStatusDetail"
      : isGuidePage
        ? nextEnglish ? "/join/en/companyJoinStatusGuide" : "/join/companyJoinStatusGuide"
        : nextEnglish ? "/join/en/companyJoinStatusSearch" : "/join/companyJoinStatusSearch";
    const search = window.location.search || "";
    window.location.href = `${targetBasePath}${search}`;
  }

  function handleSearch() {
    logGovernanceScope("ACTION", "join-company-status-search", {
      mode,
      bizNo: bizNo.trim(),
      appNo: appNo.trim(),
      repName: repName.trim(),
      agreed
    });
    if (!agreed) {
      window.alert(copy.needAgree);
      return;
    }
    if (!repName.trim()) {
      window.alert(copy.needRepName);
      return;
    }
    const search = new URLSearchParams();
    search.set("repName", repName.trim());
    if (mode === "biz") {
      if (!bizNo.trim()) {
        window.alert(copy.needBizNo);
        return;
      }
      search.set("bizNo", bizNo.trim());
    } else {
      if (!appNo.trim()) {
        window.alert(copy.needAppNo);
        return;
      }
      search.set("appNo", appNo.trim());
    }
    navigate(`${buildLocalizedPath("/join/companyJoinStatusDetail", "/join/en/companyJoinStatusDetail")}?${search.toString()}`);
  }

  function renderStatusSummary() {
    if (status === "A") {
      return (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 flex items-start gap-4">
          <span className="material-symbols-outlined text-[var(--kr-gov-blue)] mt-0.5">query_stats</span>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-blue-900">{copy.pendingTitle}</h4>
            <p className="text-sm text-blue-800 leading-relaxed">{copy.pendingDesc}</p>
          </div>
        </div>
      );
    }
    if (status === "P") {
      return (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-6 flex items-start gap-4">
          <span className="material-symbols-outlined text-[#059669] mt-0.5">check_circle</span>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-emerald-900">{copy.approvedTitle}</h4>
            <p className="text-sm text-emerald-800 leading-relaxed">{copy.approvedDesc}</p>
          </div>
        </div>
      );
    }
    if (status === "R") {
      return (
        <div className="bg-red-50 border border-red-100 rounded-lg p-6 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined text-red-600 mt-0.5">error</span>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-red-900">{copy.rejectedTitle}</h4>
              <p className="text-sm text-red-800 leading-relaxed">{copy.rejectedDesc}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg p-6 flex items-start gap-4">
        <span className="material-symbols-outlined text-red-600 mt-0.5">block</span>
        <div className="space-y-1">
          <h4 className="text-base font-bold text-red-900">{copy.blockedTitle}</h4>
          <p className="text-sm text-red-800 leading-relaxed">{copy.blockedDesc}</p>
        </div>
      </div>
    );
  }

  function renderStatusLabel() {
    if (status === "A") return copy.pending;
    if (status === "P") return copy.approved;
    if (status === "R") return copy.rejected;
    return copy.blocked;
  }

  function renderDetailPage() {
    return (
      <main className="flex-grow max-w-5xl mx-auto w-full py-12 px-4" id="main-content">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-[var(--kr-gov-text-primary)] mb-3">{copy.detailTitle}</h2>
          <p className="text-lg text-[var(--kr-gov-text-secondary)]">{copy.detailDesc}</p>
        </div>

        {error ? (
          <div className="mt-6 mb-8 p-4 bg-red-50 border border-red-200 rounded-[8px] text-red-600 font-bold text-center">
            <p>{error}</p>
          </div>
        ) : null}

        {submitted ? (
          <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] shrink-0">check_circle</span>
            <div className="flex-grow">
              <p className="font-bold mb-1">{en ? "Reapplication submitted successfully." : "재신청이 정상적으로 접수되었습니다."}</p>
              <p>
                {submittedCompany || toStringValue(result.insttNm, copy.noData)}
                {en ? " has been resubmitted." : " 재신청이 접수되었습니다."}
                {submittedDate ? ` (${submittedDate})` : ""}
              </p>
            </div>
          </div>
        ) : null}

        {detail?.result ? (
          <>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8" data-help-id="join-company-status-detail-summary">
              <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex justify-between items-center">
                <span className="text-sm font-bold text-[var(--kr-gov-blue)] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  {copy.appNoBadge}: <span>{toStringValue(result.insttId, copy.noData)}</span>
                </span>
                <span className="text-xs text-[var(--kr-gov-text-secondary)] font-medium">{copy.lastUpdated}: <span>{lastUpdated}</span></span>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{copy.companyName}</p>
                  <p className="text-base font-medium text-[var(--kr-gov-text-primary)]">{toStringValue(result.insttNm, copy.noData)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{copy.businessNo}</p>
                  <p className="text-base font-medium text-[var(--kr-gov-text-primary)]">{toStringValue(result.bizrno, copy.noData)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{copy.representative}</p>
                  <p className="text-base font-medium text-[var(--kr-gov-text-primary)]">{toStringValue(result.reprsntNm, copy.noData)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{copy.submittedOn}</p>
                  <p className="text-base font-medium text-[var(--kr-gov-text-primary)]">{toStringValue(result.frstRegistPnttm, copy.noData)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 mb-8" data-help-id="join-company-status-detail-timeline">
              <div className="relative flex justify-between items-center max-w-3xl mx-auto mb-12">
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-lg bg-emerald-500 text-white border-emerald-500">01</div>
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{copy.submitted}</span>
                </div>

                <div className={`flex-grow h-0.5 mx-4 ${status === "A" ? "bg-gray-200" : "bg-emerald-500"}`}></div>

                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-lg ${status === "A" ? "bg-[var(--kr-gov-blue)] text-white border-[var(--kr-gov-blue)]" : "bg-emerald-500 text-white border-emerald-500"}`}>02</div>
                  <span className={`text-sm font-bold ${status === "A" ? "text-[var(--kr-gov-blue)]" : "text-[var(--kr-gov-text-primary)]"}`}>{copy.review}</span>
                </div>

                <div className={`flex-grow h-0.5 mx-4 ${status === "A" ? "bg-gray-200" : status === "R" || status === "X" ? "bg-red-500" : "bg-emerald-500"}`}></div>

                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-lg ${status === "A" ? "bg-white text-gray-400 border-gray-200" : status === "R" || status === "X" ? "bg-red-600 text-white border-red-600" : "bg-[var(--kr-gov-blue)] text-white border-[var(--kr-gov-blue)]"}`}>03</div>
                  <span className={`text-sm font-bold ${status === "A" ? "text-gray-400" : status === "P" ? "text-emerald-600" : "text-red-600"}`}>{renderStatusLabel()}</span>
                </div>
              </div>

              {renderStatusSummary()}

              {rejectReason && rejectReason !== copy.noData ? (
                <div className="border border-red-200 rounded-lg overflow-hidden bg-white mt-4">
                  <div className="bg-red-50 px-6 py-3 border-b border-red-100">
                    <h5 className="text-sm font-bold text-red-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">speaker_notes</span>
                      {copy.rejectReason}
                    </h5>
                  </div>
                  <div className="p-6">
                    <p className="text-base text-[var(--kr-gov-text-primary)] leading-relaxed">{rejectReason}</p>
                    <p className="mt-4 text-xs text-[var(--kr-gov-text-secondary)]">
                      {copy.rejectHandledBy}
                      {rejectAt && rejectAt !== copy.noData ? <span> ({rejectAt})</span> : null}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 mb-12" data-help-id="join-company-status-detail-files">
              <h3 className="text-lg font-bold text-[var(--kr-gov-text-primary)] mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--kr-gov-text-secondary)]">description</span>
                {copy.attachedFiles}
              </h3>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                {files.length > 0 ? files.map((file) => {
                  const fileId = toFileId(file);
                  const fileName = toFileName(file) || copy.noData;
                  return (
                    <li className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors" key={fileId || fileName}>
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-gray-400">attach_file</span>
                        <span className="text-sm font-medium text-[var(--kr-gov-text-primary)]">{fileName}</span>
                      </div>
                      {fileId ? (
                        <HomeButton
                          className="!min-h-0 !border-0 !bg-transparent !p-0 text-[var(--kr-gov-blue)] font-bold text-xs hover:underline hover:!bg-transparent"
                          onClick={() => navigate(`/join/downloadInsttFile?fileId=${encodeURIComponent(fileId)}`)}
                          type="button"
                          variant="ghost"
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                          {copy.download}
                        </HomeButton>
                      ) : null}
                    </li>
                  );
                }) : (
                  <li className="p-4 text-center text-gray-400 text-sm">{copy.noFiles}</li>
                )}
              </ul>
            </div>
          </>
        ) : null}

        <div className="flex items-center justify-center gap-4" data-help-id="join-company-status-detail-actions">
          <HomeButton
            className="px-8 h-14 border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-text-primary)] font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            onClick={() => window.history.back()}
            type="button"
            variant="secondary"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            {copy.back}
          </HomeButton>
          {status === "R" ? (
            <HomeButton
              className="px-10 h-14 bg-[var(--kr-gov-blue)] text-white font-bold rounded-lg hover:bg-[var(--kr-gov-blue-hover)] transition-colors flex items-center gap-2 shadow-lg shadow-blue-100"
              onClick={() => navigate(`${buildLocalizedPath("/join/companyReapply", "/join/en/companyReapply")}?bizNo=${encodeURIComponent(toStringValue(result.bizrno, ""))}&repName=${encodeURIComponent(toStringValue(result.reprsntNm, ""))}`)}
              type="button"
              variant="primary"
            >
              <span className="material-symbols-outlined">edit_note</span>
              {copy.reapply}
            </HomeButton>
          ) : (
            <HomeButton
              className="px-8 h-14 bg-[var(--kr-gov-blue)] text-white font-bold rounded-lg hover:bg-[var(--kr-gov-blue-hover)] transition-colors flex items-center gap-2"
              onClick={goHome}
              type="button"
              variant="primary"
            >
              <span className="material-symbols-outlined">home</span>
              {copy.home}
            </HomeButton>
          )}
        </div>
      </main>
    );
  }

  function renderGuidePage() {
    return (
      <main className="flex-grow max-w-5xl mx-auto w-full py-12 px-4" data-help-id="join-company-status-guide" id="main-content">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-[var(--kr-gov-text-primary)] mb-3">
            {en ? "Membership Application Status Guide" : "회원사 가입 현황 조회 안내"}
          </h2>
          <p className="text-lg text-[var(--kr-gov-text-secondary)]">
            {en
              ? "This guide explains how to review your submitted application and processing status."
              : "신청하신 회원사 가입 내역 및 처리 상태를 확인하는 방법에 대한 안내입니다."}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 mb-8">
          <div className="max-w-none">
            <h3 className="text-xl font-bold mb-4">{en ? "Status Inquiry Process" : "가입 현황 조회 프로세스"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                {
                  step: "01",
                  title: en ? "Submitted" : "신청 완료",
                  description: en ? "The registration request has been successfully received." : "등록 신청이 정상적으로 접수된 상태"
                },
                {
                  step: "02",
                  title: en ? "Review" : "운영자 검토",
                  description: en ? "Submitted documents and organization information are reviewed." : "제출 서류 및 기관 정보 적정성 확인"
                },
                {
                  step: "03",
                  title: en ? "Approved / Rejected" : "승인/반려",
                  description: en ? "The request is either approved or returned for revision." : "최종 가입 승인 또는 보완 요청"
                }
              ].map((item) => (
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 text-center" key={item.step}>
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                    {item.step}
                  </div>
                  <h4 className="font-bold mb-2">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-600">info</span>
                {en ? "Notes" : "참고 사항"}
              </h4>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
                <li>{en ? "Approval usually takes 3 to 5 business days." : "가입 승인까지는 업무일 기준 평균 3~5일이 소요됩니다."}</li>
                <li>{en ? "If rejected, the reason is provided and you may reapply after supplementing the documents." : "반려 시 사유가 함께 안내되며, 서류 보완 후 재신청이 가능합니다."}</li>
                <li>{en ? "After approval, the registered organization can use the formal services." : "승인 완료 후에는 등록하신 정보를 기반으로 정식 서비스를 이용하실 수 있습니다."}</li>
              </ul>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 text-xs font-bold text-gray-500 border-b border-gray-200">
              {en ? "Example Screen Layout" : "화면 구성 예시"}
            </div>
            <div className="p-4 bg-white">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-4">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-600">
                    {en ? "Application No." : "신청 번호"}: APP-20250814-001
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {en ? "Last Updated" : "최종 업데이트"}: 2025.08.15 14:30
                  </span>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400">{en ? "Organization Name" : "신청 기관명"}</p>
                    <p className="text-xs font-medium">{en ? "Eco Energy Solutions Co., Ltd." : "(주)에코에너지 솔루션즈"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400">{en ? "Representative" : "대표자명"}</p>
                    <p className="text-xs font-medium">{en ? "Kim Cheolsu" : "김철수"}</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center max-w-md mx-auto py-4">
                <div className="flex flex-col items-center gap-2 opacity-100">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✔</div>
                  <span className="text-[10px] font-bold">{en ? "Submitted" : "신청 완료"}</span>
                </div>
                <div className="flex-grow h-px bg-emerald-500 mx-2"></div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">02</div>
                  <span className="text-[10px] font-bold text-blue-600">{en ? "Under Review" : "검토 중"}</span>
                </div>
                <div className="flex-grow h-px bg-gray-200 mx-2"></div>
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center text-[10px]">03</div>
                  <span className="text-[10px] font-bold text-gray-400">{en ? "Approved" : "승인 완료"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <HomeButton
            className="px-8 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
            onClick={() => window.close()}
            type="button"
            variant="secondary"
          >
            {en ? "Close Window" : "창 닫기"}
          </HomeButton>
        </div>
      </main>
    );
  }

  function renderSearchPage() {
    return (
      <main className="flex-grow py-12 px-4" id="main-content">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-black text-[var(--kr-gov-text-primary)] mb-4">{copy.searchTitle}</h2>
          <p className="text-[var(--kr-gov-text-secondary)] text-lg leading-relaxed">{copy.searchDesc}</p>
          {error ? (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-[var(--kr-gov-radius)] text-red-600 font-bold">
              <p>{error}</p>
            </div>
          ) : null}
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-12 bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm overflow-hidden" data-help-id="join-company-status-search">
            <div className="flex h-14" role="tablist" aria-label={en ? "Search method" : "조회 방식 선택"}>
              <button
                aria-selected={mode === "biz"}
                className={`flex-1 text-[16px] ${mode === "biz" ? "tab-active" : "tab-inactive"}`}
                onClick={() => setMode("biz")}
                role="tab"
                tabIndex={mode === "biz" ? 0 : -1}
                type="button"
              >
                {copy.tabBiz}
              </button>
              <button
                aria-selected={mode === "app"}
                className={`flex-1 text-[16px] ${mode === "app" ? "tab-active" : "tab-inactive"}`}
                onClick={() => setMode("app")}
                role="tab"
                tabIndex={mode === "app" ? 0 : -1}
                type="button"
              >
                {copy.tabApp}
              </button>
            </div>
            <div className="p-8 lg:p-10">
              <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); handleSearch(); }}>
                <div className="space-y-5">
                  {mode === "biz" ? (
                    <div id="input-biz">
                      <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="biz-no">
                        {copy.bizNo} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <HomeInput
                          autoComplete="off"
                          className="flex-1 h-14 px-4 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] focus:ring-2 focus:ring-[var(--kr-gov-focus)] focus:border-transparent"
                          id="biz-no"
                          inputMode="numeric"
                          maxLength={10}
                          onChange={(event) => setBizNo(event.target.value.replace(/\D/g, ""))}
                          placeholder={copy.bizPlaceholder}
                          type="text"
                          value={bizNo}
                        />
                      </div>
                    </div>
                  ) : null}
                  {mode === "app" ? (
                    <div id="input-app">
                      <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="app-no">
                        {copy.appNo} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <HomeInput
                          autoComplete="off"
                          className="flex-1 h-14 px-4 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] focus:ring-2 focus:ring-[var(--kr-gov-focus)] focus:border-transparent"
                          id="app-no"
                          onChange={(event) => setAppNo(event.target.value)}
                          placeholder={copy.appPlaceholder}
                          type="text"
                          value={appNo}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="rep-name">
                      {copy.repName} <span className="text-red-500">*</span>
                    </label>
                    <HomeInput
                      autoComplete="name"
                      className="w-full h-14 px-4 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] focus:ring-2 focus:ring-[var(--kr-gov-focus)] focus:border-transparent"
                      id="rep-name"
                      onChange={(event) => setRepName(event.target.value)}
                      placeholder={copy.repPlaceholder}
                      type="text"
                      value={repName}
                    />
                  </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
                  <div className="flex items-start gap-4">
                    <div className="pt-1">
                      <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">security</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm mb-1">{copy.verifyTitle}</h4>
                      <p className="text-xs text-[var(--kr-gov-text-secondary)] mb-4">{copy.verifyDesc}</p>
                      <HomeButton
                        className="flex items-center gap-2 px-4 py-3 bg-white border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] hover:bg-gray-50 transition-colors w-full justify-center font-bold text-sm"
                        onClick={() => window.alert(copy.verifyAlert)}
                        type="button"
                        variant="secondary"
                      >
                        <span className="material-symbols-outlined text-[18px]">smartphone</span>
                        {copy.verifyButton}
                      </HomeButton>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-start cursor-pointer group">
                    <HomeCheckbox
                      checked={agreed}
                      className="mt-1 w-5 h-5 rounded border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] focus:ring-[var(--kr-gov-focus)]"
                      onChange={(event) => setAgreed(event.target.checked)}
                    />
                    <span className="ml-3 text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">{copy.agree}</span>
                  </label>
                </div>
                <HomeButton
                  className="w-full h-16 bg-[var(--kr-gov-blue)] text-white text-xl font-bold rounded-[var(--kr-gov-radius)] hover:bg-[var(--kr-gov-blue-hover)] transition-colors shadow-lg"
                  type="submit"
                  size="lg"
                  variant="primary"
                >
                  {copy.search}
                </HomeButton>
              </form>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <HomeLinkButton className="skip-link !min-h-0 !border-0 !bg-[var(--kr-gov-blue)] !p-3 !text-white hover:!bg-[var(--kr-gov-blue)]" href="#main-content" variant="ghost">{copy.skip}</HomeLinkButton>

      <div className="bg-white border-b border-[var(--kr-gov-border-light)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img alt={en ? "Emblem of the Republic of Korea" : "대한민국 정부 상징"} className="h-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8BPzqtzSLVGSrjt4mzhhVBy9SocCRDssk1F3XRVu7Xq9jHh7qzzt48wFi8qduCiJmB0LRQczPB7waPe3h0gkjn3jOEDxt6UJSJjdXNf8P-4WlM2BEZrfg2SL91uSiZrFcCk9KYrsdg-biTS9dtJ_OIghDBEVoAzMc33XcCYR_UP0QQdoYzBe840YrtH40xGyB9MSr0QH4D0foqlvOhG0jX8CDayXNlDsSKlfClVd3K2aodlwg4xSxgXHB3vnnnA0L2yNBNihQQg0" />
            <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">{copy.govService}</span>
          </div>
        </div>
      </div>

      <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3 shrink-0">
              <HomeButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-inherit hover:!bg-transparent flex items-center gap-2 focus-visible" onClick={goHome} type="button" variant="ghost">
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>eco</span>
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold tracking-tight text-[var(--kr-gov-text-primary)] leading-none">{copy.logoTitle}</h1>
                  <p className="text-[9px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider mt-1">{copy.logoSub}</p>
                </div>
              </HomeButton>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                <HomeButton className={`px-3 py-1 text-xs font-bold ${en ? "!bg-white !text-[var(--kr-gov-text-secondary)] hover:!bg-gray-100" : "!bg-[var(--kr-gov-blue)] !text-white"}`} onClick={() => changeLanguage(false)} size="xs" type="button" variant="ghost">KO</HomeButton>
                <HomeButton className={`px-3 py-1 text-xs font-bold border-l border-[var(--kr-gov-border-light)] ${en ? "!bg-[var(--kr-gov-blue)] !text-white" : "!bg-white !text-[var(--kr-gov-text-secondary)] hover:!bg-gray-100"}`} onClick={() => changeLanguage(true)} size="xs" type="button" variant="ghost">EN</HomeButton>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isGuidePage ? renderGuidePage() : isDetailPage ? renderDetailPage() : renderSearchPage()}
    </div>
  );
}
