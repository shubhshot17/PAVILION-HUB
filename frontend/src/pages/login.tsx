import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import { Field, useAction } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { busy, run } = useAction()

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return setError('Email address is required.')
    if (!EMAIL_PATTERN.test(email.trim())) return setError('Enter a valid email address.')
    if (!password) return setError('Password is required.')

    const result = await run(async () => {
      try {
        return await api.login({ email, password })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed')
        throw err
      }
    }, 'Signed in — welcome back!')

    if (result) {
      setEmail('')
      setPassword('')
      setError('')
      navigate('/')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-8 sm:py-12">
      <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
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
              onChange={(e) => { setEmail(e.target.value); setError('') }}
            />
          </Field>

          <Field label="Password" htmlFor="login-password">
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
            />
          </Field>

          {error && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className={cn('mt-2 w-full')} size="lg" disabled={busy}>
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
