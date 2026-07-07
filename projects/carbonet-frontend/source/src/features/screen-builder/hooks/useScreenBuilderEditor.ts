import { useEffect, useMemo, useState } from "react";
import type {
  ScreenBuilderComponentRegistryItem,
  ScreenBuilderEventBinding,
  ScreenBuilderNode,
  ScreenBuilderPagePayload,
  ScreenBuilderPaletteItem,
  ScreenCommandPagePayload
} from "../../../lib/api/platformTypes";
import {
  blankPropsFor,
  buildNodeTreeRows,
  buildTemplatePresetNodes,
  collectDescendantIds,
  duplicateNodeTree,
  filterPaletteByTemplate,
  type BuilderTemplateType
} from "../shared/screenBuilderShared";
import { sortScreenBuilderNodes } from "../shared/screenBuilderUtils";

type ScreenCommandApi = NonNullable<ScreenCommandPagePayload["page"]["apis"]>[number];

type Params = {
  availableApis: ScreenCommandApi[];
  componentRegistry: ScreenBuilderComponentRegistryItem[];
  en: boolean;
  page: ScreenBuilderPagePayload | undefined;
  selectedTemplateType: BuilderTemplateType;
  setMessage: (message: string) => void;
};

export function useScreenBuilderEditor({
  availableApis,
  componentRegistry,
  en,
  page,
  selectedTemplateType,
  setMessage
}: Params) {
  const [nodes, setNodes] = useState<ScreenBuilderNode[]>([]);
  const [events, setEvents] = useState<ScreenBuilderEventBinding[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [dragNodeId, setDragNodeId] = useState("");
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<string[]>([]);
  const [componentLabel, setComponentLabel] = useState("");
  const [componentDescription, setComponentDescription] = useState("");
  const [replacementComponentId, setReplacementComponentId] = useState("");

  useEffect(() => {
    if (!page) {
      return;
    }
    setNodes(sortScreenBuilderNodes(page.nodes || []));
    setEvents(page.events || []);
    setSelectedNodeId((current) => {
      const available = new Set((page.nodes || []).map((item) => item.nodeId));
      if (current && available.has(current)) {
        return current;
      }
      return (page.nodes || [])[1]?.nodeId || (page.nodes || [])[0]?.nodeId || "";
    });
  }, [page]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.nodeId === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId]
  );
  const collapsedNodeIdSet = useMemo(() => new Set(collapsedNodeIds), [collapsedNodeIds]);
  const nodeTreeRows = useMemo(() => buildNodeTreeRows(nodes, collapsedNodeIdSet), [collapsedNodeIdSet, nodes]);
  const registryMap = useMemo(() => new Map(componentRegistry.map((item) => [item.componentId, item])), [componentRegistry]);
  const selectedRegistryComponent = useMemo(
    () => componentRegistry.find((item) => item.componentId === replacementComponentId) || null,
    [componentRegistry, replacementComponentId]
  );
  const selectedEvent = useMemo(
    () => events.find((event) => event.nodeId === selectedNode?.nodeId) || null,
    [events, selectedNode]
  );
  const selectedApi = useMemo(
    () => availableApis.find((api) => api.apiId === String(selectedEvent?.actionConfig?.apiId || "")) || null,
    [availableApis, selectedEvent]
  );
  const selectedNodeProps = selectedNode?.props || {};
  const filteredPalette = useMemo(
    () => filterPaletteByTemplate(page?.componentPalette || [], selectedTemplateType),
    [page?.componentPalette, selectedTemplateType]
  );

  useEffect(() => {
    if (!selectedNode) {
      setComponentLabel("");
      setComponentDescription("");
      setReplacementComponentId("");
      return;
    }
    const linked = selectedNode.componentId ? registryMap.get(String(selectedNode.componentId)) : null;
    setComponentLabel(String(linked?.label || selectedNode.props?.label || selectedNode.props?.title || selectedNode.props?.text || ""));
    setComponentDescription(String(linked?.description || ""));
    setReplacementComponentId(String(selectedNode.componentId || ""));
  }, [registryMap, selectedNode]);

  function updateSelectedNodeField(field: string, value: unknown) {
    if (!selectedNode) {
      return;
    }
    const nextProps = { ...(selectedNode.props || {}), [field]: value };
    setNodes((current) => current.map((node) => node.nodeId === selectedNode.nodeId ? { ...node, props: nextProps } : node));
  }

  function applyRegistryComponent(component: ScreenBuilderComponentRegistryItem) {
    if (!selectedNode || !component) {
      return;
    }
    setNodes((current) => current.map((node) => node.nodeId === selectedNode.nodeId
      ? {
        ...node,
        componentId: component.componentId,
        componentType: component.componentType || node.componentType,
        props: Object.keys(component.propsTemplate || {}).length
          ? { ...(component.propsTemplate || {}) }
          : { ...(node.props || {}) }
      }
      : node));
    setReplacementComponentId(component.componentId);
    setComponentLabel(component.label || "");
    setComponentDescription(component.description || "");
    setMessage(en ? `Applied component ${component.componentId}.` : `${component.componentId} 컴포넌트로 대체했습니다.`);
  }

  function handleReplaceSelectedComponent() {
    if (!selectedRegistryComponent || !selectedNode) {
      return;
    }
    applyRegistryComponent(selectedRegistryComponent);
  }

  function addNode(item: ScreenBuilderPaletteItem) {
    const rootNode = nodes.find((node) => node.componentType === "page");
    const selected = selectedNode || rootNode || null;
    const canContainChildren = selected && (selected.componentType === "page" || selected.componentType === "section");
    const parentNodeId = item.componentType === "section"
      ? (rootNode?.nodeId || "root")
      : (canContainChildren ? selected?.nodeId : (selected?.parentNodeId || rootNode?.nodeId || "root"));
    const nextNodeId = `${item.componentType}-${Date.now()}`;
    const nextNode: ScreenBuilderNode = {
      nodeId: nextNodeId,
      componentId: "",
      parentNodeId,
      componentType: item.componentType,
      slotName: item.componentType === "button" ? "actions" : "content",
      sortOrder: nodes.length,
      props: blankPropsFor(item.componentType)
    };
    setNodes((current) => sortScreenBuilderNodes([...current, nextNode]).map((node, index) => ({ ...node, sortOrder: index })));
    setSelectedNodeId(nextNodeId);
  }

  function removeSelectedNode() {
    if (!selectedNode || selectedNode.componentType === "page") {
      return;
    }
    const removeIds = new Set([selectedNode.nodeId, ...collectDescendantIds(nodes, selectedNode.nodeId)]);
    const nextNodes = sortScreenBuilderNodes(nodes.filter((node) => !removeIds.has(node.nodeId))).map((node, index) => ({ ...node, sortOrder: index }));
    setNodes(nextNodes);
    setEvents((current) => current.filter((event) => !removeIds.has(event.nodeId)));
    setSelectedNodeId(nextNodes[1]?.nodeId || nextNodes[0]?.nodeId || "");
  }

  function duplicateSelectedNode() {
    if (!selectedNode || selectedNode.componentType === "page") {
      return;
    }
    const { clonedNodes, clonedEvents, topNodeId } = duplicateNodeTree(nodes, events, selectedNode.nodeId);
    setNodes((current) => sortScreenBuilderNodes([...current, ...clonedNodes]).map((node, index) => ({ ...node, sortOrder: index })));
    setEvents((current) => [...current, ...clonedEvents]);
    setSelectedNodeId(topNodeId);
  }

  function moveSelectedNode(direction: -1 | 1) {
    if (!selectedNode) {
      return;
    }
    const ordered = sortScreenBuilderNodes(nodes);
    const index = ordered.findIndex((node) => node.nodeId === selectedNode.nodeId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    setNodes(next.map((node, order) => ({ ...node, sortOrder: order })));
  }

  function reorderNodes(sourceNodeId: string, targetNodeId: string) {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      return;
    }
    const ordered = sortScreenBuilderNodes(nodes);
    const sourceIndex = ordered.findIndex((node) => node.nodeId === sourceNodeId);
    const targetIndex = ordered.findIndex((node) => node.nodeId === targetNodeId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    const next = [...ordered];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setNodes(next.map((node, index) => ({ ...node, sortOrder: index })));
  }

  function ensureSelectedEvent() {
    if (!selectedNode) {
      return null;
    }
    const existing = events.find((event) => event.nodeId === selectedNode.nodeId);
    if (existing) {
      return existing;
    }
    const nextEvent: ScreenBuilderEventBinding = {
      eventBindingId: `event-${Date.now()}`,
      nodeId: selectedNode.nodeId,
      eventName: "onClick",
      actionType: "navigate",
      actionConfig: { target: selectedNode.componentType === "button" ? "/admin/" : "" }
    };
    setEvents((current) => [...current, nextEvent]);
    return nextEvent;
  }

  function updateSelectedEvent(field: "eventName" | "actionType", value: string) {
    const base = ensureSelectedEvent();
    if (!base) {
      return;
    }
    setEvents((current) => current.map((event) => event.eventBindingId === base.eventBindingId ? { ...event, [field]: value } : event));
  }

  function updateSelectedEventTarget(value: string) {
    const base = ensureSelectedEvent();
    if (!base) {
      return;
    }
    setEvents((current) => current.map((event) => event.eventBindingId === base.eventBindingId
      ? { ...event, actionConfig: { ...(event.actionConfig || {}), target: value } }
      : event));
  }

  function updateSelectedEventApi(apiId: string) {
    const base = ensureSelectedEvent();
    if (!base) {
      return;
    }
    const nextApi = availableApis.find((api) => api.apiId === apiId);
    setEvents((current) => current.map((event) => event.eventBindingId === base.eventBindingId
      ? {
        ...event,
        actionConfig: {
          ...(event.actionConfig || {}),
          apiId,
          endpoint: nextApi?.endpoint || "",
          method: nextApi?.method || ""
        }
      }
      : event));
  }

  function updateSelectedEventRequestMapping(fieldId: string, value: string) {
    const base = ensureSelectedEvent();
    if (!base) {
      return;
    }
    setEvents((current) => current.map((event) => event.eventBindingId === base.eventBindingId
      ? {
        ...event,
        actionConfig: {
          ...(event.actionConfig || {}),
          requestMappings: {
            ...((event.actionConfig?.requestMappings as Record<string, string> | undefined) || {}),
            [fieldId]: value
          }
        }
      }
      : event));
  }

  function toggleCollapsedNode(nodeId: string) {
    setCollapsedNodeIds((current) => current.includes(nodeId) ? current.filter((item) => item !== nodeId) : [...current, nodeId]);
  }

  function handleApplyTemplatePreset() {
    const nextNodes = buildTemplatePresetNodes(selectedTemplateType, page?.menuTitle || "");
    setNodes(nextNodes);
    setEvents([]);
    setSelectedNodeId(nextNodes[1]?.nodeId || nextNodes[0]?.nodeId || "");
    setMessage(en ? "Applied template preset." : "템플릿 프리셋을 적용했습니다.");
  }

  return {
    addNode,
    applyRegistryComponent,
    collapsedNodeIdSet,
    componentDescription,
    componentLabel,
    dragNodeId,
    duplicateSelectedNode,
    ensureSelectedEvent,
    events,
    filteredPalette,
    handleApplyTemplatePreset,
    handleReplaceSelectedComponent,
    moveSelectedNode,
    nodeTreeRows,
    nodes,
    removeSelectedNode,
    reorderNodes,
    replacementComponentId,
    selectedApi,
    selectedEvent,
    selectedNode,
    selectedNodeId,
    selectedNodeProps,
    selectedRegistryComponent,
    setComponentDescription,
    setComponentLabel,
    setDragNodeId,
    setEvents,
    setNodes,
    setReplacementComponentId,
    setSelectedNodeId,
    toggleCollapsedNode,
    updateSelectedEvent,
    updateSelectedEventApi,
    updateSelectedEventRequestMapping,
    updateSelectedEventTarget,
    updateSelectedNodeField
  };
}
