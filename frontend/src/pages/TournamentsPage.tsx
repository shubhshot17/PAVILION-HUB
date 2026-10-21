/* ============================================================
   PAVILION HUB — Tournaments page
   ------------------------------------------------------------
   Features:
     • List all tournaments (real backend data)
     • Create a new tournament (format, type, points rules)
     • Per-tournament view: standings table, fixture list,
       knockout bracket
   ============================================================ */

import { useEffect, useState } from 'react'
import {
  SectionCard,
  LoadingRows,
  EmptyState,
} from '../components/SectionCard'
import { StandingsTable } from '../components/StandingsTable'
import { tournamentsApi } from '../services/api'
import type {
  Tournament,
  StandingRow,
  Fixture,
  Registration,
  BracketRound,
} from '../types'
import './TournamentsPage.css'

/* ── helpers ──────────────────────────────────────────────── */

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/* ── Badge ────────────────────────────────────────────────── */

function Badge({ label, variant }: { label: string; variant?: 'demo' | 'active' | 'inactive' }) {
  return (
    <span className={`t-badge t-badge--${variant ?? 'default'}`}>{label}</span>
  )
}

/* ── Knockout bracket ─────────────────────────────────────── */

function BracketView({ rounds }: { rounds: BracketRound[] }) {
  if (rounds.length === 0) {
    return (
      <EmptyState
        icon="🏆"
        title="No knockout fixtures yet"
        hint="Create fixtures with a non-League stage to build the bracket."
      />
    )
  }
  return (
    <div className="bracket">
      {rounds.map((round) => (
        <div key={round.stage} className="bracket__round">
          <h4 className="bracket__stage">{round.stage}</h4>
          <div className="bracket__matches">
            {round.matches.map((m) => (
              <div key={m.id} className="bracket__match">
                <div className="bracket__team">{m.homeTeam.shortName}</div>
                <div className="bracket__separator">vs</div>
                <div className="bracket__team">{m.awayTeam.shortName}</div>
                <div className="bracket__meta">
                  {m.matchStatus === 'completed' && m.matchResult
                    ? <span className="bracket__result">{m.matchResult}</span>
                    : <span className="bracket__date">{fmtDate(m.scheduledAt)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Fixture list ─────────────────────────────────────────── */

function FixtureList({
  fixtures,
  registrations,
}: {
  fixtures: Fixture[]
  registrations: Registration[]
}) {
  const regMap = Object.fromEntries(registrations.map((r) => [r.teamId, r]))

  if (fixtures.length === 0) {
    return (
      <EmptyState
        icon="📅"
        title="No fixtures scheduled"
        hint="Fixtures will appear here once the schedule is published."
      />
    )
  }

  return (
    <ul className="fix-list">
      {fixtures.map((f) => {
        const homeReg = regMap[f.homeTeam.id]
        const awayReg = regMap[f.awayTeam.id]
        return (
          <li key={f.id} className="fix-item">
            <div className="fix-item__teams">
              <span
                className="fix-item__badge"
                style={{ background: homeReg?.color ?? f.homeTeam.color ?? '#888' }}
              >
                {f.homeTeam.shortName}
              </span>
              <span className="fix-item__vs">vs</span>
              <span
                className="fix-item__badge"
                style={{ background: awayReg?.color ?? f.awayTeam.color ?? '#888' }}
              >
                {f.awayTeam.shortName}
              </span>
              <span className="fix-item__names">
                {f.homeTeam.name} <em>vs</em> {f.awayTeam.name}
              </span>
            </div>
            <div className="fix-item__info">
              {f.stage !== 'League' && (
                <span className="fix-item__stage">{f.stage}</span>
              )}
              <span>{fmtDate(f.scheduledAt)} · {fmtTime(f.scheduledAt)}</span>
              <span className="fix-item__venue">{f.venue}</span>
              <span className={`fix-item__status fix-item__status--${f.status}`}>
                {f.status}
              </span>
              {f.isDemo && <Badge label="DEMO" variant="demo" />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Tournament detail view ───────────────────────────────── */

function TournamentDetail({
  tournament,
  onBack,
}: {
  tournament: Tournament
  onBack: () => void
}) {
  const [tab, setTab] = useState<'standings' | 'fixtures' | 'bracket' | 'teams'>(
    'standings',
  )
  const [standings, setStandings] = useState<StandingRow[] | null>(null)
  const [fixtures, setFixtures]   = useState<Fixture[] | null>(null)
  const [bracket, setBracket]     = useState<BracketRound[] | null>(null)
  const [registrations, setRegs]  = useState<Registration[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStandings(null)
    setFixtures(null)
    setBracket(null)
    setRegs(null)
    setError(null)

    Promise.all([
      tournamentsApi.standings(tournament.id),
      tournamentsApi.fixtures(tournament.id),
      tournamentsApi.bracket(tournament.id),
      tournamentsApi.registrations(tournament.id),
    ])
      .then(([s, f, b, r]) => {
        if (cancelled) return
        setStandings(s)
        setFixtures(f)
        setBracket(b)
        setRegs(r)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })

    return () => { cancelled = true }
  }, [tournament.id])

  const TABS = [
    { id: 'standings', label: '📊 Standings' },
    { id: 'fixtures',  label: '📅 Fixtures'  },
    { id: 'bracket',   label: '🏆 Bracket'   },
    { id: 'teams',     label: '👥 Teams'     },
  ] as const

  return (
    <div className="t-detail">
      {/* Header */}
      <div className="t-detail__header">
        <button className="t-back" onClick={onBack} aria-label="Back to list">
          ← Back
        </button>
        <div className="t-detail__title-block">
          <h2 className="t-detail__name">{tournament.name}</h2>
          <div className="t-detail__meta">
            <span>{tournament.season}</span>
            <span>·</span>
            <span>{tournament.format}</span>
            <span>·</span>
            <span>{(tournament.tournamentType ?? 'round_robin').replace(/_/g, ' ')}</span>
            {tournament.oversPerInnings && (
              <>
                <span>·</span>
                <span>{tournament.oversPerInnings} overs</span>
              </>
            )}
            {tournament.isDemo && <Badge label="DEMO DATA" variant="demo" />}
            {tournament.isActive
              ? <Badge label="Active" variant="active" />
              : <Badge label="Ended" variant="inactive" />}
          </div>
          {/* Points rules */}
          <div className="t-detail__points-rules">
            Win: <strong>{tournament.winPoints ?? 2} pts</strong>
            &ensp;Tie: <strong>{tournament.tiePoints ?? 1} pt</strong>
            &ensp;No result: <strong>{tournament.noResultPoints ?? 1} pt</strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="t-tabs" role="tablist" aria-label="Tournament sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`t-tab ${tab === t.id ? 't-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
            role="tab"
            aria-selected={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="t-error">⚠ {error}</div>
      )}

      {/* Tab panels */}
      {tab === 'standings' && (
        <SectionCard
          title="Points Table"
          subtitle="Computed from persisted match results — abandoned matches excluded from NRR"
        >
          {standings === null ? (
            <LoadingRows rows={5} />
          ) : standings.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No standings yet"
              hint="Points will appear once the first completed match is recorded."
            />
          ) : (
            <StandingsTable rows={standings} />
          )}
        </SectionCard>
      )}

      {tab === 'fixtures' && (
        <SectionCard title="Fixtures" subtitle="All scheduled matches in this tournament">
          {fixtures === null || registrations === null ? (
            <LoadingRows rows={4} />
          ) : (
            <FixtureList fixtures={fixtures} registrations={registrations ?? []} />
          )}
        </SectionCard>
      )}

      {tab === 'bracket' && (
        <SectionCard title="Knockout Bracket" subtitle="Knockout-stage fixtures by round">
          {bracket === null ? (
            <LoadingRows rows={3} />
          ) : (
            <BracketView rounds={bracket} />
          )}
        </SectionCard>
      )}

      {tab === 'teams' && (
        <SectionCard
          title="Registered Teams"
          subtitle="Teams signed up for this tournament"
        >
          {registrations === null ? (
            <LoadingRows rows={4} />
          ) : registrations.length === 0 ? (
            <EmptyState icon="👥" title="No teams registered yet" />
          ) : (
            <ul className="reg-list">
              {registrations.map((r) => (
                <li key={r.id} className="reg-item">
                  <span
                    className="reg-item__badge"
                    style={{ background: r.color }}
                  >
                    {r.shortName}
                  </span>
                  <span className="reg-item__name">{r.teamName}</span>
                  <span className={`reg-item__status reg-item__status--${r.status}`}>
                    {r.status}
                  </span>
                  {r.isDemo && <Badge label="DEMO" variant="demo" />}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  )
}

/* ── Create Tournament form ───────────────────────────────── */

function CreateTournamentForm({
  onCreated,
  onCancel,
}: {
  onCreated: (t: Tournament) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    season: String(new Date().getFullYear()),
    format: 'T20' as Tournament['format'],
    tournamentType: 'round_robin' as Tournament['tournamentType'],
    oversPerInnings: 20,
    winPoints: 2,
    tiePoints: 1,
    noResultPoints: 1,
    isActive: true,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const created = await tournamentsApi.create(form)
      onCreated(created)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="t-form" onSubmit={handleSubmit}>
      <h3 className="t-form__title">New Tournament</h3>

      <label className="t-form__label">
        Name
        <input
          className="t-form__input"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Monsoon Premier Cup"
          required
        />
      </label>

      <div className="t-form__row">
        <label className="t-form__label">
          Season
          <input
            className="t-form__input"
            value={form.season}
            onChange={(e) => set('season', e.target.value)}
            placeholder="2026"
            required
          />
        </label>

        <label className="t-form__label">
          Format
          <select
            className="t-form__select"
            value={form.format}
            onChange={(e) => set('format', e.target.value as Tournament['format'])}
          >
            {['T20', 'T10', 'ODI', 'Test'].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="t-form__row">
        <label className="t-form__label">
          Type
          <select
            className="t-form__select"
            value={form.tournamentType}
            onChange={(e) =>
              set('tournamentType', e.target.value as Tournament['tournamentType'])
            }
          >
            <option value="round_robin">Round Robin</option>
            <option value="knockout">Knockout</option>
            <option value="round_robin_knockout">Round Robin + Knockout</option>
          </select>
        </label>

        <label className="t-form__label">
          Overs / innings
          <input
            className="t-form__input"
            type="number"
            min={1}
            value={form.oversPerInnings}
            onChange={(e) => set('oversPerInnings', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="t-form__row">
        <label className="t-form__label">
          Win pts
          <input
            className="t-form__input"
            type="number"
            min={0}
            value={form.winPoints}
            onChange={(e) => set('winPoints', Number(e.target.value))}
          />
        </label>
        <label className="t-form__label">
          Tie pts
          <input
            className="t-form__input"
            type="number"
            min={0}
            value={form.tiePoints}
            onChange={(e) => set('tiePoints', Number(e.target.value))}
          />
        </label>
        <label className="t-form__label">
          No-result pts
          <input
            className="t-form__input"
            type="number"
            min={0}
            value={form.noResultPoints}
            onChange={(e) => set('noResultPoints', Number(e.target.value))}
          />
        </label>
      </div>

      {err && <p className="t-form__error">⚠ {err}</p>}

      <div className="t-form__actions">
        <button type="button" className="t-btn t-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="t-btn t-btn--primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create Tournament'}
        </button>
      </div>
    </form>
  )
}

/* ── Main page ────────────────────────────────────────────── */

export function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null)
  const [selected, setSelected]       = useState<Tournament | null>(null)
  const [creating, setCreating]       = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    tournamentsApi.list()
      .then((ts) => { if (!cancelled) setTournaments(ts) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [])

  if (selected) {
    return (
      <TournamentDetail
        tournament={selected}
        onBack={() => setSelected(null)}
      />
    )
  }

  const visibleTournaments = (tournaments ?? []).filter((tournament) => !tournament.isDemo)

  return (
    <div className="t-page">
      <div className="t-page__header">
        <div>
          <h2 className="t-page__title">Tournaments</h2>
          <p className="t-page__subtitle">
            Manage competitions, standings, fixtures and knockout brackets.
          </p>
        </div>
        <button
          className="t-btn t-btn--primary"
          onClick={() => setCreating(true)}
        >
          + New Tournament
        </button>
      </div>

      {creating && (
        <SectionCard title="">
          <CreateTournamentForm
            onCreated={(t) => {
              setTournaments((prev) => (prev ? [t, ...prev] : [t]))
              setCreating(false)
              setSelected(t)
            }}
            onCancel={() => setCreating(false)}
          />
        </SectionCard>
      )}

      {error && <div className="t-error">⚠ {error}</div>}

      {tournaments === null ? (
        <SectionCard title="Loading…">
          <LoadingRows rows={4} />
        </SectionCard>
      ) : visibleTournaments.length === 0 ? (
        <SectionCard title="No tournaments">
          <EmptyState
            icon="🏆"
            title="No tournaments found"
            hint="Click '+ New Tournament' to create your first competition."
          />
        </SectionCard>
      ) : (
        <div className="t-list">
          {visibleTournaments.map((t) => (
            <button
              key={t.id}
              className="t-card"
              onClick={() => setSelected(t)}
            >
              <div className="t-card__top">
                <span className="t-card__name">{t.name}</span>
                <div className="t-card__badges">
                  {t.isDemo && <Badge label="DEMO" variant="demo" />}
                  {t.isActive
                    ? <Badge label="Active" variant="active" />
                    : <Badge label="Ended" variant="inactive" />}
                </div>
              </div>
              <div className="t-card__meta">
                <span>{t.season}</span>
                <span>·</span>
                <span>{t.format}</span>
                <span>·</span>
                <span>{(t.tournamentType ?? 'round_robin').replace(/_/g, ' ')}</span>
                {t.oversPerInnings && (
                  <>
                    <span>·</span>
                    <span>{t.oversPerInnings} overs</span>
                  </>
                )}
              </div>
              <div className="t-card__arrow">→</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
