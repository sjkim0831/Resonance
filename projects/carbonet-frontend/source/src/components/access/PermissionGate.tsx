import { ReactNode } from "react";

type PermissionGateProps = {
  capability: string;
  capabilities: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGate(props: PermissionGateProps) {
  const allowed = props.capabilities.includes(props.capability);
  if (!allowed) {
    return <>{props.fallback ?? null}</>;
  }
  return <>{props.children}</>;
}
