import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { AppLayout } from '@/components/app-layout'
import { EmptyState } from '@/components/common'
import { PublicLayout } from '@/components/public-layout'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HomePage } from '@/pages/home'
import { MatchPage } from '@/pages/match'
import { MatchesPage } from '@/pages/matches'
import { NewMatchPage } from '@/pages/new-match'
import { PlayerPage } from '@/pages/player'
import { PublicMatchPage, PublicPlayerPage, PublicTeamPage, PublicTournamentPage } from '@/pages/public/public-pages'
import { ScorePage } from '@/pages/score'
import { StartMatchPage } from '@/pages/start-match'
import { StatsPage } from '@/pages/stats'
import { TeamPage } from '@/pages/team'
import { TeamsPage } from '@/pages/teams'
import { TournamentPage } from '@/pages/tournament'
import { TournamentsPage } from '@/pages/tournaments'

function NotFound() {
  return <EmptyState title="Page not found" action={<Button asChild><Link to="/">Go home</Link></Button>} />
}

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="tournaments" element={<TournamentsPage />} />
            <Route path="tournaments/:id" element={<TournamentPage />} />
            <Route path="matches" element={<MatchesPage />} />
            <Route path="matches/new" element={<NewMatchPage />} />
            <Route path="matches/:id" element={<MatchPage />} />
            <Route path="matches/:id/start" element={<StartMatchPage />} />
            <Route path="matches/:id/score" element={<ScorePage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="teams/:id" element={<TeamPage />} />
            <Route path="players/:id" element={<PlayerPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="t/:code" element={<PublicLayout />}>
            <Route index element={<PublicTournamentPage />} />
            <Route path="m/:matchId" element={<PublicMatchPage />} />
            <Route path="team/:teamId" element={<PublicTeamPage />} />
            <Route path="p/:playerId" element={<PublicPlayerPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </TooltipProvider>
  )
}
