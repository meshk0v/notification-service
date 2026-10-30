import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/endpoints'
import { tokenStorage, UNAUTHORIZED_EVENT } from '../api/client'
import type { Employee } from '../types/api'

interface AuthValue {
  employee: Employee | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [hasToken, setHasToken] = useState(() => !!tokenStorage.get())

  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const logout = useCallback(() => {
    tokenStorage.clear()
    setHasToken(false)
    qc.clear()
  }, [qc])

  // 401 из любого запроса -> выходим (ProtectedRoute перенаправит на /login)
  useEffect(() => {
    const onUnauthorized = () => {
      setHasToken(false)
      qc.clear()
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [qc])

  const login = useCallback(
    async (username: string, password: string) => {
      await authApi.login(username, password)
      await qc.fetchQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me, staleTime: 0 })
      setHasToken(true)
    },
    [qc],
  )

  const value = useMemo<AuthValue>(
    () => ({
      employee: hasToken ? (me.data ?? null) : null,
      loading: hasToken && me.isPending,
      login,
      logout,
    }),
    [me.data, me.isPending, hasToken, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
