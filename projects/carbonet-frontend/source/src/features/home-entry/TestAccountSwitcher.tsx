import { useEffect, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

const TEST_MODE_KEY = "carbonet:test-account-switcher";
const ACCOUNTS = [
  { id: "qaowner26", actor: "기업 관리자", steps: "1·6·7단계" },
  { id: "qadata26", actor: "사업장 자료 담당자", steps: "2단계" },
  { id: "qacalc26", actor: "산정 담당자", steps: "3단계" },
  { id: "qaverify26", actor: "검증 담당자", steps: "4단계" },
  { id: "qaapprove26", actor: "승인권자", steps: "5단계" },
  { id: "qaassign26", actor: "업무 배정 관리자", steps: "프로젝트 배정·재배정" },
] as const;

type LoginResponse = { status?: string; errors?: string };

async function switchAccount(userId: string) {
  const response = await fetch(buildLocalizedPath("/signin/testAccountSwitch", "/en/signin/testAccountSwitch"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Carbonet-Test-Mode": "1" },
    body: JSON.stringify({ userId }),
  });
  const body = await response.json() as LoginResponse;
  return { ok: response.ok && body.status !== "loginFailure", body };
}

export function TestAccountSwitcher() {
  const en = isEnglish();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(ACCOUNTS[0].id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("testMode") === "1";
    const developmentHost = location.hostname === "172.16.1.232"
      || location.hostname === "localhost"
      || location.hostname === "127.0.0.1"
      || location.hostname.endsWith(".172.16.1.232.nip.io");
    if (requested || developmentHost) sessionStorage.setItem(TEST_MODE_KEY, "enabled");
    setEnabled(requested || developmentHost || sessionStorage.getItem(TEST_MODE_KEY) === "enabled");
  }, []);

  if (!enabled) return null;
  const selected = ACCOUNTS.find(item => item.id === accountId) || ACCOUNTS[0];

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const result = await switchAccount(accountId);
      if (!result.ok) throw new Error(result.body.errors || (en ? "Login failed." : "로그인에 실패했습니다."));
      location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <aside className="fixed right-3 top-1/2 z-[1050] w-[calc(100vw-1.5rem)] max-w-[22rem] -translate-y-1/2 rounded-2xl border border-blue-200 bg-white shadow-2xl sm:right-5 lg:right-8" data-testid="test-account-switcher">
    <button className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left" onClick={() => setOpen(value => !value)} type="button">
      <span><b className="block text-sm text-[#052b57]">{en ? "Test account switcher" : "테스트 계정 전환"}</b><small className="text-slate-500">{selected.actor} · {selected.id}</small></span>
      <span aria-hidden="true" className="material-symbols-outlined">{open ? "expand_more" : "manage_accounts"}</span>
    </button>
    {open ? <div className="border-t border-slate-200 p-4">
      <label className="block text-sm font-bold">{en ? "Account and actor" : "계정·액터"}
        <select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3" onChange={event => setAccountId(event.target.value as typeof accountId)} value={accountId}>
          {ACCOUNTS.map(item => <option key={item.id} value={item.id}>{item.actor} · {item.id} · {item.steps}</option>)}
        </select>
      </label>
      <p className="mt-3 text-xs leading-5 text-slate-500">{en ? "Only an administrator-authorized test session can switch among the six allowlisted accounts." : "관리자가 승인한 테스트 세션에서만 허용된 6개 계정으로 전환할 수 있습니다."}</p>
      {message ? <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700" role="alert">{message}</p> : null}
      <button className="mt-3 min-h-11 w-full rounded-lg bg-[#246beb] px-4 font-black text-white disabled:opacity-50" disabled={busy} onClick={() => void submit()} type="button">{busy ? (en ? "Switching..." : "전환 중...") : (en ? "Switch and reload" : "계정 전환·새로고침")}</button>
    </div> : null}
  </aside>;
}
