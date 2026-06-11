import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from "react";

type BoxProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  style?: CSSProperties;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
};

type ModalProps = BoxProps & {
  isOpen?: boolean;
  onClose?: () => void;
  size?: string;
  title?: string;
};

export function Button({ children, size = "md", variant = "primary", style, ...props }: ButtonProps) {
  const padding = size === "sm" ? "6px 10px" : size === "lg" ? "10px 18px" : "8px 14px";
  const variantStyle: CSSProperties = variant === "primary"
    ? { background: "#2563eb", borderColor: "#2563eb", color: "#fff" }
    : variant === "secondary"
      ? { background: "#fff", borderColor: "#cbd5e1", color: "#0f172a" }
      : { background: "transparent", borderColor: "transparent", color: "#2563eb" };
  return (
    <button
      style={{
        border: "1px solid",
        borderRadius: 6,
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        padding,
        ...variantStyle,
        ...style
      }}
      type={props.type || "button"}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, style, ...props }: BoxProps) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", ...style }} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, style, ...props }: BoxProps) {
  return (
    <div style={{ alignItems: "center", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", padding: 16, ...style }} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, style, ...props }: BoxProps) {
  return <div style={{ padding: 16, ...style }} {...props}>{children}</div>;
}

export function CardFooter({ children, style, ...props }: BoxProps) {
  return (
    <div style={{ borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, justifyContent: "flex-end", padding: 16, ...style }} {...props}>
      {children}
    </div>
  );
}

export function Modal({ children, isOpen, onClose, size: _size, title, style, ...props }: ModalProps) {
  if (!isOpen) {
    return null;
  }
  return (
    <div style={{ alignItems: "center", background: "rgba(15,23,42,.35)", display: "flex", inset: 0, justifyContent: "center", position: "fixed", zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: 8, maxHeight: "80vh", maxWidth: 720, overflow: "auto", padding: 20, width: "min(92vw, 720px)", ...style }} {...props}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{title || ""}</h2>
          <button onClick={onClose} style={{ background: "transparent", border: 0, cursor: "pointer", fontSize: 20 }} type="button">x</button>
        </div>
        {children}
      </div>
    </div>
  );
}
