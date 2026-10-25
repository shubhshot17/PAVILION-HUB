import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Coins, Play, UserPlus } from 'lucide-react'
import { ErrorState, LoadingBlock, PageHeader, TeamBadge } from '@/components/common'
import { Field, NativeSelect, useAction } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { ROLE_LABEL } from '@/lib/format'
import type { MatchDetail, Team } from '@/lib/types'
import { cn } from '@/lib/utils'

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-bold">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('flex flex-1 items-center justify-center gap-3 rounded-2xl border-2 px-4 py-4 font-bold transition',
        selected ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:border-primary/40')}>
      {children}
    </button>
  )
}

function SetupForm({ match }: { match: MatchDetail }) {
  const navigate = useNavigate()
  const { busy, run } = useAction()
  const teams: Team[] = [match.teamA, match.teamB]
  const [tossWinnerId, setTossWinnerId] = useState('')
  const [decision, setDecision] = useState<'bat' | 'bowl' | ''>('')
  const [xi, setXi] = useState<Record<string, string[]>>(() => Object.fromEntries(
    teams.map((team) => [team.id, (match.squads[team.id] ?? []).slice(0, 11).map((p) => p.id)]),
  ))
  const [striker, setStriker] = useState('')
  const [nonStriker, setNonStriker] = useState('')
  const [bowler, setBowler] = useState('')

  const other = (id: string) => (id === match.teamA.id ? match.teamB : match.teamA)
  const batting = tossWinnerId && decision ? (decision === 'bat' ? teams.find((t) => t.id === tossWinnerId)! : other(tossWinnerId)) : null
  const bowling = batting ? other(batting.id) : null
  const playersOf = (team: Team | null) => (team ? (match.squads[team.id] ?? []).filter((p) => xi[team.id]?.includes(p.id)) : [])

  useEffect(() => {
    setStriker(''); setNonStriker(''); setBowler('')
  }, [batting?.id])

  const ready = batting && striker && nonStriker && bowler && striker !== nonStriker
    && teams.every((team) => (xi[team.id]?.length ?? 0) >= 2)

  async function start() {
    const updated = await run(() => api.startMatch(match.id, {
      tossWinnerId, tossDecision: decision, playingXI: xi, strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler,
    }), 'Match started — good luck!')
    if (updated) navigate(`/matches/${match.id}/score`, { replace: true })
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Step number={1} title="Toss">
        <p className="mb-2 text-sm font-medium text-muted-foreground">Who won the toss?</p>
        <div className="flex gap-3">
          {teams.map((team) => (
            <Choice key={team.id} selected={tossWinnerId === team.id} onClick={() => setTossWinnerId(team.id)}>
              <TeamBadge team={team} size="sm" /> <span className="truncate">{team.name}</span>
            </Choice>
          ))}
        </div>
        <p className="mt-4 mb-2 text-sm font-medium text-muted-foreground">Elected to</p>
        <div className="flex gap-3">
          <Choice selected={decision === 'bat'} onClick={() => setDecision('bat')}>Bat first</Choice>
          <Choice selected={decision === 'bowl'} onClick={() => setDecision('bowl')}>Bowl first</Choice>
        </div>
      </Step>

      <Step number={2} title="Playing XI">
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => {
            const squad = match.squads[team.id] ?? []
            const chosen = xi[team.id] ?? []
            return (
              <div key={team.id} className="rounded-2xl border">
                <div className="flex items-center gap-2 border-b px-3 py-2.5">
                  <TeamBadge team={team} size="sm" />
                  <span className="flex-1 truncate font-bold">{team.name}</span>
                  <span className={cn('tabular text-xs font-bold', chosen.length < 2 ? 'text-destructive' : 'text-success')}>{chosen.length} selected</span>
                </div>
                {squad.length < 2 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Needs at least 2 players.
                    <Button asChild size="sm" variant="outline" className="mt-2 w-full"><Link to={`/teams/${team.id}`}><UserPlus /> Add players</Link></Button>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto p-1">
                    {squad.map((player) => (
                      <label key={player.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
                        <Checkbox checked={chosen.includes(player.id)} onCheckedChange={(checked) => setXi((current) => ({
                          ...current,
                          [team.id]: checked ? [...chosen, player.id] : chosen.filter((id) => id !== player.id),
                        }))} />
                        <span className="flex-1 text-sm font-medium">{player.name}</span>
                        <span className="text-xs text-muted-foreground">{ROLE_LABEL[player.role]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Step>

      <Step number={3} title="Openers & first bowler">
        {!batting || !bowling ? (
          <p className="text-sm text-muted-foreground">Complete the toss first.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={`Striker (${batting.shortName})`} htmlFor="s-striker">
              <NativeSelect id="s-striker" value={striker} onChange={(e) => setStriker(e.target.value)}>
                <option value="" disabled>Select</option>
                {playersOf(batting).map((p) => <option key={p.id} value={p.id} disabled={p.id === nonStriker}>{p.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label={`Non-striker (${batting.shortName})`} htmlFor="s-non">
              <NativeSelect id="s-non" value={nonStriker} onChange={(e) => setNonStriker(e.target.value)}>
                <option value="" disabled>Select</option>
                {playersOf(batting).map((p) => <option key={p.id} value={p.id} disabled={p.id === striker}>{p.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label={`Bowler (${bowling.shortName})`} htmlFor="s-bowler">
              <NativeSelect id="s-bowler" value={bowler} onChange={(e) => setBowler(e.target.value)}>
                <option value="" disabled>Select</option>
                {playersOf(bowling).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
        )}
      </Step>

      <Button size="lg" className="h-12 w-full text-base" disabled={!ready || busy} onClick={start}>
        <Play /> Start scoring
      </Button>
    </div>
  )
}

export function StartMatchPage() {
  const { id = '' } = useParams()
  const { data: match, error, loading, reload } = useApi(() => api.match(id), id)
  if (loading && !match) return <LoadingBlock />
  if (error || !match) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />
  if (match.status !== 'upcoming') {
    return <ErrorState message="This match has already started." />
  }
  return (
    <>
      <PageHeader
        eyebrow={<span className="flex items-center gap-1.5"><Coins className="size-4" />{match.tournamentName ?? 'Friendly match'} · {match.overs} overs</span>}
        title={`${match.teamA.name} vs ${match.teamB.name}`}
      />
      <SetupForm match={match} />
    </>
  )
}
