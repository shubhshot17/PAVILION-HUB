import { Link } from 'react-router'
import { MapPin } from 'lucide-react'
import { StatusBadge, TeamBadge } from '@/components/common'
import { matchStatusLine, overs, teamScore } from '@/lib/format'
import { useLinks } from '@/lib/links'
import type { MatchSummary, Team } from '@/lib/types'
import { cn } from '@/lib/utils'

function TeamRow({ match, team }: { match: MatchSummary; team: Team }) {
  const score = teamScore(match, team)
  const isWinner = match.result?.winnerId === team.id
  const isBatting = match.status === 'live' && match.scores.at(-1)?.teamId === team.id
  const dim = match.status === 'completed' && match.result?.winnerId && !isWinner
  return (
    <div className={cn('flex items-center gap-3', dim && 'opacity-60')}>
      <TeamBadge team={team} size="sm" />
      <span className={cn('min-w-0 flex-1 truncate font-semibold', (isWinner || isBatting) && 'font-extrabold')}>
        {team.name}
      </span>
      {score && (
        <span className="tabular flex items-baseline gap-1.5">
          <span className="text-lg font-extrabold">{score.runs}/{score.wickets}</span>
          <span className="text-xs text-muted-foreground">({overs(score.legalBalls)})</span>
        </span>
      )}
    </div>
  )
}

export function MatchCard({ match, showTournament = true }: { match: MatchSummary; showTournament?: boolean }) {
  const links = useLinks()
  const statusLine = matchStatusLine(match)
  const heading = [showTournament ? match.tournamentName : null, match.title].filter(Boolean).join(' · ') || 'Friendly match'
  return (
    <Link
      to={links.match(match.id)}
      className={cn(
        'group block rounded-2xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
        match.status === 'live' && 'border-live/30 ring-1 ring-live/10',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate font-medium">{heading} · {match.overs} ov</span>
        <StatusBadge status={match.status} />
      </div>
      <div className="space-y-2.5">
        <TeamRow match={match} team={match.teamA} />
        <TeamRow match={match} team={match.teamB} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-sm">
        <span className={cn('font-semibold', match.status === 'upcoming' ? 'shrink-0 text-muted-foreground' : 'min-w-0 truncate',
          match.status === 'completed' && 'text-success', match.status === 'live' && 'text-live')}>
          {statusLine}
        </span>
        {match.venue && match.status === 'upcoming' && (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" /> <span className="truncate">{match.venue}</span>
          </span>
        )}
      </div>
    </Link>
  )
}

export function MatchGrid({ matches, showTournament }: { matches: MatchSummary[]; showTournament?: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {matches.map((match) => <MatchCard key={match.id} match={match} showTournament={showTournament} />)}
    </div>
  )
}
