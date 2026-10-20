/* ============================================================
   PAVILION HUB — DEMO DATA ONLY
   ------------------------------------------------------------
   ⚠️ Everything in this file is FICTIONAL sample data for the
   demo/UI. None of these teams, scores or results are real.
   When the backend is built later, this module gets replaced
   by real API calls — the UI code won't need to change.
   ============================================================ */

import type { Match, StandingRow, Tournament } from '../types'

export const DEMO_TEAMS = {
  rangers: { id: 't1', name: 'Westport Rangers', shortName: 'WPR', color: '#c6f24e' },
  falcons: { id: 't2', name: 'Eastvale Falcons', shortName: 'EVF', color: '#7fd8ff' },
  kings: { id: 't3', name: 'Northgate Kings', shortName: 'NGK', color: '#ffb454' },
  lions: { id: 't4', name: 'Southridge Lions', shortName: 'SRL', color: '#ff8fa3' },
  titans: { id: 't5', name: 'Harbor Titans', shortName: 'HBT', color: '#b39bff' },
  storm: { id: 't6', name: 'Lakeside Storm', shortName: 'LKS', color: '#6ee7b7' },
} as const

export const DEMO_TOURNAMENTS: Tournament[] = [
  { id: 'c1', name: 'National Premier T20 Cup', season: '2026', format: 'T20', isActive: true },
  { id: 'c2', name: 'Provincial One-Day Shield', season: '2026', format: 'ODI', isActive: true },
]

export const DEMO_MATCHES: Match[] = [
  {
    id: 'm1',
    tournament: 'National Premier T20 Cup',
    format: 'T20',
    venue: 'Westport Oval',
    date: '2026-10-20T19:00:00',
    status: 'live',
    teams: [DEMO_TEAMS.rangers, DEMO_TEAMS.falcons],
    scores: [
      { teamId: 't1', runs: 148, wickets: 4, overs: 16.2 },
      { teamId: 't2', runs: 0, wickets: 0, overs: 0 },
    ],
    currentInnings: 0,
  },
  {
    id: 'm2',
    tournament: 'Provincial One-Day Shield',
    format: 'ODI',
    venue: 'Eastvale Cricket Ground',
    date: '2026-10-20T13:30:00',
    status: 'live',
    teams: [DEMO_TEAMS.kings, DEMO_TEAMS.lions],
    scores: [
      { teamId: 't3', runs: 236, wickets: 8, overs: 40, declared: false },
      { teamId: 't4', runs: 92, wickets: 2, overs: 18.4 },
    ],
    currentInnings: 1,
  },
  {
    id: 'm3',
    tournament: 'National Premier T20 Cup',
    format: 'T20',
    venue: 'Northgate Arena',
    date: '2026-10-21T19:30:00',
    status: 'upcoming',
    teams: [DEMO_TEAMS.titans, DEMO_TEAMS.storm],
  },
  {
    id: 'm4',
    tournament: 'National Premier T20 Cup',
    format: 'T20',
    venue: 'Westport Oval',
    date: '2026-10-22T15:00:00',
    status: 'upcoming',
    teams: [DEMO_TEAMS.rangers, DEMO_TEAMS.lions],
  },
  {
    id: 'm5',
    tournament: 'Provincial One-Day Shield',
    format: 'ODI',
    venue: 'Lakeside Park',
    date: '2026-10-23T13:30:00',
    status: 'upcoming',
    teams: [DEMO_TEAMS.falcons, DEMO_TEAMS.kings],
  },
  {
    id: 'm6',
    tournament: 'National Premier T20 Cup',
    format: 'T20',
    venue: 'Southridge Bowl',
    date: '2026-10-18T19:00:00',
    status: 'completed',
    teams: [DEMO_TEAMS.storm, DEMO_TEAMS.rangers],
    scores: [
      { teamId: 't6', runs: 171, wickets: 6, overs: 20 },
      { teamId: 't1', runs: 174, wickets: 3, overs: 18.4 },
    ],
    result: 'Westport Rangers won by 7 wickets',
  },
  {
    id: 'm7',
    tournament: 'Provincial One-Day Shield',
    format: 'ODI',
    venue: 'Eastvale Cricket Ground',
    date: '2026-10-17T13:30:00',
    status: 'completed',
    teams: [DEMO_TEAMS.lions, DEMO_TEAMS.titans],
    scores: [
      { teamId: 't4', runs: 289, wickets: 7, overs: 50 },
      { teamId: 't5', runs: 261, wickets: 10, overs: 47.2 },
    ],
    result: 'Southridge Lions won by 28 runs',
  },
  {
    id: 'm8',
    tournament: 'National Premier T20 Cup',
    format: 'T20',
    venue: 'Harbor Green',
    date: '2026-10-16T19:00:00',
    status: 'completed',
    teams: [DEMO_TEAMS.kings, DEMO_TEAMS.falcons],
    scores: [
      { teamId: 't3', runs: 143, wickets: 9, overs: 20 },
      { teamId: 't2', runs: 147, wickets: 4, overs: 16.1 },
    ],
    result: 'Eastvale Falcons won by 6 wickets',
  },
]

export const DEMO_STANDINGS: StandingRow[] = [
  { teamId: 't1', teamName: 'Westport Rangers', shortName: 'WPR', played: 6, won: 5, lost: 1, drawn: 0, points: 10, netRunRate: 1.24 },
  { teamId: 't2', teamName: 'Eastvale Falcons', shortName: 'EVF', played: 6, won: 4, lost: 2, drawn: 0, points: 8, netRunRate: 0.81 },
  { teamId: 't4', teamName: 'Southridge Lions', shortName: 'SRL', played: 6, won: 3, lost: 3, drawn: 0, points: 6, netRunRate: 0.12 },
  { teamId: 't3', teamName: 'Northgate Kings', shortName: 'NGK', played: 6, won: 2, lost: 4, drawn: 0, points: 4, netRunRate: -0.35 },
  { teamId: 't6', teamName: 'Lakeside Storm', shortName: 'LKS', played: 6, won: 1, lost: 5, drawn: 0, points: 2, netRunRate: -0.92 },
  { teamId: 't5', teamName: 'Harbor Titans', shortName: 'HBT', played: 6, won: 0, lost: 6, drawn: 0, points: 0, netRunRate: -1.57 },
]
