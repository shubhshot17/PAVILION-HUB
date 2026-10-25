import type { InningsScore, MatchSummary, Team } from './types'

export const overs = (legalBalls: number) => `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`

export const scoreText = (score?: InningsScore) => (score ? `${score.runs}/${score.wickets}` : '')

export function teamScore(match: MatchSummary, team: Team) {
  return match.scores.find((score) => score.teamId === team.id)
}

export function formatDate(iso: string, withTime = true) {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

export function relativeDay(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const days = Math.round((new Date(date.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return formatDate(iso, false)
}

/** Value for <input type="datetime-local"> from an ISO string. */
export function toLocalInput(iso: string) {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()

/** One-line status for a match card, e.g. "Need 24 off 18" or the result. */
export function matchStatusLine(match: MatchSummary) {
  if (match.result) return match.result.text
  if (match.status === 'upcoming') {
    return match.toss ? 'Toss done' : `${relativeDay(match.date)} · ${new Date(match.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  }
  if (match.status === 'live') {
    const [first, second] = match.scores
    if (second && first) {
      const need = first.runs + 1 - second.runs
      const balls = match.overs * 6 - second.legalBalls
      const batting = second.teamId === match.teamA.id ? match.teamA : match.teamB
      return `${batting.shortName} need ${need} off ${balls} ball${balls === 1 ? '' : 's'}`
    }
    if (match.toss) {
      const winner = match.toss.winnerId === match.teamA.id ? match.teamA : match.teamB
      return `${winner.shortName} won the toss and chose to ${match.toss.decision}`
    }
  }
  return ''
}

export const ROLE_LABEL: Record<string, string> = {
  batter: 'Batter',
  bowler: 'Bowler',
  'all-rounder': 'All-rounder',
  'wicket-keeper': 'Wicket-keeper',
}
