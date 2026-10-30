import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from './Button'
import { Skeleton } from './Feedback'

export const Table = ({ children, compact }: { children: ReactNode; compact?: boolean }) => (
  <div className="overflow-x-auto"><table className={clsx('w-full text-left', !compact && 'min-w-[640px]')}>{children}</table></div>
)
export const Th = ({ className, ...r }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={clsx('whitespace-nowrap border-b border-line bg-slate-50/60 px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide text-muted first:pl-5 last:pr-5', className)} {...r} />
)
export const Td = ({ className, ...r }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={clsx('border-b border-line px-4 py-3 align-middle first:pl-5 last:pr-5', className)} {...r} />
)
export const Tr = ({ onClick, children }: { onClick?: () => void; children: ReactNode }) => (
  <tr onClick={onClick} className={clsx('transition-colors hover:bg-slate-50/70 [&:last-child>td]:border-b-0', onClick && 'cursor-pointer')}>{children}</tr>
)

export function TableSkeleton({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <Table>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>{Array.from({ length: cols }).map((_, j) => (
            <Td key={j}><Skeleton className="h-4 w-full max-w-[140px]" /></Td>
          ))}</tr>
        ))}
      </tbody>
    </Table>
  )
}

export function Pagination({ page, pageSize, total, onChange }: {
  page: number; pageSize: number; total: number; onChange: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[13px] text-muted">
      <span className="tabular-nums">{from}–{to} из {total}</span>
      <div className="flex items-center gap-1">
        <IconButton aria-label="Назад" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft className="size-4" /></IconButton>
        <span className="min-w-14 text-center tabular-nums">{page + 1} / {pages}</span>
        <IconButton aria-label="Вперёд" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}><ChevronRight className="size-4" /></IconButton>
      </div>
    </div>
  )
}
