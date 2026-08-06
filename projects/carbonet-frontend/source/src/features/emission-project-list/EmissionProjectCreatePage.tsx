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
import { FiveLayerFormRenderer } from "../contract-runtime/FiveLayerFormRenderer";
import { useRuntimeScreenContract } from "../contract-runtime/useRuntimeScreenContract";
import { EMISSION_PROJECT_CREATE_CONTRACT } from "./emissionProjectCreateContract";

type Readiness = { ready: boolean; sandbox?: boolean; companyApproved: boolean; activeSiteCount: number; actorCoverage: Record<string, number>; segregationOfDuties?: boolean; segregatedDutyAccountCount?: number; conflictingDutyAccountCount?: number; missing: string[]; siteManagementUrl: string; actorManagementUrl: string };
type AccountOption = {
  id: string;
  displayName: string;
  department: string;
  companyId: string;
  companyName: string;
  actors: string;
  dataScopes: string;
};
type Options = { sites: string[]; owners: string[]; accounts: AccountOption[]; currentUser: string; readiness: Readiness };
const EMPTY_READINESS:Readiness={ready:false,companyApproved:false,activeSiteCount:0,actorCoverage:{},missing:[],siteManagementUrl:"/admin/emission/site-management",actorManagementUrl:"/admin/system/actor-process"};
const readinessMessage=(code:string,en:boolean)=>{
  if(code==="COMPANY_NOT_APPROVED")return en?"Company approval is required.":"승인된 기업 정보가 필요합니다.";
  if(code==="ACTIVE_SITE_REQUIRED")return en?"At least one active site is required.":"활성 사업장이 1개 이상 필요합니다.";
  if(code.startsWith("REQUIRED_ACTOR_MISSING:"))return en?`Required actor is missing: ${code.split(":")[1]}`:`필수 담당자가 없습니다: ${code.split(":")[1]}`;
  if(code.startsWith("SEGREGATION_OF_DUTIES_REQUIRED:"))return en?"Calculator, verifier, and approver must be three separate accounts.":"산정·검증·승인은 서로 다른 3개 계정에 배정해야 합니다.";
  return code;
};
const year = new Date().getFullYear();
const createRequestId = () => globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const EMPTY = {
  clientRequestId: createRequestId(),
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
  const runtimeContract = useRuntimeScreenContract("EMISSION_PROJECT_CREATE_V1", EMISSION_PROJECT_CREATE_CONTRACT);
  const [form, setForm] = useState(EMPTY),
    [options, setOptions] = useState<Options>({ sites: [], owners: [], accounts: [], currentUser: "", readiness: EMPTY_READINESS }),
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
          readiness:value.readiness&&typeof value.readiness==="object"?{...EMPTY_READINESS,...value.readiness}:EMPTY_READINESS,
        };
        setOptions(normalized);
        const managers = normalized.accounts.filter((account) => account.actors.split(",").map((actor) => actor.trim()).includes("COMPANY_MANAGER"));
        const eligibleCurrentUser = managers.some((account) => account.id.toLowerCase() === normalized.currentUser.toLowerCase());
        setForm(current=>({...current,owner:current.owner||(eligibleCurrentUser?normalized.currentUser:(managers[0]?.id??""))}));
        setOptionsError("");
      })
      .catch(() => {
        setOptions({ sites: [], owners: [], accounts: [], currentUser: "", readiness: EMPTY_READINESS });
        setOptionsError(en ? "Project readiness could not be verified. Creation is blocked for safety." : "프로젝트 착수 준비 상태를 확인하지 못했습니다. 안전을 위해 생성을 차단합니다.");
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
  const accountsFor = (actorCode: string) =>
    options.accounts.filter((account) =>
      account.actors.split(",").map((actor) => actor.trim()).includes(actorCode),
    );
  const accountLabel = (account: AccountOption) => {
    const rawCompany = account.companyName || account.companyId;
    const company = rawCompany === "DEFAULT" ? (en ? "Shared QA tenant" : "공통 테스트 회사") : rawCompany || (en ? "Company not identified" : "회사 미확인");
    const department = account.department || (en ? "Department not set" : "부서 미설정");
    const scopeLabel = account.dataScopes && account.dataScopes !== "*" ? ` · ${account.dataScopes}` : "";
    return `${account.displayName || account.id} · ${department} · ${company} · ${account.id}${scopeLabel}`;
  };
  const contractOptionSources = {
    ACTIVE_SITES: options.sites.map((site) => ({ value: site, label: site })),
    ...Object.fromEntries(
      ["COMPANY_MANAGER", "SITE_DATA_OWNER", "CALCULATOR", "VERIFIER", "APPROVER"].map((actorCode) => [
        `${actorCode}_ACCOUNTS`,
        accountsFor(actorCode).map((account) => ({ value: account.id, label: accountLabel(account) })),
      ]),
    ),
  };
  const updateContractField = (fieldCode: string, value: unknown) => {
    setForm((current) => ({
      ...current,
      [fieldCode]: fieldCode === "scopes" && Array.isArray(value) ? value.map(String) : String(value ?? ""),
    } as typeof EMPTY));
    if (fieldCode === "name") setNameState("");
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!options.readiness.ready)
      return setMessage(en ? "Complete company, site, and actor onboarding before creating a project." : "기업 승인, 사업장 등록, 필수 액터 배정을 완료한 후 프로젝트를 생성해 주세요.");
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
          {!optionsLoading&&!optionsError?<section className={`mt-5 rounded-xl border p-5 ${options.readiness.ready?"border-emerald-200 bg-emerald-50":"border-amber-300 bg-amber-50"}`} aria-label={en?"Project readiness":"프로젝트 착수 준비 진단"}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-black text-[#052b57]">{en?"Project readiness":"프로젝트 착수 준비 진단"}</p><p className="mt-1 text-sm text-slate-700">{options.readiness.ready?(en?"Company, site, and required actor checks passed.":"기업·사업장·필수 액터 검사를 모두 통과했습니다."):(en?"Resolve the blocking items before starting a governed project.":"아래 차단 항목을 해결해야 감사 가능한 프로젝트를 시작할 수 있습니다.")}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${options.readiness.ready?"bg-emerald-700 text-white":"bg-amber-700 text-white"}`}>{options.readiness.ready?(en?"READY":"착수 가능"):(en?"ACTION REQUIRED":"조치 필요")}</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-white p-3"><b>{en?"Company approval":"기업 승인"}</b><p className="mt-1 text-sm">{options.readiness.companyApproved?(en?"Completed":"완료"):(en?"Required":"필요")}</p></div><div className="rounded-lg bg-white p-3"><b>{en?"Active sites":"활성 사업장"}</b><p className="mt-1 text-sm">{options.readiness.activeSiteCount}</p></div><div className="rounded-lg bg-white p-3"><b>{en?"Required actors":"필수 액터"}</b><p className="mt-1 text-sm">{Object.values(options.readiness.actorCoverage).filter(value=>value>0).length}/5</p></div><div className="rounded-lg bg-white p-3"><b>{en?"Segregation of duties":"업무분리"}</b><p className="mt-1 text-sm">{options.readiness.segregationOfDuties?(en?"Passed":"충족"):(en?"Separate accounts required":"계정 분리 필요")}</p></div></div>
            {!options.readiness.ready?<div className="mt-4"><ul className="space-y-1 text-sm font-bold text-amber-950">{options.readiness.missing.map(item=><li key={item}>• {readinessMessage(item,en)}</li>)}</ul><div className="mt-4 flex flex-wrap gap-2"><a className="rounded-lg bg-white px-4 py-2 text-sm font-black text-blue-800 ring-1 ring-blue-200" href={options.readiness.siteManagementUrl}>{en?"Manage sites":"사업장 관리"}</a><a className="rounded-lg bg-white px-4 py-2 text-sm font-black text-blue-800 ring-1 ring-blue-200" href={options.readiness.actorManagementUrl}>{en?"Manage actors":"액터·권한 관리"}</a></div></div>:null}
          </section>:null}
          <form className="mt-7 space-y-5" data-contract-version={runtimeContract.contract.version} data-contract-source={runtimeContract.source} data-process-code={runtimeContract.contract.processSchema.processCode} data-step-code={runtimeContract.contract.processSchema.stepCode} data-testid="emission-project-create-form" onSubmit={submit} noValidate>
            <FiveLayerFormRenderer
              contract={runtimeContract.contract}
              fieldMessages={{
                name: nameState
                  ? {
                      text: nameState === "ok"
                        ? (en ? "Available name" : "사용 가능한 이름입니다.")
                        : (en ? "Name already exists" : "이미 등록된 이름입니다."),
                      tone: nameState === "ok" ? "success" : "error",
                    }
                  : undefined,
              }}
              onChange={updateContractField}
              onFieldBlur={(fieldCode) => {
                if (fieldCode === "name") void checkName();
              }}
              optionSources={contractOptionSources}
              sectionCodes={["basic", "scope"]}
              values={form}
            />
            <div className="five-layer-methodology">
              <FiveLayerFormRenderer
                contract={runtimeContract.contract}
                onChange={updateContractField}
                sectionCodes={["methodology"]}
                values={form}
              />
            </div>
            <FiveLayerFormRenderer
              contract={runtimeContract.contract}
              onChange={updateContractField}
              optionSources={contractOptionSources}
              sectionCodes={["ownership", "actors"]}
              values={form}
            />
            {form.calculator&&form.verifier&&form.approver&&(form.calculator===form.verifier||form.calculator===form.approver||form.verifier===form.approver)?<p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800" role="alert">{en ? "Calculator, verifier, and approver must be different accounts. The server will reject this assignment." : "산정자·검증자·승인자는 서로 다른 계정이어야 합니다. 이 배정은 저장할 수 없습니다."}</p>:null}
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
                disabled={saving||optionsLoading||!options.readiness.ready}
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
