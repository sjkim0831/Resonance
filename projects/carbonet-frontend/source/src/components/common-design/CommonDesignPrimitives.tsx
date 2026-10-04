import type { HTMLAttributes, ReactNode } from "react";
import {CurrentEmissionContract,emissionContractPage} from '../../features/emission-common/currentEmissionContract';
import {EmissionWorkflowNavigator} from '../../features/emission-common/EmissionWorkflowNavigator';
import {CommonBreadcrumb} from './CommonBreadcrumb';

export function CommonPortalPageShell({ children, className = "", ...attributes }: HTMLAttributes<HTMLDivElement>) {
  return <div {...attributes} data-common-component="COMMON_PORTAL_PAGE_SHELL" className={`min-h-screen bg-[var(--ccus-page-canvas,#fff)] text-[var(--kr-gov-text-primary)] ${className}`}>{children}</div>;
}

export function CommonPageContainer({ children, className = "", contentClassName = "", ...attributes }: HTMLAttributes<HTMLElement> & { contentClassName?: string }) {
  return <main {...attributes} data-common-component="COMMON_PAGE_CONTAINER" className={`min-h-[calc(100vh-80px)] bg-[var(--ccus-page-canvas,#fff)] px-4 py-8 lg:px-8 ${className}`}><div className={`mx-auto max-w-7xl ${contentClassName}`}><CommonBreadcrumb/><CurrentEmissionContract route={location.pathname}/>{!emissionContractPage(location.pathname)&&<EmissionWorkflowNavigator/>}{children}</div></main>;
}

export function CommonPageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <header data-common-component="COMMON_PAGE_HEADER" className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div>{eyebrow ? <p className="text-sm font-bold text-[var(--kr-gov-blue,#246beb)]">{eyebrow}</p> : null}<h1 className="mt-2 text-3xl font-black text-[var(--kr-gov-text-primary,#052b57)]">{title}</h1>{description ? <p className="mt-2 text-[var(--kr-gov-text-secondary,#475569)]">{description}</p> : null}</div>{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}</header>;
}

export function CommonEmbeddedWorkspace({ children, className = "", workspaceId, ...attributes }: HTMLAttributes<HTMLDivElement> & { workspaceId: string }) {
  return <div {...attributes} data-common-component="COMMON_EMBEDDED_WORKSPACE" data-workspace-id={workspaceId} className={`min-h-screen bg-[var(--ccus-page-canvas,#fff)] text-[var(--kr-gov-text-primary,#052b57)] ${className}`}>{children}</div>;
}

export function CommonStatusBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span data-common-component="COMMON_STATUS_BADGE" className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-tight ${className}`}>{children}</span>;
}

export function CommonContentCard({ children, className = "", ...attributes }: HTMLAttributes<HTMLElement>) {
  return <article {...attributes} data-common-component="COMMON_CONTENT_CARD" className={`rounded-xl border border-[var(--kr-gov-border-light)] bg-white shadow-sm ${className}`}>{children}</article>;
}

export function CommonDataTable({ children, label }: { children: ReactNode; label: string }) {
  return <div data-common-component="COMMON_DATA_TABLE" className="overflow-x-auto"><table className="w-full border-collapse text-left" aria-label={label}>{children}</table></div>;
}

export function CommonTimeline({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <CommonContentCard className="p-6" ><h3 className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-800">{title}</h3><div data-common-component="COMMON_STEP_FLOW" className="relative ml-1 space-y-6 border-l border-gray-100">{children}</div></CommonContentCard>;
}

export function CommonActionBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div data-common-component="COMMON_ACTION_BAR" className={`flex flex-wrap gap-2 ${className}`}>{children}</div>;
}
