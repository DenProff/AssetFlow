import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, Download, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useMe } from '@/hooks/useMe'
import type { AssetMovementAct, AssetWriteOffAct, Asset, Employee, AssetType, AssetStatus } from '@/types'

const WRITE_OFF_REASONS = [
  'Физический износ',
  'Моральное устаревание',
  'Механическое повреждение',
  'Утеря',
  'Хищение',
]

export default function ActsPage() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const canWriteOff = me?.role === 'IT_MANAGER'
  const [tab, setTab] = useState<'issue' | 'writeoff'>('issue')

  const [showIssue, setShowIssue] = useState(false)
  const [showWriteOff, setShowWriteOff] = useState(false)
  const [showReturn, setShowReturn] = useState<AssetMovementAct | null>(null)
  const [formError, setFormError] = useState('')

  const emptyIssue = { inventoryNo: '', employeeNo: '', issueDate: new Date().toISOString().slice(0, 10) }
  const emptyWriteOff = { inventoryNo: '', reason: '', writeOffDate: new Date().toISOString().slice(0, 10) }
  const [issueForm, setIssueForm] = useState(emptyIssue)
  const [writeOffForm, setWriteOffForm] = useState(emptyWriteOff)
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10))
  const [highlightedActNo, setHighlightedActNo] = useState('')
  const highlightTimeoutRef = useRef<number | null>(null)

  const { data: movementActs = [], isLoading: movementLoading } = useQuery<AssetMovementAct[]>({
    queryKey: ['acts-movement'],
    queryFn: () => api.get<AssetMovementAct[]>('/acts/movement').then((r) => r.data),
  })

  const { data: writeOffActs = [], isLoading: writeOffLoading } = useQuery<AssetWriteOffAct[]>({
    queryKey: ['acts-writeoff'],
    queryFn: () => api.get<AssetWriteOffAct[]>('/acts/writeoff').then((r) => r.data),
  })

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: () => api.get<Asset[]>('/assets').then((r) => r.data),
  })

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees').then((r) => r.data),
  })

  const { data: assetTypes = [] } = useQuery<AssetType[]>({
    queryKey: ['assetTypes'],
    queryFn: () => api.get<AssetType[]>('/reference/asset-types').then((r) => r.data),
  })

  const { data: assetStatuses = [] } = useQuery<AssetStatus[]>({
    queryKey: ['assetStatuses'],
    queryFn: () => api.get<AssetStatus[]>('/reference/asset-statuses').then((r) => r.data),
  })

  const empMap = Object.fromEntries(employees.map((e) => [e.employeeNo, e.fullName]))
  const typeMap = Object.fromEntries(assetTypes.map((t) => [t.id, t.name]))
  const statusMap = Object.fromEntries(assetStatuses.map((s) => [s.id, s.name]))
  const issueActs = movementActs.filter((a) => a.movementType === 'ISSUE')
  const returnActs = movementActs.filter((a) => a.movementType === 'RETURN')
  const returnByIssueActNo = Object.fromEntries(returnActs.filter((a) => a.relatedActNo).map((a) => [a.relatedActNo!, a]))
  // Активы с открытым актом выдачи нельзя выдать повторно
  const issuedInventories = new Set(issueActs.filter((a) => !returnByIssueActNo[a.actNo]).map((a) => a.assetInventoryNo))
  const usableAssets = assets.filter((a) => statusMap[a.statusId] !== 'Списано')
  const issueAssetOptions = usableAssets.filter((a) => !issuedInventories.has(a.inventoryNo))
  const writeOffAssetOptions = usableAssets.filter((a) => !issuedInventories.has(a.inventoryNo))

  const scrollToMovementAct = (actNo: string) => {
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current)
    }
    setHighlightedActNo(actNo)
    window.requestAnimationFrame(() => {
      document.getElementById(`movement-act-${actNo}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedActNo((current) => current === actNo ? '' : current)
      highlightTimeoutRef.current = null
    }, 2000)
  }

  const issueMutation = useMutation({
    mutationFn: (body: object) => api.post('/acts/movement/issue', body),
    onSuccess: () => {
      // После выдачи перечитываем акты, чтобы увидеть новый ОС-2
      qc.invalidateQueries({ queryKey: ['acts-movement'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      setShowIssue(false)
      setIssueForm(emptyIssue)
      setFormError('')
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка'),
  })

  const returnMutation = useMutation({
    mutationFn: ({ actNo, date }: { actNo: string; date: string }) =>
      api.post(`/acts/movement/${actNo}/return`, { returnDate: date }),
    onSuccess: () => {
      // Возврат закрывает открытый акт выдачи и обновляет список ОС-2
      qc.invalidateQueries({ queryKey: ['acts-movement'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      setShowReturn(null)
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Ошибка возврата'),
  })

  const writeOffMutation = useMutation({
    mutationFn: (body: object) => api.post('/acts/writeoff', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acts-writeoff'] })
      // Списание меняет статус актива, поэтому список активов тоже обновляется
      qc.invalidateQueries({ queryKey: ['assets'] })
      setShowWriteOff(false)
      setWriteOffForm(emptyWriteOff)
      setFormError('')
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка'),
  })

  const downloadFile = (url: string, filename: string, mime: string) => {
    // Акты скачиваются как blob, потому что backend возвращает файл, а не JSON
    api.get(url, { responseType: 'blob' }).then((r) => {
      const blob = new Blob([r.data], { type: mime })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Акты</h1>
          <p className="text-sm text-slate-500 mt-0.5">Выдача, сдача (ОС-2) и списание (ОС-4) оборудования</p>
        </div>
        <div className="flex gap-2">
          {tab === 'issue' && (
            <button
              onClick={() => { setShowIssue(true); setFormError('') }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Plus className="h-4 w-4" /> Выдать актив
            </button>
          )}
          {tab === 'writeoff' && canWriteOff && (
            <button
              onClick={() => { setShowWriteOff(true); setFormError('') }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Plus className="h-4 w-4" /> Списать актив
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('issue')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'issue' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          ОС-2 Перемещение ({movementActs.length})
        </button>
        <button
          onClick={() => setTab('writeoff')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'writeoff' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          ОС-4 Списание ({writeOffActs.length})
        </button>
      </div>

      {/* Movement acts */}
      {tab === 'issue' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {movementLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : movementActs.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Актов перемещения нет</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Номер акта</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Тип</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Инв. номер</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Сотрудник</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Дата</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Парный акт</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movementActs.map((a) => {
                  const isIssue = a.movementType === 'ISSUE'
                  const returnAct = isIssue ? returnByIssueActNo[a.actNo] : null
                  const pairActNo = isIssue ? returnAct?.actNo : a.relatedActNo
                  return (
                  <tr id={`movement-act-${a.actNo}`} key={a.actNo} className={`transition-colors ${highlightedActNo === a.actNo ? 'bg-amber-50' : 'hover:bg-indigo-50/40'}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{a.actNo}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isIssue ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                        {isIssue ? 'Выдача' : 'Возврат'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{a.assetInventoryNo}</td>
                    <td className="px-4 py-3 text-slate-700">{empMap[a.employeeNo] ?? a.employeeNo}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(a.movementDate)}</td>
                    <td className="px-4 py-3">
                      {a.relatedActNo ? (
                        <button
                          type="button"
                          onClick={() => scrollToMovementAct(a.relatedActNo!)}
                          className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {a.relatedActNo}
                        </button>
                      ) : returnAct ? (
                        <button
                          type="button"
                          onClick={() => scrollToMovementAct(pairActNo!)}
                          className="font-mono text-xs font-semibold text-orange-700 hover:text-orange-900 hover:underline"
                        >
                          {returnAct.actNo}
                        </button>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium">
                          {isIssue ? 'Возврат не оформлен' : '–'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isIssue && !returnAct && (
                          <button
                            onClick={() => { setShowReturn(a); setReturnDate(new Date().toISOString().slice(0, 10)) }}
                            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Вернуть
                          </button>
                        )}
                        <button
                          onClick={() => downloadFile(`/acts/movement/${a.actNo}/xls`, `${a.actNo}.xls`, 'application/vnd.ms-excel')}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          <Download className="h-3.5 w-3.5" /> XLS
                        </button>
                        <button
                          onClick={() => downloadFile(`/acts/movement/${a.actNo}/pdf`, `${a.actNo}.pdf`, 'application/pdf')}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          <Download className="h-3.5 w-3.5" /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Write-off acts */}
      {tab === 'writeoff' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {writeOffLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : writeOffActs.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Актов списания нет</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Номер акта</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Инв. номер</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Причина</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Дата списания</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {writeOffActs.map((a) => (
                  <tr key={a.actNo} className="hover:bg-indigo-50/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{a.actNo}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{a.assetInventoryNo}</td>
                    <td className="px-4 py-3 text-slate-700">{a.reason}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(a.writeOffDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadFile(`/acts/writeoff/${a.actNo}/xls`, `${a.actNo}.xls`, 'application/vnd.ms-excel')}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          <Download className="h-3.5 w-3.5" /> XLS
                        </button>
                        <button
                          onClick={() => downloadFile(`/acts/writeoff/${a.actNo}/pdf`, `${a.actNo}.pdf`, 'application/pdf')}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          <Download className="h-3.5 w-3.5" /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Issue modal */}
      {showIssue && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Выдача актива (ОС-2)</h2>
              <button onClick={() => setShowIssue(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setFormError(''); issueMutation.mutate(issueForm) }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Актив *</label>
                <select
                  required value={issueForm.inventoryNo}
                  onChange={(e) => setIssueForm({ ...issueForm, inventoryNo: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">– выберите –</option>
                  {issueAssetOptions.map((a) => (
                    <option key={a.inventoryNo} value={a.inventoryNo}>
                      {a.inventoryNo} – {typeMap[a.typeId] ? `[${typeMap[a.typeId]}] ` : ''}{a.manufacturer} {a.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Сотрудник *</label>
                <select
                  required value={issueForm.employeeNo}
                  onChange={(e) => setIssueForm({ ...issueForm, employeeNo: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">– выберите –</option>
                  {employees.map((e) => (
                    <option key={e.employeeNo} value={e.employeeNo}>{e.fullName} ({e.employeeNo})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Дата выдачи *</label>
                <input
                  required type="date" value={issueForm.issueDate}
                  onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {formError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowIssue(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button type="submit" disabled={issueMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg">
                  {issueMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Выдать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return modal */}
      {showReturn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Возврат актива</h2>
              <button onClick={() => setShowReturn(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Актив <span className="font-mono font-semibold">{showReturn.assetInventoryNo}</span> от {empMap[showReturn.employeeNo] ?? showReturn.employeeNo}
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Дата возврата *</label>
                <input
                  type="date" value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowReturn(null)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button
                  onClick={() => returnMutation.mutate({ actNo: showReturn.actNo, date: returnDate })}
                  disabled={returnMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-sm font-medium py-2 rounded-lg"
                >
                  {returnMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Write-off modal */}
      {showWriteOff && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Списание актива (ОС-4)</h2>
              <button onClick={() => setShowWriteOff(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setFormError(''); writeOffMutation.mutate(writeOffForm) }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Актив *</label>
                <select
                  required value={writeOffForm.inventoryNo}
                  onChange={(e) => setWriteOffForm({ ...writeOffForm, inventoryNo: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">– выберите –</option>
                  {writeOffAssetOptions.map((a) => (
                    <option key={a.inventoryNo} value={a.inventoryNo}>
                      {a.inventoryNo} – {a.manufacturer} {a.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Причина *</label>
                <select
                  required value={writeOffForm.reason}
                  onChange={(e) => setWriteOffForm({ ...writeOffForm, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">– выберите причину –</option>
                  {WRITE_OFF_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Дата списания *</label>
                <input
                  required type="date" value={writeOffForm.writeOffDate}
                  onChange={(e) => setWriteOffForm({ ...writeOffForm, writeOffDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {formError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowWriteOff(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button type="submit" disabled={writeOffMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium py-2 rounded-lg">
                  {writeOffMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Списать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
