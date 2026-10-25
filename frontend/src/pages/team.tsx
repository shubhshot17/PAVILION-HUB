import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Trash2, UserPlus } from 'lucide-react'
import { ErrorState, LoadingBlock } from '@/components/common'
import { Field, NativeSelect, useAction } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { PLAYER_ROLES, type PlayerRole, type TeamDetail } from '@/lib/types'
import { TeamView } from '@/views/team-view'

function AddPlayersDialog({ team, onAdded }: { team: TeamDetail; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const nameRef = useRef<HTMLInputElement>(null)
  const { busy, run } = useAction()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const jersey = String(form.get('jerseyNumber') ?? '')
    const player = await run(() => api.createPlayer({
      teamId: team.id,
      name: String(form.get('name')).trim(),
      role: form.get('role') as PlayerRole,
      jerseyNumber: jersey ? Number(jersey) : undefined,
      battingStyle: String(form.get('battingStyle') || '') || undefined,
      bowlingStyle: String(form.get('bowlingStyle') || '') || undefined,
    }))
    if (player) {
      setAdded((names) => [player.name, ...names])
      formElement.reset()
      nameRef.current?.focus()
      onAdded()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setAdded([]) }}>
      <DialogTrigger asChild>
        <Button><UserPlus /> Add players</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add players to {team.name}</DialogTitle>
          <DialogDescription>Press Enter to add — the form stays open for the next player.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Player name" htmlFor="p-name">
            <Input ref={nameRef} id="p-name" name="name" required maxLength={60} placeholder="Rohan Sharma" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role" htmlFor="p-role">
              <NativeSelect id="p-role" name="role" defaultValue="batter">
                {PLAYER_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Jersey no." htmlFor="p-jersey"><Input id="p-jersey" name="jerseyNumber" type="number" min={0} max={999} /></Field>
            <Field label="Batting" htmlFor="p-bat">
              <NativeSelect id="p-bat" name="battingStyle" defaultValue="Right-hand bat">
                <option>Right-hand bat</option><option>Left-hand bat</option>
              </NativeSelect>
            </Field>
            <Field label="Bowling" htmlFor="p-bowl">
              <NativeSelect id="p-bowl" name="bowlingStyle" defaultValue="">
                <option value="">Doesn't bowl</option>
                <option>Right-arm fast</option><option>Right-arm medium</option><option>Right-arm off-break</option>
                <option>Right-arm leg-break</option><option>Left-arm fast</option><option>Left-arm medium</option>
                <option>Left-arm orthodox</option><option>Left-arm wrist-spin</option>
              </NativeSelect>
            </Field>
          </div>
          <Button type="submit" disabled={busy}><UserPlus /> Add player</Button>
        </form>
        {added.length > 0 && (
          <div className="rounded-lg bg-success-soft px-3 py-2 text-sm">
            <span className="font-semibold text-success">Added:</span> {added.join(', ')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function TeamPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useApi(() => api.team(id), id)
  const { run } = useAction()

  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />

  return (
    <TeamView
      team={data}
      actions={(
        <>
          <AddPlayersDialog team={data} onAdded={reload} />
          <Button variant="outline" size="icon" aria-label="Delete team" onClick={async () => {
            if (!confirm(`Delete ${data.name} and its players?`)) return
            const deleted = await run(async () => { await api.deleteTeam(data.id); return true }, 'Team deleted')
            if (deleted) navigate('/teams')
          }}><Trash2 /></Button>
        </>
      )}
      emptySquadAction={<AddPlayersDialog team={data} onAdded={reload} />}
      playerActions={(player) => (
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${player.name}`} className="text-muted-foreground hover:text-destructive"
          onClick={async () => {
            if (!confirm(`Remove ${player.name}?`)) return
            if (await run(async () => { await api.deletePlayer(player.id); return true }, 'Player removed')) reload()
          }}>
          <Trash2 />
        </Button>
      )}
    />
  )
}
