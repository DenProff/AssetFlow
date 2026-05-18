import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Server, Ticket, Monitor, TrendingUp, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface NameCount { name: string; count: number }
interface MonthBar  { month: string; issues: number; returns: number; writeoffs: number }
interface Summary {
  assets: {
    total: number
    byStatus: NameCount[]
    byType:   NameCount[]
    totalCost: number
  }
  dynamics: MonthBar[]
  tickets: { byStatus: NameCount[] }
  software: { active: number; expiringSoon: number; expired: number }
}

interface Software {
  id: number
  name: string
  version: string
  licenseEnd: string | null
  licenseStatus: string
}

const LICENSE_STATUS_COLORS: Record<string, string> = {
  'Истекает': 'bg-yellow-100 text-yellow-700',
  'Истекла':  'bg-red-100 text-red-700',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

const STATUS_COLORS: Record<string, string> = {
  'На складе':    '#6366f1',
  'Эксплуатация': '#10b981',
  'Ремонт':       '#f59e0b',
  'Списано':      '#ef4444',
}
const TYPE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']
const TICKET_COLORS: Record<string, string> = {
  'Новая':               '#6366f1',
  'В работе':            '#8b5cf6',
  'Выполнена':           '#10b981',
  'Отклонена':           '#ef4444',
}

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: React.ReactNode; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function ChartCard({ title, description, children, legend }: {
  title: string; description?: string; children: React.ReactNode; legend?: React.ReactNode
}) {
  return (
    <div className="bg-white/95 rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
        {legend}
      </div>
      {children}
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label && <p className="font-medium text-slate-700 mb-1">{label}</p>}
      <div className="space-y-1">
        {payload.map((item: any) => (
          <div key={item.dataKey ?? item.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name || item.dataKey}
            </span>
            <span className="font-semibold text-slate-900">{fmt(Number(item.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DonutCenter({ total, label }: { total: number; label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-bold text-slate-900">{fmt(total)}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}

function DonutLegend({ data, colors }: { data: NameCount[]; colors: Record<string, string> }) {
  const total = data.reduce((sum, item) => sum + item.count, 0)
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
      {data.map((item) => {
        const percent = total ? Math.round((item.count / total) * 100) : 0
        return (
          <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 flex items-center gap-2 text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[item.name] ?? '#94a3b8' }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 font-medium text-slate-800">{item.count} · {percent}%</span>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsPage() {
  const { data: swData } = useQuery<Software[]>({
    queryKey: ['software'],
    // Отдельно загружаем ПО, чтобы показать список лицензий с датами окончания
    queryFn: () => api.get('/software').then(r => r.data),
  })

  const expiringSoftware = (swData ?? [])
    // В таблицу внимания попадают истекающие и уже просроченные лицензии
    .filter(s => s.licenseStatus === 'Истекает' || s.licenseStatus === 'Истекла')
    .sort((a, b) => {
      if (!a.licenseEnd) return 1
      if (!b.licenseEnd) return -1
      return a.licenseEnd.localeCompare(b.licenseEnd)
    })

  const { data, isLoading, isError } = useQuery<Summary>({
    queryKey: ['analytics'],
    // Summary содержит агрегированные данные для KPI и графиков
    queryFn: () => api.get('/analytics/summary').then(r => r.data),
  })

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  )
  if (isError || !data) return (
    <div className="text-center text-red-500 mt-16">Ошибка загрузки данных</div>
  )

  const inUse = data.assets.byStatus.find(s => s.name === 'Эксплуатация')?.count ?? 0
  // Открытые заявки считаются как сумма статусов Новая и В работе
  const openTickets = data.tickets.byStatus
    .filter(s => s.name === 'Новая' || s.name === 'В работе')
    .reduce((s, v) => s + v.count, 0)
  const totalTicketStatus = data.tickets.byStatus.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="space-y-6 [&_.recharts-sector:focus]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-bar-rectangle:focus]:outline-none [&_.recharts-bar-rectangle]:outline-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Аналитика</h1>
        <p className="text-sm text-slate-500 mt-0.5">Сводка по активам, заявкам и лицензиям</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={Server}     label="Всего активов"   value={data.assets.total}
                 sub={`В эксплуатации: ${inUse}`}          color="bg-indigo-500" />
        <KpiCard icon={TrendingUp} label="Стоимость парка" value={`${fmt(data.assets.totalCost)} ₽`}
                 color="bg-emerald-500" />
        <KpiCard icon={Ticket}     label="Открытых заявок" value={openTickets}
                 sub={`Всего заявок: ${totalTicketStatus}`} color="bg-amber-500" />
        <KpiCard icon={Monitor}    label="Лицензии"        value={data.software.active}
                 sub={(
                   <div className="space-y-0.5">
                     <div>Истекают за 30 дней: {data.software.expiringSoon}</div>
                     <div>Истекло: {data.software.expired}</div>
                   </div>
                 )}
                 color="bg-violet-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Оборудование по статусу" description="Распределение оборудования по текущему состоянию">
          <div className="relative">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.assets.byStatus} dataKey="count" nameKey="name"
                     innerRadius={72} outerRadius={98} paddingAngle={4} stroke="none">
                  {data.assets.byStatus.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <DonutCenter total={data.assets.total} label="единиц" />
          </div>
          <DonutLegend data={data.assets.byStatus} colors={STATUS_COLORS} />
        </ChartCard>

        <ChartCard title="Оборудование по типу" description="Какие категории оборудования преобладают">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.assets.byType} layout="vertical" margin={{ left: 16, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Количество" radius={[0, 6, 6, 0]}>
                {data.assets.byType.map((_, i) => (
                  <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Движение активов"
          description="Выдачи, возвраты и списания за последние 6 месяцев"
          legend={
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-600" />Выдачи</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" />Возвраты</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Списания</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.dynamics} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="issues" name="Выдачи" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              <Bar dataKey="returns" name="Возвраты" fill="#f97316" radius={[6, 6, 0, 0]} />
              <Bar dataKey="writeoffs" name="Списания" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Заявки по статусу" description="Текущая нагрузка и закрытые обращения">
          <div className="relative">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.tickets.byStatus} dataKey="count" nameKey="name"
                     innerRadius={72} outerRadius={98} paddingAngle={4} stroke="none">
                  {data.tickets.byStatus.map((entry) => (
                    <Cell key={entry.name} fill={TICKET_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <DonutCenter total={totalTicketStatus} label="заявок" />
          </div>
          <DonutLegend data={data.tickets.byStatus} colors={TICKET_COLORS} />
        </ChartCard>
      </div>

      {expiringSoftware.length > 0 && (
        <ChartCard
          title="Лицензии, требующие внимания"
          description="Истекают в ближайшие 30 дней или уже просрочены"
        >
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Программа</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Версия</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Дата окончания</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">До истечения</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expiringSoftware.map((sw) => {
                  const days = daysUntil(sw.licenseEnd)
                  return (
                    <tr key={sw.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{sw.name}</td>
                      <td className="px-4 py-3 text-slate-500">{sw.version}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(sw.licenseEnd)}</td>
                      <td className="px-4 py-3">
                        {days === null ? '–' : days < 0
                          ? <span className="text-red-600 font-medium">{Math.abs(days)} дн. назад</span>
                          : <span className="text-amber-600 font-medium">через {days} дн.</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LICENSE_STATUS_COLORS[sw.licenseStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                          {sw.licenseStatus}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  )
}
