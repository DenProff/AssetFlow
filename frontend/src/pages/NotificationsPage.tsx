import { useState } from 'react'
import { formatDateTime } from '@/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Loader2, CheckCheck, Trash2, Trash } from 'lucide-react'
import api from '@/lib/api'
import type { Notification } from '@/types'

export default function NotificationsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ content: Notification[]; totalElements: number }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?size=50').then((r) => r.data),
    // Страница периодически перечитывает уведомления без WebSocket
    refetchInterval: 8_000,
  })

  const notifications = data?.content ?? []
  const unreadCount = notifications.filter((n) => !n.read).length

  const readMutation = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: (_data, id) => {
      // После отметки прочитанным локально обновляем список без полного refetch
      qc.setQueryData(['notifications'], (old: any) => old ? {
        ...old,
        content: old.content.map((n: any) => n.id === id ? { ...n, read: true } : n),
      } : old)
      qc.setQueryData(['notifications-unread'], (old: any) =>
        old ? { count: Math.max(0, (old.count ?? 1) - 1) } : { count: 0 }
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      // После удаления перечитываем список и счётчик в sidebar
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      for (const n of notifications) await api.delete(`/notifications/${n.id}`)
    },
    onSuccess: () => {
      qc.setQueryData(['notifications'], (old: any) => old ? { ...old, content: [] } : old)
      qc.setQueryData(['notifications-unread'], () => ({ count: 0 }))
    },
  })

  const readAllMutation = useMutation({
    mutationFn: async () => {
      // Массовое прочтение выполняется серией запросов к существующему endpoint
      const unread = notifications.filter((n) => !n.read)
      for (const n of unread) await api.post(`/notifications/${n.id}/read`)
    },
    onSuccess: () => {
      qc.setQueryData(['notifications'], (old: any) => old ? {
        ...old,
        content: old.content.map((n: any) => ({ ...n, read: true })),
      } : old)
      qc.setQueryData(['notifications-unread'], () => ({ count: 0 }))
    },
  })

  const typeColors: Record<string, string> = {
    TICKET_STATUS_CHANGED: 'bg-indigo-100 text-indigo-700',
    TICKET_ASSIGNED: 'bg-purple-100 text-purple-700',
    LICENSE_EXPIRING: 'bg-yellow-100 text-yellow-700',
    ASSET_RETURNED: 'bg-green-100 text-green-700',
  }

  const typeLabels: Record<string, string> = {
    TICKET_STATUS_CHANGED: 'Заявка',
    TICKET_ASSIGNED: 'Назначение',
    LICENSE_EXPIRING: 'Лицензия',
    ASSET_RETURNED: 'Оборудование',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Уведомления</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Всё прочитано'}
          </p>
        </div>
        <div className="flex gap-3">
          {unreadCount > 0 && (
            <button
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <CheckCheck className="h-4 w-4" />
              Прочитать все
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => deleteAllMutation.mutate()}
              disabled={deleteAllMutation.isPending}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium"
            >
              <Trash className="h-4 w-4" />
              Удалить все
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-400 gap-3">
          <Bell className="h-10 w-10" />
          <p className="text-sm">Уведомлений нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-white rounded-xl border px-5 py-4 flex items-start gap-4 transition-colors ${
                n.read ? 'border-slate-200' : 'border-indigo-200 bg-indigo-50/40'
              }`}
            >
              <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? 'bg-slate-300' : 'bg-indigo-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[n.type] ?? 'bg-slate-100 text-slate-600'}`}>
                    {typeLabels[n.type] ?? n.type}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900">{n.title}</p>
                <p className="text-sm text-slate-500 mt-0.5">{n.body}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {!n.read && (
                  <button
                    onClick={() => readMutation.mutate(n.id)}
                    disabled={readMutation.isPending}
                    className="text-xs text-slate-400 hover:text-indigo-600 font-medium whitespace-nowrap"
                  >
                    Прочитано
                  </button>
                )}
                <button
                  onClick={() => deleteMutation.mutate(n.id)}
                  disabled={deleteMutation.isPending}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                  title="Удалить"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
