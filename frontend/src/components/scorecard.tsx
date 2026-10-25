import { useState } from 'react'
import { Link } from 'react-router'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLinks } from '@/lib/links'
import type { Innings, MatchDetail, Team } from '@/lib/types'
import { cn } from '@/lib/utils'

export function BallChip({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' }) {
  const style = label.includes('W') && !label.startsWith('Wd')
    ? 'bg-live text-white border-live'
    : label === '4' ? 'bg-sky text-white border-sky'
      : label === '6' ? 'bg-success text-white border-success'
        : /Wd|Nb/.test(label) ? 'bg-accent text-accent-foreground border-primary/30'
          : 'bg-card'
  return (
    <span className={cn(
      'tabular inline-flex items-center justify-center rounded-full border font-bold',
      size === 'md' ? 'h-8 min-w-8 px-1.5 text-xs' : 'h-6 min-w-6 px-1 text-[10px]',
      style,
    )}>
      {label}
    </span>
  )
}

function InningsCard({ innings, team, live }: { innings: Innings; team: Team; live?: MatchDetail['live'] }) {
  const links = useLinks()
  const atCrease = new Set([live?.strikerId, live?.nonStrikerId].filter(Boolean))
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between bg-muted/60 px-4 py-3">
          <span className="font-bold">{team.name}</span>
          <span className="tabular font-extrabold">
            {innings.runs}/{innings.wickets} <span className="text-sm font-medium text-muted-foreground">({innings.overs} ov)</span>
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Batter</TableHead>
              <TableHead className="text-right">R</TableHead>
              <TableHead className="text-right">B</TableHead>
              <TableHead className="text-right">4s</TableHead>
              <TableHead className="text-right">6s</TableHead>
              <TableHead className="pr-4 text-right">SR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular">
            {innings.batting.map((entry) => (
              <TableRow key={entry.playerId}>
                <TableCell className="max-w-48 pl-4">
                  <Link to={links.player(entry.playerId)} className="font-semibold hover:text-primary">
                    {entry.name}{atCrease.has(entry.playerId) && live?.strikerId === entry.playerId ? ' *' : ''}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {entry.dismissal ?? (atCrease.has(entry.playerId) ? 'batting' : 'not out')}
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold">{entry.runs}</TableCell>
                <TableCell className="text-right">{entry.balls}</TableCell>
                <TableCell className="text-right">{entry.fours}</TableCell>
                <TableCell className="text-right">{entry.sixes}</TableCell>
                <TableCell className="pr-4 text-right">{entry.strikeRate.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap justify-between gap-2 border-t px-4 py-3 text-sm">
          <span>
            <span className="font-semibold">Extras {innings.extras.total}</span>
            <span className="text-muted-foreground"> (wd {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb {innings.extras.legByes})</span>
          </span>
          <span className="font-semibold">Run rate {innings.runRate.toFixed(2)}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="pl-4">Bowler</TableHead>
              <TableHead className="text-right">O</TableHead>
              <TableHead className="text-right">M</TableHead>
              <TableHead className="text-right">R</TableHead>
              <TableHead className="text-right">W</TableHead>
              <TableHead className="pr-4 text-right">Econ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular">
            {innings.bowling.map((entry) => (
              <TableRow key={entry.playerId}>
                <TableCell className="pl-4">
                  <Link to={links.player(entry.playerId)} className="font-semibold hover:text-primary">{entry.name}</Link>
                </TableCell>
                <TableCell className="text-right">{entry.overs}</TableCell>
                <TableCell className="text-right">{entry.maidens}</TableCell>
                <TableCell className="text-right">{entry.runs}</TableCell>
                <TableCell className="text-right font-bold">{entry.wickets}</TableCell>
                <TableCell className="pr-4 text-right">{entry.economy.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {innings.fallOfWickets.length > 0 && (
        <div className="rounded-2xl border bg-card px-4 py-3 text-sm">
          <div className="mb-1.5 font-bold">Fall of wickets</div>
          <p className="tabular leading-relaxed text-muted-foreground">
            {innings.fallOfWickets.map((fow) => `${fow.runs}-${fow.wicket} (${fow.name}, ${fow.overs})`).join(' · ')}
          </p>
        </div>
      )}

      {innings.overHistory.length > 0 && (
        <div className="rounded-2xl border bg-card px-4 py-3">
          <div className="mb-2 text-sm font-bold">Overs</div>
          <div className="space-y-2">
            {[...innings.overHistory].reverse().map((over) => (
              <div key={over.number} className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">Over {over.number}</span>
                <span className="w-28 shrink-0 truncate text-xs">{over.bowlerName}</span>
                {over.balls.map((ball, i) => <BallChip key={i} label={ball} size="sm" />)}
                <span className="ml-auto text-xs font-bold">{over.runs} runs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Innings switcher + full scorecard for one match. */
export function Scorecard({ match }: { match: MatchDetail }) {
  const [selected, setSelected] = useState<number | null>(null)
  if (!match.innings.length) return null
  const index = selected ?? match.innings.length - 1
  const teamFor = (id: string) => (id === match.teamA.id ? match.teamA : match.teamB)
  return (
    <div className="space-y-4">
      {match.innings.length > 1 && (
        <div className="inline-flex rounded-xl bg-muted p-1">
          {match.innings.map((innings, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold transition', i === index ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {teamFor(innings.battingTeamId).shortName} · {innings.runs}/{innings.wickets}
            </button>
          ))}
        </div>
      )}
      <InningsCard
        innings={match.innings[index]}
        team={teamFor(match.innings[index].battingTeamId)}
        live={index === match.live?.inningsIndex ? match.live : null}
      />
    </div>
  )
}
