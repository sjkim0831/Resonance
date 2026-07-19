export type CommonWorkflowStep = { id: string; label: string; href: string };

type Props = {
  eyebrow: string; positionLabel: string; title: string; objective: string;
  requiredInputLabel: string; requiredInput: string;
  completionEvidenceLabel: string; completionEvidence: string;
  actionHref: string; actionLabel: string; nextHref?: string; nextLabel?: string;
  workflowLabel: string; steps: CommonWorkflowStep[]; activeStepId?: string;
};

export function CommonWorkflowWorkspace(props: Props) {
  return (
    <section className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50" data-common-component="COMMON_STEP_FLOW">
      <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{props.eyebrow} · {props.positionLabel}</p>
            <h2 className="mt-2 break-words text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{props.title}</h2>
            <p className="mt-2 max-w-3xl break-words text-sm font-medium leading-6 text-slate-600">{props.objective}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2" data-common-component="COMMON_ACTION_BAR">
            <a className="inline-flex min-h-11 items-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-blue)] transition-colors hover:bg-blue-50" href={props.actionHref}><span className="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span>{props.actionLabel}</a>
            {props.nextHref && props.nextLabel ? <a className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--kr-gov-blue-hover)]" href={props.nextHref}>{props.nextLabel}<span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span></a> : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4" data-common-component="COMMON_CONTENT_CARD"><p className="text-xs font-black text-slate-500">{props.requiredInputLabel}</p><p className="mt-1 break-words text-sm font-bold text-slate-800">{props.requiredInput}</p></article>
          <article className="rounded-xl border border-slate-200 bg-white p-4" data-common-component="COMMON_CONTENT_CARD"><p className="text-xs font-black text-slate-500">{props.completionEvidenceLabel}</p><p className="mt-1 break-words text-sm font-bold text-slate-800">{props.completionEvidence}</p></article>
        </div>
        <nav className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label={props.workflowLabel}>
          {props.steps.map((step, index) => { const active = step.id === props.activeStepId; return <a key={step.id} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${active ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"}`} href={step.href} aria-current={active ? "step" : undefined}><span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[10px]">{index + 1}</span>{step.label}</a>; })}
        </nav>
      </div>
    </section>
  );
}
