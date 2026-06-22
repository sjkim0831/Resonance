import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  LOCALIZED_CONTENT,
  type LocalizedHomeContent,
  HOME_ENTRY_ASSETS
} from "./homeEntryContent";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HeaderMobileMenu,
  HomeFooter,
  CoreServiceGrid,
  DashboardSection,
  AnnouncementsAndSupportSection
} from "./HomeEntrySections";
import { HomePayload } from "./homeEntryTypes";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";

export function HomeLandingPage() {
  const en = isEnglish();
  const content = en ? LOCALIZED_CONTENT.en : LOCALIZED_CONTENT.ko;
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
    }
  );
  const sessionState = useFrontendSession();

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
      void sessionState.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [payloadState, sessionState]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const homeMenu = payload.homeMenu || [];

  useEffect(() => {
    logGovernanceScope("PAGE", "home-landing", {
      language: en ? "en" : "ko",
      isLoggedIn: Boolean(payload.isLoggedIn),
      mobileMenuOpen,
      menuCount: homeMenu.length
    });
  }, [en, homeMenu.length, mobileMenuOpen, payload.isLoggedIn]);

  return (
    <>
      <HomeInlineStyles en={en} />
      <div className="bg-white text-on-surface font-body-md">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>
        <div className="bg-surface border-b border-outline-variant">
          <div className="max-w-container-max mx-auto px-margin-desktop py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={content.govAlt} className="h-4" src={HOME_ENTRY_ASSETS.GOV_SYMBOL} />
              <span className="text-[13px] font-medium text-on-surface-variant">{content.govText}</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-on-surface-variant">
              <p>{content.govGuide}</p>
            </div>
          </div>
        </div>
        <header className="bg-surface-container-lowest border-b-2 border-primary sticky top-0 z-50 shadow-sm">
          <div className="max-w-container-max mx-auto px-margin-desktop">
            <div className="relative flex items-center h-16">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={content} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <LiveIndicator isLive={isLive} onToggle={() => setIsLive(!isLive)} en={en} />
                <div className="hidden xl:flex border border-outline-variant rounded-lg overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-on-surface-variant hover:bg-surface-container" : "bg-primary text-on-primary"}`} onClick={() => navigate("/home")}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-outline-variant ${en ? "bg-primary text-on-primary" : "bg-white text-on-surface-variant hover:bg-surface-container"}`} onClick={() => navigate("/en/home")}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-lg transition-colors focus-visible outline-none bg-primary text-on-primary hover:opacity-90" onClick={() => void sessionState.logout()}>{content.logout}</button>
                ) : (
                  <>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-lg transition-colors focus-visible outline-none bg-primary text-on-primary hover:opacity-90 items-center" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-lg transition-colors focus-visible outline-none bg-white text-primary border-2 border-primary hover:bg-primary/5 items-center" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
                  </>
                )}
                <button
                  id="mobile-menu-toggle"
                  className="xl:hidden w-11 h-11 rounded-lg border border-outline-variant text-primary flex items-center justify-center hover:bg-surface-container focus-visible"
                  type="button"
                  aria-controls="mobile-menu"
                  aria-expanded={mobileMenuOpen}
                  aria-label={content.openAllMenu}
                  onClick={() => setMobileMenuOpen((current) => !current)}
                >
                  <span className="material-symbols-outlined">menu</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <div id="mobile-menu" className={`${mobileMenuOpen ? "" : "hidden"} xl:hidden fixed inset-0 z-[70]`} aria-hidden={!mobileMenuOpen}>
          <button type="button" id="mobile-menu-backdrop" className="absolute inset-0 bg-black/50" aria-label={content.closeAllMenu} onClick={() => setMobileMenuOpen(false)} />
          <HeaderMobileMenu
            content={content}
            en={en}
            homeMenu={homeMenu}
            isLoggedIn={Boolean(payload.isLoggedIn)}
            onClose={() => setMobileMenuOpen(false)}
            onLogout={sessionState.logout}
          />
        </div>
        <main id="main-content">
          <LiveDataTicker en={en} isLive={isLive} />
          <Hero2Section content={content} isLive={isLive} />
          <LiveMonitoringDashboard en={en} isLive={isLive} />
          <StatsSection en={en} isLive={isLive} />
          <DashboardSection content={content} />
          <Features2Section />
          <LiveSensorGrid en={en} isLive={isLive} />
          <ProjectStatusMonitor en={en} isLive={isLive} />
          <NewsSection />
          <CoreServiceGrid content={content} />
          <SystemHealthMonitor en={en} isLive={isLive} />
          <AlertNotificationPanel en={en} />
          <TestimonialsSection />
          <AnnouncementsAndSupportSection content={content} />
        </main>
        <HomeFooter content={content} />
      </div>
    </>
  );
}

function LiveIndicator({ isLive, onToggle, en }: { isLive: boolean; onToggle: () => void; en: boolean }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isLive ? "bg-secondary text-white animate-pulse-glow" : "bg-surface-container text-on-surface-variant"}`}
      title={en ? "Toggle live updates" : "실시간 업데이트 토글"}
    >
      <span className={`w-2 h-2 rounded-full ${isLive ? "bg-white" : "bg-gray-400"}`}></span>
      {isLive ? (en ? "LIVE" : "실시간") : (en ? "PAUSED" : "일시정지")}
    </button>
  );
}

function Hero2Section({ content }: { content: LocalizedHomeContent; isLive?: boolean }) {
  return (
    <section className="relative h-[500px] flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img alt="CCUS Industrial Facility" className="w-full h-full object-cover" src={HOME_ENTRY_ASSETS.HERO_IMAGE} />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/50 to-primary/80"></div>
      </div>
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-20">
        <svg className="w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div className="relative z-10 w-full px-margin-desktop max-w-container-max mx-auto text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-accent/90 text-white px-4 py-2 rounded-full text-label-md font-bold mb-6 animate-fade-in-up">
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            {isEnglish() ? "Real-time Monitoring Available" : "실시간 모니터링 지원"}
          </div>
          <h1 className="text-display-lg mb-6 leading-tight animate-fade-in-up delay-100">
            <span className="text-white">{content.heroTitle}</span>
          </h1>
          <p className="text-primary-fixed text-body-lg mb-8 opacity-90 animate-fade-in-up delay-200">{content.heroDescription}</p>
          <div className="glass-effect p-2 rounded-xl flex items-center shadow-xl border border-white/20 max-w-2xl mx-auto animate-fade-in-up delay-300">
            <span className="material-symbols-outlined text-outline px-4">search</span>
            <input
              className="w-full border-none bg-transparent focus:ring-0 text-on-surface font-body-md py-3 placeholder:text-outline"
              placeholder={content.searchPlaceholder}
              type="text"
            />
            <button className="bg-primary text-on-primary px-8 py-3 rounded text-label-md hover:opacity-90 active:scale-95 transition-all whitespace-nowrap">
              {content.heroButton}
            </button>
          </div>
          <div className="flex items-center justify-center gap-8 mt-8 animate-fade-in-up delay-400">
            <a href="/home" className="flex items-center gap-2 text-white/80 hover:text-white text-body-sm font-medium transition-colors">
              <span className="material-symbols-outlined text-accent">play_circle</span>
              {isEnglish() ? "Watch Demo" : "데모 보기"}
            </a>
            <a href="/home" className="flex items-center gap-2 text-white/80 hover:text-white text-body-sm font-medium transition-colors">
              <span className="material-symbols-outlined text-accent">download</span>
              {isEnglish() ? "Download Guide" : "가이드 다운로드"}
            </a>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface to-transparent"></div>
    </section>
  );
}

function LiveDataTicker({ en, isLive }: { en: boolean; isLive: boolean }) {
  const [ticker, setTicker] = useState(0);
  
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setTicker(t => t + 1), 3000);
    return () => clearInterval(interval);
  }, [isLive]);

  const data = [
    { label: en ? "Total CO2 Captured" : "총 CO2 포집량", value: `${(1452890 + ticker * 12).toLocaleString()} tCO2`, change: "+0.08%" },
    { label: en ? "Active Sensors" : "활성 센서", value: `${2847 + ticker % 5}`, change: "+2" },
    { label: en ? "Data Points Today" : "오늘 데이터 포인트", value: `${(1245830 + ticker * 47).toLocaleString()}`, change: "+0.4%" },
    { label: en ? "System Uptime" : "시스템 가동률", value: "99.97%", change: "+0.01%" },
    { label: en ? "Active Projects" : "진행 중인 프로젝트", value: `${45 + ticker % 3}`, change: "+1" },
  ];

  return (
    <div className="bg-primary text-white py-3 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...data, ...data].map((item, i) => (
          <span key={i} className="mx-8 flex items-center gap-4 text-sm">
            <span className="text-white/70">{item.label}:</span>
            <span className="font-bold">{item.value}</span>
            <span className="text-secondary-light">({item.change})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function LiveMonitoringDashboard({ en, isLive }: { en: boolean; isLive: boolean }) {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const emissionsData = useMemo(() => {
    const base = 14820;
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      value: base + Math.floor(Math.random() * 800) + (isLive ? Math.sin(Date.now() / 10000) * 100 : 0)
    }));
  }, [isLive]);

  const maxValue = Math.max(...emissionsData.map(d => Math.abs(d.value)));

  return (
    <section className="py-8 px-margin-desktop max-w-container-max mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-accent"></div>
          <h2 className="font-headline-lg text-headline-lg">{en ? "Real-time Carbon Monitor" : "실시간 탄소 모니터"}</h2>
          {isLive && <span className="flex items-center gap-1 text-xs font-bold text-secondary"><span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>{en ? "Live" : "실시간"}</span>}
        </div>
        <div className="text-sm text-on-surface-variant">
          {time.toLocaleTimeString(en ? 'en-US' : 'ko-KR')}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-body-lg">{en ? "24-Hour Emission Trend" : "24시간 배출량 추이"}</h3>
            <span className="text-xs text-on-surface-variant">{en ? "Updated every 5 min" : "5분마다 업데이트"}</span>
          </div>
          <div className="h-48 flex items-end gap-1">
            {emissionsData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div 
                  className="w-full bg-gradient-to-t from-primary to-primary-fixed rounded-t transition-all duration-500"
                  style={{ height: `${Math.max(10, (Math.abs(d.value) / maxValue) * 100)}%` }}
                ></div>
                {i % 4 === 0 && <span className="text-[10px] text-on-surface-variant mt-1">{d.hour}</span>}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-xs text-on-surface-variant">
            <span>{en ? "Total today" : "오늘 총계"}: <b className="text-primary">{emissionsData.reduce((a, b) => a + b.value, 0).toLocaleString()} tCO2</b></span>
            <span>{en ? "Peak" : "최고"}: <b className="text-secondary">{Math.max(...emissionsData.map(d => d.value)).toLocaleString()} tCO2</b></span>
          </div>
        </div>
        <div className="space-y-4">
          <LiveMetricCard 
            title={en ? "Current Emission Rate" : "현재 배출률"} 
            value={emissionsData[emissionsData.length - 1]?.value.toLocaleString() || "0"}
            unit="tCO2/h"
            trend="up"
            color="primary"
          />
          <LiveMetricCard 
            title={en ? "Carbon Intensity" : "탄소 집약도"} 
            value={(0.42 + (isLive ? Math.random() * 0.02 : 0)).toFixed(3)}
            unit="kgCO2/$"
            trend="down"
            color="secondary"
          />
          <LiveMetricCard 
            title={en ? "Efficiency Index" : "효율성 지수"} 
            value={(87.3 + (isLive ? Math.random() * 2 : 0)).toFixed(1)}
            unit="%"
            trend="up"
            color="accent"
          />
        </div>
      </div>
    </section>
  );
}

function LiveMetricCard({ title, value, unit, trend, color }: { title: string; value: string; unit: string; trend: "up" | "down"; color: "primary" | "secondary" | "accent" }) {
  const colorClasses = { primary: "border-primary bg-primary/5", secondary: "border-secondary bg-secondary/5", accent: "border-accent bg-accent/5" };
  const textClasses = { primary: "text-primary", secondary: "text-secondary", accent: "text-accent" };

  return (
    <div className={`border-l-4 ${colorClasses[color]} rounded-r-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-on-surface-variant font-medium">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${textClasses[color]}`}>{value}</span>
        <span className="text-xs text-on-surface-variant">{unit}</span>
      </div>
      <div className={`flex items-center gap-1 mt-2 text-xs ${trend === "up" ? "text-secondary" : "text-primary"}`}>
        <span className="material-symbols-outlined text-sm">{trend === "up" ? "trending_up" : "trending_down"}</span>
        <span>{trend === "up" ? "+2.4%" : "-1.2%"} {isEnglish() ? "vs last hour" : "전시간 대비"}</span>
      </div>
    </div>
  );
}

function StatsSection({ en, isLive }: { en: boolean; isLive: boolean }) {
  const [stats, setStats] = useState([
    { value: "1,452,890", label: en ? "tCO2 Captured" : "CO2 포집량 (tCO2)", icon: "ecosystem" },
    { value: "45", label: en ? "Active Projects" : "진행 중인 프로젝트", icon: "folder_open" },
    { value: "124", label: en ? "Certified Companies" : "인증 기업", icon: "verified" },
    { value: "99.8%", label: en ? "System Uptime" : "시스템 가동률", icon: "cloud_done" }
  ]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setStats(prev => prev.map((s, i) => ({
        ...s,
        value: i === 0 ? (1452890 + Math.floor(Math.random() * 100)).toLocaleString() : s.value
      })));
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <section className="bg-surface-container-lowest py-12 border-b border-outline-variant">
      <div className="px-margin-desktop max-w-container-max mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border border-outline-variant hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'wght' 400, 'opsz' 24, 'FILL' 1" }}>{stat.icon}</span>
              </div>
              <div className="text-3xl font-bold text-primary mb-2">{stat.value}</div>
              <div className="text-on-surface-variant text-sm font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveSensorGrid({ en, isLive }: { en: boolean; isLive: boolean }) {
  const [sensors, setSensors] = useState([
    { id: "S-001", name: en ? "Seoul Plant A" : "서울 플랜트 A", status: "active", temp: 35.2, co2: 425.8, efficiency: 92.5 },
    { id: "S-002", name: en ? "Busan Complex" : "부산 복합단지", status: "active", temp: 38.7, co2: 398.2, efficiency: 88.3 },
    { id: "S-003", name: en ? "Daegu Factory" : "대구 공장", status: "warning", temp: 42.1, co2: 512.4, efficiency: 79.2 },
    { id: "S-004", name: en ? "Gwangju Center" : "광주 센터", status: "active", temp: 33.8, co2: 387.6, efficiency: 94.1 },
    { id: "S-005", name: en ? "Incheon Port" : "인천 항만", status: "active", temp: 29.4, co2: 356.9, efficiency: 91.8 },
    { id: "S-006", name: en ? "Daejeon Lab" : "대전 연구소", status: "maintenance", temp: 25.0, co2: 312.4, efficiency: 85.0 },
  ]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setSensors(prev => prev.map(s => ({
        ...s,
        temp: s.status !== "maintenance" ? +(s.temp + (Math.random() - 0.5) * 0.5).toFixed(1) : s.temp,
        co2: s.status !== "maintenance" ? +(s.co2 + (Math.random() - 0.5) * 5).toFixed(1) : s.co2,
        efficiency: s.status !== "maintenance" ? +(s.efficiency + (Math.random() - 0.5) * 0.3).toFixed(1) : s.efficiency,
      })));
    }, 2000);
    return () => clearInterval(interval);
  }, [isLive]);

  const statusColors: Record<string, string> = {
    active: "bg-secondary text-white",
    warning: "bg-accent text-white",
    maintenance: "bg-gray-400 text-white"
  };

  return (
    <section className="py-stack-lg px-margin-desktop max-w-container-max mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-2 h-8 bg-primary"></div>
        <h2 className="font-headline-lg text-headline-lg">{en ? "Live Sensor Network" : "실시간 센서 네트워크"}</h2>
        {isLive && <span className="px-2 py-1 bg-secondary/10 text-secondary text-xs font-bold rounded-full">{en ? "6 SENSORS ONLINE" : "6개 센서 온라인"}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sensors.map((sensor) => (
          <div key={sensor.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs text-on-surface-variant">{sensor.id}</span>
                <h4 className="font-bold text-body-md">{sensor.name}</h4>
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusColors[sensor.status]}`}>
                {sensor.status.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xs text-on-surface-variant mb-1">{en ? "Temp" : "온도"}</div>
                <div className={`text-lg font-bold ${sensor.temp > 40 ? "text-accent" : "text-primary"}`}>{sensor.temp}°C</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-on-surface-variant mb-1">CO2</div>
                <div className="text-lg font-bold text-primary">{sensor.co2}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-on-surface-variant mb-1">{en ? "Efficiency" : "효율"}</div>
                <div className={`text-lg font-bold ${sensor.efficiency > 90 ? "text-secondary" : "text-accent"}`}>{sensor.efficiency}%</div>
              </div>
            </div>
            <div className="mt-4 h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${sensor.efficiency > 90 ? "bg-secondary" : sensor.efficiency > 80 ? "bg-accent" : "bg-error"}`}
                style={{ width: `${sensor.efficiency}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectStatusMonitor({ en, isLive }: { en: boolean; isLive: boolean }) {
  const [projects, setProjects] = useState([
    { id: "P-2025-001", name: en ? "Gyeonggi CCUS Storage" : "경기 CCUS 저장소", phase: "construction", progress: 68, co2Capacity: "50,000", status: "on_track" },
    { id: "P-2025-002", name: en ? "Jeonnam Marine Capture" : "전남 해상 포집", phase: "operation", progress: 100, co2Capacity: "120,000", status: "active" },
    { id: "P-2025-003", name: en ? "Chungbuk Industrial" : "충북 산업Capturing", phase: "planning", progress: 25, co2Capacity: "35,000", status: "delayed" },
    { id: "P-2025-004", name: en ? "Gyeongnam Green Hub" : "경남 그린 허브", phase: "operation", progress: 100, co2Capacity: "85,000", status: "active" },
  ]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setProjects(prev => prev.map(p => ({
        ...p,
        progress: p.phase !== "planning" ? Math.min(100, p.progress + (Math.random() > 0.7 ? 0.1 : 0)) : p.progress
      })));
    }, 5000);
    return () => clearInterval(interval);
  }, [isLive]);

  const phaseLabels: Record<string, string> = { construction: en ? "Construction" : "建设中", operation: en ? "Operation" : "운영中", planning: en ? "Planning" : "計画中" };
  const statusColors: Record<string, string> = { on_track: "text-secondary bg-secondary/10", active: "text-primary bg-primary/10", delayed: "text-accent bg-accent/10" };

  return (
    <section className="bg-surface py-stack-lg border-t border-outline-variant">
      <div className="px-margin-desktop max-w-container-max mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-8 bg-secondary"></div>
          <h2 className="font-headline-lg text-headline-lg">{en ? "Project Status Monitor" : "프로젝트 현황 모니터"}</h2>
          {isLive && <span className="material-symbols-outlined text-secondary animate-pulse">monitoring</span>}
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-container">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant">{en ? "Project ID" : "프로젝트 ID"}</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant">{en ? "Name" : "명칭"}</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant">{en ? "Phase" : "단계"}</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant">{en ? "Capacity" : "용량"}</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant">{en ? "Progress" : "진행률"}</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-on-surface-variant">{en ? "Status" : "상태"}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t border-outline-variant hover:bg-surface-container transition-colors">
                  <td className="px-6 py-4 text-sm font-mono">{project.id}</td>
                  <td className="px-6 py-4 text-sm font-medium">{project.name}</td>
                  <td className="px-6 py-4 text-sm">{phaseLabels[project.phase]}</td>
                  <td className="px-6 py-4 text-sm">{project.co2Capacity} tCO2/yr</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${project.progress}%` }}></div>
                      </div>
                      <span className="text-sm font-bold">{project.progress.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusColors[project.status]}`}>
                      {project.status === "on_track" ? (en ? "ON TRACK" : "정상") : project.status === "active" ? (en ? "ACTIVE" : "활성") : (en ? "DELAYED" : "지연")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SystemHealthMonitor({ en, isLive }: { en: boolean; isLive: boolean }) {
  const [health, setHealth] = useState({
    database: { status: "healthy", latency: 12, connections: 47 },
    api: { status: "healthy", latency: 45, rps: 1243 },
    storage: { status: "healthy", usage: 68, iops: 2847 },
    network: { status: "healthy", bandwidth: 847, packetLoss: 0.01 }
  });

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setHealth({
        database: { ...health.database, latency: Math.floor(10 + Math.random() * 10), connections: 40 + Math.floor(Math.random() * 20) },
        api: { ...health.api, latency: Math.floor(30 + Math.random() * 30), rps: 1200 + Math.floor(Math.random() * 200) },
        storage: { ...health.storage, usage: 65 + Math.floor(Math.random() * 10), iops: 2500 + Math.floor(Math.random() * 500) },
        network: { ...health.network, bandwidth: 800 + Math.floor(Math.random() * 150), packetLoss: Math.random() * 0.05 }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive]);

  const getStatusColor = (status: string) => status === "healthy" ? "text-secondary bg-secondary/10" : "text-accent bg-accent/10";

  return (
    <section className="py-stack-lg px-margin-desktop max-w-container-max mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-2 h-8 bg-primary"></div>
        <h2 className="font-headline-lg text-headline-lg">{en ? "System Health Monitor" : "시스템 상태 모니터"}</h2>
        {isLive && <span className="text-xs font-bold text-secondary">{en ? "ALL SYSTEMS OPERATIONAL" : "전 시스템 정상 운영"}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">database</span>
              <span className="font-bold">Database</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getStatusColor(health.database.status)}`}>{health.database.status.toUpperCase()}</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-on-surface-variant">{en ? "Latency" : "지연시간"}</span><span className="font-bold">{health.database.latency}ms</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">{en ? "Connections" : "연결수"}</span><span className="font-bold">{health.database.connections}</span></div>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">api</span>
              <span className="font-bold">API Gateway</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getStatusColor(health.api.status)}`}>{health.api.status.toUpperCase()}</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-on-surface-variant">{en ? "Latency" : "지연시간"}</span><span className="font-bold">{health.api.latency}ms</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">RPS</span><span className="font-bold">{health.api.rps.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">storage</span>
              <span className="font-bold">{en ? "Storage" : "저장소"}</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getStatusColor(health.storage.status)}`}>{health.storage.status.toUpperCase()}</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-on-surface-variant">{en ? "Usage" : "사용량"}</span><span className="font-bold">{health.storage.usage}%</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">IOPS</span><span className="font-bold">{health.storage.iops.toLocaleString()}</span></div>
          </div>
          <div className="mt-3 h-2 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${health.storage.usage}%` }}></div>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">network_check</span>
              <span className="font-bold">{en ? "Network" : "네트워크"}</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getStatusColor(health.network.status)}`}>{health.network.status.toUpperCase()}</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-on-surface-variant">{en ? "Bandwidth" : "대역폭"}</span><span className="font-bold">{health.network.bandwidth} Mbps</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">{en ? "Packet Loss" : "패킷 손실"}</span><span className="font-bold">{health.network.packetLoss.toFixed(2)}%</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AlertNotificationPanel({ en }: { en: boolean }) {
  const alerts = [
    { id: 1, type: "warning", title: en ? "High emission detected" : "높은 배출량 감지", location: "Daegu Factory", time: "2 min ago", read: false },
    { id: 2, type: "info", title: en ? "Sensor calibration due" : "센서 교정 예정", location: "Incheon Port", time: "15 min ago", read: false },
    { id: 3, type: "success", title: en ? "Project milestone reached" : "프로젝트 마일스톤 달성", location: "Jeonnam Marine", time: "1 hour ago", read: true },
    { id: 4, type: "warning", title: en ? "Maintenance window" : "정비 창", location: "Daejeon Lab", time: "2 hours ago", read: true },
  ];

  const typeIcons: Record<string, string> = { warning: "warning", info: "info", success: "check_circle", error: "error" };
  const typeColors: Record<string, string> = { warning: "text-accent bg-accent/10", info: "text-primary bg-primary/10", success: "text-secondary bg-secondary/10", error: "text-error bg-error/10" };

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <section className="py-stack-lg px-margin-desktop max-w-container-max mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-accent"></div>
          <h2 className="font-headline-lg text-headline-lg">{en ? "Live Alerts" : "실시간 알림"}</h2>
          {unreadCount > 0 && <span className="px-2 py-1 bg-accent text-white text-xs font-bold rounded-full">{unreadCount} {en ? "NEW" : "신규"}</span>}
        </div>
        <button className="text-xs font-bold text-primary hover:underline">{en ? "View All" : "전체 보기"}</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alerts.map((alert) => (
          <div key={alert.id} className={`flex gap-4 p-4 rounded-xl border border-outline-variant hover:shadow-md transition-all cursor-pointer ${alert.read ? "bg-white" : "bg-primary-fixed/20"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeColors[alert.type]}`}>
              <span className="material-symbols-outlined text-lg">{typeIcons[alert.type]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-sm truncate">{alert.title}</h4>
                {!alert.read && <span className="w-2 h-2 rounded-full bg-accent shrink-0"></span>}
              </div>
              <p className="text-xs text-on-surface-variant">{alert.location}</p>
              <p className="text-[10px] text-on-surface-variant mt-1">{alert.time}</p>
            </div>
            <button className="text-on-surface-variant hover:text-primary">
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features2Section() {
  const en = isEnglish();
  const features = [
    { icon: "psychology", title: en ? "AI-Powered Analysis" : "AI 기반 분석", description: en ? "Advanced machine learning models for precise carbon emission forecasting." : "정밀한 탄소 배출 예측을 위한 고급 머신러닝 모델.", badge: en ? "NEW" : "신규" },
    { icon: "dashboard", title: en ? "Real-time Monitoring" : "실시간 모니터링", description: en ? "Live dashboard with IoT sensor integration for 24/7 tracking." : "24시간 환경 데이터 추적을 위한 IoT 센서 통합 실시간 대시보드.", badge: en ? "POPULAR" : "인기" },
    { icon: "security", title: en ? "Enterprise Security" : "기업 보안", description: en ? "Bank-grade encryption and compliance with carbon accounting standards." : "은행 수준의 암호화와 국제 탄소 회계 표준 준수.", badge: null },
    { icon: "integration_instructions", title: en ? "API Integration" : "API 연동", description: en ? "RESTful APIs and webhooks for enterprise system integration." : "기존 기업 시스템과 원활한 연동을 위한 RESTful API 및 웹훅.", badge: en ? "NEW" : "신규" }
  ];

  return (
    <section className="py-stack-lg px-margin-desktop max-w-container-max mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-2 h-8 bg-primary"></div>
        <h2 className="font-headline-lg text-headline-lg">{en ? "Enhanced Features" : "강화된 기능"}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {features.map((feature, index) => (
          <div key={index} className="bg-surface-container-lowest border border-outline-variant p-8 rounded-2xl hover:shadow-xl hover:-translate-y-2 transition-all cursor-pointer group relative overflow-hidden">
            {feature.badge && (
              <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold ${feature.badge === "NEW" ? "bg-accent text-white" : "bg-secondary text-white"}`}>
                {feature.badge}
              </div>
            )}
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform animate-float" style={{ animationDelay: `${index * 100}ms` }}>
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'wght' 400, 'opsz' 24, 'FILL' 1" }}>{feature.icon}</span>
            </div>
            <h3 className="text-headline-md mb-3">{feature.title}</h3>
            <p className="text-on-surface-variant text-body-sm leading-relaxed line-clamp-2">{feature.description}</p>
            <div className="flex items-center gap-2 font-bold text-label-md mt-6 text-primary">
              {en ? "Learn more" : "더 알아보기"} <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NewsSection() {
  const en = isEnglish();
  const news = [
    { category: en ? "Policy Update" : "정책 업데이트", title: en ? "2025 Carbon Tax Regulation Changes" : "2025 탄소세 규정 변경 사항", date: "2025-08-20", image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop" },
    { category: en ? "Technology" : "기술", title: en ? "Next-Gen CCUS Technology Breakthrough" : "차세대 CCUS 기술 혁신", date: "2025-08-18", image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop" },
    { category: en ? "Event" : "이벤트", title: en ? "Annual CCUS Summit 2025" : "제4회 연례 CCUS 서밋 2025", date: "2025-08-15", image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop" }
  ];

  return (
    <section className="bg-surface-container py-stack-lg border-t border-outline-variant">
      <div className="px-margin-desktop max-w-container-max mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-accent"></div>
            <h2 className="font-headline-lg text-headline-lg">{en ? "Latest News" : "최신 뉴스"}</h2>
          </div>
          <a href="/home" className="flex items-center gap-2 text-primary text-label-md hover:underline font-bold">
            {en ? "View All" : "전체 보기"} <span className="material-symbols-outlined">arrow_forward</span>
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {news.map((item, index) => (
            <a href="/home" key={index} className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-outline-variant hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="relative h-48 overflow-hidden">
                <img alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src={item.image} />
                <div className="absolute top-4 left-4 bg-accent text-white px-3 py-1 rounded-full text-[10px] font-bold">{item.category}</div>
              </div>
              <div className="p-6">
                <p className="text-on-surface-variant text-xs mb-2">{item.date}</p>
                <h3 className="font-bold text-body-md group-hover:text-primary transition-colors line-clamp-2">{item.title}</h3>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const en = isEnglish();
  const testimonials = [
    { quote: en ? "This platform has revolutionized how we track carbon emissions. The AI analysis is incredibly accurate." : "이 플랫폼은 탄소 배출량 추적 및 보고 방식을 혁신했습니다. AI 분석이 매우 정확합니다.", author: "Kim Sung-ho", role: en ? "Environmental Director, Hyundai Steel" : "현대제철 환경담당관", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" },
    { quote: en ? "Real-time monitoring helped us reduce our carbon footprint by 23% in just one year." : "실시간 모니터링 기능 덕분에 단 1년 만에 탄소 발자국을 23% 감소시킬 수 있었습니다.", author: "Park Ji-young", role: en ? "Sustainability Manager, Samsung SDI" : "삼성SDI 지속가능성매니저", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face" },
    { quote: en ? "Seamless API integration with our systems. Support team is exceptionally responsive." : "기존 시스템과의API 연동이 원활합니다. 지원팀의 대응도 매우 빠릅니다.", author: "Lee Min-seok", role: en ? "CTO, Korea Carbon Solutions" : "한국탄소솔루션 CTO", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" }
  ];

  return (
    <section className="py-stack-lg px-margin-desktop max-w-container-max mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-2 h-8 bg-secondary"></div>
        <h2 className="font-headline-lg text-headline-lg">{en ? "What Our Partners Say" : "合作伙伴的评价"}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {testimonials.map((item, index) => (
          <div key={index} className="bg-surface-container-lowest border border-outline-variant p-8 rounded-2xl hover:shadow-xl transition-all cursor-pointer group">
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (<span key={star} className="material-symbols-outlined text-accent text-xl">star</span>))}
            </div>
            <p className="text-on-surface text-body-md mb-6 leading-relaxed italic">"{item.quote}"</p>
            <div className="flex items-center gap-4">
              <img alt={item.author} className="w-12 h-12 rounded-full object-cover" src={item.avatar} />
              <div>
                <div className="font-bold text-body-sm text-on-surface">{item.author}</div>
                <div className="text-on-surface-variant text-xs">{item.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HomeInlineStyles(_props: { en: boolean }) {
  return (
    <style>{`
      :root {
        --primary: #001e40;
        --secondary: #1b6d24;
        --surface: #f8f9fa;
        --surface-container-lowest: #ffffff;
        --surface-container: #edeeef;
        --surface-container-high: #e7e8e9;
        --surface-container-highest: #e1e3e4;
        --on-primary: #ffffff;
        --on-surface: #191c1d;
        --on-surface-variant: #43474f;
        --outline: #737780;
        --outline-variant: #c3c6d1;
        --primary-container: #003366;
        --secondary-container: #a0f399;
        --primary-fixed: #d5e3ff;
        --primary-fixed-dim: #a7c8ff;
        --error: #ba1a1a;
        --accent: #f59e0b;
        --accent-light: #fbbf24;
      }
      body { font-family: 'Inter', 'Noto Sans KR', sans-serif; -webkit-font-smoothing: antialiased; }
      .skip-link { position: absolute; top: -100px; left: 0; background: var(--primary); color: white; padding: 12px; z-index: 100; transition: top .2s ease; }
      .skip-link:focus { top: 0; }
      .focus-visible:focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }
      .material-symbols-outlined { font-variation-settings: 'wght' 400, 'opsz' 24; font-size: 24px; vertical-align: middle; }
      .glass-effect { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px); }
      .font-headline-lg { font-family: 'Public Sans', sans-serif; font-size: 32px; font-weight: 700; line-height: 1.3; }
      .font-headline-md { font-family: 'Public Sans', sans-serif; font-size: 24px; font-weight: 600; line-height: 1.4; }
      .font-display-lg { font-family: 'Public Sans', sans-serif; font-size: 48px; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; }
      .font-label-md { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; line-height: 1; letter-spacing: 0.05em; }
      .font-body-lg { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 400; line-height: 1.6; }
      .font-body-md { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 400; line-height: 1.6; }
      .font-body-sm { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400; line-height: 1.5; }
      .max-w-container-max { max-width: 1280px; }
      .px-margin-desktop { padding-left: 40px; padding-right: 40px; }
      .py-stack-lg { padding-top: 32px; padding-bottom: 32px; }
      .gap-gutter { gap: 24px; }
      .rounded-lg { border-radius: 0.25rem; }
      .rounded-xl { border-radius: 0.5rem; }
      .rounded-2xl { border-radius: 0.75rem; }
      .text-headline-lg { font-family: 'Public Sans', sans-serif; font-size: 32px; font-weight: 700; line-height: 1.3; color: var(--primary); }
      .text-headline-md { font-family: 'Public Sans', sans-serif; font-size: 24px; font-weight: 600; line-height: 1.4; color: var(--on-surface); }
      .text-display-lg { font-family: 'Public Sans', sans-serif; font-size: 48px; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; color: white; }
      .text-label-md { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; line-height: 1; letter-spacing: 0.05em; color: var(--on-surface-variant); }
      .text-body-lg { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 400; line-height: 1.6; color: white; }
      .text-body-md { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 400; line-height: 1.6; color: var(--on-surface); }
      .text-body-sm { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400; line-height: 1.5; color: var(--on-surface-variant); }
      .bg-primary { background-color: var(--primary); }
      .bg-secondary { background-color: var(--secondary); }
      .bg-surface { background-color: var(--surface); }
      .bg-surface-container-lowest { background-color: var(--surface-container-lowest); }
      .bg-surface-container { background-color: var(--surface-container); }
      .bg-surface-container-high { background-color: var(--surface-container-high); }
      .bg-primary-fixed { background-color: var(--primary-fixed); }
      .bg-white { background-color: white; }
      .bg-accent { background-color: var(--accent); }
      .text-primary { color: var(--primary); }
      .text-secondary { color: var(--secondary); }
      .text-accent { color: var(--accent); }
      .text-on-primary { color: var(--on-primary); }
      .text-on-surface { color: var(--on-surface); }
      .text-on-surface-variant { color: var(--on-surface-variant); }
      .text-white { color: white; }
      .border-primary { border-color: var(--primary); }
      .border-outline-variant { border-color: var(--outline-variant); }
      .border-b-2 { border-bottom-width: 2px; }
      .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
      .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); }
      .hover\\:shadow-xl:hover { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); }
      .hover\\:-translate-y-1:hover { transform: translateY(-4px); }
      .hover\\:-translate-y-2:hover { transform: translateY(-8px); }
      .transition-all { transition: all 0.2s ease; }
      .transition-colors { transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease; }
      .line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
      .animate-pulse-glow { animation: pulse-glow 2s infinite; }
      @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(27, 109, 36, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(27, 109, 36, 0); } }
      @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      .animate-marquee { animation: marquee 30s linear infinite; }
      @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
      .animate-float { animation: float 3s ease-in-out infinite; }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
      .delay-100 { animation-delay: 100ms; }
      .delay-200 { animation-delay: 200ms; }
      .delay-300 { animation-delay: 300ms; }
      .delay-400 { animation-delay: 400ms; }
      body.mobile-menu-open { overflow: hidden; }
      @media (max-width: 768px) { .px-margin-desktop { padding-left: 16px; padding-right: 16px; } .text-display-lg { font-size: 24px; } }
    `}</style>
  );
}
