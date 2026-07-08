import { useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import {
  AdminInput,
  AdminSearchBar,
  AdminSearchField,
  AdminSearchSection,
  AdminSelect,
  AdminTextarea,
  MemberButton,
  MemberSectionToolbar,
  PageStatusNotice,
  SummaryMetricCard,
  useAdminSearch,
} from "../admin-ui/common";
import { MemberModal } from "../admin-ui/Modal";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import {
  fetchThemeList,
  fetchTheme,
  createTheme,
  updateTheme,
  deleteTheme as apiDeleteTheme,
  exportTheme,
  type ThemeToken,
  type ComponentStyle,
  type ThemeDetail,
  type ThemeExport,
} from "../../lib/api/platform";

type TokenType = "color" | "size" | "density" | "font" | "text" | "spacing" | "border" | "shadow";

const COMPONENT_CATEGORIES = [
  { id: "primitive", labelKo: "기본", labelEn: "Primitive" },
  { id: "form", labelKo: "폼", labelEn: "Form" },
  { id: "navigation", labelKo: "네비게이션", labelEn: "Navigation" },
  { id: "layout", labelKo: "레이아웃", labelEn: "Layout" },
  { id: "feedback", labelKo: "피드백", labelEn: "Feedback" },
  { id: "data", labelKo: "데이터", labelEn: "Data" },
  { id: "media", labelKo: "미디어", labelEn: "Media" },
  { id: "overlay", labelKo: "오버레이", labelEn: "Overlay" },
];

const DEFAULT_TOKENS: ThemeToken[] = [
  { id: "1", key: "primary", labelKo: "주 색상", labelEn: "Primary Color", value: "#00378b", type: "color", category: "color" },
  { id: "2", key: "primaryHover", labelKo: "주 색상 호버", labelEn: "Primary Hover", value: "#002d72", type: "color", category: "color" },
  { id: "3", key: "accent", labelKo: "강조 색상", labelEn: "Accent", value: "#0f766e", type: "color", category: "color" },
  { id: "4", key: "success", labelKo: "성공 색상", labelEn: "Success", value: "#039855", type: "color", category: "color" },
  { id: "5", key: "warning", labelKo: "경고 색상", labelEn: "Warning", value: "#b45309", type: "color", category: "color" },
  { id: "6", key: "error", labelKo: "에러 색상", labelEn: "Error", value: "#d32f2f", type: "color", category: "color" },
  { id: "7", key: "surface", labelKo: "표면 색상", labelEn: "Surface", value: "#f8fbff", type: "color", category: "color" },
  { id: "8", key: "background", labelKo: "배경 색상", labelEn: "Background", value: "#ffffff", type: "color", category: "color" },
  { id: "9", key: "border", labelKo: "테두리 색상", labelEn: "Border", value: "#d9d9d9", type: "color", category: "border" },
  { id: "10", key: "textPrimary", labelKo: "주 текст", labelEn: "Text Primary", value: "#1a1a1a", type: "color", category: "typography" },
  { id: "11", key: "textSecondary", labelKo: "보조 текст", labelEn: "Text Secondary", value: "#4d4d4d", type: "color", category: "typography" },
  { id: "12", key: "radius", labelKo: "모서리 반경", labelEn: "Radius", value: "8px", type: "size", category: "border" },
  { id: "13", key: "radiusSm", labelKo: "소 모서리", labelEn: "Radius Small", value: "4px", type: "size", category: "border" },
  { id: "14", key: "radiusLg", labelKo: "대 모서리", labelEn: "Radius Large", value: "12px", type: "size", category: "border" },
  { id: "15", key: "fontSize", labelKo: "글꼴 크기", labelEn: "Font Size", value: "14px", type: "size", category: "typography" },
  { id: "16", key: "fontFamily", labelKo: "글꼴", labelEn: "Font Family", value: "system-ui, -apple-system, sans-serif", type: "text", category: "typography" },
  { id: "17", key: "spacing", labelKo: "간격", labelEn: "Spacing", value: "8px", type: "spacing", category: "spacing" },
  { id: "18", key: "shadow", labelKo: "그림자", labelEn: "Shadow", value: "0 1px 3px rgba(0,0,0,0.12)", type: "text", category: "effect" },
];

const DEFAULT_COMPONENTS: ComponentStyle[] = [
  { id: "btn-primary", name: "GovButton", nameKo: "버튼", description: "기본 버튼 컴포넌트", category: "primitive", layer: "primitive", className: ".gov-btn", elementId: "gov-btn-primary", styles: { minHeight: "44px", padding: "10px 20px", borderRadius: "var(--radius)", fontSize: "14px", fontWeight: "700" }, useAt: "Y" },
  { id: "btn-secondary", name: "GovButton Secondary", nameKo: "보조 버튼", description: "보조 버튼 컴포넌트", category: "primitive", layer: "primitive", className: ".gov-btn-ghost", elementId: "gov-btn-secondary", styles: { minHeight: "44px", padding: "10px 20px", borderRadius: "var(--radius)", fontSize: "14px", fontWeight: "700", border: "1px solid var(--border)", background: "white" }, useAt: "Y" },
  { id: "btn-danger", name: "GovButton Danger", nameKo: "위험 버튼", description: "위험 작업용 버튼", category: "primitive", layer: "primitive", className: ".gov-btn-danger", elementId: "gov-btn-danger", styles: { minHeight: "44px", padding: "10px 20px", borderRadius: "var(--radius)", fontSize: "14px", fontWeight: "700", background: "#d32f2f", color: "white" }, useAt: "Y" },
  { id: "input-text", name: "GovInput", nameKo: "텍스트 입력", description: "기본 텍스트 입력 필드", category: "form", layer: "primitive", className: ".gov-input", elementId: "gov-input", styles: { minHeight: "40px", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "14px" }, useAt: "Y" },
  { id: "select-basic", name: "GovSelect", nameKo: "선택", description: "드롭다운 선택 컴포넌트", category: "form", layer: "primitive", className: ".gov-select", elementId: "gov-select", styles: { minHeight: "40px", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "14px" }, useAt: "Y" },
  { id: "textarea-basic", name: "GovTextarea", nameKo: "텍스트 영역", description: "여러 줄 텍스트 입력", category: "form", layer: "primitive", className: ".gov-textarea", elementId: "gov-textarea", styles: { padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: "14px", minHeight: "100px" }, useAt: "Y" },
  { id: "table-basic", name: "GovTable", nameKo: "테이블", description: "데이터 테이블", category: "data", layer: "primitive", className: ".data-table", elementId: "data-table", styles: { width: "100%", borderCollapse: "collapse", fontSize: "14px" }, useAt: "Y" },
  { id: "table-header", name: "GovTableHeader", nameKo: "테이블 헤더", description: "테이블 헤더 행", category: "data", layer: "primitive", className: ".gov-table-header", elementId: "gov-table-header", styles: { background: "#f8fbff", fontWeight: "700", padding: "12px 16px", borderBottom: "1px solid var(--border)" }, useAt: "Y" },
  { id: "modal-basic", name: "GovModal", nameKo: "모달", description: "모달 대화상자", category: "overlay", layer: "primitive", className: ".gov-modal", elementId: "gov-modal", styles: { borderRadius: "var(--radius)", background: "white", boxShadow: "var(--shadow)" }, useAt: "Y" },
  { id: "card-basic", name: "GovCard", nameKo: "카드", description: "카드 컨테이너", category: "layout", layer: "layout", className: ".gov-card", elementId: "gov-card", styles: { borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "white", padding: "16px" }, useAt: "Y" },
  { id: "toolbar-basic", name: "GovToolbar", nameKo: "툴바", description: "툴바 컨테이너", category: "layout", layer: "composite", className: ".gov-toolbar", elementId: "gov-toolbar", styles: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }, useAt: "Y" },
  { id: "pagination-basic", name: "GovPagination", nameKo: "페이지네이션", description: "페이지네이션控件", category: "navigation", layer: "composite", className: ".gov-pagination", elementId: "gov-pagination", styles: { display: "flex", alignItems: "center", gap: "4px" }, useAt: "Y" },
  { id: "status-success", name: "GovStatusNotice Success", nameKo: "성공 알림", description: "성공 상태 알림", category: "feedback", layer: "feedback", className: ".gov-status-success", elementId: "gov-status-success", styles: { borderRadius: "var(--radius)", padding: "12px 16px", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }, useAt: "Y" },
  { id: "status-error", name: "GovStatusNotice Error", nameKo: "에러 알림", description: "에러 상태 알림", category: "feedback", layer: "feedback", className: ".gov-status-error", elementId: "gov-status-error", styles: { borderRadius: "var(--radius)", padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }, useAt: "Y" },
  { id: "status-warning", name: "GovStatusNotice Warning", nameKo: "경고 알림", description: "경고 상태 알림", category: "feedback", layer: "feedback", className: ".gov-status-warning", elementId: "gov-status-warning", styles: { borderRadius: "var(--radius)", padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }, useAt: "Y" },
  { id: "status-info", name: "GovStatusNotice Info", nameKo: "정보 알림", description: "정보 상태 알림", category: "feedback", layer: "feedback", className: ".gov-status-info", elementId: "gov-status-info", styles: { borderRadius: "var(--radius)", padding: "12px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" }, useAt: "Y" },
  { id: "metric-card", name: "GovMetricCard", nameKo: "메트릭 카드", description: "지표 표시 카드", category: "data", layer: "composite", className: ".gov-metric-card", elementId: "gov-metric-card", styles: { borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: "16px", background: "var(--surface)" }, useAt: "Y" },
  { id: "diagnostic-card", name: "GovDiagnosticCard", nameKo: "진단 카드", description: "진단 정보 표시 카드", category: "data", layer: "composite", className: ".gov-diagnostic-card", elementId: "gov-diagnostic-card", styles: { borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: "16px" }, useAt: "Y" },
  { id: "warning-panel", name: "GovWarningPanel", nameKo: "경고 패널", description: "경고 메시지 패널", category: "feedback", layer: "feedback", className: ".gov-warning-panel", elementId: "gov-warning-panel", styles: { borderRadius: "var(--radius)", border: "1px solid #fde68a", background: "#fffbeb", padding: "12px 16px" }, useAt: "Y" },
  { id: "key-value-panel", name: "GovKeyValuePanel", nameKo: "키-값 패널", description: "키-값 정보 표시 패널", category: "layout", layer: "layout", className: ".gov-key-value-panel", elementId: "gov-key-value-panel", styles: { borderRadius: "var(--radius)", border: "1px solid #e2e8f0", background: "#f8fafc", padding: "16px" }, useAt: "Y" },
  { id: "search-bar", name: "GovSearchBar", nameKo: "검색바", description: "검색 입력 바", category: "form", layer: "composite", className: ".gov-search-bar", elementId: "gov-search-bar", styles: { minHeight: "40px", padding: "10px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)", display: "flex", alignItems: "center" }, useAt: "Y" },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getCurrentUserId() {
  return localStorage.getItem("themeOwnerId") || (() => {
    const id = "user_" + generateId();
    localStorage.setItem("themeOwnerId", id);
    return id;
  })();
}

const STORAGE_KEY = "themeBuilderData";

function loadThemesFromLocal(): ThemeDetail[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load themes from localStorage:", e);
  }
  return [];
}

function saveThemesToLocal(themes: ThemeDetail[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
}

function createDefaultThemeDetail(): ThemeDetail {
  const now = new Date().toISOString();
  return {
    theme: {
      id: generateId(),
      name: "Default Theme",
      ownerId: getCurrentUserId(),
      createdAt: now,
      updatedAt: now,
    },
    tokens: [...DEFAULT_TOKENS],
    components: DEFAULT_COMPONENTS.map(c => ({ ...c, id: generateId() })),
  };
}

export function ThemeBuilderPanel({ en }: { en: boolean }) {
  const [themeDetails, setThemeDetails] = useState<ThemeDetail[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"tokens" | "components" | "preview">("tokens");
  const [copied, setCopied] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [componentSearch, setComponentSearch] = useState("");
  const [editingComponent, setEditingComponent] = useState<ComponentStyle | null>(null);
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComponent, setNewComponent] = useState<Partial<ComponentStyle>>({
    name: "",
    nameKo: "",
    description: "",
    category: "primitive",
    layer: "primitive",
    styles: {},
    useAt: "Y",
  });

  const selectedTheme = themeDetails.find(t => t.theme.id === selectedThemeId);

  useEffect(() => {
    async function loadThemes() {
      try {
        setLoading(true);
        setError(null);
        const themes = await fetchThemeList();
        if (themes && themes.length > 0) {
          const details = await Promise.all(themes.map(t => fetchTheme(t.id)));
          setThemeDetails(details);
          setSelectedThemeId(details[0].theme.id);
        } else {
          const defaultTheme = createDefaultThemeDetail();
          try {
            const created = await createTheme({
              name: defaultTheme.theme.name,
              ownerId: defaultTheme.theme.ownerId,
              tokens: defaultTheme.tokens,
              components: defaultTheme.components,
            });
            setThemeDetails([created]);
            setSelectedThemeId(created.theme.id);
          } catch (apiError) {
            setThemeDetails([defaultTheme]);
            setSelectedThemeId(defaultTheme.theme.id);
            saveThemesToLocal([defaultTheme]);
          }
        }
      } catch (err) {
        console.error("Failed to load themes:", err);
        const localThemes = loadThemesFromLocal();
        if (localThemes.length > 0) {
          setThemeDetails(localThemes);
          setSelectedThemeId(localThemes[0].theme.id);
        } else {
          const defaultTheme = createDefaultThemeDetail();
          setThemeDetails([defaultTheme]);
          setSelectedThemeId(defaultTheme.theme.id);
          saveThemesToLocal([defaultTheme]);
        }
        setError(en ? "Using local storage fallback" : "로컬 스토리지 폴백 사용 중");
      } finally {
        setLoading(false);
      }
    }
    loadThemes();
  }, []);

  async function syncThemeToServer(themeDetail: ThemeDetail) {
    try {
      await updateTheme(themeDetail.theme.id, {
        name: themeDetail.theme.name,
        tokens: themeDetail.tokens,
        components: themeDetail.components,
      });
    } catch (err) {
      console.warn("Failed to sync to server, saving to localStorage:", err);
      saveThemesToLocal(themeDetails);
    }
  }

  function updateSelectedTheme(updates: Partial<ThemeDetail>) {
    setThemeDetails(prev => {
      const updated = prev.map(t =>
        t.theme.id === selectedThemeId
          ? {
              ...t,
              ...updates,
              theme: { ...t.theme, updatedAt: new Date().toISOString() }
            }
          : t
      );
      const updatedSelected = updated.find(t => t.theme.id === selectedThemeId);
      if (updatedSelected) {
        syncThemeToServer(updatedSelected);
      }
      return updated;
    });
  }

  function updateToken(tokenId: string, value: string) {
    if (!selectedTheme) return;
    const updatedTokens = selectedTheme.tokens.map(t =>
      t.id === tokenId ? { ...t, value } : t
    );
    updateSelectedTheme({ tokens: updatedTokens });
  }

  function addToken() {
    if (!selectedTheme) return;
    const newToken: ThemeToken = {
      id: generateId(),
      key: "newToken",
      labelKo: "새 토큰",
      labelEn: "New Token",
      value: "#000000",
      type: "color",
      category: "color",
    };
    updateSelectedTheme({ tokens: [...selectedTheme.tokens, newToken] });
  }

  function removeToken(tokenId: string) {
    if (!selectedTheme) return;
    updateSelectedTheme({ tokens: selectedTheme.tokens.filter(t => t.id !== tokenId) });
  }

  async function addTheme() {
    const ownerId = getCurrentUserId();
    const newThemeDetail: ThemeDetail = {
      theme: {
        id: generateId(),
        name: en ? "New Theme" : "새 테마",
        ownerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tokens: selectedTheme ? selectedTheme.tokens.map(t => ({ ...t, id: generateId() })) : [...DEFAULT_TOKENS],
      components: selectedTheme ? selectedTheme.components.map(c => ({ ...c, id: generateId() })) : DEFAULT_COMPONENTS.map(c => ({ ...c, id: generateId() })),
    };

    try {
      const created = await createTheme({
        name: newThemeDetail.theme.name,
        ownerId: newThemeDetail.theme.ownerId,
        tokens: newThemeDetail.tokens,
        components: newThemeDetail.components,
      });
      setThemeDetails(prev => [...prev, created]);
      setSelectedThemeId(created.theme.id);
    } catch (err) {
      setThemeDetails(prev => [...prev, newThemeDetail]);
      setSelectedThemeId(newThemeDetail.theme.id);
      saveThemesToLocal([...themeDetails, newThemeDetail]);
    }
    setSavedMessage(en ? "Theme created!" : "테마가 생성되었습니다!");
    setTimeout(() => setSavedMessage(""), 3000);
  }

  async function handleDeleteTheme(themeId: string) {
    const theme = themeDetails.find(t => t.theme.id === themeId);
    if (!theme) return;
    if (theme.theme.ownerId !== getCurrentUserId()) {
      alert(en ? "You can only delete themes you created." : "내가 만든 테마만 삭제할 수 있습니다.");
      return;
    }
    if (themeDetails.length <= 1) {
      alert(en ? "Cannot delete the last theme." : "마지막 테마는 삭제할 수 없습니다.");
      return;
    }

    try {
      await apiDeleteTheme(themeId);
    } catch (err) {
      console.warn("Failed to delete theme from server:", err);
    }

    const nextThemes = themeDetails.filter(t => t.theme.id !== themeId);
    setThemeDetails(nextThemes);
    if (selectedThemeId === themeId) {
      setSelectedThemeId(nextThemes[0].theme.id);
    }
    saveThemesToLocal(nextThemes);
    setSavedMessage(en ? "Theme deleted" : "테마가 삭제되었습니다");
    setTimeout(() => setSavedMessage(""), 3000);
  }

  function updateComponentStyle(componentId: string, key: string, value: string) {
    if (!selectedTheme) return;
    const updatedComponents = selectedTheme.components.map(c =>
      c.id === componentId
        ? { ...c, styles: { ...c.styles, [key]: value } }
        : c
    );
    updateSelectedTheme({ components: updatedComponents });
  }

  function removeComponent(componentId: string) {
    if (!selectedTheme) return;
    updateSelectedTheme({ components: selectedTheme.components.filter(c => c.id !== componentId) });
  }

  function addComponent() {
    if (!selectedTheme || !newComponent.name) return;
    const component: ComponentStyle = {
      id: generateId(),
      name: newComponent.name || "",
      nameKo: newComponent.nameKo || newComponent.name || "",
      description: newComponent.description || "",
      category: newComponent.category || "primitive",
      layer: newComponent.layer || "primitive",
      className: newComponent.className || `.${newComponent.name?.toLowerCase().replace(/\s+/g, '-')}`,
      elementId: newComponent.elementId || newComponent.name?.toLowerCase().replace(/\s+/g, '-'),
      styles: newComponent.styles || {},
      useAt: "Y",
    };
    updateSelectedTheme({ components: [...selectedTheme.components, component] });
    setShowAddComponent(false);
    setNewComponent({ name: "", nameKo: "", description: "", category: "primitive", layer: "primitive", className: "", elementId: "", styles: {}, useAt: "Y" });
  }

  function toggleComponentUse(componentId: string) {
    if (!selectedTheme) return;
    const updatedComponents = selectedTheme.components.map(c =>
      c.id === componentId ? { ...c, useAt: (c.useAt === "Y" ? "N" : "Y") as "Y" | "N" } : c
    );
    updateSelectedTheme({ components: updatedComponents });
  }

  async function copyPayload() {
    if (!selectedTheme) return;
    setCopied(false);
    let payload: ThemeExport;
    try {
      payload = await exportTheme(selectedTheme.theme.id);
    } catch (err) {
      payload = {
        themeName: selectedTheme.theme.name,
        tokens: Object.fromEntries(selectedTheme.tokens.map(t => [t.key, t.value])),
        components: selectedTheme.components.filter(c => c.useAt === "Y").map(c => ({
          name: c.name,
          category: c.category,
          styles: c.styles,
        })),
      };
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  function ComponentPreview({ component }: { component: ComponentStyle }) {
    const baseStyle = component.styles as React.CSSProperties;
    const containerStyle: React.CSSProperties = {
      ...baseStyle,
      minWidth: component.category === "overlay" ? "300px" : undefined,
    };

    switch (component.name.toLowerCase()) {
      case "govbutton":
      case "govbutton secondary":
      case "govbutton danger":
        return (
          <button style={containerStyle} type="button">
            {component.nameKo || component.name}
          </button>
        );
      case "govinput":
        return (
          <input
            style={containerStyle}
            type="text"
            placeholder={en ? "Enter text..." : "텍스트 입력..."}
          />
        );
      case "govselect":
        return (
          <select style={containerStyle}>
            <option value="">{en ? "Select..." : "선택..."}</option>
            <option value="1">{en ? "Option 1" : "옵션 1"}</option>
            <option value="2">{en ? "Option 2" : "옵션 2"}</option>
          </select>
        );
      case "govtextarea":
        return (
          <textarea
            style={containerStyle}
            placeholder={en ? "Enter description..." : "설명 입력..."}
          />
        );
      case "govsearchbar":
        return (
          <AdminSearchBar
            placeholder={en ? "Search..." : "검색..."}
            value=""
            onChange={() => {}}
          />
        );
      case "govtable":
        return (
          <table style={{ ...containerStyle, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fbff", fontWeight: 700, padding: "12px 16px" }}>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid #d9d9d9" }}>{en ? "Column 1" : "컬럼 1"}</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid #d9d9d9" }}>{en ? "Column 2" : "컬럼 2"}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid #d9d9d9" }}>Data 1</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid #d9d9d9" }}>Data 2</td>
              </tr>
            </tbody>
          </table>
        );
      case "govtableheader":
        return (
          <div style={{ ...containerStyle, fontWeight: 700, padding: "12px 16px" }}>
            {en ? "Table Header" : "테이블 헤더"}
          </div>
        );
      case "govmodal":
        return (
          <div style={{ ...containerStyle, padding: "20px", textAlign: "center" }}>
            <div style={{ marginBottom: "12px", fontWeight: 700 }}>{en ? "Modal Title" : "모달 제목"}</div>
            <div style={{ fontSize: "14px", color: "#666" }}>{en ? "Modal content goes here" : "모달 내용이 여기에 표시됩니다"}</div>
          </div>
        );
      case "govcard":
        return (
          <div style={containerStyle}>
            <div style={{ fontWeight: 700, marginBottom: "8px" }}>{en ? "Card Title" : "카드 제목"}</div>
            <div style={{ fontSize: "14px", color: "#666" }}>{en ? "Card content" : "카드 내용"}</div>
          </div>
        );
      case "govtoolbar":
        return (
          <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{en ? "Toolbar Left" : "툴바 왼쪽"}</span>
            <span>{en ? "Toolbar Right" : "툴바 오른쪽"}</span>
          </div>
        );
      case "govpagination":
        return (
          <div style={{ ...containerStyle, display: "flex", gap: "4px" }}>
            <button style={{ padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: "4px" }}>{'<'}</button>
            <button style={{ padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: "4px", background: "#00378b", color: "white" }}>1</button>
            <button style={{ padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: "4px" }}>2</button>
            <button style={{ padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: "4px" }}>3</button>
            <button style={{ padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: "4px" }}>{'>'}</button>
          </div>
        );
      case "govstatusnotice success":
      case "govstatusnotice error":
      case "govstatusnotice warning":
      case "govstatusnotice info":
        return (
          <div style={containerStyle}>
            {component.nameKo || component.name}
          </div>
        );
      case "govmetriccard":
        return (
          <div style={containerStyle}>
            <div style={{ fontSize: "12px", color: "#666" }}>{en ? "Metric Label" : "지표 라벨"}</div>
            <div style={{ fontSize: "24px", fontWeight: 700 }}>1,234</div>
          </div>
        );
      case "govdiagnosticcard":
        return (
          <div style={containerStyle}>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>{en ? "Diagnostic Title" : "진단 제목"}</div>
            <div style={{ fontSize: "12px", color: "#666" }}>{en ? "Diagnostic info" : "진단 정보"}</div>
          </div>
        );
      case "govwarningpanel":
        return (
          <div style={containerStyle}>
            <strong>⚠️ </strong>{en ? "Warning message" : "경고 메시지"}
          </div>
        );
      case "govkeyvaluepanel":
        return (
          <div style={containerStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#666" }}>{en ? "Key" : "키"}</span>
              <span style={{ fontWeight: 700 }}>{en ? "Value" : "값"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>{en ? "Key 2" : "키 2"}</span>
              <span style={{ fontWeight: 700 }}>{en ? "Value 2" : "값 2"}</span>
            </div>
          </div>
        );
      case "adminsearchsection":
        return (
          <div style={{ ...containerStyle, display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              style={{ flex: 1, minHeight: "40px", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d9d9d9" }}
              placeholder={en ? "Search..." : "검색..."}
              readOnly
            />
            <button style={{ minHeight: "40px", padding: "10px 20px", borderRadius: "8px", background: "#00378b", color: "white", fontWeight: 700 }}>
              {en ? "Search" : "검색"}
            </button>
          </div>
        );
      default:
        return (
          <div style={containerStyle} className={component.className}>
            {component.nameKo || component.name}
          </div>
        );
    }
  }

  const filteredComponents = selectedTheme?.components.filter(c => {
    if (selectedCategory !== "all" && c.category !== selectedCategory) return false;
    if (componentSearch) {
      const search = componentSearch.toLowerCase();
      return c.name.toLowerCase().includes(search) ||
             c.nameKo.includes(search) ||
             c.description.toLowerCase().includes(search);
    }
    return true;
  }) || [];

  if (!selectedTheme) {
    return (
      <div className="flex items-center justify-center p-8">
        {loading ? (
          <span>{en ? "Loading themes..." : "테마 로딩 중..."}</span>
        ) : error ? (
          <span className="text-red-500">{error}</span>
        ) : (
          <span>{en ? "No theme selected" : "테마가 선택되지 않았습니다"}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {copied && <PageStatusNotice tone="success">{en ? "Theme payload copied." : "테마 payload를 복사했습니다."}</PageStatusNotice>}
      {savedMessage && <PageStatusNotice tone="success">{savedMessage}</PageStatusNotice>}

      {/* Theme Selection */}
      <div className="gov-card">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            actions={
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Owner" : "소유자"}: <span className="font-mono text-xs">{selectedTheme.theme.ownerId.slice(0, 12)}...</span>
                </span>
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {selectedTheme.components.filter(c => c.useAt === "Y").length} {en ? "components" : "개 컴포넌트"}
                </span>
              </div>
            }
            meta={en ? "Select, create, or delete themes" : "테마 선택, 생성, 삭제"}
            title={en ? "Theme Selection" : "테마 선택"}
          />
        </div>
        <form className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
          <AdminSearchField label={en ? "Theme" : "테마"} className="md:col-span-2">
            <AdminSelect
              className="w-full"
              onChange={(e) => setSelectedThemeId(e.target.value)}
              value={selectedThemeId}
            >
              {themeDetails.map(t => (
                <option key={t.theme.id} value={t.theme.id}>{t.theme.name}</option>
              ))}
            </AdminSelect>
          </AdminSearchField>
          <AdminSearchField label={en ? "Theme Name" : "테마 이름"}>
            <AdminInput
              className="w-full"
              onChange={(e) => updateSelectedTheme({ theme: { ...selectedTheme.theme, name: e.target.value } })}
              value={selectedTheme.theme.name}
            />
          </AdminSearchField>
          <div className="md:col-span-4">
            <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <MemberButton onClick={() => handleDeleteTheme(selectedThemeId)} type="button" variant="dangerSecondary">
                  {en ? "Delete" : "삭제"}
                </MemberButton>
                <MemberButton onClick={addTheme} type="button" variant="secondary">
                  {en ? "New Theme" : "새 테마"}
                </MemberButton>
                <span className="text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Auto-saved" : "자동 저장됨"}
                </span>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--kr-gov-border-light)]">
        <button
          className={`px-4 py-2 text-sm font-bold ${activeTab === "tokens" ? "border-b-2 border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)]" : "text-[var(--kr-gov-text-secondary)]"}`}
          onClick={() => setActiveTab("tokens")}
          type="button"
        >
          {en ? "Theme Tokens" : "테마 토큰"} ({selectedTheme.tokens.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-bold ${activeTab === "components" ? "border-b-2 border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)]" : "text-[var(--kr-gov-text-secondary)]"}`}
          onClick={() => setActiveTab("components")}
          type="button"
        >
          {en ? "Components" : "컴포넌트"} ({filteredComponents.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-bold ${activeTab === "preview" ? "border-b-2 border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)]" : "text-[var(--kr-gov-text-secondary)]"}`}
          onClick={() => setActiveTab("preview")}
          type="button"
        >
          {en ? "Preview & Export" : "미리보기 내보내기"}
        </button>
      </div>

      {/* Tokens Tab */}
      {activeTab === "tokens" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <MemberButton onClick={addToken} type="button" variant="secondary">
              {en ? "Add Token" : "토큰 추가"}
            </MemberButton>
          </div>
          <div className="space-y-3">
            {selectedTheme.tokens.map(token => (
              <div key={token.id} className="gov-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <AdminInput
                        className="font-bold"
                        onChange={(e) => {
                          const updatedTokens = selectedTheme.tokens.map(t =>
                            t.id === token.id ? { ...t, key: e.target.value, labelKo: e.target.value, labelEn: e.target.value } : t
                          );
                          updateSelectedTheme({ tokens: updatedTokens });
                        }}
                        value={token.key}
                      />
                      <select
                        className="rounded border border-[var(--kr-gov-border-light)] px-2 py-1 text-sm"
                        value={token.type}
                        onChange={(e) => {
                          const updatedTokens = selectedTheme.tokens.map(t =>
                            t.id === token.id ? { ...t, type: e.target.value as TokenType } : t
                          );
                          updateSelectedTheme({ tokens: updatedTokens });
                        }}
                      >
                        <option value="color">Color</option>
                        <option value="size">Size</option>
                        <option value="text">Text</option>
                        <option value="spacing">Spacing</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      {token.type === "color" && (
                        <input
                          className="h-10 w-16 rounded border border-[var(--kr-gov-border-light)] p-1"
                          onChange={(e) => updateToken(token.id, e.target.value)}
                          type="color"
                          value={token.value}
                        />
                      )}
                      <AdminInput
                        className="flex-1"
                        onChange={(e) => updateToken(token.id, e.target.value)}
                        value={token.value}
                      />
                    </div>
                  </div>
                  <MemberButton onClick={() => removeToken(token.id)} type="button" variant="dangerSecondary">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </MemberButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Components Tab */}
      {activeTab === "components" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-full px-3 py-1 text-sm font-bold ${selectedCategory === "all" ? "bg-[var(--kr-gov-blue)] text-white" : "bg-gray-100 text-[var(--kr-gov-text-secondary)]"}`}
                  onClick={() => setSelectedCategory("all")}
                  type="button"
                >
                  {en ? "All" : "전체"} ({selectedTheme.components.length})
                </button>
                {COMPONENT_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    className={`rounded-full px-3 py-1 text-sm font-bold ${selectedCategory === cat.id ? "bg-[var(--kr-gov-blue)] text-white" : "bg-gray-100 text-[var(--kr-gov-text-secondary)]"}`}
                    onClick={() => setSelectedCategory(cat.id)}
                    type="button"
                  >
                    {en ? cat.labelEn : cat.labelKo} ({selectedTheme.components.filter(c => c.category === cat.id).length})
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <AdminInput
                  className="w-64"
                  onChange={(e) => setComponentSearch(e.target.value)}
                  placeholder={en ? "Search components..." : "컴포넌트 검색..."}
                  value={componentSearch}
                />
              </div>
            </div>
            <MemberButton onClick={() => setShowAddComponent(true)} type="button" variant="primary">
              {en ? "Add Component" : "컴포넌트 추가"}
            </MemberButton>
          </div>

          <div className="space-y-3">
            {filteredComponents.map(component => (
              <div key={component.id} className={`gov-card p-4 ${component.useAt === "N" ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="w-24 h-16 border border-[var(--kr-gov-border-light)] rounded flex items-center justify-center overflow-hidden bg-gray-50" style={component.styles as React.CSSProperties}>
                    <span className="text-xs text-center px-1 truncate">{en ? component.name : component.nameKo}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold">{en ? component.name : component.nameKo}</h4>
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {component.category}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--kr-gov-text-secondary)] mb-2">{component.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-[var(--kr-gov-text-secondary)]">
                      <span><span className="font-mono text-[var(--kr-gov-blue)]">class:</span> {component.className}</span>
                      <span><span className="font-mono text-[var(--kr-gov-blue)]">id:</span> {component.elementId}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        checked={component.useAt === "Y"}
                        onChange={() => toggleComponentUse(component.id)}
                        type="checkbox"
                      />
                      {en ? "Use" : "사용"}
                    </label>
                    <MemberButton onClick={() => setEditingComponent(component)} size="sm" type="button" variant="secondary">
                      {en ? "Edit" : "편집"}
                    </MemberButton>
                    <MemberButton onClick={() => removeComponent(component.id)} size="sm" type="button" variant="dangerSecondary">
                      {en ? "Remove" : "제거"}
                    </MemberButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Preview & Export Tab */}
      {activeTab === "preview" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{en ? "Full Component Preview" : "전체 컴포넌트 미리보기"}</h3>
            <div className="flex gap-2">
              <MemberButton
                onClick={() => window.open(`#/admin/system/builder-studio?themeId=${selectedThemeId}`, "_blank")}
                type="button"
                variant="secondary"
              >
                {en ? "Open in Page Builder" : "페이지 빌더에서 열기"}
              </MemberButton>
              <MemberButton onClick={copyPayload} type="button" variant="primary">
                {en ? "Copy Theme JSON" : "테마 JSON 복사"}
              </MemberButton>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {selectedTheme.components.filter(c => c.useAt === "Y").map(component => (
              <div key={component.id} className="gov-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold">{en ? component.name : component.nameKo}</p>
                    <p className="text-xs text-[var(--kr-gov-text-secondary)]">{component.className}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {component.category}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 min-h-[80px] flex items-center justify-center">
                  <ComponentPreview component={component} />
                </div>
                <div className="mt-2 text-xs text-[var(--kr-gov-text-secondary)] font-mono">
                  <div className="truncate">{component.elementId}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="gov-card p-4">
            <h4 className="font-bold mb-4">{en ? "Theme Summary" : "테마 요약"}</h4>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <dt className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Theme Name" : "테마 이름"}</dt>
                <dd className="font-bold">{selectedTheme.theme.name}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Tokens" : "토큰 수"}</dt>
                <dd className="font-bold">{selectedTheme.tokens.length}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Active Components" : "활성 컴포넌트"}</dt>
                <dd className="font-bold">{selectedTheme.components.filter(c => c.useAt === "Y").length}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Last Updated" : "최종 수정"}</dt>
                <dd className="text-sm">{new Date(selectedTheme.theme.updatedAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          <div className="gov-card p-4">
            <h4 className="font-bold mb-4">{en ? "CSS Variables" : "CSS 변수"}</h4>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
              <pre className="whitespace-pre-wrap">
                {`:root {\n${selectedTheme.tokens.map(t => `  --${t.key}: ${t.value};`).join("\n")}\n}`}
              </pre>
            </div>
          </div>
        </section>
      )}

      {/* Add Component Modal */}
      {showAddComponent && (
        <MemberModal
          onClose={() => setShowAddComponent(false)}
          size="lg"
          title={en ? "Add Component" : "컴포넌트 추가"}
        >
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); addComponent(); }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Name (EN)" : "이름 (EN)"}</span>
                <AdminInput
                  className="w-full"
                  onChange={(e) => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                  value={newComponent.name || ""}
                />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Name (KO)" : "이름 (KO)"}</span>
                <AdminInput
                  className="w-full"
                  onChange={(e) => setNewComponent(prev => ({ ...prev, nameKo: e.target.value }))}
                  value={newComponent.nameKo || ""}
                />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Class Name" : "클래스"}</span>
                <AdminInput
                  className="w-full font-mono"
                  onChange={(e) => setNewComponent(prev => ({ ...prev, className: e.target.value }))}
                  placeholder=".gov-example"
                  value={newComponent.className || ""}
                />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Element ID" : "엘리먼트 ID"}</span>
                <AdminInput
                  className="w-full font-mono"
                  onChange={(e) => setNewComponent(prev => ({ ...prev, elementId: e.target.value }))}
                  placeholder="gov-example"
                  value={newComponent.elementId || ""}
                />
              </div>
            </div>
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Description" : "설명"}</span>
              <AdminTextarea
                className="w-full"
                onChange={(e) => setNewComponent(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                value={newComponent.description || ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Category" : "카테고리"}</span>
                <AdminSelect
                  className="w-full"
                  onChange={(e) => setNewComponent(prev => ({ ...prev, category: e.target.value }))}
                  value={newComponent.category || "primitive"}
                >
                  {COMPONENT_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{en ? cat.labelEn : cat.labelKo}</option>
                  ))}
                </AdminSelect>
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Layer" : "레이어"}</span>
                <AdminSelect
                  className="w-full"
                  onChange={(e) => setNewComponent(prev => ({ ...prev, layer: e.target.value }))}
                  value={newComponent.layer || "primitive"}
                >
                  <option value="primitive">Primitive</option>
                  <option value="composite">Composite</option>
                  <option value="layout">Layout</option>
                  <option value="feedback">Feedback</option>
                </AdminSelect>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--kr-gov-border-light)]">
              <MemberButton onClick={() => setShowAddComponent(false)} type="button" variant="secondary">
                {en ? "Cancel" : "취소"}
              </MemberButton>
              <MemberButton type="submit" variant="primary">
                {en ? "Add" : "추가"}
              </MemberButton>
            </div>
          </form>
        </MemberModal>
      )}

      {/* Edit Component Modal */}
      {editingComponent && (
        <MemberModal
          onClose={() => setEditingComponent(null)}
          size="lg"
          title={en ? "Edit Component" : "컴포넌트 편집"}
        >
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEditingComponent(null); }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Name (EN)" : "이름 (EN)"}</span>
                <AdminInput
                  className="w-full"
                  value={editingComponent.name}
                />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Name (KO)" : "이름 (KO)"}</span>
                <AdminInput
                  className="w-full"
                  value={editingComponent.nameKo}
                />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Class Name" : "클래스"}</span>
                <AdminInput
                  className="w-full font-mono"
                  value={editingComponent.className}
                />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Element ID" : "엘리먼트 ID"}</span>
                <AdminInput
                  className="w-full font-mono"
                  value={editingComponent.elementId}
                />
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Category" : "카테고리"}</span>
                <AdminSelect
                  className="w-full"
                  value={editingComponent.category}
                >
                  {COMPONENT_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{en ? cat.labelEn : cat.labelKo}</option>
                  ))}
                </AdminSelect>
              </div>
              <div>
                <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Layer" : "레이어"}</span>
                <AdminSelect
                  className="w-full"
                  value={editingComponent.layer}
                >
                  <option value="primitive">Primitive</option>
                  <option value="composite">Composite</option>
                  <option value="layout">Layout</option>
                  <option value="feedback">Feedback</option>
                </AdminSelect>
              </div>
            </div>
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Description" : "설명"}</span>
              <AdminTextarea
                className="w-full"
                rows={2}
                value={editingComponent.description}
              />
            </div>
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "CSS Styles (property : value)" : "CSS 스타일 (속성 : 값)"}</span>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {Object.entries(editingComponent.styles).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[140px_1fr] gap-2 items-center">
                    <AdminInput
                      className="font-mono text-sm"
                      value={key}
                    />
                    <AdminInput
                      className="font-mono text-sm"
                      value={value}
                      onChange={(e) => updateComponentStyle(editingComponent.id, key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--kr-gov-border-light)]">
              <MemberButton onClick={() => setEditingComponent(null)} type="button" variant="secondary">
                {en ? "Close" : "닫기"}
              </MemberButton>
            </div>
          </form>
        </MemberModal>
      )}
    </div>
  );
}

function BuilderGovernancePage({ kind }: { kind: PageKind }) {
  const en = isEnglish();
  const meta = KIND_META[kind];
  const { keyword, draftKeyword, setDraftKeyword, handleSearchSubmit, handleReset } = useAdminSearch();
  const rows = useMemo(() => (
    meta.rows.filter((row) => `${row.name} ${row.lane} ${row.owner} ${row.output}`.toLowerCase().includes(keyword.trim().toLowerCase()))
  ), [meta.rows, keyword]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? meta.titleEn : meta.titleKo }
      ]}
      sidebarVariant="system"
      title={en ? meta.titleEn : meta.titleKo}
    >
      <AdminWorkspacePageFrame>
        {kind === "theme" ? (
          <ThemeBuilderPanel en={en} />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              <SummaryMetricCard title={en ? "Registry Rows" : "레지스트리 행"} value={rows.length} />
              <SummaryMetricCard title={en ? "Ready" : "준비"} value={rows.filter((row) => row.status === "READY").length} />
              <SummaryMetricCard title={en ? "Active" : "활성"} value={rows.filter((row) => row.status === "ACTIVE").length} />
              <SummaryMetricCard title={en ? "Lanes" : "레인"} value={new Set(rows.map((row) => row.lane)).size} />
            </section>

            <AdminSearchSection
              en={en}
              metaLabel={en ? "Search by name, lane, owner, or output" : "이름, 레인, 소유, 산출로 검색"}
              onReset={handleReset}
              onSearch={handleSearchSubmit}
              searchLabel={en ? "Search" : "검색"}
              totalCount={rows.length}
            >
              <AdminSearchField label={en ? "Search" : "검색"} className="md:col-span-2">
                <AdminInput
                  className="flex-1"
                  onChange={(e) => setDraftKeyword(e.target.value)}
                  placeholder={en ? "Name, lane, owner, output..." : "이름, 레인, 소유, 산출..."}
                  value={draftKeyword}
                />
              </AdminSearchField>
            </AdminSearchSection>

            <div className="gov-card p-0 overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <MemberSectionToolbar
                  actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{meta.icon}</span>}
                  meta={`${rows.length} ${en ? "items" : "개 항목"}`}
                  title={en ? meta.titleEn : meta.titleKo}
                />
              </div>
              <GovernanceTable en={en} rows={rows} />
            </div>
          </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

type PageKind = "theme" | "css" | "patterns" | "agents";

type Row = {
  name: string;
  lane: string;
  status: string;
  owner: string;
  output: string;
};

const KIND_META: Record<PageKind, { id: string; titleKo: string; titleEn: string; icon: string; rows: Row[] }> = {
  theme: {
    id: "theme-management",
    titleKo: "테마 관리",
    titleEn: "Theme Management",
    icon: "palette",
    rows: []
  },
  css: {
    id: "css-management",
    titleKo: "CSS 관리",
    titleEn: "CSS Management",
    icon: "css",
    rows: [
      { name: "gov-card", lane: "layout", status: "ACTIVE", owner: "theme-management", output: "border/background/padding token binding" },
      { name: "gov-input", lane: "form", status: "ACTIVE", owner: "component-management", output: "input/select/textarea field baseline" },
      { name: "data-table", lane: "data", status: "ACTIVE", owner: "component-management", output: "table header/cell density baseline" },
      { name: "builder-inspector-outline", lane: "builder", status: "READY", owner: "builder-studio", output: "right click DOM capture highlight" },
      { name: "screen-overlay-marker", lane: "deployless", status: "READY", owner: "screen-overlay-apply", output: "no-redeploy freshness verification" }
    ]
  },
  patterns: {
    id: "development-pattern-management",
    titleKo: "개발 패턴 관리",
    titleEn: "Development Pattern Management",
    icon: "schema",
    rows: [
      { name: "Route Family Contract", lane: "frontend", status: "ACTIVE", owner: "app/routes/families", output: "routeId/pageId/menuCode/source ownership" },
      { name: "Builder Asset Registry", lane: "builder", status: "ACTIVE", owner: "builder-studio", output: "route/source/component/theme/API/controller/DB inventory" },
      { name: "Section First Composition", lane: "design", status: "READY", owner: "section-management", output: "search/list/detail/action panel reuse" },
      { name: "Runtime Command Gateway", lane: "project-core", status: "ACTIVE", owner: "runtime-command", output: "metadata command without framework redeploy" },
      { name: "Screen Overlay Apply", lane: "deployless", status: "ACTIVE", owner: "ops/scripts", output: "React build assets applied without pod delete" }
    ]
  },
  agents: {
    id: "ai-developer-team",
    titleKo: "AI 개발팀",
    titleEn: "AI Developer Team",
    icon: "groups",
    rows: [
      { name: "HERMES", lane: "local-agent", status: "ACTIVE", owner: "ai-operations", output: "right-click context request and SR workbench stack" },
      { name: "KILO", lane: "remote-agent", status: "READY", owner: "ai-operations", output: "agent selection target for implementation tasks" },
      { name: "Model Policy", lane: "governance", status: "READY", owner: "ai-models", output: "replace disallowed model providers with approved alternatives" },
      { name: "Preflight Scope", lane: "quality", status: "ACTIVE", owner: "builder-studio", output: "asset registry and route trace attached to every request" },
      { name: "Post-change Verify", lane: "quality", status: "READY", owner: "screen-overlay-apply", output: "build/overlay/health/freshness evidence" }
    ]
  }
};

function GovernanceTable({ rows, en }: { rows: ReadonlyArray<Row>; en: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[860px]">
        <thead>
          <tr>
            <th>{en ? "Name" : "이름"}</th>
            <th>{en ? "Lane" : "레인"}</th>
            <th>{en ? "Owner" : "소유"}</th>
            <th>{en ? "Output" : "산출"}</th>
            <th>{en ? "Status" : "상태"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.lane}-${row.name}`}>
              <td className="font-black">{row.name}</td>
              <td>{row.lane}</td>
              <td>{row.owner}</td>
              <td>{row.output}</td>
              <td>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${row.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : row.status === "READY" ? "bg-blue-100 text-[var(--kr-gov-blue)]" : "bg-amber-100 text-amber-700"}`}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ThemeManagementMigrationPage() {
  return <BuilderGovernancePage kind="theme" />;
}

export function CssManagementMigrationPage() {
  return <BuilderGovernancePage kind="css" />;
}

export function DevelopmentPatternManagementPage() {
  return <BuilderGovernancePage kind="patterns" />;
}

export function AiDeveloperTeamManagementPage() {
  return <BuilderGovernancePage kind="agents" />;
}