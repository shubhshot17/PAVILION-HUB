import { Link } from 'react-router'
import { ArrowRight, CalendarDays, Plus, Radio, Shield, Trophy, Users } from 'lucide-react'
import { EmptyState, ErrorState, LoadingBlock, SectionTitle } from '@/components/common'
import { MatchGrid } from '@/components/match-card'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'

const QUICK_ACTIONS = [
  { to: '/tournaments?new=1', label: 'Create tournament', icon: Trophy },
  { to: '/matches/new', label: 'Start a match', icon: Radio },
  { to: '/teams?new=1', label: 'Add a team', icon: Shield },
]

export function HomePage() {
  const { data, error, loading, reload } = useApi(api.dashboard, 'dashboard', { poll: 15000 })

  return (
    <div className="space-y-8">
      <div className="summer-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -top-10 -right-10 size-56 rounded-full bg-yellow-200/40 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-semibold text-white/85">Welcome back 👋</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Score it. Share it. Live.</h1>
          <p className="mt-2 max-w-xl text-white/90">
            Run your tournament, score ball by ball, and share one link with your WhatsApp group for live scores, the points table and player stats.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button key={action.to} asChild variant="secondary" className="bg-white/95 font-semibold text-foreground hover:bg-white">
                <Link to={action.to}><action.icon className="text-primary" />{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading && !data ? <LoadingBlock /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Tournaments', value: data.counts.tournaments, icon: Trophy, to: '/tournaments' },
              { label: 'Matches', value: data.counts.matches, icon: CalendarDays, to: '/matches' },
              { label: 'Teams', value: data.counts.teams, icon: Shield, to: '/teams' },
              { label: 'Players', value: data.counts.players, icon: Users, to: '/teams' },
            ].map((tile) => (
              <Link key={tile.label} to={tile.to} className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
                <span className="rounded-xl bg-accent p-2.5 text-primary"><tile.icon className="size-5" /></span>
                <span>
                  <span className="tabular block text-2xl font-extrabold leading-none">{tile.value}</span>
                  <span className="text-xs font-medium text-muted-foreground">{tile.label}</span>
                </span>
              </Link>
            ))}
          </div>

          {data.live.length > 0 && (
            <section>
              <SectionTitle>
                <span className="flex items-center gap-2"><span className="size-2.5 animate-pulse rounded-full bg-live" />Live now</span>
              </SectionTitle>
              <MatchGrid matches={data.live} />
            </section>
          )}

          <section>
            <SectionTitle action={<Button asChild variant="ghost" size="sm"><Link to="/matches">All matches <ArrowRight /></Link></Button>}>
              Upcoming
            </SectionTitle>
            {data.upcoming.length
              ? <MatchGrid matches={data.upcoming} />
              : <EmptyState icon={<CalendarDays />} title="Nothing scheduled" description="Schedule a match to get started."
                action={<Button asChild><Link to="/matches/new"><Plus /> New match</Link></Button>} />}
          </section>

          {data.recent.length > 0 && (
            <section>
              <SectionTitle>Recent results</SectionTitle>
              <MatchGrid matches={data.recent} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
