import { useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { readBootstrappedNewPagePageData } from "../../lib/api/bootstrap";
import { fetchNewPagePage } from "../../lib/api/platform";
import type { NewPagePagePayload } from "../../lib/api/platformTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, DiagnosticCard, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { numberOf, stringOf } from "../admin-system/adminSystemShared";

type StarterTrack = {
  id: string;
  nameKo: string;
  nameEn: string;
  ownerKo: string;
  ownerEn: string;
  status: "READY" | "PENDING" | "BLOCKED";
  priority: "P1" | "P2" | "P3";
  surfaceKo: string;
  surfaceEn: string;
  summaryKo: string;
  summaryEn: string;
  deliverablesKo: string[];
  deliverablesEn: string[];
};

const starterTracks: StarterTrack[] = [
  {
    id: "list",
    nameKo: "목록 화면 초안",
    nameEn: "List Screen Draft",
    ownerKo: "프론트엔드",
    ownerEn: "Frontend",
    status: "READY",
    priority: "P1",
    surfaceKo: "검색 + 테이블 + 액션바",
    surfaceEn: "Search + Table + Action Bar",
    summaryKo: "메뉴, 기능, 매니페스트 메타가 살아 있으므로 목록형 운영 화면으로 바로 확장하기 좋습니다.",
    summaryEn: "Menu, feature, and manifest metadata are now live, so a list-first admin screen is the safest next slice.",
    deliverablesKo: ["검색 조건 정의", "결과 컬럼 정의", "선택 행 요약 카드 연결"],
    deliverablesEn: ["Define search fields", "Define result columns", "Connect selected-row summary"]
  },
  {
    id: "detail",
    nameKo: "상세 패널 초안",
    nameEn: "Detail Panel Draft",
    ownerKo: "백엔드 + 프론트엔드",
    ownerEn: "Backend + Frontend",
    status: "PENDING",
    priority: "P2",
    surfaceKo: "선택 행 상세 + 상태 배지",
    surfaceEn: "Selected row detail + status badges",
    summaryKo: "읽기 전용 상세를 붙이면 저장 전에도 API 계약을 안정화할 수 있습니다.",
    summaryEn: "A read-only detail panel will stabilize the API contract before any mutation flow is introduced.",
    deliverablesKo: ["상세 필드 정의", "관련 이력 연결", "상태 배지 규칙 정리"],
    deliverablesEn: ["Define detail fields", "Connect related history", "Lock status badge rules"]
  },
  {
    id: "workflow",
    nameKo: "저장/승인 워크플로우",
    nameEn: "Save / Approval Workflow",
    ownerKo: "백엔드",
    ownerEn: "Backend",
    status: "PENDING",
    priority: "P3",
    surfaceKo: "저장 버튼 + 감사 로그 + 권한",
    surfaceEn: "Save action + audit log + authority",
    summaryKo: "저장 액션은 실제 대상 테이블과 추가 기능코드가 정해진 뒤 붙이는 편이 안전합니다.",
    summaryEn: "Mutation should come last, after the real target table and extra feature codes are specified.",
    deliverablesKo: ["VIEW 외 추가 기능코드", "저장 API", "감사 로그 규칙"],
    deliverablesEn: ["Action feature codes beyond VIEW", "Save API", "Audit log rules"]
  }
];

function toneClass(status: StarterTrack["status"]) {
  if (status === "READY") return "bg-emerald-100 text-emerald-700";
  if (status === "BLOCKED") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function statusLabel(status: StarterTrack["status"], en: boolean) {
  if (status === "READY") return en ? "Ready" : "준비됨";
  if (status === "BLOCKED") return en ? "Blocked" : "차단";
  return en ? "Pending" : "대기";
}

export function NewPageMigrationPage() {
  const en = isEnglish();
  const initialPayload = useMemo(() => readBootstrappedNewPagePageData(), []);
  const pageState = useAsyncValue<NewPagePagePayload>(fetchNewPagePage, [], {
    initialValue: initialPayload,
    skipInitialLoad: true
  });
  const [selectedTrackId, setSelectedTrackId] = useState<string>(starterTracks[0].id);
  const selectedTrack = useMemo(
    () => starterTracks.find((track) => track.id === selectedTrackId) || starterTracks[0],
    [selectedTrackId]
  );

  const page = pageState.value;
  const featureCodes = ((page?.featureCodes || []) as string[]).filter(Boolean);
  const featureCount = numberOf(page || null, "featureCount") || featureCodes.length;
  const manifest = (page?.manifest || {}) as Record<string, unknown>;
  const manifestComponents = ((manifest.components || []) as Array<Record<string, unknown>>);
  const ancestry = ((page?.menuAncestry || []) as Array<Record<string, unknown>>);
  const roleAssignments = ((page?.roleAssignments || []) as Array<Record<string, unknown>>);
  const governanceNotes = ((page?.governanceNotes || []) as Array<Record<string, string>>);
  const manifestComponentCount = numberOf(manifest, "componentCount") || manifestComponents.length;
  const readyCount = starterTracks.filter((track) => track.status === "READY").length;
  const pendingCount = starterTracks.filter((track) => track.status === "PENDING").length;
  const grantedRoleCount = roleAssignments.filter((item) => Boolean(item.assigned)).length;
  const localizedUrl = stringOf(page || null, "localizedMenuUrl") || buildLocalizedPath("/admin/system/new-page", "/en/admin/system/new-page");
  const menuLabel = en ? stringOf(page || null, "menuNameEn", "menuName") : stringOf(page || null, "menuName", "menuNameEn");

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "AI Workbench" : "AI 작업센터" },
        { label: en ? "New Page" : "새 페이지" }
      ]}
      title={menuLabel || (en ? "New Page" : "새 페이지")}
      subtitle={en ? "Live metadata-backed admin starter workspace for turning this route into a real screen." : "이 경로를 실제 업무 화면으로 확장하기 위한 메타 실데이터 기반 관리자 시작 화면입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? (
          <PageStatusNotice data-help-id="new-page-status" tone="error">
            {pageState.error}
          </PageStatusNotice>
        ) : null}
        {pageState.loading && !page ? (
          <PageStatusNotice data-help-id="new-page-status" tone="warning">
            {en ? "Loading runtime menu, feature, and manifest metadata for this page." : "이 페이지의 런타임 메뉴, 기능, 매니페스트 메타를 불러오는 중입니다."}
          </PageStatusNotice>
        ) : (
          <PageStatusNotice data-help-id="new-page-status" tone="success">
            {en
              ? "This route now renders against live page-data metadata instead of fixed placeholder values."
              : "이 경로는 이제 고정 placeholder 값이 아니라 실제 page-data 메타를 기준으로 렌더링됩니다."}
          </PageStatusNotice>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4" data-help-id="new-page-summary">
          <SummaryMetricCard
            title={en ? "Menu Code" : "메뉴 코드"}
            description={en ? "Provisioned admin page code" : "등록된 관리자 페이지 코드"}
            value={stringOf(page || null, "menuCode") || "-"}
          />
          <SummaryMetricCard
            title={en ? "View Feature" : "VIEW 기능"}
            description={en ? "Required route access feature" : "필수 라우트 접근 기능"}
            value={stringOf(page || null, "requiredViewFeatureCode") || "-"}
          />
          <SummaryMetricCard
            title={en ? "Manifest Components" : "매니페스트 컴포넌트"}
            description={en ? "Current registered UI surfaces" : "현재 등록된 UI surface 수"}
            value={String(manifestComponentCount)}
          />
          <SummaryMetricCard
            title={en ? "Linked Features" : "연결 기능"}
            description={en ? "Functions resolved from menu metadata" : "메뉴 메타에서 해석된 기능 수"}
            value={String(featureCount)}
          />
          <SummaryMetricCard
            title={en ? "Granted Roles" : "부여 롤"}
            description={en ? "Authority groups currently holding VIEW access" : "현재 VIEW 접근을 가진 권한 그룹 수"}
            value={String(grantedRoleCount)}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr,0.95fr]">
          <CollectionResultPanel
            title={en ? "Runtime Metadata" : "런타임 메타"}
            description={en ? "These values are loaded from the current backend page-data contract." : "현재 백엔드 page-data 계약에서 직접 읽어온 값입니다."}
            icon="memory"
            className="mb-0"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                    {en ? "Route" : "경로"}
                  </p>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Localized URL" : "현재 URL"}</dt>
                      <dd className="mt-1 break-all text-[var(--kr-gov-text-secondary)]">{localizedUrl}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Canonical URL" : "정규 URL"}</dt>
                      <dd className="mt-1 break-all text-[var(--kr-gov-text-secondary)]">{stringOf(page || null, "canonicalMenuUrl") || "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Menu Icon" : "메뉴 아이콘"}</dt>
                      <dd className="mt-1 flex items-center gap-2 text-[var(--kr-gov-text-secondary)]">
                        <span className="material-symbols-outlined text-base">{stringOf(page || null, "menuIcon") || "note_stack"}</span>
                        <span>{stringOf(page || null, "menuIcon") || "note_stack"}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Use At / Sort" : "사용 여부 / 정렬"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">
                        {(stringOf(page || null, "useAt") || "Y")} / {stringOf(page || null, "sortOrder") || "-"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                    {en ? "Manifest" : "매니페스트"}
                  </p>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Page ID" : "페이지 ID"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(manifest, "pageId") || "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Page Name" : "페이지명"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(manifest, "pageName") || "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Domain / Layout" : "도메인 / 레이아웃"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">
                        {stringOf(manifest, "domainCode") || "-"} / {stringOf(manifest, "layoutVersion") || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Design Tokens" : "디자인 토큰"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(manifest, "designTokenVersion") || "-"}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                    {en ? "Menu Chain" : "메뉴 체인"}
                  </p>
                  <div className="mt-4 space-y-3">
                    {ancestry.length > 0 ? ancestry.map((item) => (
                      <div key={stringOf(item, "code")} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-black text-[var(--kr-gov-text-primary)]">{stringOf(item, "label")}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item, "code")}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-500">{stringOf(item, "menuIcon") || "folder"}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                        {en ? "Menu lineage is not available yet." : "메뉴 계보를 아직 확인하지 못했습니다."}
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                    {en ? "Manifest Surfaces" : "매니페스트 surface"}
                  </p>
                  <div className="mt-4 space-y-3">
                    {manifestComponents.length > 0 ? manifestComponents.map((component) => (
                      <div key={stringOf(component, "instanceKey", "componentId")} className="rounded-lg border border-[var(--kr-gov-border-light)] px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">
                              {stringOf(component, "componentName", "componentId")}
                            </p>
                            <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                              {stringOf(component, "layoutZone") || "-"} / {stringOf(component, "instanceKey") || "-"}
                            </p>
                          </div>
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                            {stringOf(component, "componentType") || "content"}
                          </span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                        {en ? "No manifest components are registered yet." : "등록된 매니페스트 컴포넌트가 아직 없습니다."}
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Starter Tracks" : "시작 트랙"}
            description={en ? "Use the live metadata above to decide the first real screen slice." : "위 실데이터 메타를 기준으로 첫 구현 범위를 자릅니다."}
            icon="dashboard_customize"
            className="mb-0"
          >
            <div className="space-y-3">
              {starterTracks.map((track) => {
                const selected = selectedTrack.id === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`w-full rounded-[var(--kr-gov-radius)] border px-4 py-4 text-left transition ${
                      selected
                        ? "border-[var(--kr-gov-blue)] bg-white shadow-sm"
                        : "border-[var(--kr-gov-border-light)] bg-white/70"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">
                          {en ? track.nameEn : track.nameKo}
                        </p>
                        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                          {en ? track.summaryEn : track.summaryKo}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                          {track.priority}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${toneClass(track.status)}`}>
                          {statusLabel(track.status, en)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              <DiagnosticCard
                title={en ? selectedTrack.nameEn : selectedTrack.nameKo}
                status={statusLabel(selectedTrack.status, en)}
                statusTone={selectedTrack.status === "READY" ? "healthy" : selectedTrack.status === "BLOCKED" ? "danger" : "warning"}
                description={en ? selectedTrack.summaryEn : selectedTrack.summaryKo}
                summary={(
                  <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Owner" : "담당 축"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? selectedTrack.ownerEn : selectedTrack.ownerKo}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Surface" : "화면 범위"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? selectedTrack.surfaceEn : selectedTrack.surfaceKo}</dd>
                    </div>
                  </dl>
                )}
              />

              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5" data-help-id="new-page-checklist">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
                  {en ? "Deliverables" : "구현 산출물"}
                </p>
                <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {(en ? selectedTrack.deliverablesEn : selectedTrack.deliverablesKo).map((item, index) => (
                    <li key={item} className="flex gap-3">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--kr-gov-blue)] text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </CollectionResultPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr,0.95fr]">
          <CollectionResultPanel
            title={en ? "Resolved Feature Scope" : "해석된 기능 범위"}
            description={en ? "Current feature codes resolved from the menu registration." : "현재 메뉴 등록에서 해석된 기능 코드 목록입니다."}
            icon="key"
            className="mb-0"
          >
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                {featureCodes.length > 0 ? featureCodes.map((featureCode) => (
                  <span key={featureCode} className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                    {featureCode}
                  </span>
                )) : (
                  <span className="text-sm text-[var(--kr-gov-text-secondary)]">
                    {en ? "No linked features were resolved." : "연결된 기능을 아직 해석하지 못했습니다."}
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? `Ready tracks: ${readyCount}` : `준비된 트랙: ${readyCount}`}
                </div>
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? `Pending tracks: ${pendingCount}` : `대기 트랙: ${pendingCount}`}
                </div>
              </div>
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Role Exposure" : "권한 노출 상태"}
            description={en ? "Authority groups that currently resolve the required VIEW feature." : "필수 VIEW 기능을 현재 보유한 권한 그룹 목록입니다."}
            icon="admin_panel_settings"
            className="mb-0"
          >
            <div className="space-y-3">
              {roleAssignments.length > 0 ? roleAssignments.map((role) => (
                <DiagnosticCard
                  key={stringOf(role, "authorCode")}
                  title={`${stringOf(role, "authorName") || stringOf(role, "authorCode")} (${stringOf(role, "authorCode")})`}
                  status={stringOf(role, "statusLabel")}
                  statusTone={Boolean(role.assigned) ? "healthy" : "warning"}
                  description={stringOf(role, "authorDescription") || (en ? "No authority description" : "권한 설명 없음")}
                />
              )) : (
                <DiagnosticCard
                  title={en ? "No authority rows" : "권한 행 없음"}
                  status={en ? "Pending" : "대기"}
                  statusTone="warning"
                  description={en ? "The backend did not return role exposure rows." : "백엔드가 권한 노출 행을 반환하지 않았습니다."}
                />
              )}
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Governance Notes" : "거버넌스 노트"}
            description={en ? "These notes now come from the backend payload as implementation guardrails." : "이 노트는 이제 구현 가드레일로서 백엔드 payload에서 함께 내려옵니다."}
            icon="policy"
            className="mb-0"
          >
            <div className="space-y-3">
              {governanceNotes.length > 0 ? governanceNotes.map((note) => (
                <DiagnosticCard
                  key={`${note.title}-${note.description}`}
                  title={note.title}
                  status={en ? "Live" : "실데이터"}
                  statusTone="warning"
                  description={note.description}
                />
              )) : (
                <DiagnosticCard
                  title={en ? "No governance notes" : "거버넌스 노트 없음"}
                  status={en ? "Pending" : "대기"}
                  statusTone="warning"
                  description={en ? "The backend has not returned governance notes yet." : "백엔드가 아직 거버넌스 노트를 반환하지 않았습니다."}
                />
              )}
            </div>
          </CollectionResultPanel>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
