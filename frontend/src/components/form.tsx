import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-semibold">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Runs an async action with a busy flag; failures become an error toast. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
    setBusy(true)
    try {
      const result = await action()
      if (success) toast.success(success)
      return result
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

/** Native select styled like the shadcn inputs — simple and reliable on phones. */
export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
