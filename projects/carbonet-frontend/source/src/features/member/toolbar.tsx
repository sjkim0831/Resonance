import { ReactNode } from "react";
import { MemberButtonGroup, MemberLinkButton, MemberToolbar } from "./common";
import { MEMBER_BUTTON_LABELS, MEMBER_LIST_LABELS } from "./labels";

type MemberListToolbarProps = {
  totalCount: number;
  excelHref: string;
  registerHref?: string;
  registerLabel?: string;
  className?: string;
};

export function MemberCountSummary({ totalCount }: { totalCount: number }) {
  return (
    <div className="text-[14px]">
      {MEMBER_LIST_LABELS.totalCount} <span className="font-bold text-[var(--kr-gov-blue)]">{totalCount.toLocaleString()}</span>건
    </div>
  );
}

export function MemberListTopActions({
  excelHref,
  registerHref,
  registerLabel = MEMBER_BUTTON_LABELS.register
}: Omit<MemberListToolbarProps, "totalCount" | "className">) {
  return (
    <MemberButtonGroup>
      <MemberLinkButton href={excelHref} icon="download" variant="secondary">
        {MEMBER_BUTTON_LABELS.excelDownload}
      </MemberLinkButton>
      {registerHref ? (
        <MemberLinkButton href={registerHref} icon="person_add" variant="success">
          {registerLabel}
        </MemberLinkButton>
      ) : null}
    </MemberButtonGroup>
  );
}

export function MemberListToolbar({
  totalCount,
  excelHref,
  registerHref,
  registerLabel = MEMBER_BUTTON_LABELS.register,
  className = ""
}: MemberListToolbarProps) {
  return (
    <MemberToolbar
      className={className}
      left={<MemberCountSummary totalCount={totalCount} />}
      right={<MemberListTopActions excelHref={excelHref} registerHref={registerHref} registerLabel={registerLabel} />}
    />
  );
}

export function MemberListEmptyRow({
  colSpan,
  message
}: {
  colSpan: number;
  message: ReactNode;
}) {
  return (
    <tr>
      <td className="px-6 py-8 text-center text-gray-500" colSpan={colSpan}>{message}</td>
    </tr>
  );
}
