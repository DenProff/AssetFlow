import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Server, Ticket, LogOut, Bell, Users, Monitor, FileText, ScrollText, UserCircle, BarChart2,
} from 'lucide-react'
import { useMe } from '@/hooks/useMe'
import { queryClient } from '@/lib/queryClient'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const ALL_ROLES = ['EMPLOYEE', 'IT_SPECIALIST', 'IT_MANAGER', 'HR']
const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Сотрудник',
  IT_SPECIALIST: 'IT-специалист',
  IT_MANAGER: 'IT-менеджер',
  HR: 'HR-специалист',
}

// Каждый пункт меню сам описывает, каким ролям он доступен
const navItems = [
  { to: '/profile',       icon: UserCircle, label: 'Мой кабинет',   roles: ALL_ROLES },
  { to: '/tickets',       icon: Ticket,     label: 'Мои заявки',    roles: ['EMPLOYEE'] },
  { to: '/assets',        icon: Server,     label: 'Оборудование',  roles: ['IT_SPECIALIST', 'IT_MANAGER'] },
  { to: '/tickets',       icon: Ticket,     label: 'Заявки',        roles: ['IT_SPECIALIST', 'IT_MANAGER', 'HR'] },
  { to: '/software',      icon: Monitor,    label: 'ПО',            roles: ['IT_SPECIALIST', 'IT_MANAGER'] },
  { to: '/acts',          icon: FileText,   label: 'Акты',          roles: ['IT_SPECIALIST', 'IT_MANAGER'] },
  { to: '/employees',     icon: Users,      label: 'Сотрудники',    roles: ['IT_SPECIALIST', 'IT_MANAGER', 'HR'] },
  { to: '/notifications', icon: Bell,       label: 'Уведомления',   roles: ALL_ROLES },
  { to: '/logs',          icon: ScrollText, label: 'Логи',          roles: ['IT_SPECIALIST', 'IT_MANAGER'] },
  { to: '/analytics',     icon: BarChart2,  label: 'Аналитика',      roles: ['IT_MANAGER'] },
]

export default function Layout() {
  const navigate = useNavigate()
  const { data: me, isError } = useMe()

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data),
    // Sidebar обновляет бейдж уведомлений отдельным лёгким запросом
    refetchInterval: 4_000,
    enabled: !!me,
  })
  const unreadCount = unreadData?.count ?? 0

  useEffect(() => {
    // Если /me перестал работать, токены очищаются и пользователь возвращается на login
    if (isError) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      queryClient.clear()
      navigate('/login')
    }
  }, [isError, navigate])

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    queryClient.clear()
    navigate('/login')
  }

  const role = me?.role ?? ''
  // Sidebar показывает только пункты, доступные текущей роли
  const visible = navItems.filter((n) => n.roles.includes(role))

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white/95 border-r border-slate-200 flex flex-col shadow-sm">
        <div className="px-6 py-5 border-b border-slate-200">
          <span className="text-lg font-bold tracking-tight text-indigo-600">AssetFlow</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visible.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to + label}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <div className="relative">
                <Icon className="h-4 w-4 shrink-0" />
                {to === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          {me && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium text-slate-900 leading-5 whitespace-normal break-words">{me.fullName}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[me.role] ?? me.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">
        {/* Outlet показывает текущую страницу, выбранную React Router */}
        <Outlet />
      </main>
    </div>
  )
}
