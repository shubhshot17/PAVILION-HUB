import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Users } from 'lucide-react'
import { EmptyState, PlayerAvatar, SectionTitle, TeamBadge } from '@/components/common'
import { MatchGrid } from '@/components/match-card'
import { ROLE_LABEL } from '@/lib/format'
import { useLinks } from '@/lib/links'
import type { Player, TeamDetail } from '@/lib/types'

export function TeamView({ team, actions, playerActions, emptySquadAction }: {
  team: TeamDetail
  actions?: ReactNode
  playerActions?: (player: Player) => ReactNode
  emptySquadAction?: ReactNode
}) {
  const links = useLinks()
  const played = team.matches.filter((match) => match.status === 'completed')
  const won = played.filter((match) => match.result?.winnerId === team.id).length
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4 rounded-3xl border bg-card p-6 shadow-sm"
        style={{ backgroundImage: `linear-gradient(120deg, color-mix(in oklch, ${team.color} 12%, white) 0%, white 60%)` }}>
        <TeamBadge team={team} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[team.city, `${team.players.length} players`, played.length ? `Won ${won} of ${played.length}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      <section>
        <SectionTitle>Squad</SectionTitle>
        {team.players.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {team.players.map((player) => (
              <div key={player.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <PlayerAvatar name={player.name} color={team.color} size="sm" />
                <Link to={links.player(player.id)} className="min-w-0 flex-1 hover:text-primary">
                  <div className="truncate font-semibold">{player.name}</div>
                  <div className="text-xs text-muted-foreground">{ROLE_LABEL[player.role]}</div>
                </Link>
                {player.jerseyNumber !== undefined && <span className="tabular text-xs font-bold text-muted-foreground">#{player.jerseyNumber}</span>}
                {playerActions?.(player)}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Users />} title="No players yet" description="Add the squad so they can be picked in the playing XI." action={emptySquadAction} />
        )}
      </section>

      {team.matches.length > 0 && (
        <section>
          <SectionTitle>Matches</SectionTitle>
          <MatchGrid matches={team.matches} />
        </section>
      )}
    </div>
  )
}
