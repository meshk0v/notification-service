import { isAxiosError } from 'axios'

interface ValidationItem { loc?: (string | number)[]; msg?: string }

/** Превращает ответ FastAPI (detail: string | ValidationItem[]) в читаемое сообщение. */
export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) return 'Не удалось связаться с сервером. Проверьте, что API запущен.'
    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return (detail as ValidationItem[])
        .map((d) => {
          const field = d.loc?.filter((p) => p !== 'body').join('.')
          const msg = (d.msg ?? '').replace(/^Value error, /, '')
          return field ? `${field}: ${msg}` : msg
        })
        .join('; ')
    }
    return `Ошибка сервера (${error.response.status})`
  }
  return error instanceof Error ? error.message : 'Неизвестная ошибка'
}
