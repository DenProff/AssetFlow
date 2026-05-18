import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, User, Search, Pencil, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import type { Employee, Role } from '@/types'

const roleLabels: Record<string, string> = {
  EMPLOYEE: 'Сотрудник',
  IT_SPECIALIST: 'ИТ-специалист',
  IT_MANAGER: 'Руководитель ИТ',
  HR: 'Кадровик',
}

const roleColors: Record<string, string> = {
  EMPLOYEE: 'bg-slate-100 text-slate-700',
  IT_SPECIALIST: 'bg-indigo-100 text-indigo-700',
  IT_MANAGER: 'bg-purple-100 text-purple-700',
  HR: 'bg-pink-100 text-pink-700',
}

export default function EmployeesPage() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  // Создавать, редактировать и удалять сотрудников могут только HR и IT_MANAGER
  const canCreate = me?.role === 'IT_MANAGER' || me?.role === 'HR'

  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const emptyForm = { lastName: '', firstName: '', patronymic: '', position: '', department: '', login: '', password: '', roleId: '' }
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editError, setEditError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees').then((r) => r.data),
  })

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api.get<Role[]>('/reference/roles').then((r) => r.data),
  })

  const roleById = Object.fromEntries(roles.map((r) => [r.id, r.name]))

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/employees', body),
    // После создания перечитываем список сотрудников
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setShowCreate(false); setForm(emptyForm); setFormError('') },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка создания'),
  })

  const editMutation = useMutation({
    mutationFn: ({ no, body }: { no: string; body: object }) => api.put(`/employees/${no}`, body),
    // После редактирования таблица получает обновлённые данные с backend
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setEditEmployee(null); setEditError('') },
    onError: (e: any) => setEditError(e.response?.data?.message ?? 'Ошибка сохранения'),
  })

  const deleteMutation = useMutation({
    mutationFn: (no: string) => api.delete(`/employees/${no}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setDeleteTarget(null); setDeleteError('') },
    onError: (e: any) => setDeleteError(e.response?.data?.message ?? 'Ошибка удаления'),
  })

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp)
    setEditForm({ lastName: emp.lastName, firstName: emp.firstName, patronymic: emp.patronymic ?? '', position: emp.position, department: emp.department, login: emp.login, password: '', roleId: String(emp.roleId) })
    setEditError('')
  }

  const handleCreate = (ev: React.FormEvent) => {
    ev.preventDefault()
    setFormError('')
    // Frontend отправляет roleId числом, а пустое отчество преобразует в null
    createMutation.mutate({
      lastName: form.lastName,
      firstName: form.firstName,
      patronymic: form.patronymic || null,
      position: form.position,
      department: form.department,
      login: form.login,
      password: form.password,
      roleId: Number(form.roleId),
    })
  }

  const filtered = employees.filter((e) => {
    // Поиск работает на frontend по уже загруженному списку сотрудников
    const matchesSearch = !search ||
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeNo.toLowerCase().includes(search.toLowerCase()) ||
      e.login.toLowerCase().includes(search.toLowerCase())
    const matchesRole = !filterRole || String(e.roleId) === filterRole
    return matchesSearch && matchesRole
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Сотрудники</h1>
          <p className="text-sm text-slate-500 mt-0.5">Кадровый учёт</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Добавить сотрудника
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО, табельному, логину..."
            className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => { setFilterRole(e.target.value); e.currentTarget.blur() }}
          className="h-10 min-w-[180px] border border-slate-300 rounded-lg text-sm px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Все роли</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{roleLabels[r.name] ?? r.name}</option>)}
        </select>
        {(search || filterRole) && (
          <button
            onClick={() => { setSearch(''); setFilterRole('') }}
            className="h-10 px-3 text-sm text-slate-500 hover:text-indigo-600"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">Сотрудники не найдены</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Таб. №</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">ФИО</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Должность</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Подразделение</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Логин</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Роль</th>
                {canCreate && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => {
                const roleName = roleById[e.roleId] ?? ''
                return (
                  <tr key={e.employeeNo} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{e.employeeNo}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-indigo-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{e.lastName} {e.firstName}</div>
                          {e.patronymic && <div className="text-xs text-slate-400">{e.patronymic}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{e.position}</td>
                    <td className="px-4 py-3 text-slate-500">{e.department}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{e.login}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[roleName] ?? 'bg-slate-100 text-slate-600'}`}>
                        {roleLabels[roleName] ?? roleName}
                      </span>
                    </td>
                    {canCreate && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(e)} title="Редактировать" className="text-slate-400 hover:text-indigo-600 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => { setDeleteTarget(e); setDeleteError('') }} title="Удалить" className="text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">Редактирование — {editEmployee.employeeNo}</h2>
              <button onClick={() => setEditEmployee(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(ev) => { ev.preventDefault(); editMutation.mutate({ no: editEmployee.employeeNo, body: { lastName: editForm.lastName, firstName: editForm.firstName, patronymic: editForm.patronymic || null, position: editForm.position, department: editForm.department, login: editForm.login, password: editForm.password || null, roleId: Number(editForm.roleId) } }) }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Роль *</label>
                <select required value={editForm.roleId} onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Выберите роль</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{roleLabels[r.name] ?? r.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Фамилия *</label>
                  <input required value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Имя *</label>
                  <input required value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Отчество</label>
                  <input value={editForm.patronymic} onChange={(e) => setEditForm({ ...editForm, patronymic: e.target.value })} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Должность *</label>
                  <input required value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Подразделение *</label>
                  <input required value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Учётные данные</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Логин *</label>
                    <input required value={editForm.login} onChange={(e) => setEditForm({ ...editForm, login: e.target.value })} className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Новый пароль <span className="font-normal text-slate-400">(оставьте пустым, чтобы не менять)</span></label>
                    <input type="password" minLength={4} value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••••" className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
              {editError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditEmployee(null)} className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
                <button type="submit" disabled={editMutation.isPending} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg">
                  {editMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Удалить сотрудника?</h2>
            <p className="text-sm text-slate-600 mb-1">{deleteTarget.lastName} {deleteTarget.firstName} {deleteTarget.patronymic}</p>
            <p className="text-xs text-slate-400 mb-4">Таб. № {deleteTarget.employeeNo}</p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">Нельзя удалить, если за сотрудником числится оборудование или есть открытые заявки.</p>
            {deleteError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteError('') }} className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40">Отмена</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.employeeNo)} disabled={deleteMutation.isPending} className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium py-2 rounded-lg">
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">Новый сотрудник</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Роль *</label>
                  <select
                    required
                    value={form.roleId}
                    onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Выберите роль</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{roleLabels[r.name] ?? r.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Фамилия *</label>
                  <input
                    required value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Имя *</label>
                  <input
                    required value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Отчество</label>
                  <input
                    value={form.patronymic}
                    onChange={(e) => setForm({ ...form, patronymic: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Должность *</label>
                  <input
                    required value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Подразделение *</label>
                  <input
                    required value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Учётные данные</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Логин *</label>
                    <input
                      required value={form.login}
                      onChange={(e) => setForm({ ...form, login: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Пароль *</label>
                    <input
                      required type="password" minLength={4}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {formError && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-indigo-50/40"
                >
                  Отмена
                </button>
                <button
                  type="submit" disabled={createMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
