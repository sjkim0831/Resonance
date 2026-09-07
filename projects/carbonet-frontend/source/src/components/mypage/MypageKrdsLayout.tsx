import type { ReactNode } from "react";

export function MypageKrdsLayout({
  breadcrumb,
  title,
  description,
  statusLabel,
  statusValue,
  sidebar,
  children,
}: {
  breadcrumb: string;
  title: string;
  description: string;
  statusLabel: string;
  statusValue: string;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-[calc(100vh-8rem)] bg-[#f4f6f8] pb-20" data-common-component="MYPAGE_KRDS_LAYOUT_V1" id="main-content">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <nav aria-label="현재 위치" className="text-sm font-bold text-slate-500">
          <a className="text-[#246beb] hover:underline" href="/home">홈</a>
          <span aria-hidden="true" className="mx-2">›</span>
          <span>마이페이지</span>
          <span aria-hidden="true" className="mx-2">›</span>
          <span aria-current="page">{breadcrumb}</span>
        </nav>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-sm lg:px-8" data-common-component="MYPAGE_PAGE_HEADER">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-black text-[#246beb]">마이페이지</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#052b57]">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span aria-hidden="true" className="material-symbols-outlined text-emerald-700">verified_user</span>
              <div><span className="block text-xs font-bold text-emerald-800">{statusLabel}</span><strong className="text-sm text-emerald-950">{statusValue}</strong></div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside data-common-component="MYPAGE_SIDE_NAVIGATION">{sidebar}</aside>
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-common-component="MYPAGE_CONTENT_PANEL">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
