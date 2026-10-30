import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { Tone } from '../../utils/labels'
import { initials } from '../../utils/format'

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  accent: 'bg-accent-50 text-accent-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
}
const dots: Record<Tone, string> = {
  neutral: 'bg-slate-400', accent: 'bg-accent-500', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500',
}

export function Badge({ tone = 'neutral', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium', tones[tone])}>
      {dot && <span className={clsx('size-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  )
}

export const TagPill = ({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-600">
    {children}
    {onRemove && <button type="button" onClick={onRemove} aria-label="Убрать" className="-mr-0.5 text-slate-400 hover:text-slate-700">×</button>}
  </span>
)

export const Avatar = ({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) => (
  <span className={clsx('inline-flex shrink-0 items-center justify-center rounded-full bg-accent-50 font-semibold text-accent-700',
    size === 'lg' ? 'size-10 text-[14px]' : 'size-8 text-[12px]')}>
    {initials(name)}
  </span>
)
