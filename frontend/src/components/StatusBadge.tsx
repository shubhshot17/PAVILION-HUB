import type { MatchStatus } from "../types";
import "./StatusBadge.css";

/* Small colored pill that shows a match's state at a glance. */

const LABELS: Record<MatchStatus, string> = {
  live: "LIVE",
  upcoming: "Upcoming",
  completed: "Result",
  abandoned: "No Result",
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {status === "live" && (
        <span className="status-badge__dot" aria-hidden="true" />
      )}
      {LABELS[status]}
    </span>
  );
}
