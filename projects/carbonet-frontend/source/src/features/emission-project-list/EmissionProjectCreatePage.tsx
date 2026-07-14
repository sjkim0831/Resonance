import { FormEvent, useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import {
  buildLocalizedPath,
  isEnglish,
  navigate,
} from "../../lib/navigation/runtime";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HomeInlineStyles,
} from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";

type Options = { sites: string[]; owners: string[]; accounts: { id: string; actors: string }[]; currentUser: string };
const year = new Date().getFullYear();
const EMPTY = {
  name: "",
  site: "",
  owner: "",
  dataOwner: "",
  calculator: "",
  verifier: "",
  approver: "",
  reportingYear: String(year),
  periodStart: `${year}-01-01`,
  periodEnd: `${year}-12-31`,
  dueDate: `${year}-12-31`,
  scopes: ["Scope 1", "Scope 2"],
};

export function EmissionProjectCreatePage() {
  const en = isEnglish(),
    content = LOCALIZED_CONTENT[en ? "en" : "ko"],
    homeState = useAsyncValue(() => fetchHomePayload(), [en]);
  const [form, setForm] = useState(EMPTY),
    [options, setOptions] = useState<Options>({ sites: [], owners: [], accounts: [], currentUser: "" }),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [nameState, setNameState] = useState<"" | "ok" | "duplicate">("");
  const api = (path: string) =>
    buildLocalizedPath(
      `/home/api/emission-projects${path}`,
      `/en/home/api/emission-projects${path}`,
    );
  useEffect(() => {
    fetch(api("/options"), { credentials: "include" })
      .then((r) => r.json())
      .then((value:Options)=>{setOptions(value);setForm(current=>({...current,owner:current.owner||value.currentUser}))})
      .catch(() => setOptions({ sites: [], owners: [], accounts: [], currentUser: "" }));
  }, []);

  async function checkName() {
    if (!form.name.trim()) return setNameState("");
    const r = await fetch(
      `${api("/name-availability")}?name=${encodeURIComponent(form.name)}`,
      { credentials: "include" },
    );
    const body = await r.json();
    setNameState(body.available ? "ok" : "duplicate");
  }
  function scope(value: string) {
    setForm((current) => ({
      ...current,
      scopes: current.scopes.includes(value)
        ? current.scopes.filter((item) => item !== value)
        : [...current.scopes, value],
    }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (nameState === "duplicate")
      return setMessage(
        en
          ? "This project name is already in use."
          : "이미 사용 중인 프로젝트명입니다.",
      );
    if (
      !form.name ||
      !form.site ||
      !form.owner ||
      !form.dataOwner ||
      !form.calculator ||
      !form.verifier ||
      !form.approver ||
      !form.periodStart ||
      !form.periodEnd ||
      !form.dueDate ||
      !form.scopes.length
    )
      return setMessage(
        en
          ? "Complete all required fields."
          : "필수 항목을 모두 입력해 주세요.",
      );
    if (form.periodEnd < form.periodStart)
      return setMessage(
        en
          ? "The end date must be after the start date."
          : "산정 종료일은 시작일보다 빠를 수 없습니다.",
      );
    setSaving(true);
    try {
      const response = await fetch(api(""), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "저장하지 못했습니다.");
      navigate(
        buildLocalizedPath(
          `/emission/project/detail?id=${body.id}`,
          `/en/emission/project/detail?id=${body.id}`,
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }
  const input =
    "mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100";
  return (
    <>
      <HomeInlineStyles en={en} />
      <div className="min-h-screen bg-[#f6f8fb] text-[var(--kr-gov-text-primary)]">
        <header className="border-b-2 border-[#001e40] bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 lg:px-8">
            <HeaderBrand content={content} en={en} />
            <HeaderDesktopNav
              en={en}
              homeMenu={homeState.value?.homeMenu || []}
            />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
          <nav className="mb-5 text-sm text-slate-500">
            <a
              href={buildLocalizedPath(
                "/emission/project_list",
                "/en/emission/project_list",
              )}
            >
              {en ? "Emission projects" : "배출량 프로젝트"}
            </a>
            <span className="mx-2">/</span>
            <strong>{en ? "New project" : "새 프로젝트 등록"}</strong>
          </nav>
          <p className="text-sm font-bold text-[#246beb]">
            {en ? "Carbon Emission Management" : "탄소배출 관리"}
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#052b57]">
            {en ? "New Emission Project" : "새 배출량 프로젝트 등록"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {en
              ? "Set the project scope, owner, and working period."
              : "업무를 시작하는 데 필요한 범위, 담당자, 일정을 설정합니다."}
          </p>
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-[#052b57]">
                1. {en ? "Basic information" : "기본정보"}
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-bold sm:col-span-2">
                  {en ? "Project name" : "프로젝트명"}
                  <span className="ml-1 text-red-600">*</span>
                  <input
                    className={input}
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      setNameState("");
                    }}
                    onBlur={checkName}
                  />
                  {nameState && (
                    <span
                      className={`mt-1 block text-xs ${nameState === "ok" ? "text-blue-700" : "text-red-700"}`}
                    >
                      {nameState === "ok"
                        ? en
                          ? "Available name"
                          : "사용 가능한 이름입니다."
                        : en
                          ? "Name already exists"
                          : "이미 등록된 이름입니다."}
                    </span>
                  )}
                </label>
                <label className="text-sm font-bold">
                  {en ? "Site" : "사업장"}
                  <span className="ml-1 text-red-600">*</span>
                  <input
                    className={input}
                    list="project-sites"
                    value={form.site}
                    onChange={(e) => setForm({ ...form, site: e.target.value })}
                  />
                  <datalist id="project-sites">
                    {options.sites.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </label>
                <label className="text-sm font-bold">
                  {en ? "Reporting year" : "보고연도"}
                  <input
                    className={input}
                    min="2000"
                    max="2100"
                    type="number"
                    value={form.reportingYear}
                    onChange={(e) =>
                      setForm({ ...form, reportingYear: e.target.value })
                    }
                  />
                </label>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-[#052b57]">
                2. {en ? "Calculation scope" : "산정 범위"}
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="text-sm font-bold">
                    Scope<span className="ml-1 text-red-600">*</span>
                  </span>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {["Scope 1", "Scope 2", "Scope 3"].map((v) => (
                      <label
                        key={v}
                        className="flex min-h-12 min-w-32 items-center gap-2 rounded-lg border border-slate-300 px-4 font-bold"
                      >
                        <input
                          checked={form.scopes.includes(v)}
                          onChange={() => scope(v)}
                          type="checkbox"
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="text-sm font-bold">
                  {en ? "Start date" : "산정 시작일"}
                  <input
                    className={input}
                    type="date"
                    value={form.periodStart}
                    onChange={(e) =>
                      setForm({ ...form, periodStart: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-bold">
                  {en ? "End date" : "산정 종료일"}
                  <input
                    className={input}
                    type="date"
                    value={form.periodEnd}
                    onChange={(e) =>
                      setForm({ ...form, periodEnd: e.target.value })
                    }
                  />
                </label>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-[#052b57]">
                3. {en ? "Owner and schedule" : "담당자·일정"}
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  {en ? "Owner" : "담당자"}
                  <span className="ml-1 text-red-600">*</span>
                  <input
                    className={input}
                    list="project-owners"
                    value={form.owner}
                    onChange={(e) =>
                      setForm({ ...form, owner: e.target.value })
                    }
                  />
                  <datalist id="project-owners">
                    {options.owners.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </label>
                <label className="text-sm font-bold">
                  {en ? "Due date" : "마감일"}
                  <span className="ml-1 text-red-600">*</span>
                  <input
                    className={input}
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                  />
                </label>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-[#052b57]">4. {en ? "Actor assignment" : "업무 액터 배정"}</h2>
              <p className="mt-2 text-sm text-slate-600">{en ? "Assign the accountable user for each process step. Permissions and My Tasks are generated from these assignments." : "프로세스 단계별 책임 계정을 지정합니다. 이 배정을 기준으로 권한과 내 업무가 자동 생성됩니다."}</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {([
                  ["dataOwner", en ? "Site data owner" : "사업장 자료 담당자", en ? "Collects and submits source activity data" : "원천 활동자료 입력·제출"],
                  ["calculator", en ? "Emission calculator" : "배출량 산정 담당자", en ? "Maps factors and runs calculations" : "배출계수 매핑·배출량 산정"],
                  ["verifier", en ? "Verifier" : "검증 담당자", en ? "Verifies results and requests corrections" : "결과 검증·보완 요청"],
                  ["approver", en ? "Approver" : "승인 담당자", en ? "Approves the verified calculation" : "검증 완료 산정 결과 승인"],
                ] as const).map(([key,label,help])=><label className="text-sm font-bold" key={key}>{label}<span className="ml-1 text-red-600">*</span><input className={input} list="project-actor-accounts" value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/><small className="mt-1 block font-normal text-slate-500">{help}</small></label>)}
                <datalist id="project-actor-accounts">{options.accounts.map(account=><option key={account.id} value={account.id}>{account.actors}</option>)}{options.owners.map(value=><option key={value} value={value}/>)}</datalist>
              </div>
              {form.calculator&&form.verifier&&form.calculator===form.verifier?<p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">{en ? "The calculator and verifier are the same account. Separate them when segregation of duties is required." : "산정자와 검증자가 동일 계정입니다. 직무 분리가 필요한 프로젝트에서는 서로 다른 계정을 배정하세요."}</p>:null}
            </section>
            {message && (
              <p className="rounded-lg bg-red-50 p-4 text-sm font-bold text-red-700">
                {message}
              </p>
            )}
            <footer className="flex justify-end gap-3">
              <a
                className="inline-flex min-h-12 items-center rounded-lg border border-slate-300 bg-white px-6 font-bold"
                href={buildLocalizedPath(
                  "/emission/project_list",
                  "/en/emission/project_list",
                )}
              >
                {en ? "Cancel" : "취소"}
              </a>
              <button
                className="min-h-12 rounded-lg bg-[#246beb] px-7 font-black text-white disabled:opacity-50"
                disabled={saving}
                type="submit"
              >
                {saving
                  ? en
                    ? "Saving..."
                    : "저장 중..."
                  : en
                    ? "Create project"
                    : "프로젝트 등록"}
              </button>
            </footer>
          </form>
        </main>
      </div>
    </>
  );
}
