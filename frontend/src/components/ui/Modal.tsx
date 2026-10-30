import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { AlertTriangle, X } from 'lucide-react'
import { Button, IconButton } from './Button'

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; description?: string
  children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className={clsx('relative flex max-h-[90vh] w-full animate-pop-in flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton aria-label="Закрыть" onClick={onClose} className="-mr-2 -mt-1"><X className="size-4" /></IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-line bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Подтвердить', danger, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string
  description: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button onClick={onClose} disabled={loading}>Отмена</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}>
      <div className="flex gap-3">
        {danger && <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle className="size-4" /></div>}
        <div className="pt-1.5 text-[14px] text-slate-600">{description}</div>
      </div>
    </Modal>
  )
}
