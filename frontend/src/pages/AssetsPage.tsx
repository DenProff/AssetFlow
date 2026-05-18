import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, Download, Pencil, Trash2, Tag, Check, Monitor, Upload } from 'lucide-react'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { Asset, AssetType, AssetStatus, OkofCode, AmortizationGroup } from '@/types'

interface SwInstall { id: number; softwareId: number; installedAt: string }
interface SwItem { id: number; name: string; version: string; licenseEnd: string | null; licenseStatus: string }
interface ImportResult { createdCount: number; failedCount: number; errors: { rowNo: number; message: string }[] }

const licenseColors: Record<string, string> = {
  'Активна': 'bg-green-100 text-green-700',
  'Истекает': 'bg-yellow-100 text-yellow-700',
  'Истекла': 'bg-red-100 text-red-700',
}

const statusColors: Record<string, string> = {
  'На складе': 'bg-indigo-100 text-indigo-700',
  'Эксплуатация': 'bg-green-100 text-green-700',
  'Ремонт': 'bg-yellow-100 text-yellow-700',
  'Списано': 'bg-red-100 text-red-700',
}

const emptyForm = { typeId: '', manufacturer: '', model: '', serialNumber: '', purchaseDate: '', cost: '', vendorName: '' }

function pluralYears(n: number) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'лет'
  if (mod10 === 1) return 'год'
  if (mod10 >= 2 && mod10 <= 4) return 'года'
  return 'лет'
}

export default function AssetsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importDragging, setImportDragging] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
  const [showCreateType, setShowCreateType] = useState(false)
  const [showTypesRef, setShowTypesRef] = useState(false)
  const [editingType, setEditingType] = useState<AssetType | null>(null)
  const [editTypeForm, setEditTypeForm] = useState({ name: '', defaultUsefulLifeYears: '5', okofCode: '' })
  const [editTypeOkofSearch, setEditTypeOkofSearch] = useState('')
  const [editTypeError, setEditTypeError] = useState('')
  const [deleteTypeTarget, setDeleteTypeTarget] = useState<AssetType | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [swViewAsset, setSwViewAsset] = useState<Asset | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [typeForm, setTypeForm] = useState({ name: '', defaultUsefulLifeYears: '5', okofCode: '' })
  const [okofSearch, setOkofSearch] = useState('')
  const [showNewOkof, setShowNewOkof] = useState(false)
  const [newOkofForm, setNewOkofForm] = useState({ code: '', name: '', groupNo: '' })
  const [newOkofError, setNewOkofError] = useState('')
  const [formError, setFormError] = useState('')
  const [typeFormError, setTypeFormError] = useState('')

  // Список активов перечитывается при изменении фильтра статуса или типа
  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ['assets', filterStatus, filterType],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filterStatus) params.append('statusId', filterStatus)
      if (filterType) params.append('typeId', filterType)
      return api.get<Asset[]>(`/assets?${params}`).then((r) => r.data)
    },
  })

  const { data: types = [] } = useQuery<AssetType[]>({
    queryKey: ['assetTypes'],
    queryFn: () => api.get<AssetType[]>('/reference/asset-types').then((r) => r.data),
  })

  const { data: statuses = [] } = useQuery<AssetStatus[]>({
    queryKey: ['assetStatuses'],
    queryFn: () => api.get<AssetStatus[]>('/reference/asset-statuses').then((r) => r.data),
  })

  const { data: okofList = [] } = useQuery<OkofCode[]>({
    queryKey: ['okofList'],
    queryFn: () => api.get<OkofCode[]>('/reference/okof').then((r) => r.data),
  })

  const { data: amortGroups = [] } = useQuery<AmortizationGroup[]>({
    queryKey: ['amortGroups'],
    queryFn: () => api.get<AmortizationGroup[]>('/reference/amortization-groups').then((r) => r.data),
  })

  const { data: allSoftware = [] } = useQuery<SwItem[]>({
    queryKey: ['software-list'],
    queryFn: () => api.get<SwItem[]>('/software').then((r) => r.data),
    // ПО загружается только когда открыта модалка установленного ПО
    enabled: !!swViewAsset,
  })
  const { data: assetInstalls = [] } = useQuery<SwInstall[]>({
    queryKey: ['asset-sw', swViewAsset?.inventoryNo],
    queryFn: () => api.get<SwInstall[]>(`/software/asset/${swViewAsset!.inventoryNo}/installations`).then((r) => r.data),
    // Установки конкретного актива не нужны до выбора актива
    enabled: !!swViewAsset,
  })
  const swMap = Object.fromEntries(allSoftware.map((s) => [s.id, s]))

  const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]))
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s.name]))

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/assets', body),
    onSuccess: () => {
      // После создания активов таблица перечитывается из backend
      qc.invalidateQueries({ queryKey: ['assets'] })
      setShowCreate(false); setForm(emptyForm); setFormError('')
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ inv, body }: { inv: string; body: object }) => api.put(`/assets/${inv}`, body),
    onSuccess: () => {
      // После редактирования обновляем кэш списка активов
      qc.invalidateQueries({ queryKey: ['assets'] })
      setEditAsset(null); setForm(emptyForm); setFormError('')
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка'),
  })

  const deleteMutation = useMutation({
    mutationFn: (inv: string) => api.delete(`/assets/${inv}`),
    onSuccess: () => {
      // Удалённый актив должен исчезнуть из таблицы
      qc.invalidateQueries({ queryKey: ['assets'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Ошибка удаления'),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const data = new FormData()
      data.append('file', file)
      return api.post<ImportResult>('/assets/import/csv', data, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      setImportResult(res.data)
      setImportError('')
    },
    onError: (e: any) => {
      setImportResult(null)
      setImportError(e.response?.data?.message ?? 'Ошибка импорта')
    },
  })

  const createTypeMutation = useMutation({
    mutationFn: (body: object) => api.post('/reference/asset-types', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['assetTypes'] })
      const created = res.data as AssetType
      setForm((f) => ({ ...f, typeId: String(created.id) }))
      setShowCreateType(false)
      setTypeForm({ name: '', defaultUsefulLifeYears: '5', okofCode: '' })
      setOkofSearch(''); setShowNewOkof(false); setNewOkofForm({ code: '', name: '', groupNo: '' })
      setTypeFormError('')
    },
    onError: (e: any) => setTypeFormError(e.response?.data?.message ?? 'Ошибка'),
  })

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.put(`/reference/asset-types/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assetTypes'] })
      setEditingType(null); setEditTypeForm({ name: '', defaultUsefulLifeYears: '5', okofCode: '' })
      setEditTypeOkofSearch(''); setEditTypeError('')
    },
    onError: (e: any) => setEditTypeError(e.response?.data?.message ?? 'Ошибка'),
  })

  const deleteTypeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/reference/asset-types/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assetTypes'] })
      setDeleteTypeTarget(null)
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Ошибка удаления'),
  })

  const openEditType = (t: AssetType) => {
    setEditingType(t)
    setEditTypeForm({ name: t.name, defaultUsefulLifeYears: String(t.defaultUsefulLifeYears), okofCode: t.okofCode ?? '' })
    setEditTypeOkofSearch(''); setEditTypeError('')
  }

  const createOkofMutation = useMutation({
    mutationFn: (body: object) => api.post('/reference/okof', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['okofList'] })
      setTypeForm((f) => ({ ...f, okofCode: (res.data as OkofCode).code }))
      setShowNewOkof(false); setNewOkofForm({ code: '', name: '', groupNo: '' }); setNewOkofError('')
    },
    onError: (e: any) => setNewOkofError(e.response?.data?.message ?? 'Ошибка'),
  })

  const [patchStatusTarget, setPatchStatusTarget] = useState<Asset | null>(null)
  const [patchStatusNew, setPatchStatusNew] = useState('')
  const [patchStatusError, setPatchStatusError] = useState('')

  const patchStatusMutation = useMutation({
    mutationFn: ({ inv, statusName }: { inv: string; statusName: string }) =>
      api.patch(`/assets/${inv}/status`, { statusName }),
    // Ручная смена статуса сразу обновляет таблицу активов
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setPatchStatusTarget(null); setPatchStatusNew(''); setPatchStatusError('') },
    onError: (e: any) => setPatchStatusError(e.response?.data?.message ?? 'Ошибка'),
  })

  const openEdit = (a: Asset) => {
    setEditAsset(a)
    setForm({
      typeId: String(a.typeId), manufacturer: a.manufacturer, model: a.model,
      serialNumber: a.serialNumber, purchaseDate: a.purchaseDate,
      cost: a.cost != null ? String(parseFloat(String(a.cost))) : '', vendorName: a.vendorName ?? '',
    })
    setFormError('')
  }

  const handleSubmit = (ev: React.FormEvent, isEdit: boolean) => {
    ev.preventDefault()
    // Frontend приводит строковые значения формы к типам, которые ждёт backend
    const body = {
      typeId: Number(form.typeId), manufacturer: form.manufacturer, model: form.model,
      serialNumber: form.serialNumber, purchaseDate: form.purchaseDate,
      cost: Number(form.cost.replace(',', '.')), vendorName: form.vendorName || null,
    }
    if (isEdit && editAsset) updateMutation.mutate({ inv: editAsset.inventoryNo, body })
    else createMutation.mutate(body)
  }

  const openImport = () => {
    setShowImport(true)
    setImportFile(null)
    setImportDragging(false)
    setImportResult(null)
    setImportError('')
  }

  const selectImportFile = (file: File | null) => {
    setImportFile(file)
    setImportResult(null)
    setImportError('')
  }

  const handleImportDrop = (ev: React.DragEvent<HTMLLabelElement>) => {
    ev.preventDefault()
    setImportDragging(false)
    selectImportFile(ev.dataTransfer.files?.[0] ?? null)
  }

  const handleImport = () => {
    if (!importFile) {
      setImportError('Выберите CSV-файл')
      return
    }
    importMutation.mutate(importFile)
  }

  const triggerDownload = (path: string, filename: string, mime: string) => {
    // Файлы ОС-1 скачиваются как blob, чтобы браузер сохранил их с нужным именем
    api.get(path, { responseType: 'blob' })
      .then((r) => {
        const url = URL.createObjectURL(new Blob([r.data], { type: mime }))
        const link = document.createElement('a')
        link.href = url; link.download = filename
        document.body.appendChild(link); link.click()
        document.body.removeChild(link); URL.revokeObjectURL(url)
      })
      .catch(() => alert('Ошибка скачивания файла'))
  }

  const assetFormJSX = (isEdit: boolean, onClose: () => void) => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? 'Редактировать оборудование' : 'Новое оборудование'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={(e) => handleSubmit(e, isEdit)} className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">Тип оборудования *</label>
              <button type="button" onClick={() => setShowCreateType(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Добавить тип
              </button>
            </div>
            <select required value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Выберите тип</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name} – {t.defaultUsefulLifeYears} {pluralYears(t.defaultUsefulLifeYears)}{t.okofCode ? ` (ОКОФ ${t.okofCode})` : ''}</option>)}
            </select>
            {form.typeId && (() => {
              const st = types.find((t) => String(t.id) === form.typeId)
              return st?.okofCode ? (
                <div className="mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex gap-3">
                  <span><span className="font-medium">ОКОФ:</span> {st.okofCode}</span>
                  {st.amortizationGroupNo && <span><span className="font-medium">Ам. группа:</span> {st.amortizationGroupNo}</span>}
                  <span><span className="font-medium">СПИ:</span> {st.defaultUsefulLifeYears} {pluralYears(st.defaultUsefulLifeYears)}</span>
                </div>
              ) : null
            })()}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Производитель *</label>
              <input required value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Модель *</label>
              <input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Серийный номер *</label>
            <input required value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Поставщик</label>
            <input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
              placeholder="Например: ООО Техно-Поставка"
              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Дата покупки *</label>
              <input required type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Стоимость (₽) *</label>
              <input required type="text" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {formError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Оборудование</h1>
          <p className="text-sm text-slate-500 mt-0.5">Учёт IT-оборудования</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTypesRef(true)}
            className="flex items-center gap-2 border border-slate-300 text-slate-700 hover:bg-indigo-50/40 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Tag className="h-4 w-4" /> Типы
          </button>
          <button onClick={openImport}
            className="flex items-center gap-2 border border-slate-300 text-slate-700 hover:bg-indigo-50/40 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Upload className="h-4 w-4" /> Импорт CSV
          </button>
          <button onClick={() => { setShowCreate(true); setForm(emptyForm); setFormError('') }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="h-4 w-4" /> Добавить
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); e.currentTarget.blur() }}
          className="h-10 min-w-[180px] border border-slate-300 rounded-lg text-sm px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Все статусы</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); e.currentTarget.blur() }}
          className="h-10 min-w-[220px] border border-slate-300 rounded-lg text-sm px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Все типы</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {(filterStatus || filterType) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterType('') }}
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
        ) : assets.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">Оборудование не найдено</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Инв. номер</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Тип</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Производитель / Модель</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">С/н</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Дата покупки</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Стоимость</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Статус</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">ОС-1</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((a) => (
                <tr key={a.inventoryNo} className="hover:bg-indigo-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{a.inventoryNo}</td>
                  <td className="px-4 py-3 text-slate-700">{typeMap[a.typeId] ?? a.typeId}</td>
                  <td className="px-4 py-3 text-slate-900">{a.manufacturer} {a.model}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.serialNumber}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(a.purchaseDate)}</td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums text-xs">
                    {a.cost != null ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(a.cost) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {statusMap[a.statusId] !== 'Списано' ? (
                      <button onClick={() => { setPatchStatusTarget(a); setPatchStatusNew(''); setPatchStatusError('') }}
                        title="Изменить статус"
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-75 transition-opacity ${statusColors[statusMap[a.statusId]] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusMap[a.statusId] ?? a.statusId}
                      </button>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[statusMap[a.statusId]] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusMap[a.statusId] ?? a.statusId}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.receiptActNo && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => triggerDownload(`/assets/${a.inventoryNo}/os1`, `${a.receiptActNo}.xls`, 'application/vnd.ms-excel')}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                          <Download className="h-3.5 w-3.5" /> XLS
                        </button>
                        <button onClick={() => triggerDownload(`/assets/${a.inventoryNo}/os1/pdf`, `${a.receiptActNo}.pdf`, 'application/pdf')}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium">
                          <Download className="h-3.5 w-3.5" /> PDF
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSwViewAsset(a)} title="Установленное ПО"
                        className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <Monitor className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => openEdit(a)} title="Редактировать"
                        className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(a)} title="Удалить"
                        className="text-slate-400 hover:text-red-600 transition-colors">
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

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Импорт оборудования из CSV</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <p className="font-medium text-slate-800 mb-1">Формат файла</p>
                <p className="text-xs font-mono break-all">typeId,manufacturer,model,serialNumber,purchaseDate,cost,vendorName</p>
                <p className="text-xs text-slate-500 mt-2">Дата покупки указывается в формате YYYY-MM-DD</p>
              </div>
              <button
                type="button"
                onClick={() => triggerDownload('/assets/import/template', 'assets-import-template.csv', 'text/csv')}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Download className="h-4 w-4" />
                Скачать шаблон CSV
              </button>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">CSV-файл *</label>
                <label
                  onDragOver={(e) => {
                    e.preventDefault()
                    setImportDragging(true)
                  }}
                  onDragLeave={() => setImportDragging(false)}
                  onDrop={handleImportDrop}
                  className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                    importDragging
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : importFile
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : 'border-slate-300 bg-white text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/40'
                  }`}
                >
                  <Upload className={`h-8 w-8 mb-3 ${importDragging ? 'text-indigo-500' : importFile ? 'text-green-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-medium">
                    {importDragging ? 'Отпустите файл для загрузки' : importFile ? importFile.name : 'Перетащите CSV сюда или нажмите для выбора'}
                  </span>
                  <span className="text-xs mt-1 text-slate-400">Поддерживается файл .csv</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => selectImportFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>
              {importError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{importError}</p>}
              {importResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm">
                  <p className="text-slate-700">
                    Создано: <span className="font-semibold text-green-700">{importResult.createdCount}</span>, ошибок: <span className="font-semibold text-red-700">{importResult.failedCount}</span>
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                      {importResult.errors.map((err) => (
                        <p key={`${err.rowNo}-${err.message}`} className="text-xs text-red-700">
                          Строка {err.rowNo}: {err.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowImport(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Закрыть</button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!importFile || importMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg"
                >
                  {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Импортировать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Software View Modal */}
      {swViewAsset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-indigo-500" />
                  Установленное ПО
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{swViewAsset.inventoryNo} – {swViewAsset.manufacturer} {swViewAsset.model}</p>
              </div>
              <button onClick={() => setSwViewAsset(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {assetInstalls.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">На данном устройстве ПО не установлено</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Название</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Версия</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Лицензия до</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assetInstalls.map((inst) => {
                      const sw = swMap[inst.softwareId]
                      return (
                        <tr key={inst.id} className="hover:bg-indigo-50/40">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{sw?.name ?? `ПО #${inst.softwareId}`}</td>
                          <td className="px-4 py-2.5 text-slate-500">{sw?.version ?? '–'}</td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">
                            {sw?.licenseEnd ? formatDate(sw.licenseEnd) : <span className="text-green-600">Бессрочная</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            {sw ? (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${licenseColors[sw.licenseStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                                {sw.licenseStatus}
                              </span>
                            ) : '–'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreate && assetFormJSX(false, () => { setShowCreate(false); setForm(emptyForm); setFormError('') })}
      {editAsset && assetFormJSX(true, () => { setEditAsset(null); setForm(emptyForm); setFormError('') })}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Удалить оборудование?</h2>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-mono font-semibold">{deleteTarget.inventoryNo}</span> – {deleteTarget.manufacturer} {deleteTarget.model}
              <br />Можно удалить только оборудование со статусом «На складе».
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.inventoryNo)} disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium py-2 rounded-lg">
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Asset Type Modal */}
      {showCreateType && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Новый тип оборудования</h2>
              <button onClick={() => setShowCreateType(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => {
                e.preventDefault()
                createTypeMutation.mutate({
                  name: typeForm.name,
                  defaultUsefulLifeYears: Number(typeForm.defaultUsefulLifeYears),
                  okofCode: typeForm.okofCode || null,
                })
              }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Название *</label>
                <input required value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  placeholder="Например: Сервер"
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Код ОКОФ</label>
                  <button type="button" onClick={() => { setShowNewOkof((v) => !v); setNewOkofError('') }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5">
                    <Plus className="h-3 w-3" /> Свой код
                  </button>
                </div>
                {showNewOkof ? (
                  <div className="border border-indigo-200 rounded-lg p-3 space-y-2 bg-indigo-50">
                    <p className="text-xs font-medium text-indigo-700">Новый код ОКОФ</p>
                    <input value={newOkofForm.code} onChange={(e) => setNewOkofForm({ ...newOkofForm, code: e.target.value })}
                      placeholder="320.26.20.XX" maxLength={32}
                      className="w-full border border-slate-300 rounded text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <input value={newOkofForm.name} onChange={(e) => setNewOkofForm({ ...newOkofForm, name: e.target.value })}
                      placeholder="Название объекта"
                      className="w-full border border-slate-300 rounded text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <select value={newOkofForm.groupNo} onChange={(e) => setNewOkofForm({ ...newOkofForm, groupNo: e.target.value })}
                      className="w-full border border-slate-300 rounded text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                      <option value="">Амортизационная группа *</option>
                      {amortGroups.map((g) => (
                        <option key={g.groupNo} value={g.groupNo}>Гр. {g.groupNo} – {g.description}</option>
                      ))}
                    </select>
                    {newOkofError && <p className="text-red-600 text-xs">{newOkofError}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setShowNewOkof(false); setNewOkofError('') }}
                        className="flex-1 border border-slate-300 text-slate-600 text-xs py-1 rounded hover:bg-indigo-50/40">Отмена</button>
                      <button type="button" disabled={createOkofMutation.isPending}
                        onClick={() => {
                          if (!newOkofForm.code.trim() || !newOkofForm.name.trim() || !newOkofForm.groupNo) {
                            setNewOkofError('Заполните все поля')
                            return
                          }
                          createOkofMutation.mutate({ code: newOkofForm.code.trim(), name: newOkofForm.name.trim(), amortizationGroupNo: Number(newOkofForm.groupNo) })
                        }}
                        className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs py-1 rounded">
                        {createOkofMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        Добавить
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input value={okofSearch} onChange={(e) => setOkofSearch(e.target.value)}
                      placeholder="Фильтр по коду или названию..."
                      className="w-full border border-slate-300 rounded-t-lg text-xs px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 border-b-0" />
                    <div className="border border-slate-300 rounded-b-lg max-h-36 overflow-y-auto divide-y divide-slate-100">
                      <div onClick={() => setTypeForm({ ...typeForm, okofCode: '' })}
                        className={`cursor-pointer px-3 py-1.5 text-xs select-none ${!typeForm.okofCode ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-400 hover:bg-indigo-50/40'}`}>
                        – Не указан –
                      </div>
                      {okofList
                        .filter((o) => !okofSearch || o.code.includes(okofSearch) || o.name.toLowerCase().includes(okofSearch.toLowerCase()))
                        .map((o) => (
                          <div key={o.code} onClick={() => setTypeForm({ ...typeForm, okofCode: o.code })}
                            className={`cursor-pointer px-3 py-1.5 text-xs select-none leading-snug ${typeForm.okofCode === o.code ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-indigo-50/40 text-slate-800'}`}>
                            <span className="font-mono font-semibold">{o.code}</span>
                            <span className="text-slate-500"> – {o.name}</span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
              {typeForm.okofCode && (() => {
                const selected = okofList.find((o) => o.code === typeForm.okofCode)
                return selected ? (
                  <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800">
                    <span className="font-medium">Амортизационная группа {selected.amortizationGroup.groupNo}</span>
                    {' – '}{selected.amortizationGroup.description}
                  </div>
                ) : null
              })()}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Срок полезного использования (лет) *</label>
                <input required type="number" min="1" max="50" value={typeForm.defaultUsefulLifeYears}
                  onChange={(e) => setTypeForm({ ...typeForm, defaultUsefulLifeYears: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {typeFormError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{typeFormError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateType(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button type="submit" disabled={createTypeMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg">
                  {createTypeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Types Reference Modal */}
      {showTypesRef && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Справочник типов оборудования</h2>
                <p className="text-xs text-slate-400 mt-0.5">Типов: {types.length}</p>
              </div>
              <button onClick={() => setShowTypesRef(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 w-36">Тип</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Код ОКОФ</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Название объекта</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 w-44">Ам. группа</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 w-24">СПИ (лет)</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {types.map((t) => (
                    <tr key={t.id} className="hover:bg-indigo-50/40">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{t.name}</td>
                      <td className="px-4 py-2.5">
                        {t.okof
                          ? <span className="font-mono text-xs font-semibold text-indigo-700">{t.okof.code}</span>
                          : <span className="text-slate-300 text-xs">–</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {t.okof ? t.okof.name : <span className="text-slate-300">–</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {t.okof ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                            Гр. {t.okof.amortizationGroup.groupNo} – {t.okof.amortizationGroup.description.replace(/Группа [0-9]+/, '').replace(/^десятая /, '').trim()}
                          </span>
                        ) : <span className="text-slate-300">–</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 text-center">{t.defaultUsefulLifeYears}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEditType(t)} title="Редактировать"
                            className="text-slate-400 hover:text-indigo-600 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteTypeTarget(t)} title="Удалить"
                            className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-200 shrink-0">
              <button onClick={() => { setShowTypesRef(false); setShowCreateType(true) }}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                <Plus className="h-4 w-4" /> Добавить новый тип
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Type Modal */}
      {editingType && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Редактировать тип</h2>
              <button onClick={() => setEditingType(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => {
                e.preventDefault()
                updateTypeMutation.mutate({
                  id: editingType.id,
                  body: { name: editTypeForm.name, defaultUsefulLifeYears: Number(editTypeForm.defaultUsefulLifeYears), okofCode: editTypeForm.okofCode || null },
                })
              }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Название *</label>
                <input required value={editTypeForm.name} onChange={(e) => setEditTypeForm({ ...editTypeForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Код ОКОФ</label>
                <input value={editTypeOkofSearch} onChange={(e) => setEditTypeOkofSearch(e.target.value)}
                  placeholder="Фильтр..."
                  className="w-full border border-slate-300 rounded-t-lg text-xs px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 border-b-0" />
                <div className="border border-slate-300 rounded-b-lg max-h-32 overflow-y-auto divide-y divide-slate-100">
                  <div onClick={() => setEditTypeForm({ ...editTypeForm, okofCode: '' })}
                    className={`cursor-pointer px-3 py-1.5 text-xs select-none ${!editTypeForm.okofCode ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-400 hover:bg-indigo-50/40'}`}>
                    – Не указан –
                  </div>
                  {okofList
                    .filter((o) => !editTypeOkofSearch || o.code.includes(editTypeOkofSearch) || o.name.toLowerCase().includes(editTypeOkofSearch.toLowerCase()))
                    .map((o) => (
                      <div key={o.code} onClick={() => setEditTypeForm({ ...editTypeForm, okofCode: o.code })}
                        className={`cursor-pointer px-3 py-1.5 text-xs select-none leading-snug ${editTypeForm.okofCode === o.code ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-indigo-50/40 text-slate-800'}`}>
                        <span className="font-mono font-semibold">{o.code}</span>
                        <span className="text-slate-500"> – {o.name}</span>
                      </div>
                    ))}
                </div>
                {editTypeForm.okofCode && (() => {
                  const sel = okofList.find((o) => o.code === editTypeForm.okofCode)
                  return sel ? (
                    <div className="mt-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800">
                      <span className="font-medium">Гр. {sel.amortizationGroup.groupNo}</span> – {sel.amortizationGroup.description}
                    </div>
                  ) : null
                })()}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Срок полезного использования (лет) *</label>
                <input required type="number" min="1" max="50" value={editTypeForm.defaultUsefulLifeYears}
                  onChange={(e) => setEditTypeForm({ ...editTypeForm, defaultUsefulLifeYears: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {editTypeError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{editTypeError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingType(null)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button type="submit" disabled={updateTypeMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg">
                  {updateTypeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Type Confirm */}
      {deleteTypeTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Удалить тип?</h2>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-semibold text-slate-800">{deleteTypeTarget.name}</span>
              <br />Нельзя удалить тип, если есть оборудование данного типа.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTypeTarget(null)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
              <button onClick={() => deleteTypeMutation.mutate(deleteTypeTarget.id)} disabled={deleteTypeMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium py-2 rounded-lg">
                {deleteTypeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patch Status Modal */}
      {patchStatusTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Изменить статус</h2>
            <p className="text-xs text-slate-400 mb-4">{patchStatusTarget.inventoryNo} – {patchStatusTarget.manufacturer} {patchStatusTarget.model}</p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">Новый статус *</label>
              <select value={patchStatusNew} onChange={(e) => setPatchStatusNew(e.target.value)}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Выберите статус</option>
                {statusMap[patchStatusTarget.statusId] === 'Ремонт' && <>
                  <option value="На складе">На складе</option>
                  <option value="Эксплуатация">Эксплуатация (вернуть сотруднику)</option>
                </>}
                {statusMap[patchStatusTarget.statusId] !== 'Ремонт' && (
                  <option value="Ремонт">Ремонт</option>
                )}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                {statusMap[patchStatusTarget.statusId] === 'Эксплуатация'
                  ? 'Возврат на склад выполняется через акт возврата'
                  : statusMap[patchStatusTarget.statusId] === 'Ремонт'
                  ? 'Возврат в эксплуатацию доступен при наличии открытого акта выдачи'
                  : 'Выдача и списание доступны в разделе актов'}
              </p>
            </div>
            {patchStatusError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg mb-3">{patchStatusError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setPatchStatusTarget(null)} className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
              <button onClick={() => { if (patchStatusNew) patchStatusMutation.mutate({ inv: patchStatusTarget.inventoryNo, statusName: patchStatusNew }) }}
                disabled={!patchStatusNew || patchStatusMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium py-2 rounded-lg">
                {patchStatusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
