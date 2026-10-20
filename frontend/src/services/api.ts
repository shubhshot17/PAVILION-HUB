
/* ============================================================
   PAVILION HUB — Fake API layer (demo data, deliberately slow)
   ------------------------------------------------------------
   This simulates a real backend: it returns the same shape of
   data a server would, but after a short delay so the loading
   skeletons in the UI are visible.

   When the real backend exists, only this file changes — the
   components keep working as-is.
   ============================================================ */

import type { DashboardData } from '../types'
import { DEMO_MATCHES, DEMO_STANDINGS } from '../data/demoData'

/** Simulate network latency so loading/empty states can be demoed. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchDashboardData(): Promise<DashboardData> {
  await delay(700) // pretend we're fetching from a server

  return {
    liveMatches: DEMO_MATCHES.filter((m) => m.status === 'live'),
    upcoming: DEMO_MATCHES.filter((m) => m.status === 'upcoming'),
    recent: DEMO_MATCHES.filter((m) => m.status === 'completed'),
    standings: DEMO_STANDINGS,
  }
}
