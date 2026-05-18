import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useMe } from '@/hooks/useMe'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import AssetsPage from '@/pages/AssetsPage'
import TicketsPage from '@/pages/TicketsPage'
import ProfilePage from '@/pages/ProfilePage'
import EmployeesPage from '@/pages/EmployeesPage'
import NotificationsPage from '@/pages/NotificationsPage'
import SoftwarePage from '@/pages/SoftwarePage'
import ActsPage from '@/pages/ActsPage'
import LogsPage from '@/pages/LogsPage'
import AnalyticsPage from '@/pages/AnalyticsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  // Без access token пользователь отправляется на страницу логина
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function DefaultRedirect() {
  const { data: me, isLoading } = useMe()
  if (isLoading || !me) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  )
  // Главная страница после входа зависит от роли текущего пользователя
  const homeByRole: Record<string, string> = {
    EMPLOYEE:     '/profile',
    IT_SPECIALIST: '/assets',
    IT_MANAGER:   '/analytics',
    HR:           '/employees',
  }
  return <Navigate to={homeByRole[me.role] ?? '/tickets'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            // Все вложенные routes внутри Layout требуют авторизации
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          {/* Index route открывается на / и сразу перенаправляет пользователя по роли */}
          <Route index element={<DefaultRedirect />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="software" element={<SoftwarePage />} />
          <Route path="acts" element={<ActsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
