import { FormEvent, useEffect, useState } from "react";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { fetchJsonWithResponse } from "../../lib/api/core";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import {
  CONSENT_HISTORY_ASSETS,
  registeredAsset
} from "./consentHistoryAssetContract";

const ASSET = CONSENT_HISTORY_ASSETS;

/* ─── Types ─────────────────────────────────────────────────────────────── */

type ConsentRow = {
  consentId: number;
  memberId?: string;
  joinSessionId: string;
  membershipType?: string;
  consentType: string;
  termsVersion: string;
  termsHash: string;
  agreed: boolean;
  agreedAt?: string;
  withdrawnAt?: string;
  ipAddress?: string;
  userAgent?: string;
};

type ConsentPayload = {
  rows: ConsentRow[];
  summary: Record<string, number>;
  termsVersion: string;
  generatedAt: string;
};

/** Finite machine states surfaced by this screen */
type ScreenState = "READY" | "LOADING" | "EMPTY" | "ERROR" | "FORBIDDEN";

/* ─── Constants ───────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  TERMS: "서비스 이용약관",
  PRIVACY: "개인정보 수집·이용",
  GWP_CCUS: "GWP·CCUS 정보 제공",
  MARKETING: "마케팅 수신"
};

const STATUS_LABELS = {
  READY: { ko: "준비", en: "Ready" },
  LOADING: { ko: "불러오는 중", en: "Loading" },
  EMPTY: { ko: "데이터 없음", en: "No data" },
  ERROR: { ko: "오류", en: "Error" },
  FORBIDDEN: { ko: "접근 거부", en: "Access denied" }
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function deriveScreenState(
  loading: boolean,
  payload: ConsentPayload | null,
  error: string,
  httpStatus?: number
): ScreenState {
  if (!loading && httpStatus === 403) return "FORBIDDEN";
  if (loading) return payload ? "LOADING" : "LOADING";
  if (error) return "ERROR";
  if (!payload || payload.rows.length === 0) return "EMPTY";
  return "READY";
}

function formatAgreeLabel(agreed: boolean, en: boolean): string {
  return agreed ? (en ? "Agreed" : "동의") : (en ? "Not agreed" : "미동의");
}

function formatAgreeVariant(agreed: boolean): string {
  return agreed ? "emerald" : "gray";
}

/* ─── Sub-components ───────────────────────────────────────────────────────── */

/** Accessible live-region announcement for screen-state transitions */
function ScreenStateAnnouncement({
  state,
  error,
  totalRows
}: {
  state: ScreenState;
  error: string;
  totalRows: number;
}) {
  const en = isEnglish();
  let message = "";
  switch (state) {
    case "LOADING":
      message = en ? "Loading consent evidence…" : "동의 증적을 불러오는 중입니다.";
      break;
    case "EMPTY":
      message = en
        ? `No consent evidence found. ${totalRows} rows returned.`
        : `조회된 동의 증적이 없습니다. ${totalRows}건이 반환되었습니다.`;
      break;
    case "ERROR":
      message = (en ? "Error loading consent evidence: " : "동의 증적 로드 오류: ") + error;
      break;
    case "FORBIDDEN":
      message = en
        ? "Access denied. You do not have permission to view this resource."
        : "접근이 거부되었습니다. 이 리소스를 볼 권한이 없습니다.";
      break;
    case "READY":
      message = en
        ? `Loaded ${totalRows} consent evidence rows.`
        : `${totalRows}건의 동의 증적을 불러왔습니다.`;
      break;
  }
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      role="status"
      {...registeredAsset(ASSET.component.stateAnnouncer, ASSET.section.state)}
    >
      {message}
    </div>
  );
}

/** Summary cards – responsive at 360 / 768 / 1280 */
function SummarySection({
  summary
}: {
  summary: Record<string, number>;
}) {
  const en = isEnglish();
  const cards: Array<[string, string, number]> = [
    [en ? "All evidence" : "전체 증적", "total", summary.total || 0],
    [en ? "GWP agreed" : "GWP 동의", "gwp_agreed", summary.gwp_agreed || 0],
    [en ? "Member-linked" : "회원 연결", "linked", summary.linked || 0],
    [en ? "Withdrawn" : "철회", "withdrawn", summary.withdrawn || 0]
  ];

  return (
    <section
      aria-label={en ? "Consent evidence summary" : "동의 증적 요약"}
      className="mb-6 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4"
      data-help-id="consent-history-summary"
      {...registeredAsset(
        ASSET.component.summaryGrid,
        ASSET.section.summary,
        ASSET.classSet.summary
      )}
    >
      {cards.map(([label, key, value]) => (
        <div
          key={key}
          className="rounded-lg border border-[var(--kr-gov-border-light)] bg-white p-4 sm:p-5"
          {...registeredAsset(ASSET.component.summaryCard, ASSET.section.summary)}
        >
          <p className="text-xs sm:text-sm text-[var(--kr-gov-text-secondary)]">
            {label}
          </p>
          <strong className="mt-1 sm:mt-2 block text-xl sm:text-2xl">
            {value}
          </strong>
        </div>
      ))}
    </section>
  );
}

/** Filter form – responsive at 360 / 768 / 1280 */
function FilterForm({
  keyword,
  consentType,
  agreed,
  onKeywordChange,
  onConsentTypeChange,
  onAgreedChange,
  onSubmit,
  onReset
}: {
  keyword: string;
  consentType: string;
  agreed: string;
  onKeywordChange: (v: string) => void;
  onConsentTypeChange: (v: string) => void;
  onAgreedChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onReset: () => void;
}) {
  const en = isEnglish();

  return (
    <form
      aria-label={en ? "Filter consent history" : "동의 이력 필터"}
      className="mb-6 grid gap-3 rounded-lg border border-[var(--kr-gov-border-light)] bg-white p-4 sm:p-5"
      onSubmit={onSubmit}
      {...registeredAsset(
        ASSET.component.filterForm,
        ASSET.section.filter,
        ASSET.classSet.filter
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_180px] lg:items-end">
        <div>
          <label
            htmlFor="ch-filter-keyword"
            className="mb-1 block text-xs font-medium text-[var(--kr-gov-text-secondary)]"
          >
            {en ? "Search" : "검색어"}
          </label>
          <input
            id="ch-filter-keyword"
            aria-label={en ? "Search by member ID, session, or IP" : "회원 ID, 세션 또는 IP 검색"}
            className="w-full rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm"
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder={en ? "Member ID, session or IP" : "회원 ID, 세션 또는 IP"}
            value={keyword}
            {...registeredAsset(ASSET.component.filterInput, ASSET.section.filter)}
          />
        </div>

        <div>
          <label
            htmlFor="ch-filter-consent-type"
            className="mb-1 block text-xs font-medium text-[var(--kr-gov-text-secondary)]"
          >
            {en ? "Consent type" : "동의 유형"}
          </label>
          <select
            id="ch-filter-consent-type"
            aria-label={en ? "Filter by consent type" : "동의 유형으로 필터"}
            className="w-full rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm"
            onChange={(e) => onConsentTypeChange(e.target.value)}
            value={consentType}
            {...registeredAsset(ASSET.component.filterSelect, ASSET.section.filter)}
          >
            <option value="ALL">{en ? "All types" : "전체 유형"}</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {en ? value : label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="ch-filter-agreed"
            className="mb-1 block text-xs font-medium text-[var(--kr-gov-text-secondary)]"
          >
            {en ? "Agreement status" : "동의 상태"}
          </label>
          <select
            id="ch-filter-agreed"
            aria-label={en ? "Filter by agreement status" : "동의 상태로 필터"}
            className="w-full rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm"
            onChange={(e) => onAgreedChange(e.target.value)}
            value={agreed}
            {...registeredAsset(ASSET.component.filterSelect, ASSET.section.filter)}
          >
            <option value="ALL">{en ? "All statuses" : "전체 상태"}</option>
            <option value="Y">{en ? "Agreed" : "동의"}</option>
            <option value="N">{en ? "Not agreed" : "미동의"}</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 lg:justify-end">
        <button
          className="flex-1 rounded bg-[var(--kr-gov-blue)] px-5 py-2 font-bold text-white sm:flex-none lg:px-6"
          type="submit"
          {...registeredAsset(ASSET.component.actionButton, ASSET.section.filter)}
        >
          {en ? "Search" : "조회"}
        </button>
        <button
          aria-label={en ? "Reset filters" : "필터 초기화"}
          className="flex-1 rounded border border-[var(--kr-gov-border-light)] bg-white px-5 py-2 text-sm text-[var(--kr-gov-text-secondary)] sm:flex-none lg:px-6"
          type="button"
          onClick={onReset}
          {...registeredAsset(ASSET.component.actionButton, ASSET.section.filter)}
        >
          {en ? "Reset" : "초기화"}
        </button>
      </div>
    </form>
  );
}

/** Desktop table with caption + th scoping */
function ConsentTableDesktop({ rows }: { rows: ConsentRow[] }) {
  const en = isEnglish();
  const headers = [
    en ? "Member" : "회원",
    en ? "Type" : "동의 유형",
    en ? "Status" : "상태",
    en ? "Version" : "문안 버전",
    en ? "Agreed at" : "동의 일시",
    "IP",
    en ? "Evidence hash" : "증적 해시"
  ];

  return (
    <div
      className="overflow-hidden rounded-lg border border-[var(--kr-gov-border-light)] bg-white"
      {...registeredAsset(
        ASSET.component.dataTable,
        ASSET.section.content,
        ASSET.classSet.table
      )}
    >
      <div className="overflow-x-auto">
        <table
          aria-label={en ? "Consent history evidence table" : "동의 이력 증적 테이블"}
          className="w-full min-w-[900px] text-left text-sm"
        >
          <caption className="sr-only">
            {en
              ? "Consent evidence captured during member registration. Use table headers to sort columns."
              : "회원가입 과정에서 수집된 동의 증적 테이블. 열 정렬은 테이블 머리글을 사용하세요."}
          </caption>
          <thead className="bg-[var(--kr-gov-bg-gray)]">
            <tr>
              {headers.map((label) => (
                <th
                  key={label}
                  className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--kr-gov-text-secondary)] sm:px-4 sm:py-3"
                  scope="col"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const variant = formatAgreeVariant(row.agreed);
              return (
                <tr
                  key={row.consentId}
                  className="border-t border-[var(--kr-gov-border-light)] hover:bg-[var(--kr-gov-bg-gray)]"
                >
                  <td className="px-3 py-3 sm:px-4 sm:py-3">
                    <strong>{row.memberId || (en ? "Pending" : "가입 진행 중")}</strong>
                    <div
                      className="max-w-32 truncate text-xs text-[var(--kr-gov-text-secondary)] sm:max-w-40"
                      title={row.joinSessionId}
                    >
                      {row.joinSessionId}
                    </div>
                  </td>
                  <td className="px-3 py-3 sm:px-4 sm:py-3">
                    {en ? row.consentType : TYPE_LABELS[row.consentType] || row.consentType}
                  </td>
                  <td className="px-3 py-3 sm:px-4 sm:py-3">
                    <span
                      aria-label={`${en ? "Agreement status" : "동의 상태"}: ${formatAgreeLabel(row.agreed, en)}`}
                      className={`inline-block rounded-full px-2 py-1 text-xs font-bold ${
                        variant === "emerald"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                      {...registeredAsset(
                        ASSET.component.statusBadge,
                        ASSET.section.content,
                        ASSET.classSet.status
                      )}
                    >
                      {formatAgreeLabel(row.agreed, en)}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4 sm:py-3">{row.termsVersion}</td>
                  <td className="px-3 py-3 sm:px-4 sm:py-3">
                    {row.agreedAt ? new Date(row.agreedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3 sm:px-4 sm:py-3">{row.ipAddress || "—"}</td>
                  <td
                    className="px-3 py-3 font-mono text-xs sm:px-4 sm:py-3"
                    title={row.termsHash}
                  >
                    {row.termsHash.slice(0, 14)}…
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Mobile card list – 360 px single column */
function ConsentCardsMobile({ rows }: { rows: ConsentRow[] }) {
  const en = isEnglish();

  if (rows.length === 0) return null;

  return (
    <div
      className="space-y-3 lg:hidden"
      role="list"
      aria-label={en ? "Consent evidence list" : "동의 증적 목록"}
      {...registeredAsset(
        ASSET.component.mobileCardList,
        ASSET.section.content,
        ASSET.classSet.mobileCards
      )}
    >
      {rows.map((row) => {
        const variant = formatAgreeVariant(row.agreed);
        return (
          <article
            key={row.consentId}
            aria-label={`${en ? "Consent evidence" : "동의 증적"} ${row.consentId}`}
            className="rounded-lg border border-[var(--kr-gov-border-light)] bg-white p-4"
            role="listitem"
          >
            {/* Member + session */}
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <strong className="text-sm">
                  {row.memberId || (en ? "Pending" : "가입 진행 중")}
                </strong>
                <p className="truncate text-xs text-[var(--kr-gov-text-secondary)]">
                  {row.joinSessionId}
                </p>
              </div>
              <span
                aria-label={`${en ? "Agreement status" : "동의 상태"}: ${formatAgreeLabel(row.agreed, en)}`}
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
                  variant === "emerald"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                }`}
                {...registeredAsset(
                  ASSET.component.statusBadge,
                  ASSET.section.content,
                  ASSET.classSet.status
                )}
              >
                {formatAgreeLabel(row.agreed, en)}
              </span>
            </div>

            {/* Details grid */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Type" : "동의 유형"}
              </dt>
              <dd>{en ? row.consentType : TYPE_LABELS[row.consentType] || row.consentType}</dd>

              <dt className="font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Version" : "문안 버전"}
              </dt>
              <dd>{row.termsVersion}</dd>

              <dt className="font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Agreed at" : "동의 일시"}
              </dt>
              <dd>{row.agreedAt ? new Date(row.agreedAt).toLocaleString() : "—"}</dd>

              <dt className="font-medium text-[var(--kr-gov-text-secondary)]">IP</dt>
              <dd className="truncate">{row.ipAddress || "—"}</dd>

              <dt className="font-medium text-[var(--kr-gov-text-secondary)]">
                {en ? "Evidence hash" : "증적 해시"}
              </dt>
              <dd className="truncate font-mono" title={row.termsHash}>
                {row.termsHash.slice(0, 14)}…
              </dd>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

/* ─── Error / forbidden overlay ─────────────────────────────────────────── */

function ErrorOverlay({
  state,
  error,
  onRetry
}: {
  state: "ERROR" | "FORBIDDEN";
  error: string;
  onRetry: () => void;
}) {
  const en = isEnglish();
  const isForbidden = state === "FORBIDDEN";
  const title = isForbidden
    ? STATUS_LABELS.FORBIDDEN[en ? "en" : "ko"]
    : STATUS_LABELS.ERROR[en ? "en" : "ko"];
  const description = isForbidden
    ? en
      ? "You do not have permission to view consent evidence on this resource."
      : "이 리소스의 동의 증적을 볼 권한이 없습니다."
    : error;

  return (
    <section
      aria-label={title}
      className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6 text-center"
      role="alert"
      {...registeredAsset(
        ASSET.component.errorPanel,
        ASSET.section.feedback,
        ASSET.classSet.feedback
      )}
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100"
      >
        <svg
          className="h-6 w-6 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-bold text-red-700">{title}</h2>
      <p className="mb-6 text-sm text-red-600">{description}</p>
      {!isForbidden && (
        <button
          className="rounded bg-red-600 px-6 py-2 font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          onClick={onRetry}
        >
          {en ? "Retry" : "다시 시도"}
        </button>
      )}
    </section>
  );
}

/* ─── Empty state ───────────────────────────────────────────────────────── */

function EmptyState() {
  const en = isEnglish();
  return (
    <div
      className="mb-6 rounded-lg border border-[var(--kr-gov-border-light)] bg-white p-10 text-center"
      {...registeredAsset(
        ASSET.component.emptyPanel,
        ASSET.section.feedback,
        ASSET.classSet.feedback
      )}
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--kr-gov-bg-gray)]"
      >
        <svg
          className="h-6 w-6 text-[var(--kr-gov-text-secondary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <p className="text-sm text-[var(--kr-gov-text-secondary)]">
        {en ? "No consent evidence found." : "조회된 동의 증적이 없습니다."}
      </p>
    </div>
  );
}

/* ─── Main page component ─────────────────────────────────────────────────── */

export function ConsentHistoryMigrationPage() {
  const en = isEnglish();

  const [keyword, setKeyword] = useState("");
  const [consentType, setConsentType] = useState("ALL");
  const [agreed, setAgreed] = useState("ALL");
  const [query, setQuery] = useState({ keyword: "", consentType: "ALL", agreed: "ALL" });
  const [payload, setPayload] = useState<ConsentPayload | null>(null);
  const [rawError, setRawError] = useState("");
  const [loading, setLoading] = useState(true);
  const [httpStatus, setHttpStatus] = useState<number | undefined>(undefined);

  const screenState = deriveScreenState(loading, payload, rawError, httpStatus);

  useEffect(() => {
    const params = new URLSearchParams(query);
    setLoading(true);
    setRawError("");
    setHttpStatus(undefined);

    fetchJsonWithResponse<ConsentPayload>(
      `/admin/system/consent-history/page-data?${params.toString()}`
    )
      .then(({ response, body }) => {
        setHttpStatus(response.status);
        setPayload(body);
      })
      .catch((reason) => {
        const msg =
          reason instanceof Error ? reason.message : String(reason);
        setRawError(msg);
      })
      .finally(() => setLoading(false));
  }, [query]);

  function search(e: FormEvent) {
    e.preventDefault();
    setQuery({ keyword, consentType, agreed });
  }

  function resetFilters() {
    setKeyword("");
    setConsentType("ALL");
    setAgreed("ALL");
    setQuery({ keyword: "", consentType: "ALL", agreed: "ALL" });
  }

  const summary = payload?.summary ?? {};
  const rows = payload?.rows ?? [];
  const totalRows = rows.length;

  function handleRetry() {
    setQuery({ ...query });
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        {
          label: en ? "Admin" : "관리자",
          href: buildLocalizedPath("/admin", "/en/admin")
        },
        { label: en ? "Members & Security" : "회원·보안" },
        { label: en ? "Consent History" : "약관·동의 이력" }
      ]}
      loading={screenState === "LOADING"}
      loadingLabel={
        en ? "Loading consent evidence…" : "동의 증적을 불러오는 중입니다."
      }
      subtitle={
        en
          ? "Review versioned consent evidence captured during registration."
          : "회원가입 과정에서 수집된 버전별 동의 증적을 조회합니다."
      }
      title={en ? "Terms and Consent History" : "약관·동의 이력 관리"}
    >
      <div
        data-ui-page={ASSET.page}
        data-ui-theme={ASSET.theme}
        {...registeredAsset(
          ASSET.component.pageShell,
          ASSET.section.state,
          ASSET.classSet.page
        )}
      >
      {/* Screen-state ARIA announcement */}
      <ScreenStateAnnouncement
        error={rawError}
        state={screenState}
        totalRows={totalRows}
      />

      {/* Error / Forbidden overlay */}
      {screenState === "ERROR" && (
        <ErrorOverlay
          error={rawError}
          onRetry={handleRetry}
          state="ERROR"
        />
      )}
      {screenState === "FORBIDDEN" && (
        <ErrorOverlay
          error=""
          onRetry={handleRetry}
          state="FORBIDDEN"
        />
      )}

      {/* Summary – visible when we have data or are ready */}
      {(screenState === "READY" || screenState === "EMPTY") && (
        <SummarySection summary={summary} />
      )}

      {/* Filters – always show when ready/empty */}
      {(screenState === "READY" || screenState === "EMPTY") && (
        <FilterForm
          agreed={agreed}
          consentType={consentType}
          keyword={keyword}
          onAgreedChange={setAgreed}
          onConsentTypeChange={setConsentType}
          onKeywordChange={setKeyword}
          onReset={resetFilters}
          onSubmit={search}
        />
      )}

      {/* Loading skeleton rows */}
      {screenState === "LOADING" && (
        <div
          aria-busy="true"
          aria-label={en ? "Loading consent evidence" : "동의 증적 로드 중"}
          {...registeredAsset(
            ASSET.component.loadingSkeleton,
            ASSET.section.feedback,
            ASSET.classSet.feedback
          )}
        >
          <div className="mb-6 rounded-lg border border-[var(--kr-gov-border-light)] bg-white p-5 animate-pulse">
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-12 flex-1 rounded bg-[var(--kr-gov-bg-gray)]" />
                  <div className="h-12 w-24 rounded bg-[var(--kr-gov-bg-gray)]" />
                  <div className="hidden sm:block h-12 w-24 rounded bg-[var(--kr-gov-bg-gray)]" />
                  <div className="hidden md:block h-12 w-24 rounded bg-[var(--kr-gov-bg-gray)]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table – desktop 768+ */}
      {screenState === "READY" && rows.length > 0 && (
        <div className="hidden lg:block">
          <ConsentTableDesktop rows={rows} />
        </div>
      )}

      {/* Cards – mobile < 768 */}
      {screenState === "READY" && rows.length > 0 && (
        <ConsentCardsMobile rows={rows} />
      )}

      {/* Empty state */}
      {screenState === "EMPTY" && <EmptyState />}
      </div>
    </AdminPageShell>
  );
}
