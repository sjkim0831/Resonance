import type { ReactNode } from "react";
import { MemberButton, MemberIconButton, MemberLinkButton } from "../../admin-ui/common";
import type { SystemComponentCatalogType } from "./buttonCatalogCore";

export const supportedSystemCatalogTypes: SystemComponentCatalogType[] = ["button", "input", "select", "textarea", "table", "pagination"];

export function resolveButtonVariant(value: unknown): "primary" | "secondary" | "success" | "danger" | "dangerSecondary" | "info" | "ghost" {
  const variant = String(value || "secondary");
  if (variant === "primary" || variant === "secondary" || variant === "success" || variant === "danger" || variant === "dangerSecondary" || variant === "info" || variant === "ghost") {
    return variant;
  }
  return "secondary";
}

export function resolveCatalogTitle(type: string, en: boolean) {
  switch (type) {
    case "button":
      return en ? "System Button Design Catalog" : "시스템 버튼 디자인 카탈로그";
    case "input":
      return en ? "System Input Catalog" : "시스템 입력 컴포넌트 카탈로그";
    case "select":
      return en ? "System Select Catalog" : "시스템 셀렉트 컴포넌트 카탈로그";
    case "textarea":
      return en ? "System Textarea Catalog" : "시스템 텍스트영역 카탈로그";
    case "table":
      return en ? "System Table Catalog" : "시스템 테이블 카탈로그";
    case "pagination":
      return en ? "System Pagination Catalog" : "시스템 페이지네이션 카탈로그";
    default:
      return en ? "System Component Catalog" : "시스템 컴포넌트 카탈로그";
  }
}

export function resolveCatalogInventoryTitle(type: string, en: boolean) {
  switch (type) {
    case "button":
      return en ? "Button inventory" : "버튼 인벤토리";
    case "input":
      return en ? "Input inventory" : "입력 인벤토리";
    case "select":
      return en ? "Select inventory" : "셀렉트 인벤토리";
    case "textarea":
      return en ? "Textarea inventory" : "텍스트영역 인벤토리";
    case "table":
      return en ? "Table inventory" : "테이블 인벤토리";
    case "pagination":
      return en ? "Pagination inventory" : "페이지네이션 인벤토리";
    default:
      return en ? "Component inventory" : "컴포넌트 인벤토리";
  }
}

export function renderSystemCatalogPreview(
  item: {
    componentType: string;
    componentName: string;
    variant?: string;
    size?: string;
    icon?: string;
    className?: string;
    label?: string;
    placeholder?: string;
  },
  en: boolean
): ReactNode {
  if (item.componentType === "button") {
    if (item.componentName === "MemberLinkButton") {
      return (
        <MemberLinkButton href="#" onClick={(event) => event.preventDefault()} size={(item.size || "md") as "xs" | "sm" | "md" | "lg" | "icon"} variant={resolveButtonVariant(item.variant)}>
          {item.label || (en ? "Link" : "링크")}
        </MemberLinkButton>
      );
    }
    if (item.componentName === "MemberIconButton") {
      return <MemberIconButton icon={item.icon || "bolt"} size={(item.size || "icon") as "xs" | "sm" | "md" | "lg" | "icon"} variant={resolveButtonVariant(item.variant)} />;
    }
    return (
      <MemberButton size={(item.size || "md") as "xs" | "sm" | "md" | "lg" | "icon"} type="button" variant={resolveButtonVariant(item.variant)}>
        {item.label || (en ? "Button" : "버튼")}
      </MemberButton>
    );
  }
  if (item.componentType === "input") {
    return <input className={`gov-input w-full ${item.className || ""}`.trim()} placeholder={item.placeholder || (en ? "Input value" : "값 입력")} readOnly value="" />;
  }
  if (item.componentType === "select") {
    return (
      <select className={`gov-select w-full ${item.className || ""}`.trim()} defaultValue="">
        <option value="">{item.placeholder || (en ? "Select option" : "옵션 선택")}</option>
      </select>
    );
  }
  if (item.componentType === "textarea") {
    return <textarea className={`gov-textarea w-full ${item.className || ""}`.trim()} placeholder={item.placeholder || (en ? "Enter details" : "상세 내용을 입력하세요.")} readOnly rows={3} />;
  }
  if (item.componentType === "table") {
    return (
      <div className="overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
        <table className={`w-full text-sm ${item.className || ""}`.trim()}>
          <thead>
            <tr className="gov-table-header">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">{en ? "Name" : "이름"}</th>
              <th className="px-3 py-2">{en ? "Status" : "상태"}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-2">1</td>
              <td className="px-3 py-2">{en ? "Sample row" : "샘플 행"}</td>
              <td className="px-3 py-2">{en ? "Ready" : "준비"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (item.componentType === "pagination") {
    return (
      <div className="inline-flex items-center gap-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-2 text-sm text-[var(--kr-gov-text-secondary)]">
        <span>{en ? "Prev" : "이전"}</span>
        <span className="rounded bg-[var(--kr-gov-bg-muted)] px-2 py-0.5 font-bold text-[var(--kr-gov-text-primary)]">1</span>
        <span>/ 5</span>
        <span>{en ? "Next" : "다음"}</span>
      </div>
    );
  }
  return <span className="text-sm text-[var(--kr-gov-text-secondary)]">{item.componentName}</span>;
}
