const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const dateOnly = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' })
const number = new Intl.NumberFormat('ru-RU')

export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—')
export const formatShortDate = (iso: string) => dateOnly.format(new Date(iso))
export const formatNumber = (n: number) => number.format(n)

/** ISO -> значение для <input type="datetime-local"> (локальное время). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?'
