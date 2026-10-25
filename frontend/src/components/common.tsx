import type { ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { initials } from '@/lib/format'
import type { MatchStatus, Team } from '@/lib/types'
import { cn } from '@/lib/utils'

const badgeSizes = {
  sm: 'size-8 text-[10px]',
  md: 'size-11 text-xs',
  lg: 'size-16 text-base',
}

/** Round team crest: short name on the team colour. */
export function TeamBadge({ team, size = 'md', className }: { team: Pick<Team, 'shortName' | 'color'>; size?: keyof typeof badgeSizes; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-extrabold tracking-wide text-white shadow-sm ring-2 ring-white', badgeSizes[size], className)}
      style={{ background: team.color }}
    >
      {team.shortName.slice(0, 4)}
    </span>
  )
}

export function PlayerAvatar({ name, color, size = 'md' }: { name: string; color?: string; size?: keyof typeof badgeSizes }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold', badgeSizes[size])}
      style={{ background: `color-mix(in oklch, ${color ?? '#F2711C'} 16%, white)`, color: color ?? '#F2711C' }}
    >
      {initials(name)}
    </span>
  )
}

export function StatusBadge({ status }: { status: MatchStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-live/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-live">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-live" />
        </span>
        Live
      </span>
    )
  }
  const styles: Record<string, string> = {
    upcoming: 'bg-sky/10 text-sky',
    completed: 'bg-success-soft text-success',
    abandoned: 'bg-muted text-muted-foreground',
  }
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', styles[status])}>
      {status === 'completed' ? 'Result' : status}
    </span>
  )
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm font-medium text-primary">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 rounded-full bg-accent p-3 text-primary [&_svg]:size-6">{icon}</div>}
      <h3 className="font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="font-medium">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  )
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
    </div>
  )
}

export function StatTile({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card px-4 py-3', className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular mt-1 text-2xl font-extrabold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  )
}
