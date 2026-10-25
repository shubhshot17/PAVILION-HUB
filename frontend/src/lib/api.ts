import type {
  BallInput, Dashboard, Leaders, MatchDetail, MatchSummary, Player, PlayerProfile,
  Team, TeamDetail, Tournament, TournamentDetail,
} from './types'

/**
 * API base URL. On a phone (Capacitor) localhost is the phone itself, so set
 * VITE_API_URL to the computer's LAN address; in the browser the Vite proxy
 * forwards relative /api calls.
 */
const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '')
const API_BASE = configuredApiUrl?.replace(/\/api$/i, '') ?? ''

/** Address used in share links; set VITE_PUBLIC_URL once the app is deployed. */
export const PUBLIC_URL = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) ?? window.location.origin)
  .replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?')
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.message ?? `Request failed (${response.status})`)
  }
  return data as T
}

const get = <T>(path: string) => request<T>('GET', path)
const post = <T>(path: string, body: unknown = {}) => request<T>('POST', path, body)
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body)
const del = <T = void>(path: string) => request<T>('DELETE', path)

export const api = {
  dashboard: () => get<Dashboard>('/dashboard'),
  leaders: () => get<Leaders>('/stats'),

  tournaments: () => get<Tournament[]>('/tournaments'),
  tournament: (id: string) => get<TournamentDetail>(`/tournaments/${id}`),
  tournamentByCode: (code: string) => get<TournamentDetail>(`/tournaments/code/${code}`),
  createTournament: (data: Partial<Tournament>) => post<TournamentDetail>('/tournaments', data),
  updateTournament: (id: string, data: Partial<Tournament>) => patch<TournamentDetail>(`/tournaments/${id}`, data),
  deleteTournament: (id: string) => del(`/tournaments/${id}`),
  addTournamentTeam: (id: string, teamId: string) => post<TournamentDetail>(`/tournaments/${id}/teams`, { teamId }),
  removeTournamentTeam: (id: string, teamId: string) => del<TournamentDetail>(`/tournaments/${id}/teams/${teamId}`),

  teams: () => get<Team[]>('/teams'),
  team: (id: string) => get<TeamDetail>(`/teams/${id}`),
  createTeam: (data: Partial<Team>) => post<Team>('/teams', data),
  updateTeam: (id: string, data: Partial<Team>) => patch<Team>(`/teams/${id}`, data),
  deleteTeam: (id: string) => del(`/teams/${id}`),

  player: (id: string, tournamentId?: string) =>
    get<PlayerProfile>(`/players/${id}${tournamentId ? `?tournamentId=${tournamentId}` : ''}`),
  createPlayer: (data: Partial<Player>) => post<Player>('/players', data),
  updatePlayer: (id: string, data: Partial<Player>) => patch<Player>(`/players/${id}`, data),
  deletePlayer: (id: string) => del(`/players/${id}`),

  matches: (query: { status?: string; tournamentId?: string } = {}) => {
    const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][])
    return get<MatchSummary[]>(`/matches${params.size ? `?${params}` : ''}`)
  },
  match: (id: string) => get<MatchDetail>(`/matches/${id}`),
  createMatch: (data: Record<string, unknown>) => post<MatchDetail>('/matches', data),
  deleteMatch: (id: string) => del(`/matches/${id}`),
  startMatch: (id: string, data: Record<string, unknown>) => post<MatchDetail>(`/matches/${id}/start`, data),
  setCrease: (id: string, data: { strikerId?: string; nonStrikerId?: string; bowlerId?: string }) =>
    patch<MatchDetail>(`/matches/${id}/crease`, data),
  recordBall: (id: string, ball: BallInput) => post<MatchDetail>(`/matches/${id}/balls`, ball),
  undoBall: (id: string) => del<MatchDetail>(`/matches/${id}/balls/last`),
  nextInnings: (id: string, data: { strikerId: string; nonStrikerId: string; bowlerId: string }) =>
    post<MatchDetail>(`/matches/${id}/next-innings`, data),
  endInnings: (id: string) => post<MatchDetail>(`/matches/${id}/end-innings`),
  abandonMatch: (id: string) => post<MatchDetail>(`/matches/${id}/abandon`),
}
