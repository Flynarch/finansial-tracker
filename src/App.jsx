import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import LoadingScreen from './components/ui/LoadingScreen'
import ErrorBoundary from './components/ui/ErrorBoundary'

function GoalDetailRedirect() {
  const { id } = useParams()
  return <Navigate to={`/savings/${id}`} replace />
}

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const TodoList = lazy(() => import('./pages/TodoList'))
const Profile = lazy(() => import('./pages/Profile'))

const Calendar = lazy(() => import('./pages/Calendar'))
const Reports = lazy(() => import('./pages/Reports'))
const Budget = lazy(() => import('./pages/Budget'))
const Savings = lazy(() => import('./pages/Savings'))
const SavingsDetail = lazy(() => import('./pages/SavingsDetail'))
const Loans = lazy(() => import('./pages/Loans'))
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'))
const SettingsHome = lazy(() => import('./pages/settings/SettingsHome'))
const SettingsSecurity = lazy(() => import('./pages/settings/SettingsSecurity'))
const SettingsCategories = lazy(() => import('./pages/settings/SettingsCategories'))
const SettingsRecurring = lazy(() => import('./pages/settings/SettingsRecurring'))
const SettingsCurrency = lazy(() => import('./pages/settings/SettingsCurrency'))
const SettingsAi = lazy(() => import('./pages/settings/SettingsAi'))
const SettingsNotifications = lazy(() => import('./pages/settings/SettingsNotifications'))
const SettingsData = lazy(() => import('./pages/settings/SettingsData'))
const SettingsHelp = lazy(() => import('./pages/settings/SettingsHelp'))
const AddAccountPage = lazy(() => import('./pages/AddAccountPage'))
const WalletDetailPage = lazy(() => import('./pages/WalletDetailPage'))
const TodoDetailPage = lazy(() => import('./pages/TodoDetailPage'))
const AiFinanceChat = lazy(() => import('./pages/AiFinanceChat'))

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/loading" element={<LoadingScreen isPreview />} />
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/todos" element={<TodoList />} />
            <Route path="/investments" element={<Navigate to="/dashboard" replace />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/savings/:id" element={<SavingsDetail />} />
            <Route path="/goal" element={<Navigate to="/savings" replace />} />
            <Route path="/goals" element={<Navigate to="/savings" replace />} />
            <Route path="/goal/:id" element={<GoalDetailRedirect />} />
            <Route path="/goals/:id" element={<GoalDetailRedirect />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/add-account" element={<AddAccountPage />} />
            <Route path="/wallet/add" element={<Navigate to="/add-account" replace />} />
            <Route path="/wallet/:id" element={<WalletDetailPage />} />
            <Route path="/todos/:id" element={<TodoDetailPage />} />
            <Route path="/recurring" element={<Navigate to="/settings/recurring" replace />} />
            <Route path="/ai-chat" element={<AiFinanceChat />} />
            <Route path="/chat" element={<Navigate to="/ai-chat" replace />} />
            <Route path="/ai-finance" element={<Navigate to="/ai-chat" replace />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<SettingsHome />} />
              <Route path="security" element={<SettingsSecurity />} />
              <Route path="categories" element={<SettingsCategories />} />
              <Route path="recurring" element={<SettingsRecurring />} />
              <Route path="currency" element={<SettingsCurrency />} />
              <Route path="notifications" element={<SettingsNotifications />} />
              <Route path="ai" element={<SettingsAi />} />
              <Route path="data" element={<SettingsData />} />
              <Route path="help" element={<SettingsHelp />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
