import { Link, useNavigate, useParams } from 'react-router'
import { Ban, Play, Radio, Share2, Trash2 } from 'lucide-react'
import { ErrorState, LoadingBlock } from '@/components/common'
import { useAction } from '@/components/form'
import { ShareDialog } from '@/components/share-dialog'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { MatchBody, MatchHero } from '@/views/match-view'

export function MatchPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: match, error, loading, reload, setData } = useApi(() => api.match(id), id, { poll: 8000 })
  const { busy, run } = useAction()

  if (loading && !match) return <LoadingBlock />
  if (error || !match) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />

  const title = `${match.teamA.shortName} vs ${match.teamB.shortName}`
  return (
    <>
      <MatchHero
        match={match}
        actions={(
          <>
            {match.status === 'upcoming' && (
              <Button size="sm" asChild><Link to={`/matches/${match.id}/start`}><Play /> Start match</Link></Button>
            )}
            {match.status === 'live' && (
              <Button size="sm" asChild><Link to={`/matches/${match.id}/score`}><Radio /> Score live</Link></Button>
            )}
            {match.tournamentShareCode && (
              <ShareDialog
                path={`/t/${match.tournamentShareCode}/m/${match.id}`}
                title={title}
                message={`${match.teamA.name} vs ${match.teamB.name} — follow the scorecard live:`}
                trigger={<Button size="sm" variant="outline"><Share2 /> Share</Button>}
              />
            )}
            {(match.status === 'upcoming' || match.status === 'live') && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={async () => {
                if (!confirm('Mark this match as abandoned (no result)?')) return
                const updated = await run(() => api.abandonMatch(match.id), 'Match abandoned')
                if (updated) setData(updated)
              }}><Ban /> Abandon</Button>
            )}
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={busy} aria-label="Delete match"
              onClick={async () => {
                if (!confirm('Delete this match and its scorecard?')) return
                const deleted = await run(async () => { await api.deleteMatch(match.id); return true }, 'Match deleted')
                if (deleted) navigate(match.tournamentId ? `/tournaments/${match.tournamentId}` : '/matches')
              }}><Trash2 /></Button>
          </>
        )}
      />
      <MatchBody match={match} />
    </>
  )
}
