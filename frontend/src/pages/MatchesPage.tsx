/* ============================================================
   PAVILION HUB — Matches page
   ------------------------------------------------------------
   Features:
     • List all matches (from real backend)
     • Filter by status: live / upcoming / completed / abandoned
     • Completed match detail with scorecard, result,
       Player of the Match
   ============================================================ */

import { useEffect, useState } from 'react'
import {
  SectionCard,
  LoadingRows,
  EmptyState,
} from '../components/SectionCard'
import { matchesApi } from '../services/api'
import type { Match, Scorecard } from '../types'
import './MatchesPage.css'

/* ── Helpers ──────────────────────────────────────────────── */

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function fmtTime(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

/* ── Status pill ──────────────────────────────────────────── */

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`mp-status mp-status--${status}`}>
      {status === 'live' && <span className="mp-live-dot" aria-hidden="true" />}
      {status.toUpperCase()}
    </span>
  )
}

/* ── Match card ───────────────────────────────────────────── */

function MatchRow({
  match,
  onClick,
}: {
  match: Match
  onClick: () => void
}) {
  const [t0, t1] = match.teams
  const s0 = match.scores?.[0]
  const s1 = match.scores?.[1]

  return (
    <button className="mp-match" onClick={onClick}>
      <div className="mp-match__status">
        <StatusPill status={match.status} />
      </div>

      <div className="mp-match__teams">
        <div className="mp-match__team">
          <span className="mp-match__badge" style={{ background: t0.color }}>
            {t0.shortName}
          </span>
          <span className="mp-match__tname">{t0.name}</span>
          {s0 && (
            <span className="mp-match__score">
              {s0.runs}/{s0.wickets}
              <span className="mp-match__overs"> ({s0.overs})</span>
            </span>
          )}
        </div>
        <span className="mp-match__vs">vs</span>
        <div className="mp-match__team">
          <span className="mp-match__badge" style={{ background: t1.color }}>
            {t1.shortName}
          </span>
          <span className="mp-match__tname">{t1.name}</span>
          {s1 && (
            <span className="mp-match__score">
              {s1.runs}/{s1.wickets}
              <span className="mp-match__overs"> ({s1.overs})</span>
            </span>
          )}
        </div>
      </div>

      <div className="mp-match__info">
        <span>{match.tournament}</span>
        <span className="mp-match__sep">·</span>
        <span>{match.format}</span>
        <span className="mp-match__sep">·</span>
        <span>{match.venue}</span>
        <span className="mp-match__sep">·</span>
        <span>{fmtDate(match.date)} {fmtTime(match.date)}</span>
      </div>

      {match.result && (
        <div className="mp-match__result">{match.result}</div>
      )}

      <span className="mp-match__arrow">→</span>
    </button>
  )
}

/* ── Match detail / scorecard ─────────────────────────────── */

function MatchDetail({ match, onBack }: { match: Match; onBack: () => void }) {
  const [scorecard, setScorecard] = useState<Scorecard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    matchesApi
      .scorecard(match.id)
      .then((sc) => {
        if (!cancelled) {
          setScorecard(sc)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) { setError(String(e)); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [match.id])

  const [t0, t1] = match.teams

  return (
    <div className="mp-detail">
      <button className="mp-back" onClick={onBack}>← Back to matches</button>

      {/* Match summary header */}
      <div className="mp-detail__header">
        <div className="mp-detail__teams">
          <div className="mp-detail__team">
            <span className="mp-detail__badge" style={{ background: t0.color }}>
              {t0.shortName}
            </span>
            <span>{t0.name}</span>
          </div>
          <span className="mp-detail__vs">vs</span>
          <div className="mp-detail__team">
            <span className="mp-detail__badge" style={{ background: t1.color }}>
              {t1.shortName}
            </span>
            <span>{t1.name}</span>
          </div>
        </div>

        <div className="mp-detail__meta">
          <StatusPill status={match.status} />
          <span>{match.tournament}</span>
          <span>·</span>
          <span>{match.format}</span>
          <span>·</span>
          <span>{match.venue}</span>
          <span>·</span>
          <span>{fmtDate(match.date)}</span>
        </div>

        {match.result && (
          <div className="mp-detail__result">🏆 {match.result}</div>
        )}
      </div>

      {loading && <LoadingRows rows={6} />}
      {error && (
        <div className="mp-error">
          ⚠ {error.includes('404') ? 'No scorecard yet — match may not have started.' : error}
        </div>
      )}

      {scorecard && scorecard.innings.map((inn) => (
        <SectionCard
          key={inn.innings}
          title={`Innings ${inn.innings}: ${inn.battingTeam.name}`}
          subtitle={`${inn.runs}/${inn.wickets} (${Math.floor(inn.legalBalls / 6)}.${inn.legalBalls % 6} overs)`}
        >
          {/* Batting table */}
          <h4 className="mp-sc-section">Batting</h4>
          <table className="mp-table">
            <thead>
              <tr>
                <th>Batter</th>
                <th>How out</th>
                <th>R</th>
                <th>B</th>
                <th>4s</th>
                <th>6s</th>
                <th>SR</th>
              </tr>
            </thead>
            <tbody>
              {inn.battingFigures.map((bf) => (
                <tr key={bf.playerId}>
                  <td><strong>{bf.name}</strong></td>
                  <td className="mp-table__dim">{bf.dismissal ?? 'not out'}</td>
                  <td><strong>{bf.runs}</strong></td>
                  <td>{bf.ballsFaced}</td>
                  <td>{bf.fours}</td>
                  <td>{bf.sixes}</td>
                  <td>{bf.ballsFaced > 0 ? ((bf.runs / bf.ballsFaced) * 100).toFixed(0) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bowling table */}
          <h4 className="mp-sc-section" style={{ marginTop: 20 }}>
            Bowling — {inn.bowlingTeam.name}
          </h4>
          <table className="mp-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th>O</th>
                <th>R</th>
                <th>W</th>
                <th>Wd</th>
                <th>NB</th>
                <th>Eco</th>
              </tr>
            </thead>
            <tbody>
              {inn.bowlingFigures.map((bf) => (
                <tr key={bf.playerId}>
                  <td><strong>{bf.name}</strong></td>
                  <td>{Math.floor(bf.legalBalls / 6)}.{bf.legalBalls % 6}</td>
                  <td>{bf.runsConceded}</td>
                  <td><strong>{bf.wickets}</strong></td>
                  <td>{bf.wides}</td>
                  <td>{bf.noBalls}</td>
                  <td>{bf.legalBalls > 0 ? ((bf.runsConceded / bf.legalBalls) * 6).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      ))}
    </div>
  )
}

/* ── Filter tabs ──────────────────────────────────────────── */

type Filter = 'all' | 'live' | 'upcoming' | 'completed' | 'abandoned'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',       label: 'All'       },
  { id: 'live',      label: '🔴 Live'   },
  { id: 'upcoming',  label: 'Upcoming'  },
  { id: 'completed', label: 'Completed' },
  { id: 'abandoned', label: 'Abandoned' },
]

/* ── Main page ────────────────────────────────────────────── */

export function MatchesPage({ initialFilter = 'all' }: { initialFilter?: Filter }) {
  const [matches, setMatches]   = useState<Match[] | null>(null)
  const [selected, setSelected] = useState<Match | null>(null)
  const [filter, setFilter]     = useState<Filter>(initialFilter)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    matchesApi.list()
      .then((ms) => { if (!cancelled) setMatches(ms) })
      .catch((e) => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [])

  if (selected) {
    return <MatchDetail match={selected} onBack={() => setSelected(null)} />
  }

  const visible =
    filter === 'all'
      ? matches ?? []
      : (matches ?? []).filter((m) => m.status === filter)

  return (
    <div className="mp-page">
      <div className="mp-page__header">
        <h2 className="mp-page__title">Matches</h2>
        <p className="mp-page__subtitle">
          All matches — click for the available scorecard and recorded result.
        </p>
      </div>

      {/* Filter tabs */}
      <nav className="mp-filters" role="tablist" aria-label="Match filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={`mp-filter-tab ${filter === f.id ? 'mp-filter-tab--active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {matches && (
              <span className="mp-filter-count">
                {f.id === 'all'
                  ? matches.length
                  : matches.filter((m) => m.status === f.id).length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {error && <div className="mp-error">⚠ {error}</div>}

      {matches === null ? (
        <SectionCard title="Loading…">
          <LoadingRows rows={5} />
        </SectionCard>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="🏏"
          title={`No ${filter === 'all' ? '' : filter} matches`}
          hint="Matches will appear here once they are created in the backend."
        />
      ) : (
        <div className="mp-list">
          {visible.map((m) => (
            <MatchRow key={m.id} match={m} onClick={() => setSelected(m)} />
          ))}
        </div>
      )}
    </div>
  )
}
