/* ============================================================
   PAVILION HUB — Scoring page (DEMO / OFFLINE)
   ------------------------------------------------------------
   ⚠️ Local demo only. Scores live in memory — nothing is saved
   remotely and nothing here is a live feed.
   ============================================================ */
import { useState } from 'react'
import {
  applyDelivery,
  buildInitialState,
  calculateTarget,
  oversDisplay,
  runRate,
  setBowler,
  undoLastDelivery,
  type DeliveryEvent,
  type InningsState,
  type MatchSetup,
  type MatchState,
  type WicketType,
} from '../scoring/engine'
import './ScoreScreen.css'

/* ---------- demo data (fictional) ---------- */

const DEMO_SETUP_TEAMS = [
  {
    id: 'A',
    name: 'Westport Rangers',
    shortName: 'WPR',
    players: [
      'Arlo Finch', 'Ben Cartwright', 'Casey Molina', 'Dev Ramachandran',
      'Elton Sewell', 'Femi Aduba',
    ].map((name, i) => ({ id: `A${i + 1}`, name })),
  },
  {
    id: 'B',
    name: 'Eastvale Falcons',
    shortName: 'EVF',
    players: [
      'Griff Owens', 'Hana Lindqvist', 'Ilya Sorokin', 'Jonah Peele',
      'Kofi Mensah', 'Liam Traynor',
    ].map((name, i) => ({ id: `B${i + 1}`, name })),
  },
] as const

const WICKET_TYPES: { value: WicketType; label: string }[] = [
  { value: 'bowled', label: 'Bowled' },
  { value: 'caught', label: 'Caught' },
  { value: 'lbw', label: 'LBW' },
  { value: 'runout', label: 'Run out' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hitwicket', label: 'Hit wicket' },
  { value: 'other', label: 'Other' },
]

const playerById = (match: MatchState, id: string) => {
  for (const t of [match.teamA, match.teamB]) {
    const p = t.players.find((x) => x.id === id)
    if (p) return p
  }
  return { id, name: id }
}

/* ---------- setup phase ---------- */

function SetupForm({ onStart }: { onStart: (setup: MatchSetup) => void }) {
  const [teamAId, setTeamAId] = useState<string>(DEMO_SETUP_TEAMS[0].id)
  const [teamBId, setTeamBId] = useState<string>(DEMO_SETUP_TEAMS[1].id)
  const [totalOvers, setTotalOvers] = useState(5)
  const [tossWinnerId, setTossWinnerId] = useState('A')
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat')
  const [openers, setOpeners] = useState<[string, string]>(['A1', 'A2'])
  const [firstBowler, setFirstBowler] = useState('B1')

  const teamOf = (id: string) => DEMO_SETUP_TEAMS.find((t) => t.id === id)!

  const handleTeamChange = (side: 'a' | 'b', id: string) => {
    const other = side === 'a' ? teamBId : teamAId
    const nextId = id === other ? other : id
    if (side === 'a') setTeamAId(nextId)
    else setTeamBId(nextId)
    // reset player picks when teams change
    const t = teamOf(nextId)
    if (side === 'a') {
      setOpeners([t.players[0].id, t.players[1].id])
      setFirstBowler(teamOf(teamBId).players[0].id)
    } else {
      setFirstBowler(t.players[0].id)
    }
  }

  const start = () => {
    const teamA = { ...teamOf(teamAId), players: [...teamOf(teamAId).players] }
    const teamB = { ...teamOf(teamBId), players: [...teamOf(teamBId).players] }
    const battingOrder = teamOf(
      tossDecision === 'bat' ? tossWinnerId : tossWinnerId === teamAId ? teamBId : teamAId,
    ).players.map((p) => p.id)
    onStart({
      teamA, teamB, totalOvers, tossWinnerId, tossDecision,
      openers, firstBowler, battingOrder,
    })
  }

  const openersOf = teamOf(tossDecision === 'bat' ? tossWinnerId : tossWinnerId === teamAId ? teamBId : teamAId)
  const bowlersOf = teamOf(tossDecision === 'bat' ? (tossWinnerId === teamAId ? teamBId : teamAId) : tossWinnerId)

  return (
    <div className="score-setup">
      <h2>Match Setup <span className="demo-tag">demo · offline</span></h2>
      <p className="score-setup__note">
        Everything below is fictional local data. Scores are not saved anywhere.
      </p>

      <div className="score-setup__grid">
        <label>
          Team A
          <select value={teamAId} onChange={(e) => handleTeamChange('a', e.target.value)}>
            {DEMO_SETUP_TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label>
          Team B
          <select value={teamBId} onChange={(e) => handleTeamChange('b', e.target.value)}>
            {DEMO_SETUP_TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label>
          Overs per innings
          <input type="number" min={1} max={50} value={totalOvers}
            onChange={(e) => setTotalOvers(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label>
          Toss won by
          <select value={tossWinnerId} onChange={(e) => setTossWinnerId(e.target.value)}>
            <option value={teamAId}>{teamOf(teamAId).name}</option>
            <option value={teamBId}>{teamOf(teamBId).name}</option>
          </select>
        </label>
        <label>
          Elected to
          <select value={tossDecision} onChange={(e) => setTossDecision(e.target.value as 'bat' | 'bowl')}>
            <option value="bat">Bat first</option>
            <option value="bowl">Bowl first</option>
          </select>
        </label>
        <label>
          Opening striker
          <select value={openers[0]}
            onChange={(e) => setOpeners([e.target.value, openers[1]])}>
            {openersOf.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>
          Opening non-striker
          <select value={openers[1]}
            onChange={(e) => setOpeners([openers[0], e.target.value])}>
            {openersOf.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>
          First bowler
          <select value={firstBowler} onChange={(e) => setFirstBowler(e.target.value)}>
            {bowlersOf.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      <button className="score-btn score-btn--primary" onClick={start}>
        Start match →
      </button>
    </div>
  )
}

/* ---------- innings view pieces ---------- */

function Scoreboard({ match, inn }: { match: MatchState; inn: InningsState }) {
  const team = match.teamA.id === inn.battingTeamId ? match.teamA : match.teamB
  const target = calculateTarget(match)
  const rr = runRate(inn.runs, inn.legalBalls)
  return (
    <section className="score-scoreboard">
      <div className="score-scoreboard__main">
        <div>
          <span className="score-scoreboard__team">{team.name}</span>
          <span className="demo-tag">demo</span>
        </div>
        <div className="score-scoreboard__big">
          {inn.runs}/{inn.wickets}
          <span className="score-scoreboard__overs"> ({oversDisplay(inn.legalBalls)}/{match.totalOvers} ov)</span>
        </div>
      </div>
      <div className="score-scoreboard__stats">
        <span>CRR {rr.toFixed(2)}</span>
        {match.currentInningsIndex === 1 && target.target !== null && (
          <span className="score-scoreboard__target">
            Target {target.target} · need {target.runsNeeded} off {target.ballsRemaining} balls
            (RRR {target.requiredRunRate?.toFixed(2)})
          </span>
        )}
      </div>
    </section>
  )
}

function CreasePanel({ match, inn }: { match: MatchState; inn: InningsState }) {
  const striker = inn.batterFigures[inn.strikerId]
  const nonStriker = inn.batterFigures[inn.nonStrikerId]
  const bowler = inn.bowlerFigures[inn.bowlerId]
  const fmt = (id: string, f?: { runs: number; balls: number; fours: number; sixes: number }) =>
    f ? `${playerById(match, id).name} ${f.runs} (${f.balls}) 4s:${f.fours} 6s:${f.sixes}` : '—'

  return (
    <section className="score-crease">
      <div className="score-crease__row score-crease__row--strike">
        <span className="score-crease__badge">Striker</span>
        <span>{fmt(inn.strikerId, striker)}</span>
      </div>
      <div className="score-crease__row">
        <span className="score-crease__badge score-crease__badge--dim">Non-striker</span>
        <span>{fmt(inn.nonStrikerId, nonStriker)}</span>
      </div>
      <div className="score-crease__row">
        <span className="score-crease__badge score-crease__badge--bowl">Bowler</span>
        <span>
          {bowler
            ? `${playerById(match, inn.bowlerId).name} — ${oversDisplay(bowler.balls)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets} (wd ${bowler.wides}, nb ${bowler.noBalls})`
            : '—'}
        </span>
      </div>
    </section>
  )
}

function OverHistory({ inn }: { inn: InningsState }) {
  const label = (d: DeliveryEvent) => {
    if (d.wicket) return 'W'
    if (d.extraType === 'wide') return `wd${d.extraRuns ? `+${d.extraRuns}` : ''}`
    if (d.extraType === 'noball') return `nb${d.runsOffBat || d.extraRuns ? (d.runsOffBat + (d.extraRuns ?? 0)) : ''}`
    if (d.extraType === 'bye') return `b${d.extraRuns}`
    if (d.extraType === 'legbye') return `lb${d.extraRuns}`
    if (d.extraType === 'penalty') return `pen${d.extraRuns}`
    return String(d.runsOffBat)
  }
  const highlight = (d: DeliveryEvent) =>
    d.wicket ? 'w' : d.runsOffBat === 4 || d.runsOffBat === 6 ? 'big' : d.extraType ? 'extra' : ''
  return (
    <section className="score-over">
      <h3>This over</h3>
      <div className="score-over__balls">
        {inn.overs[inn.overs.length - 1].map((d, i) => (
          <span key={i} className={`score-over__ball score-over__ball--${highlight(d)}`}>{label(d)}</span>
        ))}
        {inn.overs[inn.overs.length - 1].length === 0 && <span className="score-over__empty">Over starting…</span>}
      </div>
      <h3>Ball-by-ball</h3>
      <div className="score-over__log">
        {inn.deliveries.slice(-18).reverse().map((d, i) => (
          <span key={`${d.overIndex}-${d.ballIndex}-${i}`} className="score-over__logitem">
            {d.overIndex + 1}.{d.ballIndex + 1} {label(d)}
          </span>
        ))}
        {inn.deliveries.length === 0 && <span className="score-over__empty">No deliveries yet</span>}
      </div>
    </section>
  )
}

/* ---------- main component ---------- */

export function ScoreScreen() {
  const [setup, setSetup] = useState<MatchSetup | null>(null)
  const [match, setMatch] = useState<MatchState | null>(null)
  const [history, setHistory] = useState<DeliveryEvent[]>([])
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [wicketModal, setWicketModal] = useState(false)
  const [wicketType, setWicketType] = useState<WicketType>('bowled')
  const [wicketPlayer, setWicketPlayer] = useState('')
  const [extraType, setExtraType] = useState<DeliveryEvent['extraType']>()
  const [extraRuns, setExtraRuns] = useState(0)
  const [runsOffBat, setRunsOffBat] = useState(0)
  const [newBowler, setNewBowler] = useState('')

  const inn = match ? match.innings[match.currentInningsIndex] : null

  const overComplete = inn ? inn.overs[inn.overs.length - 1].length === 0 && inn.legalBalls % 6 === 0 && inn.legalBalls > 0 : false

  const start = (s: MatchSetup) => {
    setSetup(s)
    setMatch(buildInitialState(s))
    setHistory([])
  }

  const commit = (next: MatchState, event: DeliveryEvent) => {
    setMatch(next)
    setHistory((h) => [...h, event])
    setConfirmUndo(false)
    setExtraType(undefined)
    setExtraRuns(0)
    setRunsOffBat(0)
    setWicketModal(false)
  }

  const bowl = (runs: number) => {
    if (!match || !setup) return
    const event: DeliveryEvent = {
      runsOffBat: runs,
      extraType,
      extraRuns: extraRuns || undefined,
    }
    commit(applyDelivery(match, event), event)
  }

  const bowlExtraOnly = (type: NonNullable<DeliveryEvent['extraType']>, runs = 0) => {
    if (!match || !setup) return
    const event: DeliveryEvent = { runsOffBat: 0, extraType: type, extraRuns: runs || undefined }
    commit(applyDelivery(match, event), event)
  }

  const bowlWicket = () => {
    if (!match || !setup) return
    const event: DeliveryEvent = {
      runsOffBat,
      extraType,
      extraRuns: extraRuns || undefined,
      wicket: { type: wicketType, dismissedPlayerId: wicketPlayer || inn?.strikerId || '' },
    }
    commit(applyDelivery(match, event), event)
  }

  const doUndo = () => {
    if (!match || !setup) return
    setMatch(undoLastDelivery(setup, history))
    setHistory((h) => h.slice(0, -1))
    setConfirmUndo(false)
  }

  const chooseBowler = () => {
    if (!match || !newBowler) return
    try {
      setMatch(setBowler(match, newBowler))
      setNewBowler('')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  if (!match || !inn || !setup) {
    return <SetupForm onStart={start} />
  }

  const battingTeam = match.teamA.id === inn.battingTeamId ? match.teamA : match.teamB
  const bowlingTeam = match.teamA.id === inn.battingTeamId ? match.teamB : match.teamA
  const bowlingShort = bowlingTeam.id === match.teamA.id ? 'Team A' : 'Team B'
  const nextBowlerOptions = bowlingTeam.players.filter((p) => p.id !== inn.bowlerId)
  const eligibleDismissed = [inn.strikerId, inn.nonStrikerId]
  const showBowlerPicker = overComplete && !inn.completed
  const showUndo = history.length > 0

  return (
    <div className="score-screen">
      <header className="score-screen__header">
        <h2>Scoring — {match.teamA.name} vs {match.teamB.name}</h2>
        <span className="demo-tag">demo · local only · not live, not saved</span>
      </header>

      <Scoreboard match={match} inn={inn} />
      <CreasePanel match={match} inn={inn} />

      <section className="score-controls">
        <h3>Score this ball</h3>
        <div className="score-controls__extras">
          <label>Extra:
            <select value={extraType ?? ''} onChange={(e) => setExtraType((e.target.value || undefined) as DeliveryEvent['extraType'])}>
              <option value="">None</option>
              <option value="wide">Wide</option>
              <option value="noball">No-ball</option>
              <option value="bye">Bye</option>
              <option value="legbye">Leg-bye</option>
              <option value="penalty">Penalty</option>
            </select>
          </label>
          <label>Extra runs:
            <input type="number" min={0} max={6} value={extraRuns}
              onChange={(e) => setExtraRuns(Math.max(0, Number(e.target.value) || 0))}
              disabled={!extraType} />
          </label>
        </div>
        <div className="score-controls__runs">
          {[0, 1, 2, 3, 4, 6].map((r) => (
            <button key={r} className="score-btn score-btn--run" onClick={() => bowl(r)}>
              {r}
            </button>
          ))}
          <button className="score-btn score-btn--wicket" onClick={() => { setWicketPlayer(inn.strikerId); setWicketModal(true) }}>
            Wicket
          </button>
        </div>
        <div className="score-controls__quick">
          <button onClick={() => bowlExtraOnly('wide', extraRuns)} disabled={showBowlerPicker}>Wide only</button>
          <button onClick={() => bowlExtraOnly('noball', extraRuns)} disabled={showBowlerPicker}>No-ball only</button>
          <button onClick={() => bowlExtraOnly('bye', extraRuns || 1)} disabled={showBowlerPicker}>Bye</button>
          <button onClick={() => bowlExtraOnly('legbye', extraRuns || 1)} disabled={showBowlerPicker}>Leg-bye</button>
          <button onClick={() => bowlExtraOnly('penalty', extraRuns || 5)} disabled={showBowlerPicker}>Penalty</button>
        </div>
        {showUndo && (
          confirmUndo ? (
            <div className="score-controls__confirm">
              Undo the last delivery?
              <button className="score-btn score-btn--danger" onClick={doUndo}>Yes, undo</button>
              <button onClick={() => setConfirmUndo(false)}>Cancel</button>
            </div>
          ) : (
            <button className="score-btn score-btn--undo" onClick={() => setConfirmUndo(true)}>↶ Undo last delivery</button>
          )
        )}
      </section>

      {showBowlerPicker && (
        <section className="score-bowlerpick">
          <h3>Over complete — choose the next bowler ({bowlingShort})</h3>
          <div className="score-bowlerpick__row">
            <select value={newBowler} onChange={(e) => setNewBowler(e.target.value)}>
              <option value="">Select bowler…</option>
              {nextBowlerOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="score-btn score-btn--primary" onClick={chooseBowler} disabled={!newBowler}>
              Confirm bowler
            </button>
          </div>
        </section>
      )}

      <OverHistory inn={inn} />

      {match.result ? (
        <section className="score-result">
          <h3>Result (demo)</h3>
          <p>{match.result}</p>
        </section>
      ) : inn.completed ? (
        <section className="score-result">
          <h3>Innings break (demo)</h3>
          <p>Second innings ready — {battingTeam.name} bowled first.</p>
        </section>
      ) : null}

      {wicketModal && (
        <div className="score-modal__backdrop" onClick={() => setWicketModal(false)}>
          <div className="score-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Wicket — how was the batter out?</h3>
            <label>Type
              <select value={wicketType} onChange={(e) => setWicketType(e.target.value as WicketType)}>
                {WICKET_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </label>
            <label>Dismissed player
              <select value={wicketPlayer} onChange={(e) => setWicketPlayer(e.target.value)}>
                {eligibleDismissed.map((id) => (
                  <option key={id} value={id}>{playerById(match, id).name}</option>
                ))}
              </select>
            </label>
            <label>Runs off the bat (optional)
              <input type="number" min={0} max={6} value={runsOffBat}
                onChange={(e) => setRunsOffBat(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <div className="score-modal__actions">
              <button className="score-btn score-btn--danger" onClick={bowlWicket}>Confirm wicket</button>
              <button onClick={() => setWicketModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
