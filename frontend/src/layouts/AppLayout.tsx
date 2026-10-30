import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronRight, FileText, LayoutDashboard, LogOut, Menu, Megaphone, Settings, Tags, Users, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Feedback'
import { IconButton } from '../components/ui/Button'

const nav = [
  { to: '/', label: 'Обзор', icon: LayoutDashboard, end: true },
  { to: '/campaigns', label: 'Кампании', icon: Megaphone },
  { to: '/users', label: 'Пользователи', icon: Users },
  { to: '/groups', label: 'Группы', icon: Tags },
  { to: '/templates', label: 'Шаблоны', icon: FileText },
]

const titles: Record<string, string> = {
  '': 'Обзор', campaigns: 'Кампании', users: 'Пользователи', groups: 'Группы', templates: 'Шаблоны',
}

function useCrumbs() {
  const { pathname } = useLocation()
  const [root, second] = pathname.split('/').filter(Boolean)
  const title = titles[root ?? ''] ?? 'Notification Service'
  const crumbs: { label: string; to?: string }[] = []
  if (root === 'campaigns' && second) {
    crumbs.push({ label: 'Кампании', to: '/campaigns' })
    crumbs.push({ label: second === 'new' ? 'Новая кампания' : `Кампания #${second}` })
  }
  return { title, crumbs }
}

const ActionsCtx = createContext<HTMLElement | null>(null)

/** Рендерит children в правой части верхней панели. */
export function TopbarActions({ children }: { children: ReactNode }) {
  const el = useContext(ActionsCtx)
  return el ? createPortal(children, el) : null
}

export function ProtectedRoute() {
  const { employee, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="flex h-screen items-center justify-center"><Spinner className="size-6" /></div>
  if (!employee) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <AppLayout />
}

function AppLayout() {
  const { employee, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { title, crumbs } = useCrumbs()
  const [drawer, setDrawer] = useState(false)
  const [profile, setProfile] = useState(false)
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null)

  useEffect(() => setDrawer(false), [pathname])

  const doLogout = () => { logout(); navigate('/login', { replace: true }) }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex h-14 items-center gap-2.5 px-5">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-600 text-white">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 19V5l12 14V5" /></svg>
        </span>
        <span className="text-[14px] font-semibold tracking-tight">Уведомления</span>
      </Link>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => clsx('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
              isActive ? 'bg-accent-50 text-accent-700' : 'text-slate-600 hover:bg-slate-100 hover:text-ink')}>
            <Icon className="size-4" />{label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-line p-3">
        <button onClick={() => setProfile(true)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink">
          <Settings className="size-4" />Профиль
        </button>
        <button onClick={doLogout} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600">
          <LogOut className="size-4" />Выйти
        </button>
      </div>
    </div>
  )

  return (
    <ActionsCtx.Provider value={actionsEl}>
      <div className="min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-white lg:block">{sidebar}</aside>

        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={() => setDrawer(false)} />
            <aside className="relative h-full w-64 animate-slide-in bg-white shadow-pop">{sidebar}</aside>
          </div>
        )}

        <div className="lg:pl-60">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/80 px-4 backdrop-blur sm:px-6">
            <IconButton className="lg:hidden" aria-label="Меню" onClick={() => setDrawer((d) => !d)}>
              {drawer ? <X className="size-4" /> : <Menu className="size-4" />}
            </IconButton>
            <div className="flex min-w-0 items-center gap-1.5 text-[14px]">
              {crumbs.length === 0 ? (
                <h1 className="truncate font-semibold tracking-tight">{title}</h1>
              ) : crumbs.map((c, i) => (
                <span key={c.label} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="size-3.5 text-slate-300" />}
                  {c.to ? <Link to={c.to} className="text-muted hover:text-ink">{c.label}</Link>
                    : <h1 className="truncate font-semibold tracking-tight">{c.label}</h1>}
                </span>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div ref={setActionsEl} className="flex items-center gap-2" />
              <button onClick={() => setProfile(true)} className="hidden items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-100 sm:flex">
                <Avatar name={employee!.username} />
                <span className="text-[13px] font-medium">{employee!.username}</span>
              </button>
            </div>
          </header>
          <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>
        </div>
      </div>

      <Modal open={profile} onClose={() => setProfile(false)} title="Профиль сотрудника">
        <div className="flex items-center gap-3">
          <Avatar name={employee!.username} size="lg" />
          <div>
            <p className="font-medium">{employee!.username}</p>
            <p className="text-[12px] text-muted">ID {employee!.id} · {employee!.is_active ? 'Активен' : 'Отключён'}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-[12.5px] text-muted">
          Данные учётной записи доступны только для чтения: API не предоставляет изменение профиля и пароля.
          Новых сотрудников создаёт администратор командой <code className="font-mono">python -m app.modules.auth.create_employee</code>.
        </p>
      </Modal>
    </ActionsCtx.Provider>
  )
}
