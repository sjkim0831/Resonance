import { useState } from "react";
import type {
  ScreenBuilderAutoReplacePreviewItem,
  ScreenBuilderComponentRegistryItem,
  ScreenBuilderComponentUsage,
  ScreenBuilderNode,
  ScreenBuilderRegistryScanItem
} from "../../../lib/api/platformTypes";
import {
  createAiNodeTreeInputRow,
  type AiNodeTreeInputRow,
  type BuilderTemplateType
} from "../shared/screenBuilderShared";

export function useScreenBuilderWorkspaceState(en: boolean) {
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewNodes, setPreviewNodes] = useState<ScreenBuilderNode[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [previewMode, setPreviewMode] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [selectedTemplateType, setSelectedTemplateType] = useState<BuilderTemplateType>("EDIT_PAGE");
  const [componentRegistry, setComponentRegistry] = useState<ScreenBuilderComponentRegistryItem[]>([]);
  const [selectedRegistryComponentId, setSelectedRegistryComponentId] = useState("");
  const [registryStatusFilter, setRegistryStatusFilter] = useState<"ALL" | "ACTIVE" | "DEPRECATED">("ALL");
  const [registryTypeFilter, setRegistryTypeFilter] = useState("ALL");
  const [registryUsageRows, setRegistryUsageRows] = useState<ScreenBuilderComponentUsage[]>([]);
  const [registryUsagePreviewMap, setRegistryUsagePreviewMap] = useState<Record<string, ScreenBuilderComponentUsage[]>>({});
  const [registryUsageLoading, setRegistryUsageLoading] = useState(false);
  const [copiedButtonStyleId, setCopiedButtonStyleId] = useState("");
  const [registryEditorType, setRegistryEditorType] = useState("");
  const [registryEditorLabel, setRegistryEditorLabel] = useState("");
  const [registryEditorDescription, setRegistryEditorDescription] = useState("");
  const [registryEditorStatus, setRegistryEditorStatus] = useState("ACTIVE");
  const [registryEditorReplacementId, setRegistryEditorReplacementId] = useState("");
  const [registryEditorPropsJson, setRegistryEditorPropsJson] = useState("{}");
  const [registryScanRows, setRegistryScanRows] = useState<ScreenBuilderRegistryScanItem[]>([]);
  const [autoReplacePreviewItems, setAutoReplacePreviewItems] = useState<ScreenBuilderAutoReplacePreviewItem[]>([]);
  const [aiNodeTreeRows, setAiNodeTreeRows] = useState<AiNodeTreeInputRow[]>([
    createAiNodeTreeInputRow({
      componentId: "core.section",
      alias: "basicSection",
      propsJson: '{ "title": "AI 기본 섹션" }'
    }),
    createAiNodeTreeInputRow({
      componentId: "core.input",
      parentAlias: "basicSection",
      propsJson: '{ "label": "회사명", "placeholder": "회사명을 입력하세요." }'
    })
  ]);

  function updateAiNodeTreeRow(index: number, field: keyof AiNodeTreeInputRow, value: string) {
    setAiNodeTreeRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function addAiNodeTreeRow() {
    setAiNodeTreeRows((current) => [...current, createAiNodeTreeInputRow()]);
  }

  function removeAiNodeTreeRow(index: number) {
    setAiNodeTreeRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function copyButtonStyleId(styleGroupId: string) {
    try {
      await navigator.clipboard.writeText(styleGroupId);
      setCopiedButtonStyleId(styleGroupId);
      window.setTimeout(() => {
        setCopiedButtonStyleId((current) => current === styleGroupId ? "" : current);
      }, 1500);
    } catch {
      setSaveError(en ? "Failed to copy button style id." : "버튼 스타일 ID를 복사하지 못했습니다.");
    }
  }

  return {
    addAiNodeTreeRow,
    aiNodeTreeRows,
    autoReplacePreviewItems,
    componentRegistry,
    copiedButtonStyleId,
    copyButtonStyleId,
    message,
    previewLoading,
    previewMessage,
    previewMode,
    previewNodes,
    registryEditorDescription,
    registryEditorLabel,
    registryEditorPropsJson,
    registryEditorReplacementId,
    registryEditorStatus,
    registryEditorType,
    registryScanRows,
    registryStatusFilter,
    registryTypeFilter,
    registryUsageLoading,
    registryUsagePreviewMap,
    registryUsageRows,
    removeAiNodeTreeRow,
    saveError,
    saving,
    selectedRegistryComponentId,
    selectedTemplateType,
    setAutoReplacePreviewItems,
    setComponentRegistry,
    setMessage,
    setPreviewLoading,
    setPreviewMessage,
    setPreviewMode,
    setPreviewNodes,
    setRegistryEditorDescription,
    setRegistryEditorLabel,
    setRegistryEditorPropsJson,
    setRegistryEditorReplacementId,
    setRegistryEditorStatus,
    setRegistryEditorType,
    setRegistryScanRows,
    setRegistryStatusFilter,
    setRegistryTypeFilter,
    setRegistryUsageLoading,
    setRegistryUsagePreviewMap,
    setRegistryUsageRows,
    setSaveError,
    setSaving,
    setSelectedRegistryComponentId,
    setSelectedTemplateType,
    updateAiNodeTreeRow
  };
}
