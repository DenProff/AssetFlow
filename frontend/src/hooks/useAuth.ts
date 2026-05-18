import { useState, useCallback } from 'react'
import api from '@/lib/api'
import { queryClient } from '@/lib/queryClient'

export function useAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'))

  const login = useCallback(async (loginStr: string, password: string) => {
    // Backend возвращает пару токенов после успешной проверки логина и пароля
    const { data } = await api.post('/auth/login', { login: loginStr, password })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    setToken(data.accessToken)
    // После логина данные текущего пользователя нужно перечитать через /me
    await queryClient.invalidateQueries({ queryKey: ['me'] })
  }, [])

  const logout = useCallback(() => {
    // Stateless logout на клиенте удаляет токены и очищает кэш React Query
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setToken(null)
    queryClient.clear()
    window.location.href = '/login'
  }, [])

  return { token, login, logout }
}
