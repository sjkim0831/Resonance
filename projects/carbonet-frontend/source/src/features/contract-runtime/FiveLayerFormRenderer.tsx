import type { ContractField, FiveLayerScreenContract } from "./fiveLayerContract";

type Props = { contract: FiveLayerScreenContract; values: Record<string, unknown>; onChange: (fieldCode: string, value: unknown) => void; sectionCodes?: string[]; disabled?: boolean };
const inputClass = "mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";

function ContractInput({ field, value, en, disabled, onChange }: { field: ContractField; value: unknown; en: boolean; disabled?: boolean; onChange: (value: unknown) => void }) {
  const label = en ? field.nameEn : field.nameKo;
  const help = en ? field.helpEn : field.helpKo;
  const common = { className: inputClass, disabled: disabled || field.readOnly, id: `contract-field-${field.code}`, name: field.code, required: field.required };
  return <label className="text-sm font-bold" htmlFor={common.id}>
    {label}{field.required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}
    {field.type === "SELECT" ? <select {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{en ? option.labelEn : option.labelKo}</option>)}</select> : <input {...common} max={field.validation?.max} maxLength={field.validation?.maxLength} min={field.validation?.min} step={field.validation?.step} type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />}
    {help ? <small className="mt-1 block font-normal leading-5 text-slate-500">{help}</small> : null}
  </label>;
}

export function FiveLayerFormRenderer({ contract, values, onChange, sectionCodes, disabled }: Props) {
  const en = window.location.pathname.startsWith("/en/");
  const allowed = sectionCodes ? new Set(sectionCodes) : null;
  const sections = [...contract.uiSchema.sections].filter((section) => !allowed || allowed.has(section.code)).sort((left, right) => left.order - right.order);
  return <div data-contract-id={contract.screen.contractId} data-contract-version={contract.version}>
    {sections.map((section) => {
      const fields = contract.dataSchema.fields.filter((field) => field.section === section.code);
      const columns = section.columns === 1 ? "grid-cols-1" : section.columns === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2";
      return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" key={section.code}>
        <h2 className="text-lg font-black text-[#052b57]">{section.order}. {en ? section.nameEn : section.nameKo}</h2>
        {(en ? section.descriptionEn : section.descriptionKo) ? <p className="mt-2 text-sm leading-6 text-slate-600">{en ? section.descriptionEn : section.descriptionKo}</p> : null}
        <div className={`mt-5 grid gap-5 ${columns}`}>{fields.map((field) => <ContractInput disabled={disabled} en={en} field={field} key={field.code} onChange={(value) => onChange(field.code, value)} value={values[field.code]} />)}</div>
      </section>;
    })}
  </div>;
}
