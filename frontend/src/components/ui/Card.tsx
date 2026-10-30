import type { ReactNode } from 'react'
import clsx from 'clsx'

export const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={clsx('rounded-xl bg-white shadow-card', className)}>{children}</div>
)

export const CardHeader = ({ title, description, action }: { title: string; description?: string; action?: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
    <div>
      <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
      {description && <p className="text-[12px] text-muted">{description}</p>}
    </div>
    {action}
  </div>
)

export function StatCard({ label, value, icon, tone = 'accent', hint }: {
  label: string; value: ReactNode; icon: ReactNode; tone?: 'accent' | 'success' | 'danger' | 'neutral'; hint?: string
}) {
  const tones = { accent: 'bg-accent-50 text-accent-600', success: 'bg-emerald-50 text-emerald-600', danger: 'bg-red-50 text-red-600', neutral: 'bg-slate-100 text-slate-500' }
  return (
    <Card className="p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        <span className={clsx('flex size-8 items-center justify-center rounded-lg [&>svg]:size-4', tones[tone])}>{icon}</span>
      </div>
      <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      {hint && <p className="mt-2 text-[12px] text-muted">{hint}</p>}
    </Card>
  )
}
