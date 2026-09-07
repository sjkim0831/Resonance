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
  const siteRows=registryState.value?.items||[];

  async function saveSite(event:FormEvent){event.preventDefault();setSaving(true);setSaveMessage("");try{await saveEmissionSiteRegistry(form);setSaveMessage(en?"The site was saved.":"사업장을 저장했습니다.");setForm({code:"",name:"",countryCode:"KR",address:"",boundaryMethod:"OPERATIONAL_CONTROL",status:"ACTIVE",effectiveFrom:new Date().toISOString().slice(0,10)});setRegistryVersion(value=>value+1);}catch(error){setSaveMessage(error instanceof Error?error.message:String(error));}finally{setSaving(false);}}
  function editSite(row:EmissionSiteRegistryRow){setForm(row);globalThis.scrollTo({top:0,behavior:"smooth"});}

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-site-management", {
      language: en ? "en" : "ko",
      menuCode: page.menuCode || "",
      siteCount: siteRows.length
    });
    logGovernanceScope("COMPONENT", "emission-site-registry", {
      siteCount: siteRows.length
    });
  }, [en, page.menuCode, siteRows.length]);

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
        ? "Register and maintain the active sites and data owners belonging to the approved company."
        : "승인된 회사에 속한 사업장과 자료 담당자를 등록·관리합니다."}
    >
      {pageState.error ? (
        <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageState.error}
        </div>
      ) : null}

      <section className="gov-card mb-6" data-help-id="emission-site-registry">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="text-lg font-black">{en?"Organization site registry":"조직·사업장 원장"}</h3><p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en?"Only active, tenant-owned sites can be selected when creating an emission project.":"승인 기업에 속한 활성 사업장만 배출량 프로젝트 생성 시 선택할 수 있습니다."}</p></div><span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{siteRows.length} {en?"sites":"개 사업장"}</span></div>
        <form className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={saveSite}>
          <label className="text-sm font-bold">{en?"Site code":"사업장 코드"}<input aria-label={en?"Site code":"사업장 코드"} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" required value={form.code||""} onChange={event=>setForm({...form,code:event.target.value})}/></label>
          <label className="text-sm font-bold">{en?"Site name":"사업장명"}<input aria-label={en?"Site name":"사업장명"} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" maxLength={160} required value={form.name||""} onChange={event=>setForm({...form,name:event.target.value})}/></label>
          <label className="text-sm font-bold">{en?"Country":"국가 코드"}<input aria-label={en?"Country":"국가 코드"} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal uppercase" maxLength={2} required value={form.countryCode||"KR"} onChange={event=>setForm({...form,countryCode:event.target.value.toUpperCase()})}/></label>
          <label className="text-sm font-bold">{en?"Status":"상태"}<select aria-label={en?"Status":"상태"} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" value={form.status||"ACTIVE"} onChange={event=>setForm({...form,status:event.target.value as EmissionSiteRegistryRow["status"]})}><option value="ACTIVE">ACTIVE</option><option value="DRAFT">DRAFT</option><option value="INACTIVE">INACTIVE</option></select></label>
          <label className="text-sm font-bold md:col-span-2">{en?"Address":"주소"}<input aria-label={en?"Address":"주소"} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" maxLength={300} required value={form.address||""} onChange={event=>setForm({...form,address:event.target.value})}/></label>
          <label className="text-sm font-bold">{en?"Boundary method":"조직경계 방식"}<select aria-label={en?"Boundary method":"조직경계 방식"} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" value={form.boundaryMethod||"OPERATIONAL_CONTROL"} onChange={event=>setForm({...form,boundaryMethod:event.target.value})}><option value="OPERATIONAL_CONTROL">{en?"Operational control":"운영 통제"}</option><option value="FINANCIAL_CONTROL">{en?"Financial control":"재무 통제"}</option><option value="EQUITY_SHARE">{en?"Equity share":"지분 할당"}</option></select></label>
          <label className="text-sm font-bold">{en?"Data owner":"자료 담당자"}<input aria-label={en?"Data owner":"자료 담당자"} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 font-normal" maxLength={100} value={form.dataOwner||""} onChange={event=>setForm({...form,dataOwner:event.target.value})}/></label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4"><button className="gov-btn gov-btn-primary" disabled={saving} type="submit">{saving?(en?"Saving...":"저장 중..."):(form.id?(en?"Update site":"사업장 수정"):(en?"Register site":"사업장 등록"))}</button>{form.id?<button className="gov-btn gov-btn-secondary" onClick={()=>setForm({code:"",name:"",countryCode:"KR",address:"",boundaryMethod:"OPERATIONAL_CONTROL",status:"ACTIVE",effectiveFrom:new Date().toISOString().slice(0,10)})} type="button">{en?"Cancel edit":"수정 취소"}</button>:null}{saveMessage?<span className="text-sm font-bold" role="status">{saveMessage}</span>:null}</div>
        </form>
        {registryState.error?<p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{registryState.error}</p>:null}
        <div className="mt-5 overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>{en?"Code":"코드"}</th><th>{en?"Site":"사업장"}</th><th>{en?"Address":"주소"}</th><th>{en?"Boundary":"경계"}</th><th>{en?"Owner":"자료 담당자"}</th><th>{en?"Status":"상태"}</th><th>{en?"Action":"작업"}</th></tr></thead><tbody>{siteRows.map(row=><tr key={row.id}><td><code>{row.code}</code></td><td className="font-bold">{row.name}<small className="block font-normal text-slate-500">{row.countryCode}</small></td><td>{row.address}</td><td>{row.boundaryMethod}</td><td>{row.dataOwner||"-"}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{row.status}</span></td><td><button className="gov-btn gov-btn-secondary" onClick={()=>editSite(row)} type="button">{en?"Edit":"수정"}</button></td></tr>)}{!registryState.loading&&!siteRows.length?<tr><td className="py-10 text-center text-slate-500" colSpan={7}>{en?"No registered sites.":"등록된 사업장이 없습니다."}</td></tr>:null}</tbody></table></div>
      </section>

    </AdminPageShell>
  );
}
