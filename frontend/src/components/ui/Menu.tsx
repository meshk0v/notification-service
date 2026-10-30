import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { MoreHorizontal } from 'lucide-react'
import { IconButton } from './Button'

export interface MenuItem { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean }

export function RowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <IconButton aria-label="Действия" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><MoreHorizontal className="size-4" /></IconButton>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-48 animate-pop-in rounded-xl bg-white p-1 shadow-pop">
          {items.filter((i) => !i.hidden).map((i) => (
            <button key={i.label} role="menuitem" onClick={() => { setOpen(false); i.onClick() }}
              className={clsx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors [&>svg]:size-4',
                i.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100')}>
              {i.icon}{i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
