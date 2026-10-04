import { useMemo, useRef, useState, type ReactNode } from "react";
import type { ScreenBuilderEventBinding, ScreenBuilderNode } from "../../../lib/api/platformTypes";
import { renderScreenBuilderNodePreview } from "./screenBuilderPreview";
import { sortScreenBuilderNodes } from "./screenBuilderUtils";

type RuntimeState = Record<string, unknown>;

function readPath(source: unknown, path: string) {
  if (source && typeof source === "object" && Object.prototype.hasOwnProperty.call(source, path)) return (source as RuntimeState)[path];
  return path.split(".").filter(Boolean).reduce<unknown>((value, key) => {
    if (value && typeof value === "object") return (value as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

function resolveValue(value: unknown, state: RuntimeState) {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{\s*state\.([^}]+)\s*\}\}/g, (_, key) => String(readPath(state, key.trim()) ?? ""));
}

function safeEndpoint(value: unknown) {
  const endpoint = String(value || "").trim();
  if (!endpoint.startsWith("/" ) || endpoint.startsWith("//") || endpoint.includes("\\")) throw new Error("외부 API 주소는 실행할 수 없습니다.");
  return endpoint;
}

export function SduiRuntimeRenderer({ nodes, events, en }: { nodes: ScreenBuilderNode[]; events: ScreenBuilderEventBinding[]; en: boolean }) {
  const [state, setState] = useState<RuntimeState>(() => Object.fromEntries(nodes
    .filter(node => ["input", "textarea", "select", "checkbox"].includes(node.componentType))
    .map(node => [String(node.props.stateKey || node.nodeId), node.componentType === "checkbox" ? Boolean(node.props.checked) : node.props.value ?? ""])));
  const formRef = useRef<HTMLFormElement>(null);
  const executing = useRef(false);
  const [busyNodeId, setBusyNodeId] = useState("");
  const [message, setMessage] = useState("");
  const orderedNodes = useMemo(() => sortScreenBuilderNodes(nodes), [nodes]);
  const roots = orderedNodes.filter((node) => !node.parentNodeId);

  async function execute(node: ScreenBuilderNode, eventName: string) {
    if (executing.current) return;
    const bindings = events.filter((event) => event.nodeId === node.nodeId && event.eventName.replace(/^on/i, "").toLowerCase() === eventName);
    if (bindings.some(binding => binding.actionType === "api_call" && String(binding.actionConfig.method || "GET").toUpperCase() !== "GET") && !formRef.current?.reportValidity()) return;
    executing.current = true;
    let executionState = state;
    try {
    for (const binding of bindings) {
      const config = binding.actionConfig || {};
      if (binding.actionType === "navigate") {
        const target = safeEndpoint(resolveValue(config.target, executionState));
        window.location.assign(target);
        return;
      }
      if (binding.actionType === "api_call") {
        let endpoint = safeEndpoint(resolveValue(config.endpoint, executionState));
        const method = String(config.method || "GET").toUpperCase();
        if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new Error("허용되지 않은 HTTP 메서드입니다.");
        if (method !== "GET" && !window.confirm(en ? "Run this data-changing action?" : "데이터를 변경하는 작업을 실행하시겠습니까?")) return;
        setBusyNodeId(node.nodeId);
        try {
          const requestMappings = (config.requestMappings || {}) as Record<string, string>;
          const body = Object.fromEntries(Object.entries(requestMappings).map(([key, source]) => [key, readPath(executionState, source.replace(/^state\./, ""))]));
          if (method === "GET") {
            const query = new URLSearchParams(Object.entries(body).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)]));
            if (query.size) endpoint += `${endpoint.includes("?") ? "&" : "?"}${query}`;
          }
          const response = await fetch(endpoint, {
            method,
            credentials: "include",
            headers: { Accept: "application/json", ...(method === "GET" ? {} : { "Content-Type": "application/json" }) },
            body: method === "GET" ? undefined : JSON.stringify(body)
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(String(payload.message || `HTTP ${response.status}`));
          const responseMappings = (config.responseMappings || {}) as Record<string, string>;
          executionState = { ...executionState, [`response.${binding.eventBindingId}`]: payload };
          for (const [source, target] of Object.entries(responseMappings)) executionState[target.replace(/^state\./, "")] = readPath(payload, source);
          setState(executionState);
          setMessage(en ? "Action completed." : "작업이 완료되었습니다.");
        } finally {
          setBusyNodeId("");
        }
        continue;
      }
      throw new Error(en ? `Unsupported action: ${binding.actionType}` : `지원하지 않는 동작입니다: ${binding.actionType}`);
    }
    } finally { executing.current = false; }
  }

  function renderNode(node: ScreenBuilderNode): ReactNode {
    const children = orderedNodes.filter((item) => (item.parentNodeId || "") === node.nodeId);
    const props = node.props || {};
    const key = node.nodeId;
    if (["page", "section"].includes(node.componentType)) {
      const content = children.map(renderNode);
      return node.componentType === "page"
        ? <div className="space-y-4" key={key}>{content}</div>
        : <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4" key={key}><h3 className="mb-3 font-bold">{String(resolveValue(props.title, state) || (en ? "Section" : "섹션"))}</h3><div className="space-y-3">{content}</div></section>;
    }
    if (["input", "textarea", "select", "checkbox"].includes(node.componentType)) {
      const stateKey = String(props.stateKey || node.nodeId);
      const common = { name: stateKey, required: props.required === true, disabled: props.disabled === true, value: String(state[stateKey] ?? ""), onChange: (event: { target: { value: string } }) => setState((current) => ({ ...current, [stateKey]: event.target.value })) };
      const label = String(props.label || (en ? "Input" : "입력"));
      if (node.componentType === "checkbox") return <label className="flex items-center gap-2" key={key}><input type="checkbox" name={stateKey} required={common.required} disabled={common.disabled} checked={Boolean(state[stateKey])} onChange={event => setState(current => ({ ...current, [stateKey]: event.target.checked }))} />{label}</label>;
      const options = Array.isArray(props.options) ? props.options : [];
      return <label className="block" key={key}><span className="gov-label">{label}</span>{node.componentType === "textarea" ? <textarea className="gov-input min-h-[110px]" placeholder={String(props.placeholder || "")} {...common} /> : node.componentType === "select" ? <select className="gov-select" {...common}><option value="">{String(props.placeholder || "선택")}</option>{options.map((option, index) => {
        const item = typeof option === "object" && option !== null ? option as Record<string, unknown> : { value: option, label: option };
        return <option key={index} value={String(item.value ?? "")}>{String(item.label ?? item.value ?? "")}</option>;
      })}</select> : <input className="gov-input" type={String(props.type || "text")} placeholder={String(props.placeholder || "")} min={props.min == null ? undefined : String(props.min)} max={props.max == null ? undefined : String(props.max)} {...common} />}</label>;
    }
    if (node.componentType === "button") {
      return <button className="gov-btn gov-btn-primary" disabled={busyNodeId === node.nodeId} key={key} onClick={() => void execute(node, "click").catch((error) => setMessage(error instanceof Error ? error.message : String(error)))} type="button">{busyNodeId === node.nodeId ? (en ? "Running..." : "실행 중...") : String(props.label || (en ? "Run" : "실행"))}</button>;
    }
    return renderScreenBuilderNodePreview({ ...node, props: Object.fromEntries(Object.entries(props).map(([name, value]) => [name, resolveValue(value, state)])) }, orderedNodes, en);
  }

  return <form ref={formRef} onSubmit={event => event.preventDefault()} data-sdui-runtime="v1">{message ? <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">{message}</div> : null}{roots.map(renderNode)}</form>;
}
