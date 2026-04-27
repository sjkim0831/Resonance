import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchCompanyDetailPage } from "../../lib/api/adminMember";
import type { CompanyDetailPagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath, getSearchParam } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { LookupContextStrip, MemberLinkButton, MemberButtonGroup, MEMBER_BUTTON_LABELS, PageStatusNotice } from "../member/common";
import { DetailSummaryCard, MemberSectionCard, MemberStateCard } from "../member/sections";

function resolveInitialInsttId() {
  if (typeof window === "undefined") return "";
  return getSearchParam("insttId");
}

function formatBytes(value: unknown) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "-";
  }
  return `${numeric.toLocaleString("ko-KR")} bytes`;
}

export function CompanyDetailMigrationPage() {
  const initialInsttId = resolveInitialInsttId();
  const [insttId, setInsttId] = useState(initialInsttId);
  const [page, setPage] = useState<CompanyDetailPagePayload | null>(null);
  const [error, setError] = useState("");

  async function load(target: string) {
    if (!target.trim()) {
      setError("기관 ID가 없습니다.");
      return;
    }
    const payload = await fetchCompanyDetailPage(target.trim());
    setPage(payload);
    setInsttId(target.trim());
    setError("");
  }

  useEffect(() => {
    if (initialInsttId) {
      load(initialInsttId).catch((nextError: Error) => setError(nextError.message));
    }
  }, []);

  const company = (page?.company || {}) as Record<string, unknown>;
  const companyFiles = (page?.companyFiles || []) as Array<Record<string, unknown>>;
  const loading = !page && !error;
  const canView = !!page?.canViewCompanyDetail;
  const hasCompany = !!page?.company;

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "company-detail", {
      route: window.location.pathname,
      insttId,
      canView: !!page.canViewCompanyDetail,
      canUseEditLink: !!page.canUseCompanyEditLink,
      companyType: String(page.companyTypeLabel || ""),
      companyStatus: String(page.companyStatusLabel || "")
    });
    logGovernanceScope("COMPONENT", "company-detail-files", {
      component: "company-detail-files",
      fileCount: companyFiles.length,
      insttId
    });
  }, [companyFiles.length, insttId, page]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "회원관리" },
        { label: "회원사" },
        { label: "회원사 상세" }
      ]}
      subtitle="회원사 신청 정보와 첨부파일을 읽기 전용으로 확인합니다."
      title="회원사 상세"
      loading={loading}
      loadingLabel="회원사 상세 정보를 불러오는 중입니다."
      actions={(
        <MemberButtonGroup>
          <MemberLinkButton href={buildLocalizedPath("/admin/member/company_list", "/en/admin/member/company_list")} icon="list" variant="secondary">
            목록
          </MemberLinkButton>
          <MemberLinkButton href={buildLocalizedPath(`/admin/member/company_account?insttId=${encodeURIComponent(insttId)}`, `/en/admin/member/company_account?insttId=${encodeURIComponent(insttId)}`)} icon="edit" variant="primary">
            수정
          </MemberLinkButton>
        </MemberButtonGroup>
      )}
    >
      {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
      {page?.companyDetailError ? <PageStatusNotice tone="error">{String(page.companyDetailError)}</PageStatusNotice> : null}
      {!loading && !initialInsttId.trim() ? (
        <MemberStateCard description="전달된 기관 ID 또는 조회 결과를 확인해 주세요." icon="person_search" title="회원사 정보를 찾을 수 없습니다." />
      ) : null}
      {!loading && initialInsttId.trim() && !hasCompany ? (
        <MemberStateCard description={`요청한 기관 ID: ${initialInsttId}`} icon="person_search" title="회원사 정보를 찾을 수 없습니다." />
      ) : null}
      {!loading && !!page && hasCompany && !canView ? (
        <MemberStateCard description="현재 계정으로는 회원사 상세 화면을 조회할 수 없습니다." icon="lock" title="권한이 없습니다." tone="warning" />
      ) : null}
      {canView && hasCompany ? (
        <>
        <LookupContextStrip
          action={(
            <MemberLinkButton href={buildLocalizedPath(`/admin/member/company_account?insttId=${encodeURIComponent(insttId)}`, `/en/admin/member/company_account?insttId=${encodeURIComponent(insttId)}`)} variant="secondary">
              {MEMBER_BUTTON_LABELS.edit}
            </MemberLinkButton>
          )}
          data-help-id="company-detail-lookup"
          value={<>insttId: {insttId || "-"}</>}
        />
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <DetailSummaryCard
            className="gov-card xl:col-span-1"
            data-help-id="company-detail-summary"
            badges={(
              <>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[12px] font-bold text-[var(--kr-gov-blue)]">
                  {String(page?.companyTypeLabel || "-")}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${String(page?.companyStatusBadgeClass || "bg-gray-100 text-gray-700")}`}>
                  {String(page?.companyStatusLabel || "-")}
                </span>
              </>
            )}
            icon="apartment"
            metaRows={[
              { label: "신청번호", value: String(company.insttId || "-") },
              { label: "등록일시", value: String(company.frstRegistPnttm || "-") },
              { label: "최종수정일시", value: String(company.lastUpdtPnttm || "-") }
            ]}
            title={String(company.insttNm || "-")}
          />

          <div className="flex flex-col gap-8 xl:col-span-2">
            <MemberSectionCard className="gov-card" icon="business" title="사업자 정보">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="gov-label">기관/기업명</label>
                  <div className="gov-readonly">{String(company.insttNm || "-")}</div>
                </div>
                <div>
                  <label className="gov-label">사업자등록번호</label>
                  <div className="gov-readonly">{String(company.bizrno || "-")}</div>
                </div>
                <div>
                  <label className="gov-label">대표자명</label>
                  <div className="gov-readonly">{String(company.reprsntNm || "-")}</div>
                </div>
                <div>
                  <label className="gov-label">우편번호</label>
                  <div className="gov-readonly">{String(company.zip || "-")}</div>
                </div>
                <div>
                  <label className="gov-label">회원유형</label>
                  <div className="gov-readonly">{String(page?.companyTypeLabel || "-")}</div>
                </div>
                <div className="md:col-span-2">
                  <label className="gov-label">주소</label>
                  <div className="gov-readonly">{String(company.adres || "-")}</div>
                </div>
                <div className="md:col-span-2">
                  <label className="gov-label">상세 주소</label>
                  <div className="gov-readonly">{String(company.detailAdres || "-")}</div>
                </div>
              </div>
            </MemberSectionCard>

            <MemberSectionCard className="gov-card" icon="person" title="담당자 정보">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="gov-label">담당자 성명</label>
                  <div className="gov-readonly">{String(company.chargerNm || "-")}</div>
                </div>
                <div>
                  <label className="gov-label">이메일</label>
                  <div className="gov-readonly">{String(company.chargerEmail || "-")}</div>
                </div>
                <div className="md:col-span-2">
                  <label className="gov-label">연락처</label>
                  <div className="gov-readonly">{String(company.chargerTel || "-")}</div>
                </div>
              </div>
            </MemberSectionCard>

            <MemberSectionCard className="gov-card" data-help-id="company-detail-files" icon="upload_file" title="첨부 파일">
              <div className="overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
                <table className="w-full text-sm">
                  <thead className="bg-[#f8f9fa] text-left">
                    <tr>
                      <th className="px-4 py-3">순번</th>
                      <th className="px-4 py-3">파일명</th>
                      <th className="px-4 py-3">확장자</th>
                      <th className="px-4 py-3">크기</th>
                      <th className="px-4 py-3">등록일시</th>
                      <th className="px-4 py-3 text-center">다운로드</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {companyFiles.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>저장된 첨부 파일이 없습니다.</td>
                      </tr>
                    ) : companyFiles.map((file, index) => {
                      const fileId = String(file.fileId || "");
                      const downloadUrl = fileId
                        ? buildLocalizedPath(`/admin/member/company-file?fileId=${encodeURIComponent(fileId)}&download=true`, `/en/admin/member/company-file?fileId=${encodeURIComponent(fileId)}&download=true`)
                        : "#";
                      return (
                        <tr key={`${fileId || "file"}-${index}`}>
                          <td className="px-4 py-3">{String(file.fileSn || index + 1)}</td>
                          <td className="px-4 py-3 font-medium">{String(file.orignlFileNm || "-")}</td>
                          <td className="px-4 py-3">{String(file.fileExtsn || "-")}</td>
                          <td className="px-4 py-3">{formatBytes(file.fileMg)}</td>
                          <td className="px-4 py-3">{String(file.regDate || "-")}</td>
                          <td className="px-4 py-3 text-center">
                            <MemberLinkButton data-action="download" href={downloadUrl} icon="download" size="xs" variant="secondary">
                              {MEMBER_BUTTON_LABELS.download}
                            </MemberLinkButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </MemberSectionCard>
          </div>
        </div>
        </>
      ) : null}
    </AdminPageShell>
  );
}
