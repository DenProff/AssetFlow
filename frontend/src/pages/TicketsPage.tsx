import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, UserCheck } from 'lucide-react'
import api from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useMe } from '@/hooks/useMe'
import type { Ticket, TicketStatus, Employee, Asset, AssetStatus } from '@/types'

interface Software { id: number; name: string; version: string }

const statusColors: Record<string, string> = {
  'Новая': 'bg-purple-100 text-purple-700',
  'В работе': 'bg-indigo-100 text-indigo-700',
  'Выполнена': 'bg-green-100 text-green-700',
  'Отклонена': 'bg-red-100 text-red-700',
}

const TICKET_TYPES = ['Ремонт оборудования', 'Установка ПО', 'Обновление ПО']
const REPAIR_CATEGORIES = ['Аппаратная поломка', 'Механическое повреждение', 'Программный сбой', 'Утеря']
// Frontend ограничивает выбор статусов так же, как backend проверяет переходы в TicketService
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'Новая': ['В работе', 'Отклонена'],
  'В работе': ['Выполнена', 'Отклонена'],
}

export default function TicketsPage() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const canManage = me?.role === 'IT_SPECIALIST' || me?.role === 'IT_MANAGER'
  const isEmployee = me?.role === 'EMPLOYEE'
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<Ticket | null>(null)
  const [showStatus, setShowStatus] = useState<Ticket | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [hideClosed, setHideClosed] = useState(false)
  const [form, setForm] = useState({ type: '', category: '', justification: '', assetInventoryNo: '', softwareId: '', targetSoftwareVersion: '', updateProductName: '' })
  const [customSoftware, setCustomSoftware] = useState('')
  const [statusForm, setStatusForm] = useState({ statusName: '', comment: '', keepInRepair: false })
  const [formError, setFormError] = useState('')

  // Список заявок перечитывается при изменении фильтра статуса
  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['tickets', filterStatus],
    queryFn: () => {
      const params = filterStatus ? `?statusId=${filterStatus}` : ''
      return api.get<Ticket[]>(`/tickets${params}`).then((r) => r.data)
    },
  })

  const { data: statuses = [] } = useQuery<TicketStatus[]>({
    queryKey: ['ticketStatuses'],
    queryFn: () => api.get<TicketStatus[]>('/reference/ticket-statuses').then((r) => r.data),
  })

  const { data: assetStatuses = [] } = useQuery<AssetStatus[]>({
    queryKey: ['assetStatuses'],
    queryFn: () => api.get<AssetStatus[]>('/reference/asset-statuses').then((r) => r.data),
  })

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees').then((r) => r.data),
  })

  const { data: myAssets = [] } = useQuery<Asset[]>({
    queryKey: ['me-assets'],
    queryFn: () => api.get<Asset[]>('/me/assets').then((r) => r.data),
    // Сотрудник может создавать заявки только по своим текущим активам
    enabled: isEmployee,
    refetchInterval: 15_000,
  })

  const { data: allAssets = [] } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: () => api.get<Asset[]>('/assets').then((r) => r.data),
    // IT-роли видят все активы при создании или обработке заявки
    enabled: canManage,
    refetchInterval: 15_000,
  })

  const { data: software = [] } = useQuery<Software[]>({
    queryKey: ['software-list'],
    queryFn: () => api.get<Software[]>('/software').then((r) => r.data),
  })

  const isSoftwareTicket = form.type === 'Установка ПО' || form.type === 'Обновление ПО'
  const { data: assetInstallations = [] } = useQuery<{ softwareId: number; installedVersion: string }[]>({
    queryKey: ['asset-installs', form.assetInventoryNo],
    queryFn: () => api.get(`/software/asset/${form.assetInventoryNo}/installations`).then((r) => r.data),
    // Установленное ПО нужно знать, чтобы не предложить повторную установку или невозможное обновление
    enabled: isSoftwareTicket && !!form.assetInventoryNo,
  })
  const installedIds = new Set(assetInstallations.map((i) => i.softwareId))
  const installedSoftware = assetInstallations
    .map((i) => ({ installation: i, software: software.find((s) => s.id === i.softwareId) }))
    .filter((i): i is { installation: { softwareId: number; installedVersion: string }; software: Software } => !!i.software)

  const assetStatusMap = Object.fromEntries(assetStatuses.map((s) => [s.id, s.name]))
  const assetOptions = (isEmployee ? myAssets : allAssets)
    .filter((a) => assetStatusMap[a.statusId] !== 'Списано')
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s.name]))
  const empMap = Object.fromEntries(employees.map((e) => [e.employeeNo, e.fullName]))
  const softwareMap = Object.fromEntries(software.map((s) => [s.id, s.name]))
  const installedProductNames = new Set(installedSoftware.map((i) => i.software.name))
  const updateableSoftware = software.filter((s) => {
    const current = installedSoftware.find((i) => i.software.name === s.name)
    return installedProductNames.has(s.name) && current?.software.id !== s.id && current?.installation.installedVersion !== s.version
  })
  const updateableProductNames = Array.from(new Set(updateableSoftware.map((s) => s.name)))
  const currentInstalledSoftware = form.updateProductName
    ? installedSoftware.find((i) => i.software.name === form.updateProductName)
    : null
  const targetVersionOptions = form.updateProductName
    ? updateableSoftware.filter((s) => s.name === form.updateProductName)
    : []

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/tickets', body),
    onSuccess: () => {
      // После создания заявки таблица перечитывается из backend
      qc.invalidateQueries({ queryKey: ['tickets'] })
      setShowCreate(false)
      setForm({ type: '', category: '', justification: '', assetInventoryNo: '', softwareId: '', targetSoftwareVersion: '', updateProductName: '' })
      setFormError('')
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка'),
  })

  const assignMutation = useMutation({
    mutationFn: (ticketNo: string) => api.post(`/tickets/${ticketNo}/assign-to-me`),
    // После назначения исполнителя нужно обновить список заявок
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ ticketNo, body }: { ticketNo: string; body: object }) =>
      api.post(`/tickets/${ticketNo}/status`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      // Статус ремонтной заявки может изменить статус связанного актива
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['asset-installs'] })
      setShowStatus(null)
      setStatusForm({ statusName: '', comment: '', keepInRepair: false })
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка'),
  })

  const handleCreate = (ev: React.FormEvent) => {
    ev.preventDefault()
    const isRepair = form.type === 'Ремонт оборудования'
    const isSoftware = form.type === 'Установка ПО' || form.type === 'Обновление ПО'
    const isOtherSoftware = isSoftware && form.softwareId === 'other'
    // Для ручного ПО название сохраняется в обоснование, потому что softwareId отсутствует
    const justification = isOtherSoftware
      ? `ПО: ${customSoftware}${form.justification ? `\n${form.justification}` : ''}`
      : form.justification || null
    createMutation.mutate({
      type: form.type,
      category: isRepair ? form.category || null : null,
      assetInventoryNo: (isRepair || isSoftware) && form.assetInventoryNo ? form.assetInventoryNo : null,
      softwareId: isSoftware && !isOtherSoftware && form.softwareId ? Number(form.softwareId) : null,
      targetSoftwareVersion: form.type === 'Обновление ПО' ? form.targetSoftwareVersion.trim() : null,
      justification,
    })
  }

  const handleStatusChange = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!showStatus) return
    statusMutation.mutate({ ticketNo: showStatus.ticketNo, body: { statusName: statusForm.statusName, comment: statusForm.comment, keepInRepair: statusForm.keepInRepair } })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Заявки</h1>
          <p className="text-sm text-slate-500 mt-0.5">Сервисные обращения</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Создать
        </button>
      </div>

      {/* Filter */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); e.currentTarget.blur() }}
          className="h-10 min-w-[180px] border border-slate-300 rounded-lg text-sm px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Все статусы</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)}
            className="rounded" />
          Скрыть закрытые
        </label>
        {(filterStatus || hideClosed) && (
          <button
            onClick={() => { setFilterStatus(''); setHideClosed(false) }}
            className="h-10 px-3 text-sm text-slate-500 hover:text-indigo-600"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">Заявки не найдены</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Номер</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Тип / Категория</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Автор</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Исполнитель</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Объект</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Создана</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Статус</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.filter((t) => !hideClosed || (statusMap[t.statusId] !== 'Выполнена' && statusMap[t.statusId] !== 'Отклонена')).map((t) => (
                <tr key={t.ticketNo} className="hover:bg-indigo-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{t.ticketNo}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{t.type}</div>
                    {t.category && <div className="text-xs text-slate-400">{t.category}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{empMap[t.authorEmployeeNo] ?? t.authorEmployeeNo}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.assigneeEmployeeNo ? empMap[t.assigneeEmployeeNo] ?? t.assigneeEmployeeNo : <span className="text-slate-300">–</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {t.assetInventoryNo && <div className="font-mono">{t.assetInventoryNo}</div>}
                    {t.softwareId && <div className="text-slate-400">{softwareMap[t.softwareId] ?? `ПО #${t.softwareId}`}</div>}
                    {t.targetSoftwareVersion && <div className="text-slate-400">до версии {t.targetSoftwareVersion}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(t.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[statusMap[t.statusId]] ?? 'bg-slate-100 text-slate-600'}`}>
                      {statusMap[t.statusId] ?? t.statusId}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setShowDetail(t)}
                          className="text-xs text-slate-400 hover:text-slate-700 font-medium">Детали</button>
                      {canManage && !t.assigneeEmployeeNo && t.authorEmployeeNo !== me?.employeeNo && (
                        <button onClick={() => assignMutation.mutate(t.ticketNo)}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          <UserCheck className="h-3.5 w-3.5" /> Взять
                        </button>
                      )}
                      {canManage && !t.closedAt && (
                        <button onClick={() => { setShowStatus(t); setFormError('') }}
                          className="text-xs text-slate-500 hover:text-slate-700 font-medium">
                          Статус
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Новая заявка</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Тип заявки *</label>
                <select
                  required
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value, category: '', softwareId: '', targetSoftwareVersion: '', updateProductName: '' })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Выберите тип</option>
                  {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.type === 'Ремонт оборудования' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Категория неисправности *</label>
                    <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Выберите категорию</option>
                      {REPAIR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Оборудование *</label>
                    <select required value={form.assetInventoryNo} onChange={(e) => setForm({ ...form, assetInventoryNo: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Выберите оборудование</option>
                      {assetOptions.map((a) => <option key={a.inventoryNo} value={a.inventoryNo}>{a.inventoryNo} – {a.manufacturer} {a.model}</option>)}
                    </select>
                    {assetOptions.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">Нет доступного оборудования</p>
                    )}
                  </div>
                </>
              )}
              {isSoftwareTicket && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">На какое оборудование *</label>
                    <select required value={form.assetInventoryNo} onChange={(e) => setForm({ ...form, assetInventoryNo: e.target.value, softwareId: '', targetSoftwareVersion: '', updateProductName: '' })}
                      className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Выберите оборудование</option>
                      {assetOptions.map((a) => <option key={a.inventoryNo} value={a.inventoryNo}>{a.inventoryNo} – {a.manufacturer} {a.model}</option>)}
                    </select>
                    {assetOptions.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">Нет доступного оборудования</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Программное обеспечение *</label>
                    {!form.assetInventoryNo ? (
                      <p className="text-xs text-slate-400 italic py-2">Сначала выберите оборудование</p>
                    ) : (
                      <>
                        <select required value={form.type === 'Обновление ПО' ? form.updateProductName : form.softwareId} onChange={(e) => {
                          const value = e.target.value
                          const selected = software.find((s) => String(s.id) === value)
                          setForm(form.type === 'Обновление ПО'
                            ? { ...form, updateProductName: value, softwareId: '', targetSoftwareVersion: '' }
                            : { ...form, softwareId: value, targetSoftwareVersion: selected?.version ?? '', updateProductName: '' })
                          setCustomSoftware('')
                        }}
                          className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="">Выберите ПО</option>
                          {form.type === 'Обновление ПО'
                            ? updateableProductNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                              ))
                            : software.filter((s) => !installedIds.has(s.id) && !installedProductNames.has(s.name)).map((s) => (
                                <option key={s.id} value={s.id}>{s.name} {s.version}</option>
                              ))
                          }
                          {form.type !== 'Обновление ПО' && (
                            <option value="other">Другое (укажите вручную)</option>
                          )}
                        </select>
                        {form.type === 'Обновление ПО' && updateableSoftware.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">Для установленного ПО нет доступных обновлений в реестре</p>
                        )}
                        {form.type === 'Обновление ПО' && form.updateProductName && (
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-slate-700 mb-1">Целевая версия *</label>
                            <select required value={form.softwareId}
                              onChange={(e) => {
                                const selected = software.find((s) => String(s.id) === e.target.value)
                                setForm({ ...form, softwareId: e.target.value, targetSoftwareVersion: selected?.version ?? '' })
                              }}
                              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              <option value="">Выберите версию</option>
                              {targetVersionOptions.map((s) => (
                                <option key={s.id} value={s.id}>{s.version}</option>
                              ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">Установленная версия: {currentInstalledSoftware?.installation.installedVersion ?? 'не указана'}</p>
                          </div>
                        )}
                        {form.softwareId === 'other' && (
                          <input required placeholder="Название ПО" value={customSoftware}
                            onChange={(e) => setCustomSoftware(e.target.value)}
                            className="mt-2 w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Обоснование</label>
                <textarea rows={3} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              {formError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg">
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Заявка {showDetail.ticketNo}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{showDetail.type}{showDetail.category ? ` – ${showDetail.category}` : ''}</p>
              </div>
              <button onClick={() => setShowDetail(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Автор', value: empMap[showDetail.authorEmployeeNo] ?? showDetail.authorEmployeeNo },
                  { label: 'Исполнитель', value: showDetail.assigneeEmployeeNo ? (empMap[showDetail.assigneeEmployeeNo] ?? showDetail.assigneeEmployeeNo) : '–' },
                  { label: 'Создана', value: formatDateTime(showDetail.createdAt, true) },
                  { label: 'Закрыта', value: formatDateTime(showDetail.closedAt, true) },
                  ...(showDetail.assetInventoryNo ? [{ label: 'Оборудование', value: showDetail.assetInventoryNo, mono: true }] : []),
                  ...(showDetail.softwareId ? [{ label: 'ПО', value: softwareMap[showDetail.softwareId] ?? `ПО #${showDetail.softwareId}` }] : []),
                  ...(showDetail.targetSoftwareVersion ? [{ label: 'Целевая версия', value: showDetail.targetSoftwareVersion }] : []),
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex gap-2">
                    <span className="font-medium text-slate-500 w-24 shrink-0">{label}:</span>
                    <span className={mono ? 'font-mono text-slate-900' : 'text-slate-900'}>{value}</span>
                  </div>
                ))}
              </div>
              {showDetail.justification && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Обоснование / ответ сотрудника:</p>
                  <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">{showDetail.justification}</div>
                </div>
              )}
              {showDetail.comment && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Комментарий исполнителя:</p>
                  <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">{showDetail.comment}</div>
                </div>
              )}
              {canManage && (
                <div className="flex gap-2 pt-2">
                  {!showDetail.assigneeEmployeeNo && (
                    <button onClick={() => { assignMutation.mutate(showDetail.ticketNo); setShowDetail(null) }}
                      className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium">
                      <UserCheck className="h-3.5 w-3.5" /> Взять в работу
                    </button>
                  )}
                  <button onClick={() => { setShowStatus(showDetail); setShowDetail(null); setFormError('') }}
                    className="text-xs border border-slate-300 hover:bg-indigo-50/40 px-3 py-1.5 rounded-lg font-medium text-slate-700">
                    Изменить статус
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatus && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Изменить статус – {showStatus.ticketNo}</h2>
              <button onClick={() => setShowStatus(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            {(showStatus.justification || showStatus.comment) && (
              <div className="px-6 pt-4 space-y-2">
                {showStatus.justification && (
                  <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-xs font-medium text-indigo-700 mb-0.5">Обоснование сотрудника:</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{showStatus.justification}</p>
                  </div>
                )}
                {showStatus.comment && (
                  <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs font-medium text-yellow-700 mb-0.5">Предыдущий комментарий:</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{showStatus.comment}</p>
                  </div>
                )}
              </div>
            )}
            <form onSubmit={handleStatusChange} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Новый статус *</label>
                <select required value={statusForm.statusName} onChange={(e) => setStatusForm({ ...statusForm, statusName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Выберите статус</option>
                  {(() => {
                    const cur = statusMap[showStatus.statusId] ?? ''
                    const allowedNames = ALLOWED_TRANSITIONS[cur] ?? statuses.map(s => s.name)
                    return statuses.filter(s => allowedNames.includes(s.name)).map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))
                  })()}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Комментарий</label>
                <textarea rows={2} value={statusForm.comment} onChange={(e) => setStatusForm({ ...statusForm, comment: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              {statusForm.statusName === 'Отклонена' && showStatus.type === 'Ремонт оборудования' && showStatus.assetInventoryNo && (
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <input type="checkbox" checked={statusForm.keepInRepair} onChange={(e) => setStatusForm({ ...statusForm, keepInRepair: e.target.checked })} className="rounded" />
                  <span>Оставить оборудование в статусе «Ремонт»</span>
                </label>
              )}
              {formError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowStatus(null)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button type="submit" disabled={statusMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg">
                  {statusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
