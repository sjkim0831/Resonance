import { useMemo, useState, type ReactNode } from "react";
import type { ScreenBuilderEventBinding, ScreenBuilderNode } from "../../../lib/api/platformTypes";
import { renderScreenBuilderNodePreview } from "./screenBuilderPreview";
import { sortScreenBuilderNodes } from "./screenBuilderUtils";

type RuntimeState = Record<string, unknown>;

function readPath(source: unknown, path: string) {
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
  if (!endpoint.startsWith("/" ) || endpoint.startsWith("//")) throw new Error("외부 API 주소는 실행할 수 없습니다.");
  return endpoint;
}

export function SduiRuntimeRenderer({ nodes, events, en }: { nodes: ScreenBuilderNode[]; events: ScreenBuilderEventBinding[]; en: boolean }) {
  const [state, setState] = useState<RuntimeState>({});
  const [busyNodeId, setBusyNodeId] = useState("");
  const [message, setMessage] = useState("");
  const orderedNodes = useMemo(() => sortScreenBuilderNodes(nodes), [nodes]);
  const roots = orderedNodes.filter((node) => !node.parentNodeId);

  async function execute(node: ScreenBuilderNode, eventName: string) {
    const bindings = events.filter((event) => event.nodeId === node.nodeId && event.eventName === eventName);
    for (const binding of bindings) {
      const config = binding.actionConfig || {};
      if (binding.actionType === "navigate") {
        const target = safeEndpoint(resolveValue(config.target, state));
        window.location.assign(target);
        return;
      }
      if (binding.actionType === "api_call") {
        const endpoint = safeEndpoint(resolveValue(config.endpoint, state));
        const method = String(config.method || "GET").toUpperCase();
        if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new Error("허용되지 않은 HTTP 메서드입니다.");
        if (method !== "GET" && !window.confirm(en ? "Run this data-changing action?" : "데이터를 변경하는 작업을 실행하시겠습니까?")) return;
        setBusyNodeId(node.nodeId);
        try {
          const requestMappings = (config.requestMappings || {}) as Record<string, string>;
          const body = Object.fromEntries(Object.entries(requestMappings).map(([key, source]) => [key, readPath(state, source.replace(/^state\./, ""))]));
          const response = await fetch(endpoint, {
            method,
            credentials: "include",
            headers: { Accept: "application/json", ...(method === "GET" ? {} : { "Content-Type": "application/json" }) },
            body: method === "GET" ? undefined : JSON.stringify(body)
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json().catch(() => ({}));
          const responseMappings = (config.responseMappings || {}) as Record<string, string>;
          setState((current) => {
            const next = { ...current, [`response.${binding.eventBindingId}`]: payload };
            for (const [source, target] of Object.entries(responseMappings)) next[target.replace(/^state\./, "")] = readPath(payload, source);
            return next;
          });
          setMessage(en ? "Action completed." : "작업이 완료되었습니다.");
        } finally {
          setBusyNodeId("");
        }
        continue;
      }
      throw new Error(en ? `Unsupported action: ${binding.actionType}` : `지원하지 않는 동작입니다: ${binding.actionType}`);
    }
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
    if (node.componentType === "input" || node.componentType === "textarea") {
      const stateKey = String(props.stateKey || node.nodeId);
      const common = { value: String(state[stateKey] ?? props.value ?? ""), onChange: (event: { target: { value: string } }) => setState((current) => ({ ...current, [stateKey]: event.target.value })) };
      return <label className="block" key={key}><span className="gov-label">{String(props.label || (en ? "Input" : "입력"))}</span>{node.componentType === "textarea" ? <textarea className="gov-input min-h-[110px]" {...common} /> : <input className="gov-input" {...common} />}</label>;
    }
    if (node.componentType === "button") {
      return <button className="gov-btn gov-btn-primary" disabled={busyNodeId === node.nodeId} key={key} onClick={() => void execute(node, "click").catch((error) => setMessage(error instanceof Error ? error.message : String(error)))} type="button">{busyNodeId === node.nodeId ? (en ? "Running..." : "실행 중...") : String(props.label || (en ? "Run" : "실행"))}</button>;
    }
    return renderScreenBuilderNodePreview({ ...node, props: Object.fromEntries(Object.entries(props).map(([name, value]) => [name, resolveValue(value, state)])) }, orderedNodes, en);
  }

  return <div data-sdui-runtime="v1">{message ? <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">{message}</div> : null}{roots.map(renderNode)}</div>;
}
