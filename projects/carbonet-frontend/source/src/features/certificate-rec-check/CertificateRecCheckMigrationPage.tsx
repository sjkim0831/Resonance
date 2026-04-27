import { useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedCertificateRecCheckPageData } from "../../lib/api/bootstrap";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, MemberLinkButton } from "../member/common";

type DuplicateStatus = "REVIEW" | "BLOCKED" | "CLEARED";
type MatchBasis = "SERIAL" | "REGISTRY" | "PERIOD";

type DuplicateGroup = {
  id: string;
  recNo: string;
  projectName: string;
  companyName: string;
  issuanceWindow: string;
  duplicateCount: number;
  riskScore: number;
  matchBasis: MatchBasis;
  status: DuplicateStatus;
  lastCheckedAt: string;
  actionOwner: string;
  reason: { ko: string; en: string };
  comparedCertificates: Array<{ certificateId: string; companyName: string; status: string }>;
};

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("BLOCK") || upper.includes("HIGH")) return "bg-red-100 text-red-700";
  if (upper.includes("REVIEW") || upper.includes("WARN") || upper.includes("REGISTRY")) return "bg-amber-100 text-amber-700";
  if (upper.includes("CLEAR") || upper.includes("LOW") || upper.includes("PERIOD")) return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status: DuplicateStatus, en: boolean) {
  if (status === "BLOCKED") return en ? "Issuance Blocked" : "발급 차단";
  if (status === "CLEARED") return en ? "Cleared" : "해소";
  return en ? "Under Review" : "검토 중";
}

function basisLabel(basis: MatchBasis, en: boolean) {
  if (basis === "SERIAL") return en ? "Serial overlap" : "일련번호 중복";
  if (basis === "REGISTRY") return en ? "Registry collision" : "등록원장 충돌";
  return en ? "Period overlap" : "발급기간 중첩";
}

function companyStatusLabel(value: string, en: boolean) {
  if (value === "BLOCKED") return en ? "Blocked" : "차단";
  if (value === "PENDING") return en ? "Pending" : "보류";
  return en ? "Eligible" : "발급 가능";
}

function buildDuplicateGroups(): DuplicateGroup[] {
  return [
    {
      id: "REC-DUP-240330-01",
      recNo: "REC-2026-001248",
      projectName: "여수 바이오매스 열병합",
      companyName: "한빛에너지",
      issuanceWindow: "2026-03-01 ~ 2026-03-15",
      duplicateCount: 3,
      riskScore: 98,
      matchBasis: "SERIAL",
      status: "BLOCKED",
      lastCheckedAt: "2026-03-30 09:15",
      actionOwner: "운영1팀 김주임",
      reason: {
        ko: "동일 REC 번호가 발급 검토 2건과 이의신청 반영 1건에 동시에 연결되었습니다.",
        en: "The same REC number is attached to two review cases and one objection reflection case."
      },
      comparedCertificates: [
        { certificateId: "CERT-REVIEW-0912", companyName: "한빛에너지", status: "BLOCKED" },
        { certificateId: "CERT-OBJ-0311", companyName: "한빛에너지", status: "PENDING" },
        { certificateId: "CERT-REVIEW-0840", companyName: "동해그린파워", status: "PENDING" }
      ]
    },
    {
      id: "REC-DUP-240330-02",
      recNo: "REC-2026-001091",
      projectName: "포항 수소환원 제철",
      companyName: "에코스틸",
      issuanceWindow: "2026-02-21 ~ 2026-03-04",
      duplicateCount: 2,
      riskScore: 84,
      matchBasis: "REGISTRY",
      status: "REVIEW",
      lastCheckedAt: "2026-03-30 08:42",
      actionOwner: "심사팀 박대리",
      reason: {
        ko: "등록원장 기준 감축량 합계는 같지만 서로 다른 신청번호로 재검토 요청이 접수되었습니다.",
        en: "The registry reduction total matches, but two different application numbers were submitted for re-review."
      },
      comparedCertificates: [
        { certificateId: "CERT-REVIEW-0868", companyName: "에코스틸", status: "PENDING" },
        { certificateId: "CERT-REISSUE-0023", companyName: "에코스틸", status: "ELIGIBLE" }
      ]
    },
    {
      id: "REC-DUP-240330-03",
      recNo: "REC-2026-000774",
      projectName: "서남권 해상풍력 연계",
      companyName: "그린웨이브",
      issuanceWindow: "2026-01-10 ~ 2026-01-31",
      duplicateCount: 2,
      riskScore: 41,
      matchBasis: "PERIOD",
      status: "CLEARED",
      lastCheckedAt: "2026-03-29 18:10",
      actionOwner: "심사팀 오과장",
      reason: {
        ko: "동일 기간으로 보였으나 모니터링 보고서 버전 정정으로 실제 발급 구간이 분리되었습니다.",
        en: "The periods initially looked identical, but a monitoring report revision separated the actual issuance windows."
      },
      comparedCertificates: [
        { certificateId: "CERT-REVIEW-0741", companyName: "그린웨이브", status: "ELIGIBLE" },
        { certificateId: "CERT-REISSUE-0018", companyName: "그린웨이브", status: "ELIGIBLE" }
      ]
    }
  ];
}

function normalizeDuplicateGroups(payload: unknown): DuplicateGroup[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map((item, index) => {
    const row = item as Record<string, unknown>;
    const reason = (row.reason as Record<string, unknown> | undefined) || {};
    const comparedCertificates = Array.isArray(row.comparedCertificates)
      ? row.comparedCertificates.map((certificate) => {
        const value = certificate as Record<string, unknown>;
        return {
          certificateId: String(value.certificateId || ""),
          companyName: String(value.companyName || ""),
          status: String(value.status || "")
        };
      })
      : [];
    return {
      id: String(row.id || `REC-DUP-${index}`),
      recNo: String(row.recNo || ""),
      projectName: String(row.projectName || ""),
      companyName: String(row.companyName || ""),
      issuanceWindow: String(row.issuanceWindow || ""),
      duplicateCount: Number(row.duplicateCount || 0),
      riskScore: Number(row.riskScore || 0),
      matchBasis: String(row.matchBasis || "PERIOD") as MatchBasis,
      status: String(row.status || "REVIEW") as DuplicateStatus,
      lastCheckedAt: String(row.lastCheckedAt || ""),
      actionOwner: String(row.actionOwner || ""),
      reason: {
        ko: String(reason.ko || ""),
        en: String(reason.en || "")
      },
      comparedCertificates
    };
  });
}

export function CertificateRecCheckMigrationPage() {
  const en = isEnglish();
  const bootstrappedPage = useMemo(() => readBootstrappedCertificateRecCheckPageData(), []);
  const groups = useMemo(() => {
    const bootstrappedGroups = normalizeDuplicateGroups(bootstrappedPage?.duplicateGroups);
    return bootstrappedGroups.length ? bootstrappedGroups : buildDuplicateGroups();
  }, [bootstrappedPage]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<DuplicateStatus | "ALL">("ALL");
  const [basis, setBasis] = useState<MatchBasis | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState(groups[0]?.id || "");

  const filteredGroups = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return groups.filter((group) => {
      const haystack = [group.id, group.recNo, group.projectName, group.companyName, group.actionOwner].join(" ").toLowerCase();
      return (!normalizedKeyword || haystack.includes(normalizedKeyword))
        && (status === "ALL" || group.status === status)
        && (basis === "ALL" || group.matchBasis === basis);
    });
  }, [basis, groups, keyword, status]);

  const selectedGroup = filteredGroups.find((group) => group.id === selectedId) || filteredGroups[0] || null;
  const blockedCount = groups.filter((group) => group.status === "BLOCKED").length;
  const reviewCount = groups.filter((group) => group.status === "REVIEW").length;
  const highestRisk = groups.reduce((max, group) => Math.max(max, group.riskScore), 0);

  useEffect(() => {
    if (!filteredGroups.length) {
      if (selectedId) {
        setSelectedId("");
      }
      return;
    }
    if (!filteredGroups.some((group) => group.id === selectedId)) {
      setSelectedId(filteredGroups[0].id);
    }
  }, [filteredGroups, selectedId]);

  useEffect(() => {
    logGovernanceScope("PAGE", "certificate-rec-check", {
      route: window.location.pathname,
      keyword,
      status,
      basis,
      totalCount: groups.length,
      filteredCount: filteredGroups.length,
      selectedGroupId: selectedGroup?.id || "",
      blockedCount,
      reviewCount,
      highestRisk
    });
    logGovernanceScope("COMPONENT", "certificate-rec-check-table", {
      component: "certificate-rec-check-table",
      filteredCount: filteredGroups.length,
      selectedGroupId: selectedGroup?.id || ""
    });
  }, [basis, blockedCount, filteredGroups.length, groups.length, highestRisk, keyword, reviewCount, selectedGroup?.id, status]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Certification" : "인증" },
        { label: en ? "REC Duplicate Check" : "REC 중복 확인" }
      ]}
      title={en ? "REC Duplicate Check" : "REC 중복 확인"}
      subtitle={en ? "Detect overlapping issuance candidates before certificate review or objection processing moves forward." : "발급 검토와 이의신청 처리 전에 REC 중복 후보를 선제적으로 차단하는 운영 화면입니다."}
      actions={(
        <div className="flex flex-wrap items-center gap-2">
          <MemberLinkButton href={buildLocalizedPath("/admin/certificate/review", "/en/admin/certificate/review")} variant="secondary">{en ? "Issuance Review" : "발급 검토"}</MemberLinkButton>
          <MemberLinkButton href={buildLocalizedPath("/admin/certificate/objection_list", "/en/admin/certificate/objection_list")} variant="secondary">{en ? "Objections" : "이의신청 처리"}</MemberLinkButton>
          <MemberLinkButton href={buildLocalizedPath("/admin/certificate/statistics", "/en/admin/certificate/statistics")} variant="primary">{en ? "Certificate Statistics" : "인증서 통계"}</MemberLinkButton>
        </div>
      )}
    >
      <AdminWorkspacePageFrame>
        <PageStatusNotice tone="warning">
          {en
            ? "This menu is implemented as an operational workspace first. Backend detection APIs and persistent adjudication history can be connected next."
            : "이 메뉴는 우선 운영용 워크스페이스로 구현했습니다. 다음 단계에서 백엔드 중복 탐지 API와 판정 이력을 연결하면 됩니다."}
        </PageStatusNotice>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="certificate-rec-check-summary">
          <SummaryMetricCard title={en ? "Duplicate Groups" : "중복 그룹"} value={String(groups.length)} description={en ? "Total active or resolved groups in current sample" : "현재 샘플 기준 검출 그룹 수"} />
          <SummaryMetricCard title={en ? "Issuance Blocked" : "발급 차단"} value={String(blockedCount)} description={en ? "Groups currently preventing issuance" : "현재 발급 차단 상태"} />
          <SummaryMetricCard title={en ? "Under Review" : "검토 중"} value={String(reviewCount)} description={en ? "Cases waiting for operator decision" : "담당자 판정 대기 건"} />
          <SummaryMetricCard title={en ? "Highest Risk" : "최고 위험도"} value={String(highestRisk)} description={en ? "Maximum risk score in active queue" : "활성 큐 내 최대 위험 점수"} />
        </section>

        <CollectionResultPanel data-help-id="certificate-rec-check-filters" title={en ? "Detection Filters" : "탐지 조건"} description={en ? "Search duplicate groups by REC number, company, or review owner, then narrow by basis and status." : "REC 번호, 회사명, 담당자 기준으로 그룹을 찾고 탐지 근거와 상태로 범위를 좁힙니다."} icon="rule_folder">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[68rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="recCheckKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput id="recCheckKeyword" placeholder={en ? "REC no, project, company, owner" : "REC 번호, 사업명, 회사명, 담당자"} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="recCheckStatus">{en ? "Status" : "상태"}</label>
              <AdminSelect id="recCheckStatus" value={status} onChange={(event) => setStatus(event.target.value as DuplicateStatus | "ALL")}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="REVIEW">{en ? "Under Review" : "검토 중"}</option>
                <option value="BLOCKED">{en ? "Issuance Blocked" : "발급 차단"}</option>
                <option value="CLEARED">{en ? "Cleared" : "해소"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="recCheckBasis">{en ? "Basis" : "탐지 근거"}</label>
              <AdminSelect id="recCheckBasis" value={basis} onChange={(event) => setBasis(event.target.value as MatchBasis | "ALL")}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="SERIAL">{en ? "Serial overlap" : "일련번호 중복"}</option>
                <option value="REGISTRY">{en ? "Registry collision" : "등록원장 충돌"}</option>
                <option value="PERIOD">{en ? "Period overlap" : "발급기간 중첩"}</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-outline w-full" onClick={() => { setKeyword(""); setStatus("ALL"); setBasis("ALL"); }} type="button">{en ? "Reset Filters" : "조건 초기화"}</button>
            </div>
          </div>
        </CollectionResultPanel>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr,1fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="certificate-rec-check-table">
            <GridToolbar title={en ? "Duplicate Detection Queue" : "중복 탐지 큐"} meta={en ? `Showing ${filteredGroups.length} of ${groups.length} groups` : `전체 ${groups.length}건 중 ${filteredGroups.length}건 표시`} actions={<span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Refresh sample: ${String(bootstrappedPage?.lastRefreshedAt || "2026-03-30 09:20")}` : `샘플 갱신: ${String(bootstrappedPage?.lastRefreshedAt || "2026-03-30 09:20")}`}</span>} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                  <tr>
                    <th className="px-4 py-3">{en ? "Group" : "그룹"}</th>
                    <th className="px-4 py-3">REC</th>
                    <th className="px-4 py-3">{en ? "Project / Company" : "사업 / 회사"}</th>
                    <th className="px-4 py-3">{en ? "Basis" : "근거"}</th>
                    <th className="px-4 py-3">{en ? "Risk" : "위험도"}</th>
                    <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                    <th className="px-4 py-3">{en ? "Checked" : "최종 점검"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group) => (
                    <tr className={`cursor-pointer border-t border-[var(--kr-gov-border-light)] ${selectedGroup?.id === group.id ? "bg-slate-50" : "bg-white"}`} key={group.id} onClick={() => setSelectedId(group.id)}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[var(--kr-gov-blue)]">{group.id}</p>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{en ? `${group.duplicateCount} linked certificates` : `${group.duplicateCount}건 연결`}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{group.recNo}</td>
                      <td className="px-4 py-3"><p className="font-semibold text-[var(--kr-gov-text-primary)]">{group.projectName}</p><p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{group.companyName}</p></td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(group.matchBasis)}`}>{basisLabel(group.matchBasis, en)}</span></td>
                      <td className="px-4 py-3 font-black">{group.riskScore}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(group.status)}`}>{statusLabel(group.status, en)}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">{group.lastCheckedAt}</td>
                    </tr>
                  ))}
                  {filteredGroups.length === 0 ? <tr className="border-t border-[var(--kr-gov-border-light)]"><td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={7}>{en ? "No duplicate groups match the current filters." : "현재 조건에 맞는 중복 그룹이 없습니다."}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </article>

          <div className="space-y-4">
            <CollectionResultPanel data-help-id="certificate-rec-check-detail" title={en ? "Selected Group Detail" : "선택 그룹 상세"} description={en ? "Review duplicate rationale before moving to review, pending queue, or objection handling." : "발급 검토, 발급 대기 목록, 이의신청 처리로 이동하기 전에 중복 판단 근거를 확인합니다."} icon="assignment">
              {selectedGroup ? (
                <div className="space-y-4">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-blue)]">{selectedGroup.id}</p>
                        <h3 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{selectedGroup.recNo}</h3>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(selectedGroup.status)}`}>{statusLabel(selectedGroup.status, en)}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Project" : "사업명"}</dt><dd className="mt-1 font-semibold">{selectedGroup.projectName}</dd></div>
                      <div><dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Company" : "회사"}</dt><dd className="mt-1 font-semibold">{selectedGroup.companyName}</dd></div>
                      <div><dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Issuance Window" : "발급 구간"}</dt><dd className="mt-1 font-semibold">{selectedGroup.issuanceWindow}</dd></div>
                      <div><dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Review Owner" : "담당자"}</dt><dd className="mt-1 font-semibold">{selectedGroup.actionOwner}</dd></div>
                    </dl>
                    <p className="mt-4 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? selectedGroup.reason.en : selectedGroup.reason.ko}</p>
                  </div>

                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Compared Certificates" : "비교 대상 인증서"}</h4>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(selectedGroup.matchBasis)}`}>{basisLabel(selectedGroup.matchBasis, en)}</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedGroup.comparedCertificates.map((certificate) => (
                        <article className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3" key={certificate.certificateId}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[var(--kr-gov-text-primary)]">{certificate.certificateId}</p>
                              <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{certificate.companyName}</p>
                            </div>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(certificate.status)}`}>{companyStatusLabel(certificate.status, en)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              ) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a duplicate group from the queue." : "탐지 큐에서 중복 그룹을 선택하세요."}</p>}
            </CollectionResultPanel>

            <CollectionResultPanel data-help-id="certificate-rec-check-guidance" title={en ? "Operator Guidance" : "운영 가이드"} description={en ? "Keep the same disposition flow so review, objection, and blocked issuance data stay aligned." : "발급 검토, 이의신청, 차단 이력이 같은 기준으로 정렬되도록 동일한 판정 흐름을 유지합니다."} icon="fact_check">
              <div className="space-y-3 text-sm text-[var(--kr-gov-text-secondary)]">
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
                  <p className="font-black text-[var(--kr-gov-text-primary)]">{en ? "1. Block first when serials collide" : "1. 일련번호 충돌은 우선 차단"}</p>
                  <p className="mt-1">{en ? "If the same REC serial appears across two active certificate flows, freeze issuance before manual review." : "동일 REC 일련번호가 활성 인증 흐름 두 건 이상에 잡히면 수동 검토 전 발급을 먼저 차단합니다."}</p>
                </article>
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
                  <p className="font-black text-[var(--kr-gov-text-primary)]">{en ? "2. Tie objection handling to the same group id" : "2. 이의신청은 동일 그룹 ID로 연결"}</p>
                  <p className="mt-1">{en ? "Do not create a new adjudication thread for the same REC. Reuse the duplicate group id so audit and pending-queue history remain contiguous." : "같은 REC에 대해 별도 판정 스레드를 만들지 말고 동일 그룹 ID를 재사용해 감사 로그와 발급 대기 이력을 연속성 있게 유지합니다."}</p>
                </article>
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
                  <p className="font-black text-[var(--kr-gov-text-primary)]">{en ? "3. Clear only after source evidence changes" : "3. 원천 증빙 변경 후에만 해소"}</p>
                  <p className="mt-1">{en ? "A group should move to cleared only after registry, monitoring report, or issuance period evidence has been updated." : "등록원장, 모니터링 보고서, 발급 기간 근거가 실제로 수정된 뒤에만 해소 상태로 전환합니다."}</p>
                </article>
              </div>
            </CollectionResultPanel>

            <CollectionResultPanel data-help-id="certificate-rec-check-links" title={en ? "Follow-up Links" : "후속 화면 이동"} description={en ? "Open adjacent screens without leaving the duplicate investigation context." : "중복 조사 맥락을 유지한 채 인접 운영 화면으로 이동합니다."} icon="link">
              <div className="grid grid-cols-1 gap-3">
                <MemberLinkButton href={buildLocalizedPath("/admin/certificate/pending_list", "/en/admin/certificate/pending_list")} variant="secondary">{en ? "Pending Queue" : "발급 대기 목록"}</MemberLinkButton>
                <MemberLinkButton href={buildLocalizedPath("/admin/certificate/approve", "/en/admin/certificate/approve")} variant="secondary">{en ? "Rejection Reason Management" : "반려 사유 관리"}</MemberLinkButton>
                <MemberLinkButton href={buildLocalizedPath("/admin/certificate/audit-log", "/en/admin/certificate/audit-log")} variant="secondary">{en ? "Audit Log" : "감사 로그"}</MemberLinkButton>
              </div>
            </CollectionResultPanel>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
