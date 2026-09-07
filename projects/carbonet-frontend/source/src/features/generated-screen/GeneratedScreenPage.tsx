import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  findGeneratedScreen,
  type GeneratedScreenDefinition,
} from "../../generated/screen-generation/generatedScreenCatalog";
import { isEnglish } from "../../lib/navigation/runtime";
import { CommonContentCard } from "../../components/common-design/CommonDesignPrimitives";
import { runtimeUuid } from "../../lib/runtime-id";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ContractFieldControl } from "./ContractFieldControl";
import { ExecutableScreenSupportCards } from "./ExecutableScreenSupportCards";
import {
  materializeScreen,
  resolveScreenCoordinate,
} from "./screenSpaceRuntime";

type ContractItem = { code: string; label: string; [key: string]: unknown };
type NextTask = { stepCode: string; actorCode: string; path: string };
type CommandObservation = {
  commandCode: string;
  httpStatus: number;
  statusCase: string;
  output: Record<string, unknown>;
  idempotencyKey: string;
};
const list = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) =>
          typeof item === "string"
            ? item
            : String(
                (item as Record<string, unknown>)?.label ||
                  (item as Record<string, unknown>)?.name ||
                  (item as Record<string, unknown>)?.code ||
                  "",
              ),
        )
        .filter(Boolean)
    : [];
const items = (value: unknown, prefix: string): ContractItem[] =>
  Array.isArray(value)
    ? value
        .map((item, index) => {
          if (typeof item === "string")
            return { code: item || `${prefix}_${index + 1}`, label: item };
          const source = item as Record<string, unknown>;
          const rawCode = String(
            source.code || source.fieldCode || `${prefix}_${index + 1}`,
          );
          const rawLabel = String(
            source.label ||
              source.name ||
              source.fieldName ||
              source.code ||
              source.fieldCode ||
              `${prefix} ${index + 1}`,
          );
          const executableActionCode =
            prefix === "ACTION" &&
            /^ACTION_\d+$/i.test(rawCode) &&
            /^[A-Z][A-Z0-9_]+$/.test(rawLabel)
              ? rawLabel
              : rawCode;
          return {
            ...source,
            code: executableActionCode,
            label: rawLabel,
            control: source.control || source.controlType,
          };
        })
        .filter((item) => item.label)
    : [];
const text = (value: unknown) => (typeof value === "string" ? value : "");
const liveSmokeStatuses = new Set([
  "SUCCESS",
  "VALIDATION_ERROR",
  "FORBIDDEN",
  "CONFLICT",
  "RECOVERY",
]);
const liveSmokeWatermarkBits = (runId: string) => {
  const hex = runId.toLowerCase().split("-").join("");
  if (!/^[0-9a-f]{32}$/.test(hex)) return [];
  return Array.from(hex).flatMap((value) => {
    const nibble = Number.parseInt(value, 16);
    return [3, 2, 1, 0].map((shift) => (nibble >> shift) & 1);
  });
};
const observedStatusCase = (status: number, body: Record<string, unknown>) => {
  if (
    status === 200 &&
    body.success === true &&
    body.recovered === true &&
    body.idempotent === true
  )
    return "RECOVERY";
  if (status === 200 && body.success === true && body.idempotent === false)
    return "SUCCESS";
  if (status === 400 && body.success === false) return "VALIDATION_ERROR";
  if (status === 403 && body.success === false) return "FORBIDDEN";
  if (status === 409 && body.success === false) return "CONFLICT";
  return "UNKNOWN";
};
const inputClass =
  "krds-control h-11 w-full rounded-lg border border-slate-300 bg-white px-3 focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100";
const contractLookupPath = () => {
  const source = new URLSearchParams(location.search);
  const process = (
    source.get("process") ||
    source.get("processCode") ||
    ""
  ).trim();
  const step = (source.get("step") || source.get("stepCode") || "").trim();
  const selector = new URLSearchParams();
  if (process) selector.set("process", process);
  if (step) selector.set("step", step);
  return selector.size ? `${location.pathname}?${selector}` : location.pathname;
};

const helpAnchorAttributes = (value: unknown): Record<string, string> => {
  const selector = text(
    (value as Record<string, unknown> | undefined)?.anchorSelector,
  );
  const id = selector.match(/^#([A-Za-z][\w:.-]*)$/)?.[1];
  if (id) return { id };
  const dataHelpId = selector.match(/^\[data-help-id=["']([^"']+)["']\]$/)?.[1];
  return dataHelpId ? { "data-help-id": dataHelpId } : {};
};

type WithdrawalPreflight = {
  memberId?: string;
  tenantId?: string;
  openRequestCount?: number;
  handoverRequired?: boolean;
  eligible?: boolean;
  retentionPolicy?: Array<{ category?: string; period?: string }>;
};

type WithdrawalRecord = {
  request_id?: string;
  tenant_id?: string;
  member_id?: string;
  status?: string;
  reason_text?: string;
  handover_to?: string;
  retention_until?: string;
  destruction_due_at?: string;
  requested_at?: string;
  reviewed_at?: string;
  decided_at?: string;
  completed_at?: string;
  review_note?: string;
  decision_note?: string;
};

const withdrawalDate = (value?: string, en = false) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(en ? "en-US" : "ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
};

const withdrawalStatusLabel = (status = "", en = false) => {
  const labels: Record<string, [string, string]> = {
    REQUESTED: ["신청 대기", "Requested"],
    REVIEWED: ["검토 완료", "Reviewed"],
    APPROVED: ["승인·완료 대기", "Approved"],
    REJECTED: ["반려", "Rejected"],
    COMPLETED: ["탈퇴 완료", "Completed"],
  };
  return (
    labels[status]?.[en ? 1 : 0] || status || (en ? "Unknown" : "상태 미확인")
  );
};

function WithdrawalStatusScreen({
  en,
  completedOnly = false,
}: {
  en: boolean;
  completedOnly?: boolean;
}) {
  const [rows, setRows] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch("/home/api/member-withdrawals/mine", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.message || "WITHDRAWAL_STATUS_LOAD_FAILED");
        if (!cancelled) {
          const loaded = Array.isArray(body) ? body : [];
          setRows(loaded);
          setSelectedId((current) => current || loaded[0]?.request_id || "");
        }
      })
      .catch(
        (reason) =>
          !cancelled &&
          setError(reason instanceof Error ? reason.message : String(reason)),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);
  const visible = completedOnly
    ? rows.filter((row) => row.status === "COMPLETED")
    : rows;
  const latest = visible[0];
  const selected =
    visible.find((row) => row.request_id === selectedId) || visible[0];
  return (
    <main
      className="min-h-screen bg-slate-50 py-10"
      data-screen-theme="krds-v1"
      data-withdrawal-status-screen={completedOnly ? "complete" : "pending"}
    >
      <div className="mx-auto max-w-5xl px-4 lg:px-8">
        <header className="border-b border-slate-200 pb-6">
          <p className="gov-text-label font-black text-[#246beb]">
            {en ? "MY PAGE" : "마이페이지"}
          </p>
          <h1 className="gov-text-heading-lg mt-2 font-black text-[#052b57]">
            {completedOnly
              ? en
                ? "Withdrawal result"
                : "탈퇴 완료·결과 확인"
              : en
                ? "Withdrawal request status"
                : "탈퇴 신청 대기·현황 확인"}
          </h1>
          <p className="gov-text-body mt-2 text-slate-600">
            {completedOnly
              ? en
                ? "Review the completed withdrawal and retention schedule."
                : "완료된 탈퇴 처리와 법정 보존·파기 일정을 확인합니다."
              : en
                ? "Track the latest decision on your request."
                : "신청부터 검토·승인·반려까지 최신 처리 상태를 확인합니다."}
          </p>
        </header>
        {loading && (
          <p className="mt-6 rounded-xl border bg-white p-6 font-bold">
            {en ? "Loading..." : "신청 현황을 불러오는 중입니다."}
          </p>
        )}
        {error && (
          <p
            className="mt-6 rounded-xl border border-red-300 bg-red-50 p-5 font-bold text-red-800"
            role="alert"
          >
            {error === "AUTHENTICATION_REQUIRED"
              ? en
                ? "Please sign in."
                : "신청 계정으로 로그인해 주세요."
              : error}
          </p>
        )}
        {!loading && !error && visible.length === 0 && (
          <section className="mt-6 rounded-xl border bg-white p-8 text-center">
            <h2 className="font-black text-[#052b57]">
              {completedOnly
                ? en
                  ? "No completed withdrawal"
                  : "완료된 탈퇴 내역이 없습니다."
                : en
                  ? "No withdrawal request"
                  : "탈퇴 신청 내역이 없습니다."}
            </h2>
            <a
              className="mt-5 inline-flex rounded-lg bg-[#246beb] px-5 py-3 font-black text-white"
              href={`${en ? "/en" : ""}/planned/member/account-withdrawal/account-withdrawal-s1`}
            >
              {en ? "Submit a request" : "탈퇴 신청 화면으로 이동"}
            </a>
          </section>
        )}
        <section className="mt-6 space-y-4">
          {!completedOnly && latest && (
            <>
              <article className="krds-component overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
                <div className="bg-[#052b57] px-6 py-7 text-white md:px-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-blue-200">
                        {en ? "LATEST WITHDRAWAL REQUEST" : "최근 탈퇴 신청"}
                      </p>
                      <h2 className="gov-text-heading-md mt-2 font-black">
                        {withdrawalStatusLabel(latest.status, en)}
                      </h2>
                      <p className="mt-2 text-sm text-blue-100">
                        {en
                          ? "You can review the current status and processing history below."
                          : "현재 처리 상태와 진행 이력을 아래에서 확인할 수 있습니다."}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/15 px-4 py-2 font-black">
                      {latest.status}
                    </span>
                  </div>
                </div>
                <dl className="grid gap-px bg-slate-200 sm:grid-cols-3">
                  <div className="bg-white p-5">
                    <dt className="text-sm text-slate-500">
                      {en ? "Requested" : "신청 일시"}
                    </dt>
                    <dd className="mt-2 font-black text-[#052b57]">
                      {withdrawalDate(latest.requested_at, en)}
                    </dd>
                  </div>
                  <div className="bg-white p-5">
                    <dt className="text-sm text-slate-500">
                      {en ? "Reason" : "탈퇴 사유"}
                    </dt>
                    <dd className="mt-2 font-black text-[#052b57]">
                      {latest.reason_text || "-"}
                    </dd>
                  </div>
                  <div className="bg-white p-5">
                    <dt className="text-sm text-slate-500">
                      {en ? "Last updated" : "최근 처리 일시"}
                    </dt>
                    <dd className="mt-2 font-black text-[#052b57]">
                      {withdrawalDate(
                        latest.completed_at ||
                          latest.decided_at ||
                          latest.reviewed_at ||
                          latest.requested_at,
                        en,
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
              {selected && (
                <article className="krds-component rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="gov-text-heading-sm font-black text-[#052b57]">
                      {en ? "Processing progress" : "처리 진행 상황"}
                    </h2>
                    <span className="rounded-full bg-blue-50 px-3 py-1 font-black text-[#246beb]">
                      {withdrawalStatusLabel(selected.status, en)}
                    </span>
                  </div>
                  <ol className="mt-6 grid gap-3 md:grid-cols-4">
                    {[
                      [
                        "REQUESTED",
                        en ? "Requested" : "신청 접수",
                        selected.requested_at,
                      ],
                      [
                        "REVIEWED",
                        en ? "Reviewed" : "관리자 검토",
                        selected.reviewed_at,
                      ],
                      [
                        "APPROVED",
                        en ? "Decided" : "승인·반려",
                        selected.decided_at,
                      ],
                      [
                        "COMPLETED",
                        en ? "Completed" : "탈퇴 완료",
                        selected.completed_at,
                      ],
                    ].map(([code, label, date], index) => (
                      <li
                        className={`rounded-lg border p-4 ${date ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                        key={code}
                      >
                        <span
                          className={`grid size-8 place-items-center rounded-full text-xs font-black ${date ? "bg-[#246beb] text-white" : "bg-slate-200"}`}
                        >
                          {date ? "✓" : index + 1}
                        </span>
                        <strong className="mt-3 block">{label}</strong>
                        <span className="mt-2 block text-xs">
                          {withdrawalDate(date, en)}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <dl className="mt-6 grid gap-5 border-t border-slate-200 pt-5 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">
                        {en ? "Request ID" : "신청 번호"}
                      </dt>
                      <dd className="mt-1 break-all font-bold">
                        {selected.request_id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">
                        {en ? "Handover account" : "업무 인계 계정"}
                      </dt>
                      <dd className="mt-1 font-bold">
                        {selected.handover_to ||
                          (en ? "Not required" : "해당 없음")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">
                        {en ? "Review note" : "검토 의견"}
                      </dt>
                      <dd className="mt-1 font-bold">
                        {selected.review_note ||
                          (en ? "Waiting for review" : "관리자 검토 대기 중")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">
                        {en ? "Decision note" : "승인·반려 의견"}
                      </dt>
                      <dd className="mt-1 font-bold">
                        {selected.decision_note || "-"}
                      </dd>
                    </div>
                  </dl>
                </article>
              )}
              {visible.length > 1 && (
                <div className="krds-component overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <h2 className="gov-text-heading-sm font-black text-[#052b57]">
                      {en ? "Previous requests" : "이전 신청 이력"}
                    </h2>
                    <span className="text-sm font-bold text-slate-500">
                      {en
                        ? `${visible.length} items`
                        : `총 ${visible.length}건`}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-[#052b57]">
                        <tr>
                          <th className="px-5 py-4 font-black">
                            {en ? "Requested" : "신청 일시"}
                          </th>
                          <th className="px-5 py-4 font-black">
                            {en ? "Reason" : "탈퇴 사유"}
                          </th>
                          <th className="px-5 py-4 font-black">
                            {en ? "Status" : "처리 상태"}
                          </th>
                          <th className="px-5 py-4 font-black">
                            {en ? "Details" : "상세"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((row) => (
                          <tr
                            className="border-t border-slate-200 hover:bg-blue-50/40"
                            key={row.request_id}
                          >
                            <td className="whitespace-nowrap px-5 py-4">
                              {withdrawalDate(row.requested_at, en)}
                            </td>
                            <td className="max-w-xs truncate px-5 py-4">
                              {row.reason_text || "-"}
                            </td>
                            <td className="px-5 py-4">
                              {withdrawalStatusLabel(row.status, en)}
                            </td>
                            <td className="px-5 py-4">
                              <button
                                className="font-black text-[#246beb] underline"
                                onClick={() =>
                                  setSelectedId(row.request_id || "")
                                }
                              >
                                {en ? "View" : "보기"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
          {completedOnly && latest && (
            <>
              <article className="krds-component overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="px-6 py-10 text-center md:px-10">
                  <span
                    aria-hidden="true"
                    className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-3xl font-black text-emerald-600"
                  >
                    ✓
                  </span>
                  <p className="mt-5 text-sm font-black text-[#246beb]">
                    {en ? "MEMBERSHIP WITHDRAWAL" : "회원 탈퇴"}
                  </p>
                  <h2 className="gov-text-heading-md mt-2 font-black text-[#052b57]">
                    {en
                      ? "Your withdrawal has been completed."
                      : "회원 탈퇴 처리가 완료되었습니다."}
                  </h2>
                  <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                    {en
                      ? "Your account access has ended. Records subject to statutory retention will be destroyed after the retention period."
                      : "계정 이용이 종료되었습니다. 법정 보존 대상 정보는 보존기간이 끝난 후 안전하게 파기됩니다."}
                  </p>
                </div>
                <dl className="grid gap-px border-y border-slate-200 bg-slate-200 sm:grid-cols-2">
                  <div className="bg-slate-50 p-5 md:px-8">
                    <dt className="text-sm text-slate-500">
                      {en ? "Completed" : "처리 완료 일시"}
                    </dt>
                    <dd className="mt-2 font-black text-[#052b57]">
                      {withdrawalDate(
                        latest.completed_at || latest.decided_at,
                        en,
                      )}
                    </dd>
                  </div>
                  <div className="bg-slate-50 p-5 md:px-8">
                    <dt className="text-sm text-slate-500">
                      {en ? "Requested" : "신청 일시"}
                    </dt>
                    <dd className="mt-2 font-black text-[#052b57]">
                      {withdrawalDate(latest.requested_at, en)}
                    </dd>
                  </div>
                  <div className="bg-white p-5 md:px-8">
                    <dt className="text-sm text-slate-500">
                      {en ? "Request ID" : "신청 번호"}
                    </dt>
                    <dd className="mt-2 break-all font-bold text-slate-800">
                      {latest.request_id}
                    </dd>
                  </div>
                  <div className="bg-white p-5 md:px-8">
                    <dt className="text-sm text-slate-500">
                      {en ? "Reason" : "탈퇴 사유"}
                    </dt>
                    <dd className="mt-2 font-bold text-slate-800">
                      {latest.reason_text || "-"}
                    </dd>
                  </div>
                </dl>
                <div className="p-6 md:p-8">
                  <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                    <h3 className="font-black text-[#052b57]">
                      {en
                        ? "Retention and destruction schedule"
                        : "보유정보 처리 안내"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {en
                        ? "Only records required by law and audit policy are retained. Retained records cannot be used for normal services."
                        : "법령 및 감사 정책에 따라 필요한 기록만 분리 보관하며, 보관 중인 정보는 일반 서비스에 이용되지 않습니다."}
                    </p>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-lg bg-white p-4">
                        <dt className="text-slate-500">
                          {en ? "Retention until" : "보존 만료일"}
                        </dt>
                        <dd className="mt-1 font-black text-[#052b57]">
                          {withdrawalDate(latest.retention_until, en)}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-white p-4">
                        <dt className="text-slate-500">
                          {en ? "Destruction due" : "파기 예정일"}
                        </dt>
                        <dd className="mt-1 font-black text-[#052b57]">
                          {withdrawalDate(
                            latest.destruction_due_at || latest.retention_until,
                            en,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </section>
                  <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <a
                      className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#246beb] px-7 font-black text-white"
                      href={en ? "/en/home" : "/home"}
                    >
                      {en ? "Go to home" : "홈으로 이동"}
                    </a>
                    <a
                      className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#246beb] bg-white px-7 font-black text-[#246beb]"
                      href="/signin/loginView"
                    >
                      {en ? "Go to sign in" : "로그인 화면으로 이동"}
                    </a>
                  </div>
                </div>
              </article>
              {visible.length > 1 && (
                <p className="text-center text-sm text-slate-500">
                  {en
                    ? `${visible.length - 1} previous completed request(s) are retained in the audit history.`
                    : `이전 완료 내역 ${visible.length - 1}건은 감사 이력으로 보관됩니다.`}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function WithdrawalAdminScreen({ en }: { en: boolean }) {
  const [rows, setRows] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [reviewId, setReviewId] = useState("");
  const [actionNote, setActionNote] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/home/api/member-withdrawals", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "WITHDRAWAL_LIST_LOAD_FAILED");
      setRows(Array.isArray(body) ? body : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const filteredRows = rows.filter((row) => {
    const matchesStatus = status === "ALL" || row.status === status;
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      !needle ||
      `${row.member_id || ""} ${row.reason_text || ""} ${row.request_id || ""}`
        .toLowerCase()
        .includes(needle);
    return matchesStatus && matchesQuery;
  });
  const reviewRow = rows.find((row) => row.request_id === reviewId);
  const transition = async (
    row: WithdrawalRecord,
    action: "review" | "approve" | "reject" | "complete",
  ) => {
    if (!row.request_id) return;
    const note = actionNote.trim();
    if (action !== "complete" && !note) {
      setError(
        en
          ? "Enter a review or decision note."
          : "검토·처리 의견을 입력하세요.",
      );
      return;
    }
    if (action === "reject" && note.length < 5) {
      setError(
        en
          ? "Enter at least 5 characters for rejection."
          : "반려 사유를 5자 이상 입력하세요.",
      );
      return;
    }
    setBusyId(row.request_id);
    setError("");
    try {
      const response = await fetch(
        `/home/api/member-withdrawals/${row.request_id}/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          ...(action === "complete" ? {} : { body: JSON.stringify({ note }) }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "WITHDRAWAL_TRANSITION_FAILED");
      await load();
      setActionNote("");
      setReviewId("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId("");
    }
  };
  return (
    <div
      className="space-y-6"
      data-screen-theme="krds-v1"
      data-withdrawal-admin-screen="true"
    >
      {error && (
        <p
          className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 font-bold text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p className="gov-card p-6 font-bold">
          {en ? "Loading..." : "탈퇴 신청을 불러오는 중입니다."}
        </p>
      ) : (
        <section className="gov-card overflow-hidden p-0">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--kr-gov-text-primary)]">
                  {en ? "Search criteria" : "검색 조건"}
                </h2>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Search by member, request ID, reason, and status." : "회원·신청 번호·사유와 처리 상태로 조회합니다."}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-6 border-b border-[var(--kr-gov-border-light)] px-6 py-6 md:grid-cols-[minmax(0,1fr)_13rem_auto] md:items-end">
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
              <input
                className={inputClass}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  en
                    ? "Member ID, reason, request ID"
                    : "회원 아이디·사유·신청 번호 검색"
                }
                value={query}
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "처리 상태"}</span>
              <select
                className={inputClass}
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="ALL">{en ? "All statuses" : "전체 상태"}</option>
                <option value="REQUESTED">
                  {en ? "Requested" : "신청 대기"}
                </option>
                <option value="REVIEWED">
                  {en ? "Reviewed" : "검토 완료"}
                </option>
                <option value="APPROVED">
                  {en ? "Approved" : "승인·완료 대기"}
                </option>
                <option value="REJECTED">{en ? "Rejected" : "반려"}</option>
                <option value="COMPLETED">
                  {en ? "Completed" : "탈퇴 완료"}
                </option>
              </select>
            </label>
            <button
              className="krds-control h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] px-5 font-bold text-white"
              onClick={() => void load()}
            >
              {en ? "Refresh" : "새로고침"}
            </button>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--kr-gov-border-light)] bg-gray-50 px-6 py-4">
            <h2 className="gov-text-heading-sm font-black text-[var(--kr-gov-text-primary)]">
              {en ? "Withdrawal requests" : "탈퇴 신청 목록"}
            </h2>
            <span className="text-sm font-bold text-slate-500">
              {en
                ? `${filteredRows.length} items`
                : `총 ${filteredRows.length}건`}
            </span>
          </div>
          {filteredRows.length === 0 ? (
            <p className="p-10 text-center font-bold text-slate-500">
              {en
                ? "No matching requests."
                : "조건에 맞는 탈퇴 신청이 없습니다."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="border-b border-[var(--kr-gov-border-light)] bg-gray-50 text-[var(--kr-gov-text-secondary)]">
                  <tr>
                    <th className="px-4 py-4 font-black">
                      {en ? "Member" : "회원"}
                    </th>
                    <th className="px-4 py-4 font-black">
                      {en ? "Reason" : "신청 사유"}
                    </th>
                    <th className="px-4 py-4 font-black">
                      {en ? "Requested" : "신청 일시"}
                    </th>
                    <th className="px-4 py-4 font-black">
                      {en ? "Status" : "처리 상태"}
                    </th>
                    <th className="px-4 py-4 text-center font-black">
                      {en ? "Action" : "업무 처리"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      className="border-t border-slate-200 align-top hover:bg-blue-50/40"
                      key={row.request_id}
                    >
                      <td className="px-4 py-4">
                        <strong className="block text-[#052b57]">
                          {row.member_id}
                        </strong>
                        <span
                          className="mt-1 block max-w-48 truncate text-xs text-slate-500"
                          title={row.request_id}
                        >
                          {row.request_id}
                        </span>
                      </td>
                      <td className="max-w-sm px-4 py-4 text-slate-700">
                        {row.reason_text || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {withdrawalDate(row.requested_at, en)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 font-black text-[#246beb]">
                          {withdrawalStatusLabel(row.status, en)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          className="rounded-lg border border-[#246beb] bg-white px-3 py-2 font-black text-[#246beb]"
                          onClick={() => {
                            setReviewId(row.request_id || "");
                            setActionNote("");
                            setError("");
                          }}
                        >
                          {en ? "Review details" : "상세 검토"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {reviewRow && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
        >
          <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[var(--kr-gov-border-light)] bg-white px-6 py-4">
              <div>
                <p className="text-xs font-black text-[#246beb]">
                  {en ? "WITHDRAWAL REVIEW" : "회원 탈퇴 관리"}
                </p>
                <h2 className="gov-text-heading-md mt-1 flex items-center gap-2 font-black text-[var(--kr-gov-text-primary)]">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">assignment_ind</span>
                  {en ? "Withdrawal request review" : "탈퇴 신청 상세 검토"}
                </h2>
              </div>
              <button
                aria-label={en ? "Close" : "닫기"}
                className="grid size-11 place-items-center rounded-lg border border-slate-300 text-xl"
                onClick={() => {
                  setReviewId("");
                  setActionNote("");
                }}
              >
                ×
              </button>
            </header>
            <div className="space-y-6 overflow-y-auto px-6 py-6">
              <section>
                <h3 className="mb-3 border-l-4 border-[#246beb] pl-3 font-black text-[#052b57]">
                  {en ? "Applicant and request" : "신청자·신청 정보"}
                </h3>
                <dl className="border-t-2 border-[#052b57] text-sm">
                  {[
                    [en ? "Member ID" : "회원 ID", reviewRow.member_id],
                    [en ? "Request ID" : "신청 번호", reviewRow.request_id],
                    [
                      en ? "Requested" : "신청 일시",
                      withdrawalDate(reviewRow.requested_at, en),
                    ],
                    [
                      en ? "Status" : "처리 상태",
                      withdrawalStatusLabel(reviewRow.status, en),
                    ],
                    [en ? "Reason" : "탈퇴 사유", reviewRow.reason_text],
                    [
                      en ? "Handover" : "업무 인계 대상",
                      reviewRow.handover_to ||
                        (en ? "Not required" : "해당 없음"),
                    ],
                  ].map(([label, value]) => (
                    <div className="grid grid-cols-[9rem_1fr]" key={label}>
                      <dt className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 font-black text-slate-600">
                        {label}
                      </dt>
                      <dd className="break-all border-b border-slate-200 px-4 py-3">
                        {value || "-"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section>
                <h3 className="mb-3 border-l-4 border-[#246beb] pl-3 font-black text-[#052b57]">
                  {en ? "Processing history" : "처리 이력"}
                </h3>
                <ol className="grid gap-3 sm:grid-cols-4">
                  {[
                    [en ? "Requested" : "신청", reviewRow.requested_at],
                    [en ? "Reviewed" : "검토", reviewRow.reviewed_at],
                    [en ? "Decided" : "승인·반려", reviewRow.decided_at],
                    [en ? "Completed" : "완료", reviewRow.completed_at],
                  ].map(([label, date], index) => (
                    <li
                      className={`rounded-lg border p-4 ${date ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                      key={label}
                    >
                      <span className="text-xs font-black">{index + 1}</span>
                      <strong className="mt-1 block">{label}</strong>
                      <span className="mt-2 block text-xs">
                        {withdrawalDate(date, en)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
              {!["REJECTED", "COMPLETED"].includes(reviewRow.status || "") &&
                reviewRow.status !== "APPROVED" && (
                  <label className="block">
                    <span className="mb-2 block font-black text-[#052b57]">
                      {reviewRow.status === "REQUESTED"
                        ? en
                          ? "Review note"
                          : "검토 의견"
                        : en
                          ? "Decision or rejection reason"
                          : "승인 의견 또는 반려 사유"}
                    </span>
                    <textarea
                      className={`${inputClass} min-h-28 py-3`}
                      onChange={(event) => setActionNote(event.target.value)}
                      placeholder={
                        en
                          ? "Enter an auditable processing note."
                          : "감사 이력에 남길 처리 의견을 입력하세요."
                      }
                      value={actionNote}
                    />
                  </label>
                )}
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--kr-gov-border-light)] bg-white px-6 py-4">
              <button
                className="rounded-lg border border-slate-300 px-5 py-3 font-black text-[#052b57]"
                onClick={() => {
                  setReviewId("");
                  setActionNote("");
                }}
              >
                {en ? "Close" : "닫기"}
              </button>
              {reviewRow.status === "REQUESTED" && (
                <button
                  className="rounded-lg bg-[#246beb] px-5 py-3 font-black text-white disabled:opacity-50"
                  disabled={busyId === reviewRow.request_id}
                  onClick={() => void transition(reviewRow, "review")}
                >
                  {en ? "Complete review" : "검토 완료"}
                </button>
              )}
              {reviewRow.status === "REVIEWED" && (
                <>
                  <button
                    className="rounded-lg border border-red-600 px-5 py-3 font-black text-red-700 disabled:opacity-50"
                    disabled={busyId === reviewRow.request_id}
                    onClick={() => void transition(reviewRow, "reject")}
                  >
                    {en ? "Reject" : "반려"}
                  </button>
                  <button
                    className="rounded-lg bg-[#246beb] px-5 py-3 font-black text-white disabled:opacity-50"
                    disabled={busyId === reviewRow.request_id}
                    onClick={() => void transition(reviewRow, "approve")}
                  >
                    {en ? "Approve" : "승인"}
                  </button>
                </>
              )}
              {reviewRow.status === "APPROVED" && (
                <button
                  className="rounded-lg bg-red-700 px-5 py-3 font-black text-white disabled:opacity-50"
                  disabled={busyId === reviewRow.request_id}
                  onClick={() => void transition(reviewRow, "complete")}
                >
                  {en ? "Complete withdrawal" : "탈퇴 완료 처리"}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function WithdrawalRequestScreen({ en }: { en: boolean }) {
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [handoverTo, setHandoverTo] = useState("");
  const [preflight, setPreflight] = useState<WithdrawalPreflight | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/home/api/member-withdrawals/preflight", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as WithdrawalPreflight & {
          message?: string;
        };
        if (!response.ok)
          throw new Error(
            body.message ||
              (en
                ? "Unable to check withdrawal eligibility."
                : "탈퇴 가능 여부를 확인할 수 없습니다."),
          );
        if (!cancelled) setPreflight(body);
      })
      .catch((reason) => {
        if (!cancelled) {
          const raw = reason instanceof Error ? reason.message : String(reason);
          setError(
            raw === "AUTHENTICATION_REQUIRED"
              ? en
                ? "Sign in to view your withdrawal eligibility."
                : "회원 탈퇴 신청을 진행하려면 먼저 로그인해 주세요."
              : raw,
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [en]);

  async function downloadPersonalData() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/mypage/personal-data/export", {
        credentials: "include",
      });
      if (!response.ok)
        throw new Error(
          en ? "The download failed." : "개인정보 다운로드에 실패했습니다.",
        );
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "personal-data.json";
      anchor.click();
      URL.revokeObjectURL(href);
      setMessage(
        en
          ? "Your personal data copy was downloaded."
          : "보유 개인정보 사본을 다운로드했습니다.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function submitWithdrawal(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (reason.trim().length < 5) {
      setError(
        en
          ? "Enter a withdrawal reason of at least 5 characters."
          : "탈퇴 사유를 5자 이상 입력하세요.",
      );
      return;
    }
    if (preflight?.handoverRequired && !handoverTo.trim()) {
      setError(
        en
          ? "Enter the account that will receive your pending work."
          : "진행 업무를 인계받을 계정을 입력하세요.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/home/api/member-withdrawals", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          reason: reason.trim(),
          confirmed: true,
          handoverTo: handoverTo.trim(),
        }),
      });
      const body = (await response.json()) as {
        requestId?: string;
        status?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(body.message || "WITHDRAWAL_REQUEST_FAILED");
      setRequestId(body.requestId || "");
      setStep(4);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  const labels = en
    ? [
        "Identity verified",
        "Important notices",
        "Data backup",
        "Final confirmation",
      ]
    : ["본인인증 완료", "유의사항 확인", "데이터 백업", "최종 확인"];

  return (
    <main
      className="min-h-screen bg-slate-50 py-10"
      data-screen-theme="krds-v1"
      data-withdrawal-request-screen="true"
    >
      <div className="mx-auto max-w-4xl px-4 lg:px-8">
        <header className="text-center">
          <p className="gov-text-label font-black text-[#246beb]">
            {en ? "MY PAGE" : "마이페이지"}
          </p>
          <h1 className="gov-text-heading-lg mt-2 font-black text-[#052b57]">
            {en ? "Account withdrawal" : "서비스 회원 탈퇴"}
          </h1>
          <p className="gov-text-body mt-3 text-slate-600">
            {en
              ? "Please review the steps below before ending your use of the platform."
              : "플랫폼 이용을 종료하시기 전, 아래 절차를 확인해 주시기 바랍니다."}
          </p>
        </header>

        <ol
          className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4"
          aria-label={en ? "Withdrawal progress" : "탈퇴 진행 단계"}
        >
          {labels.map((label, index) => {
            const stage = index + 1;
            const active = step === stage;
            const done = stage < step;
            return (
              <li
                className={`rounded-xl border p-4 text-center ${active ? "border-[#246beb] bg-blue-50 text-[#052b57]" : done ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"}`}
                key={label}
              >
                <span
                  className={`mx-auto grid size-9 place-items-center rounded-full font-black ${active ? "bg-[#246beb] text-white" : done ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                >
                  {done ? "✓" : stage}
                </span>
                <strong className="mt-2 block text-sm">{label}</strong>
              </li>
            );
          })}
        </ol>

        {(error || message) && (
          <p
            className={`mt-6 rounded-xl border p-4 font-bold ${error ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}
            role={error ? "alert" : "status"}
          >
            {error || message}
          </p>
        )}

        {loading ? (
          <section className="krds-component mt-8 rounded-xl border bg-white p-8 text-center font-bold text-slate-600">
            {en
              ? "Checking your account..."
              : "계정 상태와 진행 업무를 확인하고 있습니다."}
          </section>
        ) : step === 4 ? (
          <section
            className="krds-component mt-8 rounded-xl border border-emerald-300 bg-white p-8 text-center"
            data-withdrawal-request-complete="true"
          >
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </span>
            <h2 className="gov-text-heading-md mt-4 font-black text-[#052b57]">
              {en
                ? "Withdrawal request submitted"
                : "회원 탈퇴 신청이 접수되었습니다."}
            </h2>
            <p className="gov-text-body mt-3 text-slate-600">
              {en
                ? "A privacy officer will review the retention scope before approval."
                : "개인정보 보호 담당자가 보유정보 처리 범위를 검토한 뒤 승인 절차가 진행됩니다."}
            </p>
            <p className="mt-4 break-all rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
              {en ? "Request ID" : "신청 번호"}: {requestId || "-"}
            </p>
            <a
              className="krds-control mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-[#246beb] px-6 font-black text-white"
              href={en ? "/en/emission/my-tasks" : "/emission/my-tasks"}
            >
              {en ? "View my tasks" : "내 업무에서 진행 상태 확인"}
            </a>
          </section>
        ) : (
          <form className="mt-8" onSubmit={submitWithdrawal}>
            {step === 1 && (
              <section className="krds-component overflow-hidden rounded-xl border border-slate-200 bg-white">
                <header className="border-b border-slate-200 bg-slate-50 p-6">
                  <h2 className="gov-text-heading-md font-black text-[#052b57]">
                    ⚠{" "}
                    {en
                      ? "Step 1. Withdrawal Implications & Notices"
                      : "Step 1. 회원 탈퇴 유의사항 및 영향 안내"}
                  </h2>
                </header>
                <div className="space-y-6 p-6 md:p-8">
                  <p className="border-l-4 border-amber-500 bg-amber-50 p-4 font-bold text-amber-900">
                    {en
                      ? "All account permissions will be revoked. Personal data and activity history will be deleted except for records retained by law."
                      : "탈퇴 시 귀하의 계정과 관련된 모든 권한이 상실되며, 법령에 의거하여 보존해야 하는 정보를 제외한 개인정보 및 활동 내역이 삭제됩니다."}
                  </p>
                  <ul className="space-y-4 text-slate-700">
                    <li>
                      <strong className="block text-[#052b57]">
                        ●{" "}
                        {en
                          ? "Issued certificates and reports"
                          : "발급된 인증서 및 보고서 효력 상실"}
                      </strong>
                      <span className="mt-1 block text-sm">
                        {en
                          ? "Online lookup and verification will no longer be available after withdrawal."
                          : "플랫폼에서 발급받은 인증서 및 보고서의 온라인 조회·검증 서비스 이용이 불가능해집니다."}
                      </span>
                    </li>
                    <li>
                      <strong className="block text-[#052b57]">
                        ●{" "}
                        {en
                          ? "Unused credits and payment information"
                          : "미사용 크레딧 및 결제 정보"}
                      </strong>
                      <span className="mt-1 block text-sm">
                        {en
                          ? "Review remaining credits and transaction points before withdrawal."
                          : "보유 중인 탄소 크레딧 및 거래 포인트의 잔여 내역을 탈퇴 전에 반드시 확인하세요."}
                      </span>
                    </li>
                    <li>
                      <strong className="block text-[#052b57]">
                        ● {en ? "Re-registration restriction" : "재가입 제한"}
                      </strong>
                      <span className="mt-1 block text-sm">
                        {en
                          ? "Re-registration with the same identity may be restricted for 30 days."
                          : "탈퇴 후 동일한 ID와 본인 식별 정보로 재가입이 30일간 제한될 수 있습니다."}
                      </span>
                    </li>
                    <li>
                      <strong className="block text-[#052b57]">
                        ●{" "}
                        {en
                          ? "Pending work and handover"
                          : "진행 업무 및 업무 인계"}
                      </strong>
                      <span className="mt-1 block text-sm">
                        {preflight?.handoverRequired
                          ? en
                            ? "Your role requires a handover account."
                            : "관리 역할이 있어 업무 인계 대상 지정이 필요합니다."
                          : en
                            ? "No mandatory manager handover was detected."
                            : "필수 관리자 업무 인계 대상은 확인되지 않았습니다."}
                      </span>
                    </li>
                    {(preflight?.retentionPolicy || []).map((item) => (
                      <li key={`${item.category}-${item.period}`}>
                        <strong className="block text-[#052b57]">
                          ● {item.category}
                        </strong>
                        <span className="mt-1 block text-sm">
                          {item.period}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <label className="flex cursor-pointer items-start gap-3 border-t border-slate-200 pt-6 font-bold text-[#052b57]">
                    <input
                      checked={confirmed}
                      className="mt-1 size-5"
                      onChange={(event) => setConfirmed(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      {en
                        ? "I have reviewed and agree to all notices. (Required)"
                        : "위 유의사항을 모두 확인하였으며, 이에 동의합니다. (필수)"}
                    </span>
                  </label>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="krds-component overflow-hidden rounded-xl border border-slate-200 bg-white">
                <header className="border-b border-slate-200 bg-slate-50 p-6">
                  <h2 className="gov-text-heading-md font-black text-[#052b57]">
                    ↓{" "}
                    {en
                      ? "Step 2. Data Backup & Storage Options"
                      : "Step 2. 데이터 백업 및 보관 옵션"}
                  </h2>
                </header>
                <div className="p-6 md:p-8">
                  <p className="text-slate-600">
                    {en
                      ? "Download or review accumulated data before withdrawal."
                      : "탈퇴 전, 서비스 이용 기간 동안 축적된 개인정보와 배출량·거래 자료를 내려받거나 확인할 수 있습니다."}
                  </p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
                      <div>
                        <strong className="block text-sm text-[#052b57]">
                          {en
                            ? "Personal and membership data (JSON)"
                            : "개인정보 및 회원정보 (JSON)"}
                        </strong>
                        <span className="mt-1 block text-xs text-slate-500">
                          {en
                            ? "Current account data copy"
                            : "현재 계정의 보유정보 사본"}
                        </span>
                      </div>
                      <button
                        className="krds-control rounded-lg border border-[#246beb] px-3 py-2 text-xs font-black text-[#246beb] disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void downloadPersonalData()}
                        type="button"
                      >
                        {busy
                          ? en
                            ? "Preparing"
                            : "준비 중"
                          : en
                            ? "Download"
                            : "다운로드"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
                      <div>
                        <strong className="block text-sm text-[#052b57]">
                          {en
                            ? "Emission reports and transaction history"
                            : "배출량 보고서 및 거래 내역"}
                        </strong>
                        <span className="mt-1 block text-xs text-slate-500">
                          {en
                            ? "Select files from your download history"
                            : "다운로드 이력에서 필요한 파일 선택"}
                        </span>
                      </div>
                      <a
                        className="krds-control rounded-lg border border-[#246beb] px-3 py-2 text-xs font-black text-[#246beb]"
                        href={
                          en
                            ? "/en/mypage/download-history"
                            : "/mypage/download-history"
                        }
                      >
                        {en ? "Review" : "내역 확인"}
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="krds-component overflow-hidden rounded-xl border border-slate-200 bg-white">
                <header className="border-b border-slate-200 bg-slate-50 p-6">
                  <h2 className="gov-text-heading-md font-black text-[#052b57]">
                    {en ? "Final confirmation" : "최종 확인 및 탈퇴 신청"}
                  </h2>
                </header>
                <div className="space-y-5 p-6 md:p-8">
                  {preflight?.eligible === false && (
                    <p className="rounded-lg border border-red-300 bg-red-50 p-4 font-bold text-red-800">
                      {en
                        ? "An active withdrawal request already exists."
                        : `이미 처리 중인 탈퇴 신청이 있습니다. (${preflight.openRequestCount || 0}건)`}
                    </p>
                  )}
                  <label className="block font-bold text-[#052b57]">
                    {en ? "Reason for withdrawal" : "탈퇴 사유"}
                    <textarea
                      className={`${inputClass} mt-2 min-h-28 py-3`}
                      maxLength={1000}
                      onChange={(event) => setReason(event.target.value)}
                      required
                      value={reason}
                    />
                    <small className="mt-1 block font-normal text-slate-500">
                      {reason.length}/1000 ·{" "}
                      {en ? "At least 5 characters" : "5자 이상 입력"}
                    </small>
                  </label>
                  {preflight?.handoverRequired && (
                    <label className="block font-bold text-[#052b57]">
                      {en ? "Handover account" : "업무 인계 대상 계정"}
                      <input
                        className={`${inputClass} mt-2`}
                        onChange={(event) => setHandoverTo(event.target.value)}
                        required
                        value={handoverTo}
                      />
                    </label>
                  )}
                </div>
              </section>
            )}

            <div className="mt-6 grid gap-3 md:grid-cols-[1fr_2fr]">
              <button
                className="krds-control h-12 rounded-lg border border-slate-300 bg-white px-5 font-black text-[#052b57]"
                onClick={() =>
                  step === 1
                    ? location.assign(en ? "/en/mypage" : "/mypage")
                    : setStep((value) => value - 1)
                }
                type="button"
              >
                {step === 1
                  ? en
                    ? "Cancel"
                    : "탈퇴 취소"
                  : en
                    ? "Previous"
                    : "이전 단계"}
              </button>
              {step < 3 ? (
                <button
                  className="krds-control h-12 rounded-lg bg-[#246beb] px-5 font-black text-white disabled:bg-slate-300"
                  disabled={step === 1 && !confirmed}
                  onClick={() => setStep((value) => value + 1)}
                  type="button"
                >
                  {step === 1
                    ? en
                      ? "Continue to data backup"
                      : "다음 단계 진행 (데이터 백업)"
                    : en
                      ? "Continue to final confirmation"
                      : "최종 확인으로 이동"}
                </button>
              ) : (
                <button
                  className="krds-control h-12 rounded-lg bg-red-700 px-5 font-black text-white disabled:bg-slate-300"
                  disabled={busy || preflight?.eligible === false}
                  type="submit"
                >
                  {busy
                    ? en
                      ? "Submitting..."
                      : "신청 처리 중..."
                    : en
                      ? "Submit withdrawal request"
                      : "회원 탈퇴 신청"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function DormantRecoveryEntry({ en }: { en: boolean }) {
  const [accepted, setAccepted] = useState(false);
  const query = new URLSearchParams(location.search);
  const requestedReturnTo = query.get("returnTo") || "";
  const returnTo = requestedReturnTo.startsWith("/")
    ? requestedReturnTo
    : "/planned/member/account-withdrawal/account-withdrawal-s1";
  const identityPath = `${en ? "/en" : ""}/planned/member/account-lock-recovery/account-lock-recovery-s2?processCode=ACCOUNT_LOCK_RECOVERY&stepCode=ACCOUNT_LOCK_RECOVERY_S2&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main
      className="mx-auto max-w-5xl px-4 py-8 lg:px-8"
      data-dormant-recovery-entry="true"
      data-screen-theme="krds-v1"
    >
      <header className="border-b border-slate-200 pb-6">
        <p className="gov-text-label font-black text-[#246beb]">
          {en ? "Account recovery" : "계정 복구"} · 1/3
        </p>
        <h1 className="gov-text-heading-lg mt-2 font-black text-[#052b57]">
          {en ? "Welcome back." : "다시 오신 것을 진심으로 환영합니다."}
        </h1>
        <p className="gov-text-body mt-2 text-slate-600">
          {en
            ? "Confirm the account state before identity verification and reactivation."
            : "본인인증과 휴면 해제에 앞서 현재 계정 상태와 복구 범위를 확인합니다."}
        </p>
      </header>

      <ol
        className="mt-6 grid gap-3 sm:grid-cols-3"
        aria-label={en ? "Recovery progress" : "복구 진행 단계"}
      >
        {[
          en ? "Check status" : "상태 확인",
          en ? "Verify identity" : "본인인증",
          en ? "Reactivate" : "휴면 해제",
        ].map((label, index) => (
          <li
            className={`krds-component flex items-center gap-3 rounded-xl border p-4 ${index === 0 ? "border-[#246beb] bg-blue-50 text-[#052b57]" : "border-slate-200 bg-white text-slate-500"}`}
            key={label}
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full font-black ${index === 0 ? "bg-[#246beb] text-white" : "bg-slate-100"}`}
            >
              {index + 1}
            </span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-6">
          <article className="krds-component rounded-xl border border-slate-200 bg-white p-6">
            <p className="gov-text-label font-black text-[#246beb]">
              {en ? "CURRENT ACCOUNT STATE" : "현재 계정 상태"}
            </p>
            <h2 className="gov-text-heading-md mt-2 font-black text-[#052b57]">
              {en
                ? "Dormant or locked account recovery"
                : "휴면·잠금 계정 복구 대상 확인"}
            </h2>
            <p className="gov-text-body mt-3 text-slate-600">
              {en
                ? "Your account will be reactivated only after identity verification. No account data is changed on this screen."
                : "본인확인이 완료된 계정만 다시 활성화됩니다. 이 화면에서는 계정 정보가 변경되지 않습니다."}
            </p>
          </article>

          <article className="krds-component rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="gov-text-heading-sm font-black text-[#052b57]">
              {en
                ? "Items restored after reactivation"
                : "휴면 해제 후 복구되는 항목"}
            </h2>
            <ul className="gov-text-body-sm mt-4 grid gap-3 text-slate-700 sm:grid-cols-2">
              {(en
                ? [
                    "Sign-in access",
                    "Membership and company link",
                    "Assigned permissions",
                    "Pending work access",
                  ]
                : [
                    "로그인 이용",
                    "회원·소속 회사 연결",
                    "배정된 권한",
                    "진행 중 업무 접근",
                  ]
              ).map((item) => (
                <li className="rounded-lg bg-slate-50 p-3 font-bold" key={item}>
                  ✓ {item}
                </li>
              ))}
            </ul>
          </article>

          <label className="krds-component flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-5 text-[#052b57]">
            <input
              checked={accepted}
              className="mt-1 size-5"
              onChange={(event) => setAccepted(event.target.checked)}
              type="checkbox"
            />
            <span className="gov-text-body-sm font-bold">
              {en
                ? "I have reviewed the account recovery scope and will continue with identity verification."
                : "계정 복구 범위를 확인했으며 본인인증을 계속 진행합니다."}
            </span>
          </label>
        </div>

        <aside className="space-y-4">
          <article className="krds-component rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="gov-text-heading-sm font-black text-[#052b57]">
              {en ? "Next step" : "다음 단계"}
            </h2>
            <p className="gov-text-body-sm mt-2 text-slate-600">
              {en
                ? "Verify your identity, then reactivate the account."
                : "본인인증을 마친 뒤 계정을 다시 활성화합니다."}
            </p>
            <a
              aria-disabled={!accepted}
              className={`krds-control mt-5 flex h-12 items-center justify-center rounded-lg px-4 font-black ${accepted ? "bg-[#246beb] text-white" : "pointer-events-none bg-slate-200 text-slate-500"}`}
              href={accepted ? identityPath : undefined}
            >
              {en ? "Verify identity" : "본인인증 진행"}
            </a>
          </article>
          <a
            className="krds-control flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 font-bold text-[#052b57]"
            href={returnTo}
          >
            {en ? "Return to previous task" : "이전 업무로 돌아가기"}
          </a>
          <details className="krds-component rounded-xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer font-black text-[#052b57]">
              {en ? "Need help?" : "도움이 필요한가요?"}
            </summary>
            <p className="gov-text-body-sm mt-3 text-slate-600">
              {en
                ? "Use password recovery if identity verification cannot be completed."
                : "본인인증을 완료할 수 없다면 비밀번호 재설정 절차를 이용하세요."}
            </p>
            <a
              className="mt-3 inline-block font-bold text-[#246beb] underline"
              href={en ? "/en/signin/findPassword" : "/signin/findPassword"}
            >
              {en ? "Password recovery" : "비밀번호 재설정"}
            </a>
          </details>
        </aside>
      </section>
    </main>
  );
}

function GeneratedContent({
  screen,
  runtimeWarning = "",
}: {
  screen: GeneratedScreenDefinition;
  runtimeWarning?: string;
}) {
  const en = isEnglish();
  const isWithdrawalRequest =
    screen.processCode === "ACCOUNT_WITHDRAWAL" &&
    screen.stepCode === "ACCOUNT_WITHDRAWAL_S1" &&
    screen.audience === "USER";
  const isWithdrawalStatus =
    screen.processCode === "ACCOUNT_WITHDRAWAL" &&
    screen.stepCode === "ACCOUNT_WITHDRAWAL_S2" &&
    screen.audience === "USER";
  const isWithdrawalAdmin =
    screen.processCode === "ACCOUNT_WITHDRAWAL" &&
    screen.stepCode === "ACCOUNT_WITHDRAWAL_S3" &&
    screen.audience === "ADMIN";
  const isWithdrawalComplete =
    screen.processCode === "ACCOUNT_WITHDRAWAL" &&
    screen.stepCode === "ACCOUNT_WITHDRAWAL_S4" &&
    screen.audience === "USER";
  const isDormantRecoveryEntry =
    screen.processCode === "ACCOUNT_LOCK_RECOVERY" &&
    screen.stepCode === "ACCOUNT_LOCK_RECOVERY_S1" &&
    screen.audience === "USER";
  const spec = screen.specification;
  const support = record(screen.support || spec.support);
  const help = record(support.help),
    helpItems = Array.isArray(help.items) ? help.items : [];
  const materialized = useMemo(
    () =>
      materializeScreen(screen, {
        actorCode: screen.actorCode,
        locale: en ? "EN" : "KO",
      }),
    [en, screen],
  );
  const states = list(screen.traceability.requiredStates),
    scenarios = list(screen.traceability.requiredScenarioTypes);
  const rawFields = items(materialized.fields, "FIELD"),
    rawActions = items(materialized.actions, "ACTION");
  const kpis = isWithdrawalRequest ? [] : items(spec.kpis, "KPI");
  const sections = isWithdrawalRequest
    ? []
    : items(materialized.sections, "SECTION");
  const fields = isWithdrawalRequest
    ? [
        {
          ...(rawFields.find((field) => field.code === "taskComment") || {}),
          code: "taskComment",
          label: en ? "Reason for withdrawal" : "탈퇴 사유",
          control: "TEXTAREA",
          required: true,
          editable: true,
        },
        {
          code: "withdrawalAcknowledgement",
          label: en
            ? "I understand the withdrawal and retention notice."
            : "탈퇴 영향과 법정 보존 안내를 확인했습니다.",
          control: "CHECKBOX",
          dataType: "BOOLEAN",
          required: true,
          editable: true,
        },
      ]
    : rawFields;
  const actions = (
    isWithdrawalRequest
      ? rawActions
          .filter((action) => action.code === "ACCOUNT_WITHDRAWAL_REQUEST")
          .map((action) => ({
            ...action,
            label: en ? "Request withdrawal" : "회원 탈퇴 신청",
          }))
      : rawActions
  ) as Array<{
    code: string;
    label: string;
    requestFields?: unknown[];
    apiPath?: unknown;
    apiMethod?: unknown;
  }>;
  const requestedCommandCode =
    new URLSearchParams(location.search).get("commandCode") || "";
  const commandCode =
    requestedCommandCode ||
    text(spec.commandCode) ||
    actions[0]?.code ||
    "COMPLETE";
  const initialContext = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return {
      tenantId: query.get("tenantId") || "DEFAULT",
      projectId:
        query.get("projectId") ||
        (isWithdrawalRequest ? "ACCOUNT_WITHDRAWAL" : ""),
      executionId: query.get("executionId") || "",
      liveSmokeRunId: query.get("liveSmokeRunId") || "",
      qaRecording: query.get("qaRecording") === "1",
      commandCode: query.get("commandCode") || "",
      statusCase: query.get("statusCase") || "",
      idempotencyKey: query.get("idempotencyKey") || "",
      currentState: query.get("currentState") || "",
    };
  }, []);
  const liveSmokeMode =
    /^[0-9a-f-]{36}$/i.test(initialContext.liveSmokeRunId) &&
    /^[0-9a-f-]{36}$/i.test(initialContext.idempotencyKey) &&
    liveSmokeStatuses.has(initialContext.statusCase) &&
    Boolean(initialContext.commandCode);
  const [tenantId, setTenantId] = useState(initialContext.tenantId),
    [projectId, setProjectId] = useState(initialContext.projectId),
    [executionId, setExecutionId] = useState(initialContext.executionId);
  const [values, setValues] = useState<Record<string, string>>({}),
    [draftVersion, setDraftVersion] = useState(0),
    [draftStatus, setDraftStatus] = useState("NOT_SAVED"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [currentState, setCurrentState] = useState(initialContext.currentState),
    [runtimeObserved, setRuntimeObserved] = useState(false),
    [accessDenied, setAccessDenied] = useState(false),
    [nextTask, setNextTask] = useState<NextTask | null>(null);
  const [lastObservation, setLastObservation] =
    useState<CommandObservation | null>(null);
  const [optionSets, setOptionSets] = useState<
    Record<string, Array<{ value: string; label: string }>>
  >({});
  const apiBase = en
    ? "/en/home/api/process-executions"
    : "/home/api/process-executions";
  const fieldEntries = useMemo<ContractItem[]>(
    () =>
      fields.length
        ? fields
        : [{ code: "WORK_NOTE", label: en ? "Work note" : "업무 메모" }],
    [en, fields],
  );
  const resolvedFieldEntries = useMemo(
    () =>
      fieldEntries.map((field) => ({
        ...field,
        options: optionSets[field.code] || field.options,
      })),
    [fieldEntries, optionSets],
  );
  const watermarkBits = useMemo(
    () =>
      liveSmokeMode
        ? liveSmokeWatermarkBits(initialContext.liveSmokeRunId)
        : [],
    [initialContext.liveSmokeRunId, liveSmokeMode],
  );
  const kpiValue = (code: string) => {
    const normalized = code.toUpperCase();
    if (normalized.includes("COMPLETION"))
      return currentState.includes("COMPLETED")
        ? "100%"
        : draftStatus === "DRAFT"
          ? "50%"
          : "0%";
    if (normalized.includes("SLA") || normalized.includes("DEADLINE"))
      return runtimeObserved
        ? en
          ? "ON TIME"
          : "기한 내"
        : en
          ? "WAIT"
          : "대기";
    if (normalized.includes("BLOCK") || normalized.includes("ERROR"))
      return error ? "1" : "0";
    if (normalized.includes("RECOVERY"))
      return runtimeObserved && !error ? "100%" : "0%";
    return runtimeObserved ? (en ? "OBSERVED" : "확인") : en ? "WAIT" : "대기";
  };

  useEffect(() => {
    if (
      isWithdrawalRequest ||
      isWithdrawalStatus ||
      isWithdrawalAdmin ||
      isWithdrawalComplete ||
      isDormantRecoveryEntry
    )
      return;
    if (!tenantId.trim() || !projectId.trim()) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      tenantId,
      projectId,
      processCode: screen.processCode,
      stepCode: screen.stepCode,
    });
    fetch(`${apiBase}/field-options?${query}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as Record<string, unknown>;
        if (!response.ok)
          throw new Error(
            String(result.message || "Failed to load field options."),
          );
        setOptionSets(
          (result.optionSets || {}) as Record<
            string,
            Array<{ value: string; label: string }>
          >,
        );
      })
      .catch((reason) => {
        if ((reason as Error).name !== "AbortError")
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [apiBase, projectId, screen.processCode, screen.stepCode, tenantId]);

  async function request(
    url: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ||
            (en ? "The request failed." : "업무 요청에 실패했습니다."),
        );
      const execution = (result.execution || result) as Record<string, unknown>;
      if (execution.executionId) setExecutionId(String(execution.executionId));
      if (execution.currentState)
        setCurrentState(String(execution.currentState));
      if (execution.executionId && execution.currentState)
        setRuntimeObserved(true);
      setMessage(
        en
          ? "The process state was saved successfully."
          : "프로세스 상태와 업무 증적을 저장했습니다.",
      );
      return result as Record<string, unknown>;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
  async function start(event: FormEvent) {
    event.preventDefault();
    await request(`${apiBase}/start`, {
      tenantId,
      projectId,
      processCode: screen.processCode,
      actorCode: screen.actorCode,
      routePath: screen.routePath,
      audience: screen.audience,
    });
  }
  async function loadExecution(expectedExecutionId = "") {
    if (!requireDraftContext()) return;
    setBusy(true);
    setError("");
    setMessage("");
    setAccessDenied(false);
    setRuntimeObserved(false);
    try {
      const query = new URLSearchParams({
        tenantId,
        projectId,
        processCode: screen.processCode,
      });
      const response = await fetch(`${apiBase}?${query}`, {
        credentials: "include",
      });
      const result = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        setAccessDenied(response.status === 403);
        throw new Error(
          String(
            result.message ||
              (response.status === 403
                ? en
                  ? "Access denied."
                  : "접근 권한이 없습니다."
                : en
                  ? "Failed to load the process."
                  : "프로세스 실행 정보를 불러오지 못했습니다."),
          ),
        );
      }
      const execution = (result.execution || result) as Record<string, unknown>;
      if (!execution.executionId)
        throw new Error(
          en ? "No running process exists." : "진행 중인 프로세스가 없습니다.",
        );
      if (
        expectedExecutionId &&
        String(execution.executionId).toLowerCase() !==
          expectedExecutionId.toLowerCase()
      )
        throw new Error(
          en
            ? "The requested execution is not the current running process."
            : "요청한 실행과 현재 진행 중 실행이 일치하지 않습니다.",
        );
      setExecutionId(String(execution.executionId));
      setCurrentState(String(execution.currentState || ""));
      setRuntimeObserved(Boolean(execution.currentState));
      setMessage(
        en
          ? "The running process was loaded."
          : "진행 중인 프로세스를 불러왔습니다.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      initialContext.executionId &&
      initialContext.projectId &&
      initialContext.tenantId
    )
      void loadExecution(initialContext.executionId);
  }, []);
  async function execute(command: string) {
    let targetExecutionId = executionId;
    if (!targetExecutionId && isWithdrawalRequest) {
      const started = await request(`${apiBase}/start`, {
        tenantId,
        projectId,
        processCode: screen.processCode,
        actorCode: screen.actorCode,
        routePath: screen.routePath,
        audience: screen.audience,
      });
      const startedExecution = (started?.execution || started || {}) as Record<
        string,
        unknown
      >;
      targetExecutionId = String(startedExecution.executionId || "");
    }
    if (!targetExecutionId) {
      setError(
        en
          ? "Unable to start the withdrawal request."
          : "탈퇴 신청을 시작할 수 없습니다.",
      );
      return;
    }
    const action = actions.find((candidate) => candidate.code === command);
    const requestFields = Array.isArray(action?.requestFields)
      ? action.requestFields.map(String)
      : null;
    const missing = fieldEntries.filter((field) => {
      const validation = record(field.validation),
        mapping = String(field.mappingStatus || "").toUpperCase();
      const serverManaged =
        field.editable === false ||
        String(field.control || "")
          .toUpperCase()
          .includes("HIDDEN") ||
        mapping === "CONTEXT" ||
        String(validation.source || "").toUpperCase() === "SERVER_CONTEXT";
      const value = String(values[field.code] || "").trim();
      return (
        !serverManaged &&
        field.required === true &&
        (requestFields === null || requestFields.includes(field.code)) &&
        (field.code === "withdrawalAcknowledgement" ? value !== "true" : !value)
      );
    });
    if (missing.length && !liveSmokeMode) {
      setError(
        `${en ? "Complete required fields" : "필수 항목을 입력하세요"}: ${missing.map((field) => field.label).join(", ")}`,
      );
      return;
    }
    if (draftStatus !== "DRAFT" && !liveSmokeMode) {
      setError(
        en
          ? "Save the work draft before completing this step."
          : "단계를 완료하기 전에 업무 데이터를 임시저장하세요.",
      );
      return;
    }
    if (liveSmokeMode && command !== initialContext.commandCode) {
      setError("LIVE_SMOKE_COMMAND_NOT_EXACT");
      return;
    }
    const idempotencyKey = liveSmokeMode
      ? initialContext.idempotencyKey
      : runtimeUuid();
    const apiPath = text(action?.apiPath).replace(
      "{executionId}",
      encodeURIComponent(targetExecutionId),
    );
    const apiMethod = text(action?.apiMethod).toUpperCase();
    setBusy(true);
    setError("");
    setMessage("");
    let result: Record<string, unknown>;
    try {
      let response: Response;
      if (
        apiPath.startsWith("/") &&
        !apiPath.includes("{") &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(apiMethod)
      ) {
        const requestInput = Object.fromEntries(
          (requestFields || fieldEntries.map((field) => field.code)).map(
            (fieldCode) => {
              const field = fieldEntries.find(
                  (candidate) => candidate.code === fieldCode,
                ),
                kind = String(
                  field?.dataType || field?.control || "STRING",
                ).toUpperCase();
              const raw = values[fieldCode] ?? "";
              return [
                fieldCode,
                kind.includes("BOOLEAN") || kind.includes("CHECKBOX")
                  ? raw === "true"
                  : kind.includes("NUMBER") ||
                      kind.includes("DECIMAL") ||
                      kind.includes("INTEGER")
                    ? Number(raw)
                    : raw,
              ];
            },
          ),
        );
        response = await fetch(apiPath, {
          method: apiMethod,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...requestInput,
            tenantId,
            projectId,
            actorCode: screen.actorCode,
            idempotencyKey,
          }),
        });
      } else {
        const commandContext = new URLSearchParams(location.search);
        const commandRoutePath =
          commandContext.get("commandRoute") || screen.routePath;
        const commandAudience =
          (
            commandContext.get("commandAudience") || screen.audience
          ).toUpperCase() === "ADMIN"
            ? "ADMIN"
            : "USER";
        response = await fetch(`${apiBase}/${targetExecutionId}/commands`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            projectId,
            processCode: screen.processCode,
            stepCode: screen.stepCode,
            actorCode: screen.actorCode,
            routePath: commandRoutePath,
            audience: commandAudience,
            commandCode: command,
            idempotencyKey,
            requestJson: JSON.stringify(values),
            requireDraft: true,
          }),
        });
      }
      result = (await response.json()) as Record<string, unknown>;
      const statusCase = observedStatusCase(response.status, result);
      setLastObservation({
        commandCode: command,
        httpStatus: response.status,
        statusCase,
        output: result,
        idempotencyKey,
      });
      if (response.status === 403) setAccessDenied(true);
      if (!response.ok) {
        setError(
          String(
            result.message ||
              (en ? "The request failed." : "업무 요청에 실패했습니다."),
          ),
        );
        return;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return;
    } finally {
      setBusy(false);
    }
    setDraftStatus("SUBMITTED");
    setCurrentState(String(result.toState || currentState));
    const nextStepCode = String(result.nextStepCode || "");
    if (nextStepCode) {
      const path = String(
        (screen.audience === "ADMIN"
          ? result.nextAdminPath
          : result.nextUserPath) ||
          result.nextUserPath ||
          result.nextAdminPath ||
          "",
      );
      setNextTask({
        stepCode: nextStepCode,
        actorCode: String(result.nextActorCode || ""),
        path,
      });
      setMessage(
        en
          ? "Step completed. Continue with the next task."
          : "현재 단계가 완료되었습니다. 다음 업무를 진행하세요.",
      );
    } else {
      setNextTask(null);
      setMessage(
        en ? "The process is complete." : "프로세스가 완료되었습니다.",
      );
    }
  }
  function requireDraftContext() {
    if (tenantId.trim() && projectId.trim()) return true;
    setError(
      en
        ? "Enter the tenant and project ID first."
        : "테넌트와 프로젝트 ID를 먼저 입력하세요.",
    );
    return false;
  }
  async function loadDraft() {
    if (!requireDraftContext()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const query = new URLSearchParams({
        tenantId,
        projectId,
        processCode: screen.processCode,
        stepCode: screen.stepCode,
      });
      const response = await fetch(`${apiBase}/draft?${query}`, {
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ||
            (en
              ? "Failed to load the draft."
              : "임시저장을 불러오지 못했습니다."),
        );
      const draft = (result.draft || {}) as Record<string, unknown>;
      if (result.found && typeof draft.payloadJson === "string") {
        const loaded = JSON.parse(draft.payloadJson) as Record<string, unknown>;
        setValues(
          Object.fromEntries(
            Object.entries(loaded).map(([key, value]) => [
              key,
              value == null ? "" : String(value),
            ]),
          ),
        );
      }
      setDraftVersion(Number(draft.draftVersion || 0));
      setDraftStatus(String(draft.draftStatus || "NOT_SAVED"));
      setMessage(
        result.found
          ? en
            ? "The latest draft was loaded."
            : "최신 임시저장을 불러왔습니다."
          : en
            ? "No saved draft exists."
            : "저장된 임시저장이 없습니다.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft() {
    if (!requireDraftContext()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/draft`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          projectId,
          processCode: screen.processCode,
          stepCode: screen.stepCode,
          actorCode: screen.actorCode,
          payloadJson: JSON.stringify(values),
          evidenceJson: "{}",
          expectedVersion: draftVersion,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ||
            (en ? "Failed to save the draft." : "임시저장에 실패했습니다."),
        );
      const draft = (result.draft || {}) as Record<string, unknown>;
      setDraftVersion(Number(draft.draftVersion || draftVersion + 1));
      setDraftStatus(String(draft.draftStatus || "DRAFT"));
      setMessage(
        en
          ? "The draft was saved transactionally."
          : "업무 데이터가 트랜잭션으로 임시저장되었습니다.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (
      isWithdrawalRequest ||
      isWithdrawalStatus ||
      isWithdrawalAdmin ||
      isWithdrawalComplete ||
      isDormantRecoveryEntry
    )
      return;
    if (!initialContext.tenantId || !initialContext.projectId) return;
    void loadDraft();
    if (!initialContext.executionId) void loadExecution();
  }, [screen.processCode, screen.stepCode]);

  if (isWithdrawalRequest) return <WithdrawalRequestScreen en={en} />;
  if (isWithdrawalStatus) return <WithdrawalStatusScreen en={en} />;
  if (isWithdrawalAdmin) return <WithdrawalAdminScreen en={en} />;
  if (isWithdrawalComplete)
    return <WithdrawalStatusScreen completedOnly en={en} />;
  if (isDormantRecoveryEntry) return <DormantRecoveryEntry en={en} />;

  return (
    <main
      className="mx-auto max-w-7xl px-4 py-8 lg:px-8"
      data-screen-theme="krds-v1"
      data-access-denied={accessDenied ? "true" : "false"}
      data-audience={screen.audience}
      data-current-state={currentState}
      data-draft-status={draftStatus}
      data-draft-version={draftVersion}
      data-execution-id={executionId}
      data-live-smoke-run-id={
        liveSmokeMode ? initialContext.liveSmokeRunId : ""
      }
      data-process-code={screen.processCode}
      data-route-path={screen.routePath}
      data-last-command-code={lastObservation?.commandCode || ""}
      data-last-http-status={lastObservation?.httpStatus || ""}
      data-last-idempotency-key={lastObservation?.idempotencyKey || ""}
      data-last-output-json={
        lastObservation ? JSON.stringify(lastObservation.output) : ""
      }
      data-last-status-case={lastObservation?.statusCase || ""}
      data-project-id={projectId}
      data-runtime-observed={runtimeObserved ? "true" : "false"}
      data-step-code={screen.stepCode}
      data-tenant-id={tenantId}
    >
      {watermarkBits.length === 128 && (
        <div
          aria-label={`Live smoke binary watermark ${initialContext.liveSmokeRunId}`}
          data-live-smoke-watermark={initialContext.liveSmokeRunId}
          style={{
            display: "grid",
            gridAutoRows: "4px",
            gridTemplateColumns: "repeat(32, 4px)",
            height: "16px",
            left: 0,
            pointerEvents: "none",
            position: "fixed",
            top: 0,
            width: "128px",
            zIndex: 2147483647,
          }}
        >
          {watermarkBits.map((bit, index) => (
            <span
              aria-hidden="true"
              data-watermark-bit={bit}
              key={index}
              style={{
                backgroundColor: bit ? "#246beb" : "#052b57",
                display: "block",
                height: "4px",
                width: "4px",
              }}
            />
          ))}
        </div>
      )}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="gov-text-label font-black text-[#246beb]">
            {screen.processCode} · {screen.stepCode}
          </p>
          <h1 className="gov-text-heading-lg mt-2 font-black text-[#052b57]">
            {isWithdrawalRequest
              ? en
                ? "Request account withdrawal"
                : "회원 탈퇴 신청"
              : screen.pageName}
          </h1>
          <p className="gov-text-body mt-2 max-w-3xl text-slate-600">
            {isWithdrawalRequest
              ? en
                ? "Review the impact and submit your withdrawal request."
                : "탈퇴 영향과 보유정보 처리 내용을 확인한 뒤 신청합니다."
              : text(spec.businessPurpose) ||
                `${screen.actorCode} · ${screen.screenType}`}
          </p>
        </div>
        <a
          className="krds-control inline-flex items-center justify-center rounded-lg border border-[#246beb] bg-white px-4 font-bold text-[#246beb]"
          href={en ? "/en/emission/my-tasks" : "/emission/my-tasks"}
        >
          {en ? "Back to my tasks" : "내 업무로 돌아가기"}
        </a>
      </header>
      {runtimeWarning && (
        <p
          className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 font-bold text-amber-900"
          role="alert"
        >
          {runtimeWarning}
        </p>
      )}
      {!initialContext.qaRecording && !isWithdrawalRequest && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              [en ? "Actor" : "담당 액터", screen.actorCode],
              [
                en ? "Entry state" : "진입 상태",
                text(spec.fromState) || text(spec.entryCondition),
              ],
              [
                en ? "Target state" : "완료 상태",
                text(spec.toState) || text(spec.exitCondition),
              ],
              [en ? "Template" : "화면 템플릿", screen.templateCode],
            ] as Array<[string, string]>
          ).map(([label, value]) => (
            <article
              className="krds-component rounded-xl border bg-white"
              key={label}
            >
              <span className="gov-text-label font-bold text-slate-500">
                {label}
              </span>
              <strong className="gov-text-heading-sm mt-2 block break-words text-[#052b57]">
                {value || "-"}
              </strong>
            </article>
          ))}
        </section>
      )}
      {!initialContext.qaRecording && !isWithdrawalRequest && (
        <section className="krds-component mt-5 rounded-xl border border-blue-200 bg-blue-50">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="gov-text-label font-black text-blue-700">
                SCREEN COORDINATE
              </p>
              <p className="gov-text-body-sm mt-1 break-all text-slate-700">
                {materialized.coordinateKey}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-2 text-sm font-black ${materialized.valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
            >
              {materialized.valid
                ? en
                  ? "Contract valid"
                  : "계약 정상"
                : en
                  ? "Contract incomplete"
                  : "계약 보완 필요"}
            </span>
          </div>
        </section>
      )}
      {(message || error) && (
        <p
          className={`mt-5 rounded-xl border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
          data-live-smoke-message={error ? "error" : "success"}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
      {lastObservation && !isWithdrawalRequest && (
        <section
          className="krds-component mt-5 rounded-xl border bg-white"
          data-live-smoke-result="true"
        >
          <h2 className="gov-text-heading-sm font-black text-[#052b57]">
            {en ? "Command result" : "명령 실행 결과"}
          </h2>
          <p className="gov-text-body-sm mt-2">
            {lastObservation.commandCode} · HTTP {lastObservation.httpStatus} ·{" "}
            {lastObservation.statusCase}
          </p>
          <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-white">
            {JSON.stringify(lastObservation.output, null, 2)}
          </pre>
        </section>
      )}
      {isWithdrawalRequest && (
        <section
          className="krds-component mt-5 rounded-xl border border-red-200 bg-red-50"
          data-withdrawal-impact="true"
        >
          <h2 className="gov-text-heading-sm font-black text-red-900">
            {en ? "Before you withdraw" : "탈퇴 전 확인하세요"}
          </h2>
          <ul className="gov-text-body-sm mt-3 list-disc space-y-2 pl-5 text-red-900">
            <li>
              {en
                ? "You will not be able to sign in or continue assigned work after withdrawal."
                : "탈퇴 후 로그인과 배정된 업무 진행이 중단됩니다."}
            </li>
            <li>
              {en
                ? "Complete or hand over pending work before submitting."
                : "진행 중인 업무가 있다면 완료하거나 다른 담당자에게 인계해야 합니다."}
            </li>
            <li>
              {en
                ? "Records required by law are retained only for the statutory period."
                : "법령상 보존 의무가 있는 기록은 해당 기간 동안 분리 보관됩니다."}
            </li>
          </ul>
        </section>
      )}
      <section
        className={
          isWithdrawalRequest
            ? "mx-auto mt-6 grid max-w-4xl gap-6"
            : "mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]"
        }
      >
        <div className="space-y-6">
          {kpis.length > 0 && (
            <section
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              data-runtime-kpis="true"
            >
              {kpis.map((item) => {
                const value = kpiValue(item.code);
                return (
                  <article
                    className="krds-component rounded-xl border bg-white"
                    data-kpi-code={item.code}
                    data-kpi-value={value}
                    key={item.code}
                  >
                    <span className="gov-text-label font-bold text-slate-500">
                      {item.label}
                    </span>
                    <strong className="gov-text-heading-md mt-2 block text-[#052b57]">
                      {value}
                    </strong>
                  </article>
                );
              })}
            </section>
          )}
          <section
            className="krds-component rounded-xl border bg-white"
            data-work-data="true"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="gov-text-heading-md font-black text-[#052b57]">
                  {isWithdrawalRequest
                    ? en
                      ? "Withdrawal request"
                      : "탈퇴 신청 정보"
                    : en
                      ? "Work data"
                      : "업무 데이터"}
                </h2>
                <p className="gov-text-body-sm mt-2 text-slate-600">
                  {isWithdrawalRequest
                    ? en
                      ? "Enter only the information required to review your request."
                      : "탈퇴 신청 검토에 필요한 정보만 입력합니다."
                    : text(spec.completionRule)}
                </p>
              </div>
              {!isWithdrawalRequest && (
                <span className="gov-text-label rounded-full bg-slate-100 px-3 py-2 font-bold text-slate-700">
                  {draftStatus} · v{draftVersion}
                </span>
              )}
            </div>
            {initialContext.qaRecording && (
              <div
                className="mt-4 grid gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:grid-cols-2"
                data-recording-values="true"
              >
                {Object.entries(values)
                  .filter(([, value]) => String(value).trim())
                  .slice(0, 4)
                  .map(([code, value]) => (
                    <p className="break-all text-sm text-slate-700" key={code}>
                      <strong className="text-[#052b57]">{code}</strong>
                      <br />
                      {String(value)}
                    </p>
                  ))}
                {lastObservation && (
                  <p
                    className="sm:col-span-2 rounded-lg bg-emerald-100 p-2 font-black text-emerald-900"
                    data-recording-command-result="true"
                  >
                    {lastObservation.commandCode} · HTTP{" "}
                    {lastObservation.httpStatus} · {lastObservation.statusCase}{" "}
                    · {currentState}
                  </p>
                )}
              </div>
            )}
            <div
              className={`mt-5 grid gap-4 ${isWithdrawalRequest ? "" : "md:grid-cols-2"}`}
            >
              {resolvedFieldEntries.map((field, index) => (
                <div
                  {...helpAnchorAttributes(helpItems[sections.length + index])}
                  key={field.code}
                >
                  <ContractFieldControl
                    field={field}
                    value={values[field.code] || ""}
                    onChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [field.code]: value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {!isWithdrawalRequest && (
                <button
                  className="krds-control rounded-lg border border-[#246beb] bg-white px-4 font-black text-[#246beb] disabled:opacity-50"
                  data-live-smoke-action="load-draft"
                  disabled={busy}
                  onClick={() => void loadDraft()}
                  type="button"
                >
                  {en ? "Load draft" : "임시저장 불러오기"}
                </button>
              )}
              <button
                className="krds-control rounded-lg bg-[#246beb] px-4 font-black text-white disabled:opacity-50"
                data-live-smoke-action="save-draft"
                disabled={busy}
                onClick={() => void saveDraft()}
                type="button"
              >
                {isWithdrawalRequest
                  ? en
                    ? "Save request"
                    : "신청 내용 저장"
                  : en
                    ? "Save draft"
                    : "임시저장"}
              </button>
            </div>
          </section>
          {sections.length > 0 && (
            <section className="grid gap-4 md:grid-cols-2">
              {sections.map((section, index) => (
                <CommonContentCard
                  {...helpAnchorAttributes(helpItems[index])}
                  className="krds-component min-h-36 p-5"
                  key={section.code}
                >
                  <h2 className="gov-text-heading-sm font-black text-[#052b57]">
                    {section.label}
                  </h2>
                  <p className="gov-text-body-sm mt-3 text-slate-600">
                    {en
                      ? "This section uses the registered shared component and data contract."
                      : "등록된 공통 컴포넌트와 데이터 계약을 사용하는 영역입니다."}
                  </p>
                </CommonContentCard>
              ))}
            </section>
          )}
          {!isWithdrawalRequest &&
            helpItems.length >
              sections.length + resolvedFieldEntries.length && (
              <section
                aria-label={
                  en ? "Additional screen guide anchors" : "추가 화면 도움말"
                }
                className="grid gap-3 md:grid-cols-2"
              >
                {helpItems
                  .slice(sections.length + resolvedFieldEntries.length)
                  .map((entry, index) => {
                    const item = record(entry);
                    return (
                      <CommonContentCard
                        {...helpAnchorAttributes(item)}
                        className="p-5"
                        key={text(item.id) || `help-${index}`}
                      >
                        <h2 className="gov-text-heading-sm font-black text-[#052b57]">
                          {text(item.title)}
                        </h2>
                        <p className="gov-text-body-sm mt-2 text-slate-600">
                          {text(item.body)}
                        </p>
                      </CommonContentCard>
                    );
                  })}
              </section>
            )}
        </div>
        <aside className="space-y-5">
          {!isWithdrawalRequest && (
            <section className="krds-component rounded-xl border bg-white">
              <h2 className="gov-text-heading-sm font-black text-[#052b57]">
                {en ? "Runtime status" : "실행 상태"}
              </h2>
              <p className="gov-text-body-sm mt-2 text-slate-700">
                {en ? "Current state" : "현재 상태"}:{" "}
                <strong>{currentState || "-"}</strong>
              </p>
              <button
                className="krds-control mt-4 w-full rounded-lg border border-[#052b57] bg-white font-black text-[#052b57] disabled:opacity-50"
                disabled={busy}
                onClick={() => void loadExecution()}
                type="button"
              >
                {en ? "Load running process" : "진행 중 프로세스 불러오기"}
              </button>
            </section>
          )}
          {!isWithdrawalRequest && (
            <form
              className="krds-component rounded-xl border bg-white"
              onSubmit={start}
            >
              <h2 className="gov-text-heading-sm font-black text-[#052b57]">
                {en ? "Process context" : "프로세스 실행 문맥"}
              </h2>
              <div className="mt-4 space-y-3">
                <label className="gov-text-label font-bold">
                  Tenant
                  <input
                    className={`${inputClass} mt-2`}
                    value={tenantId}
                    onChange={(event) => setTenantId(event.target.value)}
                    required
                  />
                </label>
                <label className="gov-text-label font-bold">
                  {en ? "Project ID" : "프로젝트 ID"}
                  <input
                    className={`${inputClass} mt-2`}
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    required
                  />
                </label>
                <label className="gov-text-label font-bold">
                  {en ? "Execution ID" : "실행 ID"}
                  <input
                    className={`${inputClass} mt-2`}
                    value={executionId}
                    onChange={(event) => setExecutionId(event.target.value)}
                  />
                </label>
              </div>
              <button
                className="krds-control mt-4 w-full rounded-lg bg-[#052b57] font-black text-white disabled:opacity-50"
                disabled={busy}
                type="submit"
              >
                {en ? "Start process" : "프로세스 시작"}
              </button>
            </form>
          )}
          <section className="krds-component rounded-xl border bg-white">
            <h2 className="gov-text-heading-sm font-black text-[#052b57]">
              {isWithdrawalRequest
                ? en
                  ? "Submit withdrawal"
                  : "탈퇴 신청"
                : en
                  ? "Complete step"
                  : "단계 완료"}
            </h2>
            <p className="gov-text-body-sm mt-2 text-slate-600">
              {isWithdrawalRequest
                ? en
                  ? "Your request is sent to the privacy administrator for review."
                  : "신청 후 개인정보 담당자 검토 업무로 전달됩니다."
                : en
                  ? "Required fields and a saved draft are validated before transition."
                  : "필수 항목과 임시저장을 검증한 뒤 다음 상태로 전환합니다."}
            </p>
            <div className="mt-4 grid gap-2">
              {(actions.length
                ? actions
                : [{ code: commandCode, label: commandCode }]
              ).map((action) => (
                <button
                  className="krds-control rounded-lg bg-[#246beb] font-black text-white disabled:opacity-50"
                  data-command-code={action.code}
                  data-operation-method={text(action.apiMethod)}
                  data-operation-path={text(action.apiPath)}
                  disabled={busy || (!liveSmokeMode && draftStatus !== "DRAFT")}
                  key={action.code}
                  onClick={() => void execute(action.code)}
                  type="button"
                >
                  {en
                    ? action.label
                    : isWithdrawalRequest
                      ? action.label
                      : `${action.label} 완료`}
                </button>
              ))}
            </div>
            {isWithdrawalRequest && (
              <a
                className="krds-control mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white font-black text-slate-700"
                href="/mypage/profile"
              >
                {en ? "Cancel" : "취소"}
              </a>
            )}
          </section>
          {!isWithdrawalRequest && Object.keys(support).length > 0 && (
            <ExecutableScreenSupportCards
              actorCode={screen.actorCode}
              audience={screen.audience}
              className="space-y-5"
              contractHash={
                text(record(spec.runtimeContract).contractHash) ||
                screen.designHash ||
                "static"
              }
              en={en}
              processCode={screen.processCode}
              projectId={projectId}
              source={
                text(record(spec.runtimeContract).source) ===
                "DB_VERSIONED_CONTRACT"
                  ? "DB_VERSIONED_CONTRACT"
                  : undefined
              }
              stepCode={screen.stepCode}
              support={support}
              tenantId={tenantId}
              versionId={Number(record(spec.runtimeContract).versionId || 0)}
            />
          )}
          {!isWithdrawalRequest && (
            <section className="krds-component rounded-xl border bg-white">
              <h2 className="gov-text-heading-sm font-black text-[#052b57]">
                {en ? "Required states and tests" : "필수 상태·테스트"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...states, ...scenarios].map((item) => (
                  <span
                    className="gov-text-label rounded-full bg-slate-100 px-3 py-2 font-bold text-slate-700"
                    key={item}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )}
          {!isWithdrawalRequest && (
            <section className="krds-component rounded-xl border bg-white">
              <h2 className="gov-text-heading-sm font-black text-[#052b57]">
                {en ? "Contract validation" : "계약 자동 검증"}
              </h2>
              {materialized.issues.length ? (
                <ul className="mt-3 space-y-2">
                  {materialized.issues.map((issue) => (
                    <li
                      className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
                      key={issue.code}
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                  {en
                    ? "Screen, data, policy and test contracts are connected."
                    : "화면·데이터·권한·테스트 계약이 모두 연결되었습니다."}
                </p>
              )}
            </section>
          )}
          {nextTask && (
            <section className="krds-component rounded-xl border border-emerald-300 bg-emerald-50">
              <h2 className="gov-text-heading-sm font-black text-emerald-900">
                {en ? "Next task" : "다음 업무"}
              </h2>
              <p className="gov-text-body-sm mt-2 text-emerald-900">
                {nextTask.stepCode} · {nextTask.actorCode}
              </p>
              {nextTask.path && (
                <a
                  className="krds-control mt-4 inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 font-black text-white"
                  href={`${nextTask.path}${nextTask.path.includes("?") ? "&" : "?"}projectId=${encodeURIComponent(projectId)}`}
                >
                  {en ? "Open next task" : "다음 업무 화면 열기"}
                </a>
              )}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

function parseGeneratedRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "string")
    return (value || {}) as Record<string, unknown>;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toGeneratedScreen(
  row: Record<string, unknown>,
): GeneratedScreenDefinition {
  const specification = parseGeneratedRecord(row.specificationJson);
  const traceability = parseGeneratedRecord(row.traceabilityJson);
  const coordinate = resolveScreenCoordinate({
    pageId: String(row.pageId),
    processCode: String(row.processCode),
    stepCode: String(row.stepCode),
    actorCode: String(row.actorCode),
    screenType: String(row.screenType),
    templateCode: String(row.templateCode),
    specification,
    traceability,
  });
  return {
    id: String(row.pageId || row.blueprintCode).toLowerCase(),
    blueprintCode: String(row.blueprintCode),
    processCode: String(row.processCode),
    stepCode: String(row.stepCode),
    actorCode: String(row.actorCode),
    audience: String(row.audience) === "ADMIN" ? "ADMIN" : "USER",
    pageId: String(row.pageId),
    pageName: String(row.pageName),
    routePath: String(row.routePath),
    screenType: String(row.screenType),
    templateCode: String(row.templateCode),
    screenCoordinate: coordinate,
    screenCoordinateKey: Object.values(coordinate)
      .map((value) => encodeURIComponent(value))
      .join("::"),
    specification,
    traceability,
    designHash: String(row.designHash || ""),
    support: record(
      specification.support,
    ) as GeneratedScreenDefinition["support"],
    designCompleteness: {
      score: Number(row.designScore || 0),
      complete: Boolean(row.designComplete),
      checks: {},
    },
  } as GeneratedScreenDefinition;
}

type VersionedContractEnvelope = {
  contract?: Record<string, unknown>;
  source?: string;
  versionId?: number;
  versionNo?: number;
  contractHash?: string;
  screenKey?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function contractArray(
  value: unknown,
  nestedKey?: string,
): Array<Record<string, unknown>> {
  const candidate = nestedKey ? record(value)[nestedKey] : value;
  return Array.isArray(candidate)
    ? (candidate.filter((item) => item && typeof item === "object") as Array<
        Record<string, unknown>
      >)
    : [];
}

function applyVersionedContract(
  base: GeneratedScreenDefinition,
  envelope: VersionedContractEnvelope,
): GeneratedScreenDefinition {
  const contract = record(envelope.contract);
  const screenLayer = record(contract.screen);
  const dataLayer = record(contract.data);
  const uiLayer = record(contract.ui);
  const actionLayer = record(contract.action);
  const processLayer = record(contract.process);
  const permissionLayer = record(contract.permission);
  const operationLayer = record(contract.operations);
  const supportLayer = record(contract.support);
  const rawFields = contractArray(dataLayer.fields, "fields").length
    ? contractArray(dataLayer.fields, "fields")
    : contractArray(dataLayer.fields);
  const rawSections = contractArray(uiLayer.sections, "sections").length
    ? contractArray(uiLayer.sections, "sections")
    : contractArray(uiLayer.sections);
  const rawCommands = contractArray(actionLayer.commands, "commands").length
    ? contractArray(actionLayer.commands, "commands")
    : contractArray(actionLayer.commands);
  const rawApis = contractArray(actionLayer.apis, "apis").length
    ? contractArray(actionLayer.apis, "apis")
    : contractArray(actionLayer.apis);
  const apiByCommand = new Map(
    rawApis.map((api) => [String(api.commandCode || ""), api]),
  );
  const fields = rawFields.map((field, index) => ({
    code: String(field.fieldCode || field.code || `FIELD_${index + 1}`),
    label: String(
      field.fieldName ||
        field.label ||
        field.name ||
        field.fieldCode ||
        field.code ||
        `Field ${index + 1}`,
    ),
    dataType: String(field.dataType || "STRING"),
    control: String(field.controlType || field.control || "TEXT"),
    required: field.required === true,
    validation: record(field.validation),
    group: String(field.fieldGroup || field.group || "WORK"),
  }));
  const sections = rawSections.map((section, index) => ({
    code: String(section.sectionCode || section.code || `SECTION_${index + 1}`),
    label: String(
      section.sectionName ||
        section.label ||
        section.name ||
        section.sectionCode ||
        section.code ||
        `Section ${index + 1}`,
    ),
  }));
  const commands = rawCommands.map((command, index) => {
    const code = String(
      command.commandCode || command.code || `COMMAND_${index + 1}`,
    );
    const api = apiByCommand.get(code);
    return {
      code,
      label: String(
        command.commandName ||
          command.label ||
          command.name ||
          command.commandCode ||
          command.code ||
          `Command ${index + 1}`,
      ),
      requestFields: Array.isArray(api?.requestFields)
        ? api.requestFields.map(String)
        : undefined,
      apiMethod: String(api?.method || ""),
      apiPath: String(api?.path || ""),
    };
  });
  const specification = {
    ...base.specification,
    businessPurpose: String(
      screenLayer.purpose ||
        screenLayer.description ||
        base.specification.businessPurpose ||
        "",
    ),
    entryCondition: String(
      processLayer.entryCondition || base.specification.entryCondition || "",
    ),
    exitCondition: String(
      processLayer.exitCondition || base.specification.exitCondition || "",
    ),
    states: Array.isArray(processLayer.states)
      ? processLayer.states
      : base.specification.states,
    fields: fields.length ? fields : base.specification.fields,
    sections: sections.length ? sections : base.specification.sections,
    actions: commands.length ? commands : base.specification.actions,
    commandCode: commands[0]?.code || base.specification.commandCode,
    support: Object.keys(supportLayer).length
      ? supportLayer
      : base.specification.support,
    runtimeContract: {
      source: envelope.source,
      screenKey: envelope.screenKey,
      versionId: envelope.versionId,
      versionNo: envelope.versionNo,
      contractHash: envelope.contractHash,
      updatedAt: operationLayer.updatedAt,
    },
  };
  return {
    ...base,
    pageName: String(screenLayer.name || base.pageName),
    routePath: String(screenLayer.route || base.routePath),
    processCode: String(processLayer.processCode || base.processCode),
    stepCode: String(processLayer.stepCode || base.stepCode),
    actorCode: String(permissionLayer.actorCode || base.actorCode),
    audience:
      String(
        screenLayer.audience || permissionLayer.audience || base.audience,
      ) === "ADMIN"
        ? "ADMIN"
        : "USER",
    specification,
    designHash: String(supportLayer.designHash || base.designHash || ""),
    support: (Object.keys(supportLayer).length
      ? supportLayer
      : base.support) as GeneratedScreenDefinition["support"],
  } as GeneratedScreenDefinition;
}

function requestedScreenCoordinate(base: GeneratedScreenDefinition) {
  const params = new URLSearchParams(window.location.search);
  return {
    processCode: (params.get("processCode") || base.processCode)
      .trim()
      .toUpperCase(),
    stepCode: (params.get("step") || params.get("stepCode") || base.stepCode)
      .trim()
      .toUpperCase(),
    audience: (
      params.get("audience") ||
      (window.location.pathname.startsWith("/admin/") ? "ADMIN" : base.audience)
    )
      .trim()
      .toUpperCase(),
  };
}

async function loadVersionedContract(
  base: GeneratedScreenDefinition,
): Promise<GeneratedScreenDefinition> {
  const coordinate = requestedScreenCoordinate(base);
  const query = new URLSearchParams({
    routePath: contractLookupPath(),
    processCode: coordinate.processCode,
    stepCode: coordinate.stepCode,
    audience: coordinate.audience,
  });
  const response = await fetch(`/runtime/screens/resolve?${query}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`VERSIONED_CONTRACT_${response.status}`);
  const envelope = (await response.json()) as VersionedContractEnvelope;
  if (envelope.source !== "DB_VERSIONED_CONTRACT")
    throw new Error("VERSIONED_CONTRACT_SOURCE");
  return applyVersionedContract(base, envelope);
}

export function GeneratedScreenPage() {
  const en = isEnglish();
  const runtimeQuery = new URLSearchParams(location.search);
  const lookupPath = contractLookupPath();
  const fallbackProcess = (
    runtimeQuery.get("process") ||
    runtimeQuery.get("processCode") ||
    ""
  )
    .trim()
    .toUpperCase();
  const fallbackStep = (
    runtimeQuery.get("step") ||
    runtimeQuery.get("stepCode") ||
    ""
  )
    .trim()
    .toUpperCase();
  const fallbackStepNames: Record<string, string> = {
    DATA_INTEGRATION_01_PLAN: "연계 계획·계약 확정",
    DATA_INTEGRATION_02_WORK: "수집 실행·원본 보존",
    DATA_INTEGRATION_03_VERIFY: "품질 검증·보완",
    DATA_INTEGRATION_04_APPROVE: "승인·운영 적용",
    MONITORING_SCOPE: "분석 범위 선택",
    MONITORING_REVIEW: "지표·품질·이상치 분석",
    MONITORING_EXPORT: "분석 결과 내보내기",
    MONITORING_SHARE: "이해관계자 공유",
    SSR_DEFINE: "지표·주기·기준시점 확정",
    SSR_GENERATE: "통계 생성·품질검증·재생성",
    SSR_PUBLISH: "확정·시각화·파일·기관 전송",
  };
  const qaRecording = runtimeQuery.get("qaRecording") === "1";
  const actorCode = (runtimeQuery.get("actorCode") || "SYSTEM_INTEGRATOR")
    .trim()
    .toUpperCase();
  const routeAudience = location.pathname.startsWith("/admin/")
    ? "ADMIN"
    : "USER";
  const generatedRoute = location.pathname.startsWith("/generated/");
  const staticScreen = useMemo<GeneratedScreenDefinition | undefined>(() => {
    const catalogScreen = findGeneratedScreen(lookupPath) as
      GeneratedScreenDefinition | undefined;
    if (catalogScreen) return catalogScreen;
    if (!(qaRecording || generatedRoute) || !fallbackProcess || !fallbackStep)
      return undefined;
    return toGeneratedScreen({
      pageId: `${fallbackProcess}_${fallbackStep}_${routeAudience}`,
      blueprintCode: `BP_${fallbackProcess}_${fallbackStep}`,
      processCode: fallbackProcess,
      stepCode: fallbackStep,
      actorCode,
      audience: routeAudience,
      pageName:
        fallbackStepNames[fallbackStep] ||
        fallbackStep.split("_").filter(Boolean).join(" "),
      routePath: lookupPath,
      screenType: "FORM",
      templateCode: "KRDS_CONTENT",
      specificationJson: JSON.stringify({
        businessPurpose: "업무 계약을 불러오는 중입니다.",
        fields: [],
        sections: [],
        actions: [],
      }),
      traceabilityJson: "{}",
      designScore: 0,
      designComplete: false,
    });
  }, [
    actorCode,
    fallbackProcess,
    fallbackStep,
    generatedRoute,
    lookupPath,
    qaRecording,
    routeAudience,
  ]);
  const [screen, setScreen] = useState<GeneratedScreenDefinition | undefined>(
      staticScreen,
    ),
    [loading, setLoading] = useState(!staticScreen),
    [runtimeWarning, setRuntimeWarning] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(!staticScreen);
    const basePromise = staticScreen
      ? Promise.resolve(staticScreen)
      : fetch(
          `${en ? "/en" : ""}/home/api/process-executions/screen-contract?routePath=${encodeURIComponent(contractLookupPath())}`,
          { credentials: "include" },
        ).then(async (response) => {
          const row = (await response.json()) as Record<string, unknown>;
          return response.ok && row.enabled
            ? toGeneratedScreen(row)
            : undefined;
        });
    basePromise
      .then(async (base) => {
        if (!base || cancelled) return;
        try {
          const resolved = await loadVersionedContract(base);
          if (!cancelled) {
            setScreen(resolved);
            setRuntimeWarning("");
          }
        } catch {
          if (!cancelled) {
            setScreen(base);
            setRuntimeWarning(
              location.pathname.startsWith("/generated/")
                ? ""
                : en
                  ? "[FALLBACK_STALE] The latest screen contract could not be loaded. A potentially stale generated design is displayed."
                  : "[FALLBACK_STALE] 최신 화면 계약을 불러오지 못해 이전 자동 생성 설계를 표시합니다.",
            );
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [en, staticScreen]);
  if (loading)
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <p className="gov-text-body font-bold">
          {en
            ? "Loading the latest design..."
            : "최신 화면 설계를 불러오는 중입니다."}
        </p>
      </main>
    );
  if (!screen)
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <h1 className="gov-text-heading-lg font-black">
          {en
            ? "Screen contract not found"
            : "화면 설계 계약을 찾을 수 없습니다."}
        </h1>
      </main>
    );
  const runtimeKey = `${screen.processCode}:${screen.stepCode}:${screen.audience}`;
  const withdrawalAdmin =
    screen.processCode === "ACCOUNT_WITHDRAWAL" &&
    screen.stepCode === "ACCOUNT_WITHDRAWAL_S3" &&
    screen.audience === "ADMIN";
  if (screen.audience === "ADMIN")
    return (
      <AdminPageShell
        breadcrumbs={[
          {
            label: withdrawalAdmin
              ? en
                ? "Member management"
                : "회원 관리"
              : en
                ? "System"
                : "시스템 관리",
            href: en ? "/en/admin" : "/admin",
          },
          {
            label: withdrawalAdmin
              ? en
                ? "Withdrawal requests"
                : "회원 탈퇴 검토·처리"
              : en
                ? "Generated screen"
                : "자동 생성 화면",
          },
        ]}
        subtitle={
          withdrawalAdmin
            ? en
              ? "Review withdrawal requests and process them according to status and assigned authority."
              : "회원 탈퇴 신청을 상세 검토하고 상태와 담당 권한에 따라 처리합니다."
            : undefined
        }
        title={
          withdrawalAdmin
            ? en
              ? "Withdrawal request management"
              : "회원 탈퇴 신청 관리"
            : screen.pageName
        }
      >
        <GeneratedContent
          key={runtimeKey}
          runtimeWarning={runtimeWarning}
          screen={screen}
        />
      </AdminPageShell>
    );
  return (
    <GeneratedContent
      key={runtimeKey}
      runtimeWarning={runtimeWarning}
      screen={screen}
    />
  );
}
