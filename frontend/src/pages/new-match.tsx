import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import { EmptyState, PageHeader, TeamBadge } from '@/components/common'
import { Field, NativeSelect, useAction } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { toLocalInput } from '@/lib/format'
import type { Team, Tournament } from '@/lib/types'

export function NewMatchPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [tournamentId, setTournamentId] = useState(params.get('tournamentId') ?? '')
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [overs, setOvers] = useState(20)
  const { busy, run } = useAction()

  useEffect(() => {
    api.teams().then(setTeams).catch(() => setTeams([]))
    api.tournaments().then(setTournaments).catch(() => setTournaments([]))
  }, [])

  const tournament = tournaments.find((t) => t.id === tournamentId)
  useEffect(() => {
    if (tournament) setOvers(tournament.overs)
  }, [tournament])

  const choices = useMemo(() => {
    if (!teams) return []
    return tournament?.teamIds.length ? teams.filter((team) => tournament.teamIds.includes(team.id)) : teams
  }, [teams, tournament])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const startNow = (event.nativeEvent as SubmitEvent).submitter?.dataset.later === undefined
    const form = new FormData(event.currentTarget)
    const match = await run(() => api.createMatch({
      tournamentId: tournamentId || undefined,
      teamAId,
      teamBId,
      overs,
      title: String(form.get('title') ?? '').trim() || undefined,
      venue: String(form.get('venue') ?? '').trim() || undefined,
      date: new Date(String(form.get('date'))).toISOString(),
    }), 'Match created')
    if (match) navigate(startNow ? `/matches/${match.id}/start` : `/matches/${match.id}`)
  }

  if (teams && teams.length < 2) {
    return (
      <>
        <PageHeader title="New match" />
        <EmptyState title="You need two teams first" description="Create both teams and add their players, then come back."
          action={<Button asChild><Link to="/teams?new=1"><Plus /> Create a team</Link></Button>} />
      </>
    )
  }

  const teamA = choices.find((team) => team.id === teamAId)
  const teamB = choices.find((team) => team.id === teamBId)
  return (
    <>
      <PageHeader title="New match" description="Pick the teams, then do the toss and choose the playing XI." />
      <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <Field label="Tournament" htmlFor="m-tournament" hint="Leave as friendly for a one-off game.">
          <NativeSelect id="m-tournament" value={tournamentId} onChange={(e) => setTournamentId(e.target.value)}>
            <option value="">Friendly match</option>
            {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </Field>

        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Field label="Team A" htmlFor="m-team-a">
            <div className="flex items-center gap-2">
              {teamA && <TeamBadge team={teamA} size="sm" />}
              <NativeSelect id="m-team-a" required value={teamAId} onChange={(e) => setTeamAId(e.target.value)}>
                <option value="" disabled>Select team</option>
                {choices.map((team) => <option key={team.id} value={team.id} disabled={team.id === teamBId}>{team.name}</option>)}
              </NativeSelect>
            </div>
          </Field>
          <span className="hidden pb-2.5 text-center text-xs font-extrabold text-muted-foreground sm:block">VS</span>
          <Field label="Team B" htmlFor="m-team-b">
            <div className="flex items-center gap-2">
              {teamB && <TeamBadge team={teamB} size="sm" />}
              <NativeSelect id="m-team-b" required value={teamBId} onChange={(e) => setTeamBId(e.target.value)}>
                <option value="" disabled>Select team</option>
                {choices.map((team) => <option key={team.id} value={team.id} disabled={team.id === teamAId}>{team.name}</option>)}
              </NativeSelect>
            </div>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Overs" htmlFor="m-overs">
            <Input id="m-overs" type="number" min={1} max={50} value={overs} onChange={(e) => setOvers(Number(e.target.value))} required />
          </Field>
          <Field label="Date & time" htmlFor="m-date" className="sm:col-span-2">
            <Input id="m-date" name="date" type="datetime-local" defaultValue={toLocalInput(new Date().toISOString())} required />
          </Field>
          <Field label="Venue" htmlFor="m-venue" className="sm:col-span-2">
            <Input key={tournament?.id ?? 'friendly'} id="m-venue" name="venue" defaultValue={tournament?.ground ?? ''} placeholder="Ground name" />
          </Field>
          <Field label="Match name" htmlFor="m-title">
            <Input id="m-title" name="title" placeholder="Match 1, Final…" />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" size="lg" disabled={busy}>Create & start scoring</Button>
          <Button type="submit" size="lg" variant="outline" disabled={busy} data-later>Schedule for later</Button>
        </div>
      </form>
    </>
  )
}
