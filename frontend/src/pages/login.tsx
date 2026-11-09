import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { LoaderCircle, Lock } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, useAction } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const { busy, run } = useAction()

  const clearError = (field: 'email' | 'password') =>
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }))

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'Email address is required.'
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Password is required.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    await run(async () => {
      try {
        await login(email.trim(), password, remember)
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed'
        // Wrong credentials map to the fields; anything else shows as a form error.
        if (/incorrect email or password/i.test(message)) next.password = message
        else next.form = message
        setErrors(next)
        throw err
      }
    })

    if (!next.password && !next.form) {
      setEmail('')
      setPassword('')
      navigate('/')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-8 sm:py-12">
      <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <span className="summer-gradient mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl text-white shadow-sm">
            <Lock className="size-6" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back to PAVILION HUB.</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-busy={busy}>
          <Field label="Email address" htmlFor="login-email">
            <Input
              id="login-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError('email') }}
              className={errors.email ? 'border-destructive focus-visible:ring-destructive/30' : undefined}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <p className="text-xs font-medium text-destructive">{errors.email}</p>}
          </Field>

          <Field label="Password" htmlFor="login-password">
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError('password') }}
              className={errors.password ? 'border-destructive focus-visible:ring-destructive/30' : undefined}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password && <p className="text-xs font-medium text-destructive">{errors.password}</p>}
          </Field>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
              />
              <Label htmlFor="remember" className="text-sm font-medium">Keep me signed in</Label>
            </div>
            <button
              type="button"
              onClick={() => setErrors((current) => ({ ...current, form: undefined }))}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline cursor-help"
              title="Password recovery is not available yet"
            >
              Forgot password?
            </button>
          </div>

          {errors.form && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errors.form}
            </div>
          )}
          <p className="rounded-xl bg-muted px-4 py-2.5 text-xs text-muted-foreground">
            Heads up: password recovery isn't built yet. Contact your tournament admin to reset your password manually.
          </p>

          <Button type="submit" className="mt-2 w-full" size="lg" disabled={busy}>
            {busy && <LoaderCircle className="mr-2 size-4 animate-spin" />}
            {busy ? 'Signing in…' : 'Log in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to PAVILION HUB?{' '}
          <Link to="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
