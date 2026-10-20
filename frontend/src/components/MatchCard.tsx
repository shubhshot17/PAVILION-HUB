import type { Match } from "../types";
import { StatusBadge } from "./StatusBadge";
import "./MatchCard.css";

/* ---------- helpers you can reuse elsewhere ---------- */

export function formatOvers(overs: number): string {
  return overs.toFixed(1);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- the card itself ---------- */

export function MatchCard({ match }: { match: Match }) {
  const isLive = match.status === "live";
  const batting =
    isLive && match.currentInnings !== undefined
      ? match.scores?.[match.currentInnings]
      : undefined;

  return (
    <article className={`match-card match-card--${match.status}`}>
      <div className="match-card__meta">
        <span className="match-card__tournament">{match.tournament}</span>
        <StatusBadge status={match.status} />
      </div>

      <div className="match-card__teams">
        {match.teams.map((team, i) => {
          const score = match.scores?.[i];
          const isBatting = batting?.teamId === team.id;
          const isWinner =
            match.status === "completed" && match.result?.startsWith(team.name);
          return (
            <div className="match-card__team-row" key={team.id}>
              <span
                className="match-card__team-badge"
                style={{ background: team.color }}
              >
                {team.shortName}
              </span>
              <span
                className={`match-card__team-name ${isWinner ? "is-winner" : ""} ${
                  isBatting ? "is-batting" : ""
                }`}
              >
                {team.name}
              </span>
              <span className="match-card__score">
                {score ? (
                  <>
                    <strong>{score.runs}</strong>
                    <span className="match-card__wickets">
                      /{score.wickets === 10 ? "10" : score.wickets}
                    </span>
                    <span className="match-card__overs">
                      {" "}
                      ({formatOvers(score.overs)} ov)
                      {score.declared && " d"}
                    </span>
                  </>
                ) : (
                  <span className="match-card__score--pending">—</span>
                )}
              </span>
              {isBatting && (
                <span
                  className="match-card__batting-chip"
                  title="Currently batting"
                >
                  ● bat
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="match-card__footer">
        <span className="match-card__venue">
          📍 {match.venue} · {match.format}
        </span>
        <span className="match-card__date">
          {match.status === "completed"
            ? match.result
            : isLive
              ? `Innings ${match.currentInnings === 0 ? 1 : 2}`
              : formatDateTime(match.date)}
        </span>
      </div>
    </article>
  );
}
