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
  const [matchAction, setMatchAction] = useState<{ id: string; edit: boolean } | null>(null);
  const [createMatch, setCreateMatch] = useState(false);

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
    setMatchAction(null);
    setCreateMatch(false);
  };

  const openMatch = (id: string, edit: boolean) => {
    setMatchAction({ id, edit });
    setCreateMatch(false);
    setActivePage("matches");
    setMenuOpen(false);
  };

  /** Opens the ball-by-ball scoring screen for a specific match. */
  const startScoring = (id: string) => {
    setMatchAction({ id, edit: false });
    setCreateMatch(false);
    setActivePage("score");
    setMenuOpen(false);
  };

  const startMatchCreation = () => {
    setMatchAction(null);
    setCreateMatch(true);
    setActivePage("matches");
    setMenuOpen(false);
  };

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return (
          <Dashboard
            onNavigate={navigate}
            onViewMatch={(id) => openMatch(id, false)}
            onEditSetup={(id) => openMatch(id, true)}
            onCreateMatch={startMatchCreation}
          />
        );
      case "score":
        return <ScoreScreen initialMatchId={matchAction?.id} />;
      case "tournaments":
        return <TournamentsPage />;
      case "teams":
        return <TeamsPage />;
      case "matches":
        return (
          <MatchesPage
            initialMatchId={matchAction?.id}
            initialEditSetup={matchAction?.edit}
            initialCreate={createMatch}
            onInitialActionHandled={() => {
              setMatchAction(null);
              setCreateMatch(false);
            }}
            onManageTeams={() => navigate("teams")}
            onStartScoring={(matchId) => startScoring(matchId)}
          />
        );
      case "live":
        return <MatchesPage initialFilter="live" onStartScoring={(matchId) => startScoring(matchId)} />;
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
