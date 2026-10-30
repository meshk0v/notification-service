import clsx from 'clsx'
import type { Tag, TagBrief } from '../types/api'

/** Мультивыбор тегов чипами. */
export function TagPicker({ tags, selected, onChange }: {
  tags: (Tag | TagBrief)[]; selected: number[]; onChange: (ids: number[]) => void
}) {
  if (tags.length === 0) return <p className="text-[13px] text-muted">Тегов пока нет.</p>
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const on = selected.includes(t.id)
        return (
          <button key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={on}
            className={clsx('rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
              on ? 'bg-accent-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
