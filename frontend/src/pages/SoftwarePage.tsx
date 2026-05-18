import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, Monitor, Trash2, Download, Pencil } from 'lucide-react'
import api from '@/lib/api'
import type { Asset, AssetType, AssetStatus } from '@/types'

interface Software {
  id: number
  name: string
  version: string
  licenseTypeId: number
  licenseIdentifier: string | null
  licenseStart: string | null
  licenseEnd: string | null
  licenseStatus: string
}

interface LicenseType { id: number; name: string }
interface LicenseStatus { id: number; name: string }
interface Installation { id: number; assetInventoryNo: string; softwareId: number; installedAt: string; installedVersion: string; updatedAt: string | null }

const licenseStatusColors: Record<string, string> = {
  'Активна': 'bg-green-100 text-green-700',
  'Истекает': 'bg-yellow-100 text-yellow-700',
  'Истекла': 'bg-red-100 text-red-700',
}

export default function SoftwarePage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editSw, setEditSw] = useState<Software | null>(null)
  const [selectedSw, setSelectedSw] = useState<Software | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [installInventory, setInstallInventory] = useState('')
  const [formError, setFormError] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterLicenseType, setFilterLicenseType] = useState('')
  const emptyForm = {
    name: '', version: '', licenseTypeId: '',
    licenseIdentifier: '', licenseStart: '', licenseEnd: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)

  const { data: software = [], isLoading } = useQuery<Software[]>({
    queryKey: ['software'],
    queryFn: () => api.get<Software[]>('/software').then((r) => r.data),
  })

  const { data: licenseTypes = [] } = useQuery<LicenseType[]>({
    queryKey: ['licenseTypes'],
    queryFn: () => api.get<LicenseType[]>('/reference/license-types').then((r) => r.data),
  })

  const { data: licenseStatuses = [] } = useQuery<LicenseStatus[]>({
    queryKey: ['licenseStatuses'],
    queryFn: () => api.get<LicenseStatus[]>('/reference/license-statuses').then((r) => r.data),
  })

  const { data: assetTypes = [] } = useQuery<AssetType[]>({
    queryKey: ['assetTypes'],
    queryFn: () => api.get<AssetType[]>('/reference/asset-types').then((r) => r.data),
  })

  const { data: assetStatuses = [] } = useQuery<AssetStatus[]>({
    queryKey: ['assetStatuses'],
    queryFn: () => api.get<AssetStatus[]>('/reference/asset-statuses').then((r) => r.data),
  })

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: () => api.get<Asset[]>('/assets').then((r) => r.data),
  })

  const { data: installations = [] } = useQuery<Installation[]>({
    queryKey: ['installations', selectedSw?.id],
    queryFn: () => api.get<Installation[]>(`/software/${selectedSw!.id}/installations`).then((r) => r.data),
    // Установки загружаются только после выбора конкретного ПО
    enabled: !!selectedSw,
  })

  const licenseTypeMap = Object.fromEntries(licenseTypes.map((t) => [t.id, t.name]))
  const assetTypeMap = Object.fromEntries(assetTypes.map((t) => [t.id, t.name]))
  const assetStatusMap = Object.fromEntries(assetStatuses.map((s) => [s.id, s.name]))
  // Активы с уже установленным выбранным ПО скрываются из списка установки
  const installedInventories = new Set(installations.map((i) => i.assetInventoryNo))
  const installedProductInventories = new Set(
    installations
      .filter((i) => software.find((s) => s.id === i.softwareId)?.name === selectedSw?.name)
      .map((i) => i.assetInventoryNo)
  )
  // Фильтрация выполняется на frontend по уже загруженному реестру ПО
  const filteredSoftware = software.filter((s) => {
    const matchesStatus = !filterStatus || s.licenseStatus === filterStatus
    const matchesLicenseType = !filterLicenseType || String(s.licenseTypeId) === filterLicenseType
    return matchesStatus && matchesLicenseType
  })

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/software', body),
    onSuccess: () => {
      // После создания перечитываем реестр ПО
      qc.invalidateQueries({ queryKey: ['software'] })
      setShowCreate(false); setForm(emptyForm); setFormError('')
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.put(`/software/${id}`, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['software'] })
      setSelectedSw(res.data)
      setEditSw(null); setFormError('')
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/software/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['software'] })
      setSelectedSw(null)
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Ошибка удаления'),
  })

  const installMutation = useMutation({
    mutationFn: ({ id, inventoryNo }: { id: number; inventoryNo: string }) =>
      api.post(`/software/${id}/install`, { assetInventoryNo: inventoryNo }),
    onSuccess: () => {
      // После установки перечитываем список активов, где установлено выбранное ПО
      qc.invalidateQueries({ queryKey: ['installations', selectedSw?.id] })
      setShowInstall(false)
      setInstallInventory('')
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Ошибка установки'),
  })

  const uninstallMutation = useMutation({
    mutationFn: ({ id, inventoryNo }: { id: number; inventoryNo: string }) =>
      api.delete(`/software/${id}/install/${inventoryNo}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installations', selectedSw?.id] }),
  })

  const buildBody = (f: typeof emptyForm) => ({
    // Frontend приводит значения формы к структуре, которую ждёт backend
    name: f.name, version: f.version, licenseTypeId: Number(f.licenseTypeId),
    licenseIdentifier: f.licenseIdentifier || null,
    licenseStart: f.licenseStart || null, licenseEnd: f.licenseEnd || null,
  })

  const validateDates = (f: typeof emptyForm): string | null => {
    // Базовая проверка дат нужна до отправки запроса на backend
    if (f.licenseStart && f.licenseEnd && f.licenseEnd < f.licenseStart)
      return 'Дата окончания не может быть раньше даты начала'
    return null
  }

  const handleCreate = (ev: React.FormEvent) => {
    ev.preventDefault()
    const err = validateDates(form)
    if (err) { setFormError(err); return }
    setFormError('')
    createMutation.mutate(buildBody(form))
  }

  const handleUpdate = (ev: React.FormEvent) => {
    ev.preventDefault()
    const err = validateDates(editForm)
    if (err) { setFormError(err); return }
    setFormError('')
    if (editSw) updateMutation.mutate({ id: editSw.id, body: buildBody(editForm) })
  }

  const openEdit = (sw: Software) => {
    setEditSw(sw)
    setEditForm({
      name: sw.name, version: sw.version, licenseTypeId: String(sw.licenseTypeId),
      licenseIdentifier: sw.licenseIdentifier ?? '', licenseStart: sw.licenseStart ?? '', licenseEnd: sw.licenseEnd ?? '',
    })
    setFormError('')
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Left: software list */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Программное обеспечение</h1>
            <p className="text-sm text-slate-500 mt-0.5">Реестр ПО и лицензий</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Plus className="h-4 w-4" />
            Добавить ПО
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); e.currentTarget.blur() }}
            className="h-10 min-w-[180px] border border-slate-300 rounded-lg text-sm px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Все статусы</option>
            {licenseStatuses.map((status) => (
              <option key={status.id} value={status.name}>{status.name}</option>
            ))}
          </select>
          <select
            value={filterLicenseType}
            onChange={(e) => { setFilterLicenseType(e.target.value); e.currentTarget.blur() }}
            className="h-10 min-w-[220px] border border-slate-300 rounded-lg text-sm px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Все типы лицензий</option>
            {licenseTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
          {(filterStatus || filterLicenseType) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterLicenseType('') }}
              className="h-10 px-3 text-sm text-slate-500 hover:text-indigo-600"
            >
              Сбросить
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : software.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">ПО не зарегистрировано</div>
          ) : filteredSoftware.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">ПО по выбранным фильтрам не найдено</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Название</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Версия</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Тип лицензии</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Срок действия</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSoftware.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSw(s)}
                    className={`cursor-pointer hover:bg-indigo-50/40 transition-colors ${selectedSw?.id === s.id ? 'bg-indigo-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.version}</td>
                    <td className="px-4 py-3 text-slate-500">{licenseTypeMap[s.licenseTypeId] ?? s.licenseTypeId}</td>
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
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(s)} title="Редактировать"
                          className="text-slate-400 hover:text-indigo-600 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { if (confirm(`Удалить «${s.name}»?`)) deleteMutation.mutate(s.id) }}
                          disabled={deleteMutation.isPending}
                          title="Удалить"
                          className="text-slate-400 hover:text-red-600 transition-colors disabled:opacity-30">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right: installations panel */}
      {selectedSw && (
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{selectedSw.name}</h3>
                <p className="text-xs text-slate-400">{selectedSw.version}</p>
              </div>
              <button onClick={() => setSelectedSw(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="space-y-1 mb-3 text-xs">
                {selectedSw.licenseIdentifier && (
                  <div className="text-slate-500"><span className="font-medium">Ключ:</span> {selectedSw.licenseIdentifier}</div>
                )}
                <div className="text-slate-500">
                  <span className="font-medium">Срок:</span>{' '}
                  {selectedSw.licenseStart && <span>{formatDate(selectedSw.licenseStart)} – </span>}
                  {selectedSw.licenseEnd
                    ? <span className={new Date(selectedSw.licenseEnd) < new Date() ? 'text-red-600 font-semibold' : 'text-slate-700'}>{formatDate(selectedSw.licenseEnd)}</span>
                    : <span className="text-green-700 font-semibold">бессрочная</span>}
                </div>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500 uppercase">Установлено на</span>
                <button
                  onClick={() => setShowInstall(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Установить
                </button>
              </div>
              {installations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Нигде не установлено</p>
              ) : (
                <div className="space-y-2">
                  {installations.map((inst) => {
                    const asset = assets.find((a) => a.inventoryNo === inst.assetInventoryNo)
                    return (
                      <div key={inst.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-xs font-mono font-semibold text-indigo-700">{inst.assetInventoryNo}</p>
                          {asset && <p className="text-xs text-slate-400">{assetTypeMap[asset.typeId]} {asset.model}</p>}
                          <p className="text-xs text-slate-400">Версия: {inst.installedVersion}</p>
                          <p className="text-xs text-slate-400">Обновлено: {formatDate(inst.updatedAt)}</p>
                        </div>
                        <button
                          onClick={() => uninstallMutation.mutate({ id: selectedSw.id, inventoryNo: inst.assetInventoryNo })}
                          className="text-slate-300 hover:text-red-500"
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editSw && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Редактировать ПО</h2>
              <button onClick={() => setEditSw(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Название *</label>
                  <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Версия *</label>
                  <input required value={editForm.version} onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Тип лицензии *</label>
                <select required value={editForm.licenseTypeId} onChange={(e) => setEditForm({ ...editForm, licenseTypeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Выберите тип</option>
                  {licenseTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Идентификатор лицензии</label>
                <input value={editForm.licenseIdentifier} onChange={(e) => setEditForm({ ...editForm, licenseIdentifier: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {(() => {
                const selectedType = licenseTypes.find((t) => String(t.id) === editForm.licenseTypeId)
                const isPerpetual = selectedType?.name === 'Бессрочная'
                return !isPerpetual ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Начало действия</label>
                      <input type="date" value={editForm.licenseStart} onChange={(e) => setEditForm({ ...editForm, licenseStart: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Окончание действия</label>
                      <input type="date" value={editForm.licenseEnd} onChange={(e) => setEditForm({ ...editForm, licenseEnd: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                ) : null
              })()}
              {editForm.licenseEnd && editForm.licenseEnd < new Date().toISOString().slice(0, 10) && (
                <p className="text-yellow-700 text-xs bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg">⚠️ Дата окончания лицензии уже прошла — новая установка будет заблокирована</p>
              )}
              {formError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditSw(null)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg">
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Новое ПО</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Название *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Версия *</label>
                  <input required value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })}
                    placeholder="1.0.0"
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Тип лицензии *</label>
                <select required value={form.licenseTypeId} onChange={(e) => setForm({ ...form, licenseTypeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Выберите тип</option>
                  {licenseTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Идентификатор лицензии</label>
                <input value={form.licenseIdentifier} onChange={(e) => setForm({ ...form, licenseIdentifier: e.target.value })}
                  placeholder="XXXX-XXXX-XXXX"
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {(() => {
                const selectedType = licenseTypes.find((t) => String(t.id) === form.licenseTypeId)
                const isPerpetual = selectedType?.name === 'Бессрочная'
                return !isPerpetual ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Начало действия</label>
                      <input type="date" value={form.licenseStart} onChange={(e) => setForm({ ...form, licenseStart: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Окончание действия</label>
                      <input type="date" value={form.licenseEnd} onChange={(e) => setForm({ ...form, licenseEnd: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                ) : null
              })()}
              {form.licenseEnd && form.licenseEnd < new Date().toISOString().slice(0, 10) && (
                <p className="text-yellow-700 text-xs bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg">⚠️ Дата окончания лицензии уже прошла — новая установка будет заблокирована</p>
              )}
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

      {/* Install modal */}
      {showInstall && selectedSw && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Установить {selectedSw.name}</h2>
              <button onClick={() => setShowInstall(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Выберите оборудование *</label>
                <select
                  value={installInventory}
                  onChange={(e) => setInstallInventory(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">– выберите –</option>
                  {assets
                    .filter((a) => assetStatusMap[a.statusId] !== 'Списано')
                    .filter((a) => !installedInventories.has(a.inventoryNo))
                    .filter((a) => !installedProductInventories.has(a.inventoryNo))
                    .map((a) => (
                      <option key={a.inventoryNo} value={a.inventoryNo}>
                        {a.inventoryNo} – {assetTypeMap[a.typeId]} {a.manufacturer} {a.model}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowInstall(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button
                  onClick={() => installInventory && installMutation.mutate({ id: selectedSw.id, inventoryNo: installInventory })}
                  disabled={!installInventory || installMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg"
                >
                  {installMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Установить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
