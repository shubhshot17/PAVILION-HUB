import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarDays, Plus } from 'lucide-react'
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/common'
import { MatchGrid } from '@/components/match-card'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Results' },
]

export function MatchesPage() {
  const [status, setStatus] = useState('')
  const { data, error, loading, reload } = useApi(() => api.matches({ status }), `matches-${status}`, { poll: 20000 })

  return (
    <>
      <PageHeader
        title="Matches"
        description="Schedule, score and follow every game."
        actions={<Button asChild><Link to="/matches/new"><Plus /> New match</Link></Button>}
      />
      <div className="mb-5 inline-flex rounded-xl bg-muted p-1">
        {FILTERS.map((filter) => (
          <button key={filter.value} type="button" onClick={() => setStatus(filter.value)}
            className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold transition', status === filter.value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {filter.label}
          </button>
        ))}
      </div>
      {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={<CalendarDays />} title="No matches here" description="Create a match between two teams to start scoring."
          action={<Button asChild><Link to="/matches/new"><Plus /> New match</Link></Button>} />
      ) : (
        <MatchGrid matches={data} />
      )}
    </>
  )
}
