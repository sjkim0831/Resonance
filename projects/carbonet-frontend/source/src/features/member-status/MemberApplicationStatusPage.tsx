import { FormEvent, useEffect, useState } from "react";
import { CommonJoinProcessShell } from "../../components/common-design/CommonJoinProcessShell";
import { StandardUserFooter } from "../../components/user-shell/StandardUserFooter";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type StatusResult = {
  memberId?: string;
  memberName?: string;
  organization?: string;
  submittedAt?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  rejectionReason?: string;
};

async function lookupMemberStatus(payload: Record<string, string>) {
  const response = await fetch("/join/api/member-status/detail", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) throw new Error(body?.message || "조회에 실패했습니다.");
  return body as { lookupHandle: string; result: StatusResult };
}

async function lookupDevelopmentMemberStatus(memberId: string) {
  const response = await fetch("/signin/actionLogin", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ userId: memberId, userPw: "", userSe: "STATUS" })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) throw new Error(body?.message || "조회에 실패했습니다.");
  return body as { result: StatusResult };
}

const LABELS: Record<string, { ko: string; en: string; tone: string }> = {
  PENDING: { ko: "승인 대기", en: "Pending approval", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  APPROVED: { ko: "승인 완료", en: "Approved", tone: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  REJECTED: { ko: "반려", en: "Rejected", tone: "border-red-300 bg-red-50 text-red-900" },
  WITHDRAWN: { ko: "탈퇴·취소", en: "Withdrawn", tone: "border-gray-300 bg-gray-50 text-gray-800" }
};

function displayDate(value?: string, english?: boolean) {
  if (!value) return "-";
  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return value.replace(/\.\d+$/, "");
  return new Intl.DateTimeFormat(english ? "en-US" : "ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(parsed);
}

export function MemberApplicationStatusPage() {
  const en = isEnglish();
  const detail = window.location.pathname.includes("memberStatusDetail");
  const [memberId, setMemberId] = useState(() => new URLSearchParams(window.location.search).get("memberId") || "");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<StatusResult | null>(null);
  const [loading, setLoading] = useState(detail);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!detail) return;
    const params = new URLSearchParams(window.location.search);
    const handle = params.get("lookupHandle") || "";
    const openMemberId = params.get("memberId") || "";
    if (params.get("devOpen") === "1" && openMemberId) {
      lookupDevelopmentMemberStatus(openMemberId)
        .then((body) => setResult(body.result))
        .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)))
        .finally(() => setLoading(false));
      return;
    }
    if (!handle) {
      setError(en ? "Please search again." : "조회 정보를 다시 입력해 주세요.");
      setLoading(false);
      return;
    }
    lookupMemberStatus({ lookupHandle: handle })
      .then((body) => setResult(body.result))
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)))
      .finally(() => setLoading(false));
  }, [detail, en]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = await lookupMemberStatus({ memberId: memberId.trim(), email: email.trim() });
      navigate(`${buildLocalizedPath("/join/memberStatusDetail", "/join/en/memberStatusDetail")}?lookupHandle=${encodeURIComponent(body.lookupHandle)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  const meta = LABELS[result?.status || "PENDING"] || LABELS.PENDING;
  return (
    <CommonJoinProcessShell screenId={detail ? "JOIN_MEMBER_STATUS_DETAIL" : "JOIN_MEMBER_STATUS_SEARCH"}>
      <div className="border-b border-[var(--kr-gov-border-light)] bg-gray-50">
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-2 px-4 lg:px-8">
          <img alt="" className="h-4" src="/img/egovframework/kr_gov_symbol.png" />
          <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}</span>
        </div>
      </div>
      <header className="sticky top-0 z-50 border-b border-[var(--kr-gov-border-light)] bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
          <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))} type="button">
            <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]">eco</span>
            <span className="min-w-0"><strong className="block truncate text-lg">{en ? "CCUS Carbon Footprint Platform" : "CCUS 탄소발자국 플랫폼"}</strong><small className="hidden uppercase tracking-wider text-gray-500 sm:block">Carbon Footprint Platform</small></span>
          </button>
          <div className="overflow-hidden rounded border border-gray-300 text-xs font-black"><a className={`inline-block px-3 py-2 ${!en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-gray-700"}`} href="/join/memberStatusSearch">KO</a><a className={`inline-block border-l border-gray-300 px-3 py-2 ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-gray-700"}`} href="/join/en/memberStatusSearch">EN</a></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-grow px-4 py-12" id="main-content">
        <header className="mb-10 text-center">
          <p className="mb-2 text-sm font-black tracking-[0.18em] text-[var(--kr-gov-blue)]">{en ? "MEMBERSHIP" : "회원가입"}</p>
          <h1 className="text-3xl font-black text-[var(--kr-gov-text-primary)]">{en ? "Application status" : "가입 신청 현황 확인"}</h1>
          <p className="mt-3 text-[var(--kr-gov-text-secondary)]">{en ? "Verify the ID and email used for your application." : "가입 신청 시 등록한 아이디와 이메일로 처리 현황을 확인합니다."}</p>
        </header>

        {error ? <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 font-bold text-red-800" role="alert">{error}</div> : null}

        {!detail ? (
          <section className="rounded-xl border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm sm:p-10" data-help-id="join-member-status-search">
            <form className="space-y-6" onSubmit={submit}>
              <label className="block font-bold text-[var(--kr-gov-text-primary)]">
                {en ? "User ID" : "아이디"}
                <input autoComplete="username" className="mt-2 h-14 w-full rounded-lg border border-gray-300 px-4 font-medium focus:border-[var(--kr-gov-blue)] focus:outline-none focus:ring-2 focus:ring-blue-100" maxLength={50} onChange={(event) => setMemberId(event.target.value)} required value={memberId} />
              </label>
              <label className="block font-bold text-[var(--kr-gov-text-primary)]">
                {en ? "Registered email" : "가입 시 등록한 이메일"}
                <input autoComplete="email" className="mt-2 h-14 w-full rounded-lg border border-gray-300 px-4 font-medium focus:border-[var(--kr-gov-blue)] focus:outline-none focus:ring-2 focus:ring-blue-100" maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              </label>
              <p className="rounded-lg bg-gray-50 p-4 text-sm leading-6 text-gray-600">{en ? "For privacy, the same message is shown when either value is incorrect." : "개인정보 보호를 위해 아이디 또는 이메일이 일치하지 않는 경우 동일한 안내가 표시됩니다."}</p>
              <button className="h-14 w-full rounded-lg bg-[var(--kr-gov-blue)] text-lg font-black text-white hover:bg-[var(--kr-gov-blue-hover)] disabled:opacity-50" disabled={loading} type="submit">{loading ? (en ? "Checking…" : "조회 중…") : (en ? "Check status" : "현황 확인")}</button>
            </form>
          </section>
        ) : (
          <section className="space-y-6" data-help-id="join-member-status-detail">
            {loading ? <div className="rounded-xl border bg-white p-10 text-center font-bold">{en ? "Loading…" : "현황을 불러오는 중입니다…"}</div> : null}
            {result ? (
              <>
                <div className={`rounded-xl border-2 p-6 sm:p-8 ${meta.tone}`}>
                  <p className="text-sm font-black">{en ? "CURRENT STATUS" : "현재 처리 상태"}</p>
                  <h2 className="mt-2 text-3xl font-black">{en ? meta.en : meta.ko}</h2>
                  <p className="mt-3 font-medium">{result.status === "APPROVED" ? (en ? "You can now log in." : "승인이 완료되어 로그인할 수 있습니다.") : result.status === "REJECTED" ? (en ? "Review the reason below and contact support." : "아래 반려 사유를 확인한 뒤 담당자에게 문의해 주세요.") : (en ? "An administrator is reviewing your application." : "관리자가 가입 신청을 검토하고 있습니다.")}</p>
                </div>
                <dl className="grid gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:grid-cols-2">
                  {[
                    [en ? "User ID" : "아이디", result.memberId],
                    [en ? "Name" : "이름", result.memberName],
                    [en ? "Organization" : "소속 기관", result.organization],
                    [en ? "Submitted at" : "신청 일시", displayDate(result.submittedAt, en)]
                  ].map(([label, value]) => <div className="border-b border-gray-100 p-5 sm:odd:border-r" key={label}><dt className="text-sm font-bold text-gray-500">{label}</dt><dd className="mt-2 break-all font-bold text-gray-900">{value || "-"}</dd></div>)}
                </dl>
                {result.status === "REJECTED" ? <div className="rounded-xl border border-red-200 bg-white p-6"><h3 className="font-black text-red-800">{en ? "Rejection reason" : "반려 사유"}</h3><p className="mt-3 whitespace-pre-wrap text-gray-800">{result.rejectionReason || (en ? "Contact the administrator for details." : "상세 사유는 담당자에게 문의해 주세요.")}</p></div> : null}
              </>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <button className="h-14 rounded-lg border border-[var(--kr-gov-blue)] bg-white font-black text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/join/memberStatusSearch", "/join/en/memberStatusSearch"))} type="button">{en ? "Search again" : "다시 조회"}</button>
              <button className="h-14 rounded-lg bg-[var(--kr-gov-blue)] font-black text-white" onClick={() => navigate(buildLocalizedPath("/signin/loginView", "/en/signin/loginView"))} type="button">{en ? "Go to login" : "로그인으로 이동"}</button>
            </div>
          </section>
        )}
      </main>
      <StandardUserFooter english={en} />
    </CommonJoinProcessShell>
  );
}
