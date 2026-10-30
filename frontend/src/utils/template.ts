export const PLACEHOLDERS = ['{name}', '{email}'] as const

/** Та же подстановка, что делает backend (только {name} и {email}); нужна для живого превью в редакторе. */
export function renderMessage(text: string, user?: { name: string; email: string | null }) {
  if (!user) return text
  return text.replaceAll('{name}', user.name).replaceAll('{email}', user.email ?? '')
}
