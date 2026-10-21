/* ============================================================
   PAVILION HUB — Teams & Players page
   ------------------------------------------------------------
   Features:
     • Browse all teams (real backend)
     • Team profile: roster, recent match history
     • Player profile: batting / bowling statistics, POTM count,
       recent innings
   ============================================================ */

import { useEffect, useState } from 'react'
import {
  SectionCard,
  LoadingRows,
  EmptyState,
} from '../components/SectionCard'
import { teamsApi, playersApi } from '../services/api'
import type { Team, Player, PlayerStats, TeamProfile } from '../types'
import './TeamsPage.css'

/* ── Helpers ──────────────────────────────────────────────── */

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

function stat(value: number | null | undefined, decimals = 0) {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value) || decimals === 0
    ? String(value)
    : value.toFixed(decimals)
}

/* ── Role pill ────────────────────────────────────────────── */

const ROLE_COLORS: Record<string, string> = {
  batter: '#7fd8ff',
  bowler: '#ffb454',
  'all-rounder': '#c6f24e',
  'wicket-keeper': '#b39bff',
}

function RolePill({ role }: { role: string }) {
  return (
    <span
      className="tp-role-pill"
      style={{ background: ROLE_COLORS[role] ?? '#ccc' }}
    >
      {role}
    </span>
  )
}

/* ── Player profile ───────────────────────────────────────── */

function PlayerProfile({
  player,
  onBack,
}: {
  player: Player
  onBack: () => void
}) {
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    playersApi
      .stats(player.id)
      .then((s) => { if (!cancelled) { setStats(s); setLoading(false) } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [player.id])

  return (
    <div className="tp-profile">
      <button className="tp-back" onClick={onBack}>← Back to team</button>

      <div className="tp-profile__hero">
        <div
          className="tp-profile__avatar"
          style={{ background: ROLE_COLORS[player.role] ?? '#888' }}
        >
          {player.name.charAt(0)}
        </div>
        <div className="tp-profile__info">
          <h3 className="tp-profile__name">{player.name}</h3>
          <div className="tp-profile__sub">
            <RolePill role={player.role} />
            {player.jerseyNumber !== undefined && (
              <span className="tp-profile__jersey">#{player.jerseyNumber}</span>
            )}
            {player.battingStyle && <span className="tp-profile__style">{player.battingStyle}</span>}
            {player.bowlingStyle && <span className="tp-profile__style">{player.bowlingStyle}</span>}
            {player.isDemo && <span className="tp-demo-badge">DEMO</span>}
          </div>
        </div>
      </div>

      {loading && <LoadingRows rows={4} />}
      {error  && <div className="tp-error">⚠ {error}</div>}

      {stats && (
        <>
          {/* POTM */}
          {stats.playerOfTheMatch > 0 && (
            <div className="tp-potm">
              🏅 Player of the Match: <strong>{stats.playerOfTheMatch}×</strong>
            </div>
          )}

          {/* Batting */}
          <SectionCard title="Batting" subtitle="Career aggregates from completed innings">
            <div className="tp-stats-grid">
              <div className="tp-stat"><span>Innings</span><strong>{stats.batting.innings}</strong></div>
              <div className="tp-stat"><span>Runs</span><strong>{stats.batting.runs}</strong></div>
              <div className="tp-stat"><span>HS</span><strong>{stats.batting.highestScore}</strong></div>
              <div className="tp-stat"><span>Avg</span><strong>{stat(stats.batting.average, 2)}</strong></div>
              <div className="tp-stat"><span>SR</span><strong>{stat(stats.batting.strikeRate, 1)}</strong></div>
              <div className="tp-stat"><span>50s</span><strong>{stats.batting.fifties}</strong></div>
              <div className="tp-stat"><span>100s</span><strong>{stats.batting.hundreds}</strong></div>
              <div className="tp-stat"><span>4s</span><strong>{stats.batting.fours}</strong></div>
              <div className="tp-stat"><span>6s</span><strong>{stats.batting.sixes}</strong></div>
            </div>
          </SectionCard>

          {/* Bowling */}
          <SectionCard title="Bowling" subtitle="Career aggregates from completed innings">
            <div className="tp-stats-grid">
              <div className="tp-stat"><span>Innings</span><strong>{stats.bowling.innings}</strong></div>
              <div className="tp-stat"><span>Wickets</span><strong>{stats.bowling.wickets}</strong></div>
              <div className="tp-stat"><span>Runs</span><strong>{stats.bowling.runs}</strong></div>
              <div className="tp-stat"><span>Overs</span><strong>{stat(stats.bowling.balls ? stats.bowling.balls / 6 : 0, 1)}</strong></div>
              <div className="tp-stat"><span>Economy</span><strong>{stat(stats.bowling.economy, 2)}</strong></div>
              <div className="tp-stat"><span>Average</span><strong>{stat(stats.bowling.average, 2)}</strong></div>
              <div className="tp-stat"><span>Wides</span><strong>{stats.bowling.wides}</strong></div>
              <div className="tp-stat"><span>No-balls</span><strong>{stats.bowling.noBalls}</strong></div>
            </div>
          </SectionCard>

          {/* Recent batting */}
          {stats.recentBatting.length > 0 && (
            <SectionCard title="Recent Innings" subtitle="Last 10 batting performances">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>R</th>
                    <th>B</th>
                    <th>4s</th>
                    <th>6s</th>
                    <th>SR</th>
                    <th>How out</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentBatting.map((r, i) => (
                    <tr key={i}>
                      <td>{fmtDate(r.date)}</td>
                      <td>{r.opponent}</td>
                      <td><strong>{r.runs}</strong></td>
                      <td>{r.balls}</td>
                      <td>{r.fours}</td>
                      <td>{r.sixes}</td>
                      <td>{r.balls > 0 ? ((r.runs / r.balls) * 100).toFixed(0) : '—'}</td>
                      <td className="tp-table__dismissal">{r.dismissal ?? 'not out'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}

/* ── Team profile ─────────────────────────────────────────── */

function TeamProfileView({
  team,
  onBack,
}: {
  team: Team
  onBack: () => void
}) {
  const [profile, setProfile] = useState<TeamProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    teamsApi
      .profile(team.id)
      .then((p) => { if (!cancelled) { setProfile(p); setLoading(false) } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [team.id])

  if (selectedPlayer) {
    return (
      <PlayerProfile
        player={selectedPlayer}
        onBack={() => setSelectedPlayer(null)}
      />
    )
  }

  return (
    <div className="tp-profile">
      <button className="tp-back" onClick={onBack}>← Back to teams</button>

      <div className="tp-profile__hero">
        <div
          className="tp-profile__avatar tp-profile__avatar--team"
          style={{ background: team.color }}
        >
          {team.shortName}
        </div>
        <div className="tp-profile__info">
          <h3 className="tp-profile__name">{team.name}</h3>
          <div className="tp-profile__sub">
            <span className="tp-profile__style">{team.shortName}</span>
            {team.city && <span className="tp-profile__style">{team.city}</span>}
            {team.homeGround && <span className="tp-profile__style">🏟 {team.homeGround}</span>}
            {team.isDemo && <span className="tp-demo-badge">DEMO</span>}
          </div>
        </div>
      </div>

      {loading && <LoadingRows rows={5} />}
      {error && <div className="tp-error">⚠ {error}</div>}

      {profile && (
        <>
          {/* Roster */}
          <SectionCard title="Squad" subtitle="All players in this team">
            {profile.players.length === 0 ? (
              <EmptyState icon="👤" title="No players added" hint="Add players via the backend API." />
            ) : (
              <ul className="tp-player-list">
                {profile.players.map((p) => (
                  <li key={p.id}>
                    <button
                      className="tp-player-btn"
                      onClick={() => setSelectedPlayer(p)}
                    >
                      <div className="tp-player-btn__left">
                        <span
                          className="tp-player-btn__avatar"
                          style={{ background: ROLE_COLORS[p.role] ?? '#888' }}
                        >
                          {p.name.charAt(0)}
                        </span>
                        <span className="tp-player-btn__name">
                          {p.name}
                          {p.jerseyNumber !== undefined && (
                            <span className="tp-player-btn__num"> #{p.jerseyNumber}</span>
                          )}
                        </span>
                      </div>
                      <div className="tp-player-btn__right">
                        <RolePill role={p.role} />
                        <span className="tp-player-btn__arrow">→</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Match history */}
          <SectionCard
            title="Match History"
            subtitle="Last 20 matches — results from persisted backend data"
          >
            {profile.recentMatches.length === 0 ? (
              <EmptyState icon="📋" title="No matches played yet" />
            ) : (
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Tournament</th>
                    <th>Format</th>
                    <th>Opponent(s)</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.recentMatches.map((m) => (
                    <tr
                      key={m.id}
                      className={
                        m.isAbandoned
                          ? 'tp-row--nr'
                          : m.isTie
                          ? 'tp-row--tie'
                          : m.won
                          ? 'tp-row--win'
                          : 'tp-row--loss'
                      }
                    >
                      <td>{fmtDate(m.date)}</td>
                      <td>{m.tournament}</td>
                      <td>{m.format}</td>
                      <td>{m.opponents.map((o) => o.name).join(', ')}</td>
                      <td>
                        {m.isAbandoned
                          ? <span className="tp-outcome tp-outcome--nr">No result</span>
                          : m.isTie
                          ? <span className="tp-outcome tp-outcome--tie">Tie</span>
                          : m.won
                          ? <span className="tp-outcome tp-outcome--win">Won</span>
                          : <span className="tp-outcome tp-outcome--loss">Lost</span>}
                        {m.result && <span className="tp-outcome__detail"> · {m.result}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}

/* ── Teams list ───────────────────────────────────────────── */

function TeamCard({ team, onClick }: { team: Team; onClick: () => void }) {
  return (
    <button className="tp-team-card" onClick={onClick}>
      <div
        className="tp-team-card__badge"
        style={{ background: team.color }}
      >
        {team.shortName}
      </div>
      <div className="tp-team-card__body">
        <span className="tp-team-card__name">{team.name}</span>
        {(team.city || team.homeGround) && (
          <span className="tp-team-card__sub">
            {[team.city, team.homeGround].filter(Boolean).join(' · ')}
          </span>
        )}
        {team.isDemo && <span className="tp-demo-badge">DEMO</span>}
      </div>
      <span className="tp-team-card__arrow">→</span>
    </button>
  )
}

/* ── Main page ────────────────────────────────────────────── */

export function TeamsPage() {
  const [teams, setTeams]       = useState<Team[] | null>(null)
  const [selected, setSelected] = useState<Team | null>(null)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    teamsApi.list()
      .then((ts) => { if (!cancelled) setTeams(ts) })
      .catch((e) => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [])

  if (selected) {
    return (
      <TeamProfileView team={selected} onBack={() => setSelected(null)} />
    )
  }

  return (
    <div className="tp-page">
      <div className="tp-page__header">
        <h2 className="tp-page__title">Teams & Players</h2>
        <p className="tp-page__subtitle">
          Browse team profiles, rosters, match history, and career statistics.
        </p>
      </div>

      {error && <div className="tp-error">⚠ {error}</div>}

      {teams === null ? (
        <SectionCard title="Loading…">
          <LoadingRows rows={5} />
        </SectionCard>
      ) : teams.length === 0 ? (
        <SectionCard title="Teams">
          <EmptyState
            icon="👥"
            title="No teams found"
            hint="Create teams via the backend API to get started."
          />
        </SectionCard>
      ) : (
        <div className="tp-team-grid">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} onClick={() => setSelected(t)} />
          ))}
        </div>
      )}
    </div>
  )
}

