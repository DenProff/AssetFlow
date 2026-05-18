import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, ScrollText } from 'lucide-react'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import type { SystemLog } from '@/types'

const ACTION_LABELS: Record<string, string> = {
  ASSET_CREATED: 'Оборудование создано',
  ASSET_UPDATED: 'Оборудование изменено',
  ASSET_STATUS_CHANGED: 'Статус оборудования',
  ASSET_DELETED: 'Оборудование удалено',
  ASSET_ISSUED: 'Оборудование выдано',
  ASSET_RETURNED: 'Оборудование возвращено',
  ASSET_WRITTEN_OFF: 'Оборудование списано',
  TICKET_CREATED: 'Заявка создана',
  TICKET_ASSIGNED: 'Заявка назначена',
  TICKET_STATUS_CHANGED: 'Статус заявки',
  SOFTWARE_CREATED: 'ПО добавлено',
  SOFTWARE_UPDATED: 'ПО изменено',
  SOFTWARE_DELETED: 'ПО удалено',
  SOFTWARE_INSTALLED: 'ПО установлено',
  SOFTWARE_UNINSTALLED: 'ПО удалено с устройства',
  EMPLOYEE_CREATED: 'Сотрудник создан',
  EMPLOYEE_UPDATED: 'Сотрудник изменён',
  EMPLOYEE_DELETED: 'Сотрудник удалён',
}

const ACTION_COLORS: Record<string, string> = {
  ASSET_CREATED: 'bg-indigo-100 text-indigo-700',
  ASSET_UPDATED: 'bg-indigo-50 text-indigo-600',
  ASSET_STATUS_CHANGED: 'bg-indigo-100 text-indigo-700',
  ASSET_DELETED: 'bg-red-100 text-red-700',
  ASSET_ISSUED: 'bg-green-100 text-green-700',
  ASSET_RETURNED: 'bg-teal-100 text-teal-700',
  ASSET_WRITTEN_OFF: 'bg-red-200 text-red-800',
  TICKET_CREATED: 'bg-purple-100 text-purple-700',
  TICKET_ASSIGNED: 'bg-violet-100 text-violet-700',
  TICKET_STATUS_CHANGED: 'bg-indigo-100 text-indigo-700',
  SOFTWARE_CREATED: 'bg-cyan-100 text-cyan-700',
  SOFTWARE_UPDATED: 'bg-cyan-50 text-cyan-600',
  SOFTWARE_DELETED: 'bg-orange-100 text-orange-700',
  SOFTWARE_INSTALLED: 'bg-sky-100 text-sky-700',
  SOFTWARE_UNINSTALLED: 'bg-orange-50 text-orange-600',
  EMPLOYEE_CREATED: 'bg-emerald-100 text-emerald-700',
  EMPLOYEE_UPDATED: 'bg-emerald-50 text-emerald-600',
  EMPLOYEE_DELETED: 'bg-rose-100 text-rose-700',
}

export default function LogsPage() {
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const params = new URLSearchParams()
  if (filterAction) params.set('action', filterAction)
  params.set('page', String(page))
  params.set('size', String(PAGE_SIZE))

  const { data, isLoading, isError } = useQuery<{ content: SystemLog[]; totalElements: number; totalPages: number }>({
    queryKey: ['system-logs', filterAction, page],
    // Backend фильтрует по action и отдаёт страницу журнала событий
    queryFn: () => api.get(`/system-logs?${params}`).then((r) => r.data),
  })

  const logs = data?.content ?? []
  const totalPages = data?.totalPages ?? 1

  const filtered = search
    ? logs.filter((l) =>
        // Текстовый поиск выполняется на frontend только внутри текущей страницы логов
        (l.actorEmployeeNo ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (l.details ?? '').toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Журнал событий</h1>
          <p className="text-sm text-slate-500 mt-0.5">Аудит действий в системе</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по актору, деталям..."
            className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(0); e.currentTarget.blur() }}
          className="h-10 min-w-[180px] border border-slate-300 rounded-lg text-sm px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Все действия</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {(search || filterAction) && (
          <button
            onClick={() => { setSearch(''); setFilterAction(''); setPage(0) }}
            className="h-10 px-3 text-sm text-slate-500 hover:text-indigo-600"
          >
            Сбросить
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-red-400 gap-2">
            <ScrollText className="h-8 w-8" />
            <p className="text-sm">Ошибка загрузки — нет доступа или сервер недоступен</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400 gap-2">
            <ScrollText className="h-8 w-8" />
            <p className="text-sm">Записей нет</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Время</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Действие</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Актор</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Детали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-indigo-50/40">
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {formatDateTime(l.loggedAt, true)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[l.action] ?? 'bg-slate-100 text-slate-600'}`}>
                      {ACTION_LABELS[l.action] ?? l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700">{l.actorEmployeeNo ?? '–'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{l.details ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-slate-500">Стр. {page + 1} из {totalPages} · всего {data?.totalElements}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-indigo-50/40 disabled:opacity-40"
            >← Назад</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-indigo-50/40 disabled:opacity-40"
            >Вперёд →</button>
          </div>
        </div>
      )}
    </div>
  )
}
