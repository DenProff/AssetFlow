import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Monitor, Ticket, User, Building2, Briefcase, Server } from 'lucide-react'
import api from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { formatDate } from '@/lib/utils'
import type { Asset, Ticket as TicketType, AssetType, AssetStatus, TicketStatus } from '@/types'

interface Software {
  installationId: number
  assetInventoryNo: string
  softwareId: number
  name: string
  version: string
  licenseEnd: string | null
  licenseStatus: string
}

export default function ProfilePage() {
  const { data: me, isLoading: meLoading } = useMe()

  const { data: assets = [], isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ['me-assets'],
    // Личные активы запрашиваются только после успешной загрузки текущего пользователя
    queryFn: () => api.get<Asset[]>('/me/assets').then((r) => r.data),
    enabled: !!me,
  })

  const { data: software = [], isLoading: softwareLoading } = useQuery<Software[]>({
    queryKey: ['me-software'],
    // Backend определяет ПО через активы, которые сейчас закреплены за сотрудником
    queryFn: () => api.get<Software[]>('/me/software').then((r) => r.data),
    enabled: !!me,
  })

  const licenseStatusColors: Record<string, string> = {
    'Активна': 'bg-green-100 text-green-700',
    'Истекает': 'bg-yellow-100 text-yellow-700',
    'Истекла': 'bg-red-100 text-red-700',
  }

  const [hideClosedTickets, setHideClosedTickets] = useState(false)

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<TicketType[]>({
    queryKey: ['me-tickets'],
    // Профиль показывает только заявки текущего пользователя независимо от его роли
    queryFn: () => api.get<TicketType[]>('/me/tickets').then((r) => r.data),
    enabled: !!me,
  })

  const { data: assetTypes = [] } = useQuery<AssetType[]>({
    queryKey: ['assetTypes'],
    queryFn: () => api.get<AssetType[]>('/reference/asset-types').then((r) => r.data),
  })
  const { data: assetStatuses = [] } = useQuery<AssetStatus[]>({
    queryKey: ['assetStatuses'],
    queryFn: () => api.get<AssetStatus[]>('/reference/asset-statuses').then((r) => r.data),
  })

  const { data: ticketStatuses = [] } = useQuery<TicketStatus[]>({
    queryKey: ['ticketStatuses'],
    queryFn: () => api.get<TicketStatus[]>('/reference/ticket-statuses').then((r) => r.data),
  })

  const typeMap = Object.fromEntries(assetTypes.map((t) => [t.id, t.name]))
  const statusMap = Object.fromEntries(assetStatuses.map((s) => [s.id, s.name]))
  // Справочники превращаются в map, чтобы показать названия вместо id
  const assetStatusColors: Record<string, string> = {
    'Эксплуатация': 'bg-green-100 text-green-700',
    'На складе': 'bg-slate-100 text-slate-600',
    'Ремонт': 'bg-orange-100 text-orange-700',
    'Списано': 'bg-red-100 text-red-700',
  }
  const ticketStatusMap = Object.fromEntries(ticketStatuses.map((s) => [s.id, s.name]))

  const ticketStatusColors: Record<string, string> = {
    'Новая': 'bg-purple-100 text-purple-700',
    'В работе': 'bg-indigo-100 text-indigo-700',
    'Выполнена': 'bg-green-100 text-green-700',
    'Отклонена': 'bg-red-100 text-red-700',
  }

  if (meLoading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Мой кабинет</h1>
        <p className="text-sm text-slate-500 mt-0.5">Личная информация и закреплённое оборудование</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
            <User className="h-7 w-7 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{me?.fullName}</h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                {me?.position}
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {me?.department}
              </span>
            </div>
          </div>
          <div className="ml-auto">
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              Сотрудник
            </span>
          </div>
        </div>
      </div>

      {/* Assigned hardware */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-slate-500" />
          Закреплённое оборудование
          <span className="text-xs text-slate-400 font-normal">({assets.length})</span>
        </h2>
        {assetsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          </div>
        ) : assets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-sm text-slate-400">
            Оборудование не закреплено
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Инв. номер</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Тип</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Производитель / Модель</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Серийный номер</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((a) => (
                  <tr key={a.inventoryNo} className="hover:bg-indigo-50/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{a.inventoryNo}</td>
                    <td className="px-4 py-3 text-slate-700">{typeMap[a.typeId] ?? a.typeId}</td>
                    <td className="px-4 py-3 text-slate-900">{a.manufacturer} {a.model}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.serialNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${assetStatusColors[statusMap[a.statusId]] ?? 'bg-green-100 text-green-700'}`}>
                        {statusMap[a.statusId] ?? 'В эксплуатации'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Installed software */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Monitor className="h-4 w-4 text-slate-500" />
          Установленное ПО
          <span className="text-xs text-slate-400 font-normal">({software.length})</span>
        </h2>
        {softwareLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          </div>
        ) : software.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-sm text-slate-400">
            ПО не установлено
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Название</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Версия</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Устройство</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Срок лицензии</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {software.map((s) => (
                  <tr key={s.installationId} className="hover:bg-indigo-50/40">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500">{s.version}</td>
                    <td className="px-4 py-3 font-mono text-xs text-indigo-700">{s.assetInventoryNo}</td>
                    <td className="px-4 py-3 text-xs">
                      {s.licenseEnd
                        ? <span className={new Date(s.licenseEnd) < new Date() ? 'text-red-600 font-medium' : 'text-slate-700'}>
                            {formatDate(s.licenseEnd)}
                          </span>
                        : <span className="text-green-700 font-medium">Бессрочная</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${licenseStatusColors[s.licenseStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                        {s.licenseStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Ticket className="h-4 w-4 text-slate-500" />
            История заявок
            <span className="text-xs text-slate-400 font-normal">({tickets.length})</span>
          </h2>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={hideClosedTickets} onChange={(e) => setHideClosedTickets(e.target.checked)}
              className="rounded" />
            Скрыть закрытые
          </label>
        </div>
        {ticketsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-sm text-slate-400">
            Заявки отсутствуют
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Номер</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Тип</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Категория</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Создана</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Закрыта</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Фильтр скрывает заявки с датой закрытия только на frontend */}
                {tickets.filter((t) => !hideClosedTickets || !t.closedAt).map((t) => (
                  <tr key={t.ticketNo} className="hover:bg-indigo-50/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{t.ticketNo}</td>
                    <td className="px-4 py-3 text-slate-900">{t.type}</td>
                    <td className="px-4 py-3 text-slate-500">{t.category ?? '–'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {t.closedAt ? formatDate(t.closedAt) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const name = ticketStatusMap[t.statusId] ?? String(t.statusId)
                        return (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ticketStatusColors[name] ?? 'bg-slate-100 text-slate-600'}`}>
                            {name}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
