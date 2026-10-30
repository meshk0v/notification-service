import { PLACEHOLDERS } from '../utils/template'

/** Подсвечивает плейсхолдеры {name}/{email} в тексте. */
export function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\{name\}|\{email\})/g)
  return (
    <>
      {parts.map((p, i) => (PLACEHOLDERS as readonly string[]).includes(p)
        ? <span key={i} className="rounded bg-accent-100 px-1 font-mono text-[12.5px] text-accent-700">{p}</span>
        : <span key={i}>{p}</span>)}
    </>
  )
}

export function MessageBubble({ children }: { children: React.ReactNode }) {
  return <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-[14px] leading-relaxed">{children}</div>
}
