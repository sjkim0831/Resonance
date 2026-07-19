import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  readBootstrappedEmissionSiteManagementPageData
} from "../../lib/api/bootstrap";
import { fetchEmissionSiteManagementPage, fetchEmissionSiteRegistry, saveEmissionSiteRegistry } from "../../lib/api/emission";
import type { EmissionSiteManagementPagePayload, EmissionSiteRegistryRow } from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

function stringOf(row: Record<string, string> | undefined, key: string) {
  return row ? String(row[key] || "") : "";
}

export function EmissionSiteManagementMigrationPage() {
  const en = isEnglish();
  const initialPayload = useMemo(() => readBootstrappedEmissionSiteManagementPageData(), []);
  const pageState = useAsyncValue<EmissionSiteManagementPagePayload>(() => fetchEmissionSiteManagementPage(), [], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload)
  });
  const [registryVersion,setRegistryVersion]=useState(0);
  const registryState=useAsyncValue(()=>fetchEmissionSiteRegistry(),[registryVersion]);
  const [form,setForm]=useState<Partial<EmissionSiteRegistryRow>>({code:"",name:"",countryCode:"KR",address:"",boundaryMethod:"OPERATIONAL_CONTROL",status:"ACTIVE",effectiveFrom:new Date().toISOString().slice(0,10)});
  const [saveMessage,setSaveMessage]=useState("");
  const [saving,setSaving]=useState(false);
  const page = pageState.value || {};
  const summaryCards = (page.summaryCards || []) as Array<Record<string, string>>;
  const quickLinks = (page.quickLinks || []) as Array<Record<string, string>>;
  const operationCards = (page.operationCards || []) as Array<Record<string, string>>;
  const featureRows = (page.featureRows || []) as Array<Record<string, string>>;
  const referenceRows = (page.referenceRows || []) as Array<Record<string, string>>;
  const siteRows=registryState.value?.items||[];

  async function saveSite(event:FormEvent){event.preventDefault();setSaving(true);setSaveMessage("");try{await saveEmissionSiteRegistry(form);setSaveMessage(en?"The site was saved.":"사업장을 저장했습니다.");setForm({code:"",name:"",countryCode:"KR",address:"",boundaryMethod:"OPERATIONAL_CONTROL",status:"ACTIVE",effectiveFrom:new Date().toISOString().slice(0,10)});setRegistryVersion(value=>value+1);}catch(error){setSaveMessage(error instanceof Error?error.message:String(error));}finally{setSaving(false);}}
  function editSite(row:EmissionSiteRegistryRow){setForm(row);globalThis.scrollTo({top:0,behavior:"smooth"});}

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-site-management", {
      language: en ? "en" : "ko",
      menuCode: page.menuCode || "",
      summaryCount: summaryCards.length,
      quickLinkCount: quickLinks.length,
      operationCardCount: operationCards.length,
      featureCount: featureRows.length
    });
    logGovernanceScope("COMPONENT", "emission-site-summary", {
      summaryCount: summaryCards.length,
      quickLinkCount: quickLinks.length,
      referenceCount: referenceRows.length
    });
  }, [en, featureRows.length, operationCards.length, page.menuCode, quickLinks.length, referenceRows.length, summaryCards.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Calculation & Certification" : "산정·인증" },
        { label: en ? "Emission Site Operations" : "배출지 운영" },
        { label: en ? "Emission Site Management" : "배출지 관리" }
      ]}
      title={en ? "Emission Site Management" : "배출지 관리"}
      subtitle={en
        ? "Use the admin workspace as the direct control point for emission site registration and related operational capabilities."
        : "배출지 등록과 관련 운영 기능을 관리자 작업공간에서 직접 제어합니다."}
    >
      {pageState.error ? (
        <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageState.error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3" data-help-id="emission-site-summary">
        {summaryCards.map((card) => (
          <section className="gov-card" key={stringOf(card, "title")}>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{stringOf(card, "title")}</p>
            <p className={`mt-2 text-3xl font-black ${stringOf(card, "toneClass")}`}>{stringOf(card, "value")}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(card, "description")}</p>
          </section>
        ))}
      </div>

      <section className="gov-card mb-6" data-help-id="emission-site-registry">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="text-lg font-black">{en?"Organization site registry":"조직·사업장 원장"}</h3><p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en?"Only active, tenant-owned sites can be selected when creating an emission project.":"승인 기업에 속한 활성 사업장만 배출량 프로젝트 생성 시 선택할 수 있습니다."}</p></div><span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{siteRows.length} {en?"sites":"개 사업장"}</span></div>
        <form className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={saveSite}>
          <label className="text-sm font-bold">{en?"Site code":"사업장 코드"}<input className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" required value={form.code||""} onChange={event=>setForm({...form,code:event.target.value})}/></label>
          <label className="text-sm font-bold">{en?"Site name":"사업장명"}<input className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" maxLength={160} required value={form.name||""} onChange={event=>setForm({...form,name:event.target.value})}/></label>
          <label className="text-sm font-bold">{en?"Country":"국가 코드"}<input className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal uppercase" maxLength={2} required value={form.countryCode||"KR"} onChange={event=>setForm({...form,countryCode:event.target.value.toUpperCase()})}/></label>
          <label className="text-sm font-bold">{en?"Status":"상태"}<select className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" value={form.status||"ACTIVE"} onChange={event=>setForm({...form,status:event.target.value as EmissionSiteRegistryRow["status"]})}><option value="ACTIVE">ACTIVE</option><option value="DRAFT">DRAFT</option><option value="INACTIVE">INACTIVE</option></select></label>
          <label className="text-sm font-bold md:col-span-2">{en?"Address":"주소"}<input className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" maxLength={300} required value={form.address||""} onChange={event=>setForm({...form,address:event.target.value})}/></label>
          <label className="text-sm font-bold">{en?"Boundary method":"조직경계 방식"}<select className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" value={form.boundaryMethod||"OPERATIONAL_CONTROL"} onChange={event=>setForm({...form,boundaryMethod:event.target.value})}><option value="OPERATIONAL_CONTROL">{en?"Operational control":"운영 통제"}</option><option value="FINANCIAL_CONTROL">{en?"Financial control":"재무 통제"}</option><option value="EQUITY_SHARE">{en?"Equity share":"지분 할당"}</option></select></label>
          <label className="text-sm font-bold">{en?"Data owner":"자료 담당자"}<input className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" maxLength={100} value={form.dataOwner||""} onChange={event=>setForm({...form,dataOwner:event.target.value})}/></label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4"><button className="gov-btn gov-btn-primary" disabled={saving} type="submit">{saving?(en?"Saving...":"저장 중..."):(form.id?(en?"Update site":"사업장 수정"):(en?"Register site":"사업장 등록"))}</button>{form.id?<button className="gov-btn gov-btn-secondary" onClick={()=>setForm({code:"",name:"",countryCode:"KR",address:"",boundaryMethod:"OPERATIONAL_CONTROL",status:"ACTIVE",effectiveFrom:new Date().toISOString().slice(0,10)})} type="button">{en?"Cancel edit":"수정 취소"}</button>:null}{saveMessage?<span className="text-sm font-bold" role="status">{saveMessage}</span>:null}</div>
        </form>
        {registryState.error?<p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{registryState.error}</p>:null}
        <div className="mt-5 overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>{en?"Code":"코드"}</th><th>{en?"Site":"사업장"}</th><th>{en?"Address":"주소"}</th><th>{en?"Boundary":"경계"}</th><th>{en?"Owner":"자료 담당자"}</th><th>{en?"Status":"상태"}</th><th>{en?"Action":"작업"}</th></tr></thead><tbody>{siteRows.map(row=><tr key={row.id}><td><code>{row.code}</code></td><td className="font-bold">{row.name}<small className="block font-normal text-slate-500">{row.countryCode}</small></td><td>{row.address}</td><td>{row.boundaryMethod}</td><td>{row.dataOwner||"-"}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{row.status}</span></td><td><button className="gov-btn gov-btn-secondary" onClick={()=>editSite(row)} type="button">{en?"Edit":"수정"}</button></td></tr>)}{!registryState.loading&&!siteRows.length?<tr><td className="py-10 text-center text-slate-500" colSpan={7}>{en?"No registered sites.":"등록된 사업장이 없습니다."}</td></tr>:null}</tbody></table></div>
      </section>

      <section className="gov-card mb-6" data-help-id="emission-site-quick-links">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{en ? "Direct Control Links" : "직접 제어 링크"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "Open registration, function governance, and related admin pages without leaving the admin workspace." : "관리자 작업공간에서 등록, 기능 거버넌스, 관련 화면으로 바로 이동합니다."}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">
            {page.menuCode || "-"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((link) => (
            <a
              className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4 transition hover:border-[var(--kr-gov-blue)] hover:bg-blue-50"
              href={stringOf(link, "url")}
              key={stringOf(link, "label")}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{stringOf(link, "icon")}</span>
                <div>
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(link, "label")}</p>
                  <p className="mt-1 break-all text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(link, "url")}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <section className="gov-card" data-help-id="emission-site-operation-cards">
          <div className="mb-4">
            <h3 className="text-lg font-bold">{en ? "Operational Functions" : "운영 기능"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "Map the home-side reference workflow into admin-managed operational actions." : "홈 화면 기준 기능을 관리자 운영 액션으로 매핑합니다."}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {operationCards.map((card) => (
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-5" key={stringOf(card, "title")}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h4 className="text-base font-black text-[var(--kr-gov-text-primary)]">{stringOf(card, "title")}</h4>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                    {stringOf(card, "statusLabel")}
                  </span>
                </div>
                <p className="min-h-[52px] text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(card, "description")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a className="gov-btn gov-btn-primary" href={stringOf(card, "primaryUrl")}>{stringOf(card, "primaryLabel")}</a>
                  <a className="gov-btn gov-btn-secondary" href={stringOf(card, "secondaryUrl")}>{stringOf(card, "secondaryLabel")}</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="gov-card" data-help-id="emission-site-register" id="register">
            <h3 className="text-lg font-bold">{en ? "Direct Registration Guide" : "직접 등록 가이드"}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Treat this menu as the direct admin registration entry. Use the registration feature, then hand off data input, calculation, supplement, and reporting permissions through function management."
                : "이 메뉴를 관리자 직접 등록 진입점으로 사용하고, 등록 이후 데이터 입력·산정·보완·보고서 권한은 기능 관리에서 연결합니다."}
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
              <li>{en ? "1. Start the emission site registration from this admin menu." : "1. 이 관리자 메뉴에서 배출지 등록을 직접 시작합니다."}</li>
              <li>{en ? "2. Assign operational feature codes by role in function management." : "2. 기능 관리에서 역할별 운영 기능 코드를 배정합니다."}</li>
              <li>{en ? "3. Reference the home path only for user-side workflow parity." : "3. 사용자용 프로젝트 흐름은 홈 기준 경로만 참고합니다."}</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <a className="gov-btn gov-btn-primary" href={page.menuUrl || "#"}>{en ? "Stay on admin registration" : "관리자 등록 화면 유지"}</a>
              <a className="gov-btn gov-btn-secondary" href={page.homeReferenceUrl || "#"}>{en ? "Open home reference" : "홈 기준 경로 열기"}</a>
            </div>
          </section>

          <section className="gov-card" data-help-id="emission-site-reference">
            <h3 className="text-lg font-bold">{en ? "Reference Map" : "참조 맵"}</h3>
            <div className="mt-4 space-y-3">
              {referenceRows.map((row) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={`${stringOf(row, "label")}-${stringOf(row, "value")}`}>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{stringOf(row, "label")}</p>
                  <p className="mt-1 break-all text-sm font-medium text-[var(--kr-gov-text-primary)]">{stringOf(row, "value")}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="gov-card mt-6" data-help-id="emission-site-feature-catalog">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{en ? "Feature Catalog" : "기능 카탈로그"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "These seeded feature codes form the authority chain for the new admin menu." : "신규 관리자 메뉴에 연결되는 권한 체인용 시드 기능 코드입니다."}
            </p>
          </div>
          <a className="gov-btn gov-btn-secondary" href={buildLocalizedPath(`/admin/system/feature-management?menuType=ADMIN&searchMenuCode=${page.menuCode || ""}`, `/en/admin/system/feature-management?menuType=ADMIN&searchMenuCode=${page.menuCode || ""}`)}>
            {en ? "Open function management" : "기능 관리 열기"}
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[860px]">
            <thead>
              <tr>
                <th>{en ? "Feature Code" : "기능 코드"}</th>
                <th>{en ? "Feature Name" : "기능명"}</th>
                <th>{en ? "Description" : "설명"}</th>
                <th>{en ? "Manage" : "관리"}</th>
              </tr>
            </thead>
            <tbody>
              {featureRows.map((row) => (
                <tr key={stringOf(row, "featureCode")}>
                  <td><code className="text-xs font-bold text-[var(--kr-gov-blue)]">{stringOf(row, "featureCode")}</code></td>
                  <td className="font-bold">{stringOf(row, "featureName")}</td>
                  <td>{stringOf(row, "featureDescription")}</td>
                  <td>
                    <a className="gov-btn gov-btn-secondary" href={stringOf(row, "manageUrl")}>
                      {en ? "Function management" : "기능 관리"}
                    </a>
                  </td>
                </tr>
              ))}
              {featureRows.length === 0 ? (
                <tr>
                  <td className="text-center text-[var(--kr-gov-text-secondary)]" colSpan={4}>
                    {en ? "No feature rows were registered." : "등록된 기능 행이 없습니다."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPageShell>
  );
}
