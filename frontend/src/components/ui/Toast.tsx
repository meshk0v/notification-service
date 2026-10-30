import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

interface ToastItem { id: number; kind: 'success' | 'error'; text: string }
interface ToastApi { success: (t: string) => void; error: (t: string) => void }

const Ctx = createContext<ToastApi | null>(null)
let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const push = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = ++seq
    setItems((l) => [...l, { id, kind, text }])
    setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500)
  }, [dismiss])
  const api = useMemo<ToastApi>(() => ({ success: (t) => push('success', t), error: (t) => push('error', t) }), [push])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex animate-slide-in items-start gap-2.5 rounded-xl bg-white p-3.5 shadow-pop">
            {t.kind === 'success'
              ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              : <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />}
            <p className="flex-1 text-[13px] leading-5">{t.text}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Закрыть" className="text-slate-400 hover:text-slate-700"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast must be used within ToastProvider')
  return c
}
