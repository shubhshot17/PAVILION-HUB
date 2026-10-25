import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Flame, Gauge, Target, Trophy, Zap } from 'lucide-react'
import { EmptyState } from '@/components/common'
import { useLinks } from '@/lib/links'
import type { LeaderRow, Leaders } from '@/lib/types'
import { cn } from '@/lib/utils'

function Board({ title, icon, rows, unit }: { title: string; icon: ReactNode; rows: LeaderRow[]; unit: string }) {
  const links = useLinks()
  const [leader, ...rest] = rows
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3 font-bold">
        <span className="text-primary [&_svg]:size-4">{icon}</span>
        {title}
      </div>
      {!leader ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <>
          <Link to={links.player(leader.playerId)} className="flex items-center gap-3 bg-accent/60 px-4 py-3 hover:bg-accent">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">1</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{leader.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                <span className="font-semibold" style={{ color: leader.teamColor }}>{leader.teamShortName}</span> · {leader.detail}
              </div>
            </div>
            <div className="text-right">
              <div className="tabular text-2xl font-extrabold leading-none">{leader.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{unit}</div>
            </div>
          </Link>
          <ol>
            {rest.slice(0, 4).map((row, index) => (
              <li key={row.playerId}>
                <Link to={links.player(row.playerId)} className={cn('flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60', index > 0 && 'border-t')}>
                  <span className="w-7 text-center font-semibold text-muted-foreground">{index + 2}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                  <span className="text-xs font-semibold" style={{ color: row.teamColor }}>{row.teamShortName}</span>
                  <span className="tabular w-12 text-right font-bold">{row.value}</span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

export function Leaderboards({ leaders }: { leaders: Leaders }) {
  if (!leaders.mostRuns.length && !leaders.mostWickets.length) {
    return <EmptyState icon={<Trophy />} title="No stats yet" description="Stats appear as soon as the first ball is scored." />
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Board title="Most runs" icon={<Trophy />} rows={leaders.mostRuns} unit="runs" />
      <Board title="Most wickets" icon={<Target />} rows={leaders.mostWickets} unit="wkts" />
      <Board title="Most sixes" icon={<Flame />} rows={leaders.mostSixes} unit="sixes" />
      <Board title="Best strike rate" icon={<Zap />} rows={leaders.bestStrikeRate} unit="SR" />
      <Board title="Best economy" icon={<Gauge />} rows={leaders.bestEconomy} unit="econ" />
    </div>
  )
}
