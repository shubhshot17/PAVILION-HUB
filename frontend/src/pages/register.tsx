import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import { Field, useAction } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

function validate(values: { name: string; email: string; password: string; confirmPassword: string }): FormErrors {
  const errors: FormErrors = {}
  if (!values.name.trim()) errors.name = 'Full name is required.'
  else if (values.name.trim().length > 80) errors.name = 'Full name must be at most 80 characters.'

  if (!values.email.trim()) errors.email = 'Email address is required.'
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid email address.'

  if (!values.password) errors.password = 'Password is required.'
  else if (values.password.length < 8) errors.password = 'Password must be at least 8 characters.'
  else if (values.password.length > 100) errors.password = 'Password must be at most 100 characters.'

  if (!values.confirmPassword) errors.confirmPassword = 'Please confirm your password.'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.'
  return errors
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState('')
  const { busy, run } = useAction()

  const set = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setServerError('')
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const result = await run(async () => {
      try {
        return await api.register({
          name: values.name,
          email: values.email,
          password: values.password,
          confirmPassword: values.confirmPassword,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Registration failed'
        setServerError(message)
        throw error
      }
    }, 'Account created — welcome to PAVILION HUB!')

    if (result) {
      setValues({ name: '', email: '', password: '', confirmPassword: '' })
      navigate('/')
    }
  }

  const fieldClass = (hasError?: string) =>
    cn(hasError && 'border-destructive focus-visible:ring-destructive/30')

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-8 sm:py-12">
      <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign up to score matches and run tournaments.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-busy={busy}>
          <Field label="Full name" htmlFor="name">
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Rohan Mehta"
              value={values.name}
              onChange={set('name')}
              className={fieldClass(errors.name)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
          </Field>

          <Field label="Email address" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={values.email}
              onChange={set('email')}
              className={fieldClass(errors.email)}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <p className="text-xs font-medium text-destructive">{errors.email}</p>}
          </Field>

          <Field label="Password" htmlFor="password" hint="At least 8 characters.">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={values.password}
              onChange={set('password')}
              className={fieldClass(errors.password)}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password && <p className="text-xs font-medium text-destructive">{errors.password}</p>}
          </Field>

          <Field label="Confirm password" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={values.confirmPassword}
              onChange={set('confirmPassword')}
              className={fieldClass(errors.confirmPassword)}
              aria-invalid={Boolean(errors.confirmPassword)}
            />
            {errors.confirmPassword && <p className="text-xs font-medium text-destructive">{errors.confirmPassword}</p>}
          </Field>

          {serverError && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <Button type="submit" className="mt-2 w-full" size="lg" disabled={busy}>
            {busy && <LoaderCircle className="mr-2 size-4 animate-spin" />}
            {busy ? 'Creating account…' : 'Register'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
