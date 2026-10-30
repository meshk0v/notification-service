import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'

const width = (c?: string) => (c && /(^| )w-/.test(c) ? '' : 'w-full')
const control =
  'rounded-lg bg-white px-3 text-[14px] text-ink shadow-card transition-shadow placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-accent-500/40 disabled:bg-slate-50 disabled:text-muted'

export function Field({
  label, hint, error, children, htmlFor,
}: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-slate-700">{label}</label>
      {children}
      {error ? <p className="text-[12px] text-red-600">{error}</p> : hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={clsx(control, width(className), 'h-9', invalid && 'ring-2 ring-red-500/40', className)} {...rest} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return <textarea ref={ref} className={clsx(control, width(className), 'py-2 leading-relaxed', invalid && 'ring-2 ring-red-500/40', className)} {...rest} />
  },
)

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(control, width(className), 'h-9 appearance-none bg-no-repeat pr-8', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2364748b' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 10px center' }}
      {...rest}>
      {children}
    </select>
  )
}

export function Checkbox({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean
}) {
  const id = useId()
  return (
    <label htmlFor={id} className={clsx('flex items-start gap-2.5', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={clsx('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-500',
        checked ? 'border-accent-600 bg-accent-600' : 'border-slate-300 bg-white')}>
        {checked && <Check className="size-3 text-white" strokeWidth={3} />}
      </span>
      <span className="text-[14px] leading-5">{label}{description && <span className="block text-[12px] text-muted">{description}</span>}</span>
    </label>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={clsx('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent-600' : 'bg-slate-300')}>
      <span className={clsx('absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
    </button>
  )
}
