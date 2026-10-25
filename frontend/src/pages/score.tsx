import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ArrowLeftRight, ClipboardList, MoreVertical, Share2, Trophy, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState, LoadingBlock } from '@/components/common'
import { Field, NativeSelect } from '@/components/form'
import { BallChip } from '@/components/scorecard'
import { ShareDialog } from '@/components/share-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import type { BallInput, ExtraType, MatchDetail, Player, WicketType } from '@/lib/types'
import { cn } from '@/lib/utils'

const EXTRAS: { value: ExtraType; label: string }[] = [
  { value: 'wide', label: 'WD' },
  { value: 'noball', label: 'NB' },
  { value: 'bye', label: 'BYE' },
  { value: 'legbye', label: 'LB' },
]

const WICKETS: { value: WicketType; label: string }[] = [
  { value: 'bowled', label: 'Bowled' },
  { value: 'caught', label: 'Caught' },
  { value: 'lbw', label: 'LBW' },
  { value: 'runout', label: 'Run out' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hitwicket', label: 'Hit wicket' },
  { value: 'retired', label: 'Retired hurt' },
]

const buzz = () => navigator.vibrate?.(12)

/** Everything the scorer needs, derived once from the match. */
function useScoringContext(match: MatchDetail) {
  const live = match.live!
  const innings = match.innings[live.inningsIndex]
  const team = (id: string) => (id === match.teamA.id ? match.teamA : match.teamB)
  const xi = (teamId: string) => (match.squads[teamId] ?? []).filter((p) => match.playingXI?.[teamId]?.includes(p.id))
  const battingTeam = team(innings.battingTeamId)
  const bowlingTeam = team(innings.bowlingTeamId)
  const outIds = new Set(innings.batting.filter((e) => e.out).map((e) => e.playerId))
  const atCrease = new Set([live.strikerId, live.nonStrikerId].filter(Boolean) as string[])
  return {
    live,
    innings,
    battingTeam,
    bowlingTeam,
    battingXI: xi(battingTeam.id),
    bowlingXI: xi(bowlingTeam.id),
    availableBatters: xi(battingTeam.id).filter((p) => !outIds.has(p.id) && !atCrease.has(p.id)),
    batter: (id: string | null) => innings.batting.find((e) => e.playerId === id),
    bowlerFigures: (id: string | null) => innings.bowling.find((e) => e.playerId === id),
    name: (id: string | null) => [...xi(match.teamA.id), ...xi(match.teamB.id)].find((p) => p.id === id)?.name ?? '—',
  }
}

function PickerDialog({ open, title, description, players, onPick, detail, footer }: {
  open: boolean
  title: string
  description: string
  players: Player[]
  onPick: (player: Player) => void
  detail?: (player: Player) => ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[55svh] gap-1.5 overflow-y-auto">
          {players.map((player) => (
            <button key={player.id} type="button" onClick={() => onPick(player)}
              className="flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:border-primary hover:bg-accent">
              <span className="flex-1 font-semibold">{player.name}</span>
              <span className="tabular text-xs text-muted-foreground">{detail?.(player)}</span>
            </button>
          ))}
          {!players.length && <p className="py-4 text-center text-sm text-muted-foreground">No players available.</p>}
        </div>
        {footer}
      </DialogContent>
    </Dialog>
  )
}

function WicketDialog({ open, onOpenChange, ctx, extra, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ctx: ReturnType<typeof useScoringContext>
  extra: ExtraType | null
  onConfirm: (ball: BallInput) => void
}) {
  const allowed = extra === 'wide' ? ['runout', 'stumped', 'retired'] : extra === 'noball' ? ['runout', 'retired'] : WICKETS.map((w) => w.value)
  const [type, setType] = useState<WicketType>(extra ? 'runout' : 'bowled')
  const [outId, setOutId] = useState(ctx.live.strikerId ?? '')
  const [fielderId, setFielderId] = useState('')
  const [runs, setRuns] = useState(0)
  const canChooseBatter = type === 'runout' || type === 'retired'
  const needsFielder = type === 'caught' || type === 'runout' || type === 'stumped'

  function confirm() {
    onConfirm({
      runs: type === 'runout' ? runs : 0,
      extra,
      wicket: { type, playerOutId: canChooseBatter ? outId : ctx.live.strikerId!, ...(needsFielder && fielderId ? { fielderId } : {}) },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{type === 'retired' ? 'Batter retiring' : 'Wicket!'}{extra ? ` (${EXTRAS.find((e) => e.value === extra)?.label})` : ''}</DialogTitle>
          <DialogDescription>How did it happen?</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WICKETS.filter((w) => allowed.includes(w.value)).map((wicket) => (
            <button key={wicket.value} type="button" onClick={() => setType(wicket.value)}
              className={cn('rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition',
                type === wicket.value ? 'border-live bg-live/10 text-live' : 'hover:border-live/40')}>
              {wicket.label}
            </button>
          ))}
        </div>
        {canChooseBatter && (
          <Field label="Who is out?">
            <div className="grid grid-cols-2 gap-2">
              {[ctx.live.strikerId, ctx.live.nonStrikerId].map((id, i) => id && (
                <button key={id} type="button" onClick={() => setOutId(id)}
                  className={cn('rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold', outId === id ? 'border-primary bg-accent' : '')}>
                  {ctx.name(id)} <span className="block text-xs font-normal text-muted-foreground">{i === 0 ? 'Striker' : 'Non-striker'}</span>
                </button>
              ))}
            </div>
          </Field>
        )}
        {type === 'runout' && (
          <Field label="Runs completed before the run out">
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((value) => (
                <button key={value} type="button" onClick={() => setRuns(value)}
                  className={cn('size-11 rounded-full border-2 font-bold', runs === value ? 'border-primary bg-primary text-primary-foreground' : '')}>{value}</button>
              ))}
            </div>
          </Field>
        )}
        {needsFielder && (
          <Field label={type === 'stumped' ? 'Wicket-keeper' : 'Fielder'} htmlFor="w-fielder">
            <NativeSelect id="w-fielder" value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
              <option value="">Not recorded</option>
              {ctx.bowlingXI.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect>
          </Field>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-live hover:bg-live/90" onClick={confirm} disabled={canChooseBatter && !outId}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NextInningsDialog({ match, onStart, busy }: { match: MatchDetail; onStart: (crease: { strikerId: string; nonStrikerId: string; bowlerId: string }) => void; busy: boolean }) {
  const first = match.innings[0]
  const chasing = first.bowlingTeamId === match.teamA.id ? match.teamA : match.teamB
  const fielding = chasing.id === match.teamA.id ? match.teamB : match.teamA
  const xi = (teamId: string) => (match.squads[teamId] ?? []).filter((p) => match.playingXI?.[teamId]?.includes(p.id))
  const [striker, setStriker] = useState('')
  const [nonStriker, setNonStriker] = useState('')
  const [bowler, setBowler] = useState('')
  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Innings break</DialogTitle>
          <DialogDescription>
            {chasing.name} need <b className="text-foreground">{first.runs + 1}</b> runs in {match.overs} overs to win.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={`Striker (${chasing.shortName})`} htmlFor="n-striker">
            <NativeSelect id="n-striker" value={striker} onChange={(e) => setStriker(e.target.value)}>
              <option value="" disabled>Select</option>
              {xi(chasing.id).map((p) => <option key={p.id} value={p.id} disabled={p.id === nonStriker}>{p.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label={`Non-striker (${chasing.shortName})`} htmlFor="n-non">
            <NativeSelect id="n-non" value={nonStriker} onChange={(e) => setNonStriker(e.target.value)}>
              <option value="" disabled>Select</option>
              {xi(chasing.id).map((p) => <option key={p.id} value={p.id} disabled={p.id === striker}>{p.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label={`Opening bowler (${fielding.shortName})`} htmlFor="n-bowler">
            <NativeSelect id="n-bowler" value={bowler} onChange={(e) => setBowler(e.target.value)}>
              <option value="" disabled>Select</option>
              {xi(fielding.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <DialogFooter>
          <Button asChild variant="outline"><Link to={`/matches/${match.id}`}>View scorecard</Link></Button>
          <Button disabled={!striker || !nonStriker || !bowler || busy}
            onClick={() => onStart({ strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler })}>
            Start 2nd innings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PadButton({ children, onClick, disabled, className }: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" disabled={disabled} onClick={() => { buzz(); onClick() }}
      className={cn('flex h-16 items-center justify-center rounded-2xl border bg-card text-2xl font-extrabold shadow-xs transition active:scale-95 disabled:opacity-40 sm:h-20', className)}>
      {children}
    </button>
  )
}

function Scorer({ match, setMatch }: { match: MatchDetail; setMatch: (m: MatchDetail) => void }) {
  const ctx = useScoringContext(match)
  const { live, innings, battingTeam } = ctx
  const [extra, setExtra] = useState<ExtraType | null>(null)
  const [wicketOpen, setWicketOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function act(action: () => Promise<MatchDetail>, message?: string) {
    setBusy(true)
    try {
      setMatch(await action())
      if (message) toast(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const score = (runs: number) => {
    void act(() => api.recordBall(match.id, { runs, extra }))
    setExtra(null)
  }

  const striker = ctx.batter(live.strikerId)
  const nonStriker = ctx.batter(live.nonStrikerId)
  const bowler = ctx.bowlerFigures(live.bowlerId)
  const blocked = busy || live.needsBatter || live.needsBowler || live.inningsComplete
  const overNumber = Math.floor(innings.legalBalls / 6) + 1

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {/* Scoreboard */}
      <div className="summer-gradient rounded-3xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between text-sm font-semibold text-white/90">
          <span>{battingTeam.name}</span>
          <span>{live.inningsIndex === 0 ? '1st innings' : '2nd innings'}</span>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="tabular text-5xl font-extrabold tracking-tight">{innings.runs}/{innings.wickets}</div>
          <div className="tabular pb-1 text-right text-sm">
            <div className="text-lg font-bold">{innings.overs} <span className="text-white/75">/ {match.overs} ov</span></div>
            <div className="text-white/85">CRR {innings.runRate.toFixed(2)}</div>
          </div>
        </div>
        {live.target && (
          <div className="mt-3 rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold backdrop-blur">
            Need {live.runsNeeded} off {live.ballsLeft} balls · RRR {live.requiredRunRate?.toFixed(2)}
          </div>
        )}
      </div>

      {/* Crease */}
      <div className="rounded-2xl border bg-card">
        {[{ entry: striker, id: live.strikerId, isStriker: true }, { entry: nonStriker, id: live.nonStrikerId, isStriker: false }].map(({ entry, id, isStriker }) => (
          <div key={isStriker ? 's' : 'n'} className={cn('flex items-center gap-3 px-4 py-2.5', !isStriker && 'border-t')}>
            <span className={cn('size-2 rounded-full', isStriker ? 'bg-primary' : 'bg-transparent')} />
            <span className={cn('flex-1 truncate', isStriker && 'font-bold')}>{id ? ctx.name(id) : <span className="text-muted-foreground">Select batter</span>}</span>
            <span className="tabular text-lg font-extrabold">{entry?.runs ?? 0}</span>
            <span className="tabular w-10 text-sm text-muted-foreground">({entry?.balls ?? 0})</span>
            <span className="tabular hidden w-16 text-right text-xs text-muted-foreground sm:block">{entry?.fours ?? 0}×4 {entry?.sixes ?? 0}×6</span>
          </div>
        ))}
        <div className="flex items-center gap-3 border-t bg-muted/40 px-4 py-2.5 text-sm">
          <span className="text-xs font-bold text-muted-foreground uppercase">Bowl</span>
          <span className="flex-1 truncate font-semibold">{live.bowlerId ? ctx.name(live.bowlerId) : 'Select bowler'}</span>
          <span className="tabular font-bold">{bowler ? `${bowler.overs}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : '0.0-0-0-0'}</span>
        </div>
      </div>

      {/* This over */}
      <div className="flex min-h-12 items-center gap-2 overflow-x-auto rounded-2xl border bg-card px-4 py-2">
        <span className="shrink-0 text-xs font-bold text-muted-foreground uppercase">Over {overNumber}</span>
        {live.currentOver.length ? live.currentOver.map((ball, i) => <BallChip key={i} label={ball} />)
          : <span className="text-sm text-muted-foreground">New over</span>}
      </div>

      {/* Extras toggles */}
      <div className="grid grid-cols-4 gap-2">
        {EXTRAS.map((option) => (
          <button key={option.value} type="button" disabled={blocked}
            onClick={() => setExtra((current) => (current === option.value ? null : option.value))}
            className={cn('h-11 rounded-xl border-2 text-sm font-extrabold transition disabled:opacity-40',
              extra === option.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/40')}>
            {option.label}
          </button>
        ))}
      </div>
      {extra && (
        <p className="text-center text-xs font-semibold text-primary">
          {extra === 'wide' || extra === 'noball' ? 'Tap runs taken (0 = just the extra)' : 'Tap runs taken'}
        </p>
      )}

      {/* Run pad */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 6].map((runs) => (
          <PadButton key={runs} onClick={() => score(runs)} disabled={blocked || ((extra === 'bye' || extra === 'legbye') && runs === 0)}
            className={cn(runs === 4 && 'border-sky/40 bg-sky/10 text-sky', runs === 6 && 'border-success/40 bg-success-soft text-success')}>
            {extra && runs === 0 ? EXTRAS.find((e) => e.value === extra)?.label : runs}
          </PadButton>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <PadButton onClick={() => setWicketOpen(true)} disabled={blocked} className="border-live/30 bg-live text-xl text-white">OUT</PadButton>
        <PadButton onClick={() => act(() => api.setCrease(match.id, { strikerId: live.nonStrikerId!, nonStrikerId: live.strikerId! }), 'Strike swapped')}
          disabled={busy || !live.strikerId || !live.nonStrikerId} className="text-base">
          <ArrowLeftRight className="mr-1.5 size-5" /> Swap
        </PadButton>
        <PadButton onClick={() => act(() => api.undoBall(match.id), 'Last ball undone')} disabled={busy || (!innings.overHistory.length && live.inningsIndex === 0)} className="text-base">
          <Undo2 className="mr-1.5 size-5" /> Undo
        </PadButton>
      </div>

      {wicketOpen && (
        <WicketDialog open ctx={ctx} extra={extra} onOpenChange={setWicketOpen}
          onConfirm={(ball) => { setWicketOpen(false); setExtra(null); void act(() => api.recordBall(match.id, ball)) }} />
      )}

      <PickerDialog
        open={live.needsBatter && !live.inningsComplete}
        title="Next batter"
        description={`Who comes in for ${battingTeam.name}?`}
        players={ctx.availableBatters}
        onPick={(player) => act(() => api.setCrease(match.id, live.strikerId ? { nonStrikerId: player.id } : { strikerId: player.id }))}
        footer={(
          <Button variant="ghost" size="sm" onClick={() => act(() => api.undoBall(match.id), 'Last ball undone')}>
            <Undo2 /> Undo last ball
          </Button>
        )}
      />
      <PickerDialog
        open={!live.needsBatter && live.needsBowler && !live.inningsComplete}
        title={`Bowler for over ${overNumber}`}
        description={live.previousBowlerId ? `${ctx.name(live.previousBowlerId)} bowled the last over.` : 'Who bowls next?'}
        players={ctx.bowlingXI.filter((p) => p.id !== live.previousBowlerId)}
        detail={(player) => {
          const figures = ctx.bowlerFigures(player.id)
          return figures ? `${figures.overs} ov · ${figures.wickets}/${figures.runs}` : ''
        }}
        onPick={(player) => act(() => api.setCrease(match.id, { bowlerId: player.id }))}
        footer={(
          <Button variant="ghost" size="sm" onClick={() => act(() => api.undoBall(match.id), 'Last ball undone')}>
            <Undo2 /> Undo last ball
          </Button>
        )}
      />
      {live.awaitingNextInnings && (
        <NextInningsDialog match={match} busy={busy} onStart={(crease) => act(() => api.nextInnings(match.id, crease), '2nd innings started')} />
      )}
    </div>
  )
}

function Finished({ match, setMatch }: { match: MatchDetail; setMatch: (m: MatchDetail) => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 text-center">
      <div className="summer-gradient rounded-3xl p-8 text-white shadow-lg">
        <Trophy className="mx-auto mb-3 size-12" />
        <div className="text-sm font-semibold text-white/85">{match.status === 'abandoned' ? 'Match abandoned' : 'Match over'}</div>
        <h2 className="mt-1 text-2xl font-extrabold">{match.result?.text}</h2>
        <div className="tabular mt-4 flex justify-center gap-6 text-sm">
          {match.innings.map((inn) => {
            const team = inn.battingTeamId === match.teamA.id ? match.teamA : match.teamB
            return <span key={team.id}><b>{team.shortName}</b> {inn.runs}/{inn.wickets} ({inn.overs})</span>
          })}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild><Link to={`/matches/${match.id}`}><ClipboardList /> Full scorecard</Link></Button>
        {match.tournamentShareCode && (
          <ShareDialog path={`/t/${match.tournamentShareCode}/m/${match.id}`} title="result"
            message={`${match.result?.text} — full scorecard:`} trigger={<Button variant="outline"><Share2 /> Share result</Button>} />
        )}
        {match.status === 'completed' && (
          <Button variant="ghost" onClick={async () => {
            try {
              setMatch(await api.undoBall(match.id))
              toast('Last ball undone')
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not undo')
            }
          }}><Undo2 /> Undo last ball</Button>
        )}
      </div>
    </div>
  )
}

export function ScorePage() {
  const { id = '' } = useParams()
  const { data: match, error, loading, reload, setData } = useApi(() => api.match(id), id)
  if (loading && !match) return <LoadingBlock />
  if (error || !match) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-xl items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back to match"><Link to={`/matches/${match.id}`}><ArrowLeft /></Link></Button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{match.teamA.shortName} vs {match.teamB.shortName}</div>
          <div className="truncate text-xs text-muted-foreground">{match.tournamentName ?? 'Friendly'}{match.title ? ` · ${match.title}` : ''}</div>
        </div>
        {match.status === 'live' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More"><MoreVertical /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link to={`/matches/${match.id}`}><ClipboardList /> Scorecard</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={async () => {
                if (!confirm('End this innings now (declared, rain, or time)?')) return
                try { setData(await api.endInnings(match.id)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
              }}>End innings</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={async () => {
                if (!confirm('Abandon this match (no result)?')) return
                try { setData(await api.abandonMatch(match.id)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
              }}>Abandon match</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {match.status === 'live' && match.live ? <Scorer match={match} setMatch={setData} />
        : match.status === 'upcoming' ? (
          <div className="mx-auto max-w-xl"><ErrorState message="This match hasn't started yet." />
            <Button asChild className="mt-3 w-full"><Link to={`/matches/${match.id}/start`}>Start match</Link></Button></div>
        ) : <Finished match={match} setMatch={setData} />}
    </>
  )
}
