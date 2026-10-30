import type { ReactNode } from 'react'
import clsx from 'clsx'
import { AlertCircle, Inbox, Loader2, RotateCw } from 'lucide-react'
import { Button } from './Button'
import { getErrorMessage } from '../../utils/errors'

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={clsx('animate-pulse rounded-md bg-slate-200/70', className)} />
)

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={clsx('size-4 animate-spin text-muted', className)} />
)

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <p className="text-[14px] font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-500">
        <AlertCircle className="size-5" />
      </div>
      <p className="text-[14px] font-medium">Не удалось загрузить данные</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{getErrorMessage(error)}</p>
      {onRetry && <Button size="sm" className="mt-4" onClick={onRetry}><RotateCw className="size-3.5" />Повторить</Button>}
    </div>
  )
}
