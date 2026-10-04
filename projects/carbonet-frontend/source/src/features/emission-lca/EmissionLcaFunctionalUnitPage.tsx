import { useEffect, useState } from "react";

// Candidate component: publish only after the runtime route/SDUI contract is resolved.
export function EmissionLcaFunctionalUnitPage() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectId, setProjectId] = useState(new URLSearchParams(window.location.search).get("projectId") || "");
  const [form, setForm] = useState({ function: "", quantity: "", unit: "", performance: "", lifetime: "", referenceQuantity: "", referenceUnit: "", basis: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    fetch("/home/api/emission-projects?page=1&size=100", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as { items?: Array<Record<string, unknown>> };
        if (!response.ok) throw new Error();
        const available = (body.items || []).map(item => ({ id: String(item.id || ""), name: String(item.name || item.id || "") })).filter(item => item.id);
        setProjects(available);
        setProjectId(current => available.some(project => project.id === current) ? current : available[0]?.id || "");
      }).catch(() => setProjects([]));
  }, []);
  const fields: Array<[keyof typeof form, string, string]> = [
    ["function", "제품이 제공하는 기능", "예: 실내 공간에 조명을 제공"],
    ["quantity", "기능 제공량", "양수 입력"],
    ["unit", "기능 제공량 단위", "예: lm·h"],
    ["performance", "성능·품질 조건", "예: 조도, 강도, 순도 등 비교 조건"],
    ["lifetime", "사용 기간·적용 조건", "기간 또는 해당 없음과 사유"],
    ["referenceQuantity", "기준 흐름 수량", "기능 단위를 충족하는 제품의 양"],
    ["referenceUnit", "기준 흐름 단위", "예: kg, 개"],
    ["basis", "산출 근거·출처", "기준 흐름 환산식, 시험자료 또는 근거 문서"],
  ];
  const validate = () => {
    const issues = fields.filter(([key]) => !form[key].trim()).map(([, label]) => `${label}을 입력하세요.`);
    for (const key of ["quantity", "referenceQuantity"] as const) if (form[key] && (!Number.isFinite(Number(form[key])) || Number(form[key]) <= 0)) issues.push(`${key === "quantity" ? "기능 제공량" : "기준 흐름 수량"}은 0보다 큰 수여야 합니다.`);
    if (!projectId) issues.unshift("프로젝트를 먼저 선택하세요.");
    setErrors(issues); setChecked(issues.length === 0);
  };
  return <main className="mx-auto max-w-7xl px-6 py-8 text-[#052b57]" data-testid="lca-functional-unit">
    <p className="text-sm">제품 LCA · 범위 정의</p>
    <h1 className="mt-2 text-3xl font-bold">기능 단위</h1>
    <p className="mt-3">제품의 기능과 비교 조건을 정의하고, 해당 기능을 제공하는 데 필요한 제품의 양을 기록합니다.</p>
    <label className="my-6 block rounded border bg-white p-4">프로젝트 선택 <select className="ml-4 min-w-72 rounded border p-2" value={projectId} onChange={event => { setProjectId(event.target.value); setChecked(false); }}><option value="">프로젝트를 선택하세요</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}</select></label>
    <p role="status" className="mb-6 rounded border border-amber-300 bg-amber-50 p-4">입력 검토용 화면입니다. 저장 연결 전이며 입력값은 새로고침하면 사라집니다.</p>
    <form onSubmit={event => { event.preventDefault(); validate(); }} className="rounded border bg-white p-6">
      <h2 className="mb-5 text-xl font-bold">기능 단위 및 기준 흐름 정의</h2>
      <div className="grid gap-5 md:grid-cols-2">{fields.map(([key, label, placeholder]) => <label key={key} className="block">{label} <span className="text-red-700">(필수)</span><input required className="mt-2 block w-full rounded border border-slate-400 p-3" value={form[key]} placeholder={placeholder} onChange={event => { setForm(current => ({ ...current, [key]: event.target.value })); setChecked(false); setErrors([]); }} /></label>)}</div>
      <section className="my-6 rounded bg-slate-50 p-4"><h2 className="font-bold">입력 내용 미리보기</h2><p className="mt-2">{form.function || "기능 미입력"} · {form.quantity || "—"} {form.unit} · {form.performance || "성능 조건 미입력"}</p><p>사용 조건: {form.lifetime || "—"}</p><p>필요 기준 흐름: {form.referenceQuantity || "—"} {form.referenceUnit}</p></section>
      {errors.length > 0 && <ul role="alert" className="mb-4 text-red-700">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      {checked && <p role="status">필수 입력과 수량 형식 검사를 통과했습니다. 방법론 적합성 및 저장은 검증되지 않았습니다.</p>}
      <div className="mt-4 flex gap-3"><button type="submit" className="rounded bg-[#003b88] px-5 py-3 text-white">입력 검증</button><button disabled className="rounded border px-5 py-3 text-slate-500">저장 준비 중</button><a className="p-3 underline" href={`/lca/system-boundary${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}>시스템 경계 확인</a><a className="p-3 underline" href={`/lca/materials${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}>다음: 원료·보조재</a></div>
    </form>
    <details className="mt-6 rounded border p-4"><summary>업무 도움말·검토 기준</summary><p className="mt-3">1. 프로젝트와 시스템 경계를 확인합니다. 2. 기능·양·품질·기간을 정의합니다. 3. 기준 흐름과 근거를 작성합니다. 4. 검토 담당자가 비교 가능성을 확인한 후 확정합니다. 단순한 제품 중량과 기능 단위를 동일한 개념으로 취급하지 않습니다.</p></details>
  </main>;
}
