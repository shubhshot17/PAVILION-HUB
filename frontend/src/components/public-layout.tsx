import { Link, Outlet, useParams } from 'react-router'
import { Logo } from '@/components/app-layout'
import { LinksContext, publicLinks } from '@/lib/links'

/** Read-only pages opened from a shared tournament link — no admin controls. */
export function PublicLayout() {
  const { code = '' } = useParams()
  return (
    <LinksContext.Provider value={publicLinks(code)}>
      <div className="min-h-svh">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link to={`/t/${code}`}><Logo /></Link>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Live scores</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6">
          <Outlet />
        </main>
        <footer className="pb-8 text-center text-xs text-muted-foreground">Scored with PAVILION HUB</footer>
      </div>
    </LinksContext.Provider>
  )
}
