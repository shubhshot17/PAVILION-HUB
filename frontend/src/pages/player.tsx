import { useParams } from 'react-router'
import { ErrorState, LoadingBlock } from '@/components/common'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { PlayerView } from '@/views/player-view'

export function PlayerPage() {
  const { id = '' } = useParams()
  const { data, error, loading, reload } = useApi(() => api.player(id), id)
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />
  return <PlayerView profile={data} />
}
