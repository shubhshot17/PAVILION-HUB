/* ============================================================
   PAVILION HUB — API service layer
   ------------------------------------------------------------
   Real API calls to the Express backend. API failures are surfaced to
   the calling page; the normal interface does not substitute demo records.

   VITE_API_URL env var controls the base URL (see .env.example).
   ============================================================ */

import type {
  Tournament,
  StandingRow,
  Fixture,
  Registration,
  BracketRound,
  Match,
  Team,
  Player,
  PlayerStats,
  TeamProfile,
  Scorecard,
  DashboardData,
  MatchSetup,
} from '../types'
import type {
  BowlerSelection,
  DeliveryEvent,
  MatchState,
} from '../scoring/engine'

/* ── Base URL ───────────────────────────────────────────────── */

/**
 * API base URL — never hard-code localhost; the Android WebView
 * runs on a physical device where localhost means the phone.
 *
 * Priority:
 *   1. VITE_API_URL env var (set in frontend/.env.local)
 *   2. Relative '' — correct when Vite/Capacitor proxies to the backend
 */
const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '')
export const API_BASE: string = configuredApiUrl?.replace(/\/api$/i, '') ?? ''

/* ── HTTP helpers ───────────────────────────────────────────── */

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let message = body || res.statusText
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string }
      message = parsed.error?.message ?? parsed.message ?? message
    } catch {
      // Preserve the plain-text error body when the response is not JSON.
    }
    throw new Error(`API ${res.status}: ${message}`)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}

const get  = <T>(path: string) => apiFetch<T>(path)
const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
const patch = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
const del  = (path: string) =>
  apiFetch<void>(path, { method: 'DELETE' })

/* ── Dashboard ──────────────────────────────────────────────── */

/**
 * Fetch dashboard data from persistent backend records. Demo records are
 * omitted so the normal application never presents seeded examples as user data.
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  const [allMatches, allTournaments, allTeams] = await Promise.all([
    get<Match[]>('/matches'),
    get<Tournament[]>('/tournaments'),
    get<Team[]>('/teams'),
  ])
  const matches = allMatches.filter((match) => !match.isDemo)
  const tournaments = allTournaments.filter((tournament) => !tournament.isDemo)
  const teams = allTeams.filter((team) => !team.isDemo)

  const activeTournament = tournaments.find((tournament) => tournament.isActive) ?? tournaments[0]
  const standings: StandingRow[] = activeTournament
    ? await get<StandingRow[]>(`/tournaments/${activeTournament.id}/standings`)
    : []

  return {
    liveMatches: matches.filter((match) => match.status === 'live'),
    upcoming: matches.filter((match) => match.status === 'upcoming'),
    recent: matches.filter((match) => match.status === 'completed').slice(0, 10),
    standings,
    teamCount: teams.length,
  }
}


/* ── Tournaments ────────────────────────────────────────────── */

export const tournamentsApi = {
  list: ()             => get<Tournament[]>('/tournaments'),
  get:  (id: string)   => get<Tournament>(`/tournaments/${id}`),
  create: (data: Partial<Tournament>) => post<Tournament>('/tournaments', data),
  update: (id: string, data: Partial<Tournament>) => patch<Tournament>(`/tournaments/${id}`, data),
  remove: (id: string) => del(`/tournaments/${id}`),

  standings:     (id: string) => get<StandingRow[]>(`/tournaments/${id}/standings`),
  bracket:       (id: string) => get<BracketRound[]>(`/tournaments/${id}/bracket`),
  fixtures:      (id: string) => get<Fixture[]>(`/tournaments/${id}/fixtures`),
  registrations: (id: string) => get<Registration[]>(`/tournaments/${id}/registrations`),

  createFixture: (id: string, data: Partial<Fixture>) =>
    post<Fixture>(`/tournaments/${id}/fixtures`, data),
  updateFixture: (id: string, fid: string, data: Partial<Fixture>) =>
    patch<Fixture>(`/tournaments/${id}/fixtures/${fid}`, data),
  deleteFixture: (id: string, fid: string) =>
    del(`/tournaments/${id}/fixtures/${fid}`),

  register:   (id: string, teamId: string) =>
    post<Registration>(`/tournaments/${id}/registrations`, { teamId }),
  unregister: (id: string, rid: string) =>
    del(`/tournaments/${id}/registrations/${rid}`),
}

/* ── Teams ──────────────────────────────────────────────────── */

export const teamsApi = {
  list:   ()           => get<Team[]>('/teams'),
  get:    (id: string) => get<Team>(`/teams/${id}`),
  create: (data: Partial<Team>) => post<Team>('/teams', data),
  update: (id: string, data: Partial<Team>) => patch<Team>(`/teams/${id}`, data),
  remove: (id: string) => del(`/teams/${id}`),
  profile: (id: string) => get<TeamProfile>(`/teams/${id}/profile`),
}

/* ── Players ────────────────────────────────────────────────── */

type PlayerInput = Omit<Partial<Player>, 'jerseyNumber'> & {
  jerseyNumber?: number | null
}

export const playersApi = {
  list:   ()           => get<Player[]>('/players'),
  get:    (id: string) => get<Player>(`/players/${id}`),
  create: (data: PlayerInput) => post<Player>('/players', data),
  update: (id: string, data: PlayerInput) => patch<Player>(`/players/${id}`, data),
  remove: (id: string) => del(`/players/${id}`),
  stats:  (id: string) => get<PlayerStats>(`/players/${id}/stats`),
}

/* ── Matches ────────────────────────────────────────────────── */

export const matchesApi = {
  list:      ()           => get<Match[]>('/matches'),
  get:       (id: string) => get<Match>(`/matches/${id}`),
  create:    (data: MatchInput) => post<Match>('/matches', data),
  update:    (id: string, data: MatchInput) => patch<Match>(`/matches/${id}`, data),
  remove:    (id: string) => del(`/matches/${id}`),
  scorecard: (id: string) => get<Scorecard>(`/matches/${id}/scorecard`),
  setResult: (id: string, data: {
    result?: string
    winTeamId?: string
    isTie?: boolean
    isAbandoned?: boolean
    playerOfTheMatchId?: string
  }) => patch<Match>(`/matches/${id}/result`, data),
}

export interface ScoringSession {
  matchId: string
  version: number
  matchState: MatchState | null
  deliveries: DeliveryEvent[]
  bowlerSelections: BowlerSelection[]
  eventIds: string[]
}

export const scoringApi = {
  get: (matchId: string) => get<ScoringSession>(`/matches/${matchId}/scoring`),
  start: (matchId: string, matchState: MatchState) =>
    post<ScoringSession>(`/matches/${matchId}/scoring/start`, {
      expectedVersion: 0,
      matchState,
      deliveries: [],
      bowlerSelections: [],
    }),
  record: (
    matchId: string,
    expectedVersion: number,
    matchState: MatchState,
    deliveries: DeliveryEvent[],
    bowlerSelections: BowlerSelection[],
    delivery: DeliveryEvent,
  ) => post<ScoringSession>(`/matches/${matchId}/scoring/deliveries`, {
    expectedVersion,
    matchState,
    deliveries,
    bowlerSelections,
    delivery,
  }),
  chooseBowler: (
    matchId: string,
    expectedVersion: number,
    matchState: MatchState,
    deliveries: DeliveryEvent[],
    bowlerSelections: BowlerSelection[],
  ) => post<ScoringSession>(`/matches/${matchId}/scoring/bowler`, {
    expectedVersion,
    matchState,
    deliveries,
    bowlerSelections,
  }),
  undo: (matchId: string, expectedVersion: number) =>
    post<ScoringSession>(`/matches/${matchId}/scoring/undo`, { expectedVersion }),
}

export interface MatchInput {
  tournamentId?: string
  format: Match['format']
  venue: string
  date: string
  status: Match['status']
  teams: [{ id: string }, { id: string }]
  setup: MatchSetup
}
