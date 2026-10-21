import type { AppNavItem } from "../types";
import {
  AiIcon,
  CalendarIcon,
  DashboardIcon,
  LiveIcon,
  MatchesIcon,
  StatsIcon,
  TeamsIcon,
  TrophyIcon,
} from "./icons";
import "./Sidebar.css";

/* Fixed navigation for larger screens; slides in as a drawer on mobile. */

export const NAV_ITEMS: AppNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "live", label: "Live Scores", icon: "live" },
  { id: "matches", label: "Matches", icon: "matches" },
  { id: "tournaments", label: "Tournaments", icon: "tournaments" },
  { id: "teams", label: "Teams & Players", icon: "teams" },
  { id: "stats", label: "Statistics", icon: "stats" },
  { id: "ai", label: "AI Predictions", icon: "ai" },
  { id: "score", label: "Score a Match (demo)", icon: "live" },
];

const ICONS = {
  dashboard: DashboardIcon,
  live: LiveIcon,
  matches: MatchesIcon,
  tournaments: TrophyIcon,
  teams: TeamsIcon,
  stats: StatsIcon,
  ai: AiIcon,
} as const;

interface SidebarProps {
  activePage: string;
  onNavigate: (pageId: string) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({
  activePage,
  onNavigate,
  open,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* dark backdrop behind the drawer on mobile */}
      {open && (
        <div
          className="sidebar__backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        className={`sidebar ${open ? "sidebar--open" : ""}`}
        aria-label="Main navigation"
      >
        <button
          className="sidebar__item"
          onClick={() => onNavigate("live")}
          data-active={activePage === "live"}
        >
          <LiveIcon />
          <span className="sidebar__item-label">Live Now</span>
          <span className="sidebar__live-pill" aria-hidden="true" />
        </button>

        <div className="sidebar__divider" />

        <ul className="sidebar__list">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li key={item.id}>
                <button
                  className="sidebar__item"
                  onClick={() => onNavigate(item.id)}
                  data-active={activePage === item.id}
                  aria-current={activePage === item.id ? "page" : undefined}
                >
                  <Icon />
                  <span className="sidebar__item-label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="sidebar__footer">
          <CalendarIcon size={14} />
          <span>Season 2026</span>
        </div>
      </nav>
    </>
  );
}
