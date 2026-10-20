import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Dashboard } from "./pages/Dashboard";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const PAGE_TITLES: Record<string, string> = {
    dashboard: "Dashboard",
    live: "Live Scores",
    matches: "Matches",
    tournaments: "Tournaments",
    teams: "Teams & Players",
    stats: "Statistics",
    ai: "AI Predictions",
  };

  const navigate = (pageId: string) => {
    setActivePage(pageId);
    setMenuOpen(false); // close the mobile drawer after choosing a page
  };

  return (
    <>
      <TopBar
        title={PAGE_TITLES[activePage] ?? "Dashboard"}
        onMenuClick={() => setMenuOpen(!menuOpen)}
        menuOpen={menuOpen}
      />
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="app-shell__content">
        {activePage === "dashboard" ? (
          <Dashboard />
        ) : (
          <div className="app-shell__placeholder">
            <h2>{PAGE_TITLES[activePage]}</h2>
            <p>
              This page is coming soon. The Dashboard already shows a full
              preview of live matches, fixtures, results, and standings using
              demo data.
            </p>
            <button onClick={() => navigate("dashboard")}>
              ← Back to Dashboard
            </button>
          </div>
        )}
      </main>
    </>
  );
}

export default App;
