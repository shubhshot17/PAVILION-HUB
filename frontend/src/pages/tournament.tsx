import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CalendarPlus, MoreHorizontal, Plus, Share2, Trash2, UserPlus } from 'lucide-react'
import { ErrorState, LoadingBlock, TeamBadge } from '@/components/common'
import { useAction } from '@/components/form'
import { ShareDialog } from '@/components/share-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import type { Team, TournamentDetail } from '@/lib/types'
import { TournamentHero, TournamentTabs } from '@/views/tournament-view'

function AddTeamsDialog({ tournament, onChange, onHero = false }: { tournament: TournamentDetail; onChange: (t: TournamentDetail) => void; onHero?: boolean }) {
  const [open, setOpen] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const { busy, run } = useAction()
  useEffect(() => {
    if (open) api.teams().then(setTeams).catch(() => setTeams([]))
  }, [open])
  const available = teams.filter((team) => !tournament.teamIds.includes(team.id))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={onHero ? 'secondary' : 'default'} className={onHero ? 'bg-white/95 text-foreground hover:bg-white' : undefined}>
          <UserPlus /> Add teams
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add teams</DialogTitle>
          <DialogDescription>Pick teams to take part in {tournament.name}.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-80 gap-1 overflow-y-auto">
          {available.map((team) => (
            <button key={team.id} type="button" disabled={busy}
              onClick={async () => {
                const updated = await run(() => api.addTournamentTeam(tournament.id, team.id), `${team.name} added`)
                if (updated) onChange(updated)
              }}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted disabled:opacity-50">
              <TeamBadge team={team} size="sm" />
              <span className="flex-1 text-sm font-semibold">{team.name}</span>
              <Plus className="size-4 text-primary" />
            </button>
          ))}
          {!available.length && <p className="py-4 text-center text-sm text-muted-foreground">All your teams are already in.</p>}
        </div>
        <Button asChild variant="outline"><Link to="/teams?new=1"><Plus /> Create a new team</Link></Button>
      </DialogContent>
    </Dialog>
  )
}

export function TournamentPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, error, loading, reload, setData } = useApi(() => api.tournament(id), id, { poll: 20000 })
  const { run } = useAction()

  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />

  const scheduleLink = `/matches/new?tournamentId=${data.id}`
  return (
    <>
      <TournamentHero
        tournament={data}
        actions={(
          <>
            <ShareDialog
              path={`/t/${data.shareCode}`}
              title={data.name}
              message={`Follow ${data.name} live — scores, points table and player stats:`}
              trigger={<Button className="bg-white text-primary shadow-md hover:bg-white/90"><Share2 /> Share link</Button>}
            />
            <AddTeamsDialog tournament={data} onChange={setData} onHero />
            <Button asChild variant="secondary" className="bg-white/95 text-foreground hover:bg-white">
              <Link to={scheduleLink}><CalendarPlus /> Schedule match</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="bg-white/25 text-white hover:bg-white/40" aria-label="More"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive" onSelect={async () => {
                  if (!confirm(`Delete ${data.name} and all of its matches? This cannot be undone.`)) return
                  const deleted = await run(async () => { await api.deleteTournament(data.id); return true }, 'Tournament deleted')
                  if (deleted) navigate('/tournaments')
                }}>
                  <Trash2 /> Delete tournament
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      />
      <TournamentTabs
        tournament={data}
        emptyMatchesAction={<Button asChild><Link to={scheduleLink}><CalendarPlus /> Schedule a match</Link></Button>}
        emptyTeamsAction={<AddTeamsDialog tournament={data} onChange={setData} />}
      />
    </>
  )
}
