import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Plus, Shield } from 'lucide-react'
import { EmptyState, ErrorState, LoadingBlock, PageHeader, TeamBadge } from '@/components/common'
import { Field, useAction } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export const TEAM_COLORS = ['#F97316', '#0EA5E9', '#16A34A', '#E11D48', '#8B5CF6', '#EAB308', '#14B8A6', '#EC4899', '#1E293B']

function CreateTeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { busy, run } = useAction()
  const [color, setColor] = useState(TEAM_COLORS[0])
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const preview = shortName || name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'ABC'

  async function submit(event: FormEvent) {
    event.preventDefault()
    const form = new FormData(event.target as HTMLFormElement)
    const created = await run(() => api.createTeam({
      name,
      shortName: shortName || undefined,
      color,
      city: String(form.get('city') ?? '').trim() || undefined,
    }), 'Team created')
    if (created) navigate(`/teams/${created.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New team</DialogTitle>
          <DialogDescription>Next you'll add the squad.</DialogDescription>
        </DialogHeader>
        <form id="team-form" onSubmit={submit} className="grid gap-4">
          <div className="flex items-center gap-4">
            <TeamBadge team={{ shortName: preview, color }} size="lg" />
            <Field label="Team name" htmlFor="team-name" className="flex-1">
              <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Mumbai Mavericks" autoFocus />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Short name" htmlFor="team-short" hint="Up to 5 letters">
              <Input id="team-short" value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 5))} placeholder={preview} />
            </Field>
            <Field label="City" htmlFor="team-city"><Input id="team-city" name="city" placeholder="Mumbai" /></Field>
          </div>
          <Field label="Team colour">
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((swatch) => (
                <button key={swatch} type="button" aria-label={`Colour ${swatch}`} onClick={() => setColor(swatch)}
                  className={cn('size-8 rounded-full ring-offset-2 transition', color === swatch && 'ring-2 ring-foreground')}
                  style={{ background: swatch }} />
              ))}
            </div>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="team-form" disabled={busy || !name.trim()}>Create team</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsPage() {
  const [params, setParams] = useSearchParams()
  const open = params.get('new') === '1'
  const setOpen = (value: boolean) => setParams(value ? { new: '1' } : {}, { replace: true })
  const { data, error, loading, reload } = useApi(api.teams, 'teams')

  return (
    <>
      <PageHeader
        title="Teams & players"
        description="Create teams once and use them in any tournament."
        actions={<Button onClick={() => setOpen(true)}><Plus /> New team</Button>}
      />
      {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={<Shield />} title="No teams yet" description="Add a team and its players to start scoring."
          action={<Button onClick={() => setOpen(true)}><Plus /> New team</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((team) => (
            <Link key={team.id} to={`/teams/${team.id}`}
              className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <TeamBadge team={team} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{team.name}</div>
                <div className="text-sm text-muted-foreground">{[team.city, `${team.playerCount ?? 0} players`].filter(Boolean).join(' · ')}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <CreateTeamDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
