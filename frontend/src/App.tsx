import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Dashboard } from "./pages/Dashboard";
import { ScoreScreen } from "./pages/ScoreScreen";
import { TournamentsPage } from "./pages/TournamentsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { MatchesPage } from "./pages/MatchesPage";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const PAGE_TITLES: Record<string, string> = {
    dashboard:   "Dashboard",
    live:        "Live Scores",
    matches:     "Matches",
    tournaments: "Tournaments",
    teams:       "Teams & Players",
    stats:       "Statistics",
    ai:          "AI Predictions",
    score:       "Scoring",
  };

  const navigate = (pageId: string) => {
    setActivePage(pageId);
    setMenuOpen(false); // close the mobile drawer after choosing a page
  };

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return <Dashboard onNavigate={navigate} />;
      case "score":
        return <ScoreScreen />;
      case "tournaments":
        return <TournamentsPage />;
      case "teams":
        return <TeamsPage />;
      case "matches":
        return <MatchesPage />;
      case "live":
        return <MatchesPage initialFilter="live" />;
      default:
        return (
          <div className="app-shell__placeholder">
            <h2>{PAGE_TITLES[activePage]}</h2>
            <p>
              This page is coming soon. The Dashboard already shows a full
              preview of live matches, fixtures, results, and standings.
            </p>
            <button onClick={() => navigate("dashboard")}>
              ← Back to Dashboard
            </button>
          </div>
        );
    }
  }

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
        {renderPage()}
      </main>
    </>
  );
}

export default App;
