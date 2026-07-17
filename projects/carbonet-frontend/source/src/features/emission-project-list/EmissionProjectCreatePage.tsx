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
  organizationBoundary: "OPERATIONAL_CONTROL",
  emissionStandard: "ISO_14064_1",
  methodologyVersion: "2018",
  verificationLevel: "LIMITED",
  collectionCycle: "MONTHLY",
  materialityThreshold: "5",
};

export function EmissionProjectCreatePage() {
  const en = isEnglish(),
    content = LOCALIZED_CONTENT[en ? "en" : "ko"],
    homeState = useAsyncValue(() => fetchHomePayload(), [en]);
  const [form, setForm] = useState(EMPTY),
    [options, setOptions] = useState<Options>({ sites: [], owners: [], accounts: [], currentUser: "" }),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [optionsLoading, setOptionsLoading] = useState(true),
    [optionsError, setOptionsError] = useState(""),
    [nameState, setNameState] = useState<"" | "ok" | "duplicate">("");
  const api = (path: string) =>
    buildLocalizedPath(
      `/home/api/emission-projects${path}`,
      `/en/home/api/emission-projects${path}`,
    );
  useEffect(() => {
    fetch(api("/options"), { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((value:Partial<Options>)=>{
        const normalized:Options={
          sites:Array.isArray(value.sites)?value.sites:[],
          owners:Array.isArray(value.owners)?value.owners:[],
          accounts:Array.isArray(value.accounts)?value.accounts:[],
          currentUser:typeof value.currentUser==="string"?value.currentUser:"",
        };
        setOptions(normalized);
        setForm(current=>({...current,owner:current.owner||normalized.currentUser}));
        setOptionsError("");
      })
      .catch(() => {
        setOptions({ sites: [], owners: [], accounts: [], currentUser: "" });
        setOptionsError(en ? "Reference data could not be loaded. You can still enter values directly." : "기준정보를 불러오지 못했습니다. 필요한 값은 직접 입력할 수 있습니다.");
      })
      .finally(()=>setOptionsLoading(false));
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
      !form.organizationBoundary ||
      !form.emissionStandard ||
      !form.methodologyVersion ||
      !form.verificationLevel ||
      !form.collectionCycle ||
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
    if (form.periodStart.slice(0, 4) !== form.reportingYear || form.periodEnd.slice(0, 4) !== form.reportingYear)
      return setMessage(en ? "The inventory period must be within the reporting year." : "산정기간은 보고연도 안에 있어야 합니다.");
    if (form.dueDate < form.periodEnd)
      return setMessage(en ? "The due date must be on or after the inventory period end date." : "마감일은 산정기간 종료일 이후여야 합니다.");
    const materiality = Number(form.materialityThreshold);
    if (!Number.isInteger(materiality) || materiality < 0 || materiality > 100)
      return setMessage(en ? "Materiality must be a whole percentage from 0 to 100." : "중요성 기준은 0~100 사이의 정수 비율이어야 합니다.");
    if (form.calculator === form.verifier || form.calculator === form.approver || form.verifier === form.approver)
      return setMessage(en ? "Calculator, verifier, and approver must be different accounts." : "산정자·검증자·승인자는 서로 다른 계정이어야 합니다.");
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
          {optionsLoading&&<p className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900" role="status">{en?"Loading project reference data...":"프로젝트 기준정보를 불러오는 중입니다."}</p>}
          {optionsError&&<p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900" role="alert">{optionsError}</p>}
          <form className="mt-7 space-y-5" data-testid="emission-project-create-form" onSubmit={submit} noValidate>
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
                    aria-describedby="project-name-status"
                    aria-invalid={nameState === "duplicate"}
                    required
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      setNameState("");
                    }}
                    onBlur={checkName}
                  />
                  {nameState && (
                    <span
                      id="project-name-status"
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
                    required
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
                          aria-label={v}
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
                    required
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
                    required
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
              <h2 className="text-lg font-black text-[#052b57]">3. {en ? "Boundary and methodology" : "조직 경계·산정 기준"}</h2>
              <p className="mt-2 text-sm text-slate-600">{en ? "These values are versioned with the project so later standard changes do not alter approved calculations." : "승인된 산정 결과가 기준정보 변경에 영향받지 않도록 프로젝트 생성 시점 값으로 고정합니다."}</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-bold">{en ? "Organization boundary" : "조직 경계"}<span className="ml-1 text-red-600">*</span><select className={input} value={form.organizationBoundary} onChange={e=>setForm({...form,organizationBoundary:e.target.value})}><option value="OPERATIONAL_CONTROL">{en?"Operational control":"운영 통제"}</option><option value="FINANCIAL_CONTROL">{en?"Financial control":"재무 통제"}</option><option value="EQUITY_SHARE">{en?"Equity share":"지분 할당"}</option></select></label>
                <label className="text-sm font-bold">{en ? "Emission standard" : "적용 표준"}<span className="ml-1 text-red-600">*</span><select className={input} value={form.emissionStandard} onChange={e=>setForm({...form,emissionStandard:e.target.value})}><option value="ISO_14064_1">ISO 14064-1</option><option value="GHG_PROTOCOL">GHG Protocol</option><option value="K_ETS">{en?"K-ETS":"배출권거래제 명세서 기준"}</option></select></label>
                <label className="text-sm font-bold">{en ? "Methodology version" : "방법론 버전"}<span className="ml-1 text-red-600">*</span><input className={input} maxLength={40} required value={form.methodologyVersion} onChange={e=>setForm({...form,methodologyVersion:e.target.value})}/></label>
                <label className="text-sm font-bold">{en ? "Verification level" : "검증 수준"}<span className="ml-1 text-red-600">*</span><select className={input} value={form.verificationLevel} onChange={e=>setForm({...form,verificationLevel:e.target.value})}><option value="LIMITED">{en?"Limited assurance":"제한적 보증"}</option><option value="REASONABLE">{en?"Reasonable assurance":"합리적 보증"}</option></select></label>
                <label className="text-sm font-bold">{en ? "Collection cycle" : "자료 수집 주기"}<span className="ml-1 text-red-600">*</span><select className={input} value={form.collectionCycle} onChange={e=>setForm({...form,collectionCycle:e.target.value})}><option value="MONTHLY">{en?"Monthly":"월간"}</option><option value="QUARTERLY">{en?"Quarterly":"분기"}</option><option value="ANNUAL">{en?"Annual":"연간"}</option></select></label>
                <label className="text-sm font-bold">{en ? "Materiality threshold (%)" : "중요성 기준 (%)"}<span className="ml-1 text-red-600">*</span><input className={input} min="0" max="100" step="1" type="number" required value={form.materialityThreshold} onChange={e=>setForm({...form,materialityThreshold:e.target.value})}/><small className="mt-1 block font-normal text-slate-500">{en?"Used to prioritize omissions and verification findings.":"누락 및 검증 발견사항의 중요도 판정 기준입니다."}</small></label>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-[#052b57]">
                4. {en ? "Owner and schedule" : "담당자·일정"}
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  {en ? "Owner" : "담당자"}
                  <span className="ml-1 text-red-600">*</span>
                  <input
                    className={input}
                    required
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
                    required
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
              <h2 className="text-lg font-black text-[#052b57]">5. {en ? "Actor assignment" : "업무 액터 배정"}</h2>
              <p className="mt-2 text-sm text-slate-600">{en ? "Assign the accountable user for each process step. Permissions and My Tasks are generated from these assignments." : "프로세스 단계별 책임 계정을 지정합니다. 이 배정을 기준으로 권한과 내 업무가 자동 생성됩니다."}</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {([
                  ["dataOwner", en ? "Site data owner" : "사업장 자료 담당자", en ? "Collects and submits source activity data" : "원천 활동자료 입력·제출"],
                  ["calculator", en ? "Emission calculator" : "배출량 산정 담당자", en ? "Maps factors and runs calculations" : "배출계수 매핑·배출량 산정"],
                  ["verifier", en ? "Verifier" : "검증 담당자", en ? "Verifies results and requests corrections" : "결과 검증·보완 요청"],
                  ["approver", en ? "Approver" : "승인 담당자", en ? "Approves the verified calculation" : "검증 완료 산정 결과 승인"],
                ] as const).map(([key,label,help])=><label className="text-sm font-bold" key={key}>{label}<span className="ml-1 text-red-600">*</span><input className={input} list="project-actor-accounts" required value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/><small className="mt-1 block font-normal text-slate-500">{help}</small></label>)}
                <datalist id="project-actor-accounts">{options.accounts.map(account=><option key={account.id} value={account.id}>{account.actors}</option>)}{options.owners.map(value=><option key={value} value={value}/>)}</datalist>
              </div>
              {form.calculator&&form.verifier&&form.approver&&(form.calculator===form.verifier||form.calculator===form.approver||form.verifier===form.approver)?<p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800" role="alert">{en ? "Calculator, verifier, and approver must be different accounts. The server will reject this assignment." : "산정자·검증자·승인자는 서로 다른 계정이어야 합니다. 이 배정은 저장할 수 없습니다."}</p>:null}
            </section>
            {message && (
              <p aria-live="assertive" className="rounded-lg bg-red-50 p-4 text-sm font-bold text-red-700" role="alert">
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
