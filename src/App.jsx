import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import LoadingScreen from './components/ui/LoadingScreen'
import ErrorBoundary from './components/ui/ErrorBoundary'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const TodoList = lazy(() => import('./pages/TodoList'))
const Investments = lazy(() => import('./pages/Investments'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Reports = lazy(() => import('./pages/Reports'))
const Profile = lazy(() => import('./pages/Profile'))
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
const SettingsData = lazy(() => import('./pages/settings/SettingsData'))
const SettingsHelp = lazy(() => import('./pages/settings/SettingsHelp'))
const AddAccountPage = lazy(() => import('./pages/AddAccountPage'))
const WalletDetailPage = lazy(() => import('./pages/WalletDetailPage'))
const TodoDetailPage = lazy(() => import('./pages/TodoDetailPage'))

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/todos" element={<TodoList />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/savings/:id" element={<SavingsDetail />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/add-account" element={<AddAccountPage />} />
            <Route path="/wallet/add" element={<Navigate to="/add-account" replace />} />
            <Route path="/wallet/:id" element={<WalletDetailPage />} />
            <Route path="/todos/:id" element={<TodoDetailPage />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<SettingsHome />} />
              <Route path="security" element={<SettingsSecurity />} />
              <Route path="categories" element={<SettingsCategories />} />
              <Route path="recurring" element={<SettingsRecurring />} />
              <Route path="currency" element={<SettingsCurrency />} />
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
