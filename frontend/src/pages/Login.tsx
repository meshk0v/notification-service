import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getErrorMessage } from '../utils/errors'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Form'

export default function Login() {
  const { employee, login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (employee) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-accent-100),transparent)] opacity-70" />
      <div className="w-full max-w-sm animate-pop-in">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-accent-600 text-white shadow-pop">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 19V5l12 14V5" /></svg>
          </span>
          <h1 className="text-[22px] font-semibold tracking-tight">Вход в Notification Service</h1>
          <p className="mt-1 text-[13px] text-muted">Панель управления рассылками</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-pop">
          {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div>}
          <Field label="Логин" htmlFor="username">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input id="username" className="pl-9" autoFocus autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </Field>
          <Field label="Пароль" htmlFor="password">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input id="password" type="password" className="pl-9" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!username || !password}>Войти</Button>
        </form>
      </div>
    </div>
  )
}
