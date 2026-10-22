import { useEffect, useState, type FormEvent } from 'react'
import { EmptyState, LoadingRows, SectionCard } from '../components/SectionCard'
import { matchesApi, playersApi, teamsApi, type MatchInput } from '../services/api'
import type { Match, Player, Team } from '../types'

const FORMAT_OVERS: Record<'T10' | 'T20' | 'ODI', number> = {
  T10: 10,
  T20: 20,
  ODI: 50,
}

function toLocalDateTime(value?: string) {
  const date = value ? new Date(value) : new Date()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function MatchSetupForm({
  match,
  onCancel,
  onSaved,
  onManageTeams,
}: {
  match?: Match
  onCancel: () => void
  onSaved: (saved: Match) => void
  onManageTeams?: () => void
}) {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [teamIds, setTeamIds] = useState<[string, string]>([
    match?.teams[0]?.id ?? '',
    match?.teams[1]?.id ?? '',
  ])
  const [format, setFormat] = useState<'T10' | 'T20' | 'ODI'>(
    match?.format === 'T10' || match?.format === 'ODI' ? match.format : 'T20',
  )
  const [overs, setOvers] = useState(match?.setup?.oversPerInnings ?? 20)
  const [venue, setVenue] = useState(match?.venue ?? '')
  const [date, setDate] = useState(toLocalDateTime(match?.date))
  const [tossWinnerTeamId, setTossWinnerTeamId] = useState(match?.setup?.tossWinnerTeamId ?? '')
  const [tossDecision, setTossDecision] = useState<'bat' | 'field'>(match?.setup?.tossDecision ?? 'bat')
  const [xiPlayerIds, setXiPlayerIds] = useState<[string[], string[]]>([
    match?.setup?.playingXIs.find((xi) => xi.teamId === match.teams[0].id)?.playerIds ?? [],
    match?.setup?.playingXIs.find((xi) => xi.teamId === match.teams[1].id)?.playerIds ?? [],
  ])
  const [captainIds, setCaptainIds] = useState<[string, string]>([
    match?.setup?.playingXIs.find((xi) => xi.teamId === match.teams[0].id)?.captainId ?? '',
    match?.setup?.playingXIs.find((xi) => xi.teamId === match.teams[1].id)?.captainId ?? '',
  ])
  const [wicketkeeperIds, setWicketkeeperIds] = useState<[string, string]>([
    match?.setup?.playingXIs.find((xi) => xi.teamId === match.teams[0].id)?.wicketkeeperId ?? '',
    match?.setup?.playingXIs.find((xi) => xi.teamId === match.teams[1].id)?.wicketkeeperId ?? '',
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([teamsApi.list(), playersApi.list()])
      .then(([teamList, playerList]) => {
        if (cancelled) return
        const availableTeams = teamList.filter((team) => !team.isDemo)
        setTeams(availableTeams)
        setPlayers(playerList.filter((player) => !player.isDemo && player.isActive !== false))
        setTeamIds((current) => [
          current[0] || availableTeams[0]?.id || '',
          current[1] || availableTeams.find((team) => team.id !== current[0])?.id || '',
        ])
        setLoadingError(null)
      })
      .catch((cause) => {
        if (!cancelled) {
          setLoadingError(cause instanceof Error ? cause.message : 'Unable to load saved teams and players.')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reloadKey])

  useEffect(() => {
    if (!tossWinnerTeamId && teamIds[0]) setTossWinnerTeamId(teamIds[0])
  }, [teamIds, tossWinnerTeamId])

  function changeTeam(side: 0 | 1, teamId: string) {
    if (tossWinnerTeamId === teamIds[side]) setTossWinnerTeamId('')
    setTeamIds((current) => {
      const next: [string, string] = [...current]
      next[side] = teamId
      return next
    })
    setXiPlayerIds((current) => {
      const next: [string[], string[]] = [...current]
      next[side] = []
      return next
    })
    setCaptainIds((current) => {
      const next: [string, string] = [...current]
      next[side] = ''
      return next
    })
    setWicketkeeperIds((current) => {
      const next: [string, string] = [...current]
      next[side] = ''
      return next
    })
  }

  function togglePlayer(side: 0 | 1, playerId: string) {
    const selected = xiPlayerIds[side]
    const nextPlayers = selected.includes(playerId)
      ? selected.filter((id) => id !== playerId)
      : selected.length < 11 ? [...selected, playerId] : selected
    setXiPlayerIds((current) => {
      const next: [string[], string[]] = [...current]
      next[side] = nextPlayers
      return next
    })
    if (!nextPlayers.includes(captainIds[side])) {
      setCaptainIds((current) => {
        const next: [string, string] = [...current]
        next[side] = ''
        return next
      })
    }
    if (!nextPlayers.includes(wicketkeeperIds[side])) {
      setWicketkeeperIds((current) => {
        const next: [string, string] = [...current]
        next[side] = ''
        return next
      })
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!teamIds[0] || !teamIds[1]) {
      setError('Select two saved teams before creating a match.')
      return
    }
    if (teamIds[0] === teamIds[1]) {
      setError('A match must use two different teams.')
      return
    }
    if (xiPlayerIds.some((selected) => selected.length !== 11)) {
      setError('Select exactly 11 players for each team’s playing XI.')
      return
    }
    if (captainIds.some((id, side) => !xiPlayerIds[side].includes(id))
      || wicketkeeperIds.some((id, side) => !xiPlayerIds[side].includes(id))) {
      setError('Choose a captain and wicketkeeper from each selected playing XI.')
      return
    }
    if (!Number.isInteger(overs) || overs < 1 || overs > FORMAT_OVERS[format]) {
      setError(`Overs must be between 1 and ${FORMAT_OVERS[format]} for ${format}.`)
      return
    }
    setSaving(true)
    try {
      const payload: MatchInput = {
        ...(match?.tournamentId ? { tournamentId: match.tournamentId } : {}),
        format,
        venue: venue.trim(),
        date: new Date(date).toISOString(),
        status: 'upcoming',
        teams: [{ id: teamIds[0] }, { id: teamIds[1] }],
        setup: {
          oversPerInnings: overs,
          tossWinnerTeamId,
          tossDecision,
          playingXIs: teamIds.map((teamId, side) => ({
            teamId,
            playerIds: xiPlayerIds[side],
            captainId: captainIds[side],
            wicketkeeperId: wicketkeeperIds[side],
          })),
        },
      }
      const saved = match
        ? await matchesApi.update(match.id, payload)
        : await matchesApi.create(payload)
      onSaved(saved)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save this match setup.')
    } finally {
      setSaving(false)
    }
  }

  function rosterFor(side: 0 | 1) {
    return (players ?? []).filter((player) => player.teamId === teamIds[side])
  }

  if (loading) {
    return <SectionCard title="Loading saved teams and players"><LoadingRows rows={6} /></SectionCard>
  }
  if (loadingError) {
    return (
      <div className="mp-error" role="alert">
        ⚠ {loadingError}
        <button className="mp-retry" type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
        <button className="mp-retry" type="button" onClick={onCancel}>Cancel</button>
      </div>
    )
  }

  const availableTeams = teams ?? []
  const notEnoughTeams = availableTeams.length < 2

  return (
    <form className="mp-setup" onSubmit={submit}>
      <div className="mp-setup__heading">
        <div>
          <h3>{match ? 'Edit match setup' : 'Create a match'}</h3>
          <p>Select two saved teams and exactly 11 saved players per side.</p>
        </div>
        <button type="button" className="mp-button mp-button--quiet" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
      {notEnoughTeams ? (
        <>
          <EmptyState
            icon="👥"
            title="Two teams are needed"
            hint="Create at least two teams and their player squads in Teams & Players before setting up a match."
          />
          <button type="button" className="mp-button mp-button--quiet" onClick={onManageTeams}>
            Manage Teams & Players
          </button>
        </>
      ) : (
        <>
          <div className="mp-setup__grid">
            <label>
              Match format
              <select value={format} onChange={(event) => {
                const next = event.target.value as 'T10' | 'T20' | 'ODI'
                setFormat(next)
                setOvers(Math.min(overs, FORMAT_OVERS[next]))
              }}>
                <option value="T10">T10</option>
                <option value="T20">T20</option>
                <option value="ODI">ODI</option>
              </select>
            </label>
            <label>
              Overs per innings
              <input type="number" min={1} max={FORMAT_OVERS[format]} step={1} required value={overs}
                onChange={(event) => setOvers(Number(event.target.value))} />
            </label>
            <label>
              Venue
              <input required maxLength={160} value={venue} onChange={(event) => setVenue(event.target.value)} />
            </label>
            <label>
              Match date and time
              <input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              Toss winner
              <select required value={tossWinnerTeamId} onChange={(event) => setTossWinnerTeamId(event.target.value)}>
                <option value="">Select toss winner</option>
                {teamIds.filter(Boolean).map((id) => {
                  const team = availableTeams.find((item) => item.id === id)
                  return team ? <option key={team.id} value={team.id}>{team.name}</option> : null
                })}
              </select>
            </label>
            <label>
              Toss decision
              <select value={tossDecision} onChange={(event) => setTossDecision(event.target.value as 'bat' | 'field')}>
                <option value="bat">Bat first</option>
                <option value="field">Field first</option>
              </select>
            </label>
          </div>

          <div className="mp-setup__teams">
            {([0, 1] as const).map((side) => {
              const roster = rosterFor(side)
              const selectedPlayers = roster.filter((player) => xiPlayerIds[side].includes(player.id))
              return (
                <section className="mp-xi" key={side}>
                  <label className="mp-xi__team">
                    {side === 0 ? 'First team' : 'Second team'}
                    <select value={teamIds[side]} onChange={(event) => changeTeam(side, event.target.value)}>
                      <option value="">Select a saved team</option>
                      {availableTeams.filter((team) => team.id === teamIds[side] || team.id !== teamIds[1 - side])
                        .map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                  </label>
                  <div className="mp-xi__count">{xiPlayerIds[side].length} / 11 players selected</div>
                  {roster.length < 11 ? (
                    <>
                      <EmptyState icon="👤" title="Squad needs more players" hint={`This team has ${roster.length} saved players; add at least 11 to select a playing XI.`} />
                      <button type="button" className="mp-button mp-button--quiet" onClick={onManageTeams}>
                        Manage Teams & Players
                      </button>
                    </>
                  ) : (
                    <div className="mp-xi__roster">
                      {roster.map((player) => {
                        const checked = xiPlayerIds[side].includes(player.id)
                        return (
                          <label className="mp-xi__player" key={player.id}>
                            <input type="checkbox" checked={checked}
                              disabled={!checked && xiPlayerIds[side].length === 11}
                              onChange={() => togglePlayer(side, player.id)} />
                            <span>{player.name}{typeof player.jerseyNumber === 'number' ? ` #${player.jerseyNumber}` : ''}</span>
                            {player.role === 'wicket-keeper' && <small>Wicketkeeper</small>}
                          </label>
                        )
                      })}
                    </div>
                  )}
                  <div className="mp-xi__selectors">
                    <label>
                      Captain
                      <select required value={captainIds[side]} onChange={(event) => {
                        const next: [string, string] = [...captainIds]
                        next[side] = event.target.value
                        setCaptainIds(next)
                      }}>
                        <option value="">Select from playing XI</option>
                        {selectedPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                      </select>
                    </label>
                    <label>
                      Wicketkeeper
                      <select required value={wicketkeeperIds[side]} onChange={(event) => {
                        const next: [string, string] = [...wicketkeeperIds]
                        next[side] = event.target.value
                        setWicketkeeperIds(next)
                      }}>
                        <option value="">Select from playing XI</option>
                        {selectedPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                      </select>
                    </label>
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}
      {error && <p className="mp-error" role="alert">⚠ {error}</p>}
      {!notEnoughTeams && (
        <div className="mp-setup__actions">
          <button type="button" className="mp-button mp-button--quiet" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="mp-button" disabled={saving}>
            {saving ? 'Saving…' : match ? 'Save setup' : 'Create match'}
          </button>
        </div>
      )}
    </form>
  )
}
