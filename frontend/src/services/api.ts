/* ============================================================
   PAVILION HUB — API service layer
   ------------------------------------------------------------
   Real API calls to the Express backend.
   Falls back gracefully to demo data when the backend is
   unreachable (e.g. static preview / offline Capacitor build).

   VITE_API_URL env var controls the base URL (see .env.example).
   ============================================================ */

import type {
  DashboardData,
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
} from '../types'
import { DEMO_MATCHES, DEMO_STANDINGS } from '../data/demoData'

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
 * Fetch dashboard data.  On network failure the UI gets demo data so
 * the app still looks complete during offline/Android builds.
 * Demo data is clearly flagged via the footer on the Dashboard page.
 */
export async function fetchDashboardData(): Promise<DashboardData & { isDemo: boolean }> {
  try {
    const [matches, tournaments] = await Promise.all([
      get<Match[]>('/matches'),
      get<Tournament[]>('/tournaments'),
    ])

    // Find the most recently active tournament for the standings preview
    const activeTournament = tournaments.find((t) => t.isActive) ?? tournaments[0]
    const standings: StandingRow[] = activeTournament
      ? await get<StandingRow[]>(`/tournaments/${activeTournament.id}/standings`)
      : []

    return {
      liveMatches:  matches.filter((m) => m.status === 'live'),
      upcoming:     matches.filter((m) => m.status === 'upcoming'),
      recent:       matches.filter((m) => m.status === 'completed').slice(0, 10),
      standings,
      isDemo: false,
    }
  } catch {
    // Backend unreachable — serve demo data with a clear label
    return {
      liveMatches: DEMO_MATCHES.filter((m) => m.status === 'live'),
      upcoming:    DEMO_MATCHES.filter((m) => m.status === 'upcoming'),
      recent:      DEMO_MATCHES.filter((m) => m.status === 'completed'),
      standings:   DEMO_STANDINGS,
      isDemo: true,
    }
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

export const playersApi = {
  list:   ()           => get<Player[]>('/players'),
  get:    (id: string) => get<Player>(`/players/${id}`),
  create: (data: Partial<Player>) => post<Player>('/players', data),
  update: (id: string, data: Partial<Player>) => patch<Player>(`/players/${id}`, data),
  remove: (id: string) => del(`/players/${id}`),
  stats:  (id: string) => get<PlayerStats>(`/players/${id}/stats`),
}

/* ── Matches ────────────────────────────────────────────────── */

export const matchesApi = {
  list:      ()           => get<Match[]>('/matches'),
  get:       (id: string) => get<Match>(`/matches/${id}`),
  create:    (data: Partial<Match>) => post<Match>('/matches', data),
  update:    (id: string, data: Partial<Match>) => patch<Match>(`/matches/${id}`, data),
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
