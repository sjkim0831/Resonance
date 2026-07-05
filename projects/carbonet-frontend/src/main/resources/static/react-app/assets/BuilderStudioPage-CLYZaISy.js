import{r as React}from"./vendor-react-DQCpd17N.js";import{t as Je,m as Ke}from"./environmentManagementShared-BgVdZ24Y.js";
const h=React.createElement;
const AdminShell=React.lazy(()=>import("./environmentManagementHub-BwcwD2IN.js").then(m=>({default:m.A})));
const c={icon:"material-symbols-outlined text-[18px] leading-none",btn:"inline-flex items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100",primary:"inline-flex items-center justify-center gap-1.5 rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 active:bg-blue-900",green:"inline-flex items-center justify-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700",danger:"inline-flex items-center justify-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700",input:"w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500",label:"mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500",panel:"rounded-lg border border-slate-200 bg-white shadow-sm",panelHead:"flex items-center justify-between border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700",tab:"px-4 py-2 text-sm font-medium transition rounded-t-lg",tabActive:"bg-white text-blue-700 border border-slate-200 border-b-white -mb-px",tabInactive:"text-slate-500 hover:text-slate-700 hover:bg-slate-50"};
function Icon({name}){return h("span",{className:c.icon},name)}
function Field({label,value,onChange,area,disabled}){return h("label",{className:"block"},h("span",{className:c.label},label),area?h("textarea",{className:c.input+" min-h-[72px]",value:value||"",onChange:function(e){onChange(e.target.value)},disabled:disabled}):h("input",{className:c.input,value:value||"",onChange:function(e){onChange(e.target.value)},disabled:disabled}))}
function groupFor(code,path){code=String(code||"").toUpperCase();path=String(path||"");if(code.startsWith("A006")||path.indexOf("/system/")>=0)return"system";if(code.startsWith("A001"))return"environment";if(code.startsWith("A002"))return"emission";if(code.startsWith("A003"))return"trade";if(code.startsWith("A004"))return"content";if(code.startsWith("A005"))return"external";if(code.startsWith("HMENU"))return"user";return"other"}
var GROUP_LABELS={"all":"전체","system":"시스템","environment":"환경","emission":"배출","trade":"거래","content":"콘텐츠","external":"외부","user":"사용자","other":"기타"};
var GROUP_ICONS={"system":"settings","environment":"eco","emission":"cloud","trade":"swap_horiz","content":"article","external":"link","user":"person","other":"more_horiz"};
var DESIGN_TOKENS=[{key:"--gov-primary",label:"Primary",default:"#1a56db"},{key:"--gov-primary-hover",label:"Primary Hover",default:"#1e429f"},{key:"--gov-surface",label:"Surface",default:"#ffffff"},{key:"--gov-background",label:"Background",default:"#f4f7fa"},{key:"--gov-border",label:"Border",default:"#e2e8f0"},{key:"--gov-text",label:"Text",default:"#1e293b"},{key:"--gov-text-muted",label:"Muted Text",default:"#64748b"},{key:"--gov-radius",label:"Radius",default:"6px"},{key:"--gov-shadow",label:"Shadow",default:"0 1px 3px rgba(0,0,0,.08)"}];
var GOV_COMPONENTS=[{id:"btn-primary",name:"GovButton",nameKo:"기본 버튼",category:"primitive",className:".gov-btn",preview:"버튼"},{id:"btn-ghost",name:"GovButton Ghost",nameKo:"보조 버튼",category:"primitive",className:".gov-btn-ghost",preview:"보조"},{id:"btn-danger",name:"GovButton Danger",nameKo:"위험 버튼",category:"primitive",className:".gov-btn-danger",preview:"삭제"},{id:"input-text",name:"GovInput",nameKo:"텍스트 입력",category:"form",className:".gov-input",preview:null},{id:"select-basic",name:"GovSelect",nameKo:"선택",category:"form",className:".gov-select",preview:null},{id:"textarea",name:"GovTextarea",nameKo:"텍스트 영역",category:"form",className:".gov-textarea",preview:null},{id:"table",name:"GovTable",nameKo:"데이터 테이블",category:"data",className:".data-table",preview:null},{id:"card",name:"GovCard",nameKo:"카드",category:"layout",className:".gov-card",preview:null},{id:"modal",name:"GovModal",nameKo:"모달",category:"overlay",className:".gov-modal",preview:null},{id:"toolbar",name:"GovToolbar",nameKo:"툴바",category:"layout",className:".gov-toolbar",preview:null},{id:"pagination",name:"GovPagination",nameKo:"페이지네이션",category:"navigation",className:".gov-pagination",preview:null},{id:"metric-card",name:"GovMetricCard",nameKo:"메트릭 카드",category:"data",className:".gov-metric-card",preview:null},{id:"search-bar",name:"GovSearchBar",nameKo:"검색바",category:"form",className:".gov-search-bar",preview:null},{id:"status-success",name:"GovStatus Success",nameKo:"성공 알림",category:"feedback",className:".gov-status-success",preview:"✅ 성공"},{id:"status-error",name:"GovStatus Error",nameKo:"에러 알림",category:"feedback",className:".gov-status-error",preview:"❌ 에러"},{id:"status-warning",name:"GovStatus Warning",nameKo:"경고 알림",category:"feedback",className:".gov-status-warning",preview:"⚠️ 경고"}];
var COMPONENT_CATEGORIES={"all":"전체","primitive":"기본","form":"폼","data":"데이터","layout":"레이아웃","overlay":"오버레이","navigation":"내비게이션","feedback":"피드백"};
function App(){
var _s=React.useState,_e=React.useEffect,_m=React.useMemo,_r=React.useRef;
var _at=_s("preview"),activeTab=_at[0],setActiveTab=_at[1];
var _sc=_s([]),screens=_sc[0],setScreens=_sc[1];
var _sel=_s(null),selectedScreen=_sel[0],setSelectedScreen=_sel[1];
var _sr=_s(""),searchTerm=_sr[0],setSearchTerm=_sr[1];
var _gf=_s("all"),groupFilter=_gf[0],setGroupFilter=_gf[1];
var _cf=_s("all"),compFilter=_cf[0],setCompFilter=_cf[1];
var _tk=_s({}),tokens=_tk[0],setTokens=_tk[1];
var _ld=_s(true),loading=_ld[0],setLoading=_ld[1];
var _err=_s(null),error=_err[0],setError=_err[1];
var _em=_s(null),editMeta=_em[0],setEditMeta=_em[1];
var _ast=_s([]),assets=_ast[0],setAssets=_ast[1];
var _purl=_s(""),previewUrl=_purl[0],setPreviewUrl=_purl[1];
var iframeRef=_r(null);
_e(function(){
  var basePath=window.__REACT_APP_BASE_PATH||"/assets/react/";
  Promise.all([
    fetch(basePath+"api/page-component-map.json").then(function(r){return r.json()}).catch(function(){return{byMenuCode:{}}}),
    fetch(basePath+"api/build-studio-asset-inventory.json").then(function(r){return r.json()}).catch(function(){return{assets:[]}})
  ]).then(function(results){
    var map=results[0];var inv=results[1];
    var source=map&&map.byMenuCode||map||{};
    var list=Object.entries(source).map(function(entry){
      var menuCode=entry[0];var v=entry[1]||{};
      var route=v.routePath||v.menuUrl||"";
      return{menuCode:menuCode,menuName:v.pageName||v.menuName||v.pageId||menuCode,menuUrl:route,pageId:v.pageId||"",group:groupFor(menuCode,route),components:v.components||[],componentCount:v.componentCount||0,manifest:v};
    }).filter(function(s){return s.menuUrl||s.menuCode}).sort(function(a,b){return String(a.menuCode).localeCompare(String(b.menuCode))});
    setScreens(list);
    setAssets((inv&&inv.assets)||[]);
    if(list.length>0)setSelectedScreen(list[0]);
    setLoading(false);
  }).catch(function(e){setError(String(e));setLoading(false)});
  var initTokens={};
  DESIGN_TOKENS.forEach(function(t){initTokens[t.key]=t.default});
  setTokens(initTokens);
},[]);
var filteredScreens=_m(function(){
  var list=screens;
  if(groupFilter!=="all")list=list.filter(function(s){return s.group===groupFilter});
  if(searchTerm){var q=searchTerm.toLowerCase();list=list.filter(function(s){return(s.menuCode+" "+s.menuName+" "+s.menuUrl).toLowerCase().indexOf(q)>=0})}
  return list;
},[screens,groupFilter,searchTerm]);
var filteredComponents=_m(function(){
  if(compFilter==="all")return GOV_COMPONENTS;
  return GOV_COMPONENTS.filter(function(c){return c.category===compFilter});
},[compFilter]);
function selectScreen(s){setSelectedScreen(s);if(s&&s.menuUrl){setPreviewUrl(s.menuUrl)}setEditMeta(null)}
function handleTokenChange(key,val){var next=Object.assign({},tokens);next[key]=val;setTokens(next)}
function startEditMeta(){if(selectedScreen)setEditMeta(JSON.parse(JSON.stringify(selectedScreen)))}
function saveEditMeta(){if(editMeta){var idx=screens.findIndex(function(s){return s.menuCode===editMeta.menuCode});if(idx>=0){var next=screens.slice();next[idx]=editMeta;setScreens(next);setSelectedScreen(editMeta)}setEditMeta(null)}}
function renderTabBar(){
  var tabs=[{id:"preview",label:"프리뷰",icon:"monitor"},{id:"components",label:"컴포넌트 / 테마",icon:"palette"},{id:"screeninfo",label:"화면 정보",icon:"info"}];
  return h("div",{className:"flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4"},
    tabs.map(function(t){return h("button",{key:t.id,className:c.tab+" "+(activeTab===t.id?c.tabActive:c.tabInactive),onClick:function(){setActiveTab(t.id)}},h(Icon,{name:t.icon}),h("span",{className:"ml-1.5"},t.label))})
  );
}
function renderScreenList(){
  return h("div",{className:"flex h-full flex-col border-r border-slate-200 bg-white",style:{width:"320px",minWidth:"320px"}},
    h("div",{className:c.panelHead},h("span",null,"화면 목록 ("+filteredScreens.length+")"),h("span",{className:"text-slate-400"},screens.length+"개 전체")),
    h("div",{className:"px-3 py-2 border-b border-slate-100"},
      h("input",{className:c.input,placeholder:"화면 검색...",value:searchTerm,onChange:function(e){setSearchTerm(e.target.value)}})),
    h("div",{className:"flex flex-wrap gap-1 px-3 py-2 border-b border-slate-100"},
      Object.keys(GROUP_LABELS).map(function(g){return h("button",{key:g,className:"px-2 py-0.5 text-[10px] rounded-full font-medium transition "+(groupFilter===g?"bg-blue-100 text-blue-700":"text-slate-500 hover:bg-slate-100"),onClick:function(){setGroupFilter(g)}},GROUP_LABELS[g])})),
    h("div",{className:"flex-1 overflow-auto"},
      filteredScreens.map(function(s){
        var isActive=selectedScreen&&selectedScreen.menuCode===s.menuCode;
        return h("button",{key:s.menuCode,className:"block w-full border-b border-slate-50 px-3 py-2 text-left transition "+(isActive?"bg-blue-50 border-l-2 border-l-blue-600":"hover:bg-slate-50"),onClick:function(){selectScreen(s)}},
          h("div",{className:"flex items-center justify-between"},
            h("span",{className:"text-xs font-semibold text-slate-700 truncate"},s.menuName),
            h("span",{className:"ml-2 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"},s.componentCount||0)),
          h("div",{className:"mt-0.5 text-[10px] text-slate-400 truncate"},s.menuCode+" · "+s.menuUrl))
      }))
  );
}
function renderPreviewTab(){
  return h("div",{className:"flex h-full"},
    renderScreenList(),
    h("div",{className:"flex-1 flex flex-col min-w-0"},
      h("div",{className:c.panelHead},
        h("span",null,selectedScreen?selectedScreen.menuName+" 프리뷰":"화면을 선택하세요"),
        selectedScreen?h("div",{className:"flex gap-2"},
          h("button",{className:c.btn,onClick:function(){if(iframeRef.current)iframeRef.current.src=iframeRef.current.src}},h(Icon,{name:"refresh"}),"새로고침"),
          h("a",{className:c.btn,href:selectedScreen.menuUrl,target:"_blank",rel:"noopener"},h(Icon,{name:"open_in_new"}),"새 탭")
        ):null),
      selectedScreen&&selectedScreen.menuUrl?
        h("iframe",{ref:iframeRef,src:selectedScreen.menuUrl,className:"flex-1 w-full border-0 bg-white",title:selectedScreen.menuName,sandbox:"allow-same-origin allow-scripts allow-forms allow-popups"}):
        h("div",{className:"flex-1 flex items-center justify-center text-slate-400"},
          h("div",{className:"text-center"},h(Icon,{name:"monitor"}),h("p",{className:"mt-2 text-sm"},"좌측에서 화면을 선택하면 프리뷰가 표시됩니다")))
    )
  );
}
function renderComponentsTab(){
  return h("div",{className:"flex h-full"},
    h("div",{className:"flex flex-col border-r border-slate-200 bg-white",style:{width:"360px",minWidth:"360px"}},
      h("div",{className:c.panelHead},h("span",null,"Gov 디자인 시스템 컴포넌트"),h("span",{className:"text-slate-400"},filteredComponents.length+"개")),
      h("div",{className:"flex flex-wrap gap-1 px-3 py-2 border-b border-slate-100"},
        Object.keys(COMPONENT_CATEGORIES).map(function(cat){return h("button",{key:cat,className:"px-2 py-0.5 text-[10px] rounded-full font-medium transition "+(compFilter===cat?"bg-blue-100 text-blue-700":"text-slate-500 hover:bg-slate-100"),onClick:function(){setCompFilter(cat)}},COMPONENT_CATEGORIES[cat])})),
      h("div",{className:"flex-1 overflow-auto p-3"},
        filteredComponents.map(function(comp){return h("div",{key:comp.id,className:"mb-2 rounded-lg border border-slate-200 p-3 hover:border-blue-300 hover:shadow-sm transition"},
          h("div",{className:"flex items-center justify-between"},
            h("div",null,
              h("div",{className:"text-sm font-semibold text-slate-800"},comp.nameKo),
              h("div",{className:"text-[10px] text-slate-400"},comp.name)),
            h("span",{className:"rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"},comp.category)),
          h("div",{className:"mt-2 flex items-center justify-between"},
            h("code",{className:"text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded"},comp.className),
            comp.preview?h("span",{className:"text-xs"},comp.preview):null)
        )}))
    ),
    h("div",{className:"flex-1 flex flex-col min-w-0 overflow-auto"},
      h("div",{className:c.panelHead},h("span",null,"디자인 토큰"),h("button",{className:c.btn,onClick:function(){var initTokens={};DESIGN_TOKENS.forEach(function(t){initTokens[t.key]=t.default});setTokens(initTokens)}},h(Icon,{name:"restart_alt"}),"초기화")),
      h("div",{className:"p-4 space-y-3"},
        DESIGN_TOKENS.map(function(t){return h("div",{key:t.key,className:"flex items-center gap-3"},
          t.key.indexOf("color")>=0||t.key.indexOf("primary")>=0||t.key.indexOf("surface")>=0||t.key.indexOf("background")>=0||t.key.indexOf("border")>=0||t.key.indexOf("text")>=0?
            h("input",{type:"color",value:tokens[t.key]||t.default,onChange:function(e){handleTokenChange(t.key,e.target.value)},className:"h-8 w-8 rounded border border-slate-200 cursor-pointer"}):
            h("div",{className:"h-8 w-8 rounded border border-slate-200 bg-slate-50 flex items-center justify-center"},h(Icon,{name:"tune"})),
          h("div",{className:"flex-1"},
            h("div",{className:"text-xs font-medium text-slate-700"},t.label),
            h("div",{className:"flex items-center gap-2 mt-0.5"},
              h("code",{className:"text-[10px] text-slate-400"},t.key),
              h("input",{className:c.input+" max-w-[160px] text-xs",value:tokens[t.key]||"",onChange:function(e){handleTokenChange(t.key,e.target.value)}})))
        )})),
      h("div",{className:c.panelHead+" mt-4"},h("span",null,"프리뷰")),
      h("div",{className:"p-4",style:{"--gov-primary":tokens["--gov-primary"]||"#1a56db","--gov-radius":tokens["--gov-radius"]||"6px"}},
        h("div",{className:"rounded-lg border border-slate-200 p-6 space-y-4",style:{background:tokens["--gov-background"]||"#f4f7fa"}},
          h("div",{className:"flex gap-2"},
            h("button",{className:"px-4 py-2 rounded text-sm font-semibold text-white",style:{background:tokens["--gov-primary"]||"#1a56db",borderRadius:tokens["--gov-radius"]||"6px"}},"Primary 버튼"),
            h("button",{className:"px-4 py-2 rounded border text-sm font-semibold",style:{borderColor:tokens["--gov-border"]||"#e2e8f0",color:tokens["--gov-text"]||"#1e293b",borderRadius:tokens["--gov-radius"]||"6px"}},"Secondary 버튼")),
          h("input",{className:"w-full rounded border px-3 py-2 text-sm",style:{borderColor:tokens["--gov-border"]||"#e2e8f0",borderRadius:tokens["--gov-radius"]||"6px"},placeholder:"입력 필드 프리뷰"}),
          h("div",{className:"rounded border p-4",style:{borderColor:tokens["--gov-border"]||"#e2e8f0",background:tokens["--gov-surface"]||"#ffffff",borderRadius:tokens["--gov-radius"]||"6px"}},
            h("div",{className:"text-sm font-semibold mb-2",style:{color:tokens["--gov-text"]||"#1e293b"}},"카드 프리뷰"),
            h("div",{className:"text-xs",style:{color:tokens["--gov-text-muted"]||"#64748b"}},"이 카드는 현재 디자인 토큰 설정을 실시간으로 반영합니다."))))
    )
  );
}
function renderScreenInfoTab(){
  var scr=editMeta||selectedScreen;
  return h("div",{className:"flex h-full"},
    renderScreenList(),
    h("div",{className:"flex-1 flex flex-col min-w-0 overflow-auto"},
      h("div",{className:c.panelHead},
        h("span",null,scr?scr.menuName+" 정보":"화면을 선택하세요"),
        scr?h("div",{className:"flex gap-2"},
          editMeta?h(React.Fragment,null,
            h("button",{className:c.green,onClick:saveEditMeta},h(Icon,{name:"save"}),"저장"),
            h("button",{className:c.btn,onClick:function(){setEditMeta(null)}},h(Icon,{name:"close"}),"취소"))
          :h("button",{className:c.primary,onClick:startEditMeta},h(Icon,{name:"edit"}),"수정")
        ):null),
      scr?h("div",{className:"p-4 space-y-4"},
        h("div",{className:c.panel},
          h("div",{className:c.panelHead},h("span",null,"기본 정보")),
          h("div",{className:"p-4 grid grid-cols-2 gap-3"},
            h(Field,{label:"메뉴 코드",value:scr.menuCode,onChange:function(v){if(editMeta)setEditMeta(Object.assign({},editMeta,{menuCode:v}))},disabled:!editMeta}),
            h(Field,{label:"페이지 ID",value:scr.pageId,onChange:function(v){if(editMeta)setEditMeta(Object.assign({},editMeta,{pageId:v}))},disabled:!editMeta}),
            h(Field,{label:"화면 이름",value:scr.menuName,onChange:function(v){if(editMeta)setEditMeta(Object.assign({},editMeta,{menuName:v}))},disabled:!editMeta}),
            h(Field,{label:"라우트 경로",value:scr.menuUrl,onChange:function(v){if(editMeta)setEditMeta(Object.assign({},editMeta,{menuUrl:v}))},disabled:!editMeta}),
            h(Field,{label:"그룹",value:scr.group,onChange:function(){},disabled:true}),
            h(Field,{label:"컴포넌트 수",value:String(scr.componentCount||0),onChange:function(){},disabled:true}))),
        h("div",{className:c.panel},
          h("div",{className:c.panelHead},h("span",null,"컴포넌트 인스턴스 ("+((scr.components&&scr.components.length)||0)+")")),
          scr.components&&scr.components.length>0?
            h("div",{className:"overflow-x-auto"},
              h("table",{className:"w-full text-xs"},
                h("thead",null,h("tr",{className:"bg-slate-50"},
                  h("th",{className:"px-4 py-2 text-left font-semibold text-slate-600"},"Component ID"),
                  h("th",{className:"px-4 py-2 text-left font-semibold text-slate-600"},"Instance Key"),
                  h("th",{className:"px-4 py-2 text-left font-semibold text-slate-600"},"Layout Zone"),
                  h("th",{className:"px-4 py-2 text-left font-semibold text-slate-600"},"Props Summary"))),
                h("tbody",null,scr.components.map(function(comp,i){return h("tr",{key:i,className:"border-t border-slate-100 hover:bg-slate-50"},
                  h("td",{className:"px-4 py-2 font-mono text-blue-600"},comp.componentId),
                  h("td",{className:"px-4 py-2 text-slate-600"},comp.instanceKey||"-"),
                  h("td",{className:"px-4 py-2"},h("span",{className:"rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 text-[10px] font-medium"},comp.layoutZone||"default")),
                  h("td",{className:"px-4 py-2 text-slate-500"},Array.isArray(comp.propsSummary)?comp.propsSummary.join(", "):"-"))})))):
            h("div",{className:"p-6 text-center text-sm text-slate-400"},"컴포넌트가 등록되지 않은 화면입니다.")),
        scr.manifest?h("div",{className:c.panel},
          h("div",{className:c.panelHead},h("span",null,"Raw Manifest"),h("button",{className:c.btn,onClick:function(){navigator.clipboard&&navigator.clipboard.writeText(JSON.stringify(scr.manifest,null,2))}},h(Icon,{name:"content_copy"}),"복사")),
          h("pre",{className:"p-4 text-[10px] text-slate-600 bg-slate-50 overflow-auto max-h-[300px] font-mono"},JSON.stringify(scr.manifest,null,2))):null
      ):h("div",{className:"flex-1 flex items-center justify-center text-slate-400"},
        h("div",{className:"text-center"},h(Icon,{name:"info"}),h("p",{className:"mt-2 text-sm"},"좌측에서 화면을 선택하면 상세 정보가 표시됩니다")))
    )
  );
}
if(loading){return h("div",{className:"flex items-center justify-center h-64"},h("div",{className:"text-center"},h("div",{className:"animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto"}),h("p",{className:"mt-3 text-sm text-slate-500"},"빌더 스튜디오 로딩 중...")))}
return h(React.Suspense,{fallback:h("div",{className:"flex items-center justify-center h-64"},h("div",{className:"animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"}))},
  h(AdminShell,{breadcrumbs:[{label:"홈",href:"/admin/"},{label:"시스템"},{label:"빌더 스튜디오"}],sidebarVariant:"system",title:"빌더 스튜디오",subtitle:"화면 빌더 워크스페이스 – 화면 구성, 컴포넌트 관리 및 디자인 토큰 편집",actions:h("div",{className:"flex gap-2"},h("button",{className:c.btn,onClick:function(){setLoading(true);setTimeout(function(){window.location.reload()},100)}},h(Icon,{name:"refresh"}),"새로고침"),h("span",{className:"text-xs text-slate-400"},screens.length+"개 화면"))},
    error?h("div",{className:"mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"},error,h("button",{className:"ml-2 font-bold",onClick:function(){setError(null)}},"×")):null,
    h("div",{className:"flex flex-col",style:{height:"calc(100vh - 180px)"}},
      renderTabBar(),
      h("div",{className:"flex-1 min-h-0 overflow-hidden"},
        activeTab==="preview"?renderPreviewTab():
        activeTab==="components"?renderComponentsTab():
        renderScreenInfoTab()))
  ));
}
export{App as BuilderStudioPage,App as default};
