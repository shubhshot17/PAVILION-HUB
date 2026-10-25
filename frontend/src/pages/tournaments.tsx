import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { MapPin, Plus, Trophy } from 'lucide-react'
import { EmptyState, ErrorState, LoadingBlock, PageHeader, TeamBadge } from '@/components/common'
import { Field, useAction } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import type { Team } from '@/lib/types'

function CreateTournamentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { busy, run } = useAction()
  const [teams, setTeams] = useState<Team[]>([])
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (open) api.teams().then(setTeams).catch(() => setTeams([]))
  }, [open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (key: string) => String(form.get(key) ?? '').trim() || undefined
    const created = await run(() => api.createTournament({
      name: value('name'),
      season: value('season'),
      city: value('city'),
      ground: value('ground'),
      overs: Number(form.get('overs')) || 20,
      startDate: value('startDate') && new Date(value('startDate')!).toISOString(),
      endDate: value('endDate') && new Date(value('endDate')!).toISOString(),
      teamIds: selected,
    }), 'Tournament created')
    if (created) navigate(`/tournaments/${created.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New tournament</DialogTitle>
          <DialogDescription>You can add teams and schedule matches afterwards too.</DialogDescription>
        </DialogHeader>
        <form id="tournament-form" onSubmit={submit} className="grid gap-4">
          <Field label="Tournament name" htmlFor="t-name">
            <Input id="t-name" name="name" required maxLength={80} placeholder="Summer Premier League" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Season" htmlFor="t-season"><Input id="t-season" name="season" placeholder={String(new Date().getFullYear())} /></Field>
            <Field label="Overs per innings" htmlFor="t-overs"><Input id="t-overs" name="overs" type="number" min={1} max={50} defaultValue={20} required /></Field>
            <Field label="City" htmlFor="t-city"><Input id="t-city" name="city" placeholder="Mumbai" /></Field>
            <Field label="Ground" htmlFor="t-ground"><Input id="t-ground" name="ground" placeholder="Central Maidan" /></Field>
            <Field label="Starts" htmlFor="t-start"><Input id="t-start" name="startDate" type="date" /></Field>
            <Field label="Ends" htmlFor="t-end"><Input id="t-end" name="endDate" type="date" /></Field>
          </div>
          {teams.length > 0 && (
            <Field label="Teams">
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border p-2">
                {teams.map((team) => (
                  <label key={team.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                    <Checkbox
                      checked={selected.includes(team.id)}
                      onCheckedChange={(checked) => setSelected((ids) => checked ? [...ids, team.id] : ids.filter((id) => id !== team.id))}
                    />
                    <TeamBadge team={team} size="sm" />
                    <span className="text-sm font-medium">{team.name}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="tournament-form" disabled={busy}>Create tournament</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TournamentsPage() {
  const [params, setParams] = useSearchParams()
  const open = params.get('new') === '1'
  const setOpen = (value: boolean) => setParams(value ? { new: '1' } : {}, { replace: true })
  const { data, error, loading, reload } = useApi(api.tournaments, 'tournaments')

  return (
    <>
      <PageHeader
        title="Tournaments"
        description="Leagues and cups you run. Each one gets a public link to share."
        actions={<Button onClick={() => setOpen(true)}><Plus /> New tournament</Button>}
      />
      {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={<Trophy />} title="No tournaments yet" description="Create your first tournament, add teams and start scoring."
          action={<Button onClick={() => setOpen(true)}><Plus /> New tournament</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((tournament) => (
            <Link key={tournament.id} to={`/tournaments/${tournament.id}`}
              className="group overflow-hidden rounded-2xl border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="summer-gradient relative h-20 px-5 pt-4 text-white">
                <Trophy className="absolute right-4 bottom-2 size-12 opacity-25" />
                {(tournament.liveCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-bold uppercase">
                    <span className="size-1.5 animate-pulse rounded-full bg-white" /> Live
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="truncate text-lg font-extrabold group-hover:text-primary">{tournament.name}</h3>
                {(tournament.city || tournament.ground) && (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" /> {[tournament.ground, tournament.city].filter(Boolean).join(', ')}
                  </p>
                )}
                <div className="mt-4 flex gap-4 text-sm">
                  <span><b className="tabular">{tournament.teamCount}</b> <span className="text-muted-foreground">teams</span></span>
                  <span><b className="tabular">{tournament.matchCount}</b> <span className="text-muted-foreground">matches</span></span>
                  <span><b className="tabular">{tournament.overs}</b> <span className="text-muted-foreground">overs</span></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <CreateTournamentDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
