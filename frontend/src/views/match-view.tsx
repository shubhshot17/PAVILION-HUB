import type { ReactNode } from 'react'
import { CalendarDays, CircleDot, Coins, MapPin } from 'lucide-react'
import { EmptyState, StatusBadge, TeamBadge } from '@/components/common'
import { BallChip, Scorecard } from '@/components/scorecard'
import { formatDate, matchStatusLine, overs, teamScore } from '@/lib/format'
import type { MatchDetail, Team } from '@/lib/types'
import { cn } from '@/lib/utils'

function Side({ match, team, align }: { match: MatchDetail; team: Team; align: 'left' | 'right' }) {
  const score = teamScore(match, team)
  const batting = match.status === 'live' && match.scores.at(-1)?.teamId === team.id
  const lost = match.status === 'completed' && match.result?.winnerId && match.result.winnerId !== team.id
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:flex-row sm:gap-4', align === 'right' && 'sm:flex-row-reverse sm:text-right', lost && 'opacity-60')}>
      <TeamBadge team={team} size="lg" />
      <div className="min-w-0">
        <div className="truncate font-bold sm:text-lg">{team.name}</div>
        {score ? (
          <div className="tabular">
            <span className={cn('text-2xl font-extrabold sm:text-3xl', batting && 'text-primary')}>{score.runs}/{score.wickets}</span>
            <span className="ml-1 text-sm text-muted-foreground">({overs(score.legalBalls)})</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Yet to bat</div>
        )}
      </div>
    </div>
  )
}

export function MatchHero({ match, actions }: { match: MatchDetail; actions?: ReactNode }) {
  const tossWinner = match.toss && (match.toss.winnerId === match.teamA.id ? match.teamA : match.teamB)
  const line = matchStatusLine(match)
  return (
    <div className="mb-6 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-5 py-3 text-sm">
        <span className="font-semibold">{[match.tournamentName, match.title].filter(Boolean).join(' · ') || 'Friendly match'} · {match.overs} overs</span>
        <StatusBadge status={match.status} />
      </div>
      <div className="flex items-center gap-3 px-5 py-6 sm:gap-6">
        <Side match={match} team={match.teamA} align="left" />
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-extrabold text-muted-foreground">VS</span>
        <Side match={match} team={match.teamB} align="right" />
      </div>
      {line && (
        <div className={cn('px-5 pb-4 text-center font-bold', match.status === 'completed' ? 'text-success' : match.status === 'live' ? 'text-live' : 'text-muted-foreground')}>
          {line}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(match.date)}</span>
          {match.venue && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{match.venue}</span>}
          {tossWinner && <span className="flex items-center gap-1"><Coins className="size-3.5" />{tossWinner.name} won the toss, chose to {match.toss!.decision}</span>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** Who is batting and bowling right now, plus the current over. */
export function LiveStrip({ match }: { match: MatchDetail }) {
  const live = match.live
  if (!live) return null
  const innings = match.innings[live.inningsIndex]
  const batter = (id: string | null) => innings.batting.find((entry) => entry.playerId === id)
  const bowler = innings.bowling.find((entry) => entry.playerId === live.bowlerId)
  const crr = innings.runRate.toFixed(2)
  return (
    <div className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_auto]">
      <div className="space-y-1.5 text-sm">
        {[live.strikerId, live.nonStrikerId].map((id, i) => {
          const entry = batter(id)
          return entry ? (
            <div key={id} className="flex items-center gap-2">
              <span className="flex w-4 justify-center">{i === 0 && <span className="size-2 rounded-full bg-primary" />}</span>
              <span className={cn('flex-1 truncate', i === 0 && 'font-bold')}>{entry.name}</span>
              <span className="tabular font-bold">{entry.runs}</span>
              <span className="tabular w-10 text-muted-foreground">({entry.balls})</span>
            </div>
          ) : null
        })}
        {bowler && (
          <div className="flex items-center gap-2 border-t pt-1.5">
            <CircleDot className="size-4 text-live" />
            <span className="flex-1 truncate">{bowler.name}</span>
            <span className="tabular font-semibold">{bowler.wickets}-{bowler.runs}</span>
            <span className="tabular w-10 text-muted-foreground">({bowler.overs})</span>
          </div>
        )}
      </div>
      <div className="flex flex-col justify-between gap-2 sm:items-end">
        <div className="tabular text-xs text-muted-foreground">
          CRR <span className="font-bold text-foreground">{crr}</span>
          {live.requiredRunRate !== null && <> · RRR <span className="font-bold text-foreground">{live.requiredRunRate.toFixed(2)}</span></>}
        </div>
        <div className="flex flex-wrap gap-1">
          {live.currentOver.length ? live.currentOver.map((ball, i) => <BallChip key={i} label={ball} size="sm" />)
            : <span className="text-xs text-muted-foreground">New over</span>}
        </div>
      </div>
    </div>
  )
}

export function MatchBody({ match }: { match: MatchDetail }) {
  return (
    <>
      <LiveStrip match={match} />
      {match.innings.length
        ? <Scorecard match={match} />
        : <EmptyState icon={<CalendarDays />} title="Match hasn't started" description="The scorecard appears once the first ball is bowled." />}
    </>
  )
}
