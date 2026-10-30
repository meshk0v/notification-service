import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-accent-600 text-white shadow-sm hover:bg-accent-700 active:bg-accent-700',
  secondary: 'bg-white text-ink shadow-card hover:bg-slate-50',
  ghost: 'text-muted hover:bg-slate-100 hover:text-ink',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
}
const sizes: Record<Size, string> = { sm: 'h-8 px-2.5 text-[13px] gap-1.5', md: 'h-9 px-3.5 gap-2' }

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'md', loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
})

export function IconButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors',
        'hover:bg-slate-100 hover:text-ink disabled:opacity-40', className,
      )}
      {...rest}
    />
  )
}
