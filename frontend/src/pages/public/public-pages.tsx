/* Read-only pages behind a shared tournament link (/t/<code>/…). */

import { Link, useParams } from 'react-router'
import { ArrowLeft, Share2 } from 'lucide-react'
import { ErrorState, LoadingBlock } from '@/components/common'
import { ShareDialog } from '@/components/share-dialog'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { MatchBody, MatchHero } from '@/views/match-view'
import { PlayerView } from '@/views/player-view'
import { TeamView } from '@/views/team-view'
import { TournamentHero, TournamentTabs } from '@/views/tournament-view'

function BackToTournament() {
  const { code = '' } = useParams()
  return (
    <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
      <Link to={`/t/${code}`}><ArrowLeft /> Tournament</Link>
    </Button>
  )
}

export function PublicTournamentPage() {
  const { code = '' } = useParams()
  const { data, error, loading, reload } = useApi(() => api.tournamentByCode(code), code, { poll: 15000 })
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorState message={error ?? 'Tournament not found'} onRetry={reload} />
  return (
    <>
      <TournamentHero
        tournament={data}
        actions={(
          <ShareDialog path={`/t/${data.shareCode}`} title={data.name}
            message={`Follow ${data.name} live — scores, points table and player stats:`}
            trigger={<Button className="bg-white text-primary shadow-md hover:bg-white/90"><Share2 /> Share</Button>} />
        )}
      />
      <TournamentTabs tournament={data} />
    </>
  )
}

export function PublicMatchPage() {
  const { matchId = '', code = '' } = useParams()
  const { data, error, loading, reload } = useApi(() => api.match(matchId), matchId, { poll: 6000 })
  if (loading && !data) return <LoadingBlock />
  if (error || !data || data.tournamentShareCode !== code) {
    return <ErrorState message={error ?? 'Match not found'} onRetry={reload} />
  }
  return (
    <>
      <BackToTournament />
      <MatchHero match={data} />
      <MatchBody match={data} />
    </>
  )
}

export function PublicTeamPage() {
  const { teamId = '' } = useParams()
  const { data, error, loading, reload } = useApi(() => api.team(teamId), teamId)
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorState message={error ?? 'Team not found'} onRetry={reload} />
  return <><BackToTournament /><TeamView team={data} /></>
}

export function PublicPlayerPage() {
  const { playerId = '' } = useParams()
  const { data, error, loading, reload } = useApi(() => api.player(playerId), playerId)
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorState message={error ?? 'Player not found'} onRetry={reload} />
  return <><BackToTournament /><PlayerView profile={data} /></>
}
