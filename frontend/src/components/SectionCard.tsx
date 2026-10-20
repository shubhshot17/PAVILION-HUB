import "./SectionCard.css";
import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

/* A titled panel used to group content on the dashboard
   (e.g. "Live Matches", "Upcoming Fixtures", "Standings"). */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: SectionCardProps) {
  return (
    <section className="section-card">
      <header className="section-card__header">
        <div>
          <h2 className="section-card__title">{title}</h2>
          {subtitle && <p className="section-card__subtitle">{subtitle}</p>}
        </div>
        {action && <div className="section-card__action">{action}</div>}
      </header>
      <div className="section-card__body">{children}</div>
    </section>
  );
}

/* Shimmering placeholder rows shown while data is "loading". */
export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="section-card__loading"
      role="status"
      aria-label="Loading data"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

/* Friendly message shown when a list has nothing in it. */
export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="section-card__empty">
      {icon && <div className="section-card__empty-icon">{icon}</div>}
      <p className="section-card__empty-title">{title}</p>
      {hint && <p className="section-card__empty-hint">{hint}</p>}
    </div>
  );
}
