import { useEffect, useState } from "react";
import {
  SectionCard,
  LoadingRows,
  EmptyState,
} from "../components/SectionCard";
import { MatchCard, formatDateTime } from "../components/MatchCard";
import { StandingsTable } from "../components/StandingsTable";
import { fetchDashboardData } from "../services/api";
import type { DashboardData } from "../types";
import { CalendarIcon, BallIcon } from "../components/icons";
import "./Dashboard.css";

export function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [data, setData] = useState<(DashboardData & { isDemo: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <div className="dashboard dashboard--error">⚠ {error}</div>;
  if (!data) return null;

  const { liveMatches, upcoming, recent, standings } = data;

  return (
    <div className="dashboard">
      {/* ---------- Welcome hero ---------- */}
      <section className="welcome">
        <div className="welcome__text">
          <span className="welcome__eyebrow">Season 2026 · {data.isDemo ? '⚠ Demo workspace' : 'Backend workspace'}</span>
          <h1>
            Welcome back to <span className="welcome__brand">PAVILION HUB</span>
          </h1>
          <p>
            Score matches ball-by-ball, run tournaments, and explore AI-powered
            insights — all from one cricket-first dashboard.
          </p>
          <div className="welcome__stats">
            <div className="welcome__stat">
              <strong>{liveMatches.length}</strong>
              <span>Live now</span>
            </div>
            <div className="welcome__stat">
              <strong>{upcoming.length}</strong>
              <span>Upcoming</span>
            </div>
            <div className="welcome__stat">
              <strong>{standings.length}</strong>
              <span>Teams</span>
            </div>
          </div>
        </div>
        <div className="welcome__orb" aria-hidden="true">
          <BallIcon size={64} />
        </div>
      </section>

      {/* ---------- Live matches ---------- */}
      <SectionCard
        title="🔴 Live Matches"
        subtitle="Ball-by-ball scoring in progress"
        action={
          <button
            type="button"
            className="section-link"
            onClick={() => onNavigate?.("live")}
          >
            View all →
          </button>
        }
      >
        {liveMatches.length === 0 ? (
          <EmptyState
            icon="🏏"
            title="No matches are live right now"
            hint="Check the fixtures list below for the next scheduled game."
          />
        ) : (
          <div className="dashboard__grid dashboard__grid--live">
            {liveMatches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ---------- Upcoming + Results side by side ---------- */}
      <div className="dashboard__two-col">
        <SectionCard
          title="Upcoming Fixtures"
          subtitle="Next scheduled matches"
        >
          {upcoming.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No fixtures scheduled"
              hint="New matches will appear here once the schedule is published."
            />
          ) : (
            <ul className="fixture-list">
              {upcoming.map((m) => (
                <li className="fixture" key={m.id}>
                  <div className="fixture__teams">
                    <span
                      className="fixture__badge"
                      style={{ background: m.teams[0].color }}
                    >
                      {m.teams[0].shortName}
                    </span>
                    <span className="fixture__vs">vs</span>
                    <span
                      className="fixture__badge"
                      style={{ background: m.teams[1].color }}
                    >
                      {m.teams[1].shortName}
                    </span>
                    <span className="fixture__names">
                      {m.teams[0].name} <em>vs</em> {m.teams[1].name}
                    </span>
                  </div>
                  <div className="fixture__info">
                    <span>{formatDateTime(m.date)}</span>
                    <span className="fixture__venue">
                      {m.venue} · {m.format}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recent Results" subtitle="Latest completed matches">
          {recent.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="No results yet"
              hint="Results will appear here after the first match is completed."
            />
          ) : (
            <ul className="result-list">
              {recent.map((m) => (
                <li className="result" key={m.id}>
                  <div className="result__teams">
                    <span className="result__names">
                      <strong>{m.teams[0].shortName}</strong>{" "}
                      {m.scores?.[0]?.runs ?? "–"}
                      <span className="result__sep"> — </span>
                      {m.scores?.[1]?.runs ?? "–"}{" "}
                      <strong>{m.teams[1].shortName}</strong>
                    </span>
                    <span className="result__outcome">{m.result}</span>
                  </div>
                  <span className="result__meta">{m.tournament}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* ---------- Standings preview ---------- */}
      <SectionCard
        title="Tournament Standings"
        subtitle="Monsoon Premier Cup · League stage"
        action={
          <button
            type="button"
            className="section-link"
            onClick={() => onNavigate?.("tournaments")}
          >
            Full table →
          </button>
        }
      >
        {standings.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Standings not available"
            hint="Points will appear once matches begin."
          />
        ) : (
          <StandingsTable rows={standings} maxRows={6} />
        )}
      </SectionCard>

      <footer className="dashboard__footer">
        <CalendarIcon size={14} /> {data.isDemo
          ? '⚠ Demo data — backend not connected. All scores are fictional.'
          : 'Data loaded from the configured backend. Verify whether records are demo or production data.'}
      </footer>
    </div>
  );
}

/* Simple skeleton layout shown while the "API" responds. */
function DashboardSkeleton() {
  return (
    <div className="dashboard">
      <div className="welcome welcome--skeleton">
        <div className="skeleton-row" style={{ height: 24, width: "40%" }} />
        <div className="skeleton-row" style={{ height: 48, width: "70%" }} />
        <div className="skeleton-row" style={{ height: 16, width: "55%" }} />
      </div>
      <div className="dashboard__two-col">
        <SectionCard title="Upcoming Fixtures">
          <LoadingRows rows={3} />
        </SectionCard>
        <SectionCard title="Recent Results">
          <LoadingRows rows={3} />
        </SectionCard>
      </div>
      <SectionCard title="Tournament Standings">
        <LoadingRows rows={5} />
      </SectionCard>
    </div>
  );
}
