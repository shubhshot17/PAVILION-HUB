import type { StandingRow } from "../types";
import "./StandingsTable.css";

/* Compact league table used in the "Tournament Standings" preview.
   Top 2 rows get a subtle lime highlight (promotion/qualifying zones). */
export function StandingsTable({
  rows,
  maxRows,
}: {
  rows: StandingRow[];
  maxRows?: number;
}) {
  const visible = maxRows ? rows.slice(0, maxRows) : rows;

  return (
    <div className="standings" role="table" aria-label="Tournament standings">
      <div className="standings__row standings__row--head" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Team</span>
        <span role="columnheader">P</span>
        <span role="columnheader">W</span>
        <span role="columnheader">L</span>
        <span role="columnheader">Pts</span>
        <span role="columnheader">NRR</span>
      </div>

      {visible.map((row, i) => (
        <div
          className={`standings__row ${i < 2 ? "standings__row--qualified" : ""}`}
          role="row"
          key={row.teamId}
        >
          <span className="standings__pos" role="cell">
            {i + 1}
          </span>
          <span className="standings__team" role="cell" title={row.teamName}>
            {row.shortName}
            <span className="standings__team-full">{row.teamName}</span>
          </span>
          <span role="cell">{row.played}</span>
          <span role="cell">{row.won}</span>
          <span role="cell">{row.lost}</span>
          <span className="standings__points" role="cell">
            {row.points}
          </span>
          <span
            className={`standings__nrr ${row.netRunRate >= 0 ? "is-pos" : "is-neg"}`}
            role="cell"
          >
            {row.netRunRate > 0 ? "+" : ""}
            {row.netRunRate.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}
