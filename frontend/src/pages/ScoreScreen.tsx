import { useEffect, useState } from 'react'
import {
  applyDelivery,
  buildInitialState,
  calculateTarget,
  oversDisplay,
  runRate,
  setBowler,
  type DeliveryEvent,
  type InningsState,
  type MatchSetup as EngineMatchSetup,
  type MatchState,
  type WicketType,
} from '../scoring/engine'
import { matchesApi, scoringApi, type ScoringSession } from '../services/api'
import type { Match, MatchPlayingXI, Team } from '../types'
import './ScoreScreen.css'

const WICKET_TYPES: { value: WicketType; label: string }[] = [
  { value: 'bowled', label: 'Bowled' },
  { value: 'caught', label: 'Caught' },
  { value: 'lbw', label: 'LBW' },
  { value: 'runout', label: 'Run out' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hitwicket', label: 'Hit wicket' },
  { value: 'caughtfielder', label: 'Caught and bowled' },
]

function xiFor(match: Match, teamId: string): MatchPlayingXI {
  return match.setup?.playingXIs.find((xi) => xi.teamId === teamId)!
}

function engineTeam(match: Match, team: Team) {
  const xi = xiFor(match, team.id)
  return {
    id: team.id,
    name: team.name,
    players: xi.selectedPlayers ?? [],
  }
}

function teamOf(match: Match, teamId: string) {
  return match.teams.find((team) => team.id === teamId)!
}

function playerName(match: MatchState, playerId: string) {
  for (const team of [match.teamA, match.teamB]) {
    const player = team.players.find((entry) => entry.id === playerId)
    if (player) return player.name
  }
  return '—'
}

function inningsSetup(match: Match, battingTeamId: string,
  openers: [string, string], firstBowler: string): EngineMatchSetup {
  const teams = match.teams.map((team) => engineTeam(match, team)) as [MatchState['teamA'], MatchState['teamB']]
  return {
    teamA: teams[0],
    teamB: teams[1],
    totalOvers: match.setup!.oversPerInnings,
    tossWinnerId: match.setup!.tossWinnerTeamId,
    tossDecision: match.setup!.tossDecision === 'bat' ? 'bat' : 'bowl',
    openers,
    firstBowler,
    battingOrder: xiFor(match, battingTeamId).playerIds,
  }
}

function SetupForm({
  match,
  saving,
  onStart,
}: {
  match: Match
  saving: boolean
  onStart: (state: MatchState) => Promise<void>
}) {
  const firstBattingId = match.setup!.tossDecision === 'bat'
    ? match.setup!.tossWinnerTeamId
    : match.teams.find((team) => team.id !== match.setup!.tossWinnerTeamId)!.id
  const firstBowlingId = match.teams.find((team) => team.id !== firstBattingId)!.id
  const battingXI = xiFor(match, firstBattingId)
  const bowlingXI = xiFor(match, firstBowlingId)
  const batters = battingXI.selectedPlayers ?? []
  const bowlers = bowlingXI.selectedPlayers ?? []
  const [striker, setStriker] = useState(batters[0]?.id ?? '')
  const [nonStriker, setNonStriker] = useState(batters[1]?.id ?? '')
  const [bowler, setBowler] = useState(bowlers[0]?.id ?? '')
  const [validationError, setValidationError] = useState('')

  const start = () => {
    if (!striker || !nonStriker || striker === nonStriker || !bowler) {
      setValidationError('Choose two different opening batters and an opening bowler.')
      return
    }
    const setup = inningsSetup(match, firstBattingId,
      [striker, nonStriker], bowler)
    void onStart(buildInitialState(setup))
  }

  return (
    <section className="score-setup">
      <h2>Start scoring</h2>
      <p className="score-setup__note">
        Set the opening batters and bowler for this saved match. The toss and playing XIs come from its match setup.
      </p>
      <p>
        <strong>{teamOf(match, firstBattingId).name}</strong> batting first ·{' '}
        {teamOf(match, firstBowlingId).name} bowling · {match.setup!.oversPerInnings} overs
      </p>
      <div className="score-setup__grid">
        <label>
          Opening striker
          <select value={striker} onChange={(event) => setStriker(event.target.value)}>
            {batters.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
        </label>
        <label>
          Opening non-striker
          <select value={nonStriker} onChange={(event) => setNonStriker(event.target.value)}>
            {batters.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
        </label>
        <label>
          Opening bowler
          <select value={bowler} onChange={(event) => setBowler(event.target.value)}>
            {bowlers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
        </label>
      </div>
      {validationError && <p className="score-message score-message--error" role="alert">{validationError}</p>}
      <button className="score-btn score-btn--primary" onClick={start} disabled={saving}>
        {saving ? 'Starting…' : 'Start scoring'}
      </button>
    </section>
  )
}

function Scoreboard({ match, inn, state }: {
  match: Match
  inn: InningsState
  state: MatchState
}) {
  const battingTeam = teamOf(match, inn.battingTeamId)
  const bowlingTeam = teamOf(match, inn.bowlingTeamId)
  const target = calculateTarget(state)
  return (
    <section className="score-scoreboard">
      <div className="score-scoreboard__main">
        <div>
          <span className="score-scoreboard__team">{battingTeam.name}</span>
          <span className="score-scoreboard__big">
            {inn.runs}/{inn.wickets}
            <span className="score-scoreboard__overs">
              {' '}({oversDisplay(inn.legalBalls)}/{state.totalOvers} ov)
            </span>
          </span>
        </div>
        <span>Innings {state.currentInningsIndex + 1}</span>
      </div>
      <div className="score-scoreboard__stats">
        <span>Bowling: {bowlingTeam.name}</span>
        <span>CRR {runRate(inn.runs, inn.legalBalls).toFixed(2)}</span>
        {target.target !== null && (
          <span className="score-scoreboard__target">
            Target {target.target} · need {target.runsNeeded} off {target.ballsRemaining} balls
            (RRR {target.requiredRunRate?.toFixed(2)})
          </span>
        )}
        <span>
          Extras {inn.extras.total} (wd {inn.extras.wides}, nb {inn.extras.noBalls},
          b {inn.extras.byes}, lb {inn.extras.legByes})
        </span>
      </div>
    </section>
  )
}

function CreasePanel({ match, inn }: { match: MatchState; inn: InningsState }) {
  const striker = inn.batterFigures[inn.strikerId]
  const nonStriker = inn.batterFigures[inn.nonStrikerId]
  const bowler = inn.bowlerFigures[inn.bowlerId]
  const formatBatter = (id: string, figures?: typeof striker) => figures
    ? `${playerName(match, id)} ${figures.runs} (${figures.balls}) 4s:${figures.fours} 6s:${figures.sixes}`
    : playerName(match, id)
  return (
    <section className="score-crease">
      <div className="score-crease__row score-crease__row--strike">
        <span className="score-crease__badge">Striker</span>
        <span>{formatBatter(inn.strikerId, striker)}</span>
      </div>
      <div className="score-crease__row">
        <span className="score-crease__badge score-crease__badge--dim">Non-striker</span>
        <span>{formatBatter(inn.nonStrikerId, nonStriker)}</span>
      </div>
      <div className="score-crease__row">
        <span className="score-crease__badge score-crease__badge--bowl">Bowler</span>
        <span>{bowler && inn.bowlerId
          ? `${playerName(match, inn.bowlerId)} — ${oversDisplay(bowler.balls)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets} (wd ${bowler.wides}, nb ${bowler.noBalls})`
          : 'Select bowler to begin the over'}</span>
      </div>
    </section>
  )
}

function deliveryLabel(delivery: DeliveryEvent) {
  if (delivery.wicket) return 'W'
  if (delivery.extraType === 'wide') return `wd${delivery.extraRuns ? `+${delivery.extraRuns}` : ''}`
  if (delivery.extraType === 'noball') {
    const runs = delivery.runsOffBat + (delivery.extraRuns ?? 0)
    return `nb${runs ? `+${runs}` : ''}${delivery.secondaryExtraType === 'bye' && delivery.extraRuns ? `+b${delivery.extraRuns}` : ''}${delivery.secondaryExtraType === 'legbye' && delivery.extraRuns ? `+lb${delivery.extraRuns}` : ''}`
  }
  if (delivery.extraType === 'bye') return `b${delivery.extraRuns ?? 0}`
  if (delivery.extraType === 'legbye') return `lb${delivery.extraRuns ?? 0}`
  return String(delivery.runsOffBat)
}

function OverHistory({ innings }: { innings: InningsState }) {
  const currentOver = innings.overs.at(-1) ?? []
  return (
    <section className="score-over">
      <h3>This over</h3>
      <div className="score-over__balls">
        {currentOver.map((delivery, index) => (
          <span key={index} className={`score-over__ball score-over__ball--${delivery.wicket
            ? 'w'
            : delivery.runsOffBat === 4 || delivery.runsOffBat === 6
              ? 'big'
              : delivery.extraType ? 'extra' : ''}`}>
            {deliveryLabel(delivery)}
          </span>
        ))}
        {currentOver.length === 0 && <span className="score-over__empty">Over starting…</span>}
      </div>
      <h3>Ball-by-ball</h3>
      <div className="score-over__log">
        {innings.deliveries.slice(-18).reverse().map((delivery, index) => (
          <span key={`${delivery.overIndex}-${delivery.ballIndex}-${index}`} className="score-over__logitem">
            {delivery.overIndex + 1}.{delivery.ballIndex + 1} {deliveryLabel(delivery)}
          </span>
        ))}
        {innings.deliveries.length === 0 && <span className="score-over__empty">No deliveries yet</span>}
      </div>
    </section>
  )
}

function allowedWicketTypes(extraType: DeliveryEvent['extraType']) {
  if (extraType === 'noball') return WICKET_TYPES.filter((wicket) => ['runout', 'other'].includes(wicket.value))
  if (extraType === 'wide') return WICKET_TYPES.filter((wicket) =>
    ['runout', 'stumped', 'hitwicket', 'other'].includes(wicket.value))
  if (extraType === 'bye' || extraType === 'legbye') {
    return WICKET_TYPES.filter((wicket) => ['runout', 'stumped', 'hitwicket', 'other'].includes(wicket.value))
  }
  return WICKET_TYPES
}

export function ScoreScreen() {
  const [matches, setMatches] = useState<Match[]>([])
  const [matchId, setMatchId] = useState('')
  const [session, setSession] = useState<ScoringSession | null>(null)
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [extraType, setExtraType] = useState<DeliveryEvent['extraType']>()
  const [secondaryExtraType, setSecondaryExtraType] = useState<DeliveryEvent['secondaryExtraType']>()
  const [extraRuns, setExtraRuns] = useState(0)
  const [wicketModal, setWicketModal] = useState(false)
  const [wicketType, setWicketType] = useState<WicketType>('bowled')
  const [wicketPlayer, setWicketPlayer] = useState('')
  const [battersCrossed, setBattersCrossed] = useState(false)
  const [wicketRuns, setWicketRuns] = useState(0)
  const [newBowler, setNewBowler] = useState('')

  useEffect(() => {
    let active = true
    setLoadingMatches(true)
    matchesApi.list().then((records) => {
      if (!active) return
      setMatches(records.filter((match) => !match.isDemo && match.setup))
      setLoadingMatches(false)
    }).catch((cause: unknown) => {
      if (!active) return
      setError(cause instanceof Error ? cause.message : 'Could not load saved matches.')
      setLoadingMatches(false)
    })
    return () => { active = false }
  }, [])

  const selectedMatch = matches.find((match) => match.id === matchId)
  const state = session?.matchState ?? null
  const innings = state?.innings[state.currentInningsIndex] ?? null

  const selectMatch = async (id: string) => {
    setMatchId(id)
    setSession(null)
    setError('')
    if (!id) return
    setSaving(true)
    try {
      const saved = await scoringApi.get(id)
      setSession(saved)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this match score.')
    } finally {
      setSaving(false)
    }
  }

  const startScoring = async (initialState: MatchState) => {
    if (!selectedMatch) return
    setError('')
    setSaving(true)
    try {
      setSession(await scoringApi.start(selectedMatch.id, initialState))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start scoring.')
    } finally {
      setSaving(false)
    }
  }

  const recordDelivery = async (delivery: DeliveryEvent) => {
    if (!selectedMatch || !session?.matchState || saving) return
    setError('')
    let nextState: MatchState
    try {
      nextState = applyDelivery(session.matchState, delivery)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This delivery is not valid.')
      return
    }
    setSaving(true)
    try {
      setSession(await scoringApi.record(
        selectedMatch.id,
        session.version,
        nextState,
        [...session.deliveries, delivery],
        session.bowlerSelections,
        delivery,
      ))
      setExtraType(undefined)
      setSecondaryExtraType(undefined)
      setExtraRuns(0)
      setWicketModal(false)
      setBattersCrossed(false)
      setWicketRuns(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this delivery.')
    } finally {
      setSaving(false)
    }
  }

  const chooseBowler = async () => {
    if (!selectedMatch || !session?.matchState || !newBowler || saving) return
    let nextState: MatchState
    try {
      nextState = setBowler(session.matchState, newBowler)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This bowler cannot be selected.')
      return
    }
    const selections = [...session.bowlerSelections, {
      afterDeliveryCount: session.deliveries.length,
      bowlerId: newBowler,
    }]
    setError('')
    setSaving(true)
    try {
      setSession(await scoringApi.chooseBowler(
        selectedMatch.id,
        session.version,
        nextState,
        session.deliveries,
        selections,
      ))
      setNewBowler('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the bowler selection.')
    } finally {
      setSaving(false)
    }
  }

  const undo = async () => {
    if (!selectedMatch || !session || !session.deliveries.length || saving) return
    setError('')
    setSaving(true)
    try {
      setSession(await scoringApi.undo(selectedMatch.id, session.version))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not undo the last delivery.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingMatches) {
    return <p className="score-loading" role="status">Loading saved matches…</p>
  }

  if (!matches.length) {
    return (
      <section className="score-setup">
        <h2>Ball-by-ball scoring</h2>
        <p>No saved matches with playing XIs are available to score.</p>
        <p>Create a match in Matches using saved teams and player squads first.</p>
        {error && <p className="score-message score-message--error" role="alert">{error}</p>}
      </section>
    )
  }

  if (!selectedMatch) {
    return (
      <section className="score-setup">
        <h2>Ball-by-ball scoring</h2>
        <p>Select a saved match to start or continue its persistent score.</p>
        <label>
          Match
          <select value={matchId} onChange={(event) => void selectMatch(event.target.value)}>
            <option value="">Select a match…</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.teams.map((team) => team.name).join(' vs ')} · {match.status}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="score-message score-message--error" role="alert">{error}</p>}
      </section>
    )
  }

  if (saving && !session) {
    return <p className="score-loading" role="status">Loading saved score…</p>
  }

  if (!state) {
    if (selectedMatch.status === 'completed' || selectedMatch.status === 'abandoned') {
      return (
        <section className="score-setup">
          <h2>{selectedMatch.teams.map((team) => team.name).join(' vs ')}</h2>
          <p>This match is already {selectedMatch.status} and has no resumable scoring session.</p>
          {error && <p className="score-message score-message--error" role="alert">{error}</p>}
        </section>
      )
    }
    return (
      <section>
        {error && <p className="score-message score-message--error" role="alert">{error}</p>}
        <SetupForm key={selectedMatch.id} match={selectedMatch} saving={saving} onStart={startScoring} />
      </section>
    )
  }

  if (!innings) {
    return <p className="score-message score-message--error" role="alert">Saved scoring state is invalid.</p>
  }

  const bowlingTeamId = innings.bowlingTeamId
  const bowlingPlayers = state.teamA.id === bowlingTeamId ? state.teamA.players : state.teamB.players
  const maximumOversPerBowler = Math.ceil(state.totalOvers / 5)
  const nextBowlerOptions = bowlingPlayers.filter((player) =>
    player.id !== innings.bowlerId
    && innings.overBowlers.filter((bowlerId) => bowlerId === player.id).length < maximumOversPerBowler)
  const overComplete = innings.overs.at(-1)?.length === 0 && innings.legalBalls > 0
    && innings.legalBalls % 6 === 0
  const showBowlerPicker = (!innings.bowlerId || overComplete) && !innings.completed
  const scoringDisabled = saving || !innings.bowlerId || innings.completed || Boolean(state.result)
  const dismissedPlayers = (wicketType === 'runout' || wicketType === 'other'
    ? [innings.strikerId, innings.nonStrikerId]
    : [innings.strikerId]).filter(Boolean)
  const visibleWicketTypes = allowedWicketTypes(extraType)
  const canDismissSelectedPlayer = wicketType === 'runout' || wicketType === 'other'
    || wicketPlayer === innings.strikerId
  const createWicket = () => recordDelivery({
    runsOffBat: wicketRuns,
    ...(extraType ? { extraType } : {}),
    ...(secondaryExtraType ? { secondaryExtraType } : {}),
    ...(extraRuns > 0 ? { extraRuns } : {}),
    wicket: {
      type: wicketType,
      dismissedPlayerId: wicketPlayer || innings.strikerId,
      ...(wicketType === 'runout' ? { battersCrossed } : {}),
    },
  })

  return (
    <div className="score-screen">
      <header className="score-screen__header">
        <h2>Scoring — {selectedMatch.teams.map((team) => team.name).join(' vs ')}</h2>
        <label>
          Match
          <select value={matchId} onChange={(event) => void selectMatch(event.target.value)} disabled={saving}>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.teams.map((team) => team.name).join(' vs ')} · {match.status}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <p className="score-message score-message--error" role="alert">{error}</p>}
      <Scoreboard match={selectedMatch} inn={innings} state={state} />
      <CreasePanel match={state} inn={innings} />

      <section className="score-controls">
        <h3>Score this delivery</h3>
        <div className="score-controls__extras">
          <label>Extras
            <select value={extraType ?? ''} onChange={(event) => {
              setExtraType((event.target.value || undefined) as DeliveryEvent['extraType'])
              setSecondaryExtraType(undefined)
              setExtraRuns(0)
            }} disabled={scoringDisabled}>
              <option value="">None</option>
              <option value="wide">Wide</option>
              <option value="noball">No-ball</option>
              <option value="bye">Bye</option>
              <option value="legbye">Leg-bye</option>
            </select>
          </label>
          <label>
            {extraType === 'wide' || extraType === 'noball'
              ? 'Additional extra runs (penalty run is automatic)'
              : 'Extra runs'}
            <input type="number" min={0} max={6} value={extraRuns}
              onChange={(event) => setExtraRuns(Math.max(0, Number(event.target.value) || 0))}
              disabled={!extraType || scoringDisabled} />
          </label>
          {extraType === 'noball' && (
            <label>Additional runs were
              <select value={secondaryExtraType ?? ''} onChange={(event) =>
                setSecondaryExtraType((event.target.value || undefined) as DeliveryEvent['secondaryExtraType'])}
                disabled={scoringDisabled}>
                <option value="">Not byes</option>
                <option value="bye">Byes</option>
                <option value="legbye">Leg-byes</option>
              </select>
            </label>
          )}
        </div>
        <div className="score-controls__runs">
          {[0, 1, 2, 3, 4, 6].map((runs) => (
            <button key={runs} className="score-btn score-btn--run"
              onClick={() => void recordDelivery({
                runsOffBat: runs,
                ...(extraType ? { extraType } : {}),
                ...(secondaryExtraType ? { secondaryExtraType } : {}),
                ...(extraRuns > 0 ? { extraRuns } : {}),
              })}
              disabled={scoringDisabled || Boolean(extraType && extraType !== 'noball')
                || Boolean(secondaryExtraType)}>
              {runs}
            </button>
          ))}
          <button className="score-btn score-btn--wicket" onClick={() => {
            setWicketType(allowedWicketTypes(extraType)[0].value)
            setWicketPlayer(innings.strikerId)
            setBattersCrossed(false)
            setWicketRuns(0)
            setWicketModal(true)
          }} disabled={scoringDisabled}>
            Wicket
          </button>
        </div>
        <div className="score-controls__quick">
          <button className="score-btn" onClick={() => void recordDelivery({
            runsOffBat: 0, extraType: 'wide', ...(extraRuns ? { extraRuns } : {}),
          })} disabled={scoringDisabled}>Wide</button>
          <button className="score-btn" onClick={() => void recordDelivery({
            runsOffBat: 0, extraType: 'noball', ...(extraRuns ? { extraRuns } : {}),
            ...(secondaryExtraType ? { secondaryExtraType } : {}),
          })} disabled={scoringDisabled}>No-ball</button>
          <button className="score-btn" onClick={() => void recordDelivery({
            runsOffBat: 0, extraType: 'bye', extraRuns: extraRuns || 1,
          })} disabled={scoringDisabled}>Bye</button>
          <button className="score-btn" onClick={() => void recordDelivery({
            runsOffBat: 0, extraType: 'legbye', extraRuns: extraRuns || 1,
          })} disabled={scoringDisabled}>Leg-bye</button>
        </div>
        {(session?.deliveries.length ?? 0) > 0 && (
          <button className="score-btn score-btn--undo" onClick={() => void undo()} disabled={saving}>
            ↶ Undo last ball
          </button>
        )}
        {saving && <p role="status">Saving scoring update…</p>}
      </section>

      {showBowlerPicker && (
        <section className="score-bowlerpick">
          <h3>{innings.bowlerId ? 'Over complete — choose the next bowler' : 'Choose the opening bowler'}</h3>
          {nextBowlerOptions.length ? (
            <div className="score-bowlerpick__row">
              <select value={newBowler} onChange={(event) => setNewBowler(event.target.value)}>
                <option value="">Select bowler…</option>
                {nextBowlerOptions.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
              <button className="score-btn score-btn--primary" onClick={() => void chooseBowler()}
                disabled={!newBowler || saving}>Confirm bowler</button>
            </div>
          ) : (
            <p>No eligible bowler remains under the overs-per-bowler limit.</p>
          )}
        </section>
      )}

      <OverHistory innings={innings} />

      {state.result ? (
        <section className="score-result">
          <h3>Match result</h3>
          <p>{state.result}</p>
        </section>
      ) : innings.completed ? (
        <section className="score-result">
          <h3>Innings break</h3>
          <p>The second innings has started. Select its opening bowler to continue.</p>
        </section>
      ) : null}

      {wicketModal && (
        <div className="score-modal__backdrop" onClick={() => setWicketModal(false)}>
          <div className="score-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Record dismissal</h3>
            <label>Dismissal type
              <select value={wicketType} onChange={(event) => {
                const selected = event.target.value as WicketType
                setWicketType(selected)
                if (selected !== 'runout') setWicketRuns(0)
                if (selected !== 'runout' && selected !== 'other') setWicketPlayer(innings.strikerId)
              }}>
                {visibleWicketTypes.map((wicket) => (
                  <option key={wicket.value} value={wicket.value}>{wicket.label}</option>
                ))}
              </select>
            </label>
            <label>Dismissed batter
              <select value={wicketPlayer} onChange={(event) => setWicketPlayer(event.target.value)}>
                {dismissedPlayers.map((playerId) => (
                  <option key={playerId} value={playerId}>{playerName(state, playerId)}</option>
                ))}
              </select>
            </label>
            {wicketType === 'runout' && (
              <label>
                <span>Batters crossed before the wicket was broken</span>
                <input type="checkbox" checked={battersCrossed}
                  onChange={(event) => setBattersCrossed(event.target.checked)} />
              </label>
            )}
            <label>Runs completed off the bat
              <input type="number" min={0} max={6} value={wicketRuns}
                onChange={(event) => setWicketRuns(Math.max(0, Number(event.target.value) || 0))}
                disabled={wicketType !== 'runout'} />
            </label>
            {!canDismissSelectedPlayer && (
              <p className="score-message score-message--error">
                This dismissal type can only dismiss the striker.
              </p>
            )}
            <div className="score-modal__actions">
              <button className="score-btn score-btn--danger" onClick={() => void createWicket()}
                disabled={!canDismissSelectedPlayer || saving}>Confirm wicket</button>
              <button className="score-btn" onClick={() => setWicketModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
