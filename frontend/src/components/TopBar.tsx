import { Logo } from "./Logo";
import { MenuIcon } from "./icons";
import "./TopBar.css";

interface TopBarProps {
  title: string;
  onMenuClick: () => void;
  menuOpen: boolean;
}

/* Slim top navigation bar: menu button (mobile), brand, and page title. */
export function TopBar({ title, onMenuClick, menuOpen }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          className="topbar__menu-btn"
          onClick={onMenuClick}
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={menuOpen}
        >
          <MenuIcon size={20} />
        </button>
        <Logo size={30} />
        <span className="topbar__page-title">{title}</span>
      </div>

      <div className="topbar__right">
        <span className="topbar__season">Season 2026</span>
      </div>
    </header>
  );
}
