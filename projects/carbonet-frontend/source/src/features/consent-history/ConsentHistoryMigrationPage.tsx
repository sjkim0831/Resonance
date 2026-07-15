import { FormEvent, useEffect, useState } from "react";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { fetchJson } from "../../lib/api/core";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

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

const TYPE_LABELS: Record<string, string> = {
  TERMS: "서비스 이용약관",
  PRIVACY: "개인정보 수집·이용",
  GWP_CCUS: "GWP·CCUS 정보 제공",
  MARKETING: "마케팅 수신"
};

export function ConsentHistoryMigrationPage() {
  const en = isEnglish();
  const [keyword, setKeyword] = useState("");
  const [consentType, setConsentType] = useState("ALL");
  const [agreed, setAgreed] = useState("ALL");
  const [query, setQuery] = useState({ keyword: "", consentType: "ALL", agreed: "ALL" });
  const [payload, setPayload] = useState<ConsentPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(query);
    setLoading(true);
    setError("");
    fetchJson<ConsentPayload>(`/admin/system/consent-history/page-data?${params.toString()}`)
      .then(setPayload)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, [query]);

  function search(event: FormEvent) {
    event.preventDefault();
    setQuery({ keyword, consentType, agreed });
  }

  const summary = payload?.summary || {};
  const rows = payload?.rows || [];
  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Admin" : "관리자", href: buildLocalizedPath("/admin", "/en/admin") },
        { label: en ? "Members & Security" : "회원·보안" },
        { label: en ? "Consent History" : "약관·동의 이력" }
      ]}
      loading={loading && !payload}
      loadingLabel={en ? "Loading consent evidence..." : "동의 증적을 불러오는 중입니다."}
      subtitle={en ? "Review versioned consent evidence captured during registration." : "회원가입 과정에서 수집된 버전별 동의 증적을 조회합니다."}
      title={en ? "Terms and Consent History" : "약관·동의 이력 관리"}
    >
      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      <section className="mb-6 grid gap-4 md:grid-cols-4" data-help-id="consent-history-summary">
        {[
          [en ? "All evidence" : "전체 증적", summary.total || 0],
          [en ? "GWP agreed" : "GWP 동의", summary.gwp_agreed || 0],
          [en ? "Member-linked" : "회원 연결", summary.linked || 0],
          [en ? "Withdrawn" : "철회", summary.withdrawn || 0]
        ].map(([label, value]) => <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-white p-5" key={String(label)}><p className="text-sm text-[var(--kr-gov-text-secondary)]">{label}</p><strong className="mt-2 block text-2xl">{value}</strong></div>)}
      </section>
      <form className="mb-6 grid gap-3 rounded-lg border border-[var(--kr-gov-border-light)] bg-white p-5 md:grid-cols-[1fr_220px_180px_auto]" onSubmit={search}>
        <input aria-label={en ? "Search" : "검색어"} className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2" onChange={(event) => setKeyword(event.target.value)} placeholder={en ? "Member, session, or IP" : "회원 ID, 세션 또는 IP"} value={keyword} />
        <select aria-label={en ? "Consent type" : "동의 유형"} className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2" onChange={(event) => setConsentType(event.target.value)} value={consentType}><option value="ALL">{en ? "All types" : "전체 유형"}</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{en ? value : label}</option>)}</select>
        <select aria-label={en ? "Agreement status" : "동의 상태"} className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2" onChange={(event) => setAgreed(event.target.value)} value={agreed}><option value="ALL">{en ? "All statuses" : "전체 상태"}</option><option value="Y">{en ? "Agreed" : "동의"}</option><option value="N">{en ? "Not agreed" : "미동의"}</option></select>
        <button className="rounded bg-[var(--kr-gov-blue)] px-5 py-2 font-bold text-white" type="submit">{en ? "Search" : "조회"}</button>
      </form>
      <section className="overflow-hidden rounded-lg border border-[var(--kr-gov-border-light)] bg-white" data-help-id="consent-history-table">
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[var(--kr-gov-bg-gray)]"><tr>{[en ? "Member" : "회원", en ? "Type" : "동의 유형", en ? "Status" : "상태", en ? "Version" : "문안 버전", en ? "Agreed at" : "동의 일시", "IP", en ? "Evidence hash" : "증적 해시"].map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className="border-t border-[var(--kr-gov-border-light)]" key={row.consentId}><td className="px-4 py-3"><strong>{row.memberId || (en ? "Pending" : "가입 진행 중")}</strong><div className="max-w-40 truncate text-xs text-[var(--kr-gov-text-secondary)]" title={row.joinSessionId}>{row.joinSessionId}</div></td><td className="px-4 py-3">{en ? row.consentType : TYPE_LABELS[row.consentType] || row.consentType}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.agreed ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{row.agreed ? (en ? "Agreed" : "동의") : (en ? "Not agreed" : "미동의")}</span></td><td className="px-4 py-3">{row.termsVersion}</td><td className="px-4 py-3">{row.agreedAt ? new Date(row.agreedAt).toLocaleString() : "-"}</td><td className="px-4 py-3">{row.ipAddress || "-"}</td><td className="px-4 py-3 font-mono text-xs" title={row.termsHash}>{row.termsHash.slice(0, 14)}…</td></tr>)}</tbody></table></div>
        {!rows.length && !loading ? <p className="p-10 text-center text-[var(--kr-gov-text-secondary)]">{en ? "No consent evidence found." : "조회된 동의 증적이 없습니다."}</p> : null}
      </section>
    </AdminPageShell>
  );
}

