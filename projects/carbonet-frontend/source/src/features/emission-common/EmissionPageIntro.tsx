import type { ReactNode } from "react";

/** Shared, non-interactive page introduction. Business actions stay owned by the caller. */
export function EmissionPageIntro({ category, title, description, actions, level = 1 }: {
  category: string; title: string; description?: string; actions?: ReactNode; level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return <section className="emission-page-intro" data-design-component="emission-page-intro-v1">
    <div className="emission-page-intro__copy">
      <p className="emission-page-intro__category">{category}</p>
      <Heading className="emission-page-intro__title">{title}</Heading>
      {description ? <p className="emission-page-intro__description">{description}</p> : null}
    </div>
    {actions ? <div className="emission-page-intro__actions">{actions}</div> : null}
  </section>;
}
