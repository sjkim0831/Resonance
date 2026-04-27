import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TableHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { PermissionButton } from "../../components/access/CanUse";

export type AppButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "dangerSecondary"
  | "info"
  | "ghost";

export type AppButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

type AppButtonBaseProps = {
  icon?: string;
  className?: string;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
};

function appButtonVariantClassName(variant: AppButtonVariant) {
  if (variant === "primary") {
    return "border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] hover:border-[var(--kr-gov-blue-hover)]";
  }
  if (variant === "success") {
    return "border border-[var(--kr-gov-green)] bg-[var(--kr-gov-green)] text-white hover:opacity-90";
  }
  if (variant === "danger") {
    return "border border-red-300 bg-red-600 text-white hover:bg-red-700 hover:border-red-700";
  }
  if (variant === "dangerSecondary") {
    return "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100";
  }
  if (variant === "info") {
    return "border border-blue-100 bg-blue-50 text-[var(--kr-gov-blue)] hover:bg-blue-100";
  }
  if (variant === "ghost") {
    return "border border-transparent bg-transparent text-[var(--kr-gov-text-secondary)] hover:bg-gray-100";
  }
  return "border border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-primary)] hover:bg-gray-50";
}

function appButtonSizeClassName(size: AppButtonSize) {
  if (size === "xs") {
    return "min-h-[32px] px-3 py-1.5 text-[12px]";
  }
  if (size === "sm") {
    return "min-h-[40px] px-4 py-2 text-sm";
  }
  if (size === "lg") {
    return "min-h-[56px] px-6 py-3 text-base";
  }
  if (size === "icon") {
    return "h-10 w-10 p-0 text-sm";
  }
  return "min-h-[44px] px-4 py-2 text-[13px]";
}

export function getAppButtonClassName({
  variant = "secondary",
  size = "md",
  className = ""
}: Pick<AppButtonBaseProps, "variant" | "size" | "className"> = {}) {
  return [
    "app-btn",
    `app-btn--${variant}`,
    `app-btn--${size}`,
    "inline-flex items-center justify-center gap-1.5 rounded-[var(--kr-gov-radius)] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    appButtonVariantClassName(variant),
    appButtonSizeClassName(size),
    className
  ].filter(Boolean).join(" ");
}

function renderIcon(icon: string | undefined, size: AppButtonSize) {
  return icon ? <span className={`material-symbols-outlined ${size === "xs" ? "text-[16px]" : "text-[18px]"}`}>{icon}</span> : null;
}

export function AppButton({
  icon,
  children,
  className,
  variant = "secondary",
  size = "md",
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & AppButtonBaseProps) {
  return (
    <button {...buttonProps} className={getAppButtonClassName({ variant, size, className })}>
      {renderIcon(icon, size)}
      {children}
    </button>
  );
}

export function AppLinkButton({
  icon,
  children,
  className,
  variant = "secondary",
  size = "md",
  ...anchorProps
}: AnchorHTMLAttributes<HTMLAnchorElement> & AppButtonBaseProps) {
  return (
    <a {...anchorProps} className={getAppButtonClassName({ variant, size, className })}>
      {renderIcon(icon, size)}
      {children}
    </a>
  );
}

export function AppPermissionButton({
  allowed,
  reason,
  icon,
  children,
  className,
  variant = "primary",
  size = "md",
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & AppButtonBaseProps & { allowed: boolean; reason?: string }) {
  return (
    <PermissionButton
      {...buttonProps}
      allowed={allowed}
      className={getAppButtonClassName({ variant, size, className })}
      reason={reason}
    >
      {renderIcon(icon, size)}
      {children}
    </PermissionButton>
  );
}

export function AppIconButton({
  icon,
  children,
  className,
  variant = "ghost",
  size = "icon",
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & AppButtonBaseProps) {
  return (
    <button {...buttonProps} className={getAppButtonClassName({ variant, size, className })}>
      {icon ? <span className="material-symbols-outlined text-[18px]">{icon}</span> : null}
      {children}
    </button>
  );
}

type AppFieldBaseProps = {
  className?: string;
};

export function getAppFieldClassName(className = "") {
  return `w-full h-12 px-4 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white text-sm focus:ring-[var(--kr-gov-focus)] focus:border-[var(--kr-gov-focus)] ${className}`.trim();
}

export function AppInput(props: InputHTMLAttributes<HTMLInputElement> & AppFieldBaseProps) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={getAppFieldClassName(`app-field app-field--input ${className}`.trim())} />;
}

export function AppSelect(props: SelectHTMLAttributes<HTMLSelectElement> & AppFieldBaseProps) {
  const { className = "", children, ...rest } = props;
  return <select {...rest} className={getAppFieldClassName(`app-field app-field--select ${className}`.trim())}>{children}</select>;
}

export function AppTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & AppFieldBaseProps) {
  const { className = "", rows = 4, ...rest } = props;
  return <textarea {...rest} className={`app-field app-field--textarea w-full px-4 py-3 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white text-sm focus:ring-[var(--kr-gov-focus)] focus:border-[var(--kr-gov-focus)] ${className}`.trim()} rows={rows} />;
}

export function AppTable({
  className = "",
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { children?: ReactNode }) {
  return <table {...props} className={`app-table w-full text-sm text-left border-collapse ${className}`.trim()}>{children}</table>;
}

export function AppCheckbox(props: InputHTMLAttributes<HTMLInputElement> & AppFieldBaseProps) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`app-choice app-choice--checkbox h-5 w-5 rounded border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] focus:ring-[var(--kr-gov-focus)] ${className}`.trim()} type="checkbox" />;
}

export function AppRadio(props: InputHTMLAttributes<HTMLInputElement> & AppFieldBaseProps) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`app-choice app-choice--radio h-5 w-5 border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] focus:ring-[var(--kr-gov-focus)] ${className}`.trim()} type="radio" />;
}
