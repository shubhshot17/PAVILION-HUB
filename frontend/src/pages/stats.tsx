import { ErrorState, LoadingBlock, PageHeader } from '@/components/common'
import { Leaderboards } from '@/components/leaderboards'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'

export function StatsPage() {
  const { data, error, loading, reload } = useApi(api.leaders, 'leaders', { poll: 30000 })
  return (
    <>
      <PageHeader title="Stats" description="Top performers across every match. Open a tournament for its own leaderboard." />
      {loading && !data ? <LoadingBlock /> : error || !data ? <ErrorState message={error ?? 'No data'} onRetry={reload} /> : <Leaderboards leaders={data} />}
    </>
  )
}
