import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Me {
  employeeNo: string
  fullName: string
  position: string
  department: string
  role: string
}

export function useMe() {
  return useQuery<Me>({
    queryKey: ['me'],
    // /me возвращает профиль и роль пользователя по JWT из Authorization header
    queryFn: () => api.get<Me>('/me').then((r) => r.data),
    retry: false,
  })
}
