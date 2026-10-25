import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CalendarDays, MapPin, Shield, Trophy } from 'lucide-react'
import { EmptyState, TeamBadge } from '@/components/common'
import { Leaderboards } from '@/components/leaderboards'
import { MatchGrid } from '@/components/match-card'
import { PointsTable } from '@/components/points-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate } from '@/lib/format'
import { useLinks } from '@/lib/links'
import type { TournamentDetail } from '@/lib/types'

export function TournamentHero({ tournament, actions }: { tournament: TournamentDetail; actions?: ReactNode }) {
  const live = tournament.matches.filter((match) => match.status === 'live').length
  const facts = [
    tournament.season && `Season ${tournament.season}`,
    `${tournament.overs} overs`,
    `${tournament.teams.length} teams`,
    `${tournament.matches.length} matches`,
  ].filter(Boolean)
  return (
    <div className="summer-gradient relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:p-8">
      <Trophy className="pointer-events-none absolute -right-6 -bottom-8 size-48 opacity-15" strokeWidth={1.25} />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {live > 0 && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur">
              <span className="size-2 animate-pulse rounded-full bg-white" /> {live} live now
            </span>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{tournament.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
            {(tournament.ground || tournament.city) && (
              <span className="flex items-center gap-1"><MapPin className="size-4" />{[tournament.ground, tournament.city].filter(Boolean).join(', ')}</span>
            )}
            {tournament.startDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-4" />
                {formatDate(tournament.startDate, false)}{tournament.endDate ? ` – ${formatDate(tournament.endDate, false)}` : ''}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {facts.map((fact) => (
              <span key={fact} className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{fact}</span>
            ))}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

function MatchesTab({ tournament, emptyAction }: { tournament: TournamentDetail; emptyAction?: ReactNode }) {
  const groups = [
    { title: 'Live', matches: tournament.matches.filter((m) => m.status === 'live') },
    { title: 'Upcoming', matches: tournament.matches.filter((m) => m.status === 'upcoming') },
    { title: 'Results', matches: tournament.matches.filter((m) => m.status === 'completed' || m.status === 'abandoned').reverse() },
  ].filter((group) => group.matches.length)
  if (!groups.length) {
    return <EmptyState icon={<CalendarDays />} title="No matches scheduled" description="Matches you schedule will show up here." action={emptyAction} />
  }
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{group.title}</h3>
          <MatchGrid matches={group.matches} showTournament={false} />
        </section>
      ))}
    </div>
  )
}

function TeamsTab({ tournament, emptyAction }: { tournament: TournamentDetail; emptyAction?: ReactNode }) {
  const links = useLinks()
  if (!tournament.teams.length) {
    return <EmptyState icon={<Shield />} title="No teams yet" description="Add the teams taking part." action={emptyAction} />
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tournament.teams.map((team) => {
        const row = tournament.standings.find((standing) => standing.teamId === team.id)
        return (
          <Link key={team.id} to={links.team(team.id)} className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md">
            <TeamBadge team={team} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{team.name}</div>
              <div className="text-xs text-muted-foreground">{team.city ?? 'View squad'}</div>
            </div>
            {row && <div className="text-right text-xs text-muted-foreground"><div className="text-lg font-extrabold text-foreground">{row.points}</div>pts</div>}
          </Link>
        )
      })}
    </div>
  )
}

export function TournamentTabs({ tournament, emptyMatchesAction, emptyTeamsAction }: {
  tournament: TournamentDetail
  emptyMatchesAction?: ReactNode
  emptyTeamsAction?: ReactNode
}) {
  return (
    <Tabs defaultValue="matches">
      <TabsList className="mb-4 h-11 w-full justify-start overflow-x-auto rounded-xl sm:w-auto">
        <TabsTrigger value="matches" className="px-4">Matches</TabsTrigger>
        <TabsTrigger value="table" className="px-4">Points table</TabsTrigger>
        <TabsTrigger value="stats" className="px-4">Stats</TabsTrigger>
        <TabsTrigger value="teams" className="px-4">Teams</TabsTrigger>
      </TabsList>
      <TabsContent value="matches"><MatchesTab tournament={tournament} emptyAction={emptyMatchesAction} /></TabsContent>
      <TabsContent value="table">
        {tournament.standings.length
          ? <PointsTable rows={tournament.standings} />
          : <EmptyState icon={<Trophy />} title="Points table is empty" description="Add teams to see the table." />}
        <p className="mt-3 text-xs text-muted-foreground">Win 2 pts · Tie / no result 1 pt · Ties broken by net run rate.</p>
      </TabsContent>
      <TabsContent value="stats"><Leaderboards leaders={tournament.leaders} /></TabsContent>
      <TabsContent value="teams"><TeamsTab tournament={tournament} emptyAction={emptyTeamsAction} /></TabsContent>
    </Tabs>
  )
}
