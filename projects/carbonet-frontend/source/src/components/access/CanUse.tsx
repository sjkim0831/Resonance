import { ButtonHTMLAttributes, ReactNode } from "react";

type CanUseProps = {
  allowed: boolean;
  reason?: string;
  children: ReactNode;
};

export function CanUse(props: CanUseProps) {
  return (
    <div className="permission-use-block">
      {props.children}
      {!props.allowed && props.reason ? <p className="permission-reason">{props.reason}</p> : null}
    </div>
  );
}

type PermissionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  allowed: boolean;
  reason?: string;
};

export function PermissionButton(props: PermissionButtonProps) {
  const { allowed, reason, children, ...buttonProps } = props;
  return (
    <CanUse allowed={allowed} reason={reason}>
      <button {...buttonProps} disabled={!allowed || buttonProps.disabled}>
        {children}
      </button>
    </CanUse>
  );
}
