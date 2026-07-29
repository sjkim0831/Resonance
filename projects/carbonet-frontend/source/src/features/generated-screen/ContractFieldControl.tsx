export type ContractField = {
  code: string; label: string; control?: unknown; dataType?: unknown;
  required?: unknown; editable?: unknown; disabled?: unknown;
  placeholder?: unknown; description?: unknown; helpText?: unknown;
  min?: unknown; max?: unknown; maxLength?: unknown; options?: unknown;
};

type Props = { field: ContractField; value: string; onChange: (value: string) => void };
const controlClass = "krds-control mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
const flag = (value: unknown, fallback = false) => typeof value === "boolean" ? value : fallback;
const number = (value: unknown) => typeof value === "number" ? value : undefined;
const options = (value: unknown) => Array.isArray(value) ? value.map((option,index) => {
  if (typeof option === "string") return {value:option,label:option};
  const item=option as Record<string,unknown>;
  return {value:String(item.value??item.code??index),label:String(item.label??item.name??item.value??item.code??index)};
}) : [];

export function ContractFieldControl({field,value,onChange}:Props) {
  const kind=String(field.control||field.dataType||"TEXT").toUpperCase();
  const required=flag(field.required), disabled=flag(field.disabled)||field.editable===false;
  const description=String(field.helpText||field.description||""), choices=options(field.options);
  const common={id:`contract-field-${field.code}`,name:field.code,required,disabled,"aria-describedby":description?`contract-field-help-${field.code}`:undefined};
  let control;
  if(kind.includes("TEXTAREA")||kind.includes("MULTILINE")) control=<textarea {...common} className={`${controlClass} min-h-28 py-3`} maxLength={number(field.maxLength)} placeholder={String(field.placeholder||"")} value={value} onChange={event=>onChange(event.target.value)}/>;
  else if((kind.includes("SELECT")||kind.includes("COMBO")||kind.includes("CODE")||kind.includes("SEARCH")||kind.includes("BADGE"))&&choices.length>0) control=<select {...common} className={controlClass} value={value} onChange={event=>onChange(event.target.value)}><option value="">선택</option>{choices.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>;
  else if(kind.includes("BOOLEAN")||kind.includes("CHECKBOX")) control=<input {...common} checked={value==="true"} className="mt-2 size-5 accent-[#246beb]" type="checkbox" onChange={event=>onChange(String(event.target.checked))}/>;
  else {
    const type=kind.includes("NUMBER")||kind.includes("DECIMAL")||kind.includes("INTEGER")?"number":kind.includes("DATE")?"date":kind.includes("EMAIL")?"email":kind.includes("URL")?"url":kind.includes("TEL")||kind.includes("PHONE")?"tel":"text";
    control=<input {...common} className={controlClass} max={number(field.max)} maxLength={number(field.maxLength)} min={number(field.min)} placeholder={String(field.placeholder||"")} type={type} value={value} onChange={event=>onChange(event.target.value)}/>;
  }
  return <label className="gov-text-label font-bold text-slate-700" htmlFor={common.id}><span>{field.label}{required&&<span aria-label="필수 입력" className="ml-1 text-red-600">*</span>}</span>{control}{description&&<span className="gov-text-body-sm mt-1 block font-normal text-slate-500" id={`contract-field-help-${field.code}`}>{description}</span>}</label>;
}
