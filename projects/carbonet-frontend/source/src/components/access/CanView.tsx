import { ReactNode } from "react";

type CanViewProps = {
  allowed: boolean;
  children: ReactNode;
  fallback?: ReactNode;
};

export function CanView(props: CanViewProps) {
  if (!props.allowed) {
    return <>{props.fallback ?? null}</>;
  }
  return <>{props.children}</>;
}
