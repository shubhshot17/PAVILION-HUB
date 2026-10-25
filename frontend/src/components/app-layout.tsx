import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { BarChart3, CalendarDays, Home, Plus, Shield, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarRail, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/tournaments', label: 'Tournaments', icon: Trophy },
  { to: '/matches', label: 'Matches', icon: CalendarDays },
  { to: '/teams', label: 'Teams & players', icon: Shield },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
]

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="summer-gradient flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M7 5.5c2.5 3 2.5 10 0 13M17 5.5c-2.5 3-2.5 10 0 13" strokeDasharray="1.5 2.5" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold tracking-tight">PAVILION HUB</span>
          <span className="block text-[11px] font-medium text-muted-foreground">Cricket scoring</span>
        </span>
      )}
    </span>
  )
}

function NavItems() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      {NAV.map((item) => {
        const active = item.end ? pathname === item.to : pathname.startsWith(item.to)
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.label} size="lg"
              className="font-semibold data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
              <NavLink to={item.to} end={item.end} onClick={() => setOpenMobile(false)}>
                <item.icon />
                <span>{item.label}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function AppSidebar() {
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-3 pt-4">
        <Link to="/" className="flex items-center group-data-[collapsible=icon]:justify-center" onClick={() => setOpenMobile(false)}>
          <span className="group-data-[collapsible=icon]:hidden"><Logo /></span>
          <span className="hidden group-data-[collapsible=icon]:block"><Logo compact /></span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent><NavItems /></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Button asChild className="w-full shadow-sm group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
          <Link to="/matches/new" onClick={() => setOpenMobile(false)}>
            <Plus />
            <span className="group-data-[collapsible=icon]:hidden">Start a match</span>
          </Link>
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Link to="/" className="md:hidden"><Logo /></Link>
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
