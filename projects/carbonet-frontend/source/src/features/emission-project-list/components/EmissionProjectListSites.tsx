import { useMemo, useState } from "react";
import { DedicatedSite, GeneralSite } from "./EmissionProjectListTypes";
import { StatusBadge, SparklineChart, ScopeBadge } from "./EmissionProjectListShared";

interface SitesSectionProps {
  en: boolean;
  dedicatedSites: DedicatedSite[];
  generalSites: GeneralSite[];
  adminSiteManagementHref: string;
  onSiteClick: (siteId: string) => void;
  onActionClick: (siteId: string, action: string) => void;
}

export function EmissionProjectListSites({
  en,
  dedicatedSites,
  generalSites,
  adminSiteManagementHref,
  onSiteClick,
  onActionClick
}: SitesSectionProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "normal" | "delayed" | "verifying" | "pending">("all");

  const filteredGeneralSites = useMemo(() => {
    if (activeFilter === "all") return generalSites;
    return generalSites.filter((site) => site.status === activeFilter);
  }, [generalSites, activeFilter]);

  const filterOptions = [
    { key: "all", label: en ? "All" : "전체", count: generalSites.length },
    { key: "normal", label: en ? "Normal" : "정상", count: generalSites.filter((s) => s.status === "normal").length },
    { key: "delayed", label: en ? "Delayed" : "지연", count: generalSites.filter((s) => s.status === "delayed").length },
    { key: "verifying", label: en ? "Verifying" : "검증중", count: generalSites.filter((s) => s.status === "verifying").length },
    { key: "pending", label: en ? "Pending" : "대기", count: generalSites.filter((s) => s.status === "pending").length }
  ] as const;

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12" data-help-id="emission-project-site-cards" id="emission-sources">
      {/* Dedicated Sites */}
      <DedicatedSitesSection
        en={en}
        sites={dedicatedSites}
        adminSiteManagementHref={adminSiteManagementHref}
        onSiteClick={onSiteClick}
        onActionClick={onActionClick}
      />

      {/* General Sites */}
      <div className="mt-16">
        <GeneralSitesSection
          en={en}
          sites={filteredGeneralSites}
          allSitesCount={generalSites.length}
          filterOptions={filterOptions}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          adminSiteManagementHref={adminSiteManagementHref}
          onSiteClick={onSiteClick}
          onActionClick={onActionClick}
        />
      </div>
    </section>
  );
}

interface DedicatedSitesSectionProps {
  en: boolean;
  sites: DedicatedSite[];
  adminSiteManagementHref: string;
  onSiteClick: (siteId: string) => void;
  onActionClick: (siteId: string, action: string) => void;
}

function DedicatedSitesSection({
  en,
  sites,
  adminSiteManagementHref,
  onSiteClick,
  onActionClick
}: DedicatedSitesSectionProps) {
  return (
    <>
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              push_pin
            </span>
            {en ? "Dedicated Sites" : "핵심 관리 배출지"}
          </h2>
          <p className="text-[var(--kr-gov-text-secondary)] text-sm">
            {en
              ? "Pinned top-priority sites managed directly by the overseer."
              : "감독관님이 직접 고정(Pin)한 최우선 관리 대상입니다."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100 items-center gap-2.5">
            <span className="material-symbols-outlined text-indigo-500 text-[18px]">bolt</span>
            <span className="text-[11px] font-bold text-indigo-700 leading-none">
              {en ? "AI Assistant Active" : "AI 비서 활성화"}
            </span>
          </div>
          <a
            className="text-xs font-bold text-gray-500 hover:text-[var(--kr-gov-blue)] flex items-center gap-1.5 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
            href={adminSiteManagementHref}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            {en ? "Manage" : "관리"}
          </a>
        </div>
      </div>

      {/* Site Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {sites.map((site) => (
          <DedicatedSiteCard
            key={site.id}
            site={site}
            en={en}
            onSiteClick={() => onSiteClick(site.id)}
            onActionClick={(action) => onActionClick(site.id, action)}
          />
        ))}
      </div>
    </>
  );
}

interface DedicatedSiteCardProps {
  site: DedicatedSite;
  en: boolean;
  onSiteClick: () => void;
  onActionClick: (action: string) => void;
}

function DedicatedSiteCard({ site, en, onSiteClick, onActionClick }: DedicatedSiteCardProps) {
  const statusMap = {
    normal: { label: en ? "Normal Operation" : "정상 운영", class: "status-badge-normal" },
    delayed: { label: en ? "Input Delayed" : "입력 지연", class: "status-badge-delayed" },
    verifying: { label: en ? "Verification In Progress" : "검증 진행중", class: "status-badge-verifying" },
    pending: { label: en ? "Pending" : "대기", class: "status-badge-pending" }
  };
  const status = statusMap[site.status];

  const accentColors: Record<string, string> = {
    "border-t-[var(--kr-gov-blue)]": "#00378b",
    "border-t-orange-500": "#f97316",
    "border-t-blue-500": "#3b82f6"
  };
  const chartColor =
    accentColors[Object.keys(accentColors).find((k) => site.accentClass.includes(k.replace("border-t-", ""))) || ""] || "#3b82f6";

  const noticeIconClass =
    site.noticeIcon === "warning"
      ? "text-red-500 animate-pulse"
      : site.noticeIcon === "verified"
      ? "text-blue-500"
      : "text-indigo-500";

  return (
    <div className={`site-card border-t-4 ${site.accentClass}`}>
      {/* Card Header */}
      <div className="p-6 pb-4 bg-gradient-to-b from-gray-50/50 to-transparent">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={site.status} label={status.label} />
            <span className="text-[10px] font-mono font-bold text-gray-400">#{site.id}</span>
          </div>
          <button
            className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${site.pinClass}`}
            type="button"
            aria-label={en ? "Unpin site" : "핀 해제"}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              push_pin
            </span>
          </button>
        </div>
        <h3
          className="text-lg font-black text-gray-900 mb-2 hover:text-[var(--kr-gov-blue)] transition-colors cursor-pointer"
          onClick={onSiteClick}
        >
          {en ? site.titleEn : site.title}
        </h3>
      </div>

      {/* Notice Banner */}
      <div className={`px-6 py-3 flex items-center justify-between ${site.noticeClass}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`material-symbols-outlined text-[18px] shrink-0 ${noticeIconClass}`}>
            {site.noticeIcon}
          </span>
          <span className="text-[11px] font-semibold text-gray-700 truncate">
            {en ? site.noticeEn : site.notice}
          </span>
        </div>
        <a
          className="text-[10px] font-black text-[var(--kr-gov-blue)] hover:underline shrink-0 ml-2"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onActionClick(site.noticeLink);
          }}
        >
          {en ? site.noticeLinkEn : site.noticeLink}
        </a>
      </div>

      {/* Card Body */}
      <div className="p-6 space-y-6">
        {/* Emission Value */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              {en ? site.valueLabelEn : site.valueLabel}
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-4xl font-black tracking-tighter ${site.valueTone}`}>
                {site.currentEmission}
              </span>
              <span className="text-sm font-bold text-gray-400">tCO₂</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {en ? "Target:" : "목표:"} {site.monthlyTarget}
            </div>
          </div>
          <div className="w-36 h-16">
            <SparklineChart path={site.sparkline} color={chartColor} />
          </div>
        </div>

        {/* Scope Breakdown */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <ScopeBadge scope="scope1" />
            <div className="text-sm font-bold text-gray-700 mt-1">{site.scope1Emission}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <ScopeBadge scope="scope2" />
            <div className="text-sm font-bold text-gray-700 mt-1">{site.scope2Emission}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <ScopeBadge scope="scope3" />
            <div className="text-sm font-bold text-gray-700 mt-1">{site.scope3Emission}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {site.actions.map((action) => (
            <button
              className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 ${
                action.solid
                  ? "bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20 text-white hover:from-orange-600 hover:to-orange-700"
                  : "bg-gray-50 hover:bg-[var(--kr-gov-blue)] text-gray-600 hover:text-white"
              }`}
              key={action.label}
              onClick={() => onActionClick(action.label)}
              type="button"
            >
              <span className="material-symbols-outlined mb-1.5 text-[20px]">{action.icon}</span>
              <span className="text-[11px] font-bold">{en ? action.labelEn : action.label}</span>
            </button>
          ))}
        </div>

        {/* Activity Feed */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[var(--kr-gov-blue)] rounded-full" />
            {en ? "Recent Activity" : "최근 활동"}
          </p>
          <div className="space-y-3">
            {site.activity.slice(0, 2).map((item, idx) => (
              <div className="relative pl-4" key={idx}>
                <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-gray-300" />
                {idx < 1 && <div className="absolute left-[3px] top-4 w-px h-[calc(100%+12px)] bg-gray-100" />}
                <p className="text-[12px] font-semibold text-gray-700 leading-snug">
                  {en ? item.titleEn : item.title}
                </p>
                <span className="text-[10px] text-gray-400">{en ? item.metaEn : item.meta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface GeneralSitesSectionProps {
  en: boolean;
  sites: GeneralSite[];
  allSitesCount: number;
  filterOptions: readonly { key: string; label: string; count?: number }[];
  activeFilter: string;
  onFilterChange: (filter: "all" | "normal" | "delayed" | "verifying" | "pending") => void;
  adminSiteManagementHref: string;
  onSiteClick: (siteId: string) => void;
  onActionClick: (siteId: string, action: string) => void;
}

function GeneralSitesSection({
  en,
  sites,
  allSitesCount,
  filterOptions,
  activeFilter,
  onFilterChange,
  adminSiteManagementHref,
  onSiteClick,
  onActionClick
}: GeneralSitesSectionProps) {
  return (
    <>
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-black flex items-center gap-2 text-gray-800">
          {en ? "General Sites" : "일반 배출지"}
          <span className="text-sm font-normal text-gray-400 ml-2 bg-gray-100 px-2.5 py-1 rounded-full">
            {en ? `${allSitesCount} sites` : `${allSitesCount}개소`}
          </span>
        </h2>
        <div className="flex gap-2">
          {filterOptions.map((filter) => (
            <button
              key={filter.key}
              className={`filter-tab ${
                activeFilter === filter.key ? "filter-tab-active" : "filter-tab-inactive"
              }`}
              onClick={() =>
                onFilterChange(filter.key as "all" | "normal" | "delayed" | "verifying" | "pending")
              }
              type="button"
            >
              {filter.label}
              {filter.count !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 bg-black/10 rounded-full text-[10px]">
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {sites.map((site) => (
          <GeneralSiteCard
            key={site.id}
            site={site}
            en={en}
            onSiteClick={() => onSiteClick(site.id)}
            onActionClick={() => onActionClick(site.id, site.action)}
          />
        ))}

        {/* Add New Site Card */}
        <a
          className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center p-6 hover:border-[var(--kr-gov-blue)] hover:bg-white transition-all group min-h-[200px]"
          href={adminSiteManagementHref}
        >
          <span className="material-symbols-outlined text-gray-300 group-hover:text-[var(--kr-gov-blue)] mb-3 transition-colors" style={{ fontSize: 36 }}>
            add_circle
          </span>
          <span className="text-xs font-bold text-gray-400 group-hover:text-[var(--kr-gov-blue)] transition-colors">
            {en ? "Register Additional Site" : "배출지 추가 등록"}
          </span>
        </a>
      </div>
    </>
  );
}

interface GeneralSiteCardProps {
  site: GeneralSite;
  en: boolean;
  onSiteClick: () => void;
  onActionClick: () => void;
}

function GeneralSiteCard({ site, en, onSiteClick, onActionClick }: GeneralSiteCardProps) {
  const statusMap = {
    normal: { label: en ? "Normal" : "정상", class: "status-badge-normal" },
    delayed: { label: en ? "Input Pending" : "입력대기", class: "status-badge-delayed" },
    verifying: { label: en ? "Verifying" : "검증중", class: "status-badge-verifying" },
    pending: { label: en ? "Pending" : "대기", class: "status-badge-pending" }
  };
  const status = statusMap[site.status];

  return (
    <div className="group bg-white rounded-xl border border-gray-200 hover:border-[var(--kr-gov-blue)] hover:shadow-lg transition-all duration-200 overflow-hidden">
      <div className="p-4 bg-gradient-to-b from-gray-50/50 to-transparent border-b border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[10px] font-mono font-bold text-gray-400">#{site.id}</span>
          <button className="text-gray-300 hover:text-[var(--kr-gov-blue)] transition-colors" type="button">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              push_pin
            </span>
          </button>
        </div>
        <h4
          className="font-bold text-gray-800 group-hover:text-[var(--kr-gov-blue)] transition-colors cursor-pointer"
          onClick={onSiteClick}
        >
          {en ? site.titleEn : site.title}
        </h4>
      </div>

      <div className="p-4 space-y-3">
        {/* Emission */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">{en ? "Emission" : "배출량"}</span>
          <span className="font-black text-gray-900">{site.emission}</span>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">{en ? "Status" : "상태"}</span>
          <StatusBadge status={site.status} label={status.label} />
        </div>

        {/* Data Completeness */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">{en ? "Data" : "데이터"}</span>
          <span className="font-medium text-gray-700">{site.dataCompleteness}</span>
        </div>

        {/* Action Button */}
        <button
          className={`w-full py-2.5 text-xs font-bold border rounded-lg transition-colors ${site.actionClass}`}
          onClick={onActionClick}
          type="button"
        >
          {en ? site.actionEn : site.action}
        </button>
      </div>
    </div>
  );
}