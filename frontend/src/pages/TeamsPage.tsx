/* ============================================================
   PAVILION HUB — Teams & Players page
   ------------------------------------------------------------
   Features:
     • Browse all teams (real backend)
     • Team profile: roster, recent match history
     • Player profile: batting / bowling statistics, POTM count,
       recent innings
   ============================================================ */

import { useEffect, useState, type FormEvent } from 'react'
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

function TeamForm({
  team,
  onSave,
  onCancel,
}: {
  team?: Team
  onSave: (team: Team) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(team?.name ?? '')
  const [shortName, setShortName] = useState(team?.shortName ?? '')
  const [color, setColor] = useState(team?.color ?? '#c6f24e')
  const [city, setCity] = useState(team?.city ?? '')
  const [homeGround, setHomeGround] = useState(team?.homeGround ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const data = {
        name: name.trim(),
        shortName: shortName.trim(),
        color,
        city: city.trim(),
        homeGround: homeGround.trim(),
      }
      const saved = team
        ? await teamsApi.update(team.id, data)
        : await teamsApi.create(data)
      onSave(saved)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the team.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="tp-form" onSubmit={submit}>
      <h3>{team ? 'Edit team' : 'Create a team'}</h3>
      <label>
        Team name <span aria-hidden="true">*</span>
        <input
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="organization"
        />
      </label>
      <label>
        Short name <span className="tp-form__optional">(optional)</span>
        <input
          maxLength={12}
          value={shortName}
          onChange={(event) => setShortName(event.target.value)}
          placeholder="Generated from the team name"
        />
      </label>
      <label>
        City <span className="tp-form__optional">(optional)</span>
        <input maxLength={100} value={city} onChange={(event) => setCity(event.target.value)} />
      </label>
      <label>
        Home ground <span className="tp-form__optional">(optional)</span>
        <input maxLength={100} value={homeGround} onChange={(event) => setHomeGround(event.target.value)} />
      </label>
      <label className="tp-form__color">
        Team color
        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
      </label>
      {error && <p className="tp-error" role="alert">{error}</p>}
      <div className="tp-form__actions">
        <button type="button" className="tp-button tp-button--quiet" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="tp-button" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : team ? 'Save changes' : 'Create team'}
        </button>
      </div>
    </form>
  )
}

function PlayerForm({
  teamId,
  player,
  onSave,
  onCancel,
}: {
  teamId: string
  player?: Player
  onSave: (player: Player) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(player?.name ?? '')
  const [role, setRole] = useState<Player['role']>(player?.role ?? 'all-rounder')
  const [jerseyNumber, setJerseyNumber] = useState(
    player?.jerseyNumber === undefined ? '' : String(player.jerseyNumber),
  )
  const [isCaptain, setIsCaptain] = useState(player?.isCaptain ?? false)
  const [isWicketkeeper, setIsWicketkeeper] = useState(player?.isWicketkeeper ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const data = {
        teamId,
        name: name.trim(),
        role,
        jerseyNumber: jerseyNumber === '' ? null : Number(jerseyNumber),
        isCaptain,
        isWicketkeeper,
      }
      const saved = player
        ? await playersApi.update(player.id, data)
        : await playersApi.create(data)
      onSave(saved)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the player.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="tp-form tp-form--player" onSubmit={submit}>
      <h3>{player ? 'Edit player' : 'Add a player'}</h3>
      <label>
        Player name <span aria-hidden="true">*</span>
        <input
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
        />
      </label>
      <label>
        Playing role
        <select value={role} onChange={(event) => setRole(event.target.value as Player['role'])}>
          <option value="batter">Batter</option>
          <option value="bowler">Bowler</option>
          <option value="all-rounder">All-rounder</option>
          <option value="wicket-keeper">Wicket-keeper</option>
        </select>
      </label>
      <label>
        Jersey number <span className="tp-form__optional">(optional)</span>
        <input
          type="number"
          min={0}
          max={999}
          step={1}
          inputMode="numeric"
          value={jerseyNumber}
          onChange={(event) => setJerseyNumber(event.target.value)}
        />
      </label>
      <div className="tp-form__checks">
        <label><input type="checkbox" checked={isCaptain} onChange={(event) => setIsCaptain(event.target.checked)} /> Captain</label>
        <label><input type="checkbox" checked={isWicketkeeper} onChange={(event) => setIsWicketkeeper(event.target.checked)} /> Wicketkeeper</label>
      </div>
      {error && <p className="tp-error" role="alert">{error}</p>}
      <div className="tp-form__actions">
        <button type="button" className="tp-button tp-button--quiet" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="tp-button" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : player ? 'Save changes' : 'Add player'}
        </button>
      </div>
    </form>
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
  onTeamUpdated,
  onTeamDeleted,
}: {
  team: Team
  onBack: () => void
  onTeamUpdated: (team: Team) => void
  onTeamDeleted: (team: Team) => Promise<void>
}) {
  const [profile, setProfile] = useState<TeamProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [editingTeam, setEditingTeam] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null)
  const [deletingTeam, setDeletingTeam] = useState(false)

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

  async function removePlayer(player: Player) {
    if (!window.confirm(`Delete ${player.name}?`)) return
    setActionError(null)
    setNotice(null)
    setDeletingPlayerId(player.id)
    try {
      await playersApi.remove(player.id)
      setProfile((current) => current
        ? { ...current, players: current.players.filter(({ id: playerId }) => playerId !== player.id) }
        : current)
      setNotice(`${player.name} was deleted.`)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to delete this player.')
    } finally {
      setDeletingPlayerId(null)
    }
  }

  function savePlayer(player: Player) {
    setProfile((current) => current
      ? {
          ...current,
          players: current.players.some(({ id }) => id === player.id)
            ? current.players.map((existing) => existing.id === player.id ? player : existing)
            : [...current.players, player].sort((left, right) => left.name.localeCompare(right.name)),
        }
      : current)
    setAddingPlayer(false)
    setEditingPlayer(null)
    setActionError(null)
    setNotice(`${player.name} was ${editingPlayer ? 'updated' : 'added'} successfully.`)
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
          </div>
        </div>
        <div className="tp-profile__actions">
          <button className="tp-button tp-button--quiet" onClick={() => setEditingTeam((value) => !value)}>
            Edit team
          </button>
          <button
            className="tp-button tp-button--danger"
            onClick={async () => {
              if (!window.confirm(`Delete ${team.name}? Teams referenced by players, tournaments, or matches cannot be deleted.`)) return
              setActionError(null)
              setDeletingTeam(true)
              try {
                await onTeamDeleted(team)
              } catch (cause) {
                setActionError(cause instanceof Error ? cause.message : 'Unable to delete this team.')
              } finally {
                setDeletingTeam(false)
              }
            }}
            disabled={deletingTeam}
          >
            {deletingTeam ? 'Deleting…' : 'Delete team'}
          </button>
        </div>
      </div>

      {editingTeam && (
        <TeamForm
          team={team}
          onCancel={() => setEditingTeam(false)}
          onSave={(updated) => {
            onTeamUpdated(updated)
            setEditingTeam(false)
            setNotice('Team changes saved.')
          }}
        />
      )}
      {loading && <LoadingRows rows={5} />}
      {error && <div className="tp-error">⚠ {error}</div>}
      {actionError && <div className="tp-error" role="alert">⚠ {actionError}</div>}
      {notice && <p className="tp-success" role="status">{notice}</p>}

      {profile && (
        <>
          {/* Roster */}
          <SectionCard
            title="Squad"
            subtitle="Players belonging to this team"
            action={
              <button className="tp-button" onClick={() => { setAddingPlayer(true); setEditingPlayer(null) }}>
                Add player
              </button>
            }
          >
            {addingPlayer && (
              <PlayerForm
                teamId={team.id}
                onCancel={() => setAddingPlayer(false)}
                onSave={savePlayer}
              />
            )}
            {editingPlayer && (
              <PlayerForm
                key={editingPlayer.id}
                teamId={team.id}
                player={editingPlayer}
                onCancel={() => setEditingPlayer(null)}
                onSave={savePlayer}
              />
            )}
            {profile.players.filter((player) => !player.isDemo).length === 0 && !addingPlayer ? (
              <EmptyState icon="👤" title="No players yet" hint="Add your team's first player to build its squad." />
            ) : (
              <ul className="tp-player-list">
                {profile.players.filter((player) => !player.isDemo).map((p) => (
                  <li key={p.id}>
                    <div className="tp-player-row">
                      <button className="tp-player-btn" onClick={() => setSelectedPlayer(p)}>
                        <div className="tp-player-btn__left">
                          <span className="tp-player-btn__avatar" style={{ background: ROLE_COLORS[p.role] ?? '#888' }}>
                            {p.name.charAt(0)}
                          </span>
                          <span className="tp-player-btn__name">
                            {p.name}
                            {typeof p.jerseyNumber === 'number' && <span className="tp-player-btn__num"> #{p.jerseyNumber}</span>}
                            {p.isCaptain && <span className="tp-player-badge">Captain</span>}
                            {p.isWicketkeeper && <span className="tp-player-badge">Wicketkeeper</span>}
                          </span>
                        </div>
                        <div className="tp-player-btn__right">
                          <RolePill role={p.role} />
                          <span className="tp-player-btn__arrow">View →</span>
                        </div>
                      </button>
                      <div className="tp-player-actions">
                        <button className="tp-button tp-button--quiet" onClick={() => { setEditingPlayer(p); setAddingPlayer(false) }}>
                          Edit
                        </button>
                        <button
                          className="tp-button tp-button--danger"
                          onClick={() => void removePlayer(p)}
                          disabled={deletingPlayerId === p.id}
                        >
                          {deletingPlayerId === p.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
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

function TeamCard({
  team,
  onClick,
  onEdit,
  onDelete,
  deleting,
}: {
  team: Team
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <article className="tp-team-card">
      <button className="tp-team-card__open" onClick={onClick} aria-label={`View ${team.name} players`}>
        <span className="tp-team-card__badge" style={{ background: team.color }}>
          {team.shortName}
        </span>
        <span className="tp-team-card__body">
          <span className="tp-team-card__name">{team.name}</span>
          {(team.city || team.homeGround) && (
            <span className="tp-team-card__sub">
              {[team.city, team.homeGround].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <span className="tp-team-card__arrow">→</span>
      </button>
      <div className="tp-team-card__actions">
        <button className="tp-button tp-button--quiet" onClick={onEdit}>Edit</button>
        <button
          className="tp-button tp-button--danger"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </article>
  )
}

/* ── Main page ────────────────────────────────────────────── */

export function TeamsPage() {
  const [teams, setTeams]       = useState<Team[] | null>(null)
  const [selected, setSelected] = useState<Team | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Team | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    teamsApi.list()
      .then((ts) => { if (!cancelled) { setTeams(ts); setError(null) } })
      .catch((e) => { if (!cancelled) { setTeams(null); setError(e instanceof Error ? e.message : 'Unable to load teams.') } })
    return () => { cancelled = true }
  }, [reloadKey])

  function saveTeam(team: Team) {
    setTeams((current) => current
      ? current.some(({ id }) => id === team.id)
        ? current.map((existing) => existing.id === team.id ? team : existing)
        : [...current, team].sort((left, right) => left.name.localeCompare(right.name))
      : [team])
    if (selected?.id === team.id) setSelected(team)
    setCreating(false)
    setEditing(null)
    setError(null)
    setNotice(`Team "${team.name}" was saved successfully.`)
  }

  async function removeTeam(team: Team) {
    setError(null)
    setNotice(null)
    setDeletingTeamId(team.id)
    try {
      await teamsApi.remove(team.id)
      setTeams((current) => current?.filter(({ id }) => id !== team.id) ?? [])
      if (selected?.id === team.id) setSelected(null)
      setNotice(`Team "${team.name}" was deleted.`)
    } finally {
      setDeletingTeamId(null)
    }
  }

  if (selected) {
    return (
      <TeamProfileView
        team={selected}
        onBack={() => setSelected(null)}
        onTeamUpdated={saveTeam}
        onTeamDeleted={removeTeam}
      />
    )
  }

  const visibleTeams = (teams ?? []).filter((team) => !team.isDemo)

  return (
    <div className="tp-page">
      <div className="tp-page__header">
        <div>
          <h2 className="tp-page__title">Teams & Players</h2>
          <p className="tp-page__subtitle">
            Create your teams and manage their player squads.
          </p>
        </div>
        <button
          className="tp-button"
          onClick={() => { setCreating((value) => !value); setEditing(null); setNotice(null) }}
        >
          {creating ? 'Cancel' : 'Create team'}
        </button>
      </div>

      {notice && <p className="tp-success" role="status">{notice}</p>}
      {error && (
        <div className="tp-error" role="alert">
          ⚠ {error}
          <button className="tp-retry" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
        </div>
      )}

      {creating && (
        <TeamForm
          onCancel={() => setCreating(false)}
          onSave={saveTeam}
        />
      )}
      {editing && (
        <TeamForm
          key={editing.id}
          team={editing}
          onCancel={() => setEditing(null)}
          onSave={saveTeam}
        />
      )}

      {teams === null && !error ? (
        <SectionCard title="Loading teams">
          <LoadingRows rows={4} />
        </SectionCard>
      ) : teams === null ? null : visibleTeams.length === 0 ? (
        <SectionCard title="Your teams">
          <EmptyState
            icon="👥"
            title="No teams yet"
            hint="Create a team to start adding your own players. Your information is saved to the backend database."
          />
        </SectionCard>
      ) : (
        <div className="tp-team-grid">
          {visibleTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onClick={() => { setSelected(team); setNotice(null) }}
              onEdit={() => { setEditing(team); setCreating(false); setNotice(null) }}
              deleting={deletingTeamId === team.id}
              onDelete={() => {
                if (window.confirm(`Delete ${team.name}? Teams referenced by players, tournaments, or matches cannot be deleted.`)) {
                  void removeTeam(team).catch((cause) => {
                    setError(cause instanceof Error ? cause.message : 'Unable to delete this team.')
                  })
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
