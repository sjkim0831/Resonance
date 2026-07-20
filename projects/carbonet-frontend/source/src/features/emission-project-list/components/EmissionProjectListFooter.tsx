import { StandardUserFooter } from "../../../components/user-shell/StandardUserFooter";

interface FooterProps {
  en: boolean;
}

/** @deprecated Use StandardUserFooter directly in new pages. */
export function EmissionProjectListFooter({ en }: FooterProps) {
  return <StandardUserFooter english={en} />;
}
