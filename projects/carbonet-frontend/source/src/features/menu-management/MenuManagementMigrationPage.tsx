import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { refreshAdminMenuTree } from "../../lib/api/adminShell";
import { postFormUrlEncoded, postLocalizedValidatedJson } from "../../lib/api/core";
import { fetchMenuManagementPage } from "../../lib/api/platform";
import type { MenuManagementPagePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { MemberButton } from "../admin-ui/common";
import { stringOf } from "../admin-system/adminSystemShared";
import { GridToolbar, PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { buildMenuTree, buildSuggestedPageCode, flattenMenuOrderPayload, type MenuTreeNode, updateMenuSortOrders } from "./menuTreeShared";

type MenuNode = MenuTreeNode;

const ICON_LIST = [
  "home", "menu", "web", "dashboard", "settings", "person", "group", "build",
  "search", "add", "edit", "delete", "visibility", "lock", "mail", "phone",
  "notifications", "calendar_today", "event", "description", "folder", "file_copy",
  "image", "video_library", "music_note", "article", "book", "school", "science",
  "psychology", "language", "code", "terminal", "api", "cloud", "storage", "database",
  "dns", "router", "wifi", "bluetooth", "security", "verified_user", "shield",
  "policy", "fact_check", "gavel", "account_tree", "hub", "link", "share",
  "download", "upload", "print", "send", "inbox", "star", "favorite", "bookmark",
  "label", "local_offer", "category", "inventory_2", "shopping_cart", "payment",
  "credit_card", "attach_money", "trending_up", "analytics", "bar_chart", "pie_chart",
  "timeline", "map", "location_on", "directions", "flight", "train", "local_shipping",
  "two_wheeler", "directions_car", "directions_bus", "parking", "local_gas_station",
  "electric_car", "health_and_safety", "medical_services", "vaccines", "coronavirus",
  "favorite_border", "thumb_up", "thumb_down", "chat", "forum", "support", "help",
  "info", "warning", "error", "check_circle", "cancel", "refresh", "sync", "loop",
  "filter_list", "sort", "drag_indicator", "drag_handle", "vertical_align_top",
  "vertical_align_center", "vertical_align_bottom", "expand_more", "expand_less",
  "unfold_more", "unfold_less", "first_page", "last_page", "chevron_left",
  "chevron_right", "arrow_back", "arrow_forward", "arrow_upward", "arrow_downward",
  "swap_vert", "swap_horiz", "compare_arrows", "assistant", "smart_toy",
  "memory", "flash_on", "bolt", "extension", "widget", "view_module", "grid_view",
  "view_list", "view_agenda", "view_day", "view_week", "crop_landscape", "crop_portrait",
  "palette", "color_lens", "brush", "format_paint", "texture", "layers", "linear_scale",
  "date_range", "schedule", "timer", "hourglass_empty", "speed",
  "auto_fix_high", "auto_fix_normal", "auto_awesome", "auto_graph", "campaign",
  "ads_click", "storefront", "point_of_sale", "inventory", "add_shopping_cart",
  "remove_shopping_cart", "shopping_bag", "local_mall", "store", "account_balance",
  "savings", "workspace_premium", "card_giftcard", "redeem", "spa", "eco", "nature",
  "wb_sunny", "wb_cloudy", "cloud_queue", "grain", "blur_on", "blur_off", "transform",
  "rotate_90_degrees_ccw", "rotate_left", "rotate_right", "flip", "flip_camera_android",
  "flip_camera_ios", "movie", "music_video", "subscriptions", "play_circle", "stop_circle",
  "pause_circle", "skip_next", "skip_previous", "play_arrow", "pause", "stop",
  "replay", "shuffle", "repeat", "repeat_one", "volume_up", "volume_down", "volume_mute",
  "keyboard_voice", "videocam", "videocam_off", "camera_alt", "photo_camera", "photo_library",
  "batch_prediction", "smart_button", "device_hub", "developer_board",
  "device_unknown", "devices", "laptop", "desktop_windows", "tablet", "phone_android",
  "phone_iphone", "watch", "keyboard", "mouse", "gamepad", "headphones", "speaker",
  "keyboard_alt", "laptop_chromebook", "stay_current_portrait", "stay_current_landscape",
  "stay_primary_portrait", "stay_primary_landscape", "merge_type", "format_align_left",
  "format_align_center", "format_align_right", "format_align_justify", "format_bold",
  "format_italic", "format_underlined", "format_strikethrough", "format_color_text",
  "format_color_fill", "format_size", "format_list_bulleted", "format_list_numbered",
  "format_indent_increase", "format_indent_decrease", "format_quote", "functions"
];

function readMenuTypeFromLocation() {
  const requested = (new URLSearchParams(window.location.search).get("menuType") || "ADMIN").toUpperCase();
  if (requested === "HOME" || requested === "USER") return "USER";
  return requested === "LEGACY_ADMIN" ? "LEGACY_ADMIN" : "ADMIN";
}

function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return ICON_LIST;
    return ICON_LIST.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border)] px-3 py-2 hover:bg-gray-50"
      >
        <span className="material-symbols-outlined text-[20px]">{value}</span>
        <span className="text-sm">{value}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border)] bg-white shadow-lg">
          <div className="p-2 border-b border-[var(--kr-gov-border)]">
            <input
              className="gov-input w-full"
              placeholder="Search icon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {filtered.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => { onChange(icon); setOpen(false); }}
                  className={`flex items-center justify-center rounded p-1 hover:bg-blue-50 ${value === icon ? "bg-blue-100 text-blue-600" : ""}`}
                >
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableMenuItem({
  node,
  depth,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onDragStart,
  onDrop,
  mobileDragCode,
  onMobileDragStart,
  onMobileDrop,
  onToggleVisibility,
  onToggleActivation,
  onOpenDependentScreen,
  children
}: {
  node: MenuNode;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (code: string, label: string, url: string) => void;
  onDelete: (code: string) => void;
  onDragStart: (e: React.DragEvent, code: string) => void;
  onDrop: (e: React.DragEvent, code: string) => void;
  mobileDragCode: string | null;
  onMobileDragStart: (code: string) => void;
  onMobileDrop: (code: string) => void;
  onToggleVisibility: (code: string, currentExpsrAt: string) => void;
  onToggleActivation: (code: string, currentUseAt: string) => void;
  onOpenDependentScreen: (code: string) => void;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(node.label);
  const [editUrl, setEditUrl] = useState(node.url || "");
  const en = isEnglish();

  useEffect(() => {
    if (!editing) {
      setEditLabel(node.label);
      setEditUrl(node.url || "");
    }
  }, [editing, node.label, node.url]);

  const chipClass = node.code.length === 4
    ? "bg-blue-50 text-[var(--kr-gov-blue)]"
    : node.code.length === 6
    ? "bg-amber-50 text-[#8a5a00]"
    : "bg-green-50 text-[#196c2e]";

  const handleSave = () => {
    onUpdate(node.code, editLabel.trim(), editUrl.trim());
    setEditing(false);
  };

  const handleCancel = () => {
    setEditLabel(node.label);
    setEditUrl(node.url || "");
    setEditing(false);
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        className={`flex items-center gap-2 p-2 hover:bg-gray-50 ${mobileDragCode && mobileDragCode !== node.code ? "cursor-pointer ring-2 ring-blue-400 ring-inset" : ""}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        draggable={depth >= 0}
        onDragStart={(e) => depth >= 0 && onDragStart(e, node.code)}
        onDrop={(e) => depth >= 0 && onDrop(e, node.code)}
        onDragOver={(e) => depth >= 0 && e.preventDefault()}
        onClick={() => {
          if (mobileDragCode && mobileDragCode !== node.code && depth >= 0) {
            onMobileDrop(node.code);
          }
        }}
      >
        {node.children.length > 0 && (
          <button
            type="button"
            onClick={onToggle}
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isExpanded ? "expand_more" : "chevron_right"}
            </span>
          </button>
        )}
        {node.children.length === 0 && depth === 0 && <div className="w-5 h-5" />}
        {node.children.length === 0 && depth > 0 && <div className="w-5" />}

        <span className="material-symbols-outlined text-[20px] text-[var(--kr-gov-blue)]">{node.icon}</span>

        {editing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              className="gov-input flex-1"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder={en ? "Menu name" : "메뉴명"}
            />
            <input
              className="gov-input flex-1"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder={en ? "URL" : "URL"}
            />
            <button type="button" onClick={handleSave} className="gov-btn gov-btn-primary">
              <span className="material-symbols-outlined text-[16px]">check</span>
            </button>
            <button type="button" onClick={handleCancel} className="gov-btn gov-btn-outline">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{node.label}</span>
                <span className={`gov-chip ${chipClass}`}>{node.code}</span>
                <span className={`gov-chip ${node.useAt === "Y" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {node.useAt === "Y" ? (en ? "Active" : "활성") : (en ? "Inactive" : "비활성")}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{node.url || (en ? "No URL" : "URL 없음")}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onToggleVisibility(node.code, node.expsrAt || "Y")}
                className={`p-1 ${node.expsrAt === "Y" ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-600"}`}
                title={en ? "Toggle visibility" : "보임/안보임 토글"}
              >
                <span className="material-symbols-outlined text-[18px]">{node.expsrAt === "Y" ? "visibility" : "visibility_off"}</span>
              </button>
              <button type="button" onClick={() => onToggleActivation(node.code, node.useAt || "Y")}
                className={`p-1 ${node.useAt === "Y" ? "text-green-600 hover:text-amber-700" : "text-gray-400 hover:text-green-700"}`}
                title={node.useAt === "Y" ? (en ? "Deactivate menu" : "메뉴 비활성") : (en ? "Activate menu" : "메뉴 활성")}>
                <span className="material-symbols-outlined text-[18px]">{node.useAt === "Y" ? "toggle_on" : "toggle_off"}</span>
              </button>
              {node.dependentScreenCode && (
                <span className="gov-chip bg-blue-100 text-blue-700 text-xs" title={en ? "Mapped screen" : "매핑된 화면"}>
                  {node.dependentScreenCode}
                </span>
              )}
              <button
                type="button"
                onClick={() => onOpenDependentScreen(node.code)}
                className="p-1 text-gray-500 hover:text-blue-600"
                title={en ? "Screen mapping" : "화면 매핑"}
              >
                <span className="material-symbols-outlined text-[18px]">link</span>
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="p-1 text-gray-500 hover:text-blue-600"
                title={en ? "Edit menu name and URL" : "메뉴명/경로 수정"}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const builderUrl = buildLocalizedPath(
                    `/admin/system/builder-studio?menuCode=${node.code}&pageId=${node.code}&menuTitle=${encodeURIComponent(node.label)}&menuUrl=${encodeURIComponent(node.url || "")}`,
                    `/en/admin/system/builder-studio?menuCode=${node.code}&pageId=${node.code}&menuTitle=${encodeURIComponent(node.label)}&menuUrl=${encodeURIComponent(node.url || "")}`
                  );
                  window.open(builderUrl, "_blank");
                }}
                className="p-1 text-gray-500 hover:text-blue-600"
                title={en ? "Open Builder" : "빌더 열기"}
              >
                <span className="material-symbols-outlined text-[18px]">build</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(node.code)}
                className="p-1 text-gray-500 hover:text-red-600"
                title={en ? "Delete" : "삭제"}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
              <button
                type="button"
                onClick={() => onMobileDragStart(node.code)}
                className={`p-1 ${mobileDragCode === node.code ? "text-blue-600 bg-blue-50 rounded" : "text-gray-400 hover:text-blue-600"}`}
                title={en ? "Drag to reorder" : "드래그하여 순서 변경"}
              >
                <span className="material-symbols-outlined text-[18px]">drag_handle</span>
              </button>
            </div>
          </>
        )}
      </div>
      {children}
    </div>
  );
}

function MenuTree({
  nodes,
  expandedCodes,
  onToggle,
  onUpdate,
  onDelete,
  onDragStart,
  onDrop,
  mobileDragCode,
  onMobileDragStart,
  onMobileDrop,
  onToggleVisibility,
  onToggleActivation,
  onOpenDependentScreen,
  depth = 0
}: {
  nodes: MenuNode[];
  expandedCodes: Set<string>;
  onToggle: (code: string) => void;
  onUpdate: (code: string, label: string, url: string) => void;
  onDelete: (code: string) => void;
  onDragStart: (e: React.DragEvent, code: string) => void;
  onDrop: (e: React.DragEvent, code: string) => void;
  mobileDragCode: string | null;
  onMobileDragStart: (code: string) => void;
  onMobileDrop: (targetCode: string) => void;
  onToggleVisibility: (code: string, currentExpsrAt: string) => void;
  onToggleActivation: (code: string, currentUseAt: string) => void;
  onOpenDependentScreen: (code: string) => void;
  depth?: number;
}) {
  return (
    <div className="divide-y divide-gray-100">
      {nodes.map((node) => (
        <EditableMenuItem
          key={node.code}
          node={node}
          depth={depth}
          isExpanded={expandedCodes.has(node.code)}
          onToggle={() => onToggle(node.code)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onDragStart={onDragStart}
          onDrop={onDrop}
          mobileDragCode={mobileDragCode}
          onMobileDragStart={onMobileDragStart}
          onMobileDrop={onMobileDrop}
          onToggleVisibility={onToggleVisibility}
          onToggleActivation={onToggleActivation}
          onOpenDependentScreen={onOpenDependentScreen}
        >
          {node.children.length > 0 && expandedCodes.has(node.code) && (
            <MenuTree
              nodes={node.children}
              expandedCodes={expandedCodes}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDrop={onDrop}
              mobileDragCode={mobileDragCode}
              onMobileDragStart={onMobileDragStart}
              onMobileDrop={onMobileDrop}
              onToggleVisibility={onToggleVisibility}
              onToggleActivation={onToggleActivation}
              onOpenDependentScreen={onOpenDependentScreen}
              depth={depth + 1}
            />
          )}
        </EditableMenuItem>
      ))}
    </div>
  );
}

function ParentSelector({
  treeData,
  value,
  onChange
}: {
  treeData: MenuNode[];
  value: string;
  onChange: (code: string) => void;
}) {
  const en = isEnglish();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const selectedLabel = useMemo(() => {
    const findLabel = (nodes: MenuNode[], code: string): string | null => {
      for (const node of nodes) {
        if (node.code === code) return node.label;
        const found = findLabel(node.children, code);
        if (found) return found;
      }
      return null;
    };
    return findLabel(treeData, value) || value;
  }, [treeData, value]);

  const toggle = (code: string) => {
    const next = new Set(expanded);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setExpanded(next);
  };

  const renderNodes = (nodes: MenuNode[], depth: number = 0): React.ReactNode => {
    return nodes
      .filter(node => node.code.length !== 8)
      .map((node) => (
      <div key={node.code}>
        <button
          type="button"
          onClick={() => { onChange(node.code); setOpen(false); }}
          className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left ${value === node.code ? "bg-blue-100" : ""}`}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
        >
          {depth === 0 && node.children.length > 0 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(node.code); }}
              className="w-4 h-4 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[14px]">
                {expanded.has(node.code) ? "expand_more" : "chevron_right"}
              </span>
            </button>
          ) : (
            <div className="w-4" />
          )}
          <span className="material-symbols-outlined text-[16px]">{node.icon}</span>
          <span className="text-sm truncate">{node.label}</span>
          <span className="text-xs text-gray-400">{node.code}</span>
        </button>
        {depth === 0 && node.children.length > 0 && expanded.has(node.code) && renderNodes(node.children, depth + 1)}
      </div>
    ));
  };

  const rootNodes = treeData.filter(n => n.code.length === 4 || n.code.length === 6);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="gov-select w-full flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm truncate">{selectedLabel}</span>
        </span>
        <span className="material-symbols-outlined text-[18px]">arrow_drop_down</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[20rem] max-h-80 overflow-y-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border)] bg-white shadow-lg">
          <div className="p-2 border-b border-[var(--kr-gov-border)] bg-gray-50">
            <p className="text-xs font-bold text-gray-500">{en ? "Select Parent Menu" : "상위 메뉴 선택"}</p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {renderNodes(rootNodes)}
          </div>
        </div>
      )}
    </div>
  );
}

type UseAtFilter = "" | "Y" | "N";

type FilterChip = {
  key: string;
  label: string;
  clear: () => void;
};

function UseAtFilterBar({
  en,
  useAtFilter,
  onChange
}: {
  en: boolean;
  useAtFilter: UseAtFilter;
  onChange: (value: UseAtFilter) => void;
}) {
  return (
    <section className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Use Filter" : "사용 필터"}</span>
      <MemberButton onClick={() => onChange("")} type="button" variant={useAtFilter === "" ? "primary" : "secondary"}>{en ? "All" : "전체"}</MemberButton>
      <MemberButton onClick={() => onChange("Y")} type="button" variant={useAtFilter === "Y" ? "primary" : "secondary"}>{en ? "Active" : "사용중"}</MemberButton>
      <MemberButton onClick={() => onChange("N")} type="button" variant={useAtFilter === "N" ? "primary" : "secondary"}>{en ? "Inactive" : "미사용"}</MemberButton>
    </section>
  );
}

function ActiveFilterChipBar({
  chips
}: {
  chips: FilterChip[];
}) {
  if (chips.length === 0) {
    return null;
  }
  return (
    <section className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          className="inline-flex items-center gap-2 rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1.5 text-sm text-[var(--kr-gov-text-primary)]"
          key={chip.key}
          onClick={chip.clear}
          type="button"
        >
          <span>{chip.label}</span>
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      ))}
    </section>
  );
}

type DependentScreenPopupProps = {
  menuCode: string;
  menuLabel: string;
  dependentScreenCode: string;
  menuCodeRows: MenuCodeRow[];
  onSave: (menuCode: string, dependentScreenCode: string) => void;
  onClose: () => void;
};

type MenuCodeRow = {
  code: string;
  label: string;
  url: string;
  useAt: string;
  expsrAt: string;
};

function buildMenuPath(code: string, rowMap: Map<string, MenuCodeRow>) {
  const segments: MenuCodeRow[] = [];
  for (const size of [4, 6, 8]) {
    if (code.length >= size) {
      const row = rowMap.get(code.slice(0, size));
      if (row) {
        segments.push(row);
      }
    }
  }
  return segments;
}

function DependentScreenSelectPopup({ menuCode, menuLabel, dependentScreenCode, menuCodeRows, onSave, onClose }: DependentScreenPopupProps) {
  const en = isEnglish();
  const [selectedCode, setSelectedCode] = useState(dependentScreenCode);
  const [screenSearch, setScreenSearch] = useState("");
  const [topCategoryCode, setTopCategoryCode] = useState("");
  const [middleCategoryCode, setMiddleCategoryCode] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden" | "inactive">("all");
  const [sortMode, setSortMode] = useState<"path" | "code" | "name" | "url">("path");

  const menuRowMap = useMemo(() => {
    return new Map(menuCodeRows.map((row) => [row.code, row]));
  }, [menuCodeRows]);

  const selectedScreen = useMemo(() => {
    return selectedCode ? menuRowMap.get(selectedCode) || null : null;
  }, [menuRowMap, selectedCode]);

  const topCategoryOptions = useMemo(() => {
    const usedTopCodes = new Set(menuCodeRows.filter((row) => row.code.length === 8).map((row) => row.code.slice(0, 4)));
    return menuCodeRows
      .filter((row) => row.code.length === 4 && usedTopCodes.has(row.code))
      .sort((left, right) => left.label.localeCompare(right.label, en ? "en" : "ko"));
  }, [menuCodeRows, en]);

  const middleCategoryOptions = useMemo(() => {
    const usedMiddleCodes = new Set(
      menuCodeRows
        .filter((row) => row.code.length === 8 && (!topCategoryCode || row.code.startsWith(topCategoryCode)))
        .map((row) => row.code.slice(0, 6))
    );
    return menuCodeRows
      .filter((row) => row.code.length === 6 && usedMiddleCodes.has(row.code))
      .sort((left, right) => {
        const leftPath = buildMenuPath(left.code, menuRowMap).map((item) => item.label).join(" > ");
        const rightPath = buildMenuPath(right.code, menuRowMap).map((item) => item.label).join(" > ");
        return leftPath.localeCompare(rightPath, en ? "en" : "ko");
      });
  }, [menuCodeRows, menuRowMap, topCategoryCode, en]);

  const availableScreens = useMemo(() => {
    const keyword = screenSearch.trim().toLowerCase();
    return menuCodeRows.filter((row) => {
      if (row.code.length !== 8) return false;
      if (row.code === menuCode) return false;
      if (topCategoryCode && !row.code.startsWith(topCategoryCode)) return false;
      if (middleCategoryCode && !row.code.startsWith(middleCategoryCode)) return false;
      if (statusFilter === "active" && (row.useAt !== "Y" || row.expsrAt === "N")) return false;
      if (statusFilter === "hidden" && (row.useAt !== "Y" || row.expsrAt !== "N")) return false;
      if (statusFilter === "inactive" && row.useAt === "Y") return false;
      if (!keyword) return true;
      const pathText = buildMenuPath(row.code, menuRowMap).map((item) => item.label).join(" > ");
      return [row.code, row.label, row.url, pathText].join(" ").toLowerCase().includes(keyword);
    }).sort((left, right) => {
      const leftPath = buildMenuPath(left.code, menuRowMap).map((item) => item.label).join(" > ");
      const rightPath = buildMenuPath(right.code, menuRowMap).map((item) => item.label).join(" > ");
      if (sortMode === "code") return left.code.localeCompare(right.code);
      if (sortMode === "name") return left.label.localeCompare(right.label, en ? "en" : "ko");
      if (sortMode === "url") return left.url.localeCompare(right.url);
      return leftPath.localeCompare(rightPath, en ? "en" : "ko");
    });
  }, [menuCodeRows, menuCode, menuRowMap, screenSearch, topCategoryCode, middleCategoryCode, statusFilter, sortMode, en]);

  const selectedPath = useMemo(() => {
    if (!selectedScreen) return [];
    return buildMenuPath(selectedScreen.code, menuRowMap);
  }, [menuRowMap, selectedScreen]);

  const targetPath = useMemo(() => {
    return buildMenuPath(menuCode, menuRowMap);
  }, [menuCode, menuRowMap]);

  const screenGroupLabel = (screen: MenuCodeRow) => {
    const path = buildMenuPath(screen.code, menuRowMap);
    const parentPath = path.slice(0, -1).map((item) => item.label).join(" > ");
    return parentPath || (en ? "Top level" : "최상위");
  };

  const screenPathLabel = (screen: MenuCodeRow) => {
    const path = buildMenuPath(screen.code, menuRowMap);
    return path.map((item) => item.label).join(" > ") || screen.label;
  };

  const groupedScreens = useMemo(() => {
    return availableScreens.reduce<Array<{ group: string; items: MenuCodeRow[] }>>((groups, screen) => {
      const group = screenGroupLabel(screen);
      const last = groups[groups.length - 1];
      if (last && last.group === group) {
        last.items.push(screen);
      } else {
        groups.push({ group, items: [screen] });
      }
      return groups;
    }, []);
  }, [availableScreens, menuRowMap, en]);

  const statusLabel = (screen: MenuCodeRow) => {
    if (screen.useAt !== "Y") return en ? "Inactive" : "비활성";
    if (screen.expsrAt === "N") return en ? "Hidden" : "숨김";
    return en ? "Active" : "활성";
  };

  const statusClass = (screen: MenuCodeRow) => {
    if (screen.useAt !== "Y") return "bg-gray-100 text-gray-600";
    if (screen.expsrAt === "N") return "bg-amber-50 text-[#8a5a00]";
    return "bg-green-50 text-green-700";
  };

  const clearFilters = () => {
    setScreenSearch("");
    setTopCategoryCode("");
    setMiddleCategoryCode("");
    setStatusFilter("all");
    setSortMode("path");
  };

  const handleSave = () => {
    onSave(menuCode, selectedCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border)] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--kr-gov-border)] px-4 py-3">
          <h3 className="font-semibold">{en ? "Screen Mapping" : "화면 매핑"}</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
          <section className="space-y-3 overflow-y-auto">
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-surface-subtle)] p-3">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target menu" : "매핑 대상 메뉴"}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--kr-gov-text-primary)]">
                {menuCode}
                {menuLabel && <span className="ml-2 text-gray-600">/ {menuLabel}</span>}
              </p>
              {targetPath.length > 0 && (
                <p className="mt-2 text-xs text-gray-600">{targetPath.map((item) => item.label).join(" > ")}</p>
              )}
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-3">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Selected screen" : "선택된 화면"}</p>
              {selectedScreen ? (
                <div className="mt-2 space-y-2">
                  <p className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{screenPathLabel(selectedScreen)}</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedPath.map((item) => (
                      <span key={item.code} className="gov-chip bg-blue-50 text-[var(--kr-gov-blue)] text-xs">
                        {item.code} {item.label}
                      </span>
                    ))}
                  </div>
                  <p className="break-all text-xs text-gray-500">{selectedScreen.url || (en ? "No URL" : "URL 없음")}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">{en ? "No screen will be mapped." : "매핑을 해제합니다."}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedCode("")}
              className={`gov-btn w-full ${selectedCode ? "gov-btn-outline" : "gov-btn-primary"}`}
            >
              {en ? "Clear mapping" : "매핑 해제"}
            </button>
          </section>
          <section className="flex min-h-0 flex-col">
            <label className="gov-label">{en ? "Select Dependent Screen" : "종속 화면 선택"}</label>
            <div className="relative mb-3">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">search</span>
              <input
                className="gov-input w-full pl-9"
                value={screenSearch}
                onChange={(e) => setScreenSearch(e.target.value)}
                placeholder={en ? "Search by menu path, screen name, code, or URL" : "메뉴 경로, 화면명, 코드, URL로 검색"}
              />
            </div>
            <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Top category" : "대분류"}</span>
                <select
                  className="gov-select w-full"
                  value={topCategoryCode}
                  onChange={(event) => {
                    setTopCategoryCode(event.target.value);
                    setMiddleCategoryCode("");
                  }}
                >
                  <option value="">{en ? "All top menus" : "전체 대메뉴"}</option>
                  {topCategoryOptions.map((item) => (
                    <option key={item.code} value={item.code}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Middle category" : "중분류"}</span>
                <select
                  className="gov-select w-full"
                  value={middleCategoryCode}
                  onChange={(event) => setMiddleCategoryCode(event.target.value)}
                >
                  <option value="">{en ? "All middle menus" : "전체 중메뉴"}</option>
                  {middleCategoryOptions.map((item) => (
                    <option key={item.code} value={item.code}>{buildMenuPath(item.code, menuRowMap).map((pathItem) => pathItem.label).join(" > ")}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "상태"}</span>
                <select
                  className="gov-select w-full"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                >
                  <option value="all">{en ? "All status" : "전체 상태"}</option>
                  <option value="active">{en ? "Active only" : "활성만"}</option>
                  <option value="hidden">{en ? "Hidden only" : "숨김만"}</option>
                  <option value="inactive">{en ? "Inactive only" : "비활성만"}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Sort" : "정렬"}</span>
                <select
                  className="gov-select w-full"
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
                >
                  <option value="path">{en ? "Menu path" : "메뉴 경로순"}</option>
                  <option value="code">{en ? "Code" : "코드순"}</option>
                  <option value="name">{en ? "Screen name" : "화면명순"}</option>
                  <option value="url">{en ? "URL" : "URL순"}</option>
                </select>
              </label>
            </div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <span className="gov-chip bg-gray-100 text-gray-700 text-xs">
                  {en ? `${availableScreens.length} screens` : `화면 ${availableScreens.length}개`}
                </span>
                {topCategoryCode && (
                  <span className="gov-chip bg-blue-50 text-[var(--kr-gov-blue)] text-xs">
                    {menuRowMap.get(topCategoryCode)?.label || topCategoryCode}
                  </span>
                )}
                {middleCategoryCode && (
                  <span className="gov-chip bg-blue-50 text-[var(--kr-gov-blue)] text-xs">
                    {buildMenuPath(middleCategoryCode, menuRowMap).map((item) => item.label).join(" > ")}
                  </span>
                )}
              </div>
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--kr-gov-blue)] hover:underline">
                <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                {en ? "Reset filters" : "필터 초기화"}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
              {groupedScreens.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  {en ? "No screen matches the search." : "검색 조건에 맞는 화면이 없습니다."}
                </div>
              ) : groupedScreens.map((group) => (
                <div key={group.group} className="border-b border-[var(--kr-gov-border-light)] last:border-b-0">
                  <div className="sticky top-0 z-10 border-b border-[var(--kr-gov-border-light)] bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600">
                    {group.group}
                  </div>
                  <div className="divide-y divide-[var(--kr-gov-border-light)]">
                    {group.items.map((screen) => {
                      const checked = selectedCode === screen.code;
                      return (
                        <button
                          key={screen.code}
                          type="button"
                          onClick={() => setSelectedCode(screen.code)}
                          className={`w-full px-3 py-3 text-left transition hover:bg-blue-50 ${checked ? "bg-blue-50 ring-1 ring-inset ring-[var(--kr-gov-blue)]" : "bg-white"}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`material-symbols-outlined mt-0.5 text-[20px] ${checked ? "text-[var(--kr-gov-blue)]" : "text-gray-400"}`}>
                              {checked ? "radio_button_checked" : "radio_button_unchecked"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-[var(--kr-gov-text-primary)]">{screen.label}</span>
                                <span className="gov-chip bg-gray-100 text-gray-700 text-xs">{screen.code}</span>
                                <span className={`gov-chip text-xs ${statusClass(screen)}`}>{statusLabel(screen)}</span>
                              </div>
                              <p className="mt-1 text-xs text-gray-600">{screenPathLabel(screen)}</p>
                              <p className="mt-1 break-all text-xs text-gray-500">{screen.url || (en ? "No URL" : "URL 없음")}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {en ? "Screens are grouped by parent menu so the ownership path is visible before saving." : "저장 전에 어느 상위 메뉴에 속한 화면인지 볼 수 있도록 부모 메뉴별로 묶어 표시합니다."}
            </p>
          </section>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--kr-gov-border)] px-4 py-3">
          <button type="button" onClick={onClose} className="gov-btn gov-btn-outline">
            {en ? "Cancel" : "취소"}
          </button>
          <button type="button" onClick={handleSave} className="gov-btn gov-btn-primary">
            {en ? "Save" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MenuManagementMigrationPage() {
  const en = isEnglish();
  const [menuType, setMenuType] = useState(readMenuTypeFromLocation());
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [useAtFilter, setUseAtFilter] = useState<UseAtFilter>("");
  const [parentCodeValue, setParentCodeValue] = useState("");
  const [codeNm, setCodeNm] = useState("");
  const [codeDc, setCodeDc] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuIcon, setMenuIcon] = useState("web");
  const [useAt, setUseAt] = useState("Y");
  const [isTopMenu, setIsTopMenu] = useState(false);
  const [treeData, setTreeData] = useState<MenuNode[]>([]);
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [mobileDragCode, setMobileDragCode] = useState<string | null>(null);
  const [dependentScreenPopup, setDependentScreenPopup] = useState<{ menuCode: string; menuLabel: string; dependentScreenCode: string } | null>(null);

  const deferredSearchKeyword = useDeferredValue(searchKeyword);
  const pageState = useAsyncValue<MenuManagementPagePayload>(() => fetchMenuManagementPage(menuType), [menuType]);
  const page = pageState.value;

  const rows = useMemo(() => (page?.menuRows || []) as Array<Record<string, unknown>>, [page?.menuRows]);

  const menuTypes = ((page?.menuTypes || []) as Array<Record<string, unknown>>);
  const allGroupMenuOptions = ((page?.groupMenuOptions || []) as Array<Record<string, string>>);
  const groupMenuOptions = useMemo(() => {
    return allGroupMenuOptions.filter((opt) => {
      const code = stringOf(opt, "value");
      return code.length === 4 || code.length === 6;
    });
  }, [allGroupMenuOptions]);
  const menuCodeRows = useMemo(() => rows.map((row: Record<string, unknown>) => ({
    code: stringOf(row, "code").toUpperCase(),
    label: stringOf(row, "label") || stringOf(row, "codeNm") || stringOf(row, "code"),
    url: stringOf(row, "url") || stringOf(row, "menuUrl"),
    useAt: stringOf(row, "useAt") || "Y",
    expsrAt: stringOf(row, "expsrAt") || "Y"
  })), [rows]);

  const filteredTreeData = useMemo(() => {
    const filter = (nodes: MenuNode[]): MenuNode[] => {
      return nodes.reduce<MenuNode[]>((acc, node) => {
        const filteredChildren = filter(node.children);
        const matchesKeyword = !deferredSearchKeyword.trim() || [node.code, node.label, node.url, node.icon].join(" ").toLowerCase().includes(deferredSearchKeyword.toLowerCase());
        const matchesUseAt = !useAtFilter || node.useAt === useAtFilter;
        if (!matchesKeyword && filteredChildren.length === 0) {
          return acc;
        }
        if (!matchesUseAt) {
          return filteredChildren.length > 0 ? acc.concat({ ...node, children: filteredChildren }) : acc;
        }
        if (matchesKeyword) {
          acc.push({ ...node, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filter(treeData);
  }, [treeData, deferredSearchKeyword, useAtFilter]);

  useEffect(() => {
    if (!parentCodeValue && groupMenuOptions.length > 0) {
      setParentCodeValue(stringOf(groupMenuOptions[0], "value"));
    }
  }, [groupMenuOptions, parentCodeValue]);

  useEffect(() => {
    setTreeData(buildMenuTree(rows, { includeExposure: true, includeUseAt: true, mapUrl: (v) => v }));
  }, [rows]);

  useEffect(() => {
    setActionError("");
    setActionMessage("");
    setCodeNm("");
    setCodeDc("");
    setMenuUrl("");
    setMenuIcon("web");
    setUseAt("Y");
    if (groupMenuOptions.length > 0) {
      setParentCodeValue(stringOf(groupMenuOptions[0], "value"));
    }
  }, [menuType]);

  useEffect(() => {
    function syncMenuTypeFromLocation() {
      setMenuType(readMenuTypeFromLocation());
    }
    const navigationEventName = getNavigationEventName();
    window.addEventListener("popstate", syncMenuTypeFromLocation);
    window.addEventListener(navigationEventName, syncMenuTypeFromLocation);
    return () => {
      window.removeEventListener("popstate", syncMenuTypeFromLocation);
      window.removeEventListener(navigationEventName, syncMenuTypeFromLocation);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileDragCode) {
        setMobileDragCode(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileDragCode]);

  const handleToggle = useCallback((code: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const handleExpandAll = () => {
    const allCodes = new Set<string>();
    const collect = (nodes: MenuNode[]) => {
      nodes.forEach((n) => {
        if (n.children.length > 0) {
          allCodes.add(n.code);
          collect(n.children);
        }
      });
    };
    collect(treeData);
    setExpandedCodes(allCodes);
  };

  const handleCollapseAll = () => {
    setExpandedCodes(new Set());
  };

  const handleUpdateMenu = async (code: string, label: string, url: string) => {
    setActionError("");
    setActionMessage("");
    const sourceRow = rows.find((row) => stringOf(row, "code").toUpperCase() === code);
    const normalizedLabel = label.trim();
    const normalizedUrl = url.trim();
    const fallbackNameEn = stringOf(sourceRow || {}, "codeDc") || normalizedLabel;
    const fallbackIcon = stringOf(sourceRow || {}, "menuIcon") || "menu";
    const fallbackUseAt = stringOf(sourceRow || {}, "useAt") || "Y";
    if (!normalizedLabel || !normalizedUrl) {
      setActionError(en ? "Menu name and URL are required." : "메뉴명과 경로는 필수입니다.");
      return;
    }
    try {
      await postLocalizedValidatedJson(
        "/admin/system/runtime-command/execute",
        "/en/admin/system/runtime-command/execute",
        {
          commandId: "admin.menu.updatePage",
          params: {
            menuType,
            code,
            codeNm: normalizedLabel,
            codeDc: fallbackNameEn,
            menuUrl: normalizedUrl,
            menuIcon: fallbackIcon,
            useAt: fallbackUseAt,
            searchKeyword,
            searchUrl: ""
          }
        },
        en ? "Failed to update menu." : "메뉴 수정에 실패했습니다."
      );
      refreshAdminMenuTree();
      setTreeData((prev) => updateNodeMenuBasics(prev, code, normalizedLabel, normalizedUrl));
      setActionMessage(en ? "Menu updated successfully." : "메뉴가 수정되었습니다.");
      await pageState.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update menu.");
    }
  };

  const updateNodeMenuBasics = (nodes: MenuNode[], code: string, label: string, url: string): MenuNode[] => {
    return nodes.map((node) => {
      if (node.code === code) {
        return { ...node, label, url };
      }
      if (node.children.length > 0) {
        return { ...node, children: updateNodeMenuBasics(node.children, code, label, url) };
      }
      return node;
    });
  };

  const handleDeleteMenu = async (code: string) => {
    if (!confirm(en ? "Delete this menu?" : "이 메뉴를 삭제하시겠습니까?")) return;
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    body.set("code", code);
    try {
      await postFormUrlEncoded(
        buildLocalizedPath("/admin/system/menu/delete-page", "/en/admin/system/menu/delete-page"),
        body
      );
      refreshAdminMenuTree();
      setActionMessage(en ? "Menu deleted." : "메뉴가 삭제되었습니다.");
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete menu.");
    }
  };

  const handleToggleVisibility = async (code: string, currentExpsrAt: string) => {
    setActionError("");
    setActionMessage("");
    const newExpsrAt = currentExpsrAt === "Y" ? "N" : "Y";
    try {
      await postLocalizedValidatedJson(
        "/admin/system/runtime-command/execute",
        "/en/admin/system/runtime-command/execute",
        {
          commandId: "admin.menu.toggleExposure",
          params: { menuType, menuCode: code, expsrAt: newExpsrAt }
        },
        en ? "Failed to toggle visibility." : "메뉴 노출 설정에 실패했습니다."
      );
      refreshAdminMenuTree();
      setTreeData((prev) => updateNodeExpsrAt(prev, code, newExpsrAt));
      setActionMessage(en ? `Menu ${newExpsrAt === "Y" ? "visible" : "hidden"}` : `메뉴가 ${newExpsrAt === "Y" ? "보임" : "안보임"}으로 설정되었습니다.`);
      await pageState.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to toggle visibility.");
    }
  };

  const updateNodeExpsrAt = (nodes: MenuNode[], code: string, expsrAt: string): MenuNode[] => {
    return nodes.map((node) => {
      if (node.code === code) {
        return { ...node, expsrAt };
      }
      if (node.children.length > 0) {
        return { ...node, children: updateNodeExpsrAt(node.children, code, expsrAt) };
      }
      return node;
    });
  };

  const handleToggleActivation = async (code: string, currentUseAt: string) => {
    const nextUseAt = currentUseAt === "Y" ? "N" : "Y";
    if (nextUseAt === "N" && !window.confirm(en
      ? "Deactivate this menu? Direct URL access and connected functions will stop."
      : "이 메뉴를 비활성화하시겠습니까? URL 직접 접근과 연결 기능도 중지됩니다.")) return;
    setActionError(""); setActionMessage("");
    try {
      await postLocalizedValidatedJson("/admin/system/runtime-command/execute", "/en/admin/system/runtime-command/execute", {
        commandId: "admin.menu.toggleActivation", params: { menuType, menuCode: code, useAt: nextUseAt }
      }, en ? "Failed to update activation." : "메뉴 활성 상태 변경에 실패했습니다.");
      const update = (nodes: MenuNode[]): MenuNode[] => nodes.map((node) => node.code === code
        ? { ...node, useAt: nextUseAt }
        : { ...node, children: update(node.children) });
      setTreeData(update);
      refreshAdminMenuTree();
      setActionMessage(nextUseAt === "Y" ? (en ? "Menu activated." : "메뉴가 활성화되었습니다.") : (en ? "Menu deactivated." : "메뉴가 비활성화되었습니다."));
      await pageState.reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : String(error)); }
  };

  const handleOpenDependentScreen = (code: string) => {
    const findNode = (nodes: MenuNode[]): MenuNode | null => {
      for (const node of nodes) {
        if (node.code === code) return node;
        const found = findNode(node.children);
        if (found) return found;
      }
      return null;
    };
    const node = findNode(treeData);
    setDependentScreenPopup({
      menuCode: code,
      menuLabel: node?.label || "",
      dependentScreenCode: node?.dependentScreenCode || ""
    });
  };

  const handleDependentScreenSave = async (menuCode: string, dependentScreenCode: string) => {
    setActionError("");
    setActionMessage("");
    try {
      await postLocalizedValidatedJson(
        "/admin/system/runtime-command/execute",
        "/en/admin/system/runtime-command/execute",
        {
          commandId: "admin.menu.updateDependentScreen",
          params: { menuType, menuCode, dependentScreenCode }
        },
        en ? "Failed to update dependent screen." : "종속 화면 저장에 실패했습니다."
      );
      refreshAdminMenuTree();
      setTreeData((prev) => updateNodeDependentScreen(prev, menuCode, dependentScreenCode));
      setDependentScreenPopup(null);
      setActionMessage(en ? "Dependent screen updated." : "종속 화면이 저장되었습니다.");
      await pageState.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update dependent screen.");
    }
  };

  const updateNodeDependentScreen = (nodes: MenuNode[], code: string, dependentScreenCode: string): MenuNode[] => {
    return nodes.map((node) => {
      if (node.code === code) {
        return { ...node, dependentScreenCode };
      }
      if (node.children.length > 0) {
        return { ...node, children: updateNodeDependentScreen(node.children, code, dependentScreenCode) };
      }
      return node;
    });
  };

  const findSuggestedPageCode = () => buildSuggestedPageCode(parentCodeValue, menuCodeRows);

  const validateCreateForm = () => {
    if (!isTopMenu && !parentCodeValue) return en ? "Select a parent menu." : "상위 메뉴를 선택하세요.";
    if (isTopMenu && parentCodeValue.length !== 4) return en ? "Enter 4-character code for top menu." : "대메뉴는 4자리 코드를 입력하세요.";
    if (!codeNm.trim()) return en ? "Enter menu name." : "메뉴명을 입력하세요.";
    if (!menuUrl.trim()) return en ? "Enter URL." : "URL을 입력하세요.";
    if (!menuUrl.startsWith("/")) return en ? "URL must start with /." : "URL은 /로 시작해야 합니다.";
    if (menuType === "ADMIN" && !menuUrl.startsWith("/admin/")) return en ? "Admin URL must start with /admin/." : "관리자 URL은 /admin/으로 시작해야 합니다.";
    if (menuType === "USER" && (!menuUrl.startsWith("/") || menuUrl.startsWith("/admin/"))) return en ? "Home URL must be a non-admin absolute path." : "홈 URL은 /로 시작하는 비관리자 경로여야 합니다.";
    return "";
    if (!codeNm.trim()) return en ? "Enter menu name." : "메뉴명을 입력하세요.";
    if (!menuUrl.trim()) return en ? "Enter URL." : "URL을 입력하세요.";
    if (!menuUrl.startsWith("/")) return en ? "URL must start with /." : "URL은 /로 시작해야 합니다.";
    if (menuType === "ADMIN" && !menuUrl.startsWith("/admin/")) return en ? "Admin URL must start with /admin/." : "관리자 URL은 /admin/으로 시작해야 합니다.";
    if (menuType === "USER" && (!menuUrl.startsWith("/") || menuUrl.startsWith("/admin/"))) return en ? "Home URL must be a non-admin absolute path." : "홈 URL은 /로 시작하는 비관리자 경로여야 합니다.";
    return "";
  };

  const handleCreatePage = async () => {
    const error = validateCreateForm();
    if (error) {
      setActionError(error);
      return;
    }
    setActionError("");
    setActionMessage("");
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    if (isTopMenu) {
      body.set("isTopMenu", "true");
      body.set("directCode", parentCodeValue);  // User-inputted 4-char code
    } else {
      body.set("parentCode", parentCodeValue);
    }
    body.set("codeNm", codeNm.trim());
    body.set("codeDc", codeDc.trim());
    body.set("menuUrl", menuUrl.trim());
    body.set("menuIcon", menuIcon);
    body.set("useAt", useAt);
    try {
      const result = await postFormUrlEncoded<{ success?: boolean; message?: string }>(
        buildLocalizedPath("/admin/system/menu/create-page", "/en/admin/system/menu/create-page"),
        body
      );
      if (!result.success) {
        throw new Error(result.message || "Failed");
      }
      refreshAdminMenuTree();
      setActionMessage(result.message || (en ? "Menu created." : "메뉴가 생성되었습니다."));
      setCodeNm("");
      setCodeDc("");
      setMenuUrl("");
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create menu.");
    }
  };

  const handleDragStart = (e: React.DragEvent, code: string) => {
    e.dataTransfer.setData("text/plain", code);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, targetCode: string) => {
    e.preventDefault();
    const draggedCode = e.dataTransfer.getData("text/plain");
    if (draggedCode === targetCode) return;

    console.log("[MenuManagement] Drop: dragged=", draggedCode, "target=", targetCode);

    setTreeData((prev) => {
      const clone = JSON.parse(JSON.stringify(prev)) as MenuNode[];
      let draggedNode: MenuNode | null = null;
      let draggedOriginalIndex = -1;
      let targetOriginalIndex = -1;

      // Find and track both indices BEFORE making changes
      const findIndices = (nodes: MenuNode[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].code === draggedCode) {
            draggedOriginalIndex = i;
            draggedNode = nodes[i];
          }
          if (nodes[i].code === targetCode) {
            targetOriginalIndex = i;
          }
          if (draggedOriginalIndex >= 0 && targetOriginalIndex >= 0) {
            return true;  // Found both
          }
          if (findIndices(nodes[i].children)) return true;
        }
        return false;
      };

      if (!findIndices(clone) || !draggedNode) {
        console.log("[MenuManagement] Drop: could not find nodes");
        return prev;
      }

      // Now remove and insert using the tracked indices
      const findAndRemove = (nodes: MenuNode[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].code === draggedCode) {
            nodes.splice(i, 1);
            return true;
          }
          if (findAndRemove(nodes[i].children)) return true;
        }
        return false;
      };

      const findAndInsert = (nodes: MenuNode[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].code === targetCode) {
            // Insert draggedNode AFTER target if dragged was BEFORE target
            // Insert draggedNode BEFORE target if dragged was AFTER target
            const insertIdx = draggedOriginalIndex < targetOriginalIndex ? i + 1 : i;
            nodes.splice(insertIdx, 0, draggedNode!);
            return true;
          }
          if (findAndInsert(nodes[i].children)) return true;
        }
        return false;
      };

      if (!findAndRemove(clone)) {
        console.log("[MenuManagement] Drop: could not remove dragged node");
        return prev;
      }

      if (!findAndInsert(clone)) {
        console.log("[MenuManagement] Drop: could not insert at target");
        return prev;
      }

      updateMenuSortOrders(clone);
      console.log("[MenuManagement] Drop: new treeData ready, payload=", flattenMenuOrderPayload(clone).join(","));
      return clone;
    });
  };

  const handleMobileDragStart = useCallback((code: string) => {
    console.log("[MenuManagement] Mobile drag start:", code);
    setMobileDragCode((prev) => prev === code ? null : code);
  }, []);

  const handleMobileDrop = useCallback((targetCode: string) => {
    if (!mobileDragCode || mobileDragCode === targetCode) {
      setMobileDragCode(null);
      return;
    }
    console.log("[MenuManagement] Mobile drop:", mobileDragCode, "->", targetCode);
    setTreeData((prev) => {
      const clone = JSON.parse(JSON.stringify(prev)) as MenuNode[];
      let draggedNode: MenuNode | null = null;
      let draggedOriginalIndex = -1;
      let targetOriginalIndex = -1;

      const findIndices = (nodes: MenuNode[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].code === mobileDragCode) {
            draggedOriginalIndex = i;
            draggedNode = nodes[i];
          }
          if (nodes[i].code === targetCode) {
            targetOriginalIndex = i;
          }
          if (draggedOriginalIndex >= 0 && targetOriginalIndex >= 0) {
            return true;
          }
          if (findIndices(nodes[i].children)) return true;
        }
        return false;
      };

      if (!findIndices(clone) || !draggedNode) return prev;

      const findAndRemove = (nodes: MenuNode[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].code === mobileDragCode) {
            nodes.splice(i, 1);
            return true;
          }
          if (findAndRemove(nodes[i].children)) return true;
        }
        return false;
      };

      const findAndInsert = (nodes: MenuNode[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].code === targetCode) {
            const insertIdx = draggedOriginalIndex < targetOriginalIndex ? i + 1 : i;
            nodes.splice(insertIdx, 0, draggedNode!);
            return true;
          }
          if (findAndInsert(nodes[i].children)) return true;
        }
        return false;
      };

      if (!findAndRemove(clone)) return prev;
      if (!findAndInsert(clone)) return prev;

      updateMenuSortOrders(clone);
      console.log("[MenuManagement] Mobile drop complete, payload=", flattenMenuOrderPayload(clone).join(","));
      return clone;
    });
    setMobileDragCode(null);
  }, [mobileDragCode]);

const handleSaveOrder = async () => {
    if (pageState.loading) {
      setActionError(en ? "Page is still loading. Please wait." : "페이지 로딩 중입니다. 잠시만 기다려주세요.");
      return;
    }
    setActionError("");
    setActionMessage("");
    const prefix = menuType === "ADMIN" ? "A" : menuType === "USER" ? "H" : "";
    const allCodes = flattenMenuOrderPayload(treeData);
    const filteredCodes = prefix ? allCodes.filter(code => code.startsWith(prefix)) : allCodes;
    const payload = filteredCodes.join(",");
    const codesOnly = payload.split(",").map(c => c.split(":")[0]);
    console.log("[MenuManagement] Saving order, menuType=", menuType, "prefix=", prefix, "total:", allCodes.length, "filtered:", codesOnly.length);
    console.log("[MenuManagement] Filtered codes:", codesOnly.join(","));
    if (codesOnly.length === 0) {
      setActionError(en ? "No menu to save." : "저장할 메뉴가 없습니다.");
      return;
    }
    const body = new URLSearchParams();
    body.set("menuType", menuType);
    body.set("orderPayload", payload);
    try {
      const result = await postFormUrlEncoded<{ success?: boolean; message?: string }>(
        buildLocalizedPath("/admin/system/menu/order", "/en/admin/system/menu/order"),
        body
      );
      console.log("[MenuManagement] Save order response:", result);
      if (result.success !== true) {
        setActionError(result.message || (en ? "Failed to save order." : "순서 저장에 실패했습니다."));
        return;
      }
      refreshAdminMenuTree();
      setActionMessage(result.message || (en ? "Order saved." : "순서가 저장되었습니다."));
    } catch (err) {
      console.error("[MenuManagement] Save order error:", err);
      setActionError(err instanceof Error ? err.message : "Failed to save order.");
    }
  };

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Menu Management" : "메뉴 관리" }
      ]}
      title={en ? "Menu Management" : "메뉴 관리"}
    >
      <AdminWorkspacePageFrame>
        {actionMessage && <PageStatusNotice tone="success">{actionMessage}</PageStatusNotice>}
        {actionError && <PageStatusNotice tone="error">{actionError}</PageStatusNotice>}
        {pageState.error && <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice>}

        <UseAtFilterBar en={en} onChange={setUseAtFilter} useAtFilter={useAtFilter} />
          <ActiveFilterChipBar
            chips={(
              [
                searchKeyword ? {
                  key: "search",
                  label: en ? `Search: ${searchKeyword}` : `검색: ${searchKeyword}`,
                  clear: () => setSearchKeyword("")
                } : null,
                useAtFilter ? {
                  key: "useAt",
                  label: en ? `Use: ${useAtFilter === "Y" ? "Active" : "Inactive"}` : `사용: ${useAtFilter === "Y" ? "사용중" : "미사용"}`,
                  clear: () => setUseAtFilter("")
                } : null
              ].filter((c): c is FilterChip => c !== null)
            )}
          />

          <div className="mb-4 gov-card">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <label className="gov-label" htmlFor="menuSearch">{en ? "Search menus" : "메뉴 검색"}</label>
                <input
                  className="gov-input"
                  id="menuSearch"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder={en ? "Code, name, URL..." : "코드, 메뉴명, URL..."}
                />
              </div>
              <div>
                <label className="gov-label" htmlFor="menuType">{en ? "Menu Type" : "메뉴 유형"}</label>
                <select className="gov-select" id="menuType" value={menuType} onChange={(e) => {
                  const nextType = e.target.value;
                  setMenuType(nextType);
                  const nextUrl = new URL(window.location.href);
                  nextUrl.searchParams.set("menuType", nextType);
                  window.history.replaceState({}, "", nextUrl);
                }}>
                  {menuTypes.map((t) => (
                    <option key={stringOf(t, "value")} value={stringOf(t, "value")}>{stringOf(t, "label")}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="space-y-4">
            <div className="gov-card overflow-hidden">
              <GridToolbar
                title={en ? "Menu Tree" : "메뉴 트리"}
                actions={
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleExpandAll} className="gov-btn gov-btn-outline">
                      <span className="material-symbols-outlined text-[16px]">unfold_more</span>
                      <span className="hidden sm:inline">{en ? "Expand" : "펼치기"}</span>
                    </button>
                    <button type="button" onClick={handleCollapseAll} className="gov-btn gov-btn-outline">
                      <span className="material-symbols-outlined text-[16px]">unfold_less</span>
                      <span className="hidden sm:inline">{en ? "Collapse" : "접기"}</span>
                    </button>
                    <button type="button" onClick={handleSaveOrder} className="gov-btn gov-btn-primary">
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>{en ? "Save Order" : "순서 저장"}</span>
                    </button>
                  </div>
                }
              />
              <div className="max-h-[60vh] overflow-y-auto" onDragOver={(e) => e.preventDefault()}>
                {filteredTreeData.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {en ? "No menus found." : "메뉴가 없습니다."}
                  </div>
                ) : (
                  <MenuTree
                    nodes={filteredTreeData}
                    expandedCodes={expandedCodes}
                    onToggle={handleToggle}
                    onUpdate={handleUpdateMenu}
                    onDelete={handleDeleteMenu}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    mobileDragCode={mobileDragCode}
                    onMobileDragStart={handleMobileDragStart}
                    onMobileDrop={handleMobileDrop}
                    onToggleVisibility={handleToggleVisibility}
                    onToggleActivation={handleToggleActivation}
                    onOpenDependentScreen={handleOpenDependentScreen}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="gov-card overflow-hidden">
              <GridToolbar title={en ? "Add New Menu" : "새 메뉴 등록"} />
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTopMenu}
                      onChange={(e) => {
                        setIsTopMenu(e.target.checked);
                        if (e.target.checked) {
                          // Auto-generate 4-char top menu code
                          let maxSuffix = 0;
                          const prefix = "A";
                          menuCodeRows.forEach((row) => {
                            if (row.code.length === 4 && row.code.startsWith(prefix)) {
                              const suffix = Number(row.code.slice(1));
                              if (Number.isFinite(suffix) && suffix > maxSuffix) {
                                maxSuffix = suffix;
                              }
                            }
                          });
                          const newCode = `${prefix}${String(maxSuffix + 1).padStart(3, "0")}`;
                          setParentCodeValue(newCode);
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">{en ? "Create as Top Menu (4-char)" : "대메뉴로 등록 (4자리)"}</span>
                  </label>
                </div>

                {isTopMenu ? (
                  <div>
                    <label className="gov-label">{en ? "Top Menu Code (4 chars)" : "대메뉴 코드 (4자리)"}</label>
                    <input
                      className="gov-input"
                      maxLength={4}
                      value={parentCodeValue}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
                        setParentCodeValue(val);
                      }}
                      placeholder={en ? "e.g. A009" : "예: A009"}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="gov-label">{en ? "Parent Menu" : "상위 메뉴"}</label>
                    <ParentSelector
                      treeData={treeData}
                      value={parentCodeValue}
                      onChange={(code) => {
                        setParentCodeValue(code);
                      }}
                    />
                  </div>
                )}

                <div>
                  <label className="gov-label">{en ? "New Code" : "생성 코드"}</label>
                  <input
                    className="gov-input bg-gray-50"
                    readOnly
                    value={isTopMenu ? parentCodeValue.toUpperCase() : findSuggestedPageCode()}
                    placeholder={isTopMenu ? "" : (en ? "Select a parent menu first" : "상위 메뉴를 먼저 선택하세요")}
                  />
                </div>

                <div>
                  <label className="gov-label" htmlFor="codeNm">{en ? "Menu Name" : "메뉴명"}</label>
                  <input
                    className="gov-input"
                    id="codeNm"
                    value={codeNm}
                    onChange={(e) => setCodeNm(e.target.value)}
                    placeholder={en ? "Enter menu name" : "메뉴명을 입력하세요"}
                  />
                </div>

                <div>
                  <label className="gov-label" htmlFor="codeDc">{en ? "English Name" : "영문 메뉴명"}</label>
                  <input
                    className="gov-input"
                    id="codeDc"
                    value={codeDc}
                    onChange={(e) => setCodeDc(e.target.value)}
                    placeholder={en ? "English name" : "영문 메뉴명"}
                  />
                </div>

                <div>
                  <label className="gov-label" htmlFor="menuUrl">{en ? "URL" : "URL"}</label>
                  <input
                    className="gov-input"
                    id="menuUrl"
                    value={menuUrl}
                    onChange={(e) => setMenuUrl(e.target.value)}
                    placeholder={menuType === "USER" ? "/emission/..." : "/admin/..."}
                  />
                </div>

                <div>
                  <label className="gov-label">{en ? "Icon" : "아이콘"}</label>
                  <IconPicker value={menuIcon} onChange={setMenuIcon} />
                </div>

                <div>
                  <label className="gov-label" htmlFor="useAt">{en ? "Status" : "상태"}</label>
                  <select className="gov-select" id="useAt" value={useAt} onChange={(e) => setUseAt(e.target.value)}>
                    <option value="Y">{en ? "Active" : "사용"}</option>
                    <option value="N">{en ? "Inactive" : "미사용"}</option>
                  </select>
                </div>

                <button type="button" onClick={handleCreatePage} className="gov-btn gov-btn-primary w-full">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>{en ? "Create Menu" : "메뉴 생성"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        {dependentScreenPopup && (
          <DependentScreenSelectPopup
            menuCode={dependentScreenPopup.menuCode}
            menuLabel={dependentScreenPopup.menuLabel}
            dependentScreenCode={dependentScreenPopup.dependentScreenCode}
            menuCodeRows={menuCodeRows}
            onSave={handleDependentScreenSave}
            onClose={() => setDependentScreenPopup(null)}
          />
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
