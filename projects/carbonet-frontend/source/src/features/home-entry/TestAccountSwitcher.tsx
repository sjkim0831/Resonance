import { FormEvent, useEffect, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

const TEST_MODE_KEY = "carbonet:test-account-switcher";
const ACCOUNTS = [
  { id: "qaowner26", actor: "기업 관리자", steps: "1·6·7단계" },
  { id: "qadata26", actor: "사업장 자료 담당자", steps: "2단계" },
  { id: "qacalc26", actor: "산정 담당자", steps: "3단계" },
  { id: "qaverify26", actor: "검증 담당자", steps: "4단계" },
  { id: "qaapprove26", actor: "승인권자", steps: "5단계" },
] as const;

type LoginResponse = { status?: string; errors?: string };

async function login(userId: string, userPw: string, userSe: "USR" | "ENT") {
  const response = await fetch(buildLocalizedPath("/signin/actionLogin", "/en/signin/actionLogin"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ userId, userPw, userSe, autoLogin: false }),
  });
  const body = await response.json() as LoginResponse;
  return { ok: response.ok && body.status !== "loginFailure", body };
}

export function TestAccountSwitcher() {
  const en = isEnglish();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(ACCOUNTS[0].id);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("testMode") === "1";
    if (requested) sessionStorage.setItem(TEST_MODE_KEY, "enabled");
    setEnabled(requested || sessionStorage.getItem(TEST_MODE_KEY) === "enabled");
  }, []);

  if (!enabled) return null;
  const selected = ACCOUNTS.find(item => item.id === accountId) || ACCOUNTS[0];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) return setMessage(en ? "Enter the test-account password." : "테스트 계정 비밀번호를 입력하세요.");
    setBusy(true);
    setMessage("");
    try {
      let result = await login(accountId, password, "USR");
      if (!result.ok) result = await login(accountId, password, "ENT");
      if (!result.ok) throw new Error(result.body.errors || (en ? "Login failed." : "로그인에 실패했습니다."));
      location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <aside className="fixed bottom-4 left-4 z-[1050] w-[calc(100vw-2rem)] max-w-[22rem] rounded-2xl border border-blue-200 bg-white shadow-2xl" data-testid="test-account-switcher">
    <button className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left" onClick={() => setOpen(value => !value)} type="button">
      <span><b className="block text-sm text-[#052b57]">{en ? "Test account switcher" : "테스트 계정 전환"}</b><small className="text-slate-500">{selected.actor} · {selected.id}</small></span>
      <span aria-hidden="true" className="material-symbols-outlined">{open ? "expand_more" : "manage_accounts"}</span>
    </button>
    {open ? <form className="border-t border-slate-200 p-4" onSubmit={submit}>
      <label className="block text-sm font-bold">{en ? "Account and actor" : "계정·액터"}
        <select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3" onChange={event => setAccountId(event.target.value as typeof accountId)} value={accountId}>
          {ACCOUNTS.map(item => <option key={item.id} value={item.id}>{item.actor} · {item.id} · {item.steps}</option>)}
        </select>
      </label>
      <label className="mt-3 block text-sm font-bold">{en ? "Test password" : "테스트 비밀번호"}
        <input autoComplete="current-password" className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3" onChange={event => setPassword(event.target.value)} type="password" value={password}/>
      </label>
      <p className="mt-2 text-xs leading-5 text-slate-500">{en ? "The password is sent only to the normal login API and is not stored." : "비밀번호는 일반 로그인 API로만 전송되며 저장하지 않습니다."}</p>
      {message ? <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700" role="alert">{message}</p> : null}
      <button className="mt-3 min-h-11 w-full rounded-lg bg-[#246beb] px-4 font-black text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? (en ? "Switching..." : "전환 중...") : (en ? "Switch and reload" : "계정 전환·새로고침")}</button>
    </form> : null}
  </aside>;
}
