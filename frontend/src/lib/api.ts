import axios from 'axios'

const api = axios.create({
  // Vite proxy перенаправляет /api на Spring Boot backend
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  // Access token добавляется ко всем запросам, кроме случаев когда токена ещё нет
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const url = original?.url ?? ''
    // Ошибки login и refresh возвращаются странице, чтобы она могла показать сообщение пользователю
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/refresh')
    if (isAuthRequest) {
      return Promise.reject(error)
    }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refreshToken')
      if (refresh) {
        try {
          // Если access token истёк, refresh token запрашивает новый access token
          const { data } = await axios.post('/api/auth/refresh', { refreshToken: refresh })
          localStorage.setItem('accessToken', data.accessToken)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          // Исходный запрос повторяется уже с новым access token
          return api(original)
        } catch {
          // Если refresh не сработал, пользователь считается разлогиненным
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
          return Promise.reject(error)
        }
      } else {
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  },
)

export default api
